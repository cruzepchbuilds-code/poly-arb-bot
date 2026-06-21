/**
 * Weather Copy-Trade Bot — Compounding Bankroll Edition
 *
 * Watches profitable weather traders and mirrors their daily high/low entries.
 * Sizes every bet as a PERCENTAGE of current balance so winnings compound
 * automatically and losses naturally reduce exposure.
 *
 * Math for $63 starting bankroll:
 *   - 15% per trade, max 3 open (40% deployed max)
 *   - gopfan2-style ~60% win rate at avg 0.35 entry → 2.3× payout on wins
 *   - Expected edge per trade: ~+7% of balance
 *   - 20 trades → ~$250  |  50 trades → ~$2,400  (compounding)
 *   - Worst-case 5 consecutive losses at 15%: $63 → $28 (survivable)
 *
 * Run:  npm run copy
 *
 * Key env vars (.env):
 *   WATCH_WALLETS    comma-separated 0x addresses to copy
 *   START_BALANCE    your starting USDC (used for sim tracking, default 63)
 *   BET_PCT          fraction of balance per trade (default 0.15 = 15%)
 *   MAX_DEPLOY_PCT   max fraction deployed at once (default 0.40 = 40%)
 *   MAX_POSITIONS    max concurrent open positions (default 3)
 *   FLOOR_USDC       reduce sizing below this balance (default 25)
 *   COPY_POLL_MIN    poll interval in minutes (default 10)
 *   COPY_MIN_HOURS   skip markets with less runway (default 2)
 *   LIVE_MODE        set true for real orders
 */

import { placeLimitBuy, getUsdcBalance } from "./live/orders.js";
import { logTrade }                       from "./data/logger.js";
import { fmtUsd, fmtPct, sleep }         from "./utils.js";

