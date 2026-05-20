const REFRESH_MS = 5 * 60 * 1000;

// ── Clock ────────────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(tickClock, 1000);
tickClock();

// ── Helpers ──────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmt(val, dec = 2) {
  if (val == null || isNaN(val)) return '—';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function unitSuffix(unit) {
  if (!unit) return '';
  if (unit === 'percent') return '%';
  if (unit === 'usd_per_barrel') return ' $/bbl';
  if (unit === 'billions') return 'B';
  return '';
}

// ── Mini sparkline chart ──────────────────────────────────────
const chartInstances = {};

function renderSparkline(canvasId, history, seriesId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !history?.length) return;
  const ctx = canvas.getContext('2d');

  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

  const labels = history.map(h => h.observation_date);
  const values = history.map(h => h.value);

  const color = '#4ade80';
  const gradient = ctx.createLinearGradient(0, 0, 0, 60);
  gradient.addColorStop(0, 'rgba(74,222,128,0.3)');
  gradient.addColorStop(1, 'rgba(74,222,128,0)');

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: color,
        borderWidth: 1.5,
        backgroundColor: gradient,
        pointRadius: 0,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: {
          label: ctx => `${fmt(ctx.parsed.y)} (${labels[ctx.dataIndex]})`
        },
        backgroundColor: '#0a0e14',
        borderColor: '#1f2937',
        borderWidth: 1,
        titleColor: '#8b95a7',
        bodyColor: '#e2e8f0',
        padding: 8
      }},
      scales: {
        x: { display: false },
        y: { display: false }
      },
      animation: false
    }
  });
}

// ── Render: alert bar ─────────────────────────────────────────
function renderAlerts(alerts) {
  const bar = document.getElementById('alert-bar');
  const active = (alerts || []).filter(a => !a.resolved_at);
  if (!active.length) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.innerHTML = active.map(a =>
    `<span class="alert-tag">${a.severity}</span><span>${a.headline}</span>`
  ).join('<span style="color:#444;margin:0 8px">|</span>');
}

// ── Render: narrative panel ───────────────────────────────────
const PANEL_META = {
  macro_overview:      { label: 'Macro Overview',          el: 'panel-macro_overview' },
  geopolitical_threads:{ label: 'Geopolitical Threads',    el: 'panel-geopolitical_threads' },
  larrys_lens:         { label: "Larry's Lens",            el: 'panel-larrys_lens' },
  market_pulse:        { label: 'Market Pulse',            el: 'panel-market_pulse' },
  risk_watch:          { label: 'Risk Watch',              el: 'panel-risk_watch' },
  sector_spotlight:    { label: 'Sector Spotlight',        el: 'panel-sector_spotlight' },
  what_to_watch:       { label: 'What to Watch',           el: 'panel-what_to_watch' },
};

function renderPanel(panel) {
  const meta = PANEL_META[panel.panel_id];
  if (!meta) return;
  const el = document.getElementById(meta.el);
  if (!el) return;

  el.classList.remove('hidden');

  const chips = panel.data_points
    ? JSON.parse(panel.data_points).map(d => `<span class="chip">${d}</span>`).join('')
    : '';
  const conf = panel.confidence != null ? `${Math.round(panel.confidence * 100)}% confidence` : '';
  const changed = panel.last_changed ? `<div class="narr-changed">${panel.last_changed}</div>` : '';

  el.innerHTML = `
    <div class="narr-label">${meta.label}</div>
    <div class="narr-body">${panel.body}</div>
    ${chips ? `<div class="narr-chips">${chips}</div>` : ''}
    ${changed}
    ${conf ? `<div class="narr-conf">${conf}</div>` : ''}
  `;
}

// ── Render: causation chain ───────────────────────────────────
function renderChain(chain) {
  const el = document.getElementById('causation-chain');
  if (!el) return;

  if (!chain || !chain.steps?.length) {
    el.innerHTML = `<div class="chain-label">Causation Chain</div><div class="chain-empty">No chain data yet — run a cycle.</div>`;
    return;
  }

  const steps = chain.steps.map(s => `<div class="chain-step">${s}</div>`).join('');
  el.innerHTML = `
    <div class="chain-label">Causation Chain</div>
    <div class="chain-trigger">${chain.trigger}</div>
    <div class="chain-steps">${steps}</div>
    <div class="chain-outcome">${chain.outcome}</div>
    <div class="chain-conf">Direction: ${chain.confidence}</div>
  `;
}

// ── Render: markets ───────────────────────────────────────────
const MARKET_ORDER = ['^GSPC','^DJI','^IXIC','^RUT','^TNX','^VIX','GC=F','CL=F'];
const MARKET_SHORT = {
  '^GSPC':'S&P 500', '^DJI':'Dow', '^IXIC':'NASDAQ',
  '^RUT':'Russell', '^TNX':'10-Yr', '^VIX':'VIX',
  'GC=F':'Gold', 'CL=F':'WTI Oil'
};

