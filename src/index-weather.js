/**
 * Polymarket Weather Trading Bot
 *
 * Strategy (based on documented profitable wallets — gopfan2 $352K, ColdMath $135K):
 *   1. Discover active temperature markets via Gamma API
 *   2. Fetch 31-member GFS ensemble from Open-Meteo (free, no key)
 *   3. Compute model probability for each market's temperature threshold
 *   4. Enter when edge > 8% using fractional Kelly sizing (0.25×)
 *   5. Prioritize secondary cities (Buenos Aires, Cape Town, Atlanta, Dallas)
 *      where repricing windows stay open hours vs. 5-15 min in NYC/London
 *
 * Runs in paper mode by default. Set LIVE_MODE=true + wallet env vars for live.
 */

import { fetchWeatherMarkets, refreshMarketPrices } from "./weather/markets.js";
import { fetchEnsemble, ensembleProbability, minutesToNextGfsUpdate } from "./weather/forecast.js";
import { computeEdge, decide, detectBucketSumArb,
         EDGE_THRESHOLD, MIN_VOLUME, MIN_HOURS, MAX_HOURS } from "./weather/signal.js";
import { logTrade } from "./data/logger.js";
import { fmtUsd, fmtPct, fmtTime, pad, padL, sleep } from "./utils.js";

// ── ANSI palette ──────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m",  white: "\x1b[37m", magenta: "\x1b[35m",
  bgreen: "\x1b[1;32m", bred: "\x1b[1;31m",
  byellow: "\x1b[1;33m", bcyan: "\x1b[1;36m",
};

const W = 72;
const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, "");
const pad72 = (s, w = W - 4) => {
  const raw = strip(s);
  return s + " ".repeat(Math.max(0, w - raw.length));
};
const divider  = "─".repeat(W);
const line     = (s = "") => `│ ${pad72(s)} │`;
const hdr      = (s) => `┌─ ${C.bold}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - strip(s).length))}┐`;
const section  = (s) => `├─ ${C.cyan}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - strip(s).length))}┤`;
const footer   = () => `└${"─".repeat(W)}┘`;

// ── Paper book ────────────────────────────────────────────────────────────────
class WeatherBook {
  constructor(start = 500) {
    this.start   = start;
    this.balance = start;
    this.open    = [];   // open positions
    this.closed  = [];   // resolved trades
    this.enteredIds = new Set(); // prevent double-entering same market
  }

  enter({ marketId, city, question, side, entryPrice, shares, betUsdc, edge, strength, endMs }) {
    if (this.enteredIds.has(marketId)) return false;
    if (betUsdc > this.balance) return false;
    this.balance -= betUsdc;
    this.enteredIds.add(marketId);
    this.open.push({ marketId, city, question, side, entryPrice, shares, betUsdc, edge, strength, endMs, enteredAt: Date.now() });
    return true;
  }

  // Call when a market has resolved. wonYes = true if YES resolved to $1.
  resolve(marketId, wonYes) {
    const idx = this.open.findIndex((p) => p.marketId === marketId);
    if (idx === -1) return null;
    const [pos] = this.open.splice(idx, 1);
    this.enteredIds.delete(marketId);

    const won     = (pos.side === "YES" && wonYes) || (pos.side === "NO" && !wonYes);
    const payout  = won ? pos.shares * 1.0 : 0;
    this.balance += payout;
    const pnl     = payout - pos.betUsdc;
    const closed  = { ...pos, won, payout, pnl, resolvedAt: Date.now() };
    this.closed.push(closed);
    return closed;
  }

  // Auto-expire positions past endMs (mark as unknown/lost conservatively in paper)
  expireStale() {
    const now = Date.now();
    const expired = this.open.filter((p) => p.endMs && p.endMs < now - 300_000);
    for (const p of expired) this.resolve(p.marketId, false); // conservative: assume loss
    return expired.length;
  }

  get stats() {
    const n    = this.closed.length;
    const wins = this.closed.filter((t) => t.won).length;
    const pnl  = this.balance - this.start;
    const avgEdge = n ? this.closed.reduce((s, t) => s + (t.edge ?? 0), 0) / n : null;
    return { n, wins, winRate: n ? wins / n : null, pnl, avgEdge };
  }

  recentClosed(k = 5) { return this.closed.slice(-k).reverse(); }
}

