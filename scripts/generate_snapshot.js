#!/usr/bin/env node
'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const db   = require('../db');

const OUT_DIR = path.join(__dirname, '..');

function fmt(val, digits = 2) {
  if (val == null) return 'N/A';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function chgClass(chg) {
  if (chg == null) return '';
  return chg >= 0 ? 'green' : 'red';
}

function chgArrow(chg) {
  if (chg == null) return '';
  return chg >= 0 ? '▲' : '▼';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function todayFile() {
  return new Date().toISOString().slice(0, 10);
}

function buildHtml(data) {
  const { market, panels, curated, news } = data;

  // Index market items by symbol for easy lookup
  const mkt = {};
  for (const m of market) mkt[m.symbol] = m;

  const sp   = mkt['SPY']  || mkt['^GSPC'] || mkt['SP500'];
  const dow  = mkt['DIA']  || mkt['^DJI']  || mkt['DOW'];
  const nq   = mkt['QQQ']  || mkt['^IXIC'] || mkt['NASDAQ'];
  const yld  = mkt['TNX']  || mkt['^TNX']  || mkt['10YR'];
  const vix  = mkt['VIX']  || mkt['^VIX'];
  const oil  = mkt['CL=F'] || mkt['WTI']   || mkt['OIL'];

  // Pull panels by ID
  const panelMap = {};
  for (const p of panels) panelMap[p.panel_id] = p;

  const overview   = panelMap['today_situation'] || panelMap['overview']      || panels[0];
  const topStories = panelMap['top_stories']     || panelMap['news_analysis'] || panels[1];
  const watchPanel = panelMap['what_to_watch']   || panelMap['watch']         || panels[2];
  const riskPanel  = panelMap['risk_watch']      || panelMap['risk'];

  // Alert bar: first curated news or risk panel
  const alertItem = curated[0];
  const alertHtml = alertItem ? `
    <div class="alert-bar yellow">
      <strong>${alertItem.headline}</strong>
      ${alertItem.why_it_matters || ''}
    </div>` : '';

  // Market row
  function mktCard(label, item, dollar = false) {
    if (!item) return '';
    const prefix = dollar ? '$' : '';
    const cls    = chgClass(item.change_pct);
    const arrow  = chgArrow(item.change_pct);
    const chgStr = item.change_pct != null
      ? `<span class="chg ${cls}">${arrow} ${Math.abs(item.change_pct).toFixed(2)}%</span>`
      : '';
    return `
      <div class="mkt-card">
        <div class="mkt-label">${label}</div>
        <div class="mkt-value ${cls}">${prefix}${fmt(item.value, dollar ? 2 : 0)}</div>
        ${chgStr}
      </div>`;
  }

  const marketRow = `
    <div class="mkt-row">
      ${mktCard('S&amp;P 500', sp)}
      ${mktCard('Dow Jones', dow)}
      ${mktCard('NASDAQ', nq)}
      ${mktCard('WTI Crude', oil, true)}
      ${mktCard('VIX', vix)}
      ${mktCard('10-YR Yield', yld)}
    </div>`;

  // Panel section helper
  function panelSection(panel) {
    if (!panel) return '';
    let bulletsHtml = '';
    try {
      const bullets = panel.bullets ? JSON.parse(panel.bullets) : [];
      if (bullets.length) {
        bulletsHtml = '<ul class="bullets">' + bullets.map(b => `<li>${b}</li>`).join('') + '</ul>';
      }
    } catch {}
    return `
      <div class="section">
        <h2>${panel.title}</h2>
        <p>${(panel.body || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, ' ')}</p>
        ${bulletsHtml}
      </div>`;
  }

  // Top news items (up to 4)
  const newsItems = curated.slice(0, 4).map(n => `
    <div class="news-item">
      <div class="news-headline">${n.url ? `<a href="${n.url}" target="_blank">${n.headline}</a>` : n.headline}</div>
      ${n.why_it_matters ? `<div class="news-why">${n.why_it_matters}</div>` : ''}
    </div>`).join('');

  const newsSection = newsItems ? `
    <div class="section">
      <h2>Top Stories</h2>
      ${newsItems}
    </div>` : (topStories ? panelSection(topStories) : '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Brief — ${todayLabel()}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, sans-serif;
           background: #f4f6f9; color: #1a1a2e; font-size: 16px; line-height: 1.75; }
    header { background: #1a1a2e; color: white; padding: 20px 40px; }
    header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    header .meta { font-size: 13px; color: #a0aec0; }
    .container { max-width: 700px; margin: 0 auto; padding: 28px 24px 60px; }
    .alert-bar { background: #fffff0; border: 1px solid #faf089; border-left: 4px solid #d69e2e;
                 border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;
                 font-size: 14px; color: #744210; }
    .alert-bar strong { display: block; margin-bottom: 4px; font-size: 15px; }
    .mkt-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .mkt-card { background: white; border-radius: 10px; padding: 14px 18px; flex: 1 1 120px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.07); min-width: 100px; }
    .mkt-label { font-size: 11px; font-weight: 600; color: #718096; text-transform: uppercase;
                 letter-spacing: .04em; margin-bottom: 4px; }
    .mkt-value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    .mkt-value.green { color: #276749; }
    .mkt-value.red   { color: #c53030; }
    .chg { font-size: 12px; font-weight: 600; display: block; margin-top: 2px; }
    .chg.green { color: #276749; }
    .chg.red   { color: #c53030; }
    .section { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07);
               padding: 22px 28px; margin-bottom: 16px; }
    .section h2 { font-size: 17px; font-weight: 700; color: #1a1a2e; margin-bottom: 14px;
                  padding-bottom: 8px; border-bottom: 2px solid #edf2f7; }
    .section p { margin-bottom: 12px; color: #2d3748; }
    .section p:last-child { margin-bottom: 0; }
    .bullets { margin: 10px 0 0 18px; color: #2d3748; }
    .bullets li { margin-bottom: 6px; }
    .news-item { padding: 12px 0; border-bottom: 1px solid #edf2f7; }
    .news-item:last-child { border-bottom: none; padding-bottom: 0; }
    .news-headline { font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
    .news-headline a { color: #2b6cb0; text-decoration: none; }
    .news-headline a:hover { text-decoration: underline; }
    .news-why { font-size: 14px; color: #4a5568; }
    .footer-note { margin-top: 24px; font-size: 13px; color: #a0aec0; text-align: center;
                   padding-top: 16px; border-top: 1px solid #edf2f7; }
  </style>
</head>
<body>
  <header>
    <h1>Daily Brief — ${todayLabel()}</h1>
    <div class="meta">For Larry and Maria &nbsp;|&nbsp; Generated ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
  </header>
  <div class="container">
    ${alertHtml}
    ${marketRow}
    ${overview    ? panelSection(overview)   : ''}
    ${newsSection}
    ${watchPanel  ? panelSection(watchPanel) : ''}
    ${riskPanel   ? panelSection(riskPanel)  : ''}
    <div class="footer-note">
      Generated from live market data. Not financial advice.
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  try {
    const dash    = db.getDashboard();
    const market  = dash.market  || [];
    const panels  = dash.panels  || [];
    const curated = dash.curated_news || [];
    const news    = dash.news    || [];

    if (!market.length && !panels.length) {
      console.error('[generate_snapshot] No data in database yet — run run_cycle.js first');
      process.exit(1);
    }

    const html     = buildHtml({ market, panels, curated, news });
    const filename = `Daily_Snapshot_${todayFile()}.html`;
    const outPath  = path.join(OUT_DIR, filename);

    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`[generate_snapshot] Written: ${filename}`);
  } catch (err) {
    console.error('[generate_snapshot] Error:', err.message);
    process.exit(1);
  }
}

main();
