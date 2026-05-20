const https = require('https');

async function search(query, count = 5, options = {}) {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY not set');

  return new Promise((resolve, reject) => {
    const freshness = options?.freshness ? `&freshness=${options.freshness}` : '';
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}${freshness}`;
    const opts = {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey
      }
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const results = (parsed.web?.results || []).map(r => ({
            title: r.title,
            url: r.url,
            description: r.description || '',
            published: r.page_age || null
          }));
          resolve(results);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

module.exports = { search };