// ── State ──────────────────────────────────────────────────────────────────────
const PAPER_START = Number(process.env.PAPER_BALANCE) || 500;
const book = new WeatherBook(PAPER_START);

// Per-market analysis results: marketId → { modelProb, edge, decision }
const analysis = new Map();

let markets     = [];
let lastScan    = 0;
let lastDisplay = 0;
let scanErrors  = 0;
let displayRows = [];

// ── Analysis loop (runs every 60s) ────────────────────────────────────────────
async function runAnalysis() {
  try {
    markets = await fetchWeatherMarkets();
    await refreshMarketPrices(markets);
    lastScan = Date.now();
    scanErrors = 0;
  } catch (e) {
    scanErrors++;
    log(`[scan] error: ${e.message}`);
    return;
  }

  // Group by city for bucket-sum arb detection
  const byCity = new Map();
  for (const m of markets) {
    const cid = m.city.id;
    if (!byCity.has(cid)) byCity.set(cid, []);
    byCity.get(cid).push(m);
  }

  const rows = [];

  for (const market of markets) {
    const { city, measureType, threshold, date } = market;

    // Fetch ensemble for this city in the market's temperature unit
    const ensemble = await fetchEnsemble(city.lat, city.lon, threshold.unit);
    if (!ensemble) {
      rows.push({ market, modelProb: null, edgeResult: null, decision: null });
      continue;
    }

    // Find the right forecast day
    const forecastDay = date
      ? ensemble.find((d) => d.date === date)
      : ensemble[0]; // default to tomorrow (index 0 = today, 1 = tomorrow)

    if (!forecastDay) {
      rows.push({ market, modelProb: null, edgeResult: null, decision: null });
      continue;
    }

    const members = measureType === "min" ? forecastDay.minMembers : forecastDay.maxMembers;
    const modelProb = ensembleProbability(members, threshold);

    const edgeResult = computeEdge(market, modelProb);
    const decision   = decide(market, edgeResult, book.balance);

    // Detect bucket-sum arb across all markets for this city
    const cityMarkets = byCity.get(city.id) ?? [];
    const bucketArb   = cityMarkets.length > 1 ? detectBucketSumArb(cityMarkets) : null;

    analysis.set(market.id, { modelProb, edgeResult, decision, bucketArb });
    rows.push({ market, modelProb, edgeResult, decision, bucketArb });

    // Paper trade: enter if signal says ENTER
    if (decision?.action === "ENTER" && !book.enteredIds.has(market.id)) {
      const entered = book.enter({
        marketId:   market.id,
        city:       city.name,
        question:   market.question,
        side:       decision.side,
        entryPrice: decision.entryPrice,
        shares:     decision.shares,
        betUsdc:    decision.betUsdc,
        edge:       decision.edge,
        strength:   decision.strength,
        endMs:      market.endMs,
      });

      if (entered) {
        logTrade({
          type:      "weather",
          marketId:  market.id,
          city:      city.name,
          question:  market.question,
          side:      decision.side,
          price:     decision.entryPrice,
          shares:    decision.shares,
          usdc:      decision.betUsdc,
          edge:      decision.edge,
          modelProb,
          threshold,
          date,
          sim:       true,
        });
      }
    }
  }

  displayRows = rows;
  book.expireStale();
}

