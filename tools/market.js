const https = require('https');

const SYMBOLS = {
  '^GSPC':  'S&P 500',
  '^DJI':   'Dow Jones',
  '^IXIC':  'NASDAQ',
  '^RUT':   'Russell 2000',
  '^TNX':   '10-Yr Yield (market)',
  '^VIX':   'VIX',
  'GC=F':   'Gold (futures)',
  'CL=F':   'WTI Crude (futures)',
};

function fetchQuote(symbol) {
  return new Promise((resolve, reject) => {
    const encoded = encodeURIComponent(symbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=2d`;
    const opts = { headers: { 'User-Agent': 'Mozilla/5.0' } };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const meta = parsed?.chart?.result?.[0]?.meta;
          if (!meta) return resolve(null);
          const price = meta.regularMarketPrice ?? meta.previousClose;
          const prev = meta.chartPreviousClose ?? meta.previousClose;
          const changePct = prev && prev !== 0 ? ((price - prev) / prev) * 100 : null;
          resolve({
            symbol,
            name: SYMBOLS[symbol] || symbol,
            value: price,
            change_pct: changePct !== null ? parseFloat(changePct.toFixed(2)) : null,
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchAll() {
  const results = {};
  const gaps = [];

  await Promise.all(Object.keys(SYMBOLS).map(async (sym) => {
    try {
      const data = await fetchQuote(sym);
      if (data) results[sym] = data;
      else gaps.push(`${sym}: no data`);
    } catch (e) {
      gaps.push(`${sym}: ${e.message}`);
    }
  }));

  return { data: results, gaps };
}

module.exports = { fetchAll, SYMBOLS };
