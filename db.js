const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'finance.sqlite');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS indicator_history (
    series_id TEXT NOT NULL,
    value REAL NOT NULL,
    observation_date TEXT NOT NULL,
    unit TEXT,
    PRIMARY KEY (series_id, observation_date)
  );

  CREATE TABLE IF NOT EXISTS indicators (
    series_id TEXT NOT NULL,
    value REAL NOT NULL,
    observation_date TEXT NOT NULL,
    unit TEXT,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (series_id)
  );

  CREATE TABLE IF NOT EXISTS market_data (
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    change_pct REAL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (symbol)
  );

  CREATE TABLE IF NOT EXISTS news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_at TEXT NOT NULL,
    summary TEXT,
    fetched_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS commentary_panels (
    panel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    bullets TEXT,
    data_points TEXT,
    confidence REAL,
    last_changed TEXT,
    generated_at TEXT NOT NULL,
    PRIMARY KEY (panel_id)
  );

  CREATE TABLE IF NOT EXISTS curated_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    headline TEXT NOT NULL,
    url TEXT,
    source TEXT,
    why_it_matters TEXT,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS voices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    why TEXT,
    snippet TEXT,
    source_title TEXT,
    url TEXT,
    published TEXT,
    plain_english TEXT,
    current_view TEXT,
    generated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    severity TEXT NOT NULL,
    headline TEXT NOT NULL,
    url TEXT,
    why_significant TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pending_approvals (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    action TEXT NOT NULL,
    risk_level TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    decision TEXT
  );

  CREATE TABLE IF NOT EXISTS cycle_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_type TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    gaps TEXT
  );
