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
    ? `<div class="data-chips">${chips.map(c => {
        const isInd = IND_META[c] != null;
        return isInd
          ? `<span class="chip clickable" onclick="openDrawer('${c}')">${c}</span>`
          : `<span class="chip">${c}</span>`;
      }).join('')}</div>`
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
    // Fall back to body text
    const bodyText = chainPanel.body || '';
    if (bodyText.trim().length > 10) {
      el.innerHTML = `<div class="chain-trigger">${bodyText}</div>`;
    } else {
      el.innerHTML = '<div class="skeleton">Chain data unavailable.</div>';
    }
    return;
  }

  const steps = (chain.steps || []).map(s =>
    `<div class="chain-step"><span class="chain-arrow">→</span><span>${s}</span></div>`
  ).join('');

  el.innerHTML = `
    <div class="chain-trigger">${chain.trigger}</div>
    <div class="chain-steps">${steps}</div>
    <div class="chain-outcome">${chain.outcome || ''}</div>
    ${chain.confidence ? `<div class="chain-conf-line">Direction: ${chain.confidence}</div>` : ''}
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
