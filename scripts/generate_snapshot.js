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

  // Alert bar: first curated news item
  const alertItem = curated[0];
  const alertHtml = alertItem ? `
    <div class="db-alert">
      <strong>${alertItem.headline}</strong>
      ${alertItem.why_it_matters || ''}
    </div>` : '';

  // Market cards
  function mktCard(label, item, dollar = false) {
    if (!item) return '';
    const prefix = dollar ? '$' : '';
    const cls    = chgClass(item.change_pct);
    const arrow  = chgArrow(item.change_pct);
    const chgStr = item.change_pct != null
      ? `<div class="db-chg ${cls}">${arrow} ${Math.abs(item.change_pct).toFixed(2)}%</div>`
      : '';
    return `
      <div class="db-mkt-card">
        <div class="db-mkt-label">${label}</div>
        <div class="db-mkt-value ${cls}">${prefix}${fmt(item.value, dollar ? 2 : 0)}</div>
        ${chgStr}
      </div>`;
  }

  const marketRow = `
    <div class="db-mkt-row">
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
        bulletsHtml = '<ul class="db-bullets">' + bullets.map(b => `<li>${b}</li>`).join('') + '</ul>';
      }
    } catch {}
    return `
      <div class="db-section">
        <h2>${panel.title}</h2>
        <p>${(panel.body || '').replace(/\n\n/g, '</p><p>').replace(/\n/g, ' ')}</p>
        ${bulletsHtml}
      </div>`;
  }

  // Top news items (up to 4)
  const newsItems = curated.slice(0, 4).map(n => `
    <div class="db-news-item">
      <div class="db-news-headline">${n.url ? `<a href="${n.url}" target="_blank">${n.headline}</a>` : n.headline}</div>
      ${n.why_it_matters ? `<div class="db-news-why">${n.why_it_matters}</div>` : ''}
    </div>`).join('');

  const newsSection = newsItems ? `
    <div class="db-section">
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f1117; color: #e2e8f0; font-size: 15px; line-height: 1.7;
    }
    .db-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-bottom: 1px solid #2d3748;
      padding: 24px 32px 20px;
    }
    .db-header h1 { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; }
    .db-header .meta { font-size: 12px; color: #718096; letter-spacing: .02em; }
    .db-container { max-width: 860px; margin: 0 auto; padding: 24px 24px 60px; }

    /* Alert bar */
    .db-alert {
      background: rgba(214,158,46,.1); border: 1px solid rgba(214,158,46,.3);
      border-left: 4px solid #d69e2e; border-radius: 8px;
      padding: 14px 18px; margin-bottom: 20px; font-size: 13px; color: #f6e05e;
    }
    .db-alert strong { display: block; font-size: 14px; margin-bottom: 4px; color: #faf089; }

    /* Market cards */
    .db-mkt-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); gap: 10px; margin-bottom: 20px; }
    .db-mkt-card {
      background: #1a202c; border: 1px solid #2d3748; border-radius: 10px;
      padding: 14px 16px;
    }
    .db-mkt-label { font-size: 10px; font-weight: 700; color: #4a5568; text-transform: uppercase;
                    letter-spacing: .06em; margin-bottom: 6px; }
    .db-mkt-value { font-size: 22px; font-weight: 700; color: #e2e8f0; line-height: 1.1; }
    .db-mkt-value.green { color: #68d391; }
    .db-mkt-value.red   { color: #fc8181; }
    .db-chg { font-size: 11px; font-weight: 600; margin-top: 4px; }
    .db-chg.green { color: #68d391; }
    .db-chg.red   { color: #fc8181; }

    /* Sections */
    .db-section {
      background: #1a202c; border: 1px solid #2d3748; border-radius: 12px;
      padding: 20px 24px; margin-bottom: 14px;
    }
    .db-section h2 {
      font-size: 11px; font-weight: 700; color: #4299e1; text-transform: uppercase;
      letter-spacing: .08em; margin-bottom: 14px; padding-bottom: 10px;
      border-bottom: 1px solid #2d3748;
    }
    .db-section p { margin-bottom: 10px; color: #cbd5e0; font-size: 14px; line-height: 1.75; }
    .db-section p:last-child { margin-bottom: 0; }
    .db-bullets { margin: 10px 0 0 0; list-style: none; }
    .db-bullets li { padding: 6px 0 6px 20px; position: relative; color: #cbd5e0;
                     font-size: 14px; border-bottom: 1px solid #2d3748; }
    .db-bullets li:last-child { border-bottom: none; }
    .db-bullets li::before { content: "›"; position: absolute; left: 2px; color: #4299e1;
                              font-weight: 700; font-size: 16px; line-height: 1.3; }

    /* News items */
    .db-news-item { padding: 12px 0; border-bottom: 1px solid #2d3748; }
    .db-news-item:last-child { border-bottom: none; padding-bottom: 0; }
    .db-news-headline { font-weight: 600; font-size: 14px; color: #e2e8f0; margin-bottom: 4px; }
    .db-news-headline a { color: #63b3ed; text-decoration: none; }
    .db-news-headline a:hover { text-decoration: underline; }
    .db-news-why { font-size: 13px; color: #718096; line-height: 1.6; }

    .db-footer { margin-top: 20px; font-size: 12px; color: #4a5568; text-align: center;
                 padding-top: 16px; border-top: 1px solid #2d3748; }
  </style>
</head>
<body>
  <div class="db-header">
    <h1>Daily Brief &mdash; ${todayLabel()}</h1>
    <div class="meta">For Larry and Maria &nbsp;&middot;&nbsp; Generated ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
  </div>
  <div class="db-container">
    ${alertHtml}
    ${marketRow}
    ${overview    ? panelSection(overview)   : ''}
    ${newsSection}
    ${watchPanel  ? panelSection(watchPanel) : ''}
    ${riskPanel   ? panelSection(riskPanel)  : ''}
    <div class="db-footer">Generated from live market data &nbsp;&middot;&nbsp; Not financial advice</div>
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
