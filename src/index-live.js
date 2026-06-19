/**
 * Polymarket Arb Bot — BTC ETH SOL XRP DOGE AVAX LINK MATIC
 * Strategies: ARB | LEM | Cross-Asset | Sweep Follow
 */

import WebSocket from "ws";
import { CONFIG } from "./config.js";
import { fetchAll5minMarkets, fetchClobMidPrices } from "./data/polymarket.js";
import { ClobWsFeed } from "./data/clobWs.js";
import { logTrade } from "./data/logger.js";
import { loadSimState, saveSimState } from "./data/simState.js";
import { WindowPosition } from "./live/positions.js";
import { DirectionalPosition } from "./live/directional.js";
import { LateEntrySignal } from "./strategies/lateEntry.js";
import { ContrarianSniper } from "./strategies/contrarian.js";
import { FadeMomentum } from "./strategies/fadeMomentum.js";
import { LIVE, getUsdcBalance } from "./live/orders.js";
import { fmtUsd, fmtTime, fmtDuration, pad } from "./utils.js";
import { startWebServer } from "./web/server.js";
import { analyzeTrades } from "./analytics/analyzer.js";
import { AdaptiveSizer } from "./analytics/adaptive.js";

const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", bgreen: "\x1b[1;32m", bred: "\x1b[1;31m",
};
const W = 68;
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const hdr = (s) => `┌─ ${C.bold}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - strip(s).length))}┐`;
const sec = (s) => `├─ ${C.cyan}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - strip(s).length))}┤`;
const row = (s) => `│ ${pad(strip(s), W - 2)} │`.replace(pad(strip(s), W - 2), s.padEnd(W - 2));
const ftr = () => `└${"─".repeat(W)}┘`;

const fmtPx = (p, asset) => {
  if (p == null) return "...";
  if (asset === "BTC") return `$${(p / 1000).toFixed(1)}k`;
  if (p >= 1000) return `$${(p / 1000).toFixed(1)}k`;
  if (p >= 1)    return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
};

// Kraken REST pairs — polls all assets in one request every 2s
const KRAKEN_PAIRS = {
  BTC: "XBTUSD", ETH: "ETHUSD", SOL: "SOLUSD", XRP: "XXRPZUSD",
  DOGE: "XDGUSD", AVAX: "AVAXUSD", LINK: "LINKUSD",
};
// Kraken returns these keys in the result object
const KRAKEN_RESULT_KEYS = {
  BTC: "XXBTZUSD", ETH: "XETHZUSD", SOL: "SOLUSD", XRP: "XXRPZUSD",
  DOGE: "XDGUSD", AVAX: "AVAXUSD", LINK: "LINKUSD",
};

function startPriceFeeds(assets) {
  const prices  = {};
  let closed    = false;
  let timer     = null;

  const pairs = assets.map(a => KRAKEN_PAIRS[a]).filter(Boolean).join(",");

  const poll = async () => {
    if (closed) return;
    try {
      const res = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`,
        { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return;
      const json = await res.json();
      if (!json.result) return;
      for (const asset of assets) {
        const key = KRAKEN_RESULT_KEYS[asset];
        const data = json.result?.[key] ?? json.result?.[KRAKEN_PAIRS[asset]];
        if (!data) continue;
        const p = Number(data.c?.[0]); // c = last trade closed [price, lot volume]
        if (Number.isFinite(p) && p > 0) prices[asset] = p;
      }
    } catch { /* ignore timeouts */ }
    if (!closed) timer = setTimeout(poll, 2_000);
  };
  poll();

  return Object.fromEntries(assets.map(a => [a, {
    get:            () => prices[a] ?? null,
    getVolPressure: () => 0.5,
    close:          () => { closed = true; clearTimeout(timer); },
  }]));
}

class Stats {
  constructor() {
    this.entered = 0; this.bothFilled = 0; this.oneFilled = 0;
    this.noFills = 0; this.totalSpent = 0; this.guaranteedProfit = 0;
    this.history = [];
  }
  record(pos) {
    const s = pos.summary;
    if (s.upFilled && s.downFilled) { this.bothFilled++; this.guaranteedProfit += s.guaranteedProfit ?? 0; }
    else if (s.upFilled || s.downFilled) this.oneFilled++;
    else this.noFills++;
    this.totalSpent += s.totalSpent ?? 0;
    this.history.unshift(s);
    if (this.history.length > 10) this.history.pop();
  }
}

class LemStats {
  constructor() {
    this.entered = 0; this.won = 0; this.lost = 0;
    this.totalSpent = 0; this.totalPayout = 0;
    this.history = [];
  }
  record(s) {
    if (s.won === true) this.won++;
    else if (s.won === false) this.lost++;
    this.totalSpent  += s.totalSpent ?? 0;
    this.totalPayout += s.payout ?? 0;
    this.history.unshift(s);
    if (this.history.length > 10) this.history.pop();
  }
}

class SweepStats {
  constructor() { this.followed = 0; this.recentFollows = []; }
  record(entry) {
    this.followed++;
    this.recentFollows.unshift(entry);
    if (this.recentFollows.length > 5) this.recentFollows.pop();
  }
}

class SniperStats {
  constructor() {
    this.entered = 0; this.won = 0; this.lost = 0;
    this.totalSpent = 0; this.totalPayout = 0;
    this.history = [];
  }
  record(s) {
    if (s.won === true) this.won++;
    else if (s.won === false) this.lost++;
    this.totalSpent  += s.totalSpent ?? 0;
    this.totalPayout += s.payout ?? 0;
    this.history.unshift(s);
    if (this.history.length > 10) this.history.pop();
  }
}

class FadeStats {
  constructor() {
    this.entered = 0; this.won = 0; this.lost = 0;
    this.totalSpent = 0; this.totalPayout = 0;
    this.history = [];
  }
  record(s) {
    if (s.won === true) this.won++;
    else if (s.won === false) this.lost++;
    this.totalSpent  += s.totalSpent ?? 0;
    this.totalPayout += s.payout ?? 0;
    this.history.unshift(s);
    if (this.history.length > 10) this.history.pop();
  }
}

function render({
  feedPrices, feedMoms, feeds, lateEntry,
  activePositions, stats, lemStats, sweepStats, sniperStats, sniper, usdcBalance,
  walletAddr, opportunities, now, simBalance,
  wsConnected, wsLastUpdate, wsMarkets,
}) {
  const out  = ["\x1b[2J\x1b[H"];
  const mode = LIVE ? `${C.bred}● LIVE${C.reset}` : `${C.yellow}● SIM${C.reset}`;
  const wsAge = wsLastUpdate ? `${Math.round((now - wsLastUpdate) / 1000)}s ago` : "no data";
  const wsClr = wsConnected ? C.green : C.yellow;
  const wsTxt = wsConnected ? "● WS LIVE" : "● WS connecting";

  out.push(hdr(`Polymarket — BTC ETH SOL XRP DOGE AVAX LINK MATIC  ${mode}`));
  out.push(row(`${C.dim}Wallet: ${walletAddr ?? "not set"}${C.reset}`));
  out.push(row(
    `${C.dim}Sim: ${C.bgreen}${fmtUsd(simBalance)}${C.dim}  │  ` +
    `${wsClr}${wsTxt}${C.reset}${C.dim} (${wsMarkets} mkts, ${wsAge})${C.reset}`
  ));

  const pxStr = Object.entries(feedPrices).map(([a, p]) => `${a} ${fmtPx(p, a)}`).join("  ");
  out.push(row(`${C.dim}${pxStr}${C.reset}`));
  out.push(row(""));

  const momParts = Object.entries(feedMoms).map(([a, m]) => {
    const t15  = lateEntry.getTrend15m(a);
    const vol  = feeds[a]?.getVolPressure() ?? 0.5;
    const tArrow = t15 > 0.0015 ? "↑" : t15 < -0.0015 ? "↓" : "→";
    const vPct = Math.round(vol * 100);
    const vClr = vol > 0.55 ? C.green : vol < 0.45 ? C.red : C.dim;
    if (m == null) return `${C.dim}${a}-- ${tArrow}${vClr}V${vPct}%${C.reset}`;
    const pct = (m * 100).toFixed(2);
    const base = m > CONFIG.momentumMinPct ? `${C.bgreen}${a}↑+${pct}%${C.reset}` :
                 m < -CONFIG.momentumMinPct ? `${C.bred}${a}↓${pct}%${C.reset}` :
                                              `${C.dim}${a} ${m >= 0 ? "+" : ""}${pct}%${C.reset}`;
    return `${base}${C.dim}${tArrow}${C.reset}${vClr}V${vPct}%${C.reset}`;
  });
  out.push(row(`Mom: ${momParts.join("  ")}`));
  out.push(row(""));

  const threshold = Number(process.env.COMBINED_THRESHOLD) || CONFIG.combinedThreshold;
  out.push(sec("SCANNING"));
  out.push(row(`Threshold < ${threshold.toFixed(2)}  │  Open: ${activePositions.size}  │  ${fmtTime(new Date(now))}`));

  if (opportunities.length > 0) {
    out.push(row(""));
    out.push(row(`${C.bgreen}LIVE ARB OPPORTUNITIES${C.reset}`));
    for (const o of opportunities.slice(0, 4)) {
      const edge = ((1 - o.yesPrice - o.noPrice) * 100).toFixed(1);
      out.push(row(
        `${C.green}▶ ${o.asset} ${o.windowMins ?? 5}m  comb=${(o.yesPrice + o.noPrice).toFixed(3)}  ` +
        `UP ${o.yesPrice.toFixed(3)} + DN ${o.noPrice.toFixed(3)}  +${edge}%${C.reset}`
      ));
    }
  } else {
    out.push(row(`${C.dim}No arb opps (waiting combined < ${threshold.toFixed(2)})${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("ACTIVE POSITIONS"));
  if (activePositions.size === 0) {
    out.push(row(`${C.dim}None${C.reset}`));
  } else {
    for (const [, pos] of activePositions) {
      const s = pos.summary;
      if (s.type === "directional") {
        const fill = s.filled ? `${C.green}FILLED${C.reset}` : `${C.yellow}PENDING${C.reset}`;
        const pot  = ((s.shares ?? 0) * (1 - (s.entryPrice ?? 0))).toFixed(2);
        if (pos.sniper) {
          const pct = pos.sniperDelta != null ? ` δ=${(pos.sniperDelta * 100).toFixed(2)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.yellow}SNIPE ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${pct}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else {
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.yellow}LEM ${s.side}${C.reset}  ` +
            `@${s.entryPrice?.toFixed(3)}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        }
        out.push(row(`  ${fill}  ${s.shares ?? 0}sh`));
      } else {
        const up = s.upFilled   ? `${C.green}FILLED${C.reset}` : `${C.yellow}PENDING${C.reset}`;
        const dn = s.downFilled ? `${C.green}FILLED${C.reset}` : `${C.yellow}PENDING${C.reset}`;
        out.push(row(
          `${C.cyan}${s.asset}${C.reset}  combined=${s.combined?.toFixed(3)}  ` +
          `${fmtDuration(s.remainingMs)} left  +$${s.guaranteedProfit?.toFixed(2) ?? "?"} locked`
        ));
        out.push(row(`  UP: ${up}  DOWN: ${dn}  ${s.shares}sh × $${s.totalSpent?.toFixed(2)}`));
      }
      const last = s.log[s.log.length - 1] ?? "";
      if (last) out.push(row(`  ${C.dim}${last}${C.reset}`));
    }
  }

  out.push(row(""));
  out.push(sec("ARB STATS"));
  out.push(row(
    `Entered: ${stats.entered}  │  Both filled: ${C.green}${stats.bothFilled}${C.reset}  │  ` +
    `One side: ${C.yellow}${stats.oneFilled}${C.reset}  │  No fills: ${C.dim}${stats.noFills}${C.reset}`
  ));
  if (stats.bothFilled > 0) {
    out.push(row(`Locked P&L: ${C.bgreen}+${fmtUsd(stats.guaranteedProfit)}${C.reset}  │  Spent: ${fmtUsd(stats.totalSpent)}`));
  }

  out.push(row(""));
  out.push(sec("LEM  (Late Entry Momentum + Cross-Asset)"));
  const lemTotal = lemStats.won + lemStats.lost;
  const winRate  = lemTotal > 0 ? `${Math.round((lemStats.won / lemTotal) * 100)}%` : "--";
  const lemPnl   = lemStats.totalPayout - lemStats.totalSpent;
  out.push(row(
    `Entered: ${lemStats.entered}  │  Won: ${C.green}${lemStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${lemStats.lost}${C.reset}  │  Win rate: ${lemTotal > 0 ? C.bgreen : C.dim}${winRate}${C.reset}`
  ));
  if (lemStats.entered > 0) {
    const pnlClr = lemPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${lemPnl >= 0 ? "+" : ""}${fmtUsd(lemPnl)}${C.reset}  │  Spent: ${fmtUsd(lemStats.totalSpent)}`));
  }

  out.push(row(""));
  out.push(sec("SNIPER  (contrarian mean-reversion — 0xa689 playbook)"));
  const sniperTotal = sniperStats.won + sniperStats.lost;
  const sniperWR    = sniperTotal > 0 ? `${Math.round((sniperStats.won / sniperTotal) * 100)}%` : "--";
  const sniperPnl   = sniperStats.totalPayout - sniperStats.totalSpent;
  out.push(row(
    `Entered: ${sniperStats.entered}  │  Won: ${C.green}${sniperStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${sniperStats.lost}${C.reset}  │  Win rate: ${sniperTotal > 0 ? C.bgreen : C.dim}${sniperWR}${C.reset}`
  ));
  if (sniperStats.entered > 0) {
    const pnlClr = sniperPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${sniperPnl >= 0 ? "+" : ""}${fmtUsd(sniperPnl)}${C.reset}  │  Spent: ${fmtUsd(sniperStats.totalSpent)}`));
  } else {
    const wr   = (sniper.winRate * 100).toFixed(1);
    const src  = sniper.tradeCount >= sniper.cfg.minTradesForLive ? "observed" : "baseline";
    const k3c  = sniper.calcBetSize(0.03, simBalance).toFixed(2);
    const k7c  = sniper.calcBetSize(0.07, simBalance).toFixed(2);
    out.push(row(`${C.dim}Win rate: ${wr}% (${src}, ${sniper.tradeCount} trades)  │  Kelly: 3¢→$${k3c}  7¢→$${k7c}${C.reset}`));
    out.push(row(`${C.dim}Watching for extreme price moves on 5-min markets (token < ${wr}%)...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("RECENT COMPLETED"));
  const all = [
    ...stats.history.slice(0, 2).map((s) => ({ ...s, _src: "arb" })),
    ...lemStats.history.slice(0, 2).map((s) => ({ ...s, _src: "lem" })),
    ...sniperStats.history.slice(0, 3).map((s) => ({ ...s, _src: "sniper" })),
  ].slice(0, 6);
  if (all.length === 0) {
    out.push(row(`${C.dim}None yet${C.reset}`));
  } else {
    for (const s of all) {
      if (s._src === "sniper") {
        const clr  = s.won === true ? C.green : s.won === false ? C.red : C.dim;
        const mark = s.won === true ? "✓" : s.won === false ? "✗" : "?";
        out.push(row(
          `${clr}${mark} SNIPE ${s.asset} ${s.side}  @${((s.entryPrice ?? 0) * 100).toFixed(1)}¢  ` +
          `$${s.payout?.toFixed(2) ?? "0.00"}  ${s.won === true ? "WIN" : s.won === false ? "LOSS" : "unfilled"}${C.reset}`
        ));
      } else if (s._src === "lem") {
        const clr  = s.won === true ? C.green : s.won === false ? C.red : C.dim;
        const mark = s.won === true ? "✓" : s.won === false ? "✗" : "?";
        out.push(row(
          `${clr}${mark} LEM ${s.asset} ${s.side}  @${s.entryPrice?.toFixed(3)}  ` +
          `$${s.payout?.toFixed(2) ?? "0.00"}  ${s.won === true ? "WIN" : s.won === false ? "LOSS" : "unfilled"}${C.reset}`
        ));
      } else {
        const both = s.upFilled && s.downFilled;
        const one  = s.upFilled || s.downFilled;
        const clr  = both ? C.green : one ? C.yellow : C.dim;
        const mark = both ? "✓" : one ? "~" : "✗";
        out.push(row(
          `${clr}${mark} ARB ${s.asset}  comb=${s.combined?.toFixed(3)}  ` +
          `+$${s.guaranteedProfit?.toFixed(2) ?? "0.00"}  ${both ? "BOTH" : one ? "ONE SIDE" : "NO FILLS"}${C.reset}`
        ));
      }
    }
  }

  out.push(row(""));
  out.push(sec("SWEEP FOLLOW  (order-book momentum)"));
  out.push(row(`Followed: ${C.bgreen}${sweepStats.followed}${C.reset}  ${C.dim}(fires when ask price rises >= 1.2c in 5s)${C.reset}`));
  if (sweepStats.recentFollows.length === 0) {
    out.push(row(`${C.dim}Watching for sweeps on all ${wsMarkets} subscribed tokens...${C.reset}`));
  } else {
    for (const s of sweepStats.recentFollows) {
      const ago = Math.round((now - s.ts) / 1000);
      out.push(row(
        `${C.cyan}SWEEP${C.reset} ${s.asset} ${C.yellow}${s.side}${C.reset} @${s.price.toFixed(3)}` +
        `  +${s.rise}  $${s.betSize.toFixed(2)}  ${s.remainingS}s left  ${C.dim}${ago}s ago${C.reset}`
      ));
    }
  }


  out.push(row(""));
  out.push(ftr());
  out.push(`  ${C.dim}${fmtTime(new Date(now))}  |  Ctrl+C to exit  |  log -> trades.jsonl${C.reset}`);
  process.stdout.write(out.join("\n") + "\n");
}

async function main() {
  try {
    const fs = await import("fs");
    if (fs.existsSync(".env")) {
      for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
      }
    }
  } catch { /* .env optional */ }

  if (LIVE) {
    console.warn("\n WARNING: LIVE_MODE=true — REAL ORDERS ACTIVE\n");
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log("SIM MODE — Set LIVE_MODE=true to trade for real.\n");
  }

  if (!process.env.PRIVATE_KEY && LIVE) {
    console.error("PRIVATE_KEY not set. Add it to .env.");
    process.exit(1);
  }

  let walletAddr = null;
  if (process.env.PRIVATE_KEY) {
    try { const { walletAddress } = await import("./live/client.js"); walletAddr = walletAddress(); } catch { /* ignore */ }
  }

  const feeds = startPriceFeeds(CONFIG.assets);

  const priceSnaps = Object.fromEntries(CONFIG.assets.map((a) => [a, []]));
  const lateEntry  = new LateEntrySignal();

  const snapPrices = () => {
    for (const [asset, feed] of Object.entries(feeds)) {
      const p = feed.get();
      if (p) {
        priceSnaps[asset].push({ price: p, ts: Date.now() });
        if (priceSnaps[asset].length > 6) priceSnaps[asset].shift();
        lateEntry.recordPriceSnap(asset, p);
      }
    }
  };
  setInterval(snapPrices, CONFIG.refreshMs.priceSnap);
  snapPrices();

  const getMomentum = (asset) => {
    const snaps = priceSnaps[asset];
    if (!snaps || snaps.length < 2) return null;
    const old = snaps[0]; const cur = snaps[snaps.length - 1];
    if (cur.ts - old.ts < 60_000) return null;
    return (cur.price - old.price) / old.price;
  };

  const activePositions   = new Map();
  const enteringMarkets   = new Set();
  const stats             = new Stats();
  const lemStats          = new LemStats();
  const sweepStats        = new SweepStats();
  const sniperStats = new SniperStats();
  const fadeStats   = new FadeStats();
  const fade        = new FadeMomentum();
  const adaptive    = new AdaptiveSizer();
  let _analytics    = null;

  // Seed observed win rate from previous runs so bankroll scaling is accurate on restart
  let _seedWins = 0, _seedLosses = 0;
  try {
    const { readFileSync: rfs } = await import("fs");
    for (const line of rfs("trades.jsonl", "utf8").trim().split("\n")) {
      try {
        const t = JSON.parse(line);
        if (t.strategy !== "SNIPER") continue;
        if (t.won === true) _seedWins++;
        else if (t.won === false) _seedLosses++;
      } catch { /* ignore bad lines */ }
    }
  } catch { /* no trade log yet */ }

  const sniper = new ContrarianSniper({
    initialWins:   _seedWins,
    initialLosses: _seedLosses,
  });
  let usdcBalance         = null;
  let simBalance          = loadSimState(CONFIG.paper.startBalance);
  let marketList          = [];
  let isMonitoring        = false;
  let isFallbackScanning  = false;
  let isLateEntryChecking = false;

  const getThreshold = () => Number(process.env.COMBINED_THRESHOLD) || CONFIG.combinedThreshold;

  const kellySizeBet = (combined) => {
    const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
    const available = Math.max(0, simBalance - allocated);
    const kelly     = available * ((1 - combined) / combined) * 0.5;
    return Math.max(1, Math.min(kelly, available * 0.35));
  };

  const kellyBet = (entryPrice, confidence) => {
    const wr    = CONFIG.estimatedWinRate;
    const b     = (1 - entryPrice) / entryPrice;
    const fullK = Math.max(0, (wr * (1 + b) - 1) / b);
    const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
    const available  = Math.max(0, simBalance - allocated);
    const size = available * fullK * CONFIG.kellyFraction * confidence;
    const cap  = CONFIG.maxTradeUsdc
      ? Math.min(CONFIG.maxTradeUsdc, available * CONFIG.maxBetPct)
      : available * CONFIG.maxBetPct;
    return Math.max(CONFIG.minBetUsdc, Math.min(size, cap));
  };

  const clobWs = new ClobWsFeed();
  clobWs.setThreshold(getThreshold());

  clobWs.onOpportunity((marketId, yesPrice, noPrice) => {
    if (activePositions.has(marketId) || enteringMarkets.has(marketId)) return;
    if (activePositions.size >= CONFIG.maxPositions) return;
    const market = marketList.find((m) => m.id === marketId);
    if (!market || market.endMs - Date.now() < 60_000) return;

    enteringMarkets.add(marketId);
    (async () => {
      try {
        const pos = new WindowPosition({
          id: market.id, asset: market.asset,
          upTokenId: market.upTokenId, downTokenId: market.downTokenId,
          windowEndMs: market.endMs,
        });
        const entered = await pos.enter(yesPrice, noPrice, kellySizeBet(yesPrice + noPrice));
        if (entered) { simBalance -= pos.totalSpent ?? 0; activePositions.set(market.id, pos); stats.entered++; }
      } finally { enteringMarkets.delete(marketId); }
    })();
  });

  clobWs.onSweep(({ tokenId, marketId, side, price, rise }) => {
    if (activePositions.has(marketId) || enteringMarkets.has(marketId)) return;
    if (activePositions.size >= CONFIG.maxPositions) return;
    const market = marketList.find((m) => m.id === marketId);
    if (!market || market.endMs - Date.now() < 15_000) return;

    enteringMarkets.add(marketId);
    (async () => {
      try {
        const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
        const available = Math.max(0, simBalance - allocated);
        const betSize   = Math.min(CONFIG.maxTradeUsdc, available * 0.20);
        if (betSize < 1) return;
        const binanceOpenPrice = lateEntry.getOpenPrice(market.id) ?? feeds[market.asset]?.get() ?? null;
        const pos = new DirectionalPosition({
          id: market.id, asset: market.asset,
          side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
        });
        const entered = await pos.enter(price, betSize);
        if (entered) {
          simBalance -= pos.totalSpent ?? 0;
          activePositions.set(market.id, pos);
          lemStats.entered++;
          sweepStats.record({
            asset: market.asset, side, price, betSize,
            rise: rise.toFixed(3),
            remainingS: Math.round((market.endMs - Date.now()) / 1000),
            ts: Date.now(),
          });
        }
      } finally { enteringMarkets.delete(marketId); }
    })();
  });

  clobWs.connect();

  const refreshMarkets = async () => {
    let markets = [];
    try { markets = await fetchAll5minMarkets(); } catch { return; }
    for (const market of markets) {
      const openPx = feeds[market.asset]?.get() ?? null;
      lateEntry.recordOpen(market.id, openPx);
      sniper.recordOpen(market.id, openPx);
      fade.recordOpen(market.id, openPx);
    }
    clobWs.addMarkets(markets);
    marketList = markets;
  };

  const fallbackScan = async () => {
    if (isFallbackScanning) return;
    isFallbackScanning = true;
    try {
      const t = getThreshold();
      for (const market of marketList) {
        if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
        if (activePositions.size >= CONFIG.maxPositions) break;
        const upAge   = clobWs.getAgeMs(market.upTokenId);
        const downAge = clobWs.getAgeMs(market.downTokenId);
        if (upAge != null && downAge != null && upAge < 30_000 && downAge < 30_000) continue;

        let yesPrice, noPrice;
        try {
          const p = await fetchClobMidPrices(market.upTokenId, market.downTokenId);
          yesPrice = p.yesPrice; noPrice = p.noPrice;
        } catch { continue; }

        if (yesPrice == null || noPrice == null) continue;
        const combined = yesPrice + noPrice;
        if (combined >= t || market.endMs - Date.now() < 60_000) continue;

        enteringMarkets.add(market.id);
        try {
          const pos = new WindowPosition({
            id: market.id, asset: market.asset,
            upTokenId: market.upTokenId, downTokenId: market.downTokenId,
            windowEndMs: market.endMs,
          });
          const entered = await pos.enter(yesPrice, noPrice, kellySizeBet(combined));
          if (entered) { simBalance -= pos.totalSpent ?? 0; activePositions.set(market.id, pos); stats.entered++; }
        } finally { enteringMarkets.delete(market.id); }
      }
    } finally { isFallbackScanning = false; }
  };

  const tryCrossAssetEntry = (triggerAsset, triggerSide, triggerConf) => {
    const correlated =
      triggerAsset === "BTC"  ? ["ETH", "SOL", "XRP", "DOGE", "AVAX", "LINK", "MATIC"] :
      triggerAsset === "ETH"  ? ["SOL", "XRP", "LINK", "MATIC"] :
      triggerAsset === "SOL"  ? ["ETH", "AVAX"] :
      triggerAsset === "DOGE" ? ["XRP"] :
      triggerAsset === "AVAX" ? ["SOL", "LINK"] :
      triggerAsset === "LINK" ? ["ETH", "MATIC"] :
      triggerAsset === "MATIC"? ["ETH", "LINK"] : [];
    const crossConf = triggerConf * 0.75;
    if (crossConf < 0.15 || !correlated.length) return;

    const now = Date.now();
    for (const market of marketList) {
      if (!correlated.includes(market.asset)) continue;
      const wm        = market.windowMins ?? 5;
      const remaining = market.endMs - now;
      if (remaining < wm * 3_000 || remaining > wm * 36_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const binanceOpenPrice = lateEntry.getOpenPrice(market.id);
      if (!binanceOpenPrice) continue;
      const tokenId    = triggerSide === "UP" ? market.upTokenId : market.downTokenId;
      const { yesPrice, noPrice } = clobWs.getPrices(market.upTokenId, market.downTokenId);
      const entryPrice = triggerSide === "UP" ? yesPrice : noPrice;
      if (entryPrice == null || entryPrice > 0.85) continue;

      enteringMarkets.add(market.id);
      (async () => {
        try {
          const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
          const available = Math.max(0, simBalance - allocated);
          const betSize   = available * 0.15 * crossConf;
          if (betSize < 1) return;
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side: triggerSide, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          const entered = await pos.enter(entryPrice, betSize);
          if (entered) { simBalance -= pos.totalSpent ?? 0; activePositions.set(market.id, pos); lemStats.entered++; }
        } finally { enteringMarkets.delete(market.id); }
      })();
    }
  };

  const lateEntryCheck = () => {
    if (isLateEntryChecking) return;
    isLateEntryChecking = true;
    try {
      const now = Date.now();
      for (const market of marketList) {
        const wm        = market.windowMins ?? 5;
        if (wm > 15) continue; // LEM only meaningful on short windows
        const remaining = market.endMs - now;
        if (remaining < wm * 3_000 || remaining > wm * 36_000) continue;
        if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
        if (activePositions.size >= CONFIG.maxPositions) break;

        const currentPrice = feeds[market.asset]?.get() ?? null;
        if (!currentPrice) continue;

        const volPressure = feeds[market.asset]?.getVolPressure() ?? 0.5;
        const signal = lateEntry.getSignal(
          market.id, currentPrice, priceSnaps[market.asset] ?? [], market.asset, volPressure
        );
        if (!signal.side || signal.confidence < 0.10) continue;
        if (Math.abs(signal.delta) < CONFIG.momentumMinPct) continue;

        const binanceOpenPrice = lateEntry.getOpenPrice(market.id);
        if (!binanceOpenPrice) continue;
        const tokenId    = signal.side === "UP" ? market.upTokenId : market.downTokenId;
        const { yesPrice, noPrice } = clobWs.getPrices(market.upTokenId, market.downTokenId);
        const entryPrice = signal.side === "UP" ? yesPrice : noPrice;
        if (entryPrice == null || entryPrice > 0.85) continue;

        enteringMarkets.add(market.id);
        (async () => {
          try {
            const betSize = kellyBet(entryPrice, signal.confidence) * adaptive.getMultiplier(market.asset, "LEM");
            if (betSize < CONFIG.minBetUsdc) return;

            const pos = new DirectionalPosition({
              id: market.id, asset: market.asset,
              side: signal.side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
            });
            pos.enteredSecsLeft = Math.round((market.endMs - Date.now()) / 1000);
            pos.momentumPct = getMomentum(market.asset);
            const entered = await pos.enter(entryPrice, betSize);
            if (entered) {
              simBalance -= pos.totalSpent ?? 0;
              activePositions.set(market.id, pos);
              lemStats.entered++;
              if (signal.confidence >= 0.5) tryCrossAssetEntry(market.asset, signal.side, signal.confidence);
            }
          } finally { enteringMarkets.delete(market.id); }
        })();
      }
    } finally { isLateEntryChecking = false; }
  };

  const fadeCheck = () => {
    for (const market of marketList) {
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const { yesPrice, noPrice } = clobWs.getPrices(market.upTokenId, market.downTokenId);
      const signal = fade.getSignal(market, yesPrice, noPrice);
      if (!signal.side) continue;

      const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const available = Math.max(0, simBalance - allocated);
      const betSize   = Math.min(fade.calcBetSize(simBalance), available) * adaptive.getMultiplier(market.asset, "FADE");
      if (betSize < 1) continue;

      fade.markFired(market.id);
      enteringMarkets.add(market.id);
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side: signal.side, tokenId: signal.tokenId,
            binanceOpenPrice: fade.getOpenPrice ? fade._openPrices.get(market.id)?.price : null,
            windowEndMs: market.endMs,
          });
          pos.enteredSecsLeft = Math.round((market.endMs - Date.now()) / 1000);
          pos.momentumPct = getMomentum(market.asset);
          pos.fade = true;
          const entered = await pos.enter(signal.tokenPrice, betSize);
          if (entered) {
            simBalance -= pos.totalSpent ?? 0;
            activePositions.set(market.id, pos);
            fadeStats.entered++;
          } else {
            fade.clearMarket(market.id);
          }
        } finally { enteringMarkets.delete(market.id); }
      })();
    }
  };

  const sniperCheck = () => {
    const now = Date.now();
    for (const market of marketList) {
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue; // sniper targets short windows only
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const currentPrice = feeds[market.asset]?.get() ?? null;
      const { yesPrice, noPrice } = clobWs.getPrices(market.upTokenId, market.downTokenId);
      const signal = sniper.getSignal(market, yesPrice, noPrice, currentPrice);
      if (!signal.side) continue;

      const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const available = Math.max(0, simBalance - allocated);
      const betSize   = Math.min(sniper.calcBetSize(signal.tokenPrice, simBalance), available) * adaptive.getMultiplier(market.asset, "SNIPER");
      if (betSize < sniper.cfg.minBetUsdc) continue;

      sniper.markFired(market.id);
      enteringMarkets.add(market.id);

      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side: signal.side, tokenId: signal.tokenId,
            binanceOpenPrice: sniper.getOpenPrice(market.id),
            windowEndMs: market.endMs,
          });
          pos.enteredSecsLeft = Math.round((market.endMs - Date.now()) / 1000);
          pos.momentumPct = getMomentum(market.asset);
          pos.sniper      = true;
          pos.sniperDelta = signal.delta;
          const entered = await pos.enter(signal.tokenPrice, betSize);
          if (entered) {
            simBalance -= pos.totalSpent ?? 0;
            activePositions.set(market.id, pos);
            sniperStats.entered++;
          } else {
            sniper.clearMarket(market.id); // allow retry if entry failed
          }
        } finally { enteringMarkets.delete(market.id); }
      })();
    }
  };

  const monitor = async () => {
    if (isMonitoring) return;
    isMonitoring = true;
    try {
      for (const [id, pos] of activePositions) {
        if (pos.type === "directional") {
          if (!pos.sniper && !pos.expired && pos.filled) {
            const tokenPrice = clobWs.getMid(pos.tokenId);
            const secsLeft   = pos.remainingMs / 1000;
            if (
              tokenPrice != null &&
              tokenPrice >= CONFIG.earlyExitMinPrice &&
              secsLeft <= CONFIG.earlyExitMaxSecs
            ) {
              pos.resolveEarly(tokenPrice);
              const s = pos.summary;
              simBalance += s.payout;
              logTrade({ ...s, strategy: "LEM-EARLY" });
              lemStats.record(s);
              lateEntry.clearMarket(id);
              clobWs.removeMarket(id);
              activePositions.delete(id);
              continue;
            }
          }
          await pos.tick().catch(() => {});
          if (pos.expired) {
            await pos.cancelAll().catch(() => {});
            pos.resolveInSim(feeds[pos.asset]?.get() ?? null);
            const s = pos.summary;
            simBalance += s.payout;
            if (pos.sniper) {
              logTrade({ ...s, strategy: "SNIPER" });
              sniperStats.record(s);
              sniper.recordResult(s.won);
              if (s.won !== null) adaptive.record(pos.asset, "SNIPER", s.won);
              sniper.clearMarket(id);
            } else if (pos.fade) {
              logTrade({ ...s, strategy: "FADE" });
              fadeStats.record(s);
              fade.recordResult(s.won);
              if (s.won !== null) adaptive.record(pos.asset, "FADE", s.won);
              fade.clearMarket(id);
            } else {
              logTrade({ ...s, strategy: "LEM" });
              lemStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "LEM", s.won);
              lateEntry.clearMarket(id);
            }
            clobWs.removeMarket(id);
            activePositions.delete(id);
          }
        } else {
          let { yesPrice, noPrice } = clobWs.getPrices(pos.upTokenId, pos.downTokenId);
          const upAge = clobWs.getAgeMs(pos.upTokenId);
          if (yesPrice == null || noPrice == null || (upAge != null && upAge > 15_000)) {
            try {
              const p = await fetchClobMidPrices(pos.upTokenId, pos.downTokenId);
              if (p.yesPrice != null) yesPrice = p.yesPrice;
              if (p.noPrice  != null) noPrice  = p.noPrice;
            } catch { /* keep stale */ }
          }
          await pos.tick(yesPrice, noPrice).catch(() => {});
          if (pos.expired) {
            await pos.cancelAll().catch(() => {});
            const s = pos.summary;
            if (s.upFilled && s.downFilled) simBalance += (s.shares ?? 0) * 1.00;
            else if (s.upFilled || s.downFilled) simBalance += (s.shares ?? 0) * 0.50;
            else simBalance += s.totalSpent ?? 0;
            logTrade(s);
            stats.record(pos);
            clobWs.removeMarket(id);
            activePositions.delete(id);
          }
        }
      }
    } finally { isMonitoring = false; }
  };

  const getOpportunities = () => {
    const t = getThreshold();
    return marketList
      .filter((m) => !activePositions.has(m.id))
      .map((m) => ({ ...m, ...clobWs.getPrices(m.upTokenId, m.downTokenId) }))
      .filter(({ yesPrice, noPrice }) => yesPrice != null && noPrice != null && yesPrice + noPrice < t)
      .sort((a, b) => (a.yesPrice + a.noPrice) - (b.yesPrice + b.noPrice));
  };

  startWebServer(() => ({
    mode:        LIVE ? "LIVE" : "SIM",
    balance:     LIVE ? usdcBalance : simBalance,
    walletAddr,
    wsConnected: clobWs.connected,
    wsMarkets:   clobWs.marketCount,
    assets:      CONFIG.assets,
    prices:      Object.fromEntries(CONFIG.assets.map(a => [a, feeds[a]?.get() ?? null])),
    momentums:   Object.fromEntries(CONFIG.assets.map(a => [a, getMomentum(a)])),
    activePositions: [...activePositions.values()].map(p => p.summary),
    arb:    { entered: stats.entered, bothFilled: stats.bothFilled, oneSide: stats.oneFilled, noFills: stats.noFills },
    lem:    { entered: lemStats.entered, won: lemStats.won, lost: lemStats.lost, totalSpent: lemStats.totalSpent, totalPayout: lemStats.totalPayout },
    sniper: { entered: sniperStats.entered, won: sniperStats.won, lost: sniperStats.lost, totalSpent: sniperStats.totalSpent, totalPayout: sniperStats.totalPayout, winRate: sniper.winRate, tradeCount: sniper.tradeCount },
    fade:   { entered: fadeStats.entered, won: fadeStats.won, lost: fadeStats.lost, totalSpent: fadeStats.totalSpent, totalPayout: fadeStats.totalPayout, winRate: fade.winRate },
    sweep:  { followed: sweepStats.followed },
    wsSample: marketList.slice(0, 16).map(m => {
      const { yesPrice, noPrice } = clobWs.getPrices(m.upTokenId, m.downTokenId);
      return { asset: m.asset, up: yesPrice, dn: noPrice, endMs: m.endMs };
    }),
    recentTrades: [...sniperStats.history, ...lemStats.history, ...stats.history]
      .sort((a, b) => (b.enteredAt ?? 0) - (a.enteredAt ?? 0)).slice(0, 15),
    analytics: _analytics,
    adaptive:  adaptive.getStats(),
    timestamp: Date.now(),
  }));

  await refreshMarkets();
  setInterval(refreshMarkets,  CONFIG.refreshMs.marketRefresh);
  setInterval(fallbackScan,    CONFIG.refreshMs.scan);
  setInterval(monitor,         CONFIG.refreshMs.clob);
  setInterval(lateEntryCheck,  2_000);
  setInterval(sniperCheck,     2_000);
  setInterval(fadeCheck,       2_000);
  setInterval(() => saveSimState(simBalance), CONFIG.refreshMs.simSave);
  setInterval(async () => { try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ } }, 60_000);
  try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ }

  const runAnalysis = () => { try { _analytics = analyzeTrades(); } catch { /* ignore */ } };
  setInterval(runAnalysis, 5 * 60_000); // re-analyze every 5 min
  runAnalysis(); // run once at startup

  setInterval(() => {
    render({
      feedPrices:   Object.fromEntries(Object.entries(feeds).map(([a, f]) => [a, f.get()])),
      feedMoms:     Object.fromEntries(CONFIG.assets.map((a) => [a, getMomentum(a)])),
      feeds, lateEntry,
      activePositions, stats, lemStats, sweepStats, sniperStats, sniper, usdcBalance, walletAddr,
      opportunities: getOpportunities(),
      now:           Date.now(),
      simBalance,
      wsConnected:   clobWs.connected,
      wsLastUpdate:  clobWs.lastUpdate,
      wsMarkets:     clobWs.marketCount,
    });
  }, CONFIG.refreshMs.display);

  process.on("SIGINT", async () => {
    clobWs.close();
    for (const feed of Object.values(feeds)) feed.close();
    saveSimState(simBalance);
    for (const [, pos] of activePositions) await pos.cancelAll().catch(() => {});
    const lemPnl    = lemStats.totalPayout - lemStats.totalSpent;
    const sniperPnl = sniperStats.totalPayout - sniperStats.totalSpent;
    process.stdout.write(
      `\n\nStopped.\n` +
      `ARB:    entered=${stats.entered}  both-filled=${stats.bothFilled}\n` +
      `LEM:    entered=${lemStats.entered}  won=${lemStats.won}  lost=${lemStats.lost}  P&L=${fmtUsd(lemPnl)}\n` +
      `SNIPER: entered=${sniperStats.entered}  won=${sniperStats.won}  lost=${sniperStats.lost}  P&L=${fmtUsd(sniperPnl)}\n` +
      `Sim balance: ${fmtUsd(simBalance)} (saved)\n`
    );
    process.exit(0);
  });
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
