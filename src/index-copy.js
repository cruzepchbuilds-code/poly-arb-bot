/**
 * Copy-Trade Bot — Weather Daily High/Low Markets
 *
 * Watches target wallets and mirrors their entries in daily temperature markets.
 * All other strategies are paused — run this standalone with: npm run copy
 *
 * Why weather daily high/low:
 *   - Markets resolve at end of day — if the target enters at 8am you still
 *     have 10+ hours of runway after a 10-minute detection lag.
 *   - The profitable traders (gopfan2, ColdMath) hold positions for hours, so
 *     copying at a slight delay captures nearly the same edge.
 *
 * Configuration (set in .env):
 *   WATCH_WALLETS=0x...,0x...   comma-separated wallets to copy
 *   COPY_POLL_MIN=10            poll interval in minutes (default 10)
 *   COPY_BET_USDC=20            USDC per copied trade
 *   COPY_MIN_HOURS=2            skip markets resolving in less than this
 *   LIVE_MODE=false             set true to place real orders
 */

import { placeLimitBuy } from "./live/orders.js";
import { logTrade }       from "./data/logger.js";
import { fmtUsd, sleep }  from "./utils.js";

// ── Config ─────────────────────────────────────────────────────────────────────
const WATCH_WALLETS = (process.env.WATCH_WALLETS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const POLL_MS    = (Number(process.env.COPY_POLL_MIN)  || 10) * 60_000;
const BET_USDC   =  Number(process.env.COPY_BET_USDC)  || 20;
const MIN_HOURS  =  Number(process.env.COPY_MIN_HOURS) || 2;
const LIVE       = process.env.LIVE_MODE === "true";

const GAMMA    = "https://gamma-api.polymarket.com";
const DATA_API = "https://data-api.polymarket.com";
const CLOB     = "https://clob.polymarket.com";

// ── State ──────────────────────────────────────────────────────────────────────
// wallet → Set of tokenIds we already know they hold (to detect NEW entries)
const knownHoldings = new Map();
// tokenIds we've already copied (don't double-enter)
const copied = new Set();

let totalCopied = 0;
let totalPaperPnl = 0;

// ── Wallet position fetcher ────────────────────────────────────────────────────
async function fetchPositions(wallet) {
  // Try data-api first (richer response), fall back to gamma-api
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
      if (rows.length > 0 || url === urls[urls.length - 1]) return rows;
    } catch { /* try next */ }
  }
  return null;
}

