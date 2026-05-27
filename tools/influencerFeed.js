// tools/influencerFeed.js
// Fetches YouTube RSS and podcast RSS feeds for all configured influencers.
// Returns a normalized array of recent content items for the Analyst agent.

const Parser = require('rss-parser');
const { INFLUENCERS, INFLUENCER_LOOKBACK_DAYS } = require('../config/influencers');

const parser = new Parser({
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['media:description', 'mediaDescription'],
    ],
  },
  timeout: 10000,
});

/**
 * Fetches all influencer feeds and returns normalized content items
 * published within the lookback window.
 *
 * @returns {Promise<Array>} Array of content item objects
 */
async function fetchInfluencerContent() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INFLUENCER_LOOKBACK_DAYS);

  const results = [];
  const errors = [];

  for (const influencer of INFLUENCERS) {
    for (const feed of influencer.feeds) {
      try {
        const parsed = await parser.parseURL(feed.url);

        for (const item of parsed.items) {
          const pubDate = item.pubDate ? new Date(item.pubDate) : null;

          // Skip items outside the lookback window
          if (pubDate && pubDate < cutoff) continue;

          // Extract description — YouTube wraps it differently than podcast RSS
          const rawDescription =
            item.contentSnippet ||
            item.mediaDescription ||
            item['media:group']?.['media:description']?.[0] ||
            item.summary ||
            '';

          // Trim description to 500 chars to keep shared_memory lean
          const description = rawDescription.replace(/\s+/g, ' ').trim().slice(0, 500);

          results.push({
            creatorId: influencer.id,
            creatorName: influencer.name,
            feedType: feed.type,           // 'youtube' | 'podcast'
            feedLabel: feed.label || feed.type,
            title: (item.title || '').trim(),
            description,
            pubDate: pubDate ? pubDate.toISOString() : null,
            url: item.link || item.guid || '',
          });
        }
      } catch (err) {
        errors.push({
          creatorId: influencer.id,
          feedType: feed.type,
          url: feed.url,
          error: err.message,
        });
        console.error(`[influencerFeed] Failed to fetch ${influencer.name} (${feed.type}): ${err.message}`);
      }
    }
  }

  // Sort newest first
  results.sort((a, b) => {
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  return { items: results, errors, fetchedAt: new Date().toISOString() };
}

module.exports = { fetchInfluencerContent };
