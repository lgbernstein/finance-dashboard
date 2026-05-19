#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const db = require('../db');
const rss = require('../tools/rss');
const { run: runAgent } = require('../tools/agent_runner');

const MEMORY_DIR = path.join(__dirname, '../shared_memory');
const ALERT_HISTORY_PATH = path.join(MEMORY_DIR, 'alert_history.json');

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function main() {
  console.log(`\n=== Alert Monitor @ ${new Date().toISOString()} ===\n`);

  const history = readJson(ALERT_HISTORY_PATH) || { known_headlines: [], escalated_events: [] };

  // Fetch last 3 hours of news
  console.log('[AlertMonitor] Fetching RSS feeds (last 3 hours)...');
  const { items, gaps } = await rss.fetchAll(3);

  if (gaps.length) console.log('RSS gaps:', gaps);

  // Filter out already-known headlines
  const newItems = items.filter(item => !history.known_headlines.includes(item.title));

  if (!newItems.length) {
    console.log('[AlertMonitor] No new headlines. Nothing to escalate.');
    history.last_scan = new Date().toISOString();
    writeJson(ALERT_HISTORY_PATH, history);
    return;
  }

  console.log(`[AlertMonitor] ${newItems.length} new headlines. Evaluating...`);

  const context = {
    instruction: 'Evaluate these news items against the significance thresholds in your prompt. Return your escalation decision as JSON.',
    news_items: newItems,
    known_headlines: history.known_headlines.slice(-100)
  };

  let result;
  try {
    result = await runAgent('AlertMonitor', context);
  } catch (err) {
    console.error('[AlertMonitor] Agent call failed:', err.message);
    process.exit(1);
  }

  // Update known headlines
  history.known_headlines = [
    ...history.known_headlines,
    ...newItems.map(i => i.title)
  ].slice(-500);
  history.last_scan = new Date().toISOString();

  if (result.escalate && result.alerts?.length) {
    console.log(`[AlertMonitor] Escalating ${result.alerts.length} alert(s)`);
    for (const alert of result.alerts) {
      db.insertAlert(alert.severity, alert.headline, alert.url, alert.why_significant);
      history.escalated_events.push({
        id: alert.id,
        headline: alert.headline,
        escalated_at: new Date().toISOString(),
        resolved: false
      });
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.headline}`);
    }

    // Trigger breaking news cycle if any critical/high alerts
    const urgent = result.alerts.filter(a => ['critical', 'high'].includes(a.severity));
    if (urgent.length) {
      console.log('[AlertMonitor] Triggering breaking news analysis cycle...');
      const { execSync } = require('child_process');
      try {
        execSync(`node ${path.join(__dirname, 'run_cycle.js')} breaking`, { stdio: 'inherit' });
      } catch (e) {
        console.error('[AlertMonitor] Breaking news cycle failed:', e.message);
      }
    }
  } else {
    console.log('[AlertMonitor] No escalation warranted.');
  }

  writeJson(ALERT_HISTORY_PATH, history);
  console.log('\n=== Alert Monitor complete ===');
}

main();
