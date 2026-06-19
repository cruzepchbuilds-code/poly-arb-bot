import { readFileSync } from "fs";

export function analyzeTrades(logFile = "trades.jsonl") {
  let raw = "";
  try {
    raw = readFileSync(logFile, "utf8").trim();
  } catch {
    return null;
  }
  if (!raw) return null;

  const lines = raw.split("\n");
  const trades = [];
  for (const line of lines) {
    try {
      const t = JSON.parse(line);
      trades.push(t);
    } catch { /* skip bad lines */ }
  }
  if (trades.length === 0) return null;

  const resolved = trades.filter(t => t.won === true || t.won === false);
  if (resolved.length === 0) return null;

  // Overall stats
  const totalPnl = resolved.reduce((s, t) => s + ((t.payout ?? 0) - (t.totalSpent ?? 0)), 0);
  const wins = resolved.filter(t => t.won === true).length;
  const winRate = wins / resolved.length;
  const avgBet = resolved.reduce((s, t) => s + (t.totalSpent ?? 0), 0) / resolved.length;
  const avgPayout = resolved.reduce((s, t) => s + (t.payout ?? 0), 0) / resolved.length;

  // Recent win rate (last 20 resolved)
  const recent20 = resolved.slice(-20);
  const recentWins = recent20.filter(t => t.won === true).length;
  const recentWinRate = recent20.length > 0 ? recentWins / recent20.length : null;

  // By strategy
  const byStrategy = {};
  for (const t of resolved) {
    const key = t.strategy ?? "UNKNOWN";
    if (!byStrategy[key]) byStrategy[key] = { wins: 0, losses: 0, pnl: 0, entrySum: 0, entryCount: 0 };
    const b = byStrategy[key];
    if (t.won === true) b.wins++;
    else b.losses++;
    b.pnl += (t.payout ?? 0) - (t.totalSpent ?? 0);
    if (t.entryPrice != null) { b.entrySum += t.entryPrice; b.entryCount++; }
  }
  for (const key of Object.keys(byStrategy)) {
    const b = byStrategy[key];
    const total = b.wins + b.losses;
    b.winRate = total > 0 ? b.wins / total : null;
    b.avgEntry = b.entryCount > 0 ? b.entrySum / b.entryCount : null;
    delete b.entrySum;
    delete b.entryCount;
  }

  // By asset
  const byAsset = {};
  for (const t of resolved) {
    const key = t.asset ?? "UNKNOWN";
    if (!byAsset[key]) byAsset[key] = { wins: 0, losses: 0, pnl: 0 };
    const b = byAsset[key];
    if (t.won === true) b.wins++;
    else b.losses++;
    b.pnl += (t.payout ?? 0) - (t.totalSpent ?? 0);
  }
  for (const key of Object.keys(byAsset)) {
    const b = byAsset[key];
    const total = b.wins + b.losses;
    b.winRate = total > 0 ? b.wins / total : null;
  }

  // Price buckets: [0-30¢, 30-40¢, 40-50¢, 50-60¢, 60-70¢, 70-85¢]
  const priceBucketDefs = [
    { label: "0–30¢",  min: 0,    max: 0.30 },
    { label: "30–40¢", min: 0.30, max: 0.40 },
    { label: "40–50¢", min: 0.40, max: 0.50 },
    { label: "50–60¢", min: 0.50, max: 0.60 },
    { label: "60–70¢", min: 0.60, max: 0.70 },
    { label: "70–85¢", min: 0.70, max: 0.85 },
  ];
  const priceBuckets = {};
  for (const def of priceBucketDefs) {
    priceBuckets[def.label] = { wins: 0, losses: 0, winRate: null };
  }
  for (const t of resolved) {
    if (t.entryPrice == null) continue;
    const def = priceBucketDefs.find(d => t.entryPrice >= d.min && t.entryPrice < d.max);
    if (!def) continue;
    const b = priceBuckets[def.label];
    if (t.won === true) b.wins++;
    else b.losses++;
  }
  for (const b of Object.values(priceBuckets)) {
    const total = b.wins + b.losses;
    b.winRate = total > 0 ? b.wins / total : null;
  }

  // Time buckets: [0-60s, 60-120s, 120-180s, 180-240s, 240s+]
  const timeBucketDefs = [
    { label: "0–60s",   min: 0,   max: 60  },
    { label: "60–120s", min: 60,  max: 120 },
    { label: "120–180s",min: 120, max: 180 },
    { label: "180–240s",min: 180, max: 240 },
    { label: "240s+",   min: 240, max: Infinity },
  ];
  const timeBuckets = {};
  for (const def of timeBucketDefs) {
    timeBuckets[def.label] = { wins: 0, losses: 0, winRate: null };
  }
  for (const t of resolved) {
    if (t.enteredSecsLeft == null) continue;
    const def = timeBucketDefs.find(d => t.enteredSecsLeft >= d.min && t.enteredSecsLeft < d.max);
    if (!def) continue;
    const b = timeBuckets[def.label];
    if (t.won === true) b.wins++;
    else b.losses++;
  }
  for (const b of Object.values(timeBuckets)) {
    const total = b.wins + b.losses;
    b.winRate = total > 0 ? b.wins / total : null;
  }

  // Momentum buckets: [0-0.1%, 0.1-0.3%, 0.3-0.5%, 0.5%+]
  const momentumBucketDefs = [
    { label: "0–0.1%",  min: 0,     max: 0.001 },
    { label: "0.1–0.3%",min: 0.001, max: 0.003 },
    { label: "0.3–0.5%",min: 0.003, max: 0.005 },
    { label: "0.5%+",   min: 0.005, max: Infinity },
  ];
  const momentumBuckets = {};
  for (const def of momentumBucketDefs) {
    momentumBuckets[def.label] = { wins: 0, losses: 0, winRate: null };
  }
  for (const t of resolved) {
    if (t.momentumPct == null) continue;
    const absMom = Math.abs(t.momentumPct);
    const def = momentumBucketDefs.find(d => absMom >= d.min && absMom < d.max);
    if (!def) continue;
    const b = momentumBuckets[def.label];
    if (t.won === true) b.wins++;
    else b.losses++;
  }
  for (const b of Object.values(momentumBuckets)) {
    const total = b.wins + b.losses;
    b.winRate = total > 0 ? b.wins / total : null;
  }

  // Suggestions
  const suggestions = [];
  const MIN_TRADES = 5;

  // Asset suggestions
  for (const [asset, data] of Object.entries(byAsset)) {
    const total = data.wins + data.losses;
    if (total < MIN_TRADES) continue;
    const wr = data.winRate;
    if (wr >= 0.70) {
      suggestions.push(`${asset} win rate ${Math.round(wr * 100)}% (${total} trades) — strong edge`);
    } else if (wr <= 0.40) {
      suggestions.push(`${asset} win rate ${Math.round(wr * 100)}% (${total} trades) — consider reducing bets`);
    }
  }

  // Price bucket suggestions
  for (const [label, data] of Object.entries(priceBuckets)) {
    const total = data.wins + data.losses;
    if (total < MIN_TRADES || data.winRate == null) continue;
    if (data.winRate >= 0.70) {
      suggestions.push(`Entries at ${label} win ${Math.round(data.winRate * 100)}% — prioritize this range`);
    } else if (data.winRate <= 0.35) {
      suggestions.push(`Entries at ${label} win ${Math.round(data.winRate * 100)}% — avoid this range`);
    }
  }

  // Recent vs overall performance
  if (recent20.length >= MIN_TRADES && recentWinRate != null) {
    if (recentWinRate < winRate - 0.10) {
      suggestions.push(
        `Recent win rate ${Math.round(recentWinRate * 100)}% vs overall ${Math.round(winRate * 100)}% — performance declining`
      );
    } else if (recentWinRate > winRate + 0.10) {
      suggestions.push(
        `Recent win rate ${Math.round(recentWinRate * 100)}% vs overall ${Math.round(winRate * 100)}% — performance improving`
      );
    }
  }

  // Strategy suggestions
  for (const [strat, data] of Object.entries(byStrategy)) {
    const total = data.wins + data.losses;
    if (total < MIN_TRADES) continue;
    if (data.winRate >= 0.70) {
      suggestions.push(`${strat} strategy win rate ${Math.round(data.winRate * 100)}% (${total} trades) — strong edge`);
    } else if (data.winRate <= 0.40) {
      suggestions.push(`${strat} strategy win rate ${Math.round(data.winRate * 100)}% (${total} trades) — consider reducing bets`);
    }
  }

  return {
    total:        trades.length,
    resolved:     resolved.length,
    winRate,
    totalPnl,
    avgBet,
    avgPayout,
    recentWinRate,
    byStrategy,
    byAsset,
    priceBuckets,
    timeBuckets,
    momentumBuckets,
    suggestions,
    lastUpdated: Date.now(),
  };
}
