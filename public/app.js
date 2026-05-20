// ── Tab routing ───────────────────────────────────────────────
let energyChartsReady = false;
let explorerReady = false;

function switchTab(tabId) {
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');

  if (tabId === 'energy' && !energyChartsReady) {
    energyChartsReady = true;
    requestAnimationFrame(initEnergyCharts);
  }
  if (tabId === 'macro-tools') {
    if (!explorerReady) { explorerReady = true; expSelectGauge('rate'); }
    expUpdateSim();
  }
  window.scrollTo(0, 0);
}

document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
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
    ? `<button class="expand-toggle" onclick="toggleExpand('${expandId}', this)">Full analysis ↓</button>
       <div class="expand-body" id="${expandId}">${md(panel.body)}</div>`
    : '';

  return bulletsHtml + expandBtn;
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
    const label = el.querySelector('.card-label');
    el.innerHTML = '';
    if (label) el.appendChild(label);
    el.insertAdjacentHTML('beforeend', inner);
  }

  renderGeoStepper();
}

// ── Geopolitics grid ──────────────────────────────────────────
function renderGeoStepper() {
  const container = document.getElementById('geo-grid');
  if (!container) return;

  if (!geoPanels.length) {
    container.innerHTML = '<div class="skeleton">No geopolitical analysis yet — run a cycle.</div>';
    return;
  }

  container.innerHTML = geoPanels.map((panel, i) => `
    <div class="card geo-card">
      <div class="card-label amber" style="margin-bottom:14px">Geopolitical Thread ${geoPanels.length > 1 ? i + 1 : ''}</div>
      ${bulletPanel(panel, `expand-geo-${i}`)}
    </div>
  `).join('');
}

