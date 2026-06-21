/**
 * Polymarket Arb Bot — BTC ETH SOL XRP DOGE AVAX LINK MATIC
 * Strategies: ARB | LEM | Cross-Asset | Sweep Follow
 */

import WebSocket from "ws";
import { CONFIG } from "./config.js";
import { fetchAllBinaryMarkets, fetchClobMidPrices } from "./data/polymarket.js";
import { ClobWsFeed } from "./data/clobWs.js";
import { getUserOrderFeed } from "./data/clobUserWs.js";
import { BinanceWsFeed } from "./data/binanceWs.js";
import { logTrade, loadTrades } from "./data/logger.js";
import { loadSimState, saveSimState } from "./data/simState.js";
import { WindowPosition } from "./live/positions.js";
import { DirectionalPosition } from "./live/directional.js";
import { LateEntrySignal } from "./strategies/lateEntry.js";
import { ContrarianSniper } from "./strategies/contrarian.js";
import { FadeMomentum } from "./strategies/fadeMomentum.js";
import { LIVE, getUsdcBalance } from "./live/orders.js";
import { startLiqFeed, stopLiqFeed, onLiquidationCascade } from "./live/liqFeed.js";
import { startFuturesFeed, stopFuturesFeed, getOIDelta, getFundingData } from "./live/futuresFeed.js";
import { startTradeFlow, stopTradeFlow, getVolumeSpike, getBuyPressure } from "./live/tradeFlow.js";
import { getEventMultiplier, getCurrentEvent } from "./live/fedWatch.js";
import { startWhaleFeed, stopWhaleFeed, getWhaleSignal } from "./live/whaleFeed.js";
import { startDeribitFeed, stopDeribitFeed, getDeribitGamma } from "./live/deribitFeed.js";
import { startUmaFeed, stopUmaFeed, getUmaSettlement, getUmaStats } from "./live/umaOracleFeed.js";
import { startResearchAgent, stopResearchAgent } from "./research/agent.js";
import { fmtUsd, fmtTime, fmtDuration, pad } from "./utils.js";
import { startWebServer } from "./web/server.js";
import { analyzeTrades } from "./analytics/analyzer.js";
import { AdaptiveSizer } from "./analytics/adaptive.js";
import { findLogicalPairs, buildTokenIndex, CrossArbPosition } from "./strategies/logicalArb.js";

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