// ── Current mid price for a token ─────────────────────────────────────────────
async function fetchMidPrice(tokenId) {
  try {
    const res = await fetch(
      `${CLOB}/midpoint?token_id=${tokenId}`,
      { signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const p = Number(d.mid ?? d.price ?? d.midpoint);
    return Number.isFinite(p) ? p : null;
  } catch { return null; }
}

// ── Weather market detection ───────────────────────────────────────────────────
function isWeatherMarket(pos) {
  const text = String(pos.title ?? pos.question ?? pos.market ?? "").toLowerCase();
  return (
    /(temperature|temp|high|low|degrees?|°[fc]|fahrenheit|celsius)/i.test(text) &&
    /(daily|today|day|high|low|maximum|minimum)/i.test(text)
  );
}

function hoursToClose(pos) {
  const endMs = new Date(pos.endDate ?? pos.expirationDate ?? 0).getTime();
  if (!endMs || !Number.isFinite(endMs)) return null;
  return (endMs - Date.now()) / 3_600_000;
}

// ── Copy a single position entry ───────────────────────────────────────────────
async function copyPosition(wallet, pos) {
  const tokenId = String(pos.asset ?? pos.tokenId ?? pos.token_id ?? "");
  if (!tokenId) return;

  const title   = String(pos.title ?? pos.question ?? "unknown");
  const outcome = String(pos.outcome ?? pos.outcomeIndex === 0 ? "YES" : "NO");
  const hrs     = hoursToClose(pos);

  // Time filter: must have enough runway left
  if (hrs === null || hrs < MIN_HOURS) {
    log(`SKIP  ${title.slice(0, 50)} — only ${hrs?.toFixed(1) ?? "?"}h left`);
    return;
  }

  // Price check: get live price before entering
  const price = await fetchMidPrice(tokenId);
  if (price == null) {
    log(`SKIP  ${title.slice(0, 50)} — can't fetch price`);
    return;
  }

  // Skip extremes: already near 0 or 1 means the market has mostly resolved
  if (price < 0.04 || price > 0.96) {
    log(`SKIP  ${title.slice(0, 50)} — price at extreme (${price.toFixed(3)})`);
    return;
  }

  const shares = Math.floor(BET_USDC / price);
  if (shares < 1) {
    log(`SKIP  ${title.slice(0, 50)} — bet too small`);
    return;
  }

  log(`COPY  [${outcome}] ${title.slice(0, 60)}`);
  log(`      price=${price.toFixed(3)}  shares=${shares}  cost=${fmtUsd(shares * price)}  ${hrs.toFixed(1)}h left`);
  log(`      from wallet ${wallet.slice(0, 10)}...`);

  try {
    const order = await placeLimitBuy(tokenId, price, shares);
    copied.add(tokenId);
    totalCopied++;

    logTrade({
      type:      "copy-weather",
      wallet,
      tokenId,
      outcome,
      title:     title.slice(0, 100),
      price,
      shares,
      cost:      shares * price,
      hoursLeft: hrs,
      orderId:   order.orderId,
      sim:       order.sim ?? !LIVE,
      at:        new Date().toISOString(),
    });

    log(`      ✓ Order placed: ${order.orderId} ${order.sim ? "(SIM)" : "(LIVE)"}`);
  } catch (e) {
    log(`      ✗ Order failed: ${e.message}`);
  }
}

// ── Poll one wallet ────────────────────────────────────────────────────────────
async function pollWallet(wallet) {
  const positions = await fetchPositions(wallet);

  if (positions === null) {
    log(`WARN  Could not fetch positions for ${wallet.slice(0, 10)}...`);
    return;
  }

  const prev = knownHoldings.get(wallet) ?? new Set();
  const curr = new Set();

  for (const pos of positions) {
    const tokenId = String(pos.asset ?? pos.tokenId ?? pos.token_id ?? "");
    if (!tokenId) continue;
    curr.add(tokenId);

    // New position not seen before and not already copied by us
    if (!prev.has(tokenId) && !copied.has(tokenId) && isWeatherMarket(pos)) {
      await copyPosition(wallet, pos);
    }
  }

  knownHoldings.set(wallet, curr);
  log(`      ${wallet.slice(0, 10)}... — ${curr.size} positions (${positions.filter(isWeatherMarket).length} weather)`);
}

// ── Main loop ──────────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

async function tick() {
  log(`── Poll #${Math.floor((Date.now() - startedAt) / POLL_MS) + 1}  copied=${totalCopied}  mode=${LIVE ? "LIVE" : "SIM"} ─────`);

  for (const wallet of WATCH_WALLETS) {
    await pollWallet(wallet);
    await sleep(500); // brief pause between wallets
  }
}

const startedAt = Date.now();

async function main() {
  if (WATCH_WALLETS.length === 0) {
    console.error("No wallets to watch. Set WATCH_WALLETS=0x... in your .env file.");
    process.exit(1);
  }

  console.log("\n=== Weather Copy-Trade Bot ===");
  console.log(`Watching : ${WATCH_WALLETS.length} wallet(s)`);
  console.log(`Poll every: ${POLL_MS / 60_000} min`);
  console.log(`Bet size : ${fmtUsd(BET_USDC)} per trade`);
  console.log(`Min runway: ${MIN_HOURS}h to resolution`);
  console.log(`Mode     : ${LIVE ? "LIVE — real orders" : "SIM — no real orders"}`);
  console.log(`Wallets  :\n${WATCH_WALLETS.map((w) => `  ${w}`).join("\n")}`);
  console.log("─────────────────────────────\n");

  // Initial poll immediately
  await tick();

  // Then poll on interval
  setInterval(async () => { await tick(); }, POLL_MS);

  process.on("SIGINT", () => {
    console.log(`\nStopped. Copied ${totalCopied} trade(s) total.`);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
