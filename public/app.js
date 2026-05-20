// ── Tab routing ───────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Clock ─────────────────────────────────────────────────────
function tickClock() {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(tickClock, 1000);
tickClock();

// ── Helpers ───────────────────────────────────────────────────
function relativeTime(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function fmt(v, d = 2) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function unitSfx(unit) {
  if (!unit) return '';
  if (unit === 'percent') return '%';
  if (unit === 'usd_per_barrel') return ' $/bbl';
  if (unit === 'billions') return 'B';
  return '';
}

// ── Markdown render (safe subset) ────────────────────────────
function md(text) {
  if (!text || typeof marked === 'undefined') return text || '';
  return marked.parse(text, { breaks: true });
}

// ── Build bullet panel HTML ───────────────────────────────────
function bulletPanel(panel, expandId) {
  let bullets = [];
  try { bullets = JSON.parse(panel.bullets || '[]'); } catch {}

  const bulletsHtml = bullets.length
    ? `<ul class="bullet-list">${bullets.map(b =>
        `<li>${md(b).replace(/<\/?p>/g,'')}</li>`
      ).join('')}</ul>`
    : '';

  const hasBody = panel.body && panel.body.trim().length > 20;
  const expandBtn = hasBody
    ? `<button class="expand-toggle" onclick="toggleExpand('${expandId}', this)">Read full analysis ↓</button>
       <div class="expand-body" id="${expandId}">${md(panel.body)}</div>`
    : '';

  let chips = [];
  try { chips = JSON.parse(panel.data_points || '[]'); } catch {}
  const chipsHtml = chips.length
    ? `<div class="data-chips">${chips.map(c => `<span class="chip">${c}</span>`).join('')}</div>`
    : '';

  const conf = panel.confidence != null
    ? `<div class="panel-conf">${Math.round(panel.confidence * 100)}% confidence</div>`
    : '';

  return bulletsHtml + expandBtn + chipsHtml + conf;
}

function toggleExpand(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  btn.textContent = el.classList.contains('open') ? 'Close ↑' : 'Read full analysis ↓';
}

// ── Render panels ─────────────────────────────────────────────
const PANEL_MAP = {
  macro_overview:       'panel-macro_overview',
  risk_watch:           'panel-risk_watch',
  what_to_watch:        'panel-what_to_watch',
  market_pulse:         'panel-market_pulse',
  geopolitical_threads: null, // handled by stepper
  sector_spotlight:     'panel-sector_spotlight',
  larrys_lens:          'panel-larrys_lens',
};

let geoPanels = [];
let geoIndex  = 0;

function renderPanels(panels) {
  geoPanels = panels.filter(p => p.panel_id === 'geopolitical_threads');
  geoIndex = 0;

  for (const panel of panels) {
    const elId = PANEL_MAP[panel.panel_id];
    if (!elId) continue;
    const el = document.getElementById(elId);
    if (!el) continue;
    const inner = bulletPanel(panel, `expand-${panel.panel_id}`);
    // preserve the card-label div
    const label = el.querySelector('.card-label');
    el.innerHTML = '';
    if (label) el.appendChild(label);
    el.insertAdjacentHTML('beforeend', inner);
  }

  renderGeoStepper();
}

// ── Geopolitics stepper ───────────────────────────────────────
function renderGeoStepper() {
  const card = document.getElementById('geo-stepper');
  const controls = document.getElementById('geo-controls');
  if (!card) return;

  if (!geoPanels.length) {
    card.innerHTML = '<div class="skeleton">No geopolitical analysis yet — run a cycle.</div>';
    if (controls) controls.innerHTML = '';
    return;
  }

  const panel = geoPanels[geoIndex];
  card.innerHTML = `
    <div class="card-label amber" style="margin-bottom:16px">Geopolitical Threads — ${geoIndex + 1} of ${geoPanels.length}</div>
    ${bulletPanel(panel, `expand-geo-${geoIndex}`)}
  `;

  if (controls) {
    const dots = geoPanels.map((_, i) =>
      `<span class="s-dot ${i === geoIndex ? 'active' : ''}" onclick="goGeo(${i})"></span>`
    ).join('');
    controls.innerHTML = `
      <button class="stepper-btn" onclick="goGeo(${geoIndex - 1})" ${geoIndex === 0 ? 'disabled' : ''}>← Prev</button>
      <div class="stepper-dots">${dots}</div>
      <button class="stepper-btn" onclick="goGeo(${geoIndex + 1})" ${geoIndex >= geoPanels.length - 1 ? 'disabled' : ''}>Next →</button>
    `;
  }
}

function goGeo(i) {
  if (i < 0 || i >= geoPanels.length) return;
  geoIndex = i;
  renderGeoStepper();
}

// ── Causation chain ───────────────────────────────────────────
function renderChain(panels) {
  const chainPanel = panels.find(p => p.panel_id === 'causation_chain');
  const el = document.getElementById('chain-content');
  if (!el) return;

  if (!chainPanel?.data_points) {
    el.innerHTML = '<div class="skeleton">No chain data yet.</div>';
    return;
  }

  let chain;
  try { chain = JSON.parse(chainPanel.data_points); } catch {
    el.innerHTML = '<div class="skeleton">Could not parse chain.</div>';
    return;
  }

  const steps = (chain.steps || []).map(s =>
    `<div class="chain-step"><span class="chain-arrow">→</span><span>${s}</span></div>`
  ).join('');

  el.innerHTML = `
    <div class="chain-trigger">${chain.trigger || ''}</div>
    <div class="chain-steps">${steps}</div>
    <div class="chain-outcome">${chain.outcome || ''}</div>
    <div class="chain-conf-line">Direction: ${chain.confidence || '—'}</div>
  `;
}

// ── Curated news ──────────────────────────────────────────────
function renderCuratedNews(items) {
  const el = document.getElementById('curated-news-list');
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = '<div class="skeleton">No curated news yet.</div>';
    return;
  }
  el.innerHTML = items.map(n => `
    <div class="curated-item">
      <a class="curated-headline" href="${n.url || '#'}" target="_blank" rel="noopener">
        <span class="curated-src">${n.source || '?'}</span>
        <span>${n.headline}</span>
      </a>
      ${n.why_it_matters ? `<div class="curated-why">${n.why_it_matters}</div>` : ''}
    </div>
  `).join('');
}

// ── Alert bar ─────────────────────────────────────────────────
function renderAlerts(alerts) {
  const bar = document.getElementById('sidebar-alert');
  if (!bar) return;
  const active = (alerts || []).filter(a => !a.resolved_at);
  if (!active.length) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.innerHTML = `⚠ ${active[0].headline}`;
}

// ── Markets ───────────────────────────────────────────────────
const MARKET_ORDER = ['^GSPC','^DJI','^IXIC','^RUT','^TNX','^VIX','GC=F','CL=F'];
const MARKET_NAMES = {
  '^GSPC':'S&P 500','^DJI':'Dow Jones','^IXIC':'NASDAQ','^RUT':'Russell 2000',
  '^TNX':'10-Yr Yield','GC=F':'Gold','CL=F':'WTI Crude','^VIX':'VIX'
};

function renderMarkets(market) {
  const grid = document.getElementById('markets-grid');
  if (!grid) return;
  const bySymbol = Object.fromEntries(market.map(m => [m.symbol, m]));
  const order = MARKET_ORDER.filter(s => bySymbol[s]);
  if (!order.length) { grid.innerHTML = '<div class="skeleton">No market data.</div>'; return; }

  grid.innerHTML = order.map(sym => {
    const m = bySymbol[sym];
    const chg = m.change_pct;
    const cls = chg == null ? 'flat' : chg > 0 ? 'up' : 'down';
    const arrow = chg == null ? '' : chg > 0 ? '▲ ' : '▼ ';
    const isIndex = ['^GSPC','^DJI','^IXIC','^RUT'].includes(sym);
    return `
      <div class="market-card">
        <div class="market-name">${MARKET_NAMES[sym] || m.name}</div>
        <div class="market-val ${cls}">${fmt(m.value, isIndex ? 0 : 2)}</div>
        <div class="market-chg ${cls}">${chg != null ? arrow + Math.abs(chg).toFixed(2) + '%' : '—'}</div>
      </div>`;
  }).join('');
}

// ── Crosshair plugin for Chart.js ─────────────────────────────
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    if (!chart.tooltip._active?.length) return;
    const ctx = chart.ctx;
    const x = chart.tooltip._active[0].element.x;
    const { top, bottom } = chart.chartArea;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(100,116,139,0.45)';
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.restore();
  }
};
Chart.register(crosshairPlugin);