function renderMarkets(market) {
  const grid = document.getElementById('markets-grid');
  if (!grid) return;
  const bySymbol = {};
  for (const m of market) bySymbol[m.symbol] = m;

  const order = MARKET_ORDER.filter(s => bySymbol[s]);
  if (!order.length) { grid.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">No market data yet.</div>'; return; }

  grid.innerHTML = order.map(sym => {
    const m = bySymbol[sym];
    const chg = m.change_pct;
    const cls = chg == null ? 'flat' : chg > 0 ? 'up' : 'down';
    const arrow = chg == null ? '' : chg > 0 ? '▲ ' : '▼ ';
    return `
      <div class="market-card">
        <div class="market-name">${MARKET_SHORT[sym] || m.name}</div>
        <div class="market-val ${cls}">${fmt(m.value, sym === '^VIX' || sym === '^TNX' ? 2 : 0)}</div>
        <div class="market-chg ${cls}">${chg != null ? arrow + Math.abs(chg).toFixed(2) + '%' : '—'}</div>
      </div>
    `;
  }).join('');
}

// ── Render: indicators ────────────────────────────────────────
const IND_ORDER = ['DGS2','DGS10','DGS30','FEDFUNDS','T10YIE','CPIAUCSL','UNRATE','DCOILWTICO','VIXCLS','GDP'];
const IND_META = {
  DGS2:       { name: '2-Yr Treasury',        dec: 2 },
  DGS10:      { name: '10-Yr Treasury',       dec: 2 },
  DGS30:      { name: '30-Yr Treasury',       dec: 2 },
  FEDFUNDS:   { name: 'Fed Funds Rate',       dec: 2 },
  T10YIE:     { name: '10-Yr Breakeven Infl',dec: 2 },
  CPIAUCSL:   { name: 'CPI Index',            dec: 1 },
  UNRATE:     { name: 'Unemployment',         dec: 1 },
  DCOILWTICO: { name: 'WTI Crude',            dec: 2 },
  VIXCLS:     { name: 'VIX (Fear Index)',     dec: 2 },
  GDP:        { name: 'Real GDP',             dec: 0 },
};

function renderIndicators(indicators, history) {
  const grid = document.getElementById('indicators-grid');
  if (!grid) return;
  const byId = {};
  for (const ind of indicators) byId[ind.series_id] = ind;

  const order = IND_ORDER.filter(id => byId[id]);
  if (!order.length) { grid.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">No indicator data yet.</div>'; return; }

  grid.innerHTML = order.map(id => {
    const ind = byId[id];
    const meta = IND_META[id] || { name: id, dec: 2 };
    const suffix = unitSuffix(ind.unit);
    const hist = history?.[id] || [];
    const canvasId = `chart-${id}`;

    // calculate delta vs. 12 observations ago
    let delta = '';
    if (hist.length >= 2) {
      const prev = hist[Math.max(0, hist.length - 13)]?.value;
      if (prev != null) {
        const diff = ind.value - prev;
        const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
        delta = `<div class="ind-delta ${cls}">${arrow} ${Math.abs(diff).toFixed(2)}${suffix} vs 12mo ago</div>`;
      }
    }

    return `
      <div class="ind-card">
        <div class="ind-name">${meta.name}</div>
        <div class="ind-value">${fmt(ind.value, meta.dec)}<span class="ind-unit">${suffix}</span></div>
        <div class="ind-date">${ind.observation_date}</div>
        ${hist.length > 1 ? `<div class="ind-chart"><canvas id="${canvasId}"></canvas></div>` : ''}
        ${delta}
      </div>
    `;
  }).join('');

  // render charts after DOM is painted
  requestAnimationFrame(() => {
    for (const id of order) {
      const hist = history?.[id] || [];
      if (hist.length > 1) renderSparkline(`chart-${id}`, hist, id);
    }
  });
}

// ── Render: news ──────────────────────────────────────────────
function renderNews(news) {
  const el = document.getElementById('news-list');
  if (!el) return;
  if (!news?.length) {
    el.innerHTML = '<div style="padding:14px;color:var(--muted);font-size:12px">No news loaded yet.</div>';
    return;
  }
  el.innerHTML = news.slice(0, 15).map(n => `
    <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
      <div class="news-src">${n.source}</div>
      <div class="news-title">${n.title}</div>
      <div class="news-age">${relativeTime(n.published_at)}</div>
    </a>
  `).join('');
}

// ── Load ──────────────────────────────────────────────────────
async function load() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const upd = document.getElementById('last-updated');
    if (d.lastCycle?.completed_at) {
      upd.textContent = `Updated ${relativeTime(d.lastCycle.completed_at)} — ${d.lastCycle.status}`;
    } else {
      upd.textContent = 'No cycle run yet';
    }

    renderAlerts(d.alerts || []);

    for (const panel of d.panels || []) renderPanel(panel);

    // parse causation chain from panels if present
    const chainPanel = (d.panels || []).find(p => p.panel_id === 'causation_chain');
    if (chainPanel?.data_points) {
      try { renderChain(JSON.parse(chainPanel.data_points)); } catch { renderChain(null); }
    } else if (d.causation_chain) {
      renderChain(d.causation_chain);
    } else {
      renderChain(null);
    }

    renderMarkets(d.market || []);
    renderIndicators(d.indicators || [], d.history || {});
    renderNews(d.news || []);
  } catch (err) {
    console.error('Dashboard load error:', err);
    const upd = document.getElementById('last-updated');
    if (upd) upd.textContent = 'Error loading data — retrying...';
  }
}

load();
setInterval(load, REFRESH_MS);
