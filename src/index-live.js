/**
 * Live bot — mirrors spiralgalaxy's strategy:
 *
 *   Continuously scans all open 5-min BTC and ETH Up/Down markets.
 *   When YES + NO combined price < COMBINED_THRESHOLD, enter both sides
 *   with equal share count. Guaranteed profit regardless of direction.
 *
 *   Example (from spiralgalaxy's actual trades):
 *     BTC Up 12¢ + Down 42¢ = 0.54 combined
 *     Buy 160 shares each → spend $86 → collect $160 → profit $74 (86%)
 *
 *   Run:  npm run live
 *   Sim:  LIVE_MODE=false (default)
 */

import WebSocket from "ws";
import { CONFIG } from "./config.js";
import { fetchAll5minMarkets, fetchClobMidPrices } from "./data/polymarket.js";
import { WindowPosition } from "./live/positions.js";
import { LIVE, getUsdcBalance } from "./live/orders.js";
import { fmtUsd, fmtTime, fmtDuration, pad } from "./utils.js";

// ── ANSI ────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", bgreen: "\x1b[1;32m", bred: "\x1b[1;31m",
};
const W = 62;
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const hdr = (s) => `┌─ ${C.bold}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - stripAnsi(s).length))}┐`;
const sec = (s) => `├─ ${C.cyan}${s}${C.reset} ${"─".repeat(Math.max(0, W - 4 - stripAnsi(s).length))}┤`;
const row = (s) => `│ ${pad(stripAnsi(s), W - 2)} │`.replace(pad(stripAnsi(s), W - 2), s.padEnd(W - 2));
const ftr = () => `└${"─".repeat(W)}┘`;

// ── BTC price feed ──────────────────────────────────────────────────────────
function startPriceFeed(symbol) {
  const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;
  let price = null;
  let ws = null;
  let closed = false;
  let delay = 500;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(url);
    ws.on("open", () => { delay = 500; });
    ws.on("message", (buf) => {
      try { const p = Number(JSON.parse(buf.toString()).p); if (Number.isFinite(p)) price = p; } catch { /* ignore */ }
    });
    const retry = () => {
      if (closed) return;
      try { ws?.terminate(); } catch { /* ignore */ }
      const w = delay; delay = Math.min(10_000, Math.floor(delay * 1.5));
      setTimeout(connect, w);
    };
    ws.on("close", retry);
    ws.on("error", retry);
  };

  connect();
  return { get: () => price, close: () => { closed = true; try { ws?.close(); } catch { /* ignore */ } } };
}

// ── Stats tracker ───────────────────────────────────────────────────────────
class Stats {
  constructor() {
    this.entered = 0;
    this.bothFilled = 0;
    this.oneFilled = 0;
    this.noFills = 0;
    this.totalSpent = 0;
    this.guaranteedProfit = 0; // sum of guaranteed profit from both-filled positions
    this.history = [];         // last 10 completed positions (summary)
  }

  record(pos) {
    const s = pos.summary;
    if (s.upFilled && s.downFilled) {
      this.bothFilled++;
      this.guaranteedProfit += s.guaranteedProfit ?? 0;
    } else if (s.upFilled || s.downFilled) {
      this.oneFilled++;
    } else {
      this.noFills++;
    }
    this.totalSpent += s.totalSpent ?? 0;
    this.history.unshift(s);
    if (this.history.length > 10) this.history.pop();
  }
}