// ── Causation chain ───────────────────────────────────────────
function renderChain(panels) {
  const chainPanel = panels.find(p => p.panel_id === 'causation_chain');
  const el = document.getElementById('chain-content');
  if (!el) return;

  if (!chainPanel) {
    el.innerHTML = '<div class="skeleton">No chain data yet — run a cycle.</div>';
    return;
  }

  // data_points holds the JSON chain; body holds the fallback text
  let chain = null;
  if (chainPanel.data_points) {
    try { chain = JSON.parse(chainPanel.data_points); } catch {}
  }

  if (!chain || !chain.trigger) {
    const bodyText = chainPanel.body || '';
    if (bodyText.trim().length > 10) {
      el.innerHTML = `<div class="chain-fallback">${md(bodyText)}</div>`;
    } else {
      el.innerHTML = '<div class="skeleton">Chain data unavailable.</div>';
    }
    return;
  }

  const steps = (chain.steps || []).map((s, i) =>
    `<div class="chain-step"><span class="chain-arrow">${i + 1}</span><span>${s}</span></div>`
  ).join('');

  el.innerHTML = `
    <div class="chain-section-label">Root Cause</div>
    <div class="chain-trigger">${chain.trigger}</div>
    <div class="chain-section-label" style="margin-top:14px">Cascade</div>
    <div class="chain-steps">${steps}</div>
    <div class="chain-section-label" style="margin-top:14px">Likely Outcome</div>
    <div class="chain-outcome">${chain.outcome || ''}</div>
    ${chain.confidence ? `<div class="chain-conf-line">Direction: <strong>${chain.confidence}</strong></div>` : ''}
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

// ── Voices ────────────────────────────────────────────────────
function renderVoices(voices) {
  const el = document.getElementById('voices-list');
  if (!el) return;
  if (!voices?.length) {
    el.innerHTML = '<div class="skeleton">Run a cycle to load voices.</div>';
    return;
  }
  el.innerHTML = voices.map(v => `
    <div class="voice-card">
      <div class="voice-header">
        <div>
          <div class="voice-name">${v.name}</div>
          <div class="voice-title">${v.title}</div>
        </div>
        ${v.url ? `<a class="voice-src-link" href="${v.url}" target="_blank" rel="noopener">Source ↗</a>` : ''}
      </div>
      ${v.current_view ? `<div class="voice-view">${v.current_view}</div>` : ''}
      ${v.plain_english ? `<div class="voice-plain"><span class="voice-plain-label">What this means for you:</span> ${v.plain_english}</div>` : ''}
      <div class="voice-why">${v.why}</div>
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

// ── Educational context for indicator drawer ──────────────────
const IND_CONTEXT = {
  DGS2: {
    what: 'The 2-Year Treasury yield reflects market expectations for Fed rate policy over the next ~2 years. It is the most policy-sensitive bond — when the Fed raises or cuts rates, this moves first and fastest.',
    rising: 'Markets expect the Fed to raise rates or hold them high longer. Borrowing costs rise across the economy. Often signals persistent inflation concerns.',
    falling: 'Markets expect rate cuts ahead. Usually means economic slowdown fears or inflation coming under control.',
    release: 'Daily — published each business day by the Treasury Department.',
    watchLevel: 'Compare it to the 10-yr yield. When 2yr > 10yr (an "inverted yield curve"), recession risk historically rises within 12–18 months.',
    relatedTo: ['DGS10', 'FEDFUNDS']
  },
  DGS10: {
    what: 'The 10-Year Treasury yield is the benchmark for the entire US economy. It sets 30-year mortgage rates, corporate borrowing costs, and serves as the baseline for global financial risk. Every pension fund, insurer, and bond portfolio watches this number.',
    rising: 'Mortgage rates rise. Stock valuations compress (future earnings worth less in today\'s dollars). Dollar typically strengthens. Signals market expectations of stronger growth or persistent inflation.',
    falling: 'Mortgage rates drop, often triggering a refinancing boom. Growth stocks rally as future earnings become more valuable. May signal growth fears or a flight to safety.',
    release: 'Daily — real-time market rate published each business day.',
    watchLevel: '4.5%+ puts meaningful pressure on housing and corporate debt. Below 3% often indicates recession fears or deflationary pressure.',
    relatedTo: ['DGS2', 'DGS30', 'T10YIE', 'FEDFUNDS']
  },
  DGS30: {
    what: 'The 30-Year Treasury yield directly drives 30-year fixed mortgage rates. At 5%, a $500k mortgage costs roughly $2,685/month in principal and interest — that\'s how housing affordability gets made or broken. It also matters enormously for pension funds that hold long-duration bonds.',
    rising: 'Housing becomes less affordable. Monthly mortgage payments increase substantially. Long-term corporate borrowing costs rise. Pension funds and insurers holding long bonds lose value on paper.',
    falling: 'Housing affordability improves. Refinancing boom possible. Stimulus for real estate and rate-sensitive industries.',
    release: 'Daily — Treasury market rate.',
    watchLevel: '5%+ is historically restrictive for housing. Above 5.5% often triggers notable housing market slowdowns. Watch the spread to the Fed Funds Rate as a measure of long-term risk premium.',
    relatedTo: ['DGS10', 'FEDFUNDS', 'CPIAUCSL']
  },
  FEDFUNDS: {
    what: 'The Federal Funds Rate is the interest rate at which banks lend reserves to each other overnight. It is the Fed\'s primary policy lever. Every rate decision by the FOMC ripples through mortgages, auto loans, credit cards, corporate bonds, and the valuation of every financial asset.',
    rising: 'Borrowing becomes more expensive everywhere. Deployed to fight inflation. Intentionally slows the economy. Painful for anyone carrying variable-rate debt.',
    falling: 'Stimulus mode. Encourages borrowing, hiring, and investment. Used during recessions, crises, or periods of below-target inflation.',
    release: 'FOMC meets 8 times per year — roughly every 6–7 weeks. Dates are published a year in advance. Each meeting is a major market event.',
    watchLevel: 'The "neutral rate" is estimated around 2.5%. Anything significantly above that is restrictive. At 4%+, the Fed is actively pressing the brake pedal on the economy.',
    relatedTo: ['DGS2', 'DGS10', 'CPIAUCSL', 'UNRATE']
  },
  T10YIE: {
    what: 'The 10-Year Breakeven Inflation Rate is the bond market\'s forecast for average annual inflation over the next decade. It is calculated as the difference between the nominal 10-year Treasury yield and the 10-year TIPS (inflation-protected) yield. This is what professional money managers believe inflation will average.',
    rising: 'Markets see more inflation ahead. The Fed faces pressure to keep rates higher for longer or to hike. Bond prices fall.',
    falling: 'Markets see inflation coming down toward or below the Fed\'s 2% target. Gives the Fed room to cut rates. Good for bonds and rate-sensitive sectors.',
    release: 'Daily — calculated from Treasury and TIPS market prices.',
    watchLevel: 'The Fed\'s target is 2%. At 2.3–2.5%, markets are modestly above target. A sustained move above 3% would be alarming and force Fed action.',
    relatedTo: ['DGS10', 'FEDFUNDS', 'CPIAUCSL', 'DCOILWTICO']
  },
  CPIAUCSL: {
    what: 'The Consumer Price Index (All Urban Consumers) measures the average change in prices paid by US consumers for a representative basket of goods and services. This is the headline inflation number reported in the news each month. Social Security cost-of-living adjustments are tied directly to this index.',
    rising: 'Your purchasing power erodes. The Fed feels pressure to raise rates or stay restrictive. Fixed-income investments (bonds) lose real value. Retirees on fixed incomes are most exposed.',
    falling: 'Disinflation or deflation. Excellent for bonds and cash. May signal economic weakness if the decline is sharp.',
    release: 'Monthly — published by the Bureau of Labor Statistics approximately 2 weeks after month-end. One of the most market-moving scheduled releases of any month.',
    watchLevel: 'The index value shown is the price level (not the % change). The year-over-year % change is what matters — 2% is the Fed\'s target. Above 3% keeps the Fed cautious; below 2% gives room to cut.',
    relatedTo: ['FEDFUNDS', 'T10YIE', 'DGS10', 'UNRATE']
  },
  UNRATE: {
    what: 'The Unemployment Rate is the percentage of the labor force actively seeking work but unable to find it. It is a lagging indicator — by the time it rises significantly, the economy has usually already been deteriorating for months. It is also a key input in the Fed\'s dual mandate (price stability + maximum employment).',
    rising: 'People are losing jobs. Consumer spending falls. Corporate revenues and profits decline. The Fed will likely begin considering rate cuts to stimulate hiring.',
    falling: 'The labor market is tight. Workers gain bargaining power. Wage growth can fuel inflation — a dynamic the Fed watches closely. May also mean the economy is absorbing workers faster than expected.',
    release: 'Monthly — the Bureau of Labor Statistics "Jobs Report" is released the first Friday of each month. It is one of the most anticipated data releases on the economic calendar.',
    watchLevel: 'Full employment is generally considered around 4%. Below 3.5% is historically very tight. Above 5% signals meaningful weakness. A rapid rise from a low base is often a recession signal.',
    relatedTo: ['FEDFUNDS', 'CPIAUCSL', 'GDP']
  },
  DCOILWTICO: {
    what: 'West Texas Intermediate (WTI) is the US benchmark crude oil price, quoted in dollars per barrel. Oil is an input cost for nearly everything — transportation, plastics, agriculture, manufacturing, and electricity. It is also a geopolitical thermometer: the Strait of Hormuz, Middle East tension, Russia-Ukraine, OPEC+ decisions, and China demand all show up here.',
    rising: 'Gas prices rise at the pump within days. Freight, airline, and manufacturing costs increase. Inflation picks up. Energy company stocks rally. Often signals geopolitical tension or supply disruption.',
    falling: 'Consumer relief — gas becomes cheaper. Overall inflation moderates. Energy sector profits decline. May signal weak global demand, a recession forecast, or OPEC+ oversupply.',
    release: 'Daily — commodities futures markets. EIA Weekly Petroleum Status Report (every Wednesday) is the key near-term data point.',
    watchLevel: 'Below $60 is historically deflationary for energy. $70–$90 is the "comfortable" range for producers and consumers. Above $90 starts causing economic pain. Above $120 has historically triggered or deepened recessions.',
    relatedTo: ['CPIAUCSL', 'T10YIE', 'VIXCLS']
  },
  VIXCLS: {
    what: 'The VIX (CBOE Volatility Index) measures the stock market\'s expectation of S&P 500 volatility over the next 30 days, derived from options prices. Traders call it the "Fear Index." A high VIX means investors are paying a premium to protect their portfolios. A low VIX means complacency — which can itself be a warning sign.',
    rising: 'Markets are nervous. Investors are buying protective options. Often coincides with sell-offs, geopolitical shocks, Fed uncertainty, or systemic financial stress.',
    falling: 'Markets are calm and confident. Low VIX reduces hedging costs. Can be a contrarian warning — prolonged complacency historically precedes volatility spikes.',
    release: 'Real-time during market hours — calculated continuously from S&P 500 options.',
    watchLevel: 'Below 15: very calm. 15–20: normal. 20–30: elevated anxiety. Above 30: significant fear. Above 40: crisis territory. For reference: COVID-19 peak was 82, 2008 financial crisis was 80, 2020 market crash was 65.',
    relatedTo: ['^GSPC', 'DGS10', 'DCOILWTICO']
  },
  GDP: {
    what: 'Real GDP (Gross Domestic Product) measures the total inflation-adjusted economic output of the United States — the sum of everything produced: goods, services, investment, government spending. Two consecutive quarters of negative GDP growth is the classic definition of a recession. It is the single broadest measure of economic health.',
    rising: 'The economy is expanding. Companies are investing, consumers are spending, jobs are being created. Generally positive for equities. May fuel inflation if growth is too rapid.',
    falling: 'The economy is contracting or decelerating sharply. May precede or confirm a recession. Watch for Fed response — typically rate cuts and stimulus.',
    release: 'Quarterly — the Bureau of Economic Analysis releases an "advance" estimate approximately 30 days after quarter-end, then two revisions (30 and 90 days later). This is a heavily lagging indicator; by the time you see it, markets have usually moved.',
    watchLevel: '2–3% annual growth is considered healthy. Below 1% is "stall speed" — the economy is vulnerable. Negative = contraction. Above 4% can fuel inflation concerns.',
    relatedTo: ['UNRATE', 'FEDFUNDS', 'CPIAUCSL']
  }
};

// ── Indicator drawer ──────────────────────────────────────────
function openDrawer(seriesId) {
  const ctx = IND_CONTEXT[seriesId];
  const meta = IND_META[seriesId];
  if (!ctx || !meta) return;

  document.getElementById('drawer-title').textContent = meta.name;
  document.getElementById('drawer-series').textContent = seriesId;

  const related = (ctx.relatedTo || []).map(id => {
    const m = IND_META[id];
    if (!m) return `<span class="chip">${id}</span>`;
    return `<span class="chip clickable" onclick="openDrawer('${id}')">${m.name}</span>`;
  }).join('');

  document.getElementById('drawer-body').innerHTML = `
    <div>
      <div class="drawer-section-title">What it is</div>
      <div class="drawer-section-body">${ctx.what}</div>
    </div>

    <div>
      <div class="drawer-section-title">Market impact</div>
      <div class="drawer-impact-row">
        <div class="impact-box up-box">
          <div class="impact-label up">Rising</div>
          <div class="impact-text">${ctx.rising}</div>
        </div>
        <div class="impact-box down-box">
          <div class="impact-label down">Falling</div>
          <div class="impact-text">${ctx.falling}</div>
        </div>
      </div>
    </div>

    <div>
      <div class="drawer-section-title">Release schedule</div>
      <div class="release-row">
        <span class="release-icon">📅</span>
        <span class="drawer-section-body">${ctx.release}</span>
      </div>
    </div>

    <div>
      <div class="drawer-section-title">Key levels to watch</div>
      <div class="drawer-section-body">${ctx.watchLevel}</div>
    </div>

    ${related ? `<div>
      <div class="drawer-section-title">Related indicators</div>
      <div class="data-chips" style="margin-top:8px">${related}</div>
    </div>` : ''}
  `;

  document.getElementById('ind-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');

  // highlight the card
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('selected'));
  const card = document.querySelector(`.ind-card[data-series="${seriesId}"]`);
  if (card) card.classList.add('selected');
}

