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
  T5YIE:    { name: '5-Yr Breakeven Inflation',    unit: 'percent' },
  DCOILWTICO: { name: 'WTI Crude Oil',             unit: 'usd_per_barrel' },
  VIXCLS:   { name: 'VIX Volatility Index',        unit: 'index' },
};

function fetchSeries(seriesId, apiKey, limit = 24) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}?series_id=${seriesId}&api_key=${apiKey}&limit=${limit}&sort_order=desc&file_type=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const observations = (parsed.observations || []).filter(o => o.value !== '.');
          if (!observations.length) return resolve(null);
          const latest = observations[0];
          const history = observations.reverse().map(o => ({
            series_id: seriesId,
            value: parseFloat(o.value),
            observation_date: o.date,
            unit: SERIES[seriesId]?.unit || null
          }));
          resolve({
            series_id: seriesId,
            name: SERIES[seriesId]?.name || seriesId,
            value: parseFloat(latest.value),
            observation_date: latest.date,
            unit: SERIES[seriesId]?.unit || null,
            history
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