// ── Indicators with charts ────────────────────────────────────
const IND_ORDER = ['DGS2','DGS10','DGS30','FEDFUNDS','T10YIE','CPIAUCSL','UNRATE','DCOILWTICO','VIXCLS','GDP'];
const IND_META = {
  DGS2:       { name: '2-Yr Treasury',           dec: 2, color: '#2563eb' },
  DGS10:      { name: '10-Yr Treasury',          dec: 2, color: '#7c3aed' },
  DGS30:      { name: '30-Yr Treasury',          dec: 2, color: '#db2777' },
  FEDFUNDS:   { name: 'Fed Funds Rate',          dec: 2, color: '#dc2626' },
  T10YIE:     { name: '10-Yr Breakeven Infl.',   dec: 2, color: '#d97706' },
  CPIAUCSL:   { name: 'CPI Index',               dec: 1, color: '#d97706' },
  UNRATE:     { name: 'Unemployment Rate',       dec: 1, color: '#16a34a' },
  DCOILWTICO: { name: 'WTI Crude Oil',           dec: 2, color: '#92400e' },
  VIXCLS:     { name: 'VIX — Fear Index',        dec: 2, color: '#64748b' },
  GDP:        { name: 'Real GDP',                dec: 0, color: '#0891b2' },
};

const chartInstances = {};

