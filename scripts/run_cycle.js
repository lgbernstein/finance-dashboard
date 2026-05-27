#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const db = require('../db');
const fred = require('../tools/fred');
const rss = require('../tools/rss');
const market = require('../tools/market');
const voices = require('../tools/voices');
const { fetchInfluencerContent } = require('../tools/influencerFeed');
const { run: runAgent } = require('../tools/agent_runner');

const MEMORY_DIR = path.join(__dirname, '../shared_memory');
const CACHE_PATH = path.join(MEMORY_DIR, 'data_cache.json');
const BASELINE_PATH = path.join(MEMORY_DIR, 'analyst_baseline.json');

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isCacheStale(cache, sourceKey, maxHours = 4) {
  const last = cache?.[sourceKey]?.last_fetch;
  if (!last) return true;
  return (Date.now() - new Date(last).getTime()) > maxHours * 60 * 60 * 1000;
}

async function gatherData() {
  const cache = readJson(CACHE_PATH) || {};
  const gaps = [];

  // FRED
  let fredData = cache.fred?.data;
  if (isCacheStale(cache, 'fred')) {
    console.log('[Researcher] Fetching FRED data...');
    const result = await fred.fetchAll(process.env.FRED_API_KEY);
    fredData = result.data;
    gaps.push(...result.gaps);
    cache.fred = { last_fetch: new Date().toISOString(), data: fredData };
  } else {
    console.log('[Researcher] Using cached FRED data');
  }

  // Market
  let marketData = cache.market?.data;
  if (isCacheStale(cache, 'market', 1)) {
    console.log('[Researcher] Fetching market data...');
    const result = await market.fetchAll();
    marketData = result.data;
    gaps.push(...result.gaps);
    cache.market = { last_fetch: new Date().toISOString(), data: marketData };
  } else {
    console.log('[Researcher] Using cached market data');
  }

  // RSS
  let newsItems = cache.rss?.items;
  if (isCacheStale(cache, 'rss', 3)) {
    console.log('[Researcher] Fetching RSS feeds...');
    const result = await rss.fetchAll(24);
    newsItems = result.items;
    gaps.push(...result.gaps);
    cache.rss = { last_fetch: new Date().toISOString(), items: newsItems };
  } else {
    console.log('[Researcher] Using cached RSS data');
  }

  // Voices — refresh every 12 hours
  let voicesData = cache.voices?.data;
  if (isCacheStale(cache, 'voices', 12)) {
    console.log('[Researcher] Fetching voices data...');
    const result = await voices.fetchAll();
    voicesData = result.voices;
    gaps.push(...result.gaps);
    cache.voices = { last_fetch: new Date().toISOString(), data: voicesData };
  } else {
    console.log('[Researcher] Using cached voices data');
  }

  // Influencer feeds — refresh every 12 hours
  let influencerData = cache.influencers?.data;
  if (isCacheStale(cache, 'influencers', 12)) {
    console.log('[Researcher] Fetching influencer feeds...');
    const result = await fetchInfluencerContent();
    influencerData = result.items;
    if (result.errors?.length) gaps.push(...result.errors.map(e => `Influencer feed error: ${e.creatorId} (${e.feedType})`));
    cache.influencers = { last_fetch: new Date().toISOString(), data: influencerData };
    writeJson(path.join(MEMORY_DIR, 'influencer_content.json'), result);
  } else {
    console.log('[Researcher] Using cached influencer data');
  }

  writeJson(CACHE_PATH, cache);

  return { fredData, marketData, newsItems, voicesData, influencerData, gaps };
}

