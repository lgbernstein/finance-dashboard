const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ── Clock ──────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(tickClock, 1000);
tickClock();

// ── Relative time ──────────────────────────────────
function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Format number ──────────────────────────────────
function fmt(val, decimals = 2) {
  if (val == null) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Render alerts ──────────────────────────────────
function renderAlerts(alerts) {
  const bar = document.getElementById('alert-bar');
  const active = alerts.filter(a => !a.resolved_at);
  if (!active.length) { bar.classList.add('hidden'); return; }

  bar.classList.remove('hidden');
  bar.innerHTML = active.map(a => `
    <span class="alert-tag">${a.severity}</span>
    <span>${a.headline}</span>
  `).join('<span style="color:#666;margin:0 4px">|</span>');
}

// ── Render panels ──────────────────────────────────
function renderPanels(panels) {
  const grid = document.getElementById('panels-grid');
  if (!panels.length) {
    grid.innerHTML = '<div class="panel-skeleton">No analysis available yet. Run the daily cycle to generate commentary.</div>';
    return;
  }
  grid.innerHTML = panels.map(p => {
    const conf = p.confidence != null ? `${Math.round(p.confidence * 100)}% confidence` : '';
    const chips = p.data_points
      ? JSON.parse(p.data_points).map(d => `<span class="dp-chip">${d}</span>`).join('')
      : '';
    const changed = p.last_changed ? `<div class="panel-changed">${p.last_changed}</div>` : '';
    return `
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">${p.title}</div>
          <div class="panel-confidence">${conf}</div>
        </div>
        <div class="panel-body">${p.body}</div>
        ${chips ? `<div class="panel-datapoints">${chips}</div>` : ''}
        ${changed}
      </div>
    `;
  }).join('');
}

// ── Render indicators ──────────────────────────────
const INDICATOR_LABELS = {
  DGS10:    '10-Yr Yield',
  DGS30:    '30-Yr Yield',
  DGS2:     '2-Yr Yield',
  FEDFUNDS: 'Fed Funds Rate',
  CPIAUCSL: 'CPI',
  UNRATE:   'Unemployment',
  T10YIE:   '10-Yr Breakeven',
  DCOILWTICO: 'WTI Crude',
  VIXCLS:   'VIX (FRED)',
};

function renderIndicators(indicators) {
  const grid = document.getElementById('indicators-grid');
  grid.innerHTML = indicators.map(ind => {
    const label = INDICATOR_LABELS[ind.series_id] || ind.series_id;
    const unit = ind.unit === 'percent' ? '%' : ind.unit === 'usd_per_barrel' ? ' $/bbl' : '';
    return `
      <div class="indicator-card">
        <div class="indicator-name">${label}</div>
        <div class="indicator-value">${fmt(ind.value)}${unit}</div>
        <div class="indicator-meta">${ind.observation_date}</div>
      </div>
    `;
  }).join('');
}

// ── Render markets ─────────────────────────────────
function renderMarkets(markets) {
  const grid = document.getElementById('markets-grid');
  grid.innerHTML = markets.map(m => {
    const chg = m.change_pct;
    const cls = chg == null ? 'flat' : chg > 0 ? 'up' : chg < 0 ? 'down' : 'flat';
    const arrow = chg == null ? '' : chg > 0 ? '▲' : chg < 0 ? '▼' : '—';
    const chgStr = chg != null ? `${arrow} ${Math.abs(chg).toFixed(2)}%` : '—';
    return `
      <div class="market-card">
        <div class="market-name">${m.name}</div>
        <div class="market-value ${cls}">${fmt(m.value)}</div>
        <div class="market-change ${cls}">${chgStr}</div>
      </div>
    `;
  }).join('');
}

// ── Render news ────────────────────────────────────
function renderNews(news) {
  const list = document.getElementById('news-list');
  if (!news.length) {
    list.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:12px;">No news items loaded.</div>';
    return;
  }
  list.innerHTML = news.slice(0, 15).map(n => `
    <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
      <div class="news-source">${n.source}</div>
      <div class="news-title">${n.title}</div>
      <div class="news-age">${relativeTime(n.published_at)}</div>
    </a>
  `).join('');
}

// ── Load and render everything ─────────────────────
async function load() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const lastUpdated = document.getElementById('last-updated');
    if (data.lastCycle) {
      lastUpdated.textContent = `Last cycle: ${relativeTime(data.lastCycle.completed_at)} — ${data.lastCycle.status}`;
    } else {
      lastUpdated.textContent = 'No cycle run yet';
    }

    renderAlerts(data.alerts || []);
    renderPanels(data.panels || []);
    renderIndicators(data.indicators || []);
    renderMarkets(data.market || []);
    renderNews(data.news || []);
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
    document.getElementById('last-updated').textContent = 'Error loading data';
  }
}

load();
setInterval(load, REFRESH_MS);