function renderSparkline(canvasId, history, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !history?.length) return;
  if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); }

  const ctx = canvas.getContext('2d');
  const values = history.map(h => h.value);
  const labels = history.map(h => h.observation_date);

  const grad = ctx.createLinearGradient(0, 0, 0, 72);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, color + '00');

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ data: values, borderColor: color, borderWidth: 2,
        backgroundColor: grad, pointRadius: 0, tension: 0.35, fill: true }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8',
          bodyColor: '#f1f5f9', padding: 10, borderWidth: 0,
          callbacks: { label: ctx => `${fmt(ctx.parsed.y)} (${labels[ctx.dataIndex]})` }
        }
      },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}

function renderIndicators(indicators, history) {
  const grid = document.getElementById('indicators-grid');
  if (!grid) return;
  const byId = Object.fromEntries(indicators.map(i => [i.series_id, i]));
  const order = IND_ORDER.filter(id => byId[id]);
  if (!order.length) { grid.innerHTML = '<div class="skeleton">No indicator data.</div>'; return; }

  grid.innerHTML = order.map(id => {
    const ind = byId[id];
    const meta = IND_META[id] || { name: id, dec: 2 };
    const suffix = unitSfx(ind.unit);
    const hist = history?.[id] || [];
    const canvasId = `chart-${id}`;

    let delta = '';
    if (hist.length >= 2) {
      const prev = hist[Math.max(0, hist.length - 13)]?.value;
      if (prev != null) {
        const diff = ind.value - prev;
        const cls = diff > 0.001 ? 'up' : diff < -0.001 ? 'down' : 'flat';
        const arrow = diff > 0.001 ? '▲' : diff < -0.001 ? '▼' : '—';
        delta = `<div class="ind-delta ${cls}">${arrow} ${Math.abs(diff).toFixed(2)}${suffix} vs 12mo ago</div>`;
      }
    }

    return `
      <div class="ind-card">
        <div class="ind-name">${meta.name}</div>
        <div class="ind-row">
          <div class="ind-value">${fmt(ind.value, meta.dec)}</div>
          <div class="ind-unit">${suffix}</div>
        </div>
        <div class="ind-date">${ind.observation_date}</div>
        ${hist.length > 1 ? `<div class="ind-chart"><canvas id="${canvasId}"></canvas></div>` : ''}
        ${delta}
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    for (const id of order) {
      const hist = history?.[id] || [];
      if (hist.length > 1) renderSparkline(`chart-${id}`, hist, IND_META[id]?.color || '#64748b');
    }
  });
}

// ── Main load ─────────────────────────────────────────────────
async function load() {
  try {
    const res = await fetch('/api/dashboard');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const upd = document.getElementById('last-updated');
    if (upd) {
      upd.textContent = d.lastCycle?.completed_at
        ? `Updated ${relativeTime(d.lastCycle.completed_at)}`
        : 'No cycle run yet';
    }

    renderAlerts(d.alerts || []);
    renderPanels(d.panels || []);
    renderChain(d.panels || []);
    renderCuratedNews(d.curated_news || []);
    renderMarkets(d.market || []);
    renderIndicators(d.indicators || [], d.history || {});

  } catch (err) {
    console.error('Load error:', err);
    const upd = document.getElementById('last-updated');
    if (upd) upd.textContent = 'Error loading — retrying...';
  }
}

load();
setInterval(load, 5 * 60 * 1000);
