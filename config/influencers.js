// config/influencers.js
// Registry of financial influencer content feeds for sentiment analysis.
// YouTube RSS feeds require no API key.
// Add or remove creators here — no other files need to change.

const INFLUENCERS = [
  {
    id: 'kenneth_suna',
    name: 'Kenneth Suna',
    description: 'Stock and options trading education, free resources',
    feeds: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC_ut8WlXchkCsLTJxXdi3cw',
      },
    ],
  },
  {
    id: 'jessica_inskip',
    name: 'Jessica Inskip',
    description: 'Market MakeHer — stock market education, former Fidelity Active Trader Desk',
    feeds: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCj0hqUUfHRU8rExFqYjYmpA',
      },
      {
        type: 'podcast',
        url: 'https://feeds.buzzsprout.com/2194438.rss',
        label: 'Market MakeHer Podcast',
      },
    ],
  },
  {
    id: 'tyler_gardner',
    name: 'Tyler Gardner',
    description: 'Retirement and investing for everyday people, 4M+ followers',
    feeds: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC9wgcuu3e5qj8ashw6eRxQw',
      },
      {
        type: 'podcast',
        url: 'https://feeds.megaphone.fm/TCL9866893823',
        label: 'Your Money Guide on the Side',
      },
    ],
  },
  {
    id: 'alexis_and_dean',
    name: 'Alexis and Dean',
    description: 'Relatable personal finance and economic commentary, 2M+ TikTok followers',
    feeds: [
      {
        type: 'youtube',
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCA5zR9rZr7N3adJJ-VWC3kA',
      },
    ],
  },
];

// How many days back to pull content (default: 7)
const INFLUENCER_LOOKBACK_DAYS = 7;

module.exports = { INFLUENCERS, INFLUENCER_LOOKBACK_DAYS };