async function runAnalyst(fredData, marketData, newsItems, voicesData, influencerData) {
  const baseline = readJson(BASELINE_PATH) || {};
  const previousSignal = readJson(path.join(MEMORY_DIR, 'signal.json')) || null;

  // Strip history arrays — analyst needs current values only, not 24mo of data
  const fredSummary = {};
  for (const [id, item] of Object.entries(fredData || {})) {
    fredSummary[id] = { value: item.value, observation_date: item.observation_date, unit: item.unit };
  }

  const context = {
    instruction: 'Generate commentary panels for the Finance Dashboard based on the data below.',
    fred_data: fredSummary,
    market_data: marketData,
    top_news: (newsItems || []).slice(0, 8),
    voices_data: (voicesData || []).map(v => ({
      ...v,
      snippet: (v.snippet || '').replace(/["""]/g, "'").replace(/['']/g, "'").replace(/[\x00-\x1F]/g, ' ').trim()
    })),
    previous_baseline: baseline.key_levels || {},
    dominant_narrative: baseline.dominant_narrative || null,
    influencer_content: (influencerData || []).slice(0, 30),
    previous_signal: previousSignal
      ? { score: previousSignal.score, stance: previousSignal.stance, generated_at: previousSignal.generated_at }
      : null
  };

  console.log('[Analyst] Calling Claude API...');
  return runAgent('Analyst', context);
}

async function main() {
  const cycleType = process.argv[2] === 'breaking' ? 'breaking_news' : 'daily';
  console.log(`\n=== Finance Dashboard Cycle: ${cycleType} @ ${new Date().toISOString()} ===\n`);

  const cycleId = db.logCycleStart(cycleType);

  try {
    // Researcher phase
    const { fredData, marketData, newsItems, voicesData, influencerData, gaps } = await gatherData();

    // Write raw data to DB
    const historyItems = [];
    for (const [id, item] of Object.entries(fredData || {})) {
      db.upsertIndicator(id, item.value, item.observation_date, item.unit);
      if (item.history) historyItems.push(...item.history);
    }
    if (historyItems.length) db.insertIndicatorHistory(historyItems);
    for (const [sym, item] of Object.entries(marketData || {})) {
      db.upsertMarket(sym, item.name, item.value, item.change_pct);
    }
    if (newsItems?.length) db.replaceNewsItems(newsItems);

    // Analyst phase
    const analysis = await runAnalyst(fredData, marketData, newsItems, voicesData, influencerData);

    // Write commentary panels to DB
    for (const panel of analysis.panels || []) {
      const body = panel.full_body || panel.body || '';
      if (!panel.id || !panel.title) continue;
      db.upsertPanel(
        panel.id, panel.title, body,
        panel.data_points, panel.confidence, panel.last_changed, panel.bullets
      );
    }

    // Store causation chain
    if (analysis.causation_chain_structured) {
      const chain = analysis.causation_chain_structured;
      db.upsertPanel(
        'causation_chain', 'Causation Chain',
        chain.trigger + '\n\n' + (chain.steps || []).join('\n') + '\n\n' + chain.outcome,
        JSON.stringify(chain), null, null, null
      );
    }

    // Store AI-curated news
    if (analysis.curated_news?.length) {
      db.replaceCuratedNews(analysis.curated_news);
    }

    // Store voice interpretations
    if (analysis.voices?.length) {
      for (const v of analysis.voices) {
        db.upsertVoice(
          v.id, v.name, v.title, v.why,
          v.snippet, v.source_title, v.url, v.published,
          v.plain_english, v.current_view
        );
      }
    }

    // Store influencer pulse sentiment
    if (analysis.influencer_pulse) {
      writeJson(
        path.join(MEMORY_DIR, 'influencer_sentiment.json'),
        { ...analysis.influencer_pulse, generated_at: new Date().toISOString() }
      );
    }

    // Store signal
    if (analysis.signal) {
      const signalRecord = { ...analysis.signal, generated_at: new Date().toISOString() };
      writeJson(path.join(MEMORY_DIR, 'signal.json'), signalRecord);
      fs.appendFileSync(
        path.join(MEMORY_DIR, 'signal_history.jsonl'),
        JSON.stringify(signalRecord) + '\n'
      );
      console.log(`[Analyst] Signal: ${analysis.signal.score} / ${analysis.signal.stance}`);
    }

    // Update analyst baseline
    const baseline = readJson(BASELINE_PATH) || {};
    const newLevels = {};
    for (const [id, item] of Object.entries(fredData || {})) {
      newLevels[id] = item.value;
    }
    for (const [sym, item] of Object.entries(marketData || {})) {
      newLevels[sym] = item.value;
    }
    baseline.last_updated = new Date().toISOString();
    baseline.key_levels = newLevels;
    baseline.dominant_narrative = analysis.panels?.[0]?.body || baseline.dominant_narrative;
    writeJson(BASELINE_PATH, baseline);

    // Log task history
    const historyPath = path.join(MEMORY_DIR, 'task_history.jsonl');
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      cycle_type: cycleType,
      status: 'success',
      panels: (analysis.panels || []).map(p => p.id),
      gaps
    });
    fs.appendFileSync(historyPath, entry + '\n');

    db.logCycleEnd(cycleId, 'success', gaps);
    console.log('\n=== Cycle complete ===');
    if (gaps.length) console.log('Gaps:', gaps);

  } catch (err) {
    console.error('\n[ERROR]', err.message);
    db.logCycleEnd(cycleId, 'failed', [err.message]);
    process.exit(1);
  }
}

main();
