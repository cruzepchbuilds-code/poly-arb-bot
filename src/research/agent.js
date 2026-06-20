/**
 * Research Agent — background statistical analysis engine
 * Runs every 30 minutes, produces structured findings saved to findings.jsonl.
 *
 * Exports:
 *   startResearchAgent()   – start the 30-minute interval loop
 *   stopResearchAgent()    – clear the interval
 *   getLatestFindings(n)   – return last n findings (default 20)
 *   getFindings()          – return all in-memory findings
 */

import { readFileSync, appendFileSync } from "fs";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Paths (resolved relative to process CWD, same as logger.js convention)
// ---------------------------------------------------------------------------
const TRADES_FILE   = "trades.jsonl";
const FINDINGS_FILE = "findings.jsonl";

const INTERVAL_MS   = 30 * 60 * 1000; // 30 minutes
const BREAKEVEN_WR  = 0.62;
const DEDUP_WINDOW  = 6 * 60 * 60 * 1000; // 6 hours in ms

// In-memory state
let _findings = [];               // Finding[]
let _intervalId = null;
const _lastSeen = new Map();      // title → Date (dedup map)

// ---------------------------------------------------------------------------
// I/O helpers
// ---------------------------------------------------------------------------

function loadJsonl(path, limit = 0) {
  try {
    const raw = readFileSync(path, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const slice = limit > 0 ? lines.slice(-limit) : lines;
    return slice
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function appendJsonl(path, obj) {
  try {
    appendFileSync(path, JSON.stringify(obj) + "\n");
  } catch { /* ignore write errors in background agent */ }
}

// ---------------------------------------------------------------------------
// Finding factory
// ---------------------------------------------------------------------------

/**
 * @param {"critical"|"warning"|"opportunity"|"info"} severity
 * @param {"strategy"|"asset"|"timing"|"sizing"|"signal"} category
 * @param {string} title
 * @param {string} body
 * @param {{ value: number, comparison: number, delta: number }} metric
 * @returns {object|null}  null if deduplicated
 */
function makeFinding(severity, category, title, body, metric) {
  const now = Date.now();
  const last = _lastSeen.get(title);
  if (last && now - last < DEDUP_WINDOW) return null;

  const finding = {
    id:        randomUUID(),
    severity,
    category,
    title:     title.slice(0, 80),
    body,
    metric,
    createdAt: new Date().toISOString(),
  };

  _lastSeen.set(title, now);
  return finding;
}

// ---------------------------------------------------------------------------
// Trade loading + basic stats helpers
// ---------------------------------------------------------------------------

function loadTrades() {
  return loadJsonl(TRADES_FILE);
}

function resolved(trades) {
  return trades.filter(t => t.won === true || t.won === false);
}

function winRate(trades) {
  if (!trades.length) return null;
  return trades.filter(t => t.won === true).length / trades.length;
}

function pnl(trades) {
  return trades.reduce((s, t) => s + ((t.payout ?? 0) - (t.totalSpent ?? 0)), 0);
}

function totalSpent(trades) {
  return trades.reduce((s, t) => s + (t.totalSpent ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Analysis functions — each returns an array of Finding objects (may be empty)
// ---------------------------------------------------------------------------

/**
 * 1. Per-strategy win rate analysis
 */
function analyzeStrategies(res, overallWR) {
  const byStrat = {};
  for (const t of res) {
    const k = t.strategy ?? "UNKNOWN";
    if (!byStrat[k]) byStrat[k] = [];
    byStrat[k].push(t);
  }

  const out = [];
  for (const [strat, trades] of Object.entries(byStrat)) {
    const n   = trades.length;
    const wr  = winRate(trades);
    if (wr === null) continue;
    const pct = Math.round(wr * 100);

    if (n >= 8 && wr < 0.45) {
      const f = makeFinding(
        "critical", "strategy",
        `${strat} win rate critical: ${pct}% on ${n} trades`,
        `${strat} strategy win rate is ${pct}%, well below the ${Math.round(BREAKEVEN_WR * 100)}% breakeven threshold. ` +
        `With ${n} resolved trades this represents a statistically significant underperformance. ` +
        `Consider pausing or reducing allocation to this strategy.`,
        { value: wr, comparison: BREAKEVEN_WR, delta: +(wr - BREAKEVEN_WR).toFixed(4) }
      );
      if (f) out.push(f);
    } else if (n >= 10 && wr > 0.90) {
      const f = makeFinding(
        "opportunity", "strategy",
        `${strat} win rate exceptionally high: ${pct}% on ${n} trades`,
        `${strat} is winning ${pct}% of ${n} resolved trades, significantly above the ${Math.round(BREAKEVEN_WR * 100)}% breakeven. ` +
        `This is a strong positive signal — consider increasing allocation to this strategy while edge persists.`,
        { value: wr, comparison: BREAKEVEN_WR, delta: +(wr - BREAKEVEN_WR).toFixed(4) }
      );
      if (f) out.push(f);
    }
  }
  return out;
}

/**
 * 2. Per-asset win rate + ROI
 */
function analyzeAssets(res) {
  const byAsset = {};
  for (const t of res) {
    const k = t.asset ?? "UNKNOWN";
    if (!byAsset[k]) byAsset[k] = [];
    byAsset[k].push(t);
  }

  const out = [];
  for (const [asset, trades] of Object.entries(byAsset)) {
    const n   = trades.length;
    const wr  = winRate(trades);
    if (wr === null) continue;
    const pct = Math.round(wr * 100);
    const spent = totalSpent(trades);
    const roi   = spent > 0 ? pnl(trades) / spent : 0;
    const roiPct = Math.round(roi * 1000) / 10; // 1 decimal

    if (n >= 8 && wr < 0.40) {
      const f = makeFinding(
        "warning", "asset",
        `${asset} asset win rate low: ${pct}% on ${n} trades`,
        `${asset} has a win rate of ${pct}% across ${n} resolved trades with ROI of ${roiPct}%. ` +
        `This is below the 40% warning threshold indicating consistent underperformance on this market. ` +
        `Consider filtering or avoiding ${asset} entries.`,
        { value: wr, comparison: 0.40, delta: +(wr - 0.40).toFixed(4) }
      );
      if (f) out.push(f);
    } else if (n >= 10 && wr > 0.85) {
      const f = makeFinding(
        "opportunity", "asset",
        `${asset} asset win rate strong: ${pct}% on ${n} trades`,
        `${asset} is winning ${pct}% of ${n} resolved trades with ROI of ${roiPct}%. ` +
        `This market shows a strong, statistically meaningful edge. ` +
        `Consider prioritising entries on ${asset}.`,
        { value: wr, comparison: 0.85, delta: +(wr - 0.85).toFixed(4) }
      );
      if (f) out.push(f);
    }
  }
  return out;
}

/**
 * 3. Hour-of-day UTC analysis
 */
function analyzeHourOfDay(res, overallWR) {
  const byHour = {};
  for (let h = 0; h < 24; h++) byHour[h] = [];

  for (const t of res) {
    const ts = t.enteredAt ?? t.loggedAt;
    if (!ts) continue;
    const h = new Date(ts).getUTCHours();
    byHour[h].push(t);
  }

  const out = [];
  for (const [hourStr, trades] of Object.entries(byHour)) {
    const n  = trades.length;
    if (n < 3) continue;
    const wr  = winRate(trades);
    if (wr === null) continue;
    const hour = Number(hourStr);
    const pct  = Math.round(wr * 100);

    if (wr > overallWR + 0.15) {
      const f = makeFinding(
        "opportunity", "timing",
        `Hour ${hour}:00 UTC best performing: ${pct}% WR on ${n} trades`,
        `UTC hour ${hour} shows a win rate of ${pct}%, which is ${Math.round((wr - overallWR) * 100)}pp above the overall ${Math.round(overallWR * 100)}% rate across ${n} trades. ` +
        `This time window appears to offer a consistent edge — consider concentrating activity around this hour.`,
        { value: wr, comparison: overallWR, delta: +(wr - overallWR).toFixed(4) }
      );
      if (f) out.push(f);
    } else if (wr < overallWR - 0.15) {
      const f = makeFinding(
        "warning", "timing",
        `Hour ${hour}:00 UTC worst performing: ${pct}% WR on ${n} trades`,
        `UTC hour ${hour} shows a win rate of ${pct}%, which is ${Math.round((overallWR - wr) * 100)}pp below the overall ${Math.round(overallWR * 100)}% rate across ${n} trades. ` +
        `Performance during this window is significantly weaker — consider reducing activity at hour ${hour}.`,
        { value: wr, comparison: overallWR, delta: +(wr - overallWR).toFixed(4) }
      );
      if (f) out.push(f);
    }
  }
  return out;
}

/**
 * 4. Current loss streak
 */
function analyzeLossStreak(res) {
  const out = [];
  // Scan from most recent resolved trade backwards
  let streak = 0;
  for (let i = res.length - 1; i >= 0; i--) {
    if (res[i].won === false) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 5) {
    const f = makeFinding(
      "critical", "strategy",
      `Active loss streak: ${streak} consecutive losses`,
      `The last ${streak} resolved trades have all been losses, indicating a potentially adverse market regime or strategy drift. ` +
      `This streak exceeds the critical threshold of 5. ` +
      `Strongly consider pausing automated entries until the streak breaks.`,
      { value: streak, comparison: 5, delta: streak - 5 }
    );
    if (f) out.push(f);
  } else if (streak >= 3) {
    const f = makeFinding(
      "warning", "strategy",
      `Loss streak warning: ${streak} consecutive losses`,
      `The last ${streak} resolved trades have all been losses. ` +
      `While not yet at critical levels, this streak warrants close monitoring. ` +
      `Review recent market conditions and consider reducing position sizes.`,
      { value: streak, comparison: 3, delta: streak - 3 }
    );
    if (f) out.push(f);
  }
  return out;
}

/**
 * 5. Entry price bucket analysis
 */
function analyzePriceBuckets(res, overallWR) {
  const buckets = [
    { label: "40–50¢", min: 0.40, max: 0.50 },
    { label: "50–60¢", min: 0.50, max: 0.60 },
    { label: "60–70¢", min: 0.60, max: 0.70 },
    { label: "70–85¢", min: 0.70, max: 0.85 },
  ];

  const byBucket = {};
  for (const b of buckets) byBucket[b.label] = [];

  for (const t of res) {
    if (t.entryPrice == null) continue;
    const b = buckets.find(d => t.entryPrice >= d.min && t.entryPrice < d.max);
    if (!b) continue;
    byBucket[b.label].push(t);
  }

  const out = [];
  let best = null;
  let bestWR = -Infinity;

  for (const [label, trades] of Object.entries(byBucket)) {
    if (trades.length < 5) continue;
    const wr = winRate(trades);
    if (wr === null) continue;
    if (wr > bestWR) { bestWR = wr; best = { label, trades, wr }; }
  }

  if (best && best.wr > overallWR + 0.10) {
    const n   = best.trades.length;
    const pct = Math.round(best.wr * 100);
    const f = makeFinding(
      "opportunity", "sizing",
      `Price bucket ${best.label} outperforming: ${pct}% WR on ${n} trades`,
      `Entries in the ${best.label} price range win ${pct}% of ${n} resolved trades, ` +
      `${Math.round((best.wr - overallWR) * 100)}pp above the overall ${Math.round(overallWR * 100)}% rate. ` +
      `Prioritising entries in this price bucket could improve overall performance.`,
      { value: best.wr, comparison: overallWR, delta: +(best.wr - overallWR).toFixed(4) }
    );
    if (f) out.push(f);
  }
  return out;
}

/**
 * 6. UMA vs Binance proxy comparison (ORACLESNIPE)
 */
function analyzeOracleSnipeSignals(res) {
  const snipeTrades = res.filter(t => t.strategy === "ORACLESNIPE");
  if (!snipeTrades.length) return [];

  const umaConfirmed   = snipeTrades.filter(t => t.osUmaConfirmed === true || t.osGrConfirmed === true);
  const proxyOnly      = snipeTrades.filter(t => !t.osUmaConfirmed && !t.osGrConfirmed);

  if (umaConfirmed.length < 5 || proxyOnly.length < 5) return [];

  const umaWR   = winRate(umaConfirmed);
  const proxyWR = winRate(proxyOnly);
  if (umaWR === null || proxyWR === null) return [];

  const out = [];
  if (umaWR - proxyWR > 0.10) {
    const f = makeFinding(
      "info", "signal",
      `ORACLESNIPE: UMA-confirmed trades outperform proxy by ${Math.round((umaWR - proxyWR) * 100)}pp`,
      `UMA/GR-confirmed ORACLESNIPE trades win ${Math.round(umaWR * 100)}% (n=${umaConfirmed.length}) ` +
      `vs ${Math.round(proxyWR * 100)}% for Binance-proxy-only trades (n=${proxyOnly.length}). ` +
      `Prioritising entries with oracle confirmation appears to add meaningful edge.`,
      { value: umaWR, comparison: proxyWR, delta: +(umaWR - proxyWR).toFixed(4) }
    );
    if (f) out.push(f);
  }
  return out;
}

/**
 * 7. OPS carry signal effectiveness
 */
function analyzeOpsCarry(res) {
  const withCarry    = res.filter(t => t.opsCarry === true);
  const withoutCarry = res.filter(t => t.opsCarry === false || t.opsCarry === null || t.opsCarry === undefined);

  if (withCarry.length < 5 || withoutCarry.length < 5) return [];

  const carryWR = winRate(withCarry);
  const baseWR  = winRate(withoutCarry);
  if (carryWR === null || baseWR === null) return [];

  const delta = carryWR - baseWR;
  if (Math.abs(delta) <= 0.08) return [];

  const out = [];
  const severity = delta > 0 ? "opportunity" : "warning";
  const direction = delta > 0 ? "positive" : "negative";
  const f = makeFinding(
    severity, "signal",
    `OPS carry signal has ${direction} impact: ${delta > 0 ? "+" : ""}${Math.round(delta * 100)}pp`,
    `Trades with opsCarry=true win ${Math.round(carryWR * 100)}% (n=${withCarry.length}) ` +
    `vs ${Math.round(baseWR * 100)}% without (n=${withoutCarry.length}). ` +
    `The carry signal appears to be a ${direction} edge indicator worth ${direction === "positive" ? "leaning into" : "filtering against"}.`,
    { value: carryWR, comparison: baseWR, delta: +delta.toFixed(4) }
  );
  if (f) out.push(f);
  return out;
}

/**
 * 8. Today's 24h performance
 */
function analyzeToday(res, overallWR) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const today  = res.filter(t => {
    const ts = t.enteredAt ?? t.loggedAt;
    return ts && new Date(ts).getTime() >= cutoff;
  });
  if (!today.length) return [];

  const n      = today.length;
  const dayWR  = winRate(today);
  const dayPnl = pnl(today);
  const pct    = dayWR !== null ? Math.round(dayWR * 100) : null;
  const out    = [];

  if (dayWR !== null && dayWR > overallWR + 0.05) {
    const f = makeFinding(
      "info", "strategy",
      `Strong 24h performance: ${pct}% WR on ${n} trades today`,
      `In the last 24 hours, ${n} resolved trades achieved a ${pct}% win rate, ` +
      `${Math.round((dayWR - overallWR) * 100)}pp above the all-time ${Math.round(overallWR * 100)}% rate. ` +
      `P&L today: ${dayPnl >= 0 ? "+" : ""}${dayPnl.toFixed(2)}.`,
      { value: dayWR, comparison: overallWR, delta: +(dayWR - overallWR).toFixed(4) }
    );
    if (f) out.push(f);
  }

  if (dayPnl < -20) {
    const f = makeFinding(
      "warning", "strategy",
      `Daily P&L drawdown: ${dayPnl.toFixed(2)} in last 24h`,
      `The last 24 hours produced a net loss of ${dayPnl.toFixed(2)} across ${n} trades ` +
      `(win rate: ${pct !== null ? pct + "%" : "N/A"}). ` +
      `This exceeds the -$20 daily drawdown warning threshold — consider reviewing strategy parameters.`,
      { value: dayPnl, comparison: -20, delta: +(dayPnl - -20).toFixed(4) }
    );
    if (f) out.push(f);
  }

  return out;
}

/**
 * 9. Consecutive win streak
 */
function analyzeWinStreak(res) {
  let streak = 0;
  for (let i = res.length - 1; i >= 0; i--) {
    if (res[i].won === true) {
      streak++;
    } else {
      break;
    }
  }
  if (streak < 5) return [];

  const severity = streak >= 8 ? "opportunity" : "info";
  const f = makeFinding(
    severity, "strategy",
    `Active win streak: ${streak} consecutive wins`,
    `The last ${streak} resolved trades have all been wins, indicating the system is in a high-edge regime. ` +
    `Current strategies and market conditions appear well-aligned. ` +
    `Consider maintaining or modestly increasing allocation while the streak holds.`,
    { value: streak, comparison: 5, delta: streak - 5 }
  );
  return f ? [f] : [];
}

/**
 * 10. Overall momentum — last 30 vs all-time
 */
function analyzeMomentum(res, overallWR) {
  if (res.length < 35) return []; // need enough history to compare meaningfully
  const recent30 = res.slice(-30);
  const recentWR = winRate(recent30);
  if (recentWR === null) return [];

  const delta = recentWR - overallWR;
  if (delta >= -0.10) return []; // not a decline worth flagging

  const f = makeFinding(
    "warning", "strategy",
    `Momentum declining: last-30 WR ${Math.round(recentWR * 100)}% vs all-time ${Math.round(overallWR * 100)}%`,
    `Win rate over the last 30 resolved trades is ${Math.round(recentWR * 100)}%, ` +
    `${Math.round(Math.abs(delta) * 100)}pp below the all-time ${Math.round(overallWR * 100)}% rate. ` +
    `This declining momentum may indicate a regime shift — review strategy conditions.`,
    { value: recentWR, comparison: overallWR, delta: +delta.toFixed(4) }
  );
  return f ? [f] : [];
}

// ---------------------------------------------------------------------------
// Main analysis runner
// ---------------------------------------------------------------------------

function runAnalysis() {
  const trades = loadTrades();
  const res    = resolved(trades);

  if (res.length === 0) return;

  const overallWR = winRate(res);

  const newFindings = [
    ...analyzeStrategies(res, overallWR),
    ...analyzeAssets(res),
    ...analyzeHourOfDay(res, overallWR),
    ...analyzeLossStreak(res),
    ...analyzePriceBuckets(res, overallWR),
    ...analyzeOracleSnipeSignals(res),
    ...analyzeOpsCarry(res),
    ...analyzeToday(res, overallWR),
    ...analyzeWinStreak(res),
    ...analyzeMomentum(res, overallWR),
  ];

  for (const f of newFindings) {
    _findings.push(f);
    appendJsonl(FINDINGS_FILE, f);
  }

  // Keep in-memory cap at 500
  if (_findings.length > 500) {
    _findings = _findings.slice(-500);
  }
}

// ---------------------------------------------------------------------------
// Boot: load existing findings
// ---------------------------------------------------------------------------

function loadExistingFindings() {
  const loaded = loadJsonl(FINDINGS_FILE, 200);
  _findings    = loaded;
  // Rebuild dedup map from loaded findings so we don't re-emit on first run
  for (const f of loaded) {
    if (f.title && f.createdAt) {
      _lastSeen.set(f.title, new Date(f.createdAt).getTime());
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the background analysis agent.
 * Loads existing findings, runs an immediate analysis pass,
 * then schedules a run every 30 minutes.
 */
export function startResearchAgent() {
  if (_intervalId !== null) return; // already running

  loadExistingFindings();
  runAnalysis(); // immediate first pass

  _intervalId = setInterval(runAnalysis, INTERVAL_MS);
  // Allow Node to exit even if this timer is running
  if (_intervalId.unref) _intervalId.unref();
}

/**
 * Stop the background analysis agent.
 */
export function stopResearchAgent() {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

/**
 * Return the most recent n findings (default 20).
 * @param {number} n
 * @returns {object[]}
 */
export function getLatestFindings(n = 20) {
  return _findings.slice(-n);
}

/**
 * Return all in-memory findings.
 * @returns {object[]}
 */
export function getFindings() {
  return _findings.slice();
}
