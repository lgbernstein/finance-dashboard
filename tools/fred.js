const https = require('https');

const BASE = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES = {
  DGS10:    { name: '10-Year Treasury Yield',       unit: 'percent' },
  DGS30:    { name: '30-Year Treasury Yield',       unit: 'percent' },
  DGS2:     { name: '2-Year Treasury Yield',        unit: 'percent' },
  FEDFUNDS: { name: 'Federal Funds Rate',           unit: 'percent' },
  CPIAUCSL: { name: 'CPI (All Urban)',              unit: 'index' },
  UNRATE:   { name: 'Unemployment Rate',            unit: 'percent' },
  GDP:      { name: 'Real GDP',                     unit: 'billions' },
  T10YIE:   { name: '10-Yr Breakeven Inflation',   unit: 'percent' },
  DCOILWTICO: { name: 'WTI Crude Oil',             unit: 'usd_per_barrel' },
  VIXCLS:   { name: 'VIX Volatility Index',        unit: 'index' },
};

function fetchSeries(seriesId, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}?series_id=${seriesId}&api_key=${apiKey}&limit=1&sort_order=desc&file_type=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const obs = parsed.observations?.[0];
          if (!obs || obs.value === '.') return resolve(null);
          resolve({
            series_id: seriesId,
            name: SERIES[seriesId]?.name || seriesId,
            value: parseFloat(obs.value),
            observation_date: obs.date,
            unit: SERIES[seriesId]?.unit || null
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function fetchAll(apiKey) {
  const results = {};
  const gaps = [];

  await Promise.all(Object.keys(SERIES).map(async (id) => {
    try {
      const data = await fetchSeries(id, apiKey);
      if (data) results[id] = data;
      else gaps.push(`${id}: no value returned`);
    } catch (e) {
      gaps.push(`${id}: ${e.message}`);
    }
  }));

  return { data: results, gaps };
}

module.exports = { fetchAll, SERIES };