`);

module.exports = {
  insertIndicatorHistory(items) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO indicator_history (series_id, value, observation_date, unit)
      VALUES (?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      for (const item of items) {
        ins.run(item.series_id, item.value, item.observation_date, item.unit || null);
      }
    });
    tx();
  },

  getIndicatorHistory(seriesId, limit = 24) {
    return db.prepare(`
      SELECT value, observation_date FROM indicator_history
      WHERE series_id = ?
      ORDER BY observation_date DESC LIMIT ?
    `).all(seriesId, limit).reverse();
  },

  upsertIndicator(seriesId, value, observationDate, unit) {
    db.prepare(`
      INSERT INTO indicators (series_id, value, observation_date, unit, fetched_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(series_id) DO UPDATE SET
        value = excluded.value,
        observation_date = excluded.observation_date,
        fetched_at = excluded.fetched_at
    `).run(seriesId, value, observationDate, unit || null, new Date().toISOString());
  },

  upsertMarket(symbol, name, value, changePct) {
    db.prepare(`
      INSERT INTO market_data (symbol, name, value, change_pct, fetched_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(symbol) DO UPDATE SET
        value = excluded.value,
        change_pct = excluded.change_pct,
        fetched_at = excluded.fetched_at
    `).run(symbol, name, value, changePct ?? null, new Date().toISOString());
  },

  replaceNewsItems(items) {
    const del = db.prepare('DELETE FROM news_items');
    const ins = db.prepare(`
      INSERT INTO news_items (source, title, url, published_at, summary, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction(() => {
      del.run();
      for (const item of items) {
        ins.run(item.source, item.title, item.url, item.published_at, item.summary || null, new Date().toISOString());
      }
    });
    tx();
  },

  upsertPanel(panelId, title, body, dataPoints, confidence, lastChanged, bullets) {
    db.prepare(`
      INSERT INTO commentary_panels (panel_id, title, body, bullets, data_points, confidence, last_changed, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(panel_id) DO UPDATE SET
        title = excluded.title,
        body = excluded.body,
        bullets = excluded.bullets,
        data_points = excluded.data_points,
        confidence = excluded.confidence,
        last_changed = excluded.last_changed,
        generated_at = excluded.generated_at
    `).run(
      panelId, title, body,
      bullets ? JSON.stringify(bullets) : null,
      dataPoints ? JSON.stringify(dataPoints) : null,
      confidence ?? null, lastChanged || null,
      new Date().toISOString()
    );
  },

  replaceCuratedNews(items) {
    const del = db.prepare('DELETE FROM curated_news');
    const ins = db.prepare(`
      INSERT INTO curated_news (headline, url, source, why_it_matters, generated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      del.run();
      for (const item of items) {
        ins.run(item.headline, item.url || null, item.source || null, item.why_it_matters || null, now);
      }
    });
    tx();
  },

  insertAlert(severity, headline, url, whySignificant) {
    return db.prepare(`
      INSERT INTO alerts (severity, headline, url, why_significant, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(severity, headline, url || null, whySignificant || null, new Date().toISOString());
  },

  resolveAlert(id) {
    db.prepare(`UPDATE alerts SET resolved_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
  },

  insertApproval(id, agent, action, riskLevel, description) {
    db.prepare(`
      INSERT OR IGNORE INTO pending_approvals (id, agent, action, risk_level, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, agent, action, riskLevel || null, description || null, new Date().toISOString());
  },

  resolveApproval(id, decision) {
    db.prepare(`
      UPDATE pending_approvals SET resolved_at = ?, decision = ? WHERE id = ?
    `).run(new Date().toISOString(), decision, id);
  },

  logCycleStart(cycleType) {
    const result = db.prepare(`
      INSERT INTO cycle_log (cycle_type, status, started_at) VALUES (?, 'running', ?)
    `).run(cycleType, new Date().toISOString());
    return result.lastInsertRowid;
  },

  logCycleEnd(id, status, gaps) {
    db.prepare(`
      UPDATE cycle_log SET status = ?, completed_at = ?, gaps = ? WHERE id = ?
    `).run(status, new Date().toISOString(), gaps ? JSON.stringify(gaps) : null, id);
  },

  getDashboard() {
    const indicators = db.prepare('SELECT * FROM indicators ORDER BY series_id').all();
    const history = {};
    for (const ind of indicators) {
      history[ind.series_id] = db.prepare(`
        SELECT value, observation_date FROM indicator_history
        WHERE series_id = ? ORDER BY observation_date DESC LIMIT 24
      `).all(ind.series_id).reverse();
    }
    return {
      indicators,
      history,
      market: db.prepare('SELECT * FROM market_data ORDER BY symbol').all(),

      news: db.prepare('SELECT * FROM news_items ORDER BY published_at DESC LIMIT 20').all(),
      panels: db.prepare('SELECT * FROM commentary_panels ORDER BY panel_id').all(),
      curated_news: db.prepare('SELECT * FROM curated_news ORDER BY id').all(),
      voices: db.prepare('SELECT * FROM voices ORDER BY name').all(),
      alerts: db.prepare('SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY created_at DESC').all(),
      lastCycle: db.prepare('SELECT * FROM cycle_log ORDER BY id DESC LIMIT 1').get(),
      influencer_pulse: (() => {
        try {
          const p = path.join(__dirname, 'shared_memory', 'influencer_sentiment.json');
          if (!fs.existsSync(p)) return null;
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch { return null; }
      })(),
      latestSignal: (() => {
        try {
          const p = path.join(__dirname, 'shared_memory', 'signal.json');
          if (!fs.existsSync(p)) return null;
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch { return null; }
      })()
    };
  },

  getPendingApprovals() {
    return db.prepare('SELECT * FROM pending_approvals WHERE resolved_at IS NULL ORDER BY created_at DESC').all();
  },

  upsertVoice(id, name, title, why, snippet, sourceTitle, url, published, plainEnglish, currentView) {
    db.prepare(`
      INSERT INTO voices (id, name, title, why, snippet, source_title, url, published, plain_english, current_view, generated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        snippet = excluded.snippet,
        source_title = excluded.source_title,
        url = excluded.url,
        published = excluded.published,
        plain_english = excluded.plain_english,
        current_view = excluded.current_view,
        generated_at = excluded.generated_at
    `).run(id, name, title, why, snippet, sourceTitle, url || null, published || null,
           plainEnglish || null, currentView || null, new Date().toISOString());
  },

  getVoices() {
    return db.prepare('SELECT * FROM voices ORDER BY name').all();
  }
};
