// ── Tab routing ───────────────────────────────────────────────
let energyChartsReady = false;
let explorerReady = false;
let dailyBriefLoaded = false;

function loadDailyBrief() {
  if (dailyBriefLoaded) return;
  const container = document.getElementById('daily-brief-content');
  if (!container) return;
  fetch('/api/daily-snapshot')
    .then(r => {
      if (!r.ok) throw new Error('Snapshot not available');
      return r.text();
    })
    .then(html => {
      // Extract and scope the style block, then inject body content
      const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const bodyMatch  = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const rawCSS     = styleMatch ? styleMatch[1] : '';
      const bodyHTML   = bodyMatch  ? bodyMatch[1]  : html;
      // Scope all CSS rules to .dbw so they don't leak into the dashboard
      const scopedCSS  = rawCSS.replace(/([^\r\n,{}]+)(,(?=[^}]*\{)|\s*\{)/g, (m, sel, end) => {
        const s = sel.trim();
        if (!s || s.startsWith('@') || s.startsWith('//')) return m;
        const scoped = s.split(',').map(p => `.dbw ${p.trim()}`).join(', ');
        return scoped + end;
      });
      container.innerHTML = `<style>${scopedCSS}</style><div class="dbw">${bodyHTML}</div>`;
      dailyBriefLoaded = true;
    })
    .catch(err => {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:#a0aec0;">
        Briefing not available yet — runs each morning at 6 AM.<br><small>${err.message}</small>
      </div>`;
    });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');

  if (tabId === 'daily-brief') loadDailyBrief();
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

// Load brief immediately on page open
document.addEventListener('DOMContentLoaded', loadDailyBrief);

document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ── Inner tab switching ────────────────────────────────────────
document.querySelectorAll('.inner-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const bar  = btn.closest('.inner-tab-bar');
    const sect = btn.closest('.tab-content, section');
    bar.querySelectorAll('.inner-tab-btn').forEach(b => b.classList.remove('active'));
    sect.querySelectorAll('.inner-tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const pane = document.getElementById(btn.dataset.pane);
    if (pane) pane.classList.add('active');
    // Re-init energy charts if switching into a pane that has canvases
    if (btn.dataset.pane && btn.dataset.pane.startsWith('inner-energy')) {
      requestAnimationFrame(initEnergyCharts);
    }
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
function isProse(text) {
  const plain = text.replace(/\*\*/g, '').replace(/<[^>]+>/g, '').trim();
  return plain.length > 80 || /\.\s+[A-Z]/.test(plain) || (plain.endsWith('.') && plain.length > 60);
}

function bulletPanel(panel, expandId) {
  let bullets = [];
  try { bullets = JSON.parse(panel.bullets || '[]'); } catch {}
  if (!Array.isArray(bullets)) bullets = [];

  let ledeSrc = '';
  let expandSrc = '';
  let proseCount = 0;
  let shortBuf = [];

  const flushShort = (dest) => {
    if (!shortBuf.length) return;
    dest === 'lede'
      ? ledeSrc += `<ul class="bullet-list">${shortBuf.map(b => `<li>${md(b).replace(/<\/?p>/g,'')}</li>`).join('')}</ul>`
      : expandSrc += `<ul class="bullet-list">${shortBuf.map(b => `<li>${md(b).replace(/<\/?p>/g,'')}</li>`).join('')}</ul>`;
    shortBuf = [];
  };

  bullets.forEach(b => {
    if (isProse(b)) {
      if (proseCount === 0) {
        flushShort('lede');
        ledeSrc += `<p class="card-lede">${md(b).replace(/<\/?p>/g,'')}</p>`;
      } else {
        flushShort('expand');
        expandSrc += `<p class="card-body-para">${md(b).replace(/<\/?p>/g,'')}</p>`;
      }
      proseCount++;
    } else {
      shortBuf.push(b);
    }
  });
  flushShort(proseCount > 1 ? 'expand' : 'lede');

  const hasBody = panel.body && panel.body.trim().length > 20;
  const extraContent = expandSrc + (hasBody ? md(panel.body) : '');
  const expandBtn = extraContent
    ? `<button class="expand-toggle" onclick="toggleExpand('${expandId}', this)">Read more ↓</button>
       <div class="expand-body" id="${expandId}">${extraContent}</div>`
    : '';

  return ledeSrc + expandBtn;
}

function toggleExpand(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  btn.textContent = el.classList.contains('open') ? 'Close ↑' : 'Read full analysis ↓';
}

// ── Render panels ─────────────────────────────────────────────
const PANEL_MAP = {
  daily_summary:        'panel-daily_summary',
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
    // Auto-set data-accent from label color if not already in HTML
    if (!el.dataset.accent) {
      const lbl = el.querySelector('.card-label');
      if (lbl) {
        const accent = ['green','red','blue','amber','purple','gray'].find(c => lbl.classList.contains(c));
        if (accent) el.dataset.accent = accent;
      }
    }
    const inner = bulletPanel(panel, `expand-${panel.panel_id}`);
    // Preserve .card-header (which wraps .card-label) if present, else fall back to bare .card-label
    const header = el.querySelector('.card-header') || el.querySelector('.card-label');
    el.innerHTML = '';
    if (header) el.appendChild(header);
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
    <div class="card geo-card" data-accent="purple">
      <div class="card-header"><div class="card-label purple">Geopolitical Thread ${geoPanels.length > 1 ? i + 1 : ''}</div></div>
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
      <div style="display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;">
        <a class="curated-headline" href="${n.url || '#'}" target="_blank" rel="noopener">
          <span class="curated-src">${n.source || '?'}</span>
          <span>${n.headline}</span>
        </a>
        <button class="ask-webb-btn" onclick="webbOpen('News: ${n.headline.replace(/'/g,"\\'")}. ${(n.why_it_matters||'').replace(/'/g,"\\'")}')">Ask Dr. Webb</button>
      </div>
      ${n.why_it_matters ? `<div class="curated-why">${n.why_it_matters}</div>` : ''}
    </div>
  `).join('');
}

// ── Market snapshot (overview top row) ───────────────────────
const SNAPSHOT_SYMS  = ['^GSPC','^DJI','^IXIC','CL=F','^VIX','^TNX'];
const SNAPSHOT_NAMES = {
  '^GSPC':'S&P 500', '^DJI':'Dow Jones', '^IXIC':'NASDAQ',
  'CL=F':'WTI Crude', '^VIX':'VIX', '^TNX':'10-Yr Yield'
};

function renderMarketSnapshot(market) {
  const el = document.getElementById('market-snapshot');
  if (!el) return;
  const by = Object.fromEntries((market || []).map(m => [m.symbol, m]));
  const items = SNAPSHOT_SYMS.filter(s => by[s]);
  if (!items.length) return;
  el.innerHTML = items.map(sym => {
    const m = by[sym];
    const chg = m.change_pct;
    const cls = chg == null ? 'flat' : chg > 0 ? 'up' : 'down';
    const arrow = chg > 0 ? '▲' : chg < 0 ? '▼' : '';
    const isIdx = ['^GSPC','^DJI','^IXIC'].includes(sym);
    const isYld = sym === '^TNX';
    const val = isIdx ? fmt(m.value, 0) : isYld ? m.value.toFixed(2) + '%' : '$' + m.value.toFixed(2);
    return `<div class="snapshot-card ${cls} clickable" onclick="openSnapshotDrawer('${sym}')">
      <div class="snapshot-label">${SNAPSHOT_NAMES[sym]}</div>
      <div class="snapshot-value ${cls}">${val}</div>
      ${chg != null ? `<div class="snapshot-change ${cls}">${arrow} ${Math.abs(chg).toFixed(2)}%</div>` : ''}
      <div class="snapshot-hint">↗ learn more</div>
    </div>`;
  }).join('');
}

// ── Key levels (overview sidebar) ────────────────────────────
function renderKeyLevels(market) {
  const el = document.getElementById('key-levels-content');
  if (!el) return;
  const by = Object.fromEntries((market || []).map(m => [m.symbol, m]));
  const flags = [];

  const spx = by['^GSPC'];
  if (spx) {
    const cls = spx.change_pct > 0.5 ? 'ok' : spx.change_pct < -1 ? 'alert' : 'warn';
    const note = spx.change_pct > 0 ? `Up ${spx.change_pct.toFixed(2)}% today` : `Down ${Math.abs(spx.change_pct).toFixed(2)}% today`;
    flags.push({ name: 'S&P 500', value: fmt(spx.value, 0), note, cls });
  }
  const vix = by['^VIX'];
  if (vix) {
    const cls = vix.value < 15 ? 'ok' : vix.value > 25 ? 'alert' : 'warn';
    const note = vix.value < 15 ? 'Markets calm' : vix.value > 25 ? 'High fear' : 'Volatility elevated';
    flags.push({ name: 'VIX Fear Index', value: vix.value.toFixed(1), note, cls });
  }
  const oil = by['CL=F'];
  if (oil) {
    const cls = oil.value < 80 ? 'ok' : oil.value > 100 ? 'alert' : 'warn';
    const note = oil.value > 100 ? 'Above $100 — inflation risk' : oil.value > 80 ? 'Running high' : 'Normal range';
    flags.push({ name: 'WTI Crude', value: '$' + oil.value.toFixed(2), note, cls });
  }
  const yld = by['^TNX'];
  if (yld) {
    const cls = yld.value < 4 ? 'ok' : yld.value > 5 ? 'alert' : 'warn';
    const note = yld.value > 5 ? 'Very restrictive' : yld.value > 4 ? 'Rates elevated' : 'Rates moderate';
    flags.push({ name: '10-Yr Treasury', value: yld.value.toFixed(2) + '%', note, cls });
  }

  el.innerHTML = `<div class="key-levels-grid">${flags.map(f =>
    `<div class="level-flag ${f.cls}">
      <div class="level-flag-name">${f.name}</div>
      <div class="level-flag-val">${f.value}</div>
      <div class="level-flag-note">${f.note}</div>
    </div>`).join('')}</div>`;
}

// ── Snapshot educational context ─────────────────────────────
const SNAP_CONTEXT = {
  '^GSPC': {
    name: 'S&P 500 Index',
    what: 'The S&P 500 tracks the 500 largest US publicly traded companies by market capitalization — roughly 80% of the total US stock market. It is the benchmark against which virtually every investment manager is measured. When the news says "the market was up today," they almost always mean the S&P 500.',
    rising: 'Corporate earnings growing, economic confidence high, or money flowing into risk assets. A rising S&P is a general signal of economic health — but can also reflect loose monetary conditions or speculative excess.',
    falling: 'Recession fears, earnings disappointments, rising rates compressing valuations, or geopolitical shocks. A 20%+ decline from peak is formally a "bear market." The S&P has recovered from every bear market in history — but timing matters enormously if you need to draw down assets.',
    watchLevel: '4,000–4,500: Bear market territory. 4,500–5,500: Moderate valuation. Above 5,500: Historically elevated — more vulnerable to bad news. When the VIX exceeds 25 alongside an S&P decline, it usually means institutional selling, not just noise.',
    forLarry: 'If you hold a broad index fund (like SPY or VTSAX), this IS your portfolio. A 20% decline in the S&P means a ~20% hit to that portion of your holdings. The key question is always: do you need this money in the next 3–5 years?'
  },
  '^DJI': {
    name: 'Dow Jones Industrial Average',
    what: 'The Dow tracks just 30 large US "blue chip" companies and dates back to 1896. It is price-weighted (higher-priced stocks move it more), which is an analytical quirk. It gets outsized news coverage but the S&P 500 is a better gauge of broad market health — the Dow\'s 30-stock sample can be misleading.',
    rising: 'Same drivers as the S&P: growth optimism, strong earnings, or stimulus. Because only 30 stocks make up the Dow, a move in a few large components (Boeing, Goldman, or UnitedHealth) can make the headline mislead about the broader market.',
    falling: 'Same concerns as the S&P. Worth watching alongside the S&P — if they diverge significantly, something unusual is happening in specific sectors.',
    watchLevel: '35,000–38,000: Historical fair value range. Above 40,000: Elevated valuations. Below 32,000: Meaningful drawdown territory. Financial media favors the Dow for historical familiarity; professional investors watch the S&P 500.',
    forLarry: 'The Dow and S&P usually move together. If they diverge, it is worth investigating why. For retirement portfolio health, the S&P 500 is the more representative number to track.'
  },
  '^IXIC': {
    name: 'NASDAQ Composite',
    what: 'The NASDAQ Composite tracks over 3,000 companies on the NASDAQ exchange, heavily weighted toward technology — Apple, Microsoft, Amazon, NVIDIA, Meta, Alphabet. It moves more dramatically than the S&P in both directions. It leads in bull markets and falls further in bear markets.',
    rising: 'Technology optimism, falling interest rates (which boost growth stock valuations by making distant future earnings worth more today), or AI and innovation narratives.',
    falling: 'Rising interest rates are especially punishing for tech/growth stocks — their valuations depend on discounting future earnings at today\'s rate. A 1% rate rise can compress tech P/E ratios significantly.',
    watchLevel: 'NASDAQ above 18,000: Elevated; vulnerable to rate or earnings surprises. Watch the NASDAQ-to-S&P ratio — when it gets very stretched, a rotation out of tech is historically likely.',
    forLarry: 'If you own a tech-heavy fund (like QQQ), this is closer to what you are tracking. Tech is more volatile than the broad market — great when rates fall, painful when they rise.'
  },
  'CL=F': {
    name: 'WTI Crude Oil (Futures)',
    what: 'WTI (West Texas Intermediate) crude oil futures represent the price of a barrel of US benchmark oil for near-term delivery. Oil is an input into nearly everything: gasoline, diesel, aviation fuel, plastics, fertilizer, shipping costs. A $10/barrel move in crude adds roughly 15–25 basis points to CPI within 6 months.',
    rising: 'Demand outpacing supply, OPEC+ production cuts, geopolitical disruptions (Strait of Hormuz, Russia), or economic boom. Gas prices at the pump rise within days. Inflation picks up. Energy company stocks rally.',
    falling: 'Demand weakness (recession fears or slowing China), OPEC+ overproduction, US shale surge, or geopolitical resolution. Disinflationary pressure. Consumer relief at the pump.',
    watchLevel: 'Below $60: deflationary for energy, hurts US drillers. $70–$90: comfortable range. $90–$100: running warm — watch CPI 3–6 months out. Above $100: oil shock territory, historically associated with recessions. Above $130: as seen in 2008 and briefly in 2022.',
    forLarry: 'Oil is the most geopolitically sensitive price in the world. It connects Middle East tensions, Russian pipelines, OPEC+ decisions, and US shale output into one daily number. A sustained move above $100 should put you on alert for higher CPI readings ahead.'
  },
  '^VIX': {
    name: 'VIX — CBOE Volatility Index',
    what: 'The VIX measures what the market expects S&P 500 volatility to be over the next 30 days, derived from options contract prices. It does NOT measure stock prices directly — it measures how much investors are paying to insure against big moves. A high VIX means expensive insurance — someone is very worried.',
    rising: 'Investors are nervous and buying portfolio protection. Often precedes or accompanies sell-offs. A VIX spike above 30 during a decline is often a sign of near-term exhaustion — but not always.',
    falling: 'Markets calm and complacent. Low hedging costs. Paradoxically, a very low VIX (below 12) can be a warning — historically, prolonged low-volatility periods end in sharp reversals. Stability breeds instability.',
    watchLevel: 'Below 15: Very calm, possibly complacent. 15–20: Normal. 20–25: Elevated nervousness. 25–30: Fear mode. 30–40: Crisis conditions. Above 40: Extreme crisis (COVID-19 peak: 82, 2008 crisis: 80). Above 30 typically means institutional managers are actively reducing risk.',
    forLarry: 'The VIX is a thermometer, not a trade. When it spikes, portfolio values move fast. Products that try to "own" the VIX (like VXX) decay rapidly and are not appropriate investments for most people.'
  },
  '^TNX': {
    name: '10-Year Treasury Yield',
    what: 'The 10-year US Treasury yield is the interest rate the government pays to borrow money for 10 years. It is arguably the most important number in global finance — the "risk-free rate" against which all other assets are priced. It directly drives 30-year mortgage rates (typically yield + 2.5%) and is the discount rate that sets the valuation of every stock in the S&P 500.',
    rising: 'Mortgage rates rise almost immediately. Stocks face valuation compression (future earnings worth less in today\'s dollars). Bond prices fall. Dollar typically strengthens. Signals growth optimism or persistent inflation concerns.',
    falling: 'Mortgage rates drop, triggering refinancing booms. Growth stocks rally. Bond prices rise. Often signals economic slowdown fears or inflation coming under control. Rapid falls usually mean money fleeing to safety.',
    watchLevel: 'Below 3%: Very low, usually means recession or extraordinary Fed easing. 3–4%: Historically normal. 4–4.5%: Restrictive but manageable. Above 4.5%: Pressure on stocks and housing. Above 5%: Last seen in 2007; forces serious rethinking of equity valuations.',
    forLarry: 'If you hold bond funds (like BND or TLT), the 10-year yield is your most important number. A 1% rise in the 10-year drops a long-duration bond fund roughly 8–10%. This is why 2022 was so painful — yields rose from 1.5% to 4.2% in one year.'
  }
};

// ── Generic info drawer (reuses #ind-drawer for any content) ─
function openInfoDrawer(title, subtitle, ctx, relatedTo) {
  document.getElementById('drawer-title').textContent = title;
  const seriesEl = document.getElementById('drawer-series');
  if (seriesEl) seriesEl.textContent = subtitle || '';

  const related = (relatedTo || []).map(id => {
    const m = IND_META[id];
    if (!m) return '';
    return `<span class="chip clickable" onclick="openDrawer('${id}')">${m.name}</span>`;
  }).filter(Boolean).join('');

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
    ${ctx.release ? `<div>
      <div class="drawer-section-title">Release schedule</div>
      <div class="release-row">
        <span class="release-icon">📅</span>
        <span class="drawer-section-body">${ctx.release}</span>
      </div>
    </div>` : ''}
    <div>
      <div class="drawer-section-title">Key levels to watch</div>
      <div class="drawer-section-body">${ctx.watchLevel}</div>
    </div>
    ${ctx.forLarry ? `<div>
      <div class="drawer-section-title">What this means for your portfolio</div>
      <div class="drawer-section-body" style="border-left:3px solid var(--amber);padding-left:10px;margin-left:2px">${ctx.forLarry}</div>
    </div>` : ''}
    ${related ? `<div>
      <div class="drawer-section-title">Related indicators</div>
      <div class="data-chips" style="margin-top:8px">${related}</div>
    </div>` : ''}
  `;

  document.getElementById('ind-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
  document.querySelectorAll('.ind-card').forEach(c => c.classList.remove('selected'));
}

function openSnapshotDrawer(sym) {
  const ctx = SNAP_CONTEXT[sym];
  if (!ctx) return;
  openInfoDrawer(ctx.name, sym, ctx, []);
}

// ── Date formatting helper ─────────────────────────────────────
function fmtDate(str) {
  if (!str) return null;
  try {
    const d = new Date(str);
    const days = Math.floor((Date.now() - d) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + ' days ago';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return null; }
}

// ── Voices ────────────────────────────────────────────────────
function renderVoices(voices) {
  const el = document.getElementById('voices-list');
  if (!el) return;
  if (!voices?.length) {
    el.innerHTML = '<div class="skeleton">Run a cycle to load voices.</div>';
    return;
  }
  el.innerHTML = voices.map(v => {
    const date = fmtDate(v.published);
    return `
    <div class="voice-card">
      <div class="voice-header">
        <div>
          <div class="voice-name">${v.name}</div>
          <div class="voice-title">${v.title}</div>
        </div>
        <div class="voice-meta">
          ${date ? `<span class="voice-date">${date}</span>` : ''}
          ${v.url ? `<a class="voice-src-link" href="${v.url}" target="_blank" rel="noopener">Source ↗</a>` : ''}
          <button class="ask-webb-btn" onclick="webbOpen('${v.name.replace(/'/g,"\\'")} says: ${(v.current_view||'').replace(/'/g,"\\'")}')">Ask Dr. Webb</button>
        </div>
      </div>
      ${v.current_view ? `<div class="voice-view">${v.current_view}</div>` : ''}
      ${v.plain_english ? `<div class="voice-plain"><span class="voice-plain-label">What this means for you:</span> ${v.plain_english}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Influencer Pulse ──────────────────────────────────────────
const SENTIMENT_STYLE = {
  bullish:          { label: 'Bullish',  color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  bearish:          { label: 'Bearish',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  neutral:          { label: 'Neutral',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  mixed:            { label: 'Mixed',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  no_recent_content:{ label: 'No recent content', color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
};

function renderInfluencerPulse(pulse) {
  const summaryEl  = document.getElementById('influencer-pulse-summary');
  const themesEl   = document.getElementById('influencer-shared-themes');
  const creatorsEl = document.getElementById('influencer-creator-list');
  if (!summaryEl || !themesEl || !creatorsEl) return;

  if (!pulse) {
    summaryEl.innerHTML  = '<div class="skeleton">Run a cycle to load influencer data.</div>';
    themesEl.innerHTML   = '';
    creatorsEl.innerHTML = '';
    return;
  }

  // Summary paragraph
  summaryEl.innerHTML = pulse.pulse_summary
    ? `<p style="margin:0">${pulse.pulse_summary}</p>`
    : '<p style="margin:0;color:var(--text-muted)">No summary available.</p>';

  // Shared themes chips
  if (pulse.shared_themes?.length) {
    themesEl.innerHTML = `
      <div style="padding:0 20px 4px">
        <span style="font-size:0.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Shared themes</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
          ${pulse.shared_themes.map(t =>
            `<span style="background:rgba(20,184,166,0.12);color:#14b8a6;border-radius:9999px;padding:3px 10px;font-size:0.8rem;">${t}</span>`
          ).join('')}
        </div>
      </div>`;
  } else {
    themesEl.innerHTML = '';
  }

  // Per-creator cards
  if (!pulse.creators?.length) {
    creatorsEl.innerHTML = '<div style="padding:16px 20px;color:var(--text-muted)">No creator data yet.</div>';
    return;
  }

  creatorsEl.innerHTML = pulse.creators.map(c => {
    const style = SENTIMENT_STYLE[c.sentiment] || SENTIMENT_STYLE.neutral;
    return `
    <div class="voice-card" style="border-left:3px solid ${style.color}">
      <div class="voice-header">
        <div>
          <div class="voice-name">${c.name}</div>
          ${c.key_theme ? `<div class="voice-title">${c.key_theme}</div>` : ''}
        </div>
        <span style="background:${style.bg};color:${style.color};border-radius:9999px;padding:3px 12px;font-size:0.78rem;font-weight:600;white-space:nowrap">
          ${style.label}
        </span>
      </div>
      ${c.notable ? `<div class="voice-view" style="margin-top:6px">${c.notable}</div>` : ''}
    </div>`;
  }).join('');
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
const IND_ORDER = ['DGS2','DGS10','DGS30','FEDFUNDS','T10YIE','T5YIE','CPIAUCSL','UNRATE','DCOILWTICO','VIXCLS','GDP'];
const IND_META = {
  DGS2: { name: '2-Yr Treasury', dec: 2, color: '#2563eb', levels: [
    { value: 2.5, color: 'green', label: '2.5% — neutral rate, Fed neither stimulating nor braking' },
    { value: 4.0, color: 'amber', label: '4% — restrictive, all borrowing costs rise across economy' },
    { value: 5.0, color: 'red',   label: '5% — very restrictive, last seen 2006–07 before the crisis' },
  ]},
  DGS10: { name: '10-Yr Treasury', dec: 2, color: '#7c3aed', levels: [
    { value: 3.0, color: 'green', label: '3% — historically normal, housing affordable' },
    { value: 4.5, color: 'amber', label: '4.5% — 30yr mortgage ~7%, stock valuations under pressure' },
    { value: 5.0, color: 'red',   label: '5% — last seen 2007, equity/bond competition intensifies' },
  ]},
  DGS30: { name: '30-Yr Treasury', dec: 2, color: '#db2777', levels: [
    { value: 4.0, color: 'green', label: '4% — normal long-term rate, housing functional' },
    { value: 5.0, color: 'amber', label: '5% — $500k mortgage costs ~$2,685/mo; pension funds hurting' },
    { value: 5.5, color: 'red',   label: '5.5% — housing market freezes, new construction collapses' },
  ]},
  FEDFUNDS: { name: 'Fed Funds Rate', dec: 2, color: '#dc2626', levels: [
    { value: 2.5, color: 'green', label: '2.5% — neutral rate, economy neither helped nor hurt' },
    { value: 4.0, color: 'amber', label: '4% — actively restrictive, Fed pressing the brake pedal' },
    { value: 5.5, color: 'red',   label: '5.5% — very restrictive, every variable-rate debt hurts' },
  ]},
  T10YIE: { name: '10-Yr Breakeven Infl.', dec: 2, color: '#d97706', levels: [
    { value: 2.0, color: 'green', label: "2% — Fed's target, bond market sees inflation under control" },
    { value: 2.5, color: 'amber', label: '2.5% — elevated, Fed stays cautious, rate cuts off the table' },
    { value: 3.0, color: 'red',   label: '3% — alarm level, implies Fed must stay high for a decade' },
    { value: 3.5, color: 'red',   label: '3.5% — serious crisis signal, bond market has lost faith in Fed' },
  ]},
  T5YIE: { name: '5-Yr Breakeven Infl.', dec: 2, color: '#f59e0b', levels: [
    { value: 2.0, color: 'green', label: "2% — Fed's target; bond market expects inflation solved in 5 yrs" },
    { value: 2.5, color: 'amber', label: '2.5% — near-term inflation embedding, Fed cannot cut rates yet' },
    { value: 3.0, color: 'red',   label: '3% — bond market expects high inflation for next 5 years' },
    { value: 3.5, color: 'red',   label: '3.5% — serious alarm; implies rate cuts are years away, bonds fall' },
  ]},
  CPIAUCSL: { name: 'CPI Index', dec: 1, color: '#d97706', levels: [] },
  UNRATE: { name: 'Unemployment Rate', dec: 1, color: '#16a34a', levels: [
    { value: 3.5, color: 'amber', label: '3.5% — very tight, wage inflation risk, workers have all the power' },
    { value: 4.0, color: 'green', label: '4% — full employment (Fed target zone), healthy balance' },
    { value: 5.0, color: 'amber', label: '5% — softening economy, hiring slowdown underway' },
    { value: 6.5, color: 'red',   label: '6.5% — recession territory, Fed likely cutting aggressively' },
  ]},
  DCOILWTICO: { name: 'WTI Crude Oil', dec: 2, color: '#92400e', levels: [
    { value: 60,  color: 'red',   label: '$60 — below new-well break-even; "Drill Baby Drill" is impossible here' },
    { value: 80,  color: 'green', label: '$80 — upper bound of comfortable range for consumers and drillers' },
    { value: 100, color: 'amber', label: '$100 — oil shock territory, adds ~0.5–1% to CPI within months' },
    { value: 130, color: 'red',   label: '$130 — historical recession trigger, last seen 2008 and 2022' },
  ]},
  VIXCLS: { name: 'VIX — Fear Index', dec: 2, color: '#64748b', levels: [
    { value: 15,  color: 'green', label: '15 — calm markets, complacency (can itself be a warning)' },
    { value: 20,  color: 'amber', label: '20 — normal upper bound, some nervousness in options pricing' },
    { value: 30,  color: 'red',   label: '30 — fear mode, investors paying heavily to protect portfolios' },
    { value: 40,  color: 'red',   label: '40 — crisis territory (COVID peak: 82, 2008 crisis: 80)' },
  ]},
  GDP: { name: 'Real GDP', dec: 0, color: '#0891b2', levels: [] },
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
    watchLevel: 'The Fed\'s target is 2%. At 2.3–2.5%, markets are modestly above target. A sustained move above 3% would be alarming and force Fed action. 3.5% would be a serious crisis signal.',
    relatedTo: ['T5YIE', 'DGS10', 'FEDFUNDS', 'CPIAUCSL', 'DCOILWTICO']
  },
  T5YIE: {
    what: 'The 5-Year Breakeven Inflation Rate is what the bond market expects average inflation to be over the next 5 years — a shorter and more policy-relevant window than the 10-year version. It is calculated as the difference between the 5-year Treasury yield and the 5-year TIPS yield. Traders watch this more closely than the 10-year because it reflects near-term Fed credibility.',
    rising: 'Markets expect inflation to persist over the next five years. The Fed cannot cut rates. Bonds sell off. Variable-rate borrowers suffer. This is the number that tells you whether the inflation fight is actually being won.',
    falling: 'The bond market believes inflation is being brought under control. Gives the Fed room to cut rates. Positive for bonds, mortgages, and rate-sensitive stocks like REITs.',
    release: 'Daily — calculated from 5-year Treasury and 5-year TIPS market prices.',
    watchLevel: '2% is the target. Above 2.5% means markets see near-term inflation as a real problem — Fed cuts are off the table. Above 3% is an alarm. 3.5% means the bond market has priced in years of elevated inflation and sees no imminent relief.',
    relatedTo: ['T10YIE', 'FEDFUNDS', 'CPIAUCSL', 'DGS5']
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

function renderSparkline(canvasId, history, color, levels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !history?.length) return;
  if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); }

  const ctx = canvas.getContext('2d');
  const values = history.map(h => h.value);
  const labels = history.map(h => h.observation_date);

  const grad = ctx.createLinearGradient(0, 0, 0, 72);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, color + '00');

  // Build threshold line datasets — only those within visible data range
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const range   = dataMax - dataMin || 1;
  const levelDatasets = (levels || [])
    .filter(l => l.value >= dataMin - range * 0.3 && l.value <= dataMax + range * 0.3)
    .map(l => ({
      data: Array(labels.length).fill(l.value),
      borderColor: l.color === 'red' ? 'rgba(248,113,113,0.55)' : l.color === 'amber' ? 'rgba(251,191,36,0.55)' : 'rgba(74,222,128,0.45)',
      borderWidth: 1,
      borderDash: [4, 3],
      pointRadius: 0,
      fill: false,
      tension: 0,
    }));

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { data: values, borderColor: color, borderWidth: 2,
          backgroundColor: grad, pointRadius: 0, tension: 0.35, fill: true },
        ...levelDatasets
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a', titleColor: '#94a3b8',
          bodyColor: '#f1f5f9', padding: 10, borderWidth: 0,
          callbacks: { label: ctx => ctx.datasetIndex === 0 ? `${fmt(ctx.parsed.y)} (${labels[ctx.dataIndex]})` : null }
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
        ${(meta.levels||[]).length ? `<div class="ind-levels">${(meta.levels).map(l =>
          `<div class="ind-level ind-level-${l.color}"><span class="ind-level-val">${l.value}${suffix}</span><span class="ind-level-txt">${l.label}</span></div>`
        ).join('')}</div>` : ''}
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    for (const id of order) {
      const hist = history?.[id] || [];
      if (hist.length > 1) renderSparkline(`chart-${id}`, hist, IND_META[id]?.color || '#64748b', IND_META[id]?.levels);
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
    renderVoices(d.voices || []);
    renderInfluencerPulse(d.influencer_pulse || null);
    renderCuratedNews(d.curated_news || []);
    renderMarkets(d.market || []);
    renderMarketSnapshot(d.market || []);
    renderKeyLevels(d.market || []);
    renderIndicators(d.indicators || [], d.history || {});

  } catch (err) {
    console.error('Load error:', err);
    const upd = document.getElementById('last-updated');
    if (upd) upd.textContent = 'Error loading — retrying...';
  }
}

load();
setInterval(load, 5 * 60 * 1000);

// ── Live market snapshot (polls every 60s from Yahoo Finance) ─
async function liveMarketPoll() {
  try {
    const r = await fetch('/api/market-live');
    if (!r.ok) return;
    const data = await r.json();
    if (data.length) {
      renderMarketSnapshot(data);
      renderKeyLevels(data);
    }
  } catch {}
}
liveMarketPoll();
setInterval(liveMarketPoll, 60000);

// ── Treasury yield curve ───────────────────────────────────────
async function renderYieldCurve() {
  const el = document.getElementById('yield-curve-grid');
  if (!el) return;
  try {
    const r = await fetch('/api/yields');
    if (!r.ok) throw new Error('failed');
    const yields = await r.json();
    if (!yields.length) throw new Error('empty');

    const groups = { 'T-Bill': [], 'T-Note': [], 'T-Bond': [] };
    yields.forEach(y => { if (groups[y.group]) groups[y.group].push(y); });

    const labels = {
      'T-Bill': 'Treasury Bills — Short-Term (under 1 year)',
      'T-Note': 'Treasury Notes — Medium-Term (2–10 years)',
      'T-Bond': 'Treasury Bonds — Long-Term (20–30 years)',
    };
    const descs = {
      'T-Bill': 'Track the Fed funds rate closely. The benchmark for money market funds and short-term cash.',
      'T-Note': 'The 10-Yr is the most important rate in the world — it sets 30-yr mortgage rates and prices all risk assets against it.',
      'T-Bond': 'Sensitive to long-run inflation expectations. High 30-Yr yields mean markets expect inflation to persist for decades.',
    };

    el.innerHTML = Object.entries(groups).map(([grp, items]) => {
      if (!items.length) return '';
      return `<div class="yield-group">
        <div class="yield-group-name">${labels[grp]}</div>
        <div class="yield-group-desc">${descs[grp]}</div>
        <div class="yield-row">
          ${items.map(y => {
            const cls = y.value >= 5 ? 'yield-high' : y.value >= 4 ? 'yield-mid' : 'yield-low';
            return `<div class="yield-cell">
              <div class="yield-maturity">${y.label}</div>
              <div class="yield-rate ${cls}">${y.value.toFixed(2)}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }).join('');
  } catch {
    if (el) el.innerHTML = '<div class="section-note" style="color:var(--dim)">Yield data unavailable — FRED API key required.</div>';
  }
}
renderYieldCurve();

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

// ── Composite indicator educational context ───────────────────
const COMP_CONTEXT = {
  nfci: {
    name: 'Chicago Fed National Financial Conditions Index',
    subtitle: 'NFCI — weekly composite of 105 financial variables',
    what: 'The NFCI aggregates 105 measures of financial conditions across money markets, debt markets, and equity markets into a single number. Zero is the historical average (neutral). Negative means looser-than-average — credit is cheap and easy to get. Positive means tighter-than-average — credit is expensive or hard to get. Published weekly by the Chicago Fed.',
    rising: 'Financial conditions tightening. Credit spreads widening, lending standards firming, volatility rising. Historically associated with economic slowdown risk. Sustained readings above +0.5 have preceded recessions.',
    falling: 'Financial conditions loosening. Easy credit, low spreads, calm markets. Good for growth but can enable excessive leverage and risk-taking. Below -0.5 is historically very easy.',
    watchLevel: 'Below -0.7: Very loose — historically precedes stable markets but also bubbles. -0.7 to 0: Accommodative — the norm in most expansion periods. 0 to +0.5: Tightening — yellow flag. Above +0.5: Tight — historically associated with credit events and equity drawdowns. Above +1: Crisis conditions.',
    release: 'Weekly — published every Friday by the Federal Reserve Bank of Chicago.',
    relatedTo: ['DGS10', 'VIXCLS', 'FEDFUNDS']
  },
  recprob: {
    name: 'NY Fed Recession Probability Model',
    subtitle: '12-month forward probability from yield curve spread',
    what: 'The NY Fed uses a probit statistical model based on the spread between the 10-year and 3-month Treasury yields to estimate the probability of a US recession in the next 12 months. When short rates exceed long rates (an "inverted yield curve"), lending becomes less profitable for banks, credit contracts, and recession risk rises. This model has signaled every US recession since 1960.',
    rising: 'Yield curve flattening or inverting. Banks less willing to lend. Credit growth slowing. Historically, readings above 30% have preceded recessions within 12 months in nearly every case.',
    falling: 'Yield curve steepening — long rates rising above short rates, or the Fed cutting short rates. Historically, once this probability peaks and falls from above 30%, the economy either is already in recession or narrowly avoided one.',
    watchLevel: 'Below 15%: Low risk from yield curve alone. 15–25%: Moderate concern. 25–30%: Warning zone — monitor closely. Above 30%: High-confidence recession signal. Historical record: 7 of 8 yield curve inversions since 1968 led to recessions within 12–18 months.',
    release: 'Monthly — updated with each new Treasury yield data release.',
    relatedTo: ['DGS10', 'DGS2', 'FEDFUNDS', 'GDP']
  },
  gdpnow: {
    name: 'Atlanta Fed GDPNow',
    subtitle: 'Real-time running estimate of current-quarter GDP growth',
    what: 'GDPNow is a "nowcast" — a real-time estimate of current-quarter GDP growth updated continuously as new economic data arrives. It uses the same methodology as the Bureau of Economic Analysis (BEA), incorporating retail sales, factory orders, jobs, trade, and housing data. It is not a forecast — it is a model estimate of what GDP would show if the quarter ended today.',
    rising: 'Incoming economic data is coming in above expectations. Consumer spending, business investment, or exports strengthening. A rising GDPNow is broadly positive for equities.',
    falling: 'Economic data surprising to the downside. Slowdown in spending, production, or trade. A rapidly declining GDPNow is the earliest warning system for a growth scare — it moves months before the official BEA GDP release.',
    watchLevel: 'Above 3%: Strong growth, economy above trend. 2–3%: Healthy expansion. 1–2%: Slowing but not alarming. 0–1%: Stall speed — vulnerable to any external shock. Negative: Contraction. Two consecutive quarters of negative GDP = formal recession.',
    release: 'Updated 2–3 times per week as new data arrives. Official BEA GDP estimate comes quarterly with a 30-day lag.',
    relatedTo: ['UNRATE', 'FEDFUNDS', 'GDP', 'CPIAUCSL']
  },
  bb: {
    name: 'BofA Bull & Bear Indicator',
    subtitle: '18-input sentiment model — 0 (extreme fear) to 10 (extreme greed)',
    what: 'Bank of America\'s Bull & Bear indicator synthesizes 18 inputs including fund flows, investor positioning, breadth measures, and sentiment surveys into a 0–10 score. It is a contrarian indicator: extreme readings predict reversals. Zero = maximum bearishness (everyone positioned defensively). Ten = maximum bullishness (everyone positioned aggressively).',
    rising: 'Increasing bullishness — investors moving into risk assets, positioning getting crowded long. A rise toward 8+ is a contrarian sell signal: when everyone is bullish, there are few buyers left. High readings are historically dangerous.',
    falling: 'Increasing bearishness — investors selling, positioning getting defensive. A fall toward 2 or below is a contrarian buy signal: when everyone is scared and sold out, the only direction is up. The best buying opportunities in history have occurred at maximum fear.',
    watchLevel: 'Below 2.0: BofA\'s formal "buy signal" — capitulation, maximum fear. 2–4: Bearish. 4–6: Neutral. 6–8: Moderately bullish — caution warranted. Above 8.0: BofA\'s formal "sell signal" — extreme greed, crowded positioning, risk of sharp correction.',
    release: 'Weekly — published in BofA\'s Global Fund Manager Survey and weekly research note.',
    relatedTo: ['VIXCLS', 'DGS10']
  }
};

function openCompDrawer(id) {
  const ctx = COMP_CONTEXT[id];
  if (!ctx) return;
  openInfoDrawer(ctx.name, ctx.subtitle, ctx, ctx.relatedTo || []);
}

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

  const narrativeEl = document.getElementById('exp-narrative');
  if (narrativeEl) narrativeEl.textContent = expBuildNarrative(v, fedSig, curveSig);

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

function expBuildNarrative(v, fedSig, curveSig) {
  if (v.cpi > 5 && v.unemp > 5.5)
    return `The economy is in stagflation territory — ${v.cpi.toFixed(1)}% inflation running alongside ${v.unemp.toFixed(1)}% unemployment. The Fed faces an impossible choice: hike to fight inflation and deepen job losses, or hold/cut to protect employment and let prices run hotter. Both paths inflict pain. There is no clean exit.`;
  if (v.unemp > 8)
    return `Unemployment at ${v.unemp.toFixed(1)}% signals a hard recession. Consumer spending is collapsing, corporate earnings will follow, and the Fed is likely cutting aggressively. The risk is a deflationary spiral if rate cuts come too slowly or the transmission mechanism is broken.`;
  if (v.oil > 140)
    return `Oil at $${Math.round(v.oil)}/bbl is a tax on the entire economy. Every $10 move in crude adds roughly 25–30bp to headline CPI within 6 months. At this level, consumer discretionary spending is being squeezed, transport costs are spiking, and second-round effects into food prices are already in motion.`;
  if (v.cpi > 6)
    return `Inflation at ${v.cpi.toFixed(1)}% is well above target and at risk of becoming embedded in wage expectations. The Fed will likely need to hold rates higher for longer. Mortgage rates near ${(v.yield10 + 2.46).toFixed(2)}% are effectively shutting out first-time buyers and slowing the housing market sharply.`;
  if (v.fedrate > 6)
    return `Fed funds at ${v.fedrate.toFixed(2)}% is in territory last seen in 2007. Credit is tightening for businesses and consumers. The housing market is effectively frozen. Rate hikes take 12–18 months to fully transmit — the pain from today's settings may not show up in unemployment or GDP for another year.`;
  if (v.unemp < 3.5 && v.cpi < 3)
    return `Near-full employment with contained inflation — textbook soft landing. The Fed has room to hold or nudge rates lower. Equity valuations are stretched but supported by earnings. The main risk: any external shock (energy, geopolitics, credit event) tips a fragile equilibrium.`;
  if (v.sp500 < 4000)
    return `The S&P at ${v.sp500.toLocaleString()} reflects significant multiple compression. Bear market conditions historically precede Fed easing cycles by 6–12 months. Credit spreads typically widen before equities bottom — watch HYG as the leading signal. Capitulation usually requires retail panic, not just institutional selling.`;
  const spread = (v.yield10 - v.fedrate).toFixed(2);
  return `Fed funds at ${v.fedrate.toFixed(2)}% vs. 10-year yield at ${v.yield10.toFixed(2)}% gives a ${Number(spread) > 0 ? '+' : ''}${spread}pp spread — ${curveSig.split(' —')[0].toLowerCase()}. With CPI at ${v.cpi.toFixed(1)}% and unemployment at ${v.unemp.toFixed(1)}%, the most likely Fed path is ${fedSig.split(' —')[0].toLowerCase()}. Oil at $${Math.round(v.oil)}/bbl remains the key exogenous variable to watch.`;
}

// Bind sliders
['exp-s-fedrate','exp-s-cpi','exp-s-unemp','exp-s-yield','exp-s-oil','exp-s-sp500'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', expUpdateSim);
});

// ── Dr. Webb Chat ──────────────────────────────────────────────
let webbMessages     = [];
let webbContext      = null;
let webbPending      = false;
let webbPendingImage = null;

const WEBB_STORAGE_KEY = 'webb_memory_v1';
const WEBB_MAX_STORED  = 10; // last 5 exchanges (user + assistant each)

function webbSaveMemory() {
  try {
    // Strip image binary data before storing (too large for localStorage)
    const safe = webbMessages.slice(-WEBB_MAX_STORED).map(m => {
      if (typeof m.content === 'string') return m;
      const text = m.content.find(b => b.type === 'text')?.text || '(sent a screenshot)';
      return { role: m.role, content: text };
    });
    localStorage.setItem(WEBB_STORAGE_KEY, JSON.stringify(safe));
  } catch {}
}

function webbClearMemory() {
  try { localStorage.removeItem(WEBB_STORAGE_KEY); } catch {}
  webbMessages = [];
  const el = document.getElementById('webb-messages');
  if (el) el.innerHTML = '<div class="webb-msg webb-msg-assistant"><div class="webb-msg-text">Memory cleared. Fresh start — what do you want to understand?</div></div>';
}

// Restore previous conversation from localStorage on page load
(function webbRestoreMemory() {
  try {
    const raw = localStorage.getItem(WEBB_STORAGE_KEY);
    if (!raw) return;
    const msgs = JSON.parse(raw);
    if (!msgs?.length) return;
    webbMessages = msgs;
    const el = document.getElementById('webb-messages');
    if (!el) return;
    el.innerHTML = '';
    msgs.forEach(m => webbAddMsg(m.role, typeof m.content === 'string' ? m.content : '(screenshot)'));
    const count = Math.floor(msgs.filter(m => m.role === 'user').length);
    const sep = document.createElement('div');
    sep.className = 'webb-memory-sep';
    sep.textContent = `— ${count} previous exchange${count !== 1 ? 's' : ''} remembered —`;
    el.appendChild(sep);
    el.scrollTop = el.scrollHeight;
  } catch {}
})();

function webbReadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const [header, b64] = dataUrl.split(',');
    const mediaType = header.match(/:(.*?);/)[1];
    webbPendingImage = { data: b64, mediaType, dataUrl };
    const preview = document.getElementById('webb-img-preview');
    const img = document.getElementById('webb-img-preview-img');
    if (preview && img) { img.src = dataUrl; preview.style.display = 'flex'; }
  };
  reader.readAsDataURL(file);
}

function webbHandleFileInput(input) {
  if (input.files?.[0]) webbReadImage(input.files[0]);
}

function webbClearImage() {
  webbPendingImage = null;
  const preview = document.getElementById('webb-img-preview');
  const img = document.getElementById('webb-img-preview-img');
  const fileInput = document.getElementById('webb-img-input');
  if (preview) preview.style.display = 'none';
  if (img) img.src = '';
  if (fileInput) fileInput.value = '';
}

// Paste screenshot into Webb when drawer is open
document.addEventListener('paste', e => {
  if (!document.getElementById('webb-drawer')?.classList.contains('open')) return;
  const items = Array.from(e.clipboardData?.items || []);
  const imgItem = items.find(i => i.type.startsWith('image/'));
  if (imgItem) { e.preventDefault(); webbReadImage(imgItem.getAsFile()); }
});

function webbOpen(ctx) {
  if (ctx) {
    webbContext = ctx;
    const bar = document.getElementById('webb-context-bar');
    if (bar) {
      bar.style.display = 'flex';
      bar.innerHTML = `<span>Context: ${ctx.substring(0,80)}${ctx.length>80?'…':''}</span><button class="webb-context-clear" onclick="webbClearContext()">✕</button>`;
    }
  }
  document.getElementById('webb-drawer')?.classList.add('open');
  document.getElementById('webb-overlay')?.classList.add('open');
  document.getElementById('webb-btn')?.style.setProperty('display','none');
  setTimeout(() => document.getElementById('webb-input')?.focus(), 300);
}

function webbClose() {
  document.getElementById('webb-drawer')?.classList.remove('open');
  document.getElementById('webb-overlay')?.classList.remove('open');
  document.getElementById('webb-btn')?.style.removeProperty('display');
}

function webbClearContext() {
  webbContext = null;
  const bar = document.getElementById('webb-context-bar');
  if (bar) bar.style.display = 'none';
}

function webbAddMsg(role, text, imgDataUrl) {
  const el = document.getElementById('webb-messages');
  if (!el) return;
  const div = document.createElement('div');
  div.className = `webb-msg webb-msg-${role}`;
  const imgHtml = imgDataUrl ? `<img class="webb-msg-img" src="${imgDataUrl}" alt="screenshot">` : '';
  div.innerHTML = `${imgHtml}<div class="webb-msg-text">${text.replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function buildDashboardSnapshot() {
  const lines = [`Live dashboard snapshot (${new Date().toLocaleTimeString()}):`];

  const snapCards = document.querySelectorAll('#market-snapshot .snapshot-card');
  if (snapCards.length) {
    lines.push('Market levels:');
    snapCards.forEach(card => {
      const label = card.querySelector('.snapshot-label')?.textContent?.trim();
      const value = card.querySelector('.snapshot-value')?.textContent?.trim();
      const chg   = card.querySelector('.snapshot-change')?.textContent?.trim();
      if (label && value) lines.push(`  ${label}: ${value}${chg ? ' ' + chg : ''}`);
    });
  }

  const indCards = document.querySelectorAll('#indicators-grid .ind-card');
  if (indCards.length) {
    lines.push('Economic indicators:');
    indCards.forEach(card => {
      const name  = card.querySelector('.ind-name')?.textContent?.trim();
      const value = card.querySelector('.ind-value')?.textContent?.trim();
      const unit  = card.querySelector('.ind-unit')?.textContent?.trim();
      if (name && value) lines.push(`  ${name}: ${value}${unit || ''}`);
    });
  }

  return lines.join('\n');
}

async function webbSend() {
  if (webbPending) return;
  const input = document.getElementById('webb-input');
  const text  = input?.value.trim();
  if (!text && !webbPendingImage) return;

  input.value = '';
  const img = webbPendingImage;
  webbClearImage();

  // Build message content: multimodal if image present, plain string otherwise
  const displayText = text || '(screenshot)';
  let msgContent;
  if (img) {
    msgContent = [
      { type: 'image', data: img.data, mediaType: img.mediaType },
      { type: 'text', text: text || 'What do you see in this screenshot and what does it tell you about the current market situation?' }
    ];
  } else {
    msgContent = text;
  }

  webbMessages.push({ role: 'user', content: msgContent });
  webbAddMsg('user', displayText, img?.dataUrl);

  webbPending = true;
  document.getElementById('webb-send').disabled = true;

  const thinking = document.createElement('div');
  thinking.className = 'webb-msg webb-msg-assistant';
  thinking.innerHTML = '<div class="webb-msg-text webb-msg-thinking">Dr. Webb is thinking…</div>';
  document.getElementById('webb-messages').appendChild(thinking);
  document.getElementById('webb-messages').scrollTop = 99999;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: webbMessages, context: [buildDashboardSnapshot(), webbContext].filter(Boolean).join('\n\n') || null })
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.status);
      throw new Error(`HTTP ${res.status}: ${err}`);
    }
    const data = await res.json();
    thinking.remove();
    const reply = data.reply || 'No response.';
    webbMessages.push({ role: 'assistant', content: reply });
    webbAddMsg('assistant', reply);
    webbSaveMemory();
  } catch (e) {
    console.error('Webb chat error:', e.message);
    thinking.remove();
    webbAddMsg('assistant', `Connection error (${e.message}) — try again.`);
  }

  webbPending = false;
  document.getElementById('webb-send').disabled = false;
  document.getElementById('webb-input')?.focus();
}

// Enter key sends (Shift+Enter for newline)
document.getElementById('webb-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); webbSend(); }
});