// ── Terminal display ──────────────────────────────────────────────────────────
function render() {
  const now   = Date.now();
  const lines = [];
  const push  = (s = "") => lines.push(s);

  push("\x1b[2J\x1b[H"); // clear screen

  // ── Header ─────────────────────────────────────────────────────────────────
  push(hdr(`Polymarket Weather Bot  ${C.dim}${fmtTime()}${C.reset}`));
  push(line());

  // ── Status row ─────────────────────────────────────────────────────────────
  const scanAgo  = lastScan ? `${Math.round((now - lastScan) / 1000)}s ago` : "pending...";
  const nextGfs  = minutesToNextGfsUpdate();
  const errStr   = scanErrors > 0 ? `  ${C.red}errors:${scanErrors}${C.reset}` : "";
  push(line(
    `Markets: ${C.bold}${markets.length}${C.reset}  ` +
    `Scanned: ${C.dim}${scanAgo}${C.reset}  ` +
    `Next GFS update: ${C.yellow}~${nextGfs}m${C.reset}` +
    errStr
  ));

  // ── Paper account ─────────────────────────────────────────────────────────
  push(line());
  push(section("PAPER ACCOUNT"));
  push(line());

  const s       = book.stats;
  const pnlSign = s.pnl >= 0;
  const pnlClr  = pnlSign ? C.bgreen : C.bred;
  push(line(
    `Balance: ${C.bold}${fmtUsd(book.balance)}${C.reset}  ` +
    `P&L: ${pnlClr}${s.pnl >= 0 ? "+" : ""}${fmtUsd(s.pnl)}${C.reset}  ` +
    `ROI: ${pnlClr}${fmtPct(s.pnl / book.start)}${C.reset}`
  ));
  push(line(
    `Trades: ${s.n}  ` +
    `Wins: ${s.wins}  ` +
    (s.winRate != null
      ? `Rate: ${(s.winRate >= 0.55 ? C.green : s.winRate >= 0.45 ? C.yellow : C.red) + (s.winRate * 100).toFixed(1) + "%" + C.reset}  `
      : "") +
    `Avg edge: ${s.avgEdge != null ? fmtPct(s.avgEdge) : "N/A"}  ` +
    `Open: ${book.open.length}`
  ));

  // ── Open positions ─────────────────────────────────────────────────────────
  if (book.open.length > 0) {
    push(line());
    push(section("OPEN POSITIONS"));
    push(line());
    for (const p of book.open) {
      const minsLeft = Math.round((p.endMs - now) / 60_000);
      const pColor   = p.side === "YES" ? C.green : C.red;
      push(line(
        `${pColor}${p.side}${C.reset} ${C.dim}${p.city}${C.reset}  ` +
        `@ ${p.entryPrice.toFixed(3)}  ${p.shares}sh  ${fmtUsd(p.betUsdc)}  ` +
        `edge ${fmtPct(p.edge)}  ` +
        `${minsLeft > 0 ? C.yellow + minsLeft + "m left" : C.red + "EXPIRED" + C.reset}`
      ));
    }
  }

  // ── Recent closed trades ───────────────────────────────────────────────────
  const recent = book.recentClosed(4);
  if (recent.length > 0) {
    push(line());
    push(section("RECENT TRADES"));
    push(line());
    for (const t of recent) {
      const c    = t.won ? C.bgreen : C.bred;
      const mark = t.won ? "✓" : "✗";
      push(line(
        `${c}${mark}${C.reset} ${t.city}  ${t.side} @ ${t.entryPrice.toFixed(3)}  ` +
        `${c}${t.won ? "+" : ""}${fmtUsd(t.pnl)}${C.reset}  ${C.dim}${t.strength ?? ""}${C.reset}`
      ));
    }
  }

  // ── Active market signals ──────────────────────────────────────────────────
  push(line());
  push(section("MARKET SIGNALS  (secondary cities first)"));
  push(line());

  if (displayRows.length === 0) {
    push(line(`  ${C.dim}No temperature markets found. Scanning...${C.reset}`));
  } else {
    // Show up to 18 markets
    for (const row of displayRows.slice(0, 18)) {
      const { market: m, modelProb, edgeResult, decision, bucketArb } = row;
      push(renderMarketRow(m, modelProb, edgeResult, decision, bucketArb));
    }
    if (displayRows.length > 18) {
      push(line(`  ${C.dim}...and ${displayRows.length - 18} more markets${C.reset}`));
    }
  }

  // ── Edge thresholds legend ─────────────────────────────────────────────────
  push(line());
  push(line(
    `${C.dim}Filters: edge>${(EDGE_THRESHOLD*100).toFixed(0)}% | vol>$${MIN_VOLUME} | ${MIN_HOURS}h–${MAX_HOURS}h to close | Kelly×0.25${C.reset}`
  ));
  push(footer());
  push(`  ${C.dim}Paper mode. Set LIVE_MODE=true for live trading. Ctrl+C to stop.${C.reset}`);

  process.stdout.write(lines.join("\n") + "\n");
}