function startPriceFeeds(assets) {
  const feed = new BinanceWsFeed(assets);
  feed.connect();

  return Object.fromEntries(assets.map(a => [a, {
    get:            () => feed.get(a),
    getVolPressure: () => feed.getVolPressure(a),
    close:          () => feed.close(),
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

class DirectionalStats {
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
  activePositions, stats, lemStats, lbStats, osStats, fsStats, ciStats, mrStats, opsStats, csStats,
  sweepStats, sniperStats, sniper, usdcBalance,
  walletAddr, opportunities, now, simBalance, expiredBuf,
  wsConnected, wsLastUpdate, wsMarkets,
  mrOrders, marketList, clobWs,
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

  // Event calendar + whale signals on one info row
  const ev = getCurrentEvent();
  const evStr = ev
    ? `${ev.minutesUntil > 0 ? `${C.yellow}▲ ${ev.name} in ${ev.minutesUntil}m (${ev.multiplier}×)` : `${C.bred}▲ ${ev.name} LIVE`}${C.reset}`
    : `${C.dim}No macro events <5h${C.reset}`;
  const whaleStr = ["BTC","ETH","SOL"].map(a => {
    const w = getWhaleSignal(a);
    if (!w) return null;
    const clr = w.direction === "UP" ? C.bgreen : C.bred;
    const arrow = w.direction === "UP" ? "↑" : "↓";
    return `${clr}${a}${arrow}$${(w.usdTotal / 1e6).toFixed(0)}M${C.reset}`;
  }).filter(Boolean).join(" ");
  const gammaStr = ["BTC","ETH"].map(a => {
    const g = getDeribitGamma(a);
    if (!g) return null;
    const clr = g.direction === "UP" ? C.bgreen : C.bred;
    const arrow = g.direction === "UP" ? "↑" : "↓";
    return `${clr}${a}${arrow}γ${Math.round(g.strength * 100)}%${C.reset}`;
  }).filter(Boolean).join(" ");
  out.push(row(`${evStr}${whaleStr ? `  │  Whale: ${whaleStr}` : ""}${gammaStr ? `  │  γ: ${gammaStr}` : ""}`));
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
        if (pos.oracleSnipe) {
          const dPct = pos.osDelta != null ? ` Δ=${(pos.osDelta * 100).toFixed(2)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.bgreen}OS ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${dPct}  oracle pending  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else if (pos.fundingSnipe) {
          const fPct = pos.fsFundingRate != null ? ` fr=${(pos.fsFundingRate * 100).toFixed(4)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.yellow}FS ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${fPct}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else if (pos.openSnipe) {
          const dPct = pos.osDelta != null ? ` Δ=${(pos.osDelta * 100).toFixed(2)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.bgreen}OPS ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${dPct}${pos.opsCarry ? " CARRY" : ""}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else if (pos.clobImb) {
          const iPct = pos.clobImbRatio != null ? ` imb=${(pos.clobImbRatio * 100).toFixed(0)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.yellow}CI ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${iPct}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else if (pos.latencyBond) {
          const dPct = pos.lbDelta != null ? ` Δ=${(pos.lbDelta * 100).toFixed(2)}%` : "";
          out.push(row(
            `${C.cyan}${s.asset}${C.reset} ${C.bgreen}LB ${s.side}${C.reset}  ` +
            `@${((s.entryPrice ?? 0) * 100).toFixed(1)}¢${dPct}  ${fmtDuration(s.remainingMs)} left  ` +
            `$${s.totalSpent?.toFixed(2)}  pot +$${pot}`
          ));
        } else if (pos.sniper) {
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
  out.push(sec("OPENSNIPE  (buy at market open 3-35s, Binance ≥0.8% move, ask ≤0.52)"));
  const opsTotal = opsStats.won + opsStats.lost;
  const opsWr    = opsTotal > 0 ? `${Math.round((opsStats.won / opsTotal) * 100)}%` : "--";
  const opsPnl   = opsStats.totalPayout - opsStats.totalSpent;
  out.push(row(
    `Entered: ${opsStats.entered}  │  Won: ${C.green}${opsStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${opsStats.lost}${C.reset}  │  WR: ${opsTotal > 0 ? C.bgreen : C.dim}${opsWr}${C.reset}`
  ));
  if (opsStats.entered > 0) {
    const pnlClr = opsPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${opsPnl >= 0 ? "+" : ""}${fmtUsd(opsPnl)}${C.reset}  │  Spent: ${fmtUsd(opsStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching for new markets trending ≥0.3% at open before LPs calibrate...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("LATENCYBOND  (Binance lag arb — 50-120s left, time-scaled Δ, ask ≤0.70)"));
  const lbTotal  = lbStats.won + lbStats.lost;
  const lbWr     = lbTotal > 0 ? `${Math.round((lbStats.won / lbTotal) * 100)}%` : "--";
  const lbPnl    = lbStats.totalPayout - lbStats.totalSpent;
  out.push(row(
    `Entered: ${lbStats.entered}  │  Won: ${C.green}${lbStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${lbStats.lost}${C.reset}  │  Win rate: ${lbTotal > 0 ? C.bgreen : C.dim}${lbWr}${C.reset}`
  ));
  if (lbStats.entered > 0) {
    const pnlClr = lbPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${lbPnl >= 0 ? "+" : ""}${fmtUsd(lbPnl)}${C.reset}  │  Spent: ${fmtUsd(lbStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching for 5-min markets with 45-150s left and ≥0.5% Binance move...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("CLOSESNIPE  (buy near-certain side @$0.99 — last 10-60s, ask 0.85-0.99)"));
  const csTotal  = csStats.won + csStats.lost;
  const csWr     = csTotal > 0 ? `${Math.round((csStats.won / csTotal) * 100)}%` : "--";
  const csPnl    = csStats.totalPayout - csStats.totalSpent;
  out.push(row(
    `Entered: ${csStats.entered}  │  Won: ${C.green}${csStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${csStats.lost}${C.reset}  │  Win rate: ${csTotal > 0 ? C.bgreen : C.dim}${csWr}${C.reset}`
  ));
  if (csStats.entered > 0) {
    const pnlClr = csPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${csPnl >= 0 ? "+" : ""}${fmtUsd(csPnl)}${C.reset}  │  Spent: ${fmtUsd(csStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching final 10-60s of 5-min markets for a near-certain side...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("ORACLESNIPE  (post-close stale CLOB — 90min UMA window, ≤0.90 ask)"));
  const osTotal = osStats.won + osStats.lost;
  const osWr    = osTotal > 0 ? `${Math.round((osStats.won / osTotal) * 100)}%` : "--";
  const osPnl   = osStats.totalPayout - osStats.totalSpent;
  out.push(row(
    `Entered: ${osStats.entered}  │  Won: ${C.green}${osStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${osStats.lost}${C.reset}  │  Win rate: ${osTotal > 0 ? C.bgreen : C.dim}${osWr}${C.reset}  │  ` +
    `${C.dim}Buffered: ${expiredBuf}${C.reset}`
  ));
  if (osStats.entered > 0) {
    const pnlClr = osPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${osPnl >= 0 ? "+" : ""}${fmtUsd(osPnl)}${C.reset}  │  Spent: ${fmtUsd(osStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching post-close CLOBs on all 8 assets for stale asks ≤0.90...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("FUNDINGSNIPE  (extreme perp funding → opposite squeeze, ≤0.58 ask)"));
  const fsTotal = fsStats.won + fsStats.lost;
  const fsWr    = fsTotal > 0 ? `${Math.round((fsStats.won / fsTotal) * 100)}%` : "--";
  const fsPnl   = fsStats.totalPayout - fsStats.totalSpent;

  // Show live funding rates for BTC / ETH / SOL
  const fRates = ["BTC", "ETH", "SOL"].map(a => {
    const d = getFundingData(a);
    if (!d) return `${a}:--`;
    const r = (d.rate * 100).toFixed(4);
    const clr = d.rate > 0.0004 ? C.bred : d.rate < -0.0002 ? C.bgreen : C.dim;
    return `${clr}${a}:${d.rate >= 0 ? "+" : ""}${r}%${C.reset}`;
  }).join("  ");
  out.push(row(`Rates: ${fRates}  │  Entered: ${fsStats.entered}  │  Won: ${C.green}${fsStats.won}${C.reset}  │  Lost: ${C.red}${fsStats.lost}${C.reset}  │  WR: ${fsTotal > 0 ? C.bgreen : C.dim}${fsWr}${C.reset}`));
  if (fsStats.entered > 0) {
    const pnlClr = fsPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${fsPnl >= 0 ? "+" : ""}${fmtUsd(fsPnl)}${C.reset}  │  Spent: ${fmtUsd(fsStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching BTC/ETH/SOL/XRP/DOGE/AVAX/LINK/MATIC funding for extreme readings...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("CLOBIMB  (order-book imbalance >80% bid depth → buy before reprice)"));
  const ciTotal = ciStats.won + ciStats.lost;
  const ciWr    = ciTotal > 0 ? `${Math.round((ciStats.won / ciTotal) * 100)}%` : "--";
  const ciPnl   = ciStats.totalPayout - ciStats.totalSpent;

  // Show live imbalance readings across active markets
  const topImbs = [...new Set(marketList.map(m => m.asset))].slice(0, 5).map(asset => {
    const mkt = marketList.find(m => m.asset === asset);
    if (!mkt) return null;
    const upI = clobWs.getImbalance(mkt.upTokenId);
    const dnI = clobWs.getImbalance(mkt.downTokenId);
    if (upI == null && dnI == null) return null;
    const best = (upI ?? 0) > (dnI ?? 0) ? upI : dnI;
    const dir  = (upI ?? 0) > (dnI ?? 0) ? "↑" : "↓";
    const clr  = best > 0.80 ? C.bgreen : C.dim;
    return `${clr}${asset}${dir}${Math.round(best * 100)}%${C.reset}`;
  }).filter(Boolean).join("  ");
  out.push(row(
    `Entered: ${ciStats.entered}  │  Won: ${C.green}${ciStats.won}${C.reset}  │  ` +
    `Lost: ${C.red}${ciStats.lost}${C.reset}  │  WR: ${ciTotal > 0 ? C.bgreen : C.dim}${ciWr}${C.reset}` +
    (topImbs ? `  │  ${topImbs}` : "")
  ));
  if (ciStats.entered > 0) {
    const pnlClr = ciPnl >= 0 ? C.bgreen : C.bred;
    out.push(row(`P&L: ${pnlClr}${ciPnl >= 0 ? "+" : ""}${fmtUsd(ciPnl)}${C.reset}  │  Spent: ${fmtUsd(ciStats.totalSpent)}`));
  } else {
    out.push(row(`${C.dim}Watching CLOB book snapshots for 80%+ bid-depth imbalance...${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("MAKERREBATE  (market-neutral, post bids on 50/50 markets, earn 0.45% rebate)"));
  const mrTotal = mrStats.won + mrStats.lost;
  const mrPnl   = mrStats.totalPayout - mrStats.totalSpent;
  out.push(row(
    `Orders active: ${mrOrders.size}  │  Filled pairs: ${mrStats.entered}  │  ` +
    `Won: ${C.green}${mrStats.won}${C.reset}  │  Lost: ${C.red}${mrStats.lost}${C.reset}  │  ` +
    `P&L: ${mrPnl >= 0 ? C.bgreen : C.bred}${mrPnl >= 0 ? "+" : ""}${fmtUsd(mrPnl)}${C.reset}`
  ));

  out.push(row(""));
  out.push(sec("RECENT COMPLETED"));
  const recentAll = [
    ...stats.history.slice(0, 2).map((s) => ({ ...s, _src: "arb" })),
    ...opsStats.history.slice(0, 2).map((s) => ({ ...s, _src: "ops" })),
    ...lbStats.history.slice(0, 2).map((s) => ({ ...s, _src: "lb" })),
    ...osStats.history.slice(0, 2).map((s) => ({ ...s, _src: "os" })),
    ...fsStats.history.slice(0, 1).map((s) => ({ ...s, _src: "fs" })),
    ...ciStats.history.slice(0, 1).map((s) => ({ ...s, _src: "ci" })),
  ].sort((a, b) => (b.settledAt ?? 0) - (a.settledAt ?? 0)).slice(0, 6);
  if (recentAll.length === 0) {
    out.push(row(`${C.dim}None yet${C.reset}`));
  } else {
    for (const s of recentAll) {
      if (s._src === "os" || s._src === "lb" || s._src === "fs" || s._src === "ci" || s._src === "ops") {
        const tag  = s._src === "os" ? "OS" : s._src === "fs" ? "FS" : s._src === "ci" ? "CI" : s._src === "ops" ? "OPS" : "LB";
        const clr  = s.won === true ? C.green : s.won === false ? C.red : C.dim;
        const mark = s.won === true ? "✓" : s.won === false ? "✗" : "?";
        out.push(row(
          `${clr}${mark} ${tag} ${s.asset} ${s.side}  @${((s.entryPrice ?? 0) * 100).toFixed(1)}¢  ` +
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

  // Fast 5-second snapshots for spike detection (keep last 24 = 2 minutes)
  const fastSnaps = Object.fromEntries(CONFIG.assets.map((a) => [a, []]));
  const snapFast = () => {
    for (const [asset, feed] of Object.entries(feeds)) {
      const p = feed.get();
      if (p) {
        fastSnaps[asset].push({ price: p, ts: Date.now() });
        if (fastSnaps[asset].length > 24) fastSnaps[asset].shift();
      }
    }
  };
  setInterval(snapFast, 5_000);
  snapFast();

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
  const sniperStats   = new SniperStats();
  const fadeStats     = new FadeStats();
  const cascadeStats  = new DirectionalStats();  // liquidation cascade (disabled)
  const spikeStats    = new DirectionalStats();  // macro price spike (disabled)
  const openStats     = new DirectionalStats();  // market open front-run (disabled)
  const lbStats       = new DirectionalStats();  // latency bond — primary strategy
  const osStats       = new DirectionalStats();  // oracle snipe — post-close resolution lag
  const fsStats       = new DirectionalStats();  // funding snipe — extreme perp funding squeeze
  const ciStats       = new DirectionalStats();  // CLOB order book imbalance signal
  const mrStats       = new DirectionalStats();  // maker rebate farming (market-neutral)
  const opsStats      = new DirectionalStats();  // opening price snipe (TIER 0)
  const csStats       = new DirectionalStats();  // close snipe — buy near-certain side at $0.99 right before resolution
  const fade          = new FadeMomentum();
  const adaptive      = new AdaptiveSizer();
  let _analytics      = null;
  const marketOpenFired  = new Set();
  let _lastSpikeFire     = 0;
  const _cascadeCooldown = new Map();
  const _closeSnaps      = new Map();  // marketId → { closePrice, openPrice, endMs }
  const _osEntered       = new Set();  // prevent double-entering same expired market
  const expiredMarketBuf = new Map();  // marketId → market (keeps expired markets for OS scanning)
  const _mrOrders          = new Map(); // marketId → { upOrder, dnOrder, asset, placedAt }
  const _confluentMarkets  = new Map(); // marketId → { lbTs, side } for confluence detection
  const _opsEntered        = new Set(); // prevent double-entering same market in openingPriceSnipe
  const _recentSettlements = new Map(); // asset → { side, settledAt } for consecutive carry
  const _gammaResolution   = new Map(); // marketId → { side, confirmedAt } — gamma API certainty
  const _gammaLastFetch    = new Map(); // marketId → lastFetchMs (rate-limit per market)

  // Per-asset CLOB liquidity cap — prevents pushing thin markets
  const ASSET_CLOB_CAP = {
    BTC: 5000, ETH: 5000, SOL: 3000,
    XRP: 2500, DOGE: 2000, AVAX: 1500, LINK: 1500, MATIC: 1500,
    BNB: 2000, ADA: 1500, DOT: 1500, TRX: 1500, TON: 1500,
    SHIB: 1000, PEPE: 1000, UNI: 1500, ATOM: 1500, NEAR: 1500,
    APT: 1500, SUI: 1500, ARB: 1500, OP: 1500, INJ: 1500,
  };

  // Minimum absolute USD move for LatencyBond entry (from Novals83 5min-btc-polymarket repo).
  // BTC: $70 (repo reference). Others: ~0.11% of typical price (same relative magnitude).
  // Replaces the old time-scaled % threshold — absolute moves are more stable signal.
  const LB_MIN_USD = {
    BTC: 70,     ETH: 5.0,    SOL: 0.18,   XRP: 0.0007,  DOGE: 0.00015,
    AVAX: 0.04,  LINK: 0.015, MATIC: 0.001, BNB: 0.65,   ADA: 0.0004,
    DOT: 0.007,  TRX: 0.0001, TON: 0.005,  SHIB: 1e-9,   PEPE: 1.5e-9,
    UNI: 0.008,  ATOM: 0.007, NEAR: 0.004, APT: 0.010,   SUI: 0.0015,
    ARB: 0.0008, OP: 0.0015,  INJ: 0.02,
  };

  // Per-asset OracleSnipe staleness window + delta floor (thin assets stay stale far longer)
  const OS_TIER = {
    BTC:  { maxMsPost:  6 * 60_000, minDelta: 0.005 },
    ETH:  { maxMsPost:  8 * 60_000, minDelta: 0.005 },
    SOL:  { maxMsPost: 17 * 60_000, minDelta: 0.004 },
    XRP:  { maxMsPost: 28 * 60_000, minDelta: 0.003 },
    DOGE: { maxMsPost: 28 * 60_000, minDelta: 0.003 },
    AVAX: { maxMsPost: 50 * 60_000, minDelta: 0.002 },
    LINK: { maxMsPost: 50 * 60_000, minDelta: 0.002 },
    MATIC:{ maxMsPost: 67 * 60_000, minDelta: 0.001 },
    // New assets — moderate-liquidity tier
    BNB:  { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    ADA:  { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    DOT:  { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    TRX:  { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    UNI:  { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    ATOM: { maxMsPost: 20 * 60_000, minDelta: 0.003 },
    // New assets — lower-liquidity tier
    TON:  { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    NEAR: { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    APT:  { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    SUI:  { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    ARB:  { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    OP:   { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    INJ:  { maxMsPost: 30 * 60_000, minDelta: 0.003 },
    // Meme tokens — very wide staleness window
    SHIB: { maxMsPost: 45 * 60_000, minDelta: 0.002 },
    PEPE: { maxMsPost: 45 * 60_000, minDelta: 0.002 },
  };

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
  let startBalance        = CONFIG.paper.startBalance;
  let _arbSeq             = 0;   // unique suffix for multi-ARB position IDs
  const _mktArbCounts     = new Map(); // marketId → active ARB position count (O(1) hot-path lookup)
  const _logicalArbPairs  = new Set(); // active cross-market pair keys → prevent duplicate entries
  let isLogicalArbChecking = false;
  const crossArbStats     = { entered: 0, bothFilled: 0, oneFilled: 0, noFills: 0, guaranteedProfit: 0, totalSpent: 0 };
  const makerArbStats     = { entered: 0, bothFilled: 0, oneFilled: 0, noFills: 0, guaranteedProfit: 0, totalSpent: 0 };
  let _xarbPairsByToken   = new Map(); // tokenId → [pair] — rebuilt on each market refresh for O(1) WS lookup

  // Load all past trades from disk for history table + chart reconstruction
  const allTradeHistory   = loadTrades().sort((a, b) => (a.enteredAt ?? 0) - (b.enteredAt ?? 0));

  // Reconstruct pnlHistory from past trades so the chart shows the full journey
  let _runBal = startBalance;
  const pnlHistory = [{ t: allTradeHistory[0]?.enteredAt ?? Date.now(), v: startBalance }];
  for (const t of allTradeHistory) {
    if (t.enteredAt && t.payout != null && t.totalSpent != null) {
      _runBal += (t.payout - t.totalSpent);
      pnlHistory.push({ t: t.enteredAt, v: _runBal });
    }
  }
  pnlHistory.push({ t: Date.now(), v: simBalance }); // anchor to current live balance

  const trackPnl = () => {
    pnlHistory.push({ t: Date.now(), v: simBalance });
    if (pnlHistory.length > 1000) pnlHistory.splice(0, pnlHistory.length - 1000);
  };
  let marketList          = [];
  let arbMarketList       = []; // broader binary markets for ARB-only scanning
  let isMonitoring        = false;
  let isFallbackScanning  = false;
  let isLateEntryChecking = false;

  const getThreshold = () => {
    const base = Number(process.env.COMBINED_THRESHOLD) || CONFIG.combinedThreshold;
    // During volume spikes, arb windows widen — lower threshold to capture them
    const spiking = CONFIG.assets.some(a => (getVolumeSpike(a) ?? 0) > 3.0);
    return spiking ? Math.min(base, 0.95) : base;
  };

  const kellySizeBet = (combined) => {
    // simBalance is already decremented by prior reservations — no need to recompute allocated
    const kelly = simBalance * ((1 - combined) / combined) * 1.5;
    const tradeCap = CONFIG.maxTradeUsdc ?? Infinity;
    return Math.max(1, Math.min(kelly, simBalance * 0.35, tradeCap));
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

  // Liquidity-aware bet sizer: scales with balance but respects CLOB depth per asset.
  // At $500 → small bets, trade frequently. At $50k → capped by thin-market liquidity.
  const dynamicBetSize = (asset, pct, multiplier = 1) => {
    const allocated    = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
    const available    = Math.max(0, simBalance - allocated);
    const liquidityCap = ASSET_CLOB_CAP[asset] ?? 2000;
    const tradeCap     = CONFIG.maxTradeUsdc ?? Infinity;
    const raw = simBalance * pct * multiplier;
    return Math.max(CONFIG.minBetUsdc, Math.min(raw, available, liquidityCap, tradeCap));
  };

  const clobWs = new ClobWsFeed();
  clobWs.setThreshold(getThreshold());
  clobWs.setMakerThreshold(CONFIG.makerArbThreshold);

  let _reservedUsdc = 0;

  clobWs.onOpportunity((marketId, yesPrice, noPrice) => {
    if ((_mktArbCounts.get(marketId) ?? 0) >= 8 || enteringMarkets.has(marketId)) return;
    if (activePositions.size >= CONFIG.maxPositions) return;
    const market = marketList.find((m) => m.id === marketId) ?? arbMarketList.find((m) => m.id === marketId);
    if (!market || market.endMs - Date.now() < 10_000) return;

    const askYes = clobWs.getAsk(market.upTokenId) ?? yesPrice;
    const askNo  = clobWs.getAsk(market.downTokenId) ?? noPrice;
    if (askYes + askNo >= getThreshold()) return;

    const bet = kellySizeBet(askYes + askNo);
    if (bet < 1) return;
    simBalance -= bet;
    _reservedUsdc += bet;
    enteringMarkets.add(marketId);
    const posId = `${market.id}_arb${_arbSeq++}`;
    (async () => {
      try {
        const pos = new WindowPosition({
          id: posId, asset: market.asset,
          upTokenId: market.upTokenId, downTokenId: market.downTokenId,
          windowEndMs: market.endMs,
        });
        pos.marketId = market.id;
        const entered = await pos.enter(askYes, askNo, bet);
        if (entered) {
          activePositions.set(posId, pos);
          _mktArbCounts.set(market.id, (_mktArbCounts.get(market.id) ?? 0) + 1);
          stats.entered++;
          simBalance += bet - (pos.totalSpent ?? 0);
        } else {
          simBalance += bet;
        }
      } catch { simBalance += bet; } finally { _reservedUsdc -= bet; enteringMarkets.delete(marketId); }
    })();
  });

  // ── Maker ARB ─────────────────────────────────────────────────────────────
  // Fires when combined ASK < 1.005. Post limit bids 1 tick below each ask:
  //   net cost ≈ (combined_ask - 0.02) × 0.9955 after rebate — profitable up to combined_ask ≈ 1.024
  // Far more opportunities than taker ARB (combined_ask < 0.98).
  const enteringMakerMarkets = new Set();
  clobWs.onMakerOpportunity((marketId, askYes, askNo) => {
    if ((_mktArbCounts.get(marketId) ?? 0) >= 8 || enteringMakerMarkets.has(marketId)) return;
    if (activePositions.size >= CONFIG.maxPositions) return;
    const market = marketList.find((m) => m.id === marketId) ?? arbMarketList.find((m) => m.id === marketId);
    // Maker orders need more time to fill — skip markets < 45s from expiry
    if (!market || market.endMs - Date.now() < 45_000) return;

    // Post 1 tick (0.01) below each ask → resting limit order → earn maker rebate +0.45%
    const makerYes = Math.max(0.01, parseFloat((askYes - 0.01).toFixed(2)));
    const makerNo  = Math.max(0.01, parseFloat((askNo  - 0.01).toFixed(2)));
    const combined = makerYes + makerNo;
    if (combined >= CONFIG.makerArbThreshold) return;

    const bet = kellySizeBet(combined);
    if (bet < 1) return;
    simBalance -= bet;
    _reservedUsdc += bet;
    enteringMakerMarkets.add(marketId);
    const posId = `${market.id}_marb${_arbSeq++}`;
    (async () => {
      try {
        const pos = new WindowPosition({
          id: posId, asset: market.asset,
          upTokenId: market.upTokenId, downTokenId: market.downTokenId,
          windowEndMs: market.endMs,
        });
        pos.marketId  = market.id;
        pos.makerMode = true;
        const entered = await pos.enter(makerYes, makerNo, bet);
        if (entered) {
          activePositions.set(posId, pos);
          _mktArbCounts.set(market.id, (_mktArbCounts.get(market.id) ?? 0) + 1);
          makerArbStats.entered++;
          simBalance += bet - (pos.totalSpent ?? 0);
        } else { simBalance += bet; }
      } catch { simBalance += bet; }
      finally   { _reservedUsdc -= bet; enteringMakerMarkets.delete(marketId); }
    })();
  });

  // ── WS-reactive cross-market XARB ─────────────────────────────────────────
  // On every token price update, instantly check all logical pairs touching that
  // token — same latency as same-market ARB, no 30s polling delay.
  clobWs.onPriceUpdate((tokenId) => {
    const pairs = _xarbPairsByToken.get(tokenId);
    if (!pairs?.length) return;
    const threshold = getThreshold();
    for (const pair of pairs) {
      if (activePositions.size >= CONFIG.maxPositions) break;
      const pairKey = `${pair.marketA.id}_x_${pair.marketB.id}`;
      if (_logicalArbPairs.has(pairKey)) continue;
      if (pair.marketA.endMs - Date.now() < 60_000 || pair.marketB.endMs - Date.now() < 60_000) continue;
      const aAsk   = clobWs.getAsk(pair.marketA.upTokenId);
      const bNoAsk = clobWs.getAsk(pair.marketB.downTokenId);
      if (aAsk == null || bNoAsk == null) continue;
      const combined = aAsk + bNoAsk;
      // Try taker mode, then maker mode
      let entryA = aAsk, entryBNo = bNoAsk, makerMode = false;
      if (combined >= threshold) {
        const mA   = parseFloat((aAsk   - 0.01).toFixed(2));
        const mBNo = parseFloat((bNoAsk - 0.01).toFixed(2));
        if (mA + mBNo >= CONFIG.makerArbThreshold) continue;
        entryA = mA; entryBNo = mBNo; makerMode = true;
      }
      const entryCombined = entryA + entryBNo;
      const bet    = kellySizeBet(entryCombined);
      if (bet < 1) continue;
      const shares = Math.floor(bet / entryCombined);
      if (shares < 1) continue;
      _logicalArbPairs.add(pairKey);
      simBalance    -= bet;
      _reservedUsdc += bet;
      const posId = `xarb_${_arbSeq++}`;
      (async () => {
        try {
          const pos = new CrossArbPosition({
            id: posId, marketA: pair.marketA, marketB: pair.marketB,
            aAsk: entryA, bNoAsk: entryBNo, shares,
            pairDesc: `${pair.pairDesc}${makerMode ? ' [maker]' : ''}`,
          });
          const entered = await pos.enter();
          if (entered) {
            activePositions.set(posId, pos);
            crossArbStats.entered++;
            simBalance += bet - pos.totalSpent;
          } else { simBalance += bet; _logicalArbPairs.delete(pairKey); }
        } catch { simBalance += bet; _logicalArbPairs.delete(pairKey); }
        finally   { _reservedUsdc -= bet; }
      })();
    }
  });

  clobWs.onSweep(({ tokenId, marketId, side, price, rise }) => {
    return; // disabled — directional entries average 25-27% live win rate (below 53% breakeven)
    if (activePositions.has(marketId) || enteringMarkets.has(marketId)) return; // eslint-disable-line no-unreachable
    if (activePositions.size >= CONFIG.maxPositions) return;
    const market = marketList.find((m) => m.id === marketId);
    if (!market || market.endMs - Date.now() < 15_000) return;

    const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
    const available = Math.max(0, simBalance - allocated);
    const betSize   = Math.min(simBalance * 0.07, available);
    if (betSize < 1) return;
    simBalance -= betSize;
    _reservedUsdc += betSize;
    enteringMarkets.add(marketId);
    (async () => {
      try {
        const binanceOpenPrice = lateEntry.getOpenPrice(market.id) ?? feeds[market.asset]?.get() ?? null;
        const pos = new DirectionalPosition({
          id: market.id, asset: market.asset,
          side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
        });
        const entered = await pos.enter(price, betSize);
        if (entered) {
          simBalance += betSize - (pos.totalSpent ?? 0);
          activePositions.set(market.id, pos);
          lemStats.entered++;
          sweepStats.record({
            asset: market.asset, side, price, betSize,
            rise: rise.toFixed(3),
            remainingS: Math.round((market.endMs - Date.now()) / 1000),
            ts: Date.now(),
          });
        } else { simBalance += betSize; }
      } catch { simBalance += betSize; } finally { _reservedUsdc -= betSize; enteringMarkets.delete(marketId); }
    })();
  });

  clobWs.connect();
  const userWs = getUserOrderFeed(); // null if POLY_API_KEY not set — REST-only fallback
  userWs?.connect();

  // Liquidation cascade — disabled, directional entries underperform live
  onLiquidationCascade(() => { return; });
  startLiqFeed();
  startFuturesFeed();
  startTradeFlow();
  startWhaleFeed();
  startDeribitFeed();
  startUmaFeed();
  startResearchAgent();

  const refreshMarkets = async () => {
    let all = [];
    try { all = await fetchAllBinaryMarkets(); } catch { return; }
    const knownAssets = new Set(CONFIG.assets);
    const now = Date.now();

    const fresh = [];
    const arbFresh = [];
    const seen = new Set();
    for (const m of all) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (knownAssets.has(m.asset)) fresh.push(m);
      else arbFresh.push(m);
    }

    for (const market of fresh) {
      const openPx = feeds[market.asset]?.get() ?? null;
      lateEntry.recordOpen(market.id, openPx);
      try { fade.recordOpen(market.id, openPx); } catch { /* ignore */ }
    }
    clobWs.addMarkets([...fresh, ...arbFresh]);
    userWs?.addMarkets([...fresh, ...arbFresh].map(m => m.id));
    marketList = fresh;
    arbMarketList = arbFresh.filter(m => m.endMs > now && m.endMs - now <= CONFIG.maxArbWindowMs);
  };

  const fallbackScan = async () => {
    if (isFallbackScanning) return;
    isFallbackScanning = true;
    try {
      const t = getThreshold();
      for (const market of [...marketList, ...arbMarketList]) {
        if ((_mktArbCounts.get(market.id) ?? 0) >= 8 || enteringMarkets.has(market.id)) continue;
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
        if (yesPrice + noPrice >= t || market.endMs - Date.now() < 15_000) continue;
        const askYes = clobWs.getAsk(market.upTokenId) ?? yesPrice;
        const askNo  = clobWs.getAsk(market.downTokenId) ?? noPrice;
        if (askYes + askNo >= t) continue;

        const bet = kellySizeBet(askYes + askNo);
        if (bet < 1) continue;
        simBalance -= bet;
        _reservedUsdc += bet;
        enteringMarkets.add(market.id);
        const posId = `${market.id}_arb${_arbSeq++}`;
        try {
          const pos = new WindowPosition({
            id: posId, asset: market.asset,
            upTokenId: market.upTokenId, downTokenId: market.downTokenId,
            windowEndMs: market.endMs,
          });
          pos.marketId = market.id;
          const entered = await pos.enter(askYes, askNo, bet);
          if (entered) {
            simBalance += bet - (pos.totalSpent ?? 0);
            activePositions.set(posId, pos);
            _mktArbCounts.set(market.id, (_mktArbCounts.get(market.id) ?? 0) + 1);
            stats.entered++;
          } else { simBalance += bet; }
        } catch { simBalance += bet; } finally { _reservedUsdc -= bet; enteringMarkets.delete(market.id); }
      }
    } finally { isFallbackScanning = false; }
  };

  // ── Cross-market logical ARB — pair refresh ───────────────────────────────
  // Rebuilds the logical pair list and WS token index every 60s (on market refresh).
  // Actual entry is WS-reactive via clobWs.onPriceUpdate above — no polling delay.
  // This function also does a catch-up sweep for any pairs already in range
  // that the WS might have missed while the index was stale.
  const logicalArbCheck = async () => {
    if (isLogicalArbChecking) return;
    isLogicalArbChecking = true;
    try {
      const allMarkets = [...marketList, ...arbMarketList];
      const pairs      = findLogicalPairs(allMarkets);
      _xarbPairsByToken = buildTokenIndex(pairs); // rebuild for WS-reactive handler

      // Catch-up sweep: check all pairs right now in case prices are already in range
      const threshold  = getThreshold();
      for (const pair of pairs) {
        if (activePositions.size >= CONFIG.maxPositions) break;
        const pairKey = `${pair.marketA.id}_x_${pair.marketB.id}`;
        if (_logicalArbPairs.has(pairKey)) continue;
        if (pair.marketA.endMs - Date.now() < 60_000 || pair.marketB.endMs - Date.now() < 60_000) continue;
        const aAsk   = clobWs.getAsk(pair.marketA.upTokenId);
        const bNoAsk = clobWs.getAsk(pair.marketB.downTokenId);
        if (aAsk == null || bNoAsk == null) continue;
        let entryA = aAsk, entryBNo = bNoAsk, makerMode = false;
        if (aAsk + bNoAsk >= threshold) {
          const mA   = parseFloat((aAsk   - 0.01).toFixed(2));
          const mBNo = parseFloat((bNoAsk - 0.01).toFixed(2));
          if (mA + mBNo >= CONFIG.makerArbThreshold) continue;
          entryA = mA; entryBNo = mBNo; makerMode = true;
        }
        const combined = entryA + entryBNo;
        const bet      = kellySizeBet(combined);
        if (bet < 1) continue;
        const shares = Math.floor(bet / combined);
        if (shares < 1) continue;
        _logicalArbPairs.add(pairKey);
        simBalance    -= bet;
        _reservedUsdc += bet;
        const posId = `xarb_${_arbSeq++}`;
        (async () => {
          try {
            const pos = new CrossArbPosition({
              id: posId, marketA: pair.marketA, marketB: pair.marketB,
              aAsk: entryA, bNoAsk: entryBNo, shares,
              pairDesc: `${pair.pairDesc}${makerMode ? ' [maker]' : ''}`,
            });
            const entered = await pos.enter();
            if (entered) {
              activePositions.set(posId, pos);
              crossArbStats.entered++;
              simBalance += bet - pos.totalSpent;
            } else { simBalance += bet; _logicalArbPairs.delete(pairKey); }
          } catch { simBalance += bet; _logicalArbPairs.delete(pairKey); }
          finally   { _reservedUsdc -= bet; }
        })();
      }
    } finally { isLogicalArbChecking = false; }
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
      if (remaining < wm * 48_000 || remaining > wm * 59_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      if (!lateEntry.getOpenPrice(market.id)) {
        const px = feeds[market.asset]?.get() ?? null;
        if (px) lateEntry.recordOpen(market.id, px);
      }
      const binanceOpenPrice = lateEntry.getOpenPrice(market.id);
      if (!binanceOpenPrice) continue;
      const tokenId    = triggerSide === "UP" ? market.upTokenId : market.downTokenId;
      const entryPrice = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (entryPrice == null || entryPrice > 0.85) continue;

      const cxAllocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const cxAvailable = Math.max(0, simBalance - cxAllocated);
      const betSize     = Math.min(simBalance * 0.05, cxAvailable) * crossConf;
      if (betSize < 1) continue;
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side: triggerSide, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          const entered = await pos.enter(entryPrice, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            lemStats.entered++;
          } else { simBalance += betSize; }
        } catch { simBalance += betSize; } finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  const lateEntryCheck = () => {
    return; // disabled — LEM averages 25-27% live win rate (below 53% breakeven)
    if (isLateEntryChecking) return; // eslint-disable-line no-unreachable
    isLateEntryChecking = true;
    try {
      const now = Date.now();
      for (const market of marketList) {
        const wm        = market.windowMins ?? 5;
        if (wm > 15) continue; // LEM only meaningful on short windows
        const remaining = market.endMs - now;
        if (remaining < wm * 48_000 || remaining > wm * 59_000) continue;
        if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
        if (activePositions.size >= CONFIG.maxPositions) break;

        const currentPrice = feeds[market.asset]?.get() ?? null;
        if (!currentPrice) continue;

        const volPressure = feeds[market.asset]?.getVolPressure() ?? 0.5;
        const signal = lateEntry.getSignal(
          market.id, currentPrice, priceSnaps[market.asset] ?? [], market.asset, volPressure
        );
        if (!signal.side || signal.confidence < 0.35) continue;
        if (Math.abs(signal.delta) < CONFIG.momentumMinPct) continue;

        if (!lateEntry.getOpenPrice(market.id)) {
          const px = feeds[market.asset]?.get() ?? null;
          if (px) lateEntry.recordOpen(market.id, px);
        }
        const binanceOpenPrice = lateEntry.getOpenPrice(market.id);
        if (!binanceOpenPrice) continue;
        const tokenId    = signal.side === "UP" ? market.upTokenId : market.downTokenId;
        const entryPrice = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
        if (entryPrice == null || entryPrice > 0.85) continue;

        const betSize = kellyBet(entryPrice, signal.confidence) * adaptive.getMultiplier(market.asset, "LEM");
        if (betSize < CONFIG.minBetUsdc) continue;
        simBalance -= betSize;
        _reservedUsdc += betSize;
        enteringMarkets.add(market.id);
        (async () => {
          try {
            const pos = new DirectionalPosition({
              id: market.id, asset: market.asset,
              side: signal.side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
            });
            pos.enteredSecsLeft = Math.round((market.endMs - Date.now()) / 1000);
            pos.momentumPct = getMomentum(market.asset);
            const entered = await pos.enter(entryPrice, betSize);
            if (entered) {
              simBalance += betSize - (pos.totalSpent ?? 0);
              activePositions.set(market.id, pos);
              lemStats.entered++;
              if (signal.confidence >= 0.5) tryCrossAssetEntry(market.asset, signal.side, signal.confidence);
            } else { simBalance += betSize; }
          } catch { simBalance += betSize; } finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
        })();
      }
    } finally { isLateEntryChecking = false; }
  };

  const fadeCheck = () => {
    return; // disabled — no Binance directional confirmation, random entries
    for (const market of marketList) { // eslint-disable-line no-unreachable
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
            binanceOpenPrice: feeds[market.asset]?.get() ?? null,
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

  // ── Strategy: Market Open Front-Run ──────────────────────────────────────
  // When a fresh 5-min market opens (<45s old) and Binance shows strong momentum,
  // buy the trending side immediately while LPs are still calibrating (wide spread).
  const marketOpenCheck = () => {
    return; // disabled — directional entries underperform live (25-27% win rate)
    const now = Date.now(); // eslint-disable-line no-unreachable
    for (const market of marketList) {
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const marketOpenMs = market.endMs - wm * 60_000;
      const ageMs = now - marketOpenMs;
      if (ageMs < 0 || ageMs > 45_000) continue;          // only first 45s
      if (marketOpenFired.has(market.id)) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      // Need at least 2 fast snaps to compute 90s momentum
      const snaps = fastSnaps[market.asset];
      if (!snaps || snaps.length < 3) continue;
      const old = snaps[Math.max(0, snaps.length - 18)]; // ~90s ago (18 × 5s)
      const cur = snaps[snaps.length - 1];
      if (cur.ts - old.ts < 30_000) continue;             // need at least 30s of data
      const pctMove = (cur.price - old.price) / old.price;
      if (Math.abs(pctMove) < 0.003) continue;            // need ≥0.3% move

      const side    = pctMove > 0 ? "UP" : "DOWN";
      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (ask == null || ask > 0.58) continue;            // skip if already repriced

      const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const available = Math.max(0, simBalance - allocated);
      const betSize   = Math.min(simBalance * 0.10, available);
      if (betSize < CONFIG.minBetUsdc) continue;

      marketOpenFired.add(market.id);
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = cur.price;
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.open = true;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            openStats.entered++;
          } else { simBalance += betSize; marketOpenFired.delete(market.id); }
        } catch { simBalance += betSize; marketOpenFired.delete(market.id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Strategy: Macro Price Spike ───────────────────────────────────────────
  // When Binance moves ≥1.8% in ≤20 seconds (macro event), enter ALL assets
  // simultaneously. LPs cannot cancel fast enough; you capture their stale quotes.
  const macroSpikeCheck = () => {
    return; // disabled — directional entries underperform live (25-27% win rate)
    if (Date.now() - _lastSpikeFire < 5 * 60_000) return; // eslint-disable-line no-unreachable

    let spikeAsset = null; let spikePct = 0; let spikeSide = null;
    for (const asset of CONFIG.assets) {
      const snaps = fastSnaps[asset];
      if (!snaps || snaps.length < 4) continue;
      const recent = snaps.slice(-4); // last 20s (4 × 5s)
      const pct = (recent[recent.length - 1].price - recent[0].price) / recent[0].price;
      if (Math.abs(pct) > Math.abs(spikePct)) { spikePct = pct; spikeAsset = asset; }
    }
    if (!spikeAsset || Math.abs(spikePct) < 0.018) return; // ≥1.8% in 20s

    spikeSide = spikePct > 0 ? "UP" : "DOWN";
    _lastSpikeFire = Date.now();
    console.error(`[spike] ${spikeAsset} ${(spikePct * 100).toFixed(2)}% in 20s → entering all assets ${spikeSide}`);

    const now = Date.now();
    for (const market of marketList) {
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;
      if (market.endMs - now < 60_000) continue;          // need ≥60s to fill

      const tokenId = spikeSide === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (ask == null || ask > 0.75) continue;

      const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const available = Math.max(0, simBalance - allocated);
      const betSize   = Math.min(simBalance * 0.12, available);
      if (betSize < CONFIG.minBetUsdc) continue;

      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = feeds[market.asset]?.get() ?? null;
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side: spikeSide, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.spike = true;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            spikeStats.entered++;
          } else { simBalance += betSize; }
        } catch { simBalance += betSize; }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Strategy: Liquidation Cascade Stack ──────────────────────────────────
  // When $300k+ in forced liquidations hit one direction in 30s, enter that asset
  // plus all correlated assets (they lag by 30-150s).
  const tryCascadeEntry = (_asset, _direction) => {
    return; // disabled — directional entries underperform live
    const now      = Date.now(); // eslint-disable-line no-unreachable
    const CORR     =
      _asset === "BTC"  ? ["BTC", "ETH", "SOL", "XRP", "AVAX", "DOGE", "LINK", "MATIC"] :
      _asset === "ETH"  ? ["ETH", "BTC", "SOL", "LINK", "MATIC"] :
      _asset === "SOL"  ? ["SOL", "AVAX", "ETH"] :
      _asset === "XRP"  ? ["XRP", "DOGE"] :
      _asset === "AVAX" ? ["AVAX", "SOL"] :
      [_asset];

    for (const mkt of marketList) {
      if (!CORR.includes(mkt.asset)) continue;
      if (activePositions.has(mkt.id) || enteringMarkets.has(mkt.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;
      if (mkt.endMs - now < 60_000) continue;

      const cool = _cascadeCooldown.get(mkt.id) ?? 0;
      if (now < cool) continue;
      _cascadeCooldown.set(mkt.id, now + 90_000); // 90s per-market cooldown

      const tokenId = _direction === "UP" ? mkt.upTokenId : mkt.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (ask == null || ask > 0.70) continue;

      const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
      const available = Math.max(0, simBalance - allocated);
      // Primary asset gets full 15%, correlated get 10%
      const pct       = mkt.asset === _asset ? 0.15 : 0.10;
      const betSize   = Math.min(simBalance * pct, available);
      if (betSize < CONFIG.minBetUsdc) continue;

      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(mkt.id);
      const binanceOpenPrice = feeds[mkt.asset]?.get() ?? null;
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: mkt.id, asset: mkt.asset,
            side: _direction, tokenId, binanceOpenPrice, windowEndMs: mkt.endMs,
          });
          pos.cascade = true;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(mkt.id, pos);
            cascadeStats.entered++;
          } else { simBalance += betSize; _cascadeCooldown.delete(mkt.id); }
        } catch { simBalance += betSize; _cascadeCooldown.delete(mkt.id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(mkt.id); }
      })();
    }
  };

  // ── Time-of-day multiplier ────────────────────────────────────────────────
  // Deribit settles BTC/ETH options at 08:00 UTC daily → gamma release causes
  // violent 2-5% wicks in the 30 min after settlement. Signals during this
  // window are much stronger (outcome becomes certain faster).
  // Also: US session open (13:00-15:00 UTC) = highest intraday volatility.
  const getTimeMultiplier = () => {
    const utcHour = new Date().getUTCHours();
    const utcMin  = new Date().getUTCMinutes();
    const minsFromMidnight = utcHour * 60 + utcMin;
    // 08:00-08:30 UTC — Deribit expiry gamma release: strong directional moves
    if (minsFromMidnight >= 480 && minsFromMidnight <= 510) return 1.25;
    // 13:00-15:00 UTC — US pre-market/open: highest volatility window
    if (minsFromMidnight >= 780 && minsFromMidnight <= 900) return 1.15;
    // 00:00-06:00 UTC — Asian quiet hours: weaker signals, reduce size
    if (minsFromMidnight >= 0   && minsFromMidnight <= 360) return 0.75;
    return 1.0;
  };

  // ── Strategy: LatencyBond ─────────────────────────────────────────────────
  // Polymarket lags Binance by 30-90s on 5-min markets.
  // When 45-150s remain and Binance has moved ≥0.5% since market open,
  // buy the winning-side token while the ask is still ≤0.70.
  // This is the 0x8dxd playbook: 98% observed win rate.
  const latencyBondCheck = () => {
    const now = Date.now();
    for (const market of marketList) {
      if (market.isRotation === false) continue; // needs a fixed-cycle market, not a broad-scan one
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const remaining = market.endMs - now;
      if (remaining < 15_000 || remaining > 200_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const currentPrice = feeds[market.asset]?.get() ?? null;
      if (!currentPrice) continue;
      const openPrice = lateEntry.getOpenPrice(market.id);
      if (!openPrice) continue;

      const delta   = (currentPrice - openPrice) / openPrice;
      const absMove = Math.abs(currentPrice - openPrice);
      const minMove = LB_MIN_USD[market.asset] ?? (openPrice * 0.001);
      if (absMove < minMove) continue;

      const side    = delta > 0 ? "UP" : "DOWN";
      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      // Lag zone: market must be 0.45–0.70 (partial lag). Below 0.45 = market strongly
      // disagrees with Binance → signal likely noise. Above 0.70 = market already caught up.
      if (ask == null || ask < 0.45 || ask > 0.70) continue;

      // OI delta filter: declining OI = squeeze/unwind (weak signal), skip
      const oiDelta = getOIDelta(market.asset, 120_000);
      if (oiDelta !== null && oiDelta < -0.003) continue; // OI shrinking ≥0.3% → skip
      const oiMult = oiDelta !== null && oiDelta > 0.005 ? 1.2 : 1.0;

      // Volume spike confirmation: dying volume = fading move, skip; spike = stronger signal
      const spike = getVolumeSpike(market.asset);
      if (spike !== null && spike < 0.5) continue; // volume < 50% of normal → momentum fading
      const spikeMult = spike !== null && spike > 4.0 ? 1.3 : 1.0; // 4× volume spike → 30% bigger

      // Buy/sell pressure alignment: must match direction
      const bp = getBuyPressure(market.asset);
      if (bp !== null) {
        if (side === "UP"   && bp < 0.42) continue; // UP signal but sellers dominating
        if (side === "DOWN" && bp > 0.58) continue; // DOWN signal but buyers dominating
      }

      // Macro event multiplier (FOMC/CPI/NFP windows)
      const eventMult = getEventMultiplier();

      // Whale signal alignment: confirms with large on-chain flow
      const whale = getWhaleSignal(market.asset);
      const whaleMult = (whale && whale.direction === side && whale.ageMs < 30 * 60_000) ? 1.15 : 1.0;

      // Deribit options gamma: if call/put wall aligns with our direction, MMs will amplify the move
      const gamma = getDeribitGamma(market.asset);
      const gammaMult = (gamma?.direction === side && gamma.strength > 0.15)
        ? 1 + gamma.strength * 0.30 : 1.0;

      // Cap combined multiplier at 2.0× to prevent runaway bet sizes
      const combinedMult = Math.min(2.0,
        adaptive.getMultiplier(market.asset, "LATENCYBOND") * getTimeMultiplier() *
        oiMult * spikeMult * eventMult * whaleMult * gammaMult);
      const betSize = dynamicBetSize(market.asset, 0.25, combinedMult); // 25% base (98% WR supports more)
      if (betSize < CONFIG.minBetUsdc) continue;

      // Record for confluence detection (CI firing on same market within 3s = stronger signal)
      _confluentMarkets.set(market.id, { lbTs: now, side });

      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = openPrice;
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.latencyBond = true;
          pos.lbDelta     = delta;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            lbStats.entered++;
            console.error(`[lb] ${market.asset} ${side} @${ask.toFixed(3)}  Δ=${(delta * 100).toFixed(2)}%  $${betSize.toFixed(2)}  ${Math.round(remaining / 1000)}s left`);
          } else { simBalance += betSize; }
        } catch { simBalance += betSize; }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Strategy: Close Snipe ─────────────────────────────────────────────────
  // In the last 10-60s of a 5-min market, if Binance already confirms a side
  // and that side's ask is in the 0.85-0.99 "almost certain but not yet priced
  // at $1" zone, rest a limit buy at exactly $0.99. Either it crosses immediately
  // (ask already ≤ 0.99) or it sits there for an impatient seller who'd rather
  // exit now than wait out the last seconds for confirmed resolution. No early
  // exit / stop-loss — by design there's no real time left to react to anything.
  const closeSnipeCheck = () => {
    const now = Date.now();
    for (const market of marketList) {
      if (market.isRotation === false) continue;
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const remaining = market.endMs - now;
      if (remaining < 10_000 || remaining > 60_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const currentPrice = feeds[market.asset]?.get() ?? null;
      const openPrice = lateEntry.getOpenPrice(market.id);
      if (!currentPrice || !openPrice || currentPrice === openPrice) continue;

      const side    = currentPrice > openPrice ? "UP" : "DOWN";
      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (ask == null || ask < 0.85 || ask >= 0.99) continue;

      const betSize = dynamicBetSize(market.asset, 1.0, 1);
      if (betSize < 4.95) continue; // can't clear Polymarket's real order-size minimum at this price

      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = openPrice;
      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.closeSnipe = true;
          const entered = await pos.enter(0.99, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            csStats.entered++;
            console.error(`[cs] ${market.asset} ${side} @0.99  ${Math.round(remaining / 1000)}s left  $${betSize.toFixed(2)}`);
          } else { simBalance += betSize; }
        } catch { simBalance += betSize; }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Strategy: Opening Price Snipe (TIER 0) ───────────────────────────────
  // When a new 5-min market opens, the CLOB starts near 0.50/0.50 regardless of where
  // Binance is. If Binance is already trending ≥0.3% BEFORE the market even exists,
  // buy at ~0.50 ask while LPs are still initializing. LatencyBond only fires at 50-120s
  // remaining — OPS captures the same edge 3-4 minutes earlier at a far better price.
  // Bonus: if a previous market on the same asset just WON, multiply (consecutive carry).
  const openingPriceSnipe = () => {
    const now = Date.now();
    for (const market of marketList) {
      if (market.isRotation === false) continue; // needs a fixed-cycle market, not a broad-scan one
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const marketStartMs = market.endMs - wm * 60_000;
      const ageMs = now - marketStartMs;
      if (ageMs < 3_000 || ageMs > 35_000) continue; // 3-35s into market life
      if (_opsEntered.has(market.id)) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const currentPrice = feeds[market.asset]?.get() ?? null;
      if (!currentPrice) continue;
      const openPrice = lateEntry.getOpenPrice(market.id);
      if (!openPrice) continue;

      const delta = (currentPrice - openPrice) / openPrice;
      if (Math.abs(delta) < 0.008) continue; // need ≥0.8% Binance move since open

      const side    = delta > 0 ? "UP" : "DOWN";

      // Require 60s trend to confirm the direction — filters out tick noise
      const snaps60 = fastSnaps[market.asset];
      if (snaps60 && snaps60.length >= 12) {
        const old60   = snaps60[Math.max(0, snaps60.length - 12)]; // ~60s ago
        const cur60   = snaps60[snaps60.length - 1];
        const delta60 = (cur60.price - old60.price) / old60.price;
        if (side === "UP"   && delta60 <= 0.002) continue; // 60s not bullish enough
        if (side === "DOWN" && delta60 >= -0.002) continue; // 60s not bearish enough
      }

      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      if (ask == null || ask > 0.52) continue; // CLOB must be near 50/50 (tighter than before)

      // Volume not collapsing
      const spike = getVolumeSpike(market.asset);
      if (spike !== null && spike < 0.3) continue;

      // Buy pressure alignment — skip if flow strongly contradicts direction
      const bpOps = getBuyPressure(market.asset);
      if (bpOps !== null) {
        if (side === "UP"   && bpOps < 0.35) continue;
        if (side === "DOWN" && bpOps > 0.65) continue;
      }
      const bpOpsMult = bpOps !== null
        ? ((side === "UP" && bpOps > 0.60) || (side === "DOWN" && bpOps < 0.40)) ? 1.12 : 1.0
        : 1.0;

      // Consecutive carry multiplier: previous market on same asset settled same direction
      const carry = _recentSettlements.get(market.asset);
      const isCarry = carry?.side === side && (now - carry.settledAt) < 45_000;
      const carryMult = isCarry ? 1.35 : 1.0;

      // Cross-asset carry: BTC↔ETH correlation ~0.9 — if the correlated asset just won
      // in the same direction within 30s, add a modest boost
      const CORRELATED = { BTC: "ETH", ETH: "BTC" };
      const crossAsset  = CORRELATED[market.asset];
      const crossSettle = crossAsset ? _recentSettlements.get(crossAsset) : null;
      const isCross     = crossSettle?.side === side && (now - crossSettle.settledAt) < 30_000;
      const crossMult   = isCross ? 1.15 : 1.0;

      const betSize = dynamicBetSize(market.asset, 0.22,
        adaptive.getMultiplier(market.asset, "OPENSNIPE") * getTimeMultiplier() * carryMult * crossMult * bpOpsMult);
      if (betSize < CONFIG.minBetUsdc) continue;

      _opsEntered.add(market.id);
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);

      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice: openPrice, windowEndMs: market.endMs,
          });
          pos.openSnipe     = true;
          pos.osDelta       = delta;
          pos.opsCarry      = isCarry;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            opsStats.entered++;
            const carryTag = isCarry ? "  CARRY" : isCross ? "  XCARRY" : "";
            console.error(`[ops] ${market.asset} ${side} @${ask.toFixed(3)}  Δ=${(delta*100).toFixed(2)}%  ${Math.round(ageMs/1000)}s old  $${betSize.toFixed(2)}${carryTag}`);
          } else { simBalance += betSize; _opsEntered.delete(market.id); }
        } catch { simBalance += betSize; _opsEntered.delete(market.id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Gamma API resolution poller ───────────────────────────────────────────
  // Polls Polymarket's gamma API for expired markets. When outcomePrices snaps
  // to ["1","0"] or ["0","1"], we know the winner with certainty before CLOB LPs
  // reprice. Complementary to the UMA on-chain feed (whichever fires first wins).
  const _pollGammaResolutions = async () => {
    const now = Date.now();
    const toFetch = [];
    for (const [id, market] of expiredMarketBuf) {
      if (_gammaResolution.has(id)) continue;
      if (_osEntered.has(id)) continue;
      if (getUmaSettlement(market.asset, market.endMs)) continue;
      const last = _gammaLastFetch.get(id) ?? 0;
      if (now - last < 8_000) continue; // minimum 8s between re-fetches per market
      const tier = OS_TIER[market.asset] ?? { maxMsPost: 30 * 60_000 };
      if (now - market.endMs > tier.maxMsPost) continue;
      toFetch.push([id, market]);
    }
    // At most 3 fetches per call to avoid rate-limiting the gamma API
    for (const [id, market] of toFetch.slice(0, 3)) {
      _gammaLastFetch.set(id, now);
      try {
        const res = await fetch(
          `${CONFIG.gammaBaseUrl}/markets/${market.id}`,
          { signal: AbortSignal.timeout(3000) },
        );
        if (!res.ok) continue;
        const data = await res.json();
        let prices = [];
        try { prices = JSON.parse(data.outcomePrices ?? "[]"); } catch { continue; }
        if (!Array.isArray(prices) || prices.length < 2) continue;
        const yesP = Number(prices[0]);
        const noP  = Number(prices[1]);
        if (yesP > 0.99)      { _gammaResolution.set(id, { side: "UP",   confirmedAt: now }); console.error(`[gr] ${market.asset} UP   confirmed (gamma API)`); }
        else if (noP > 0.99)  { _gammaResolution.set(id, { side: "DOWN", confirmedAt: now }); console.error(`[gr] ${market.asset} DOWN confirmed (gamma API)`); }
      } catch { /* network error — try again next cycle */ }
    }
  };

  // ── Strategy: OracleSnipe ─────────────────────────────────────────────────
  // After a 5-min market closes, the UMA oracle takes 2-10 minutes to settle.
  // Tokens remain tradeable on the CLOB during that window at stale prices.
  // We know the winner from Binance data → buy cheap winning tokens → collect $1.
  // Best on thin assets (AVAX/LINK/MATIC/XRP/DOGE): LPs don't reprice for 60-180s.
  const oracleSnipeCheck = () => {
    const now = Date.now();

    // 1. Buffer any market that just crossed its endMs (preserve token IDs for scanning)
    for (const market of marketList) {
      if (market.endMs < now && !expiredMarketBuf.has(market.id)) {
        expiredMarketBuf.set(market.id, { ...market, expiredAt: now });
      }
    }
    // Evict markets older than 10 minutes (oracle has long since settled)
    for (const [id, m] of expiredMarketBuf) {
      if (m.expiredAt < now - 95 * 60_000) { expiredMarketBuf.delete(id); _closeSnaps.delete(id); }
    }

    // 2. Snapshot Binance price the first time we see each expired market (= close price proxy)
    for (const [id, market] of expiredMarketBuf) {
      if (_closeSnaps.has(id)) continue;
      const closePrice = feeds[market.asset]?.get() ?? null;
      const openPrice  = lateEntry.getOpenPrice(id);
      if (!closePrice || !openPrice) continue;
      _closeSnaps.set(id, { closePrice, openPrice, asset: market.asset, endMs: market.endMs });
    }

    // 3. Scan for snipe entries
    for (const [id, market] of expiredMarketBuf) {
      if (_osEntered.has(id)) continue;
      if (activePositions.has(id) || enteringMarkets.has(id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      // Asset-tiered staleness window: BTC/ETH LPs reprice in 2-7 min; AVAX/LINK/MATIC take 45-60 min
      const osTier = OS_TIER[market.asset] ?? { maxMsPost: 30 * 60_000, minDelta: 0.003 };
      if (now - market.endMs > osTier.maxMsPost) continue;

      // Resolution certainty: UMA on-chain (primary) or gamma API (secondary)
      // Either gives 100% certainty — no delta floor needed, bet size boosted.
      const uma  = getUmaSettlement(market.asset, market.endMs);
      const gr   = _gammaResolution.get(id);
      const certain = uma ?? gr;
      const snap = _closeSnaps.get(id);

      // snap required regardless of certainty: osClosePrice (used at resolution) comes from snap.closePrice.
      // Without it, resolveInSim gets null and silently refunds instead of settling the win.
      if (!snap) continue;

      let side, delta;
      if (certain) {
        side  = certain.side;
        delta = Math.abs((snap.closePrice - snap.openPrice) / snap.openPrice);
      } else {
        delta = (snap.closePrice - snap.openPrice) / snap.openPrice;
        if (Math.abs(delta) < osTier.minDelta) continue;
        side  = delta > 0 ? "UP" : "DOWN";
      }

      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      const askCap = certain ? 0.90 : 0.82;
      if (ask == null || ask > askCap) continue; // must still be underpriced

      // UMA/gamma confirmed = near-100% certainty — bet significantly more
      const certainMult = certain ? 1.75 : 1.0;
      const betSize = dynamicBetSize(market.asset, 0.20,
        adaptive.getMultiplier(market.asset, "ORACLESNIPE") * getTimeMultiplier() * certainMult); // 20% base (95% WR)
      if (betSize < CONFIG.minBetUsdc) continue;

      _osEntered.add(id);
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(id);
      const secsPostClose = Math.round((now - market.endMs) / 1000);

      (async () => {
        try {
          // Extend windowEndMs by 90 min to give oracle time to settle in sim
          const pos = new DirectionalPosition({
            id, asset: market.asset, side, tokenId,
            binanceOpenPrice: snap?.openPrice ?? 0,
            windowEndMs: market.endMs + 90 * 60_000,
          });
          pos.oracleSnipe    = true;
          pos.osUmaConfirmed = !!uma;
          pos.osGrConfirmed  = !!gr;
          pos.osClosePrice   = snap?.closePrice ?? null;
          pos.osDelta        = delta;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(id, pos);
            osStats.entered++;
            const srcTag = uma ? "  UMA✓" : gr ? "  GR✓" : "";
            console.error(`[os] ${market.asset} ${side} @${ask.toFixed(3)}  Δ=${(delta*100).toFixed(2)}%  $${betSize.toFixed(2)}  +${secsPostClose}s post-close${srcTag}`);
          } else { simBalance += betSize; _osEntered.delete(id); }
        } catch { simBalance += betSize; _osEntered.delete(id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(id); }
      })();
    }
  };

  // ── Strategy: FundingSnipe ────────────────────────────────────────────────
  // When Binance perp funding rate is extreme, one side is overextended and a
  // snap-back squeeze is imminent. Enter the OPPOSITE direction BEFORE Binance moves.
  //   funding > +0.04%/8hr  → longs paying heavily → DOWN squeeze incoming
  //   funding < -0.02%/8hr  → shorts paying heavily → UP squeeze incoming
  // Enter at ≤0.58 ask (market hasn't priced the squeeze yet), 10% of balance.
  // Runs every 30s — funding data refreshes on same schedule.
  const _fsFired = new Set(); // marketId → prevent double entry
  const fundingSnipeCheck = () => {
    const now = Date.now();
    for (const market of marketList) {
      if (market.isRotation === false) continue; // needs a fixed-cycle market, not a broad-scan one
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const remaining = market.endMs - now;
      if (remaining < 60_000 || remaining > wm * 60_000 * 0.8) continue; // 60s-80% of window
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (_fsFired.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const f = getFundingData(market.asset);
      if (!f) continue;

      // Extreme thresholds — 0x8dxd notes: ±0.04% is 5× normal, near-certain squeeze
      let side = null;
      if (f.rate > 0.0004) side = "DOWN"; // longs paying → DOWN squeeze
      if (f.rate < -0.0002) side = "UP";  // shorts paying → UP squeeze
      if (!side) continue;

      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);
      const extremeFunding = Math.abs(f.rate) > 0.0008; // 2× threshold = near-certain squeeze
      if (ask == null || ask > (extremeFunding ? 0.62 : 0.58)) continue;

      // OI must also be elevated — confirms crowded position, not just noise
      const oiDelta = getOIDelta(market.asset, 300_000); // 5-minute OI window
      if (oiDelta !== null && oiDelta < 0) continue; // OI declining = unwind already started

      // Deribit gamma cross-validation: if options flow opposes our direction, skip
      const fsGamma = getDeribitGamma(market.asset);
      if (fsGamma && fsGamma.direction !== side && fsGamma.strength > 0.3) continue;
      const fsGammaMult = (fsGamma?.direction === side) ? 1 + fsGamma.strength * 0.20 : 1.0;

      // Buy pressure alignment: squeeze already in motion = boost, strongly opposite = skip
      const fsBp = getBuyPressure(market.asset);
      if (fsBp !== null) {
        if (side === "DOWN" && fsBp > 0.70) continue; // buyers too strong, DOWN squeeze not starting
        if (side === "UP"   && fsBp < 0.30) continue; // sellers too strong, UP squeeze not starting
      }
      const fsBpMult = fsBp !== null
        ? ((side === "DOWN" && fsBp < 0.40) || (side === "UP" && fsBp > 0.60)) ? 1.10 : 1.0
        : 1.0;

      const betSize = dynamicBetSize(market.asset, 0.10,
        adaptive.getMultiplier(market.asset, "FUNDINGSNIPE") * getTimeMultiplier() * fsGammaMult * fsBpMult);
      if (betSize < CONFIG.minBetUsdc) continue;

      _fsFired.add(market.id);
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = lateEntry.getOpenPrice(market.id) ?? feeds[market.asset]?.get() ?? null;

      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.fundingSnipe  = true;
          pos.fsFundingRate = f.rate;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            fsStats.entered++;
            console.error(`[fs] ${market.asset} ${side} @${ask.toFixed(3)}  funding=${(f.rate * 100).toFixed(4)}%  $${betSize.toFixed(2)}`);
          } else { simBalance += betSize; _fsFired.delete(market.id); }
        } catch { simBalance += betSize; _fsFired.delete(market.id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
  };

  // ── Helper: cancel all open maker-rebate orders for a market ─────────────
  const cancelMakerOrders = async (marketId) => {
    const mr = _mrOrders.get(marketId);
    if (!mr) return;
    const { cancelOrder: co } = await import("./live/orders.js");
    await co(mr.upOrder?.orderId).catch(() => {});
    await co(mr.dnOrder?.orderId).catch(() => {});
    _mrOrders.delete(marketId);
  };

  // ── Strategy: CLOB Order Book Imbalance ──────────────────────────────────
  // When bid depth on a token heavily outweighs ask depth (>80% ratio), informed
  // buyers are accumulating before a reprice. Enter BEFORE the CLOB adjusts.
  // No Binance data needed — pure order-book microstructure signal.
  const _ciEntered = new Set();
  let _isCiRunning = false;
  const clobImbalanceCheck = async () => {
    if (_isCiRunning) return;
    _isCiRunning = true;
    const now = Date.now();
    try {
    for (const market of marketList) {
      if (market.isRotation === false) continue; // needs a fixed-cycle market, not a broad-scan one
      const wm = market.windowMins ?? 5;
      if (wm > 15) continue;
      const remaining = market.endMs - now;
      if (remaining < 20_000 || remaining > wm * 55_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (_ciEntered.has(market.id)) continue;
      if (activePositions.size >= CONFIG.maxPositions) break;

      const upImb = clobWs.getImbalance(market.upTokenId);
      const dnImb = clobWs.getImbalance(market.downTokenId);
      if (upImb == null && dnImb == null) continue;

      // Confluence check first — confluent entries use lower imbalance threshold (0.70 vs 0.80 standalone)
      const conf = _confluentMarkets.get(market.id);
      const confSide = conf && (now - (conf?.lbTs ?? 0)) < 3_000 ? conf.side : null;

      let side = null;
      let imbalance = 0;
      const upThresh = confSide === "UP"   ? 0.70 : 0.80;
      const dnThresh = confSide === "DOWN" ? 0.70 : 0.80;
      if ((upImb ?? 0) > upThresh && (upImb ?? 0) > (dnImb ?? 0)) { side = "UP"; imbalance = upImb; }
      else if ((dnImb ?? 0) > dnThresh)                             { side = "DOWN"; imbalance = dnImb; }
      if (!side) continue;

      const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;
      const ask     = clobWs.getAsk(tokenId) ?? clobWs.getMid(tokenId);

      const isConfluent = confSide === side;
      const askCap = isConfluent ? 0.75 : 0.65;
      if (ask == null || ask > askCap) continue;

      // Cross-validate: buy pressure must align with imbalance direction
      const bp = getBuyPressure(market.asset);
      if (bp !== null) {
        if (side === "UP" && bp < 0.48) continue;
        if (side === "DOWN" && bp > 0.52) continue;
      }

      // Scale bet with imbalance strength + confluence boost
      const imbMult = imbalance > 0.90 ? 1.5 : imbalance > 0.85 ? 1.25 : 1.0;
      const confluenceMult = isConfluent ? 1.4 : 1.0;
      const betSize = dynamicBetSize(market.asset, 0.10, // 10% base (structural edge)
        adaptive.getMultiplier(market.asset, "CLOBIMB") * getTimeMultiplier() * imbMult * confluenceMult);
      if (betSize < CONFIG.minBetUsdc) continue;

      _ciEntered.add(market.id);
      await cancelMakerOrders(market.id).catch(() => {});
      simBalance -= betSize;
      _reservedUsdc += betSize;
      enteringMarkets.add(market.id);
      const binanceOpenPrice = lateEntry.getOpenPrice(market.id) ?? feeds[market.asset]?.get() ?? null;

      (async () => {
        try {
          const pos = new DirectionalPosition({
            id: market.id, asset: market.asset,
            side, tokenId, binanceOpenPrice, windowEndMs: market.endMs,
          });
          pos.clobImb      = true;
          pos.clobImbRatio = imbalance;
          pos.ciConfluent  = isConfluent;
          const entered = await pos.enter(ask, betSize);
          if (entered) {
            simBalance += betSize - (pos.totalSpent ?? 0);
            activePositions.set(market.id, pos);
            ciStats.entered++;
            console.error(`[ci] ${market.asset} ${side} @${ask.toFixed(3)}  imb=${(imbalance * 100).toFixed(0)}%  $${betSize.toFixed(2)}${isConfluent ? "  CONFLUENCE" : ""}`);
          } else { simBalance += betSize; _ciEntered.delete(market.id); }
        } catch { simBalance += betSize; _ciEntered.delete(market.id); }
        finally { _reservedUsdc -= betSize; enteringMarkets.delete(market.id); }
      })();
    }
    } finally { _isCiRunning = false; }
  };

  // ── Strategy: Maker Rebate Farming ───────────────────────────────────────
  // On truly 50/50 markets, post limit BUY orders at bid on both tokens.
  // Earn 0.45% maker rebate per fill. Combined: buy both sides below mid →
  // collect $1 at settlement regardless of outcome → net +3–5% per round-trip.
  // Kill-switch: cancel all MR orders the moment any directional signal fires.
  const makerRebateCheck = async () => {
    const now = Date.now();
    // Evict stale MR order records for ended markets
    for (const [id, mr] of _mrOrders) {
      const mkt = marketList.find(m => m.id === id);
      if (!mkt || mkt.endMs < now) {
        await cancelMakerOrders(id).catch(() => {});
      }
    }

    // Cap concurrent open MR positions to avoid over-committing capital on-chain
    if (_mrOrders.size >= 20) return;

    for (const market of marketList) {
      if (_mrOrders.size >= 20) break;
      if (market.isRotation === false) continue; // needs a fixed-cycle market, not a broad-scan one
      const wm = market.windowMins ?? 5;
      if (wm > 20) continue;
      const remaining = market.endMs - now;
      if (remaining < 60_000 || remaining > wm * 55_000) continue;
      if (activePositions.has(market.id) || enteringMarkets.has(market.id)) continue;
      if (_mrOrders.has(market.id)) continue;

      const { yesPrice, noPrice } = clobWs.getPrices(market.upTokenId, market.downTokenId);
      if (!yesPrice || !noPrice) continue;
      // ±7¢ from 50/50 — enough expansion for volume, tight enough to limit adverse selection
      if (Math.abs(yesPrice - 0.50) > 0.07 || Math.abs(noPrice - 0.50) > 0.07) continue;

      // Only block on extreme volume (genuine panic move, not routine flow)
      const spike = getVolumeSpike(market.asset);
      if (spike !== null && spike > 4.0) continue;

      // Only block on very large, very fresh whale flows that clearly dominate the market
      const whale = getWhaleSignal(market.asset);
      if (whale && (whale.usdTotal ?? 0) > 5_000_000 && (whale.ageMs ?? Infinity) < 5 * 60_000) continue;

      const upBid = clobWs.getBid(market.upTokenId);
      const dnBid = clobWs.getBid(market.downTokenId);
      if (!upBid || !dnBid) continue;

      // 0.99 threshold: maker rebate (0.45% per side ≈ 0.9¢ per $1) covers the gap
      if (upBid + dnBid >= 0.99) continue;

      const betSize = dynamicBetSize(market.asset, 0.05, 1.0);
      if (betSize < CONFIG.minBetUsdc * 2) continue;
      const halfBet = betSize / 2;

      try {
        const { placeLimitBuy, cancelOrder: co } = await import("./live/orders.js");
        const upOrder = await placeLimitBuy(market.upTokenId, upBid, Math.floor(halfBet / upBid));
        try {
          const dnOrder = await placeLimitBuy(market.downTokenId, dnBid, Math.floor(halfBet / dnBid));
          _mrOrders.set(market.id, { upOrder, dnOrder, asset: market.asset, placedAt: now });
          console.error(`[mr] ${market.asset} ORDERS PLACED  up@${upBid.toFixed(3)} dn@${dnBid.toFixed(3)}  sum=${(upBid+dnBid).toFixed(3)}  ${Math.round(remaining/1000)}s left`);
        } catch {
          await co(upOrder?.orderId).catch(() => {});
        }
      } catch { /* import or order placement failed — skip */ }
    }
  };

  // Poll MR order fill status every 5s
  const makerRebateMonitor = async () => {
    if (!_mrOrders.size) return;
    const { getOrderStatus } = await import("./live/orders.js");
    const now = Date.now();
    for (const [id, mr] of _mrOrders) {
      const market = marketList.find(m => m.id === id);
      if (!market || market.endMs < now) { await cancelMakerOrders(id).catch(() => {}); continue; }
      if (activePositions.has(id)) { _mrOrders.delete(id); continue; }

      const [upStatus, dnStatus] = await Promise.all([
        getOrderStatus(mr.upOrder?.orderId).catch(() => null),
        getOrderStatus(mr.dnOrder?.orderId).catch(() => null),
      ]);

      const upFilled = upStatus?.status === "matched";
      const dnFilled = dnStatus?.status === "matched";

      if (upFilled && dnFilled) {
        // Both sides filled — net profit guaranteed at settlement
        _mrOrders.delete(id);
        mrStats.entered++;
        const spent = ((mr.upOrder?.price ?? 0) * (mr.upOrder?.size ?? 0)) + ((mr.dnOrder?.price ?? 0) * (mr.dnOrder?.size ?? 0));
        simBalance -= spent;
        const upShares = mr.upOrder.size ?? 0;
        const dnShares = mr.dnOrder.size ?? 0;
        const payout = ((upShares + dnShares) / 2) * 1.0;
        simBalance += payout;
        const net = payout - spent;
        mrStats.totalSpent  += spent;
        mrStats.totalPayout += payout;
        const mrWon = net > 0;
        if (mrWon) mrStats.won++; else mrStats.lost++;
        trackPnl();
        const _tmr = { strategy: "MAKERREBATE", asset: mr.asset, side: "BOTH",
          entryPrice: (upShares + dnShares) > 0 ? spent / (upShares + dnShares) : 0,
          totalSpent: spent, payout, net, won: mrWon };
        logTrade(_tmr); allTradeHistory.push(_tmr);
        adaptive.record(mr.asset, "MAKERREBATE", mrWon);
        console.error(`[mr] ${mr.asset} BOTH FILLED  net=${net >= 0 ? "+" : ""}${net.toFixed(2)}`);
      } else if (upFilled && !dnFilled && now - mr.placedAt > 30_000) {
        // Only up filled after 30s — directional UP position, cancel the pending DN order
        const { cancelOrder: co } = await import("./live/orders.js");
        await co(mr.dnOrder?.orderId).catch(() => {});
        _mrOrders.delete(id);
        const filledCost = (mr.upOrder?.price ?? 0) * (mr.upOrder?.size ?? 0);
        simBalance -= filledCost;
        mrStats.totalSpent += filledCost;
        mrStats.entered++;
        const _tmrUp = { strategy: "MAKERREBATE", asset: mr.asset, side: "UP",
          entryPrice: mr.upOrder?.price ?? 0, totalSpent: filledCost, payout: 0, net: -filledCost, won: false };
        logTrade(_tmrUp); allTradeHistory.push(_tmrUp);
      } else if (dnFilled && !upFilled && now - mr.placedAt > 30_000) {
        const { cancelOrder: co } = await import("./live/orders.js");
        await co(mr.upOrder?.orderId).catch(() => {});
        _mrOrders.delete(id);
        const filledCost = (mr.dnOrder?.price ?? 0) * (mr.dnOrder?.size ?? 0);
        simBalance -= filledCost;
        mrStats.totalSpent += filledCost;
        mrStats.entered++;
        const _tmrDn = { strategy: "MAKERREBATE", asset: mr.asset, side: "DOWN",
          entryPrice: mr.dnOrder?.price ?? 0, totalSpent: filledCost, payout: 0, net: -filledCost, won: false };
        logTrade(_tmrDn); allTradeHistory.push(_tmrDn);
      }
    }
  };

  const monitor = async () => {
    if (isMonitoring) return;
    isMonitoring = true;
    try {
      for (const [id, pos] of activePositions) {
        if (pos.type === "directional") {
          if (!pos.sniper && !pos.fade && !pos.expired && pos.filled) {
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
              trackPnl();
              const _t0 = { ...s, strategy: "LEM-EARLY" };
              logTrade(_t0); allTradeHistory.push(_t0);
              lemStats.record(s);
              lateEntry.clearMarket(id);
              clobWs.removeMarket(id);
              userWs?.removeMarket(id);
              activePositions.delete(id);
              continue;
            }
            // Stop-loss: token dropped 30% below entry — sell at market price to cap damage.
            // Only on LB/CI/OPS (not OracleSnipe which resolves at binary settlement).
            if (
              tokenPrice != null && pos.entryPrice && !pos.oracleSnipe &&
              (pos.latencyBond || pos.clobImb || pos.openSnipe) &&
              tokenPrice < pos.entryPrice * 0.70
            ) {
              pos.resolveStopLoss(tokenPrice);
              await pos.cancelAll().catch(() => {});
              const s = pos.summary;
              simBalance += s.payout;
              trackPnl();
              const _slStrat = pos.latencyBond ? "LATENCYBOND" : pos.clobImb ? "CLOBIMB" : "OPENSNIPE";
              logTrade({ ...s, strategy: _slStrat }); allTradeHistory.push({ ...s, strategy: _slStrat });
              if (pos.latencyBond) {
                lbStats.record(s); adaptive.record(pos.asset, "LATENCYBOND", false);
              } else if (pos.clobImb) {
                ciStats.record(s); adaptive.record(pos.asset, "CLOBIMB", false);
              } else {
                opsStats.record(s); adaptive.record(pos.asset, "OPENSNIPE", false);
              }
              console.error(`[sl] ${pos.asset} ${pos.side} stop-loss @${tokenPrice.toFixed(3)}  entry=${pos.entryPrice.toFixed(3)}  recover=$${s.payout.toFixed(2)}`);
              clobWs.removeMarket(id);
              userWs?.removeMarket(id);
              activePositions.delete(id);
              continue;
            }
          }
          await pos.tick().catch(() => {});
          if (pos.expired) {
            await pos.cancelAll().catch(() => {});
            // OracleSnipe: resolve using Binance price AT market close (not current price)
            // — the outcome is determined by close price, not what Binance does after
            const resolvePrice = pos.oracleSnipe
              ? pos.osClosePrice
              : (feeds[pos.asset]?.get() ?? null);
            pos.resolveInSim(resolvePrice);
            const s = pos.summary;
            simBalance += s.payout;
            trackPnl();
            if (pos.openSnipe) {
              const _tops = { ...s, strategy: "OPENSNIPE" };
              logTrade(_tops); allTradeHistory.push(_tops);
              opsStats.record(s);
              if (s.won !== null) {
                adaptive.record(pos.asset, "OPENSNIPE", s.won);
                if (s.won === true) _recentSettlements.set(pos.asset, { side: s.side, settledAt: Date.now() });
              }
            } else if (pos.oracleSnipe) {
              const _tos = { ...s, strategy: "ORACLESNIPE" };
              logTrade(_tos); allTradeHistory.push(_tos);
              osStats.record(s);
              if (s.won !== null) {
                adaptive.record(pos.asset, "ORACLESNIPE", s.won);
                if (s.won === true) _recentSettlements.set(pos.asset, { side: s.side, settledAt: Date.now() });
              }
            } else if (pos.fundingSnipe) {
              const _tfs = { ...s, strategy: "FUNDINGSNIPE" };
              logTrade(_tfs); allTradeHistory.push(_tfs);
              fsStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "FUNDINGSNIPE", s.won);
            } else if (pos.clobImb) {
              const _tci = { ...s, strategy: "CLOBIMB" };
              logTrade(_tci); allTradeHistory.push(_tci);
              ciStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "CLOBIMB", s.won);
            } else if (pos.latencyBond) {
              const _tlb = { ...s, strategy: "LATENCYBOND" };
              logTrade(_tlb); allTradeHistory.push(_tlb);
              lbStats.record(s);
              if (s.won !== null) {
                adaptive.record(pos.asset, "LATENCYBOND", s.won);
                if (s.won === true) _recentSettlements.set(pos.asset, { side: s.side, settledAt: Date.now() });
              }
            } else if (pos.closeSnipe) {
              const _tcs = { ...s, strategy: "CLOSESNIPE" };
              logTrade(_tcs); allTradeHistory.push(_tcs);
              csStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "CLOSESNIPE", s.won);
            } else if (pos.sniper) {
              const _ts = { ...s, strategy: "SNIPER" };
              logTrade(_ts); allTradeHistory.push(_ts);
              sniperStats.record(s);
              sniper.recordResult(s.won);
              if (s.won !== null) adaptive.record(pos.asset, "SNIPER", s.won);
              sniper.clearMarket(id);
            } else if (pos.fade) {
              const _tf = { ...s, strategy: "FADE" };
              logTrade(_tf); allTradeHistory.push(_tf);
              fadeStats.record(s);
              fade.recordResult(s.won);
              if (s.won !== null) adaptive.record(pos.asset, "FADE", s.won);
              fade.clearMarket(id);
            } else if (pos.cascade) {
              const _tc = { ...s, strategy: "CASCADE" };
              logTrade(_tc); allTradeHistory.push(_tc);
              cascadeStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "CASCADE", s.won);
            } else if (pos.spike) {
              const _tk = { ...s, strategy: "SPIKE" };
              logTrade(_tk); allTradeHistory.push(_tk);
              spikeStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "SPIKE", s.won);
            } else if (pos.open) {
              const _to = { ...s, strategy: "OPEN" };
              logTrade(_to); allTradeHistory.push(_to);
              openStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "OPEN", s.won);
              marketOpenFired.delete(id);
            } else {
              const _tl = { ...s, strategy: "LEM" };
              logTrade(_tl); allTradeHistory.push(_tl);
              lemStats.record(s);
              if (s.won !== null) adaptive.record(pos.asset, "LEM", s.won);
              lateEntry.clearMarket(id);
            }
            clobWs.removeMarket(id);
            userWs?.removeMarket(id);
            activePositions.delete(id);
          }
        } else if (pos.type === 'crossarb') {
          // Cross-market logical ARB — two legs in different markets
          await pos.tick().catch(() => {});
          if (pos.expired) {
            await pos.cancelAll().catch(() => {});
            const s = pos.summary;
            let payout;
            if (s.aFilled && s.bNoFilled) {
              payout = (s.shares ?? 0) * 1.0; // guaranteed minimum (often both pay → $2)
              crossArbStats.bothFilled++;
              crossArbStats.guaranteedProfit += s.guaranteedProfit ?? 0;
            } else if (s.aFilled || s.bNoFilled) {
              payout = (s.shares ?? 0) * 0.5; // single leg — 50/50 directional
              crossArbStats.oneFilled++;
            } else {
              payout = s.totalSpent ?? 0; // no fills — full refund, zero risk taken
              crossArbStats.noFills++;
            }
            crossArbStats.totalSpent += s.totalSpent ?? 0;
            simBalance += payout;
            trackPnl();
            const _txarb = { ...s, strategy: 'XARB', payout };
            logTrade(_txarb); allTradeHistory.push(_txarb);
            const pairKey = `${pos.marketA.id}_x_${pos.marketB.id}`;
            _logicalArbPairs.delete(pairKey);
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
            let payout;
            if (s.upFilled && s.downFilled) payout = (s.shares ?? 0) * 1.00;
            else if (s.upFilled || s.downFilled) payout = (s.shares ?? 0) * 0.50;
            else payout = s.totalSpent ?? 0;
            simBalance += payout;
            trackPnl();
            const tradeRec = { ...s, payout };
            logTrade(tradeRec); allTradeHistory.push(tradeRec);
            if (pos.makerMode) {
              // Maker ARB stats
              if (s.upFilled && s.downFilled) { makerArbStats.bothFilled++; makerArbStats.guaranteedProfit += s.guaranteedProfit ?? 0; }
              else if (s.upFilled || s.downFilled) makerArbStats.oneFilled++;
              else makerArbStats.noFills++;
              makerArbStats.totalSpent += s.totalSpent ?? 0;
            } else {
              stats.record(pos);
            }
            const mktId = pos.marketId ?? id;
            const remaining = Math.max(0, (_mktArbCounts.get(mktId) ?? 1) - 1);
            _mktArbCounts.set(mktId, remaining);
            activePositions.delete(id);
            if (remaining === 0) { clobWs.removeMarket(mktId); userWs?.removeMarket(mktId); }
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
    balance:     LIVE ? (usdcBalance || simBalance) : simBalance,
    walletAddr,
    wsConnected: clobWs.connected,
    wsMarkets:   clobWs.marketCount,
    assets:      CONFIG.assets,
    prices:      Object.fromEntries(CONFIG.assets.map(a => [a, feeds[a]?.get() ?? null])),
    momentums:   Object.fromEntries(CONFIG.assets.map(a => [a, getMomentum(a)])),
    activePositions: [...activePositions.values()].map(p => p.summary),
    arb:    { entered: stats.entered, bothFilled: stats.bothFilled, oneSide: stats.oneFilled, noFills: stats.noFills, guaranteedProfit: stats.guaranteedProfit, totalSpent: stats.totalSpent },
    crossarb:  { entered: crossArbStats.entered, bothFilled: crossArbStats.bothFilled, oneFilled: crossArbStats.oneFilled, noFills: crossArbStats.noFills, guaranteedProfit: crossArbStats.guaranteedProfit, totalSpent: crossArbStats.totalSpent, activePairs: _logicalArbPairs.size },
    makerarb:  { entered: makerArbStats.entered, bothFilled: makerArbStats.bothFilled, oneFilled: makerArbStats.oneFilled, noFills: makerArbStats.noFills, guaranteedProfit: makerArbStats.guaranteedProfit, totalSpent: makerArbStats.totalSpent, threshold: CONFIG.makerArbThreshold },
    lem:    { entered: lemStats.entered, won: lemStats.won, lost: lemStats.lost, totalSpent: lemStats.totalSpent, totalPayout: lemStats.totalPayout },
    sniper:   { entered: sniperStats.entered, won: sniperStats.won, lost: sniperStats.lost, totalSpent: sniperStats.totalSpent, totalPayout: sniperStats.totalPayout, winRate: sniper.winRate, tradeCount: sniper.tradeCount },
    fade:     { entered: fadeStats.entered, won: fadeStats.won, lost: fadeStats.lost, totalSpent: fadeStats.totalSpent, totalPayout: fadeStats.totalPayout, winRate: fade.winRate },
    latencybond:  { entered: lbStats.entered, won: lbStats.won, lost: lbStats.lost, totalSpent: lbStats.totalSpent, totalPayout: lbStats.totalPayout },
    oraclesnipe:  { entered: osStats.entered, won: osStats.won, lost: osStats.lost, totalSpent: osStats.totalSpent, totalPayout: osStats.totalPayout, buffered: expiredMarketBuf.size },
    fundingsnipe: { entered: fsStats.entered, won: fsStats.won, lost: fsStats.lost, totalSpent: fsStats.totalSpent, totalPayout: fsStats.totalPayout },
    clobimb:      { entered: ciStats.entered, won: ciStats.won, lost: ciStats.lost, totalSpent: ciStats.totalSpent, totalPayout: ciStats.totalPayout },
    makerrebate:  { entered: mrStats.entered, won: mrStats.won, lost: mrStats.lost, totalSpent: mrStats.totalSpent, totalPayout: mrStats.totalPayout, activeOrders: _mrOrders.size },
    opensnipe:    { entered: opsStats.entered, won: opsStats.won, lost: opsStats.lost, totalSpent: opsStats.totalSpent, totalPayout: opsStats.totalPayout },
    deribit:      Object.fromEntries(["BTC","ETH"].map(a => [a, getDeribitGamma(a)])),
    uma:          getUmaStats(),
    funding: Object.fromEntries(["BTC","ETH","SOL","XRP","DOGE","AVAX","LINK","MATIC"].map(a => [a, getFundingData(a)])),
    whale:   Object.fromEntries(["BTC","ETH","SOL","XRP","DOGE","AVAX","LINK","MATIC"].map(a => [a, getWhaleSignal(a)])),
    event:   getCurrentEvent(),
    volume:  Object.fromEntries(["BTC","ETH","SOL","XRP","DOGE","AVAX","LINK","MATIC"].map(a => [a, { spike: getVolumeSpike(a), buyPressure: getBuyPressure(a) }])),
    cascade:  { entered: cascadeStats.entered, won: cascadeStats.won, lost: cascadeStats.lost, totalSpent: cascadeStats.totalSpent, totalPayout: cascadeStats.totalPayout },
    spike:    { entered: spikeStats.entered, won: spikeStats.won, lost: spikeStats.lost, totalSpent: spikeStats.totalSpent, totalPayout: spikeStats.totalPayout },
    open:     { entered: openStats.entered, won: openStats.won, lost: openStats.lost, totalSpent: openStats.totalSpent, totalPayout: openStats.totalPayout },
    sweep:    { followed: sweepStats.followed },
    wsSample: marketList.slice(0, 16).map(m => {
      const { yesPrice, noPrice } = clobWs.getPrices(m.upTokenId, m.downTokenId);
      return { asset: m.asset, up: yesPrice, dn: noPrice, endMs: m.endMs };
    }),
    recentTrades: allTradeHistory.slice().sort((a, b) => (b.enteredAt ?? 0) - (a.enteredAt ?? 0)).slice(0, 500),
    pnlHistory:  pnlHistory.slice(-200),
    startBalance,
    analytics: _analytics,
    adaptive:  adaptive.getStats(),
    timestamp: Date.now(),
  }));

  await refreshMarkets();
  setInterval(refreshMarkets,  CONFIG.refreshMs.marketRefresh);
  setInterval(fallbackScan,    CONFIG.refreshMs.scan);
  setInterval(monitor,         CONFIG.refreshMs.clob);
  // setInterval(openingPriceSnipe,    500);  // TIER 0 — paused
  // setInterval(oracleSnipeCheck,     500);  // TIER 1 — paused
  // setInterval(_pollGammaResolutions, 3_000); // paused (used by OracleSnipe)
  setInterval(latencyBondCheck,     500);  // TIER 2 — re-enabled, now on live Binance WS feed
  setInterval(closeSnipeCheck,      1_000);  // buy near-certain side at $0.99 in the last 10-60s
  setInterval(() => { clobWs.setThreshold(getThreshold()); clobWs.setMakerThreshold(CONFIG.makerArbThreshold); }, 10_000);
  // setInterval(fundingSnipeCheck, 10_000);  // TIER 3 — paused
  // setInterval(clobImbalanceCheck,    500); // TIER 4 — paused
  // setInterval(makerRebateCheck,   10_000); // TIER 5 — paused
  // setInterval(makerRebateMonitor,  5_000); // paused
  setInterval(logicalArbCheck, 30_000);  // XARB — cross-market logical arb (all categories)
  setInterval(lateEntryCheck,   2_000);  // disabled inside (25-27% live WR)
  // setInterval(sniperCheck,      2_000); // disabled — high variance, low frequency
  setInterval(fadeCheck,        2_000);  // disabled inside
  setInterval(marketOpenCheck,  3_000);  // disabled inside
  setInterval(macroSpikeCheck,  5_000);  // disabled inside
  setInterval(() => saveSimState(simBalance), CONFIG.refreshMs.simSave);
  setInterval(async () => { try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ } }, 60_000);
  try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ }
  if (LIVE && usdcBalance != null && usdcBalance > 0) {
    simBalance = usdcBalance;
    startBalance = usdcBalance;
    pnlHistory.splice(0, pnlHistory.length, { t: Date.now(), v: usdcBalance });
    console.error(`[bot] Live balance: $${usdcBalance.toFixed(2)} USDC`);
  } else if (LIVE) {
    console.error("[bot] WARNING: USDC balance fetch failed — verify POLY_API_KEY, POLY_API_SECRET, POLY_PASSPHRASE in .env");
  }

  const runAnalysis = () => { try { _analytics = analyzeTrades(); } catch { /* ignore */ } };
  setInterval(runAnalysis, 5 * 60_000); // re-analyze every 5 min
  runAnalysis(); // run once at startup

  setInterval(() => {
    render({
      feedPrices:   Object.fromEntries(Object.entries(feeds).map(([a, f]) => [a, f.get()])),
      feedMoms:     Object.fromEntries(CONFIG.assets.map((a) => [a, getMomentum(a)])),
      feeds, lateEntry,
      activePositions, stats, lemStats, lbStats, osStats, fsStats, ciStats, mrStats, opsStats, csStats,
      sweepStats, sniperStats, sniper, usdcBalance, walletAddr,
      expiredBuf: expiredMarketBuf.size,
      opportunities: getOpportunities(),
      now:           Date.now(),
      simBalance,
      wsConnected:   clobWs.connected,
      wsLastUpdate:  clobWs.lastUpdate,
      wsMarkets:     clobWs.marketCount,
      mrOrders:      _mrOrders,
      marketList,
      clobWs,
    });
  }, CONFIG.refreshMs.display);

  process.on("SIGINT", async () => {
    clobWs.close();
    userWs?.close();
    stopLiqFeed();
    stopFuturesFeed();
    stopTradeFlow();
    stopWhaleFeed();
    stopDeribitFeed();
    stopUmaFeed();
    stopResearchAgent();
    // Cancel all open maker-rebate orders before exit
    for (const [id] of _mrOrders) await cancelMakerOrders(id).catch(() => {});
    for (const feed of Object.values(feeds)) feed.close();
    saveSimState(simBalance);
    for (const [, pos] of activePositions) await pos.cancelAll().catch(() => {});
    const lbPnl  = lbStats.totalPayout - lbStats.totalSpent;
    const osPnl  = osStats.totalPayout - osStats.totalSpent;
    const fsPnl  = fsStats.totalPayout - fsStats.totalSpent;
    const ciPnl  = ciStats.totalPayout - ciStats.totalSpent;
    const mrPnl  = mrStats.totalPayout - mrStats.totalSpent;
    const lbWr   = (lbStats.won + lbStats.lost) > 0 ? `${Math.round(lbStats.won / (lbStats.won + lbStats.lost) * 100)}%` : "--";
    const osWr   = (osStats.won + osStats.lost) > 0 ? `${Math.round(osStats.won / (osStats.won + osStats.lost) * 100)}%` : "--";
    const fsWr   = (fsStats.won + fsStats.lost) > 0 ? `${Math.round(fsStats.won / (fsStats.won + fsStats.lost) * 100)}%` : "--";
    const ciWr   = (ciStats.won + ciStats.lost) > 0 ? `${Math.round(ciStats.won / (ciStats.won + ciStats.lost) * 100)}%` : "--";
    const opsPnl = opsStats.totalPayout - opsStats.totalSpent;
    const opsWr  = (opsStats.won + opsStats.lost) > 0 ? `${Math.round(opsStats.won / (opsStats.won + opsStats.lost) * 100)}%` : "--";
    const csPnl  = csStats.totalPayout - csStats.totalSpent;
    const csWr   = (csStats.won + csStats.lost) > 0 ? `${Math.round(csStats.won / (csStats.won + csStats.lost) * 100)}%` : "--";
    process.stdout.write(
      `\n\nStopped.\n` +
      `ARB:           entered=${stats.entered}  both-filled=${stats.bothFilled}\n` +
      `XARB:          entered=${crossArbStats.entered}  both-filled=${crossArbStats.bothFilled}  locked=$${crossArbStats.guaranteedProfit.toFixed(2)}\n` +
      `MAKER-ARB:     entered=${makerArbStats.entered}  both-filled=${makerArbStats.bothFilled}  locked=$${makerArbStats.guaranteedProfit.toFixed(2)}\n` +
      `OPENSNIPE:     entered=${opsStats.entered}  won=${opsStats.won}  lost=${opsStats.lost}  WR=${opsWr}  P&L=${fmtUsd(opsPnl)}\n` +
      `LATENCYBOND:   entered=${lbStats.entered}  won=${lbStats.won}  lost=${lbStats.lost}  WR=${lbWr}  P&L=${fmtUsd(lbPnl)}\n` +
      `ORACLESNIPE:   entered=${osStats.entered}  won=${osStats.won}  lost=${osStats.lost}  WR=${osWr}  P&L=${fmtUsd(osPnl)}\n` +
      `FUNDINGSNIPE:  entered=${fsStats.entered}  won=${fsStats.won}  lost=${fsStats.lost}  WR=${fsWr}  P&L=${fmtUsd(fsPnl)}\n` +
      `CLOBIMB:       entered=${ciStats.entered}  won=${ciStats.won}  lost=${ciStats.lost}  WR=${ciWr}  P&L=${fmtUsd(ciPnl)}\n` +
      `MAKERREBATE:   pairs=${mrStats.entered}  P&L=${fmtUsd(mrPnl)}\n` +
      `CLOSESNIPE:    entered=${csStats.entered}  won=${csStats.won}  lost=${csStats.lost}  WR=${csWr}  P&L=${fmtUsd(csPnl)}\n` +
      `Sim balance: ${fmtUsd(simBalance)} (saved)\n`
    );
    process.exit(0);
  });
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