function closeDrawer() {
  document.getElementById('ind-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('selected'));
}

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
    const hasContext = !!IND_CONTEXT[id];

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
      <div class="ind-card${hasContext ? ' clickable' : ''}" data-series="${id}"${hasContext ? ` onclick="openDrawer('${id}')"` : ''}>
        <div class="ind-name">${meta.name}</div>
        ${hasContext ? '<div class="ind-click-hint">↗ click for details &amp; context</div>' : ''}
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

    const updText = d.lastCycle?.completed_at
      ? `Updated ${relativeTime(d.lastCycle.completed_at)}`
      : 'No cycle run yet';
    const upd = document.getElementById('last-updated');
    if (upd) upd.textContent = updText;
    const mUpd = document.getElementById('mobile-updated');
    if (mUpd) mUpd.textContent = updText;

    renderAlerts(d.alerts || []);
    renderPanels(d.panels || []);
    renderChain(d.panels || []);
    renderVoices(d.voices || []);
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

// ═══════════════════════════════════════════════════════════════
// COMPOSITE INDICATORS — NFCI + NY Fed Recession Probability
// ═══════════════════════════════════════════════════════════════

function normCDF(x) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign=x<0?-1:1, ax=Math.abs(x), t=1/(1+p*ax);
  return 0.5*(1+sign*(1-((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax)));
}
function calcRecProb(spread) { return normCDF(-0.6045-0.7374*spread)*100; }

// Real NFCI data (weekly, last 53 readings)
const NFCI_DATA = [
  {date:'2025-05-09',value:-0.423},{date:'2025-05-16',value:-0.440},{date:'2025-05-23',value:-0.455},
  {date:'2025-05-30',value:-0.467},{date:'2025-06-06',value:-0.476},{date:'2025-06-13',value:-0.484},
  {date:'2025-06-20',value:-0.490},{date:'2025-06-27',value:-0.497},{date:'2025-07-04',value:-0.504},
  {date:'2025-07-11',value:-0.510},{date:'2025-07-18',value:-0.515},{date:'2025-07-25',value:-0.519},
  {date:'2025-08-01',value:-0.522},{date:'2025-08-08',value:-0.524},{date:'2025-08-15',value:-0.526},
  {date:'2025-08-22',value:-0.527},{date:'2025-08-29',value:-0.528},{date:'2025-09-05',value:-0.528},
  {date:'2025-09-12',value:-0.528},{date:'2025-09-19',value:-0.527},{date:'2025-09-26',value:-0.526},
  {date:'2025-10-03',value:-0.525},{date:'2025-10-10',value:-0.523},{date:'2025-10-17',value:-0.519},
  {date:'2025-10-24',value:-0.516},{date:'2025-10-31',value:-0.513},{date:'2025-11-07',value:-0.509},
  {date:'2025-11-14',value:-0.507},{date:'2025-11-21',value:-0.507},{date:'2025-11-28',value:-0.508},
  {date:'2025-12-05',value:-0.511},{date:'2025-12-12',value:-0.516},{date:'2025-12-19',value:-0.524},
  {date:'2025-12-26',value:-0.535},{date:'2026-01-02',value:-0.546},{date:'2026-01-09',value:-0.556},
  {date:'2026-01-16',value:-0.562},{date:'2026-01-23',value:-0.563},{date:'2026-01-30',value:-0.559},
  {date:'2026-02-06',value:-0.551},{date:'2026-02-13',value:-0.538},{date:'2026-02-20',value:-0.522},
  {date:'2026-02-27',value:-0.503},{date:'2026-03-06',value:-0.484},{date:'2026-03-13',value:-0.467},
  {date:'2026-03-20',value:-0.456},{date:'2026-03-27',value:-0.451},{date:'2026-04-03',value:-0.454},
  {date:'2026-04-10',value:-0.464},{date:'2026-04-17',value:-0.478},{date:'2026-04-24',value:-0.494},
  {date:'2026-05-01',value:-0.509},{date:'2026-05-08',value:-0.524}
];

// Real T10Y3M spread data (10yr minus 3mo yield, in %)
const T10Y3M_DATA = [
  {date:'2026-04-01',value:0.63},{date:'2026-04-02',value:0.61},{date:'2026-04-03',value:0.64},
  {date:'2026-04-06',value:0.62},{date:'2026-04-07',value:0.62},{date:'2026-04-08',value:0.60},
  {date:'2026-04-09',value:0.61},{date:'2026-04-10',value:0.62},{date:'2026-04-13',value:0.59},
  {date:'2026-04-14',value:0.55},{date:'2026-04-15',value:0.58},{date:'2026-04-16',value:0.62},
  {date:'2026-04-17',value:0.56},{date:'2026-04-20',value:0.55},{date:'2026-04-21',value:0.61},
  {date:'2026-04-22',value:0.61},{date:'2026-04-23',value:0.65},{date:'2026-04-24',value:0.62},
  {date:'2026-04-27',value:0.67},{date:'2026-04-28',value:0.68},{date:'2026-04-29',value:0.74},
  {date:'2026-04-30',value:0.72},{date:'2026-05-01',value:0.71},{date:'2026-05-04',value:0.75},
  {date:'2026-05-05',value:0.74},{date:'2026-05-06',value:0.67},{date:'2026-05-07',value:0.72},
  {date:'2026-05-08',value:0.69},{date:'2026-05-11',value:0.72},{date:'2026-05-12',value:0.76},
  {date:'2026-05-13',value:0.77},{date:'2026-05-14',value:0.78},{date:'2026-05-15',value:0.90},
  {date:'2026-05-18',value:0.93}
];

function makeCompChart(canvasId, labels, values, color, refLine) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const datasets = [{
    data: values, borderColor: color, borderWidth: 1.8,
    pointRadius: 0, tension: 0.35, fill: true,
    backgroundColor: color.replace('rgb','rgba').replace(')',',0.08)').includes('rgba')
      ? color.replace(')',',0.08)').replace('rgb','rgba')
      : color + '14'
  }];
  if (refLine !== undefined) {
    datasets.push({ data: Array(values.length).fill(refLine), borderColor:'rgba(255,255,255,0.18)', borderWidth:1, borderDash:[4,4], pointRadius:0, fill:false });
  }
  new Chart(ctx, {
    type:'line', data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      scales:{ x:{display:false}, y:{display:false, grace:'8%'} }
    }
  });
}