function renderMarketRow(m, modelProb, edgeResult, decision, bucketArb) {
  // City + threshold
  const unitSym  = m.threshold.unit === "F" ? "°F" : "°C";
  let   threshStr;
  if (m.threshold.type === "range")  threshStr = `${m.threshold.lo}–${m.threshold.hi}${unitSym}`;
  else if (m.threshold.type === "above") threshStr = `>${m.threshold.val}${unitSym}`;
  else                               threshStr = `<${m.threshold.val}${unitSym}`;

  const cityStr  = `${m.city.name}/${m.measureType === "min" ? "low" : "high"}`;
  const dateStr  = m.date ? m.date.slice(5) : "??"; // MM-DD
  const hoursStr = `${m.hoursToClose.toFixed(0)}h`;
  const volStr   = m.volume >= 1000 ? `$${(m.volume/1000).toFixed(1)}k` : `$${m.volume}`;

  // Prices
  const yStr = m.yesPrice != null ? m.yesPrice.toFixed(3) : "  ???";
  const nStr = m.noPrice  != null ? m.noPrice.toFixed(3)  : "  ???";

  // Model probability
  const mpStr = modelProb != null ? `${(modelProb * 100).toFixed(1)}%` : "  N/A";

  // Decision
  let sigStr;
  if (!edgeResult) {
    sigStr = `${C.dim}SKIP filtered${C.reset}`;
  } else if (decision?.action === "ENTER") {
    const sc = decision.strength === "STRONG" ? C.bgreen : decision.strength === "GOOD" ? C.green : C.yellow;
    sigStr = `${sc}▶ ${decision.side} ${decision.strength} e=${fmtPct(decision.edge)} ${fmtUsd(decision.betUsdc)}${C.reset}`;
  } else {
    const edgeVal = edgeResult?.bestEdge ?? 0;
    const ec = Math.abs(edgeVal) > 0.04 ? C.yellow : C.dim;
    sigStr = `${ec}— ${decision?.reason ?? "no_signal"}${C.reset}`;
  }

  // Bucket-sum arb flag
  const arbFlag = bucketArb?.arb ? ` ${C.magenta}[SUM_ARB ${bucketArb.direction} ${bucketArb.deviation.toFixed(2)}]${C.reset}` : "";

  const left = `${C.bold}${pad(cityStr, 22)}${C.reset}${pad(threshStr, 10)}${pad(dateStr, 6)}${C.dim}${pad(hoursStr, 5)}${volStr}${C.reset}`;
  const mid  = `Y:${C.green}${yStr}${C.reset} N:${C.red}${nStr}${C.reset} M:${C.cyan}${mpStr}${C.reset}`;
  return line(`${left}  ${mid}  ${sigStr}${arbFlag}`);
}

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg) {
  process.stderr.write(`[weather] ${new Date().toISOString()}  ${msg}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\nPolymarket Weather Bot starting...");
  console.log(`Paper balance: ${fmtUsd(PAPER_START)} | Edge threshold: ${(EDGE_THRESHOLD * 100).toFixed(0)}% | Max bet: $${process.env.WEATHER_MAX_BET ?? 50}`);
  console.log("Fetching markets and ensemble forecasts...\n");

  // Initial scan
  await runAnalysis();

  // Render loop — update display every 3s
  setInterval(() => render(), 3_000);

  // Analysis loop — re-scan markets + ensemble every 90s
  setInterval(async () => {
    await runAnalysis();
  }, 90_000);

  // Model-aware refresh — re-fetch ensemble around GFS update windows
  // GFS updates become available ~3.5hrs after init (00Z/06Z/12Z/18Z)
  // We poll every 5 min and let the cache TTL (25min) handle rate limiting
  setInterval(async () => {
    const mins = minutesToNextGfsUpdate();
    // Within 10 min of a model update → force re-scan to catch the new run
    if (mins <= 10 || mins >= 355) {
      log("Near GFS update window — forcing re-scan");
      await runAnalysis();
    }
  }, 5 * 60_000);

  // Initial render
  render();

  process.on("SIGINT", () => {
    const s = book.stats;
    process.stdout.write("\n\n");
    process.stdout.write(`Stopped. Balance: ${fmtUsd(book.balance)} | P&L: ${fmtUsd(s.pnl)} | Trades: ${s.n}\n`);
    if (s.n > 0 && s.winRate != null) {
      process.stdout.write(`Win rate: ${(s.winRate * 100).toFixed(1)}% | Avg edge: ${s.avgEdge != null ? fmtPct(s.avgEdge) : "N/A"}\n`);
    }
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
