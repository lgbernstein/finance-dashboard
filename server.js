require('dotenv').config();
const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('./db');

// ── Cycle state (prevent double-runs) ────────────────────────
let cycleRunning = false;
let cycleStartedAt = null;

// ── Live market quote helper (Yahoo Finance) ──────────────────
const LIVE_SYMS = ['^GSPC', '^DJI', '^IXIC', 'CL=F', '^VIX', '^TNX'];
let liveCache = null;
let liveCacheAt = 0;

function fetchLiveQuote(symbol) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const meta = JSON.parse(data)?.chart?.result?.[0]?.meta;
          if (!meta) return resolve(null);
          const price = meta.regularMarketPrice ?? meta.previousClose;
          const prev = meta.chartPreviousClose ?? meta.previousClose;
          const chg = prev ? ((price - prev) / prev) * 100 : null;
          resolve({ symbol, value: price, change_pct: chg ? parseFloat(chg.toFixed(2)) : null });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ── FRED yield curve helper ───────────────────────────────────
const YIELD_SERIES = [
  { id:'DGS1MO', label:'1-Mo',  group:'T-Bill' },
  { id:'DGS3MO', label:'3-Mo',  group:'T-Bill' },
  { id:'DGS6MO', label:'6-Mo',  group:'T-Bill' },
  { id:'DGS1',   label:'1-Yr',  group:'T-Bill' },
  { id:'DGS2',   label:'2-Yr',  group:'T-Note' },
  { id:'DGS5',   label:'5-Yr',  group:'T-Note' },
  { id:'DGS7',   label:'7-Yr',  group:'T-Note' },
  { id:'DGS10',  label:'10-Yr', group:'T-Note' },
  { id:'DGS20',  label:'20-Yr', group:'T-Bond' },
  { id:'DGS30',  label:'30-Yr', group:'T-Bond' },
];
let yieldsCache = null;
let yieldsCacheAt = 0;

function fetchFredSeries(id, apiKey) {
  return new Promise((resolve) => {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${apiKey}&limit=5&sort_order=desc&file_type=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const obs = (JSON.parse(data).observations || []).filter(o => o.value !== '.');
          if (!obs.length) return resolve(null);
          resolve({ id, value: parseFloat(obs[0].value), date: obs[0].date });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', (req, res) => {
  try {
    res.json(db.getDashboard());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Manual cycle trigger ──────────────────────────────────────
app.get('/api/cycle-status', (req, res) => {
  res.json({ running: cycleRunning, startedAt: cycleStartedAt });
});

app.post('/api/run-cycle', (req, res) => {
  if (cycleRunning) {
    return res.status(409).json({ error: 'Cycle already running', startedAt: cycleStartedAt });
  }

  cycleRunning = true;
  cycleStartedAt = new Date().toISOString();

  const scriptPath = path.join(__dirname, 'scripts', 'run_cycle.js');
  const proc = spawn('node', [scriptPath], {
    cwd: __dirname,
    env: { ...process.env },
    stdio: 'pipe',
  });

  let output = '';
  proc.stdout.on('data', d => { output += d.toString(); });
  proc.stderr.on('data', d => { output += d.toString(); });

  proc.on('close', (code) => {
    cycleRunning = false;
    cycleStartedAt = null;
    if (code !== 0) {
      console.error(`[run-cycle] exited with code ${code}\n${output}`);
    } else {
      console.log(`[run-cycle] completed successfully`);
    }
  });

  proc.on('error', (err) => {
    cycleRunning = false;
    cycleStartedAt = null;
    console.error(`[run-cycle] spawn error: ${err.message}`);
  });

  // Respond immediately — cycle runs in background
  res.json({ ok: true, startedAt: cycleStartedAt });
});

app.get('/api/approvals', (req, res) => {
  try {
    res.json(db.getPendingApprovals());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/approvals/:id/decide', (req, res) => {
  const { decision } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve or reject' });
  }
  try {
    db.resolveApproval(req.params.id, decision);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  try {
    db.resolveAlert(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const systemPrompt = `You are Dr. Marcus Webb. PhD in international economics and geopolitics from Georgetown University. 22 years as a macro trader — Goldman Sachs, Bridgewater Associates, and your own fund for the last 8 years.

You think in transmission mechanisms: how geopolitical events move through supply chains, currencies, bond markets, and into equity prices. You have seen things go wrong that textbooks don't cover — the 1998 LTCM collapse, the 2008 credit crisis, the 2020 oil shock, the 2022 bond rout.

Your user is Larry Bernstein — 68, retired physician, intelligent but not a finance professional. He holds a mix of stocks and bonds in retirement accounts. He wants to understand what is actually happening, not platitudes.

Rules:
- Talk like a trusted friend with 22 years of trading experience. Not a disclaimer machine.
- When asked about a news item, immediately trace: event → mechanism → bond impact → equity impact → what it means for Larry's portfolio.
- Be specific about numbers when you know them. Be honest when you don't.
- Keep responses to 3-6 sentences unless the question genuinely requires more.
- Never say "it depends" without immediately saying what it depends on and what each outcome means.
- No bullet lists in responses. Write prose like you're talking across a desk.
- Never give explicit buy/sell advice but absolutely do say "this is a bad environment for X" or "Y is what I'd be watching."`;

    // Transform image blocks to Anthropic multimodal format
    function toAnthropicContent(content) {
      if (typeof content === 'string') return content;
      return content.map(block => {
        if (block.type === 'image') {
          return { type: 'image', source: { type: 'base64', media_type: block.mediaType, data: block.data } };
        }
        return { type: 'text', text: block.text || '' };
      });
    }

    let apiMessages = messages.map(m => ({ role: m.role, content: toAnthropicContent(m.content) }));
    if (context) {
      apiMessages = [
        { role: 'user', content: `Here is current context from my dashboard: ${context}` },
        { role: 'assistant', content: 'Got it — I have the current market context. What do you want to know?' },
        ...apiMessages
      ];
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

app.get('/api/market-live', async (req, res) => {
  if (liveCache && Date.now() - liveCacheAt < 30000)
    return res.json(liveCache);
  try {
    const results = await Promise.all(LIVE_SYMS.map(fetchLiveQuote));
    liveCache = results.filter(Boolean);
    liveCacheAt = Date.now();
    res.json(liveCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/yields', async (req, res) => {
  if (yieldsCache && Date.now() - yieldsCacheAt < 4 * 3600 * 1000)
    return res.json(yieldsCache);
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return res.status(400).json({ error: 'FRED_API_KEY not configured' });
  try {
    const results = await Promise.all(YIELD_SERIES.map(s =>
      fetchFredSeries(s.id, apiKey).then(r => r ? { ...s, value: r.value, date: r.date } : null)
    ));
    yieldsCache = results.filter(Boolean);
    yieldsCacheAt = Date.now();
    res.json(yieldsCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/daily-snapshot', (req, res) => {
  try {
    const dir   = __dirname;
    const today = new Date().toISOString().slice(0, 10);
    // Try today first, then fall back to most recent available
    const files = fs.readdirSync(dir)
      .filter(f => f.match(/^Daily_Snapshot_\d{4}-\d{2}-\d{2}\.html$/))
      .sort()
      .reverse();
    if (!files.length) return res.status(404).json({ error: 'No snapshot available yet' });
    const file = files.find(f => f.includes(today)) || files[0];
    const html  = fs.readFileSync(path.join(dir, file), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Snapshot-File', file);
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Finance Dashboard running on port ${PORT}`);
});