function nfciColor(v) { return v<-0.5?'#4ade80':v<0?'#86efac':v<0.5?'#fbbf24':'#f87171'; }
function recpColor(v) { return v<15?'#4ade80':v<25?'#86efac':v<35?'#fbbf24':'#f87171'; }

function renderNFCI(data) {
  const v = data[data.length-1].value;
  const color = nfciColor(v);
  const [bt,bc] = v<-0.5?['Loose','badge-loose']:v<0?['Accommodative','badge-normal']:v<0.5?['Tightening','badge-watch']:['Tight','badge-tight'];
  document.getElementById('nfci-value').textContent = v.toFixed(3);
  document.getElementById('nfci-value').style.color = color;
  document.getElementById('nfci-signal').textContent = v<0?'▼ Below zero':'▲ Above zero';
  document.getElementById('nfci-signal').style.color = color;
  document.getElementById('nfci-badge').textContent = bt;
  document.getElementById('nfci-badge').className = 'comp-badge '+bc;
  document.getElementById('nfci-interp').textContent =
    v<-0.5 ? `NFCI at ${v.toFixed(3)} — very loose. Credit is cheap, volatility low, lending easy. Historically precedes stable or rising markets. Watch for complacency risk.`
    : v<0   ? `NFCI at ${v.toFixed(3)} — accommodative. Fed has not tightened credit markets meaningfully. Supports risk assets but inflation pressure may persist.`
    : v<0.5 ? `NFCI at ${v.toFixed(3)} — conditions tightening. Credit spreads widening, lending standards firming. Yellow flag for stocks and corporate bonds.`
    : `NFCI at ${v.toFixed(3)} — tight. Credit markets stressed. Historically associated with recession risk and equity drawdowns >15%.`;
  makeCompChart('chart-nfci', data.map(d=>d.date), data.map(d=>d.value), color, 0);
}

