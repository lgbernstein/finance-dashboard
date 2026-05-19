const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });

const FEEDS = [
  { source: 'Reuters', url: 'https://feeds.reuters.com/reuters/businessNews' },
  { source: 'AP',      url: 'https://feeds.apnews.com/rss/apf-business' },
];

async function fetchAll(sinceHours = 24) {
  const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const items = [];
  const gaps = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items || []) {
        const pub = item.pubDate ? new Date(item.pubDate) : null;
        if (pub && pub < cutoff) continue;
        items.push({
          source: feed.source,
          title: item.title || '',
          url: item.link || item.guid || '',
          published_at: pub ? pub.toISOString() : new Date().toISOString(),
          summary: (item.contentSnippet || item.content || '').slice(0, 300)
        });
      }
    } catch (e) {
      gaps.push(`${feed.source}: ${e.message}`);
    }
  }

  items.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  return { items, gaps };
}

module.exports = { fetchAll, FEEDS };