// ── Render ──────────────────────────────────────────────────────────────────
function render({ btcPrice, ethPrice, activePositions, stats, usdcBalance, simBalance, walletAddr, opportunities, now }) {
  const out = ["\x1b[2J\x1b[H"];
  const mode = LIVE ? `${C.bred}● LIVE${C.reset}` : `${C.yellow}● SIM${C.reset}`;

  out.push(hdr(`Polymarket 5-Min Arb Bot  ${mode}`));
  out.push(row(`${C.dim}Wallet: ${walletAddr ?? "not set"}${C.reset}`));
  out.push(row(`${C.dim}Sim: ${C.bgreen}${fmtUsd(simBalance)}${C.reset}${C.dim}  │  BTC: ${btcPrice != null ? fmtUsd(btcPrice) : "connecting..."}  │  ETH: ${ethPrice != null ? fmtUsd(ethPrice) : "connecting..."}${C.reset}`));
  out.push(row(""));

  out.push(sec("SCANNING"));
  const threshold = Number(process.env.COMBINED_THRESHOLD) || CONFIG.combinedThreshold;
  out.push(row(`Watching BTC + ETH 5-min markets  |  threshold: combined < ${threshold.toFixed(2)}`));
  out.push(row(`Last scan: ${fmtTime(new Date(now))}  |  Open positions: ${activePositions.size}`));

  if (opportunities.length > 0) {
    out.push(row(""));
    out.push(row(`${C.bgreen}LIVE OPPORTUNITIES${C.reset}`));
    for (const o of opportunities.slice(0, 4)) {
      const combined = (o.yesPrice + o.noPrice).toFixed(3);
      const edge = ((1 - o.yesPrice - o.noPrice) * 100).toFixed(1);
      out.push(row(
        `${C.green}▶ ${o.asset} ${combined} combined  ` +
        `(UP ${o.yesPrice.toFixed(3)} + DOWN ${o.noPrice.toFixed(3)})  ` +
        `+${edge}% guaranteed${C.reset}`
      ));
    }
  } else {
    out.push(row(`${C.dim}No opportunities right now (waiting for combined < ${threshold.toFixed(2)})${C.reset}`));
  }

  out.push(row(""));
  out.push(sec("ACTIVE POSITIONS"));

  if (activePositions.size === 0) {
    out.push(row(`${C.dim}None${C.reset}`));
  } else {
    for (const [, pos] of activePositions) {
      const s = pos.summary;
      const upMark = s.upFilled ? `${C.green}FILLED${C.reset}` : `${C.yellow}PENDING${C.reset}`;
      const dnMark = s.downFilled ? `${C.green}FILLED${C.reset}` : `${C.yellow}PENDING${C.reset}`;
      out.push(row(
        `${C.cyan}${s.asset}${C.reset}  combined=${s.combined?.toFixed(3)}  ` +
        `${fmtDuration(s.remainingMs)} left  ` +
        `+$${s.guaranteedProfit?.toFixed(2) ?? "?"} locked`
      ));
      out.push(row(`  UP: ${upMark}  DOWN: ${dnMark}  ${s.shares}shares × $${s.totalSpent?.toFixed(2)}`));
      const lastLog = s.log[s.log.length - 1] ?? "";
      if (lastLog) out.push(row(`  ${C.dim}${lastLog}${C.reset}`));
    }
  }

  out.push(row(""));
  out.push(sec("SESSION STATS"));
  out.push(row(
    `Entered: ${stats.entered}  │  ` +
    `Both filled: ${C.green}${stats.bothFilled}${C.reset}  │  ` +
    `One side: ${C.yellow}${stats.oneFilled}${C.reset}  │  ` +
    `No fills: ${C.dim}${stats.noFills}${C.reset}`
  ));
  if (stats.bothFilled > 0) {
    out.push(row(
      `Guaranteed P&L locked: ${C.bgreen}+${fmtUsd(stats.guaranteedProfit)}${C.reset}  │  ` +
      `Total spent: ${fmtUsd(stats.totalSpent)}`
    ));
  }

  out.push(row(""));
  out.push(sec("RECENT COMPLETED"));

  if (stats.history.length === 0) {
    out.push(row(`${C.dim}No completed windows yet${C.reset}`));
  } else {
    for (const s of stats.history.slice(0, 5)) {
      const both = s.upFilled && s.downFilled;
      const one = s.upFilled || s.downFilled;
      const color = both ? C.green : one ? C.yellow : C.dim;
      const mark = both ? "✓" : one ? "~" : "✗";
      out.push(row(
        `${color}${mark} ${s.asset}  combined=${s.combined?.toFixed(3)}  ` +
        `+$${s.guaranteedProfit?.toFixed(2) ?? "0.00"} locked  ` +
        `${both ? "BOTH FILLED" : one ? "ONE SIDE" : "NO FILLS"}${C.reset}`
      ));
    }
  }

  out.push(row(""));
  out.push(ftr());
  out.push(`  ${C.dim}${fmtTime(new Date(now))}  |  Ctrl+C to exit${C.reset}`);

  process.stdout.write(out.join("\n") + "\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Load .env
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
    console.warn("\n⚠️  LIVE_MODE=true — REAL ORDERS ACTIVE\n");
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    console.log("SIM MODE — watching for opportunities. Set LIVE_MODE=true to trade for real.\n");
  }

  if (!process.env.PRIVATE_KEY && LIVE) {
    console.error("PRIVATE_KEY not set. Run: cp .env.example .env, then fill it in.");
    process.exit(1);
  }

  let walletAddr = null;
  if (process.env.PRIVATE_KEY) {
    try {
      const { walletAddress } = await import("./live/client.js");
      walletAddr = walletAddress();
    } catch { /* ignore */ }
  }

  // Price feeds
  const btcFeed = startPriceFeed("BTCUSDT");
  const ethFeed = startPriceFeed("ETHUSDT");

  const activePositions = new Map(); // marketId → WindowPosition
  const stats = new Stats();
  let usdcBalance = null;
  let opportunities = [];
  let simBalance = CONFIG.paper.startBalance;

  // Refresh USDC balance every 60s
  setInterval(async () => {
    try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ }
  }, 60_000);
  try { usdcBalance = await getUsdcBalance(); } catch { /* ignore */ }

  // ── Scanner: find opportunities and enter ─────────────────────────────────
  const scan = async () => {
    const threshold = Number(process.env.COMBINED_THRESHOLD) || CONFIG.combinedThreshold;

    let markets = [];
    try { markets = await fetchAll5minMarkets(); } catch { return; }

    const found = [];

    for (const market of markets) {
      if (activePositions.has(market.id)) continue;

      let yesPrice, noPrice;
      try {
        const p = await fetchClobMidPrices(market.upTokenId, market.downTokenId);
        yesPrice = p.yesPrice;
        noPrice = p.noPrice;
      } catch { continue; }

      if (yesPrice == null || noPrice == null) continue;

      const combined = yesPrice + noPrice;

      if (combined < threshold) {
        found.push({ ...market, yesPrice, noPrice, combined });

        // Don't over-deploy — cap at 5 simultaneous positions
        if (activePositions.size >= 5) continue;

        const pos = new WindowPosition({
          id: market.id,
          asset: market.asset,
          upTokenId: market.upTokenId,
          downTokenId: market.downTokenId,
          windowEndMs: market.endMs,
        });

        const allocated = [...activePositions.values()].reduce((s, p) => s + (p.totalSpent ?? 0), 0);
        const available = Math.max(0, simBalance - allocated);
        const kellyBet = available * ((1 - combined) / combined) * 0.5;
        const betSize = Math.max(1, Math.min(kellyBet, available * 0.35));
        const entered = await pos.enter(yesPrice, noPrice, betSize);
        if (entered) {
          simBalance -= pos.totalSpent ?? 0;
          activePositions.set(market.id, pos);
          stats.entered++;
        }
      }
    }

    // Sort by best spread for display
    opportunities = found.sort((a, b) => a.combined - b.combined);
  };

  // ── Monitor: tick open positions, close expired ones ─────────────────────
  const monitor = async () => {
    for (const [id, pos] of activePositions) {
      // Refresh prices for this position
      let yesPrice = null, noPrice = null;
      try {
        const p = await fetchClobMidPrices(pos.upTokenId, pos.downTokenId);
        yesPrice = p.yesPrice;
        noPrice = p.noPrice;
      } catch { /* keep stale */ }

      await pos.tick(yesPrice, noPrice).catch(() => {});

      // Clean up expired positions
      if (pos.expired) {
        await pos.cancelAll().catch(() => {});
        stats.record(pos);
        { const p = pos.summary; simBalance += p.upFilled && p.downFilled ? p.shares * 1.00 : (p.upFilled || p.downFilled) ? p.shares * 0.50 : 0; }
        activePositions.delete(id);
      }
    }
  };

  // Kick off loops
  await scan();
  setInterval(scan, CONFIG.refreshMs.scan);
  setInterval(monitor, CONFIG.refreshMs.clob);

  // ── Display loop ──────────────────────────────────────────────────────────
  setInterval(() => {
    render({
      btcPrice: btcFeed.get(),
      ethPrice: ethFeed.get(),
      activePositions,
      stats,
      usdcBalance,
      simBalance,
      walletAddr,
      opportunities,
      now: Date.now(),
    });
  }, CONFIG.refreshMs.display);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    btcFeed.close();
    ethFeed.close();
    for (const [, pos] of activePositions) {
      await pos.cancelAll().catch(() => {});
    }
    process.stdout.write(
      `\n\nStopped.\nEntered: ${stats.entered}  Both filled: ${stats.bothFilled}  ` +
      `Guaranteed P&L: +${fmtUsd(stats.guaranteedProfit)}\n`
    );
    process.exit(0);
  });
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