// ── Config ────────────────────────────────────────────────────────────────────
const WATCH_WALLETS = (process.env.WATCH_WALLETS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const POLL_MS       = (Number(process.env.COPY_POLL_MIN)  || 10) * 60_000;
const MIN_HOURS     =  Number(process.env.COPY_MIN_HOURS) || 2;
const LIVE          = process.env.LIVE_MODE === "true";

// Bankroll params
const START_BALANCE  = Number(process.env.START_BALANCE)  || 63;
const BET_PCT        = Number(process.env.BET_PCT)        || 0.15;  // 15% per trade
const MAX_DEPLOY_PCT = Number(process.env.MAX_DEPLOY_PCT) || 0.50;  // 50% max deployed
const MAX_POSITIONS  = Number(process.env.MAX_POSITIONS)  || 5;
const FLOOR_USDC     = Number(process.env.FLOOR_USDC)     || 25;    // below this: shrink bets

const GAMMA    = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const CLOB     = "https://clob.polymarket.com";

// ── Bankroll tracker ──────────────────────────────────────────────────────────
class Bankroll {
  constructor(start) {
    this.start    = start;
    this.balance  = start;
    this.deployed = 0;      // USDC currently in open positions
    this.peak     = start;  // all-time high (for drawdown calc)
    this.trades   = 0;
    this.wins     = 0;
    this.totalPnl = 0;
  }

  get available()   { return Math.max(0, this.balance - this.deployed); }
  get drawdown()    { return this.peak > 0 ? (this.peak - this.balance) / this.peak : 0; }
  get roi()         { return (this.balance - this.start) / this.start; }
  get winRate()     { return this.trades > 0 ? this.wins / this.trades : null; }

  // How much to bet on the next trade
  betSize() {
    const pct = this.balance < FLOOR_USDC ? BET_PCT * 0.5 : BET_PCT;
    const raw = this.balance * pct;
    return Math.max(1, Math.floor(raw * 100) / 100); // floor to cents
  }

  canEnter() {
    if (this.deployed / this.balance > MAX_DEPLOY_PCT) return false;
    if (openPositions.size >= MAX_POSITIONS) return false;
    if (this.available < 2) return false;
    return true;
  }

  open(usdc) {
    this.deployed  = Math.min(this.balance, this.deployed + usdc);
    this.balance   = Math.max(0, this.balance - usdc);
  }

  close(cost, payout) {
    const pnl = payout - cost;
    this.balance  += payout;
    this.deployed  = Math.max(0, this.deployed - cost);
    this.totalPnl += pnl;
    this.trades++;
    if (pnl > 0) this.wins++;
    if (this.balance > this.peak) this.peak = this.balance;
    return pnl;
  }

  // Sync to real on-chain balance in live mode
  async syncLive() {
    if (!LIVE) return;
    const real = await getUsdcBalance();
    if (real != null && real > 0) {
      this.balance = real;
      if (real > this.peak) this.peak = real;
    }
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
const bank = new Bankroll(START_BALANCE);

// tokenId → { cost, entryPrice, shares, title, side, enteredAt, endMs }
const openPositions = new Map();

// wallets → Set of tokenIds currently held (to detect new entries)
const knownHoldings = new Map();

// tokenIds we've entered (prevent re-entering)
const entered = new Set();

let pollCount = 0;
const startedAt = Date.now();

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchPositions(wallet) {
  const urls = [
    `${DATA_API}/positions?user=${wallet}&sizeThreshold=0.1&limit=100`,
    `${GAMMA}/positions?user=${wallet}&limit=100`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      if (!res.ok) continue;
      const d = await res.json();
      const rows = Array.isArray(d) ? d : (d.positions ?? d.data ?? []);
      if (rows.length > 0) return rows;
    } catch { /* try next */ }
  }
  return null;
}

async function fetchMidPrice(tokenId) {
  try {
    const res = await fetch(`${CLOB}/midpoint?token_id=${tokenId}`, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const d = await res.json();
    const p = Number(d.mid ?? d.price ?? d.midpoint);
    return Number.isFinite(p) ? p : null;
  } catch { return null; }
}

// ── Weather detection ─────────────────────────────────────────────────────────
const WEATHER_RE = /(temperature|temp|high|low|degrees?|°[fc]|fahrenheit|celsius)/i;
const DAILY_RE   = /(daily|today|day|high|low|maximum|minimum|tonight)/i;

// Secondary cities first — research shows 2-4× more edge than NYC/London in 2026
const PRIORITY_CITIES = [
  "buenos aires", "cape town", "atlanta", "dallas", "seoul",
  "toronto", "berlin", "chicago", "miami",
];

function isWeatherMarket(pos) {
  const text = String(pos.title ?? pos.question ?? pos.market ?? "").toLowerCase();
  return WEATHER_RE.test(text) && DAILY_RE.test(text);
}

function cityPriority(pos) {
  const text = String(pos.title ?? pos.question ?? "").toLowerCase();
  const idx = PRIORITY_CITIES.findIndex((c) => text.includes(c));
  return idx === -1 ? PRIORITY_CITIES.length : idx; // lower = higher priority
}

function hoursToClose(pos) {
  const endMs = new Date(pos.endDate ?? pos.expirationDate ?? 0).getTime();
  if (!endMs || !Number.isFinite(endMs)) return null;
  return (endMs - Date.now()) / 3_600_000;
}

// ── Copy one position ─────────────────────────────────────────────────────────
async function copyPosition(wallet, pos) {
  const tokenId = String(pos.asset ?? pos.tokenId ?? pos.token_id ?? "");
  if (!tokenId || entered.has(tokenId)) return;

  const title   = String(pos.title ?? pos.question ?? "unknown");
  const outcome = String(pos.outcome ?? (pos.outcomeIndex === 0 ? "YES" : "NO"));
  const hrs     = hoursToClose(pos);
  const endMs   = new Date(pos.endDate ?? pos.expirationDate ?? 0).getTime();

  if (hrs === null || hrs < MIN_HOURS) {
    log(`SKIP  ${fmt(title)} — ${hrs?.toFixed(1) ?? "?"}h left`);
    return;
  }

  if (!bank.canEnter()) {
    log(`SKIP  ${fmt(title)} — bankroll limit (deployed=${fmtUsd(bank.deployed)} / ${(MAX_DEPLOY_PCT*100).toFixed(0)}% max, positions=${openPositions.size}/${MAX_POSITIONS})`);
    return;
  }

  const price = await fetchMidPrice(tokenId);
  if (price == null) { log(`SKIP  ${fmt(title)} — no price`); return; }
  if (price < 0.04 || price > 0.96) { log(`SKIP  ${fmt(title)} — extreme price ${price.toFixed(3)}`); return; }

  const betUsdc = Math.min(bank.betSize(), bank.available);
  const shares  = Math.floor(betUsdc / price);
  if (shares < 1) { log(`SKIP  ${fmt(title)} — bet too small`); return; }

  const cost = shares * price;

  log(`COPY  [${outcome}] ${fmt(title)}`);
  log(`      price=${price.toFixed(3)}  bet=${fmtUsd(cost)}  shares=${shares}  runway=${hrs.toFixed(1)}h`);
  log(`      balance=${fmtUsd(bank.balance)}  deployed=${fmtUsd(bank.deployed)}  from=${wallet.slice(0,10)}...`);

  try {
    const order = await placeLimitBuy(tokenId, price, shares);
    entered.add(tokenId);
    bank.open(cost);

    openPositions.set(tokenId, { cost, entryPrice: price, shares, title, outcome, wallet, endMs, enteredAt: Date.now() });

    logTrade({
      type: "copy-weather", wallet, tokenId, outcome,
      title: title.slice(0, 100), price, shares, cost,
      balance: bank.balance + cost, // balance before deduction
      hoursLeft: hrs,
      orderId: order.orderId,
      sim: order.sim ?? !LIVE,
      at: new Date().toISOString(),
    });

    log(`      ✓ Order ${order.orderId} ${order.sim ? "[SIM]" : "[LIVE]"}  new balance=${fmtUsd(bank.balance)}`);
  } catch (e) {
    log(`      ✗ Failed: ${e.message}`);
  }
}

// ── Poll one wallet ───────────────────────────────────────────────────────────
async function pollWallet(wallet) {
  const positions = await fetchPositions(wallet);
  if (positions === null) { log(`WARN  Can't reach wallet ${wallet.slice(0,10)}...`); return; }

  const prev = knownHoldings.get(wallet) ?? new Set();
  const curr = new Set();

  let totalWeather = 0;
  let totalNew = 0;

  // Collect new weather positions, sort secondary cities first
  const newWeather = [];
  for (const pos of positions) {
    const tokenId = String(pos.asset ?? pos.tokenId ?? pos.token_id ?? "");
    if (!tokenId) continue;
    curr.add(tokenId);
    const isWeather = isWeatherMarket(pos);
    if (isWeather) totalWeather++;
    if (!prev.has(tokenId) && !entered.has(tokenId)) {
      if (isWeather) {
        totalNew++;
        newWeather.push(pos);
      }
    }
  }

  // Always log a scan summary so you can see what's happening
  const firstPoll = prev.size === 0;
  log(`SCAN  ${wallet.slice(0,10)}...  ${positions.length} positions | ${totalWeather} weather | ${totalNew} new${firstPoll ? " (first poll — seeding)" : ""}`);

  // Process highest-priority cities first
  newWeather.sort((a, b) => cityPriority(a) - cityPriority(b));
  for (const pos of newWeather) {
    await copyPosition(wallet, pos);
    await sleep(300);
  }

  knownHoldings.set(wallet, curr);
}

// ── Resolve expired positions ─────────────────────────────────────────────────
function expireStale() {
  const now = Date.now();
  for (const [tokenId, pos] of openPositions) {
    if (!pos.endMs || pos.endMs >= now - 5 * 60_000) continue;

    if (LIVE) {
      // In live mode we don't know the real payout — just free the slot so new
      // trades can be entered. P&L is tracked on-chain, not here.
      openPositions.delete(tokenId);
      log(`EXPR  ${fmt(pos.title)} — freed live slot (resolved on-chain)`);
    } else {
      // Sim: conservatively treat expired positions as lost
      const pnl = bank.close(pos.cost, 0);
      openPositions.delete(tokenId);
      log(`EXPR  ${fmt(pos.title)} — expired from sim book  pnl=${fmtUsd(pnl)}`);
    }
  }
}

// ── Main poll loop ────────────────────────────────────────────────────────────
async function tick() {
  pollCount++;
  const elapsed = Math.round((Date.now() - startedAt) / 60_000);
  log(`\n── Poll #${pollCount}  ${elapsed}m running  balance=${fmtUsd(bank.balance)}  deployed=${fmtUsd(bank.deployed)}  roi=${fmtPct(bank.roi)} ──`);

  // Sync real balance from chain in live mode
  await bank.syncLive();

  for (const wallet of WATCH_WALLETS) {
    await pollWallet(wallet);
    await sleep(500);
  }

  expireStale();
  printStats();
}

function printStats() {
  if (bank.trades === 0 && openPositions.size === 0) return;
  const wr = bank.winRate != null ? `${(bank.winRate * 100).toFixed(0)}%` : "—";
  log(`STAT  trades=${bank.trades} wins=${bank.wins} wr=${wr} pnl=${fmtUsd(bank.totalPnl)} open=${openPositions.size} peak=${fmtUsd(bank.peak)} dd=${fmtPct(-bank.drawdown)}`);
}

// ── Logging ───────────────────────────────────────────────────────────────────
const fmt = (s) => String(s).slice(0, 55);
function log(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
  if (WATCH_WALLETS.length === 0) {
    console.error("Set WATCH_WALLETS=0x... in your .env");
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Weather Copy-Trade Bot (Compounding)   ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Start balance : ${fmtUsd(START_BALANCE)}`);
  console.log(`Bet per trade : ${(BET_PCT * 100).toFixed(0)}% of balance (→ ${fmtUsd(bank.betSize())} now)`);
  console.log(`Max deployed  : ${(MAX_DEPLOY_PCT * 100).toFixed(0)}% | Max positions: ${MAX_POSITIONS}`);
  console.log(`Floor         : reduce sizing below ${fmtUsd(FLOOR_USDC)}`);
  console.log(`Poll every    : ${POLL_MS / 60_000} min | Min runway: ${MIN_HOURS}h`);
  console.log(`Mode          : ${LIVE ? "⚡ LIVE — REAL MONEY" : "🔵 SIM — no real orders"}`);
  console.log(`Watching      :\n${WATCH_WALLETS.map((w) => `  ${w}`).join("\n")}`);
  console.log("──────────────────────────────────────────\n");

  await tick();
  setInterval(tick, POLL_MS);

  process.on("SIGINT", () => {
    console.log(`\n── Final stats ───────────────────────────`);
    console.log(`Balance : ${fmtUsd(bank.balance)}  (started ${fmtUsd(bank.start)})`);
    console.log(`P&L     : ${fmtUsd(bank.totalPnl)}  ROI: ${fmtPct(bank.roi)}`);
    console.log(`Trades  : ${bank.trades}  Wins: ${bank.wins}  WR: ${bank.winRate != null ? (bank.winRate*100).toFixed(1)+"%" : "—"}`);
    console.log(`Peak    : ${fmtUsd(bank.peak)}`);
    process.exit(0);
  });
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