function renderRecProb(data) {
  const spread = data[data.length-1].value;
  const prob = calcRecProb(spread);
  const color = recpColor(prob);
  const [bt,bc] = prob<15?['Low risk','badge-loose']:prob<25?['Moderate','badge-normal']:prob<35?['Elevated','badge-watch']:['High risk','badge-tight'];
  const probSeries = data.map(d=>calcRecProb(d.value));
  document.getElementById('recprob-value').textContent = prob.toFixed(1)+'%';
  document.getElementById('recprob-value').style.color = color;
  document.getElementById('recprob-signal').textContent = spread>0?'▲ Curve positive':'▼ Curve inverted';
  document.getElementById('recprob-signal').style.color = color;
  document.getElementById('recprob-badge').textContent = bt;
  document.getElementById('recprob-badge').className = 'comp-badge '+bc;
  document.getElementById('recprob-interp').textContent =
    `10yr–3mo spread ${spread>0?'+':''}${spread.toFixed(2)}% — ${spread>0?'not inverted':'inverted'}. NY Fed probit model: ${prob.toFixed(1)}% recession probability within 12 months. `+
    (prob<20?'Below 20% warning threshold — near-term recession unlikely from yield curve alone.'
    :prob<30?'Approaching 30% warning zone. Monitor closely.'
    :'Above 30% warning threshold. Yield curve signaling elevated recession risk.');
  makeCompChart('chart-recprob', data.map(d=>d.date), probSeries, color, 30);
}

function loadCompositeIndicators() {
  renderNFCI(NFCI_DATA);
  renderRecProb(T10Y3M_DATA);

  const gdpNowHistory = [
    {q:'Q3 2025',v:2.8},{q:'Q4 2025',v:2.5},{q:'Q1 2026 final',v:2.1},
    {q:'Q2 Apr est',v:1.8},{q:'Q2 May est',v:1.2}
  ];
  makeCompChart('chart-gdpnow', gdpNowHistory.map(d=>d.q), gdpNowHistory.map(d=>d.v), '#fbbf24');

  const bbHistory = [
    {d:'Nov',v:5.2},{d:'Dec',v:5.8},{d:'Jan',v:6.1},{d:'Feb',v:5.5},
    {d:'Mar',v:4.9},{d:'Apr1',v:4.2},{d:'Apr2',v:4.0},{d:'May',v:4.5}
  ];
  makeCompChart('chart-bb', bbHistory.map(d=>d.d), bbHistory.map(d=>d.v), '#fbbf24', 5);
}

document.addEventListener('DOMContentLoaded', loadCompositeIndicators);

// ═══════════════════════════════════════════════════════════════
// ENERGY CHARTS — initialized lazily when Energy tab opens
// ═══════════════════════════════════════════════════════════════

function makeEnergyChart(id, labels, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets:[{ data, borderColor:color, backgroundColor:color+'18', fill:true, tension:0.35, pointRadius:2, pointHoverRadius:4, borderWidth:1.8 }] },
    options: {
      responsive:true, maintainAspectRatio:false, animation:{ duration:800 },
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ display:false },
        tooltip:{ backgroundColor:'#1a1a1a', borderColor:'#3a3a3a', borderWidth:1, titleColor:'#888', bodyColor:'#e8e8e8', padding:8, displayColors:false }
      },
      scales:{
        x:{ ticks:{ color:'#888', font:{size:9} }, grid:{ color:'#2e2e2e' } },
        y:{ ticks:{ color:'#888', font:{size:9} }, grid:{ color:'#2e2e2e' } }
      }
    }
  });
}

function initEnergyCharts() {
  const yrs = ['2020','2021','2022','2023','2024','2025','2026'];
  makeEnergyChart('chart-gas',  yrs, [2.0,3.7,6.4,2.6,2.1,2.3,2.5],   '#22d3ee');
  makeEnergyChart('chart-urea', yrs, [220,680,850,350,310,290,340],     '#fbbf24');
  makeEnergyChart('chart-dap',  yrs, [370,550,770,480,420,400,445],     '#fb923c');
  makeEnergyChart('chart-mos',  yrs, [17,42,72,38,28,24,21],            '#4ade80');
}

// ═══════════════════════════════════════════════════════════════
// MACRO EXPLORER — 7-indicator interactive simulation
// ═══════════════════════════════════════════════════════════════

const expNodes = [
  { id:'rate',  label:'Fed Funds Rate',  desc:'The benchmark interest rate set by the Federal Reserve — currently 4.33%. The lever the Fed pulls to cool or stimulate the economy. Higher rates slow borrowing and spending, but take 12–18 months to fully work through the economy.' },
  { id:'cpi',   label:'CPI / Inflation', desc:'Consumer Price Index — the official measure of inflation. Currently 3.2% YoY, pushed up by oil from the Strait of Hormuz closure. The Fed targets 2%. Above target forces the Fed\'s hand.' },
  { id:'oil',   label:'Oil Price',       desc:'Crude oil price per barrel — currently ~$105 due to Strait of Hormuz closure. Feeds directly into inflation through transportation, manufacturing, and energy costs. Every $10/barrel rise adds ~0.15% to CPI.' },
  { id:'yield', label:'Bond Yields',     desc:'Interest rates on US Treasury bonds — 10Y at 4.59%, 30Y at 5.12%. Higher yields mean lower bond prices. Tracks Fed rate expectations and inflation. When inflation is expected to persist, bond investors demand higher rates.' },
  { id:'bond',  label:'Bond Prices',     desc:'Market prices of fixed-income bonds. Always move opposite to yields — when yields rise 1%, a 10-year bond price drops roughly 7–8%. This is why inflation is so damaging to existing bond holders.' },
  { id:'stock', label:'Stock Market',    desc:'Equity prices — S&P 500 at 5,820. Higher rates raise the discount rate on future earnings, compressing valuations. When bonds pay 5%, stocks need to offer more upside to compete for capital.' },
  { id:'emp',   label:'Employment',      desc:'Jobs and unemployment rate — currently 4.1%. Strong employment gives the Fed room to raise rates without triggering a recession. Tight labor markets drive wage inflation, which feeds into CPI.' }
];

const expLinks = [
  { source:'rate',  target:'yield',  effect:'positive', label:'drives up' },
  { source:'rate',  target:'stock',  effect:'negative', label:'pressures' },
  { source:'rate',  target:'cpi',    effect:'negative', label:'cools (lag)' },
  { source:'rate',  target:'emp',    effect:'negative', label:'slows hiring' },
  { source:'yield', target:'bond',   effect:'negative', label:'inverse' },
  { source:'yield', target:'stock',  effect:'negative', label:'competes' },
  { source:'cpi',   target:'rate',   effect:'positive', label:'triggers hike' },
  { source:'cpi',   target:'yield',  effect:'positive', label:'pushes up' },
  { source:'oil',   target:'cpi',    effect:'positive', label:'feeds into' },
  { source:'oil',   target:'stock',  effect:'negative', label:'cost pressure' },
  { source:'emp',   target:'cpi',    effect:'positive', label:'wage pressure' },
  { source:'emp',   target:'stock',  effect:'positive', label:'consumer demand' },
  { source:'stock', target:'emp',    effect:'positive', label:'wealth effect' }
];

const EXP_BASE = { fedrate:4.33, cpi:3.2, unemp:4.1, yield:4.59, oil:105, sp500:5820 };
const EXP_PRE  = {
  baseline:    { fedrate:4.33, cpi:3.2,  unemp:4.1, yield:4.59, oil:105, sp500:5820 },
  stagflation: { fedrate:7.5,  cpi:9.0,  unemp:6.5, yield:7.5,  oil:145, sp500:4100 },
  recession:   { fedrate:1.0,  cpi:1.5,  unemp:9.0, yield:2.0,  oil:55,  sp500:3200 },
  softlanding: { fedrate:3.5,  cpi:2.5,  unemp:4.3, yield:3.8,  oil:80,  sp500:6300 },
  ratehike:    { fedrate:6.5,  cpi:4.5,  unemp:4.5, yield:5.75, oil:115, sp500:5100 },
  oilshock:    { fedrate:4.33, cpi:6.5,  unemp:4.2, yield:5.5,  oil:155, sp500:4800 }
};

const STRESS_LABELS = ['Normal','Watch','Elevated','Critical'];
const STRESS_COLORS = ['#4ade80','#fbbf24','#fb923c','#f87171'];
const STRESS_BG     = ['#242424','#1e1908','#1e1008','#1e0808'];
const STRESS_BORDER = ['#3a3a3a','#4a3a0a','#4a2a0a','#4a1010'];
const STRESS_BAR    = [18,45,72,94];

function expGetStress(id, v) {
  if (id==='rate')  return v.fedrate>6?3:v.fedrate>5?2:v.fedrate>4.5?1:0;
  if (id==='cpi')   return v.cpi>6?3:v.cpi>4?2:v.cpi>3?1:0;
  if (id==='oil')   return v.oil>130?3:v.oil>110?2:v.oil>90?1:0;
  if (id==='yield') return v.yield10>6?3:v.yield10>5?2:v.yield10>4.5?1:0;
  if (id==='bond')  { const px=92.4-7.5*(v.yield10-4.59); return px<80?3:px<88?2:px<93?1:0; }
  if (id==='stock') return v.sp500<3500?3:v.sp500<4500?2:v.sp500<5300?1:0;
  if (id==='emp')   return v.unemp>8?3:v.unemp>6?2:v.unemp>5?1:0;
  return 0;
}

function expGetVals() {
  return {
    fedrate: parseFloat(document.getElementById('exp-s-fedrate').value),
    cpi:     parseFloat(document.getElementById('exp-s-cpi').value),
    unemp:   parseFloat(document.getElementById('exp-s-unemp').value),
    yield10: parseFloat(document.getElementById('exp-s-yield').value),
    oil:     parseFloat(document.getElementById('exp-s-oil').value),
    sp500:   parseFloat(document.getElementById('exp-s-sp500').value)
  };
}

function expGaugeValue(id, v) {
  if (id==='rate')  return v.fedrate.toFixed(2)+'%';
  if (id==='cpi')   return v.cpi.toFixed(1)+'%';
  if (id==='oil')   return '$'+Math.round(v.oil);
  if (id==='yield') return v.yield10.toFixed(2)+'%';
  if (id==='bond')  return (92.4-7.5*(v.yield10-4.59)).toFixed(1);
  if (id==='stock') return v.sp500.toLocaleString();
  if (id==='emp')   return v.unemp.toFixed(1)+'%';
  return '';
}

function expGetAct(src, tgt, v) {
  const dR=(v.fedrate-4.33)/5.67, dC=(v.cpi-3.2)/8.8, dO=(v.oil-105)/55;
  const dY=(v.yield10-4.59)/4.41;
  const cl=x=>Math.max(0.1,Math.min(1,x));
  const m = {
    'rate-yield':cl(0.3+dR*1.2),'rate-stock':cl(0.3+dR),'rate-cpi':cl(0.2+dR*0.8),
    'rate-emp':cl(0.2+dR*0.7),'yield-bond':cl(0.3+dY*1.5),'yield-stock':cl(0.3+dY),
    'cpi-rate':cl(0.2+dC*1.5),'cpi-yield':cl(0.2+dC),'oil-cpi':cl(0.2+dO*1.5),
    'oil-stock':cl(0.2+dO),'emp-cpi':0.2,'emp-stock':0.25,'stock-emp':0.25
  };
  return m[src+'-'+tgt] !== undefined ? m[src+'-'+tgt] : 0.15;
}

function expUpdateGauges(v) {
  expNodes.forEach(node => {
    const st = expGetStress(node.id, v);
    const card = document.getElementById('eg-card-'+node.id);
    if (!card) return;
    card.classList.remove('stress-0','stress-1','stress-2','stress-3');
    card.classList.add('stress-'+st);
    card.style.backgroundColor = STRESS_BG[st];
    if (!card.classList.contains('active')) card.style.borderColor = STRESS_BORDER[st];
    const valEl = document.getElementById('eg-val-'+node.id);
    if (valEl) valEl.textContent = expGaugeValue(node.id, v);
    const barEl = document.getElementById('eg-bar-'+node.id);
    if (barEl) { barEl.style.width = STRESS_BAR[st]+'%'; barEl.style.backgroundColor = STRESS_COLORS[st]; }
    const lblEl = document.getElementById('eg-lbl-'+node.id);
    if (lblEl) { lblEl.textContent = STRESS_LABELS[st]; lblEl.style.color = STRESS_COLORS[st]; }
  });
}

let expActiveGauge = null;

function expSelectGauge(id) {
  expActiveGauge = id;
  const v = expGetVals();
  document.querySelectorAll('.exp-gauge-card').forEach(c => c.classList.remove('active'));
  const selCard = document.getElementById('eg-card-'+id);
  if (selCard) selCard.classList.add('active');

  const node = expNodes.find(n=>n.id===id);
  if (!node) return;
  const out = expLinks.filter(l=>l.source===id);
  const inc = expLinks.filter(l=>l.target===id);

  let html = `<div class="cascade-desc">${node.desc}</div>`;
  if (out.length) {
    html += `<div class="cascade-hdr" style="color:var(--green)">Pushes these indicators:</div>`;
    out.forEach(l => {
      const tNode = expNodes.find(n=>n.id===l.target);
      const act = expGetAct(l.source, l.target, v);
      const barW = Math.round(act*100);
      const isPos = l.effect==='positive';
      const arrColor = isPos?'var(--green)':'var(--red)';
      const arrow = isPos?'&#9650;':'&#9660;';
      html += `<div class="cascade-row">
        <div class="cascade-tgt">${tNode.label}</div>
        <div class="cascade-right">
          <span class="cascade-arrow" style="color:${arrColor}">${arrow} ${l.label}</span>
          <div class="cascade-str-bar"><div class="cascade-str-fill" style="width:${barW}%;background:${arrColor};"></div></div>
        </div>
      </div>`;
    });
  }
  if (inc.length) {
    html += `<div class="cascade-hdr" style="color:var(--muted);margin-top:10px">Influenced by:</div>`;
    inc.forEach(l => {
      const sNode = expNodes.find(n=>n.id===l.source);
      html += `<div class="cascade-row-sm"><span>${sNode.label}</span><span style="color:var(--dim)">${l.label}</span></div>`;
    });
  }

  document.getElementById('exp-cascade-title').textContent = node.label+' — Connections';
  document.getElementById('exp-cascade-content').innerHTML = html;
}

function expApplyPreset(key) {
  const p = EXP_PRE[key];
  document.getElementById('exp-s-fedrate').value = p.fedrate;
  document.getElementById('exp-s-cpi').value     = p.cpi;
  document.getElementById('exp-s-unemp').value   = p.unemp;
  document.getElementById('exp-s-yield').value   = p.yield;
  document.getElementById('exp-s-oil').value     = p.oil;
  document.getElementById('exp-s-sp500').value   = p.sp500;
  document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
  const btn = document.getElementById('exp-preset-'+key);
  if (btn) btn.classList.add('active');
  expUpdateSim();
}

function expUpdateSim() {
  const fedrate = parseFloat(document.getElementById('exp-s-fedrate')?.value || 4.33);
  const cpi     = parseFloat(document.getElementById('exp-s-cpi')?.value     || 3.2);
  const unemp   = parseFloat(document.getElementById('exp-s-unemp')?.value   || 4.1);
  const yield10 = parseFloat(document.getElementById('exp-s-yield')?.value   || 4.59);
  const oil     = parseFloat(document.getElementById('exp-s-oil')?.value     || 105);
  const sp500   = parseFloat(document.getElementById('exp-s-sp500')?.value   || 5820);
  const v = { fedrate, cpi, unemp, yield10, oil, sp500 };

  const setEl = (id, text) => { const el=document.getElementById(id); if(el) el.textContent=text; };
  setEl('exp-v-fedrate', fedrate.toFixed(2)+'%');
  setEl('exp-v-cpi',     cpi.toFixed(1)+'%');
  setEl('exp-v-unemp',   unemp.toFixed(1)+'%');
  setEl('exp-v-yield',   yield10.toFixed(2)+'%');
  setEl('exp-v-oil',     '$'+Math.round(oil));
  setEl('exp-v-sp500',   sp500.toLocaleString());

  // Match preset
  let matched = false;
  for (const [key,p] of Object.entries(EXP_PRE)) {
    if (Math.abs(p.fedrate-fedrate)<0.01&&Math.abs(p.cpi-cpi)<0.01&&
        Math.abs(p.unemp-unemp)<0.01&&Math.abs(p.yield-yield10)<0.01&&
        Math.abs(p.oil-oil)<1&&Math.abs(p.sp500-sp500)<50) {
      document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));
      const btn=document.getElementById('exp-preset-'+key);
      if(btn) btn.classList.add('active');
      matched=true; break;
    }
  }
  if(!matched) document.querySelectorAll('.preset-btn').forEach(b=>b.classList.remove('active'));

  expUpdateGauges(v);
  if (expActiveGauge) expSelectGauge(expActiveGauge);

  // Projected impacts
  const dYield   = yield10 - EXP_BASE.yield;
  const dSP500   = (sp500 - EXP_BASE.sp500) / EXP_BASE.sp500 * 100;
  const bondPxChg = -7.5 * dYield;
  const bondPxNow = Math.max(0, 92.4 * (1 + bondPxChg/100));
  const mortRate  = yield10 + 2.46;
  const dOil     = (oil - EXP_BASE.oil) / EXP_BASE.oil * 100;
  const portImpact = 0.60*dSP500 + 0.40*bondPxChg;
  const coreCPI   = Math.max(0, cpi - dOil*0.025).toFixed(1);

  let fedSig, fedCls;
  if (cpi>3.5&&unemp>5.5)     { fedSig='STAGFLATION — hardest call'; fedCls='sig-stagflation'; }
  else if (cpi>3.5&&unemp<=5) { fedSig='LIKELY HIKE';                fedCls='sig-hike'; }
  else if (cpi<2.5&&unemp>=5) { fedSig='LIKELY CUT';                 fedCls='sig-cut'; }
  else if (cpi<2.5&&unemp<5)  { fedSig='HOLD or mild cut';           fedCls='sig-hold'; }
  else                         { fedSig='HOLD — data-dependent';      fedCls='sig-hold'; }

  let curveSig, curveCls;
  if (yield10<fedrate-0.3)      { curveSig='INVERTED — recession risk'; curveCls='sig-inverted'; }
  else if (yield10>fedrate+0.5) { curveSig='NORMAL — growth signal';    curveCls='sig-normal'; }
  else                           { curveSig='FLAT — watch closely';      curveCls='sig-flat'; }

  function fd(val, d, u) {
    const s=val>=0?'+':'';
    const cls=val>0.05?'delta-pos':val<-0.05?'delta-neg':'delta-neu';
    return `<span class="${cls}">${s}${val.toFixed(d)}${u}</span>`;
  }

  const out = document.getElementById('exp-sim-output');
  if (!out) return;
  out.innerHTML = `
    <div class="sim-card"><div class="sim-label">Bond Price Index</div><div class="sim-value">${bondPxNow.toFixed(1)} <small>${fd(bondPxChg,1,'%')}</small></div></div>
    <div class="sim-card"><div class="sim-label">Mortgage Rate</div><div class="sim-value">${mortRate.toFixed(2)}% <small>${fd(mortRate-7.05,2,'pp')}</small></div></div>
    <div class="sim-card"><div class="sim-label">Fed Likely Action</div><div class="sim-signal ${fedCls}">${fedSig}</div></div>
    <div class="sim-card"><div class="sim-label">Yield Curve</div><div class="sim-signal ${curveCls}">${curveSig}</div></div>
    <div class="sim-card"><div class="sim-label">60/40 Portfolio Est.</div><div class="sim-value">${fd(portImpact,1,'%')}</div></div>
    <div class="sim-card"><div class="sim-label">Core CPI (ex-oil)</div><div class="sim-value">${coreCPI}% <small>${fd(parseFloat(coreCPI)-3.1,1,'pp')}</small></div></div>
  `;

  // Flash cards
  out.querySelectorAll('.sim-card').forEach(c => {
    c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
  });
}

// Bind sliders
['exp-s-fedrate','exp-s-cpi','exp-s-unemp','exp-s-yield','exp-s-oil','exp-s-sp500'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', expUpdateSim);
});
