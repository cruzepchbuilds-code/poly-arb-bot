import WebSocket from "ws";
import { CONFIG } from "./config.js";
import { fetchKlines } from "./data/binance.js";
import { fetchActiveBtcMarket, getTokenIds, fetchClobMidPrices } from "./data/polymarket.js";
import { computeVwapSeries } from "./indicators/vwap.js";
import { computeRsi, slopeLast } from "./indicators/rsi.js";
import { computeMacd } from "./indicators/macd.js";
import { computeHeikenAshi, countConsecutive } from "./indicators/heikenAshi.js";
import { detectRegime } from "./engines/regime.js";
import { scoreDirection, applyTimeAwareness } from "./engines/probability.js";
import { computeEdge, decide } from "./engines/edge.js";
import { PaperBook } from "./paper/book.js";
import { fmtUsd, fmtPct, fmtTime, fmtDuration, pad, padL } from "./utils.js";

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgreen: "\x1b[1;32m",
  bred: "\x1b[1;31m",
  byellow: "\x1b[1;33m",
  bcyan: "\x1b[1;36m",
};

const W = 58; // display width
const divider = "─".repeat(W);
const line = (s = "") => `│ ${pad(s, W - 2)} │`;
const header = (s) => `┌─ ${C.bold}${s}${C.reset} ${"─".repeat(W - 4 - stripAnsi(s).length)}┐`;
const section = (s) => `├─ ${C.cyan}${s}${C.reset} ${"─".repeat(W - 4 - stripAnsi(s).length)}┤`;
const footer = () => `└${"─".repeat(W)}┘`;

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function colorBand(v, lo, hi, inverted = false) {
  if (v == null) return C.white;
  const bull = inverted ? v < lo : v > hi;
  const bear = inverted ? v > hi : v < lo;
  if (bull) return C.green;
  if (bear) return C.red;
  return C.yellow;
}

// ── Window timing ─────────────────────────────────────────────────────────────
function getWindowBoundary(now = Date.now()) {
  const d = new Date(now);
  const m = d.getMinutes();
  const windowStartMin = Math.floor(m / 15) * 15;
  const start = new Date(d);
  start.setMinutes(windowStartMin, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 15 * 60 * 1000;
  const remainingMs = endMs - now;
  return {
    startMs,
    endMs,
    remainingMs,
    remainingMinutes: remainingMs / 60_000,
  };
}

// ── Binance live price via WebSocket ─────────────────────────────────────────
function startPriceFeed() {
  const symbol = CONFIG.symbol.toLowerCase();
  const url = `wss://stream.binance.com:9443/ws/${symbol}@trade`;
  let price = null;
  let ws = null;
  let closed = false;
  let reconnectMs = 500;

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(url);

    ws.on("open", () => { reconnectMs = 500; });

    ws.on("message", (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        const p = Number(msg.p);
        if (Number.isFinite(p)) price = p;
      } catch { /* ignore parse errors */ }
    });

    const retry = () => {
      if (closed) return;
      try { ws?.terminate(); } catch { /* ignore */ }
      ws = null;
      const wait = reconnectMs;
      reconnectMs = Math.min(10_000, Math.floor(reconnectMs * 1.5));
      setTimeout(connect, wait);
    };

    ws.on("close", retry);
    ws.on("error", retry);
  };

  connect();

  return {
    get() { return price; },
    close() {
      closed = true;
      try { ws?.close(); } catch { /* ignore */ }
    },
  };
}

// ── Compute all indicators from klines ───────────────────────────────────────
function computeIndicators(klines) {
  if (!klines || klines.length < 30) return null;

  const closes = klines.map((k) => k.close);
  const vwapSeries = computeVwapSeries(klines);
  const vwap = vwapSeries[vwapSeries.length - 1];
  const vwapSlope = slopeLast(vwapSeries, CONFIG.indicators.vwapSlopePoints);

  // Count recent VWAP crosses (last 20 candles)
  let vwapCrossCount = 0;
  const recent = klines.slice(-20);
  for (let i = 1; i < recent.length; i++) {
    const prevAbove = recent[i - 1].close > vwapSeries[vwapSeries.length - 20 + i - 1];
    const curAbove = recent[i].close > vwapSeries[vwapSeries.length - 20 + i];
    if (prevAbove !== curAbove) vwapCrossCount++;
  }

  const rsi = computeRsi(closes, CONFIG.indicators.rsiPeriod);
  const rsiSeries = closes
    .map((_, i) =>
      i >= CONFIG.indicators.rsiPeriod
        ? computeRsi(closes.slice(0, i + 1), CONFIG.indicators.rsiPeriod)
        : null
    )
    .filter((v) => v !== null);
  const rsiSlope = slopeLast(rsiSeries, 3);

  const macd = computeMacd(
    closes,
    CONFIG.indicators.macdFast,
    CONFIG.indicators.macdSlow,
    CONFIG.indicators.macdSignal
  );

  const ha = computeHeikenAshi(klines);
  const { color: heikenColor, count: heikenCount } = countConsecutive(ha);

  const volumeRecent = klines[klines.length - 1]?.volume ?? null;
  const volumeAvg =
    klines.length >= 20
      ? klines.slice(-20).reduce((s, k) => s + (k.volume ?? 0), 0) / 20
      : null;

  return {
    vwap,
    vwapSlope,
    vwapCrossCount,
    rsi,
    rsiSlope,
    macd,
    heikenColor,
    heikenCount,
    volumeRecent,
    volumeAvg,
  };
}

// ── Terminal display ──────────────────────────────────────────────────────────
function render(state) {
  const {
    price,
    klines,
    ind,
    regime,
    window: win,
    yesPrice,
    noPrice,
    modelUp,
    modelDown,
    edge,
    decision,
    book,
    lastResolved,
    polymarketConnected,
    updatedAt,
  } = state;

  const lines = [];
  const push = (s = "") => lines.push(s);

  // Clear screen
  push("\x1b[2J\x1b[H");

  // Header
  push(header(`BTC/USD  Polymarket 15-Min Paper Trader`));
  push(line());

  // Price
  const pricePrev = klines?.[klines.length - 2]?.close ?? price;
  const priceChange = price != null && pricePrev != null ? (price - pricePrev) / pricePrev : null;
  const priceColor = priceChange == null ? C.white : priceChange >= 0 ? C.green : C.red;
  push(
    line(
      `${C.bold}BTC Price:${C.reset}  ${C.bcyan}${fmtUsd(price)}${C.reset}  ` +
      `${priceColor}${fmtPct(priceChange)}${C.reset}`
    )
  );

  // VWAP
  if (ind) {
    const vwapDiff = price != null && ind.vwap != null ? (price - ind.vwap) / ind.vwap : null;
    const vColor = vwapDiff == null ? C.white : vwapDiff >= 0 ? C.green : C.red;
    push(
      line(
        `VWAP:       ${fmtUsd(ind.vwap)}  ` +
        `${vColor}(${vwapDiff != null ? (vwapDiff >= 0 ? "+" : "") + (vwapDiff * 100).toFixed(3) + "%" : "N/A"})${C.reset}  ` +
        `slope ${ind.vwapSlope != null ? (ind.vwapSlope >= 0 ? C.green + "↑" : C.red + "↓") + C.reset : "?"}`
      )
    );
  }

  // Regime
  if (regime) {
    const rColor =
      regime.regime === "TREND_UP" ? C.green :
      regime.regime === "TREND_DOWN" ? C.red :
      C.yellow;
    push(line(`Regime:     ${rColor}${C.bold}${regime.regime}${C.reset}  ${C.dim}(${regime.reason})${C.reset}`));
  }

  // RSI
  if (ind) {
    const rsiColor = colorBand(ind.rsi, 45, 55);
    const rsiArrow = ind.rsiSlope == null ? "?" : ind.rsiSlope > 0 ? "↑" : "↓";
    push(
      line(
        `RSI(14):    ${rsiColor}${ind.rsi != null ? ind.rsi.toFixed(1) : "N/A"}  ${rsiArrow}${C.reset}` +
        (ind.rsi != null ? `  ${C.dim}(${ind.rsi > 70 ? "OVERBOUGHT" : ind.rsi < 30 ? "OVERSOLD" : ind.rsi > 55 ? "BULLISH" : ind.rsi < 45 ? "BEARISH" : "NEUTRAL"})${C.reset}` : "")
      )
    );

    // MACD
    const mHist = ind.macd?.hist;
    const mDelta = ind.macd?.histDelta;
    const mColor = mHist == null ? C.white : mHist > 0 ? C.green : C.red;
    const mArrow = mDelta == null ? "?" : mDelta > 0 ? "↑" : "↓";
    push(
      line(
        `MACD hist:  ${mColor}${mHist != null ? (mHist >= 0 ? "+" : "") + mHist.toFixed(2) : "N/A"}  ${mArrow}${C.reset}` +
        (mHist != null ? `  ${C.dim}(${mHist > 0 && mDelta > 0 ? "BULL EXPAND" : mHist < 0 && mDelta < 0 ? "BEAR EXPAND" : mHist > 0 ? "BULL FADE" : "BEAR FADE"})${C.reset}` : "")
      )
    );

    // Heiken Ashi
    const hColor = ind.heikenColor === "green" ? C.green : ind.heikenColor === "red" ? C.red : C.white;
    push(
      line(
        `Heiken Ashi:  ${hColor}${(ind.heikenColor ?? "N/A").toUpperCase()}  x${ind.heikenCount ?? 0}${C.reset}`
      )
    );
  }

  push(line());
  push(section("MARKET WINDOW"));
  push(line());

  // Window timing
  const phase = decision?.phase ?? "?";
  const phaseColor = phase === "EARLY" ? C.green : phase === "MID" ? C.yellow : C.red;
  push(
    line(
      `Phase:  ${phaseColor}${C.bold}${phase}${C.reset}  ` +
      `(${fmtDuration(win.remainingMs)} remaining)`
    )
  );

  // Polymarket prices
  const pmStatus = polymarketConnected
    ? `${C.green}connected${C.reset}`
    : `${C.dim}searching...${C.reset}`;
  push(line(`Polymarket: ${pmStatus}`));

  if (yesPrice != null || noPrice != null) {
    push(
      line(
        `YES (UP):   ${C.green}${yesPrice != null ? yesPrice.toFixed(3) : "N/A"}${C.reset}  │  ` +
        `NO (DOWN):  ${C.red}${noPrice != null ? noPrice.toFixed(3) : "N/A"}${C.reset}`
      )
    );
  }

  // Model probabilities
  if (modelUp != null) {
    push(
      line(
        `Model UP:   ${C.green}${(modelUp * 100).toFixed(1)}%${C.reset}  │  ` +
        `Model DOWN: ${C.red}${(modelDown * 100).toFixed(1)}%${C.reset}`
      )
    );
  }

  // Edge
  if (edge?.edgeUp != null) {
    const euColor = edge.edgeUp > 0 ? C.green : C.red;
    const edColor = edge.edgeDown > 0 ? C.green : C.red;
    push(
      line(
        `Edge UP:    ${euColor}${fmtPct(edge.edgeUp)}${C.reset}  │  ` +
        `Edge DOWN:  ${edColor}${fmtPct(edge.edgeDown)}${C.reset}`
      )
    );
  }

  push(line());

  // Signal
  if (decision) {
    let sigStr;
    if (decision.action === "ENTER") {
      const sColor = decision.side === "UP" ? C.bgreen : C.bred;
      const strength = decision.strength ?? "";
      sigStr =
        `${sColor}▶  ENTER ${decision.side}${C.reset}  ` +
        `${C.bold}[${strength}]${C.reset}  ` +
        `edge=${fmtPct(decision.edge)}`;
    } else {
      sigStr =
        `${C.dim}—  NO TRADE${C.reset}  ${C.dim}(${decision.reason})${C.reset}`;
    }
    push(line(`Signal:  ${sigStr}`));
  } else {
    push(line(`Signal:  ${C.dim}waiting for data...${C.reset}`));
  }

  push(line());
  push(section("PAPER ACCOUNT"));
  push(line());

  // Balance
  const stats = book.stats;
  const balDiff = book.balance - book.startBalance;
  const balColor = balDiff >= 0 ? C.green : C.red;
  push(
    line(
      `Balance: ${C.bold}${fmtUsd(book.balance)}${C.reset}  ` +
      `${balColor}(${balDiff >= 0 ? "+" : ""}${fmtUsd(balDiff)} / ${fmtPct(balDiff / book.startBalance)})${C.reset}`
    )
  );

  // Open trade
  if (book.openTrade) {
    const t = book.openTrade;
    const tColor = t.side === "UP" ? C.green : C.red;
    const unrealizedBtcMove = price != null && t.btcEntryPrice != null
      ? price - t.btcEntryPrice
      : null;
    const isWinning =
      unrealizedBtcMove != null &&
      ((t.side === "UP" && unrealizedBtcMove > 0) ||
        (t.side === "DOWN" && unrealizedBtcMove < 0));
    const unrealColor = isWinning ? C.green : C.red;

    push(
      line(
        `Open:    ${tColor}${t.side}${C.reset} @ ${t.entryPrice.toFixed(3)}  ` +
        `${t.shares} shares  BTC=${fmtUsd(t.btcEntryPrice)}`
      )
    );
    push(
      line(
        `         Current BTC: ${fmtUsd(price)}  ` +
        `${unrealColor}(${unrealizedBtcMove != null ? (unrealizedBtcMove >= 0 ? "+" : "") + unrealizedBtcMove.toFixed(0) : "?"})${C.reset}`
      )
    );
  } else {
    push(line(`Open:    ${C.dim}none${C.reset}`));
  }

  // Stats
  if (stats.n > 0) {
    const wrColor = stats.winRate >= 0.55 ? C.green : stats.winRate >= 0.45 ? C.yellow : C.red;
    push(
      line(
        `Trades:  ${stats.n}  │  ` +
        `Wins: ${wrColor}${stats.wins} (${stats.winRate != null ? (stats.winRate * 100).toFixed(1) + "%" : "N/A"})${C.reset}  │  ` +
        `Avg edge: ${stats.avgEdge != null ? fmtPct(stats.avgEdge) : "N/A"}`
      )
    );
  } else {
    push(line(`Trades:  ${C.dim}no completed trades yet${C.reset}`));
  }

  // Last resolved
  if (lastResolved) {
    const r = lastResolved;
    const rColor = r.won ? C.green : C.red;
    const rMark = r.won ? "✓" : "✗";
    push(
      line(
        `Last:    ${rColor}${rMark} ${r.side}${C.reset}  ` +
        `@ ${r.entryPrice.toFixed(3)}  ` +
        `BTC ${fmtUsd(r.btcEntryPrice)}→${fmtUsd(r.btcExitPrice)}  ` +
        `P&L ${rColor}${r.pnl >= 0 ? "+" : ""}${fmtUsd(r.pnl)}${C.reset}`
      )
    );
  }

  push(line());
  push(section("RECENT TRADES"));
  push(line());

  const recent = book.recentTrades(6);
  if (recent.length === 0) {
    push(line(`  ${C.dim}No trades yet. Waiting for a signal...${C.reset}`));
  } else {
    for (const t of recent) {
      const tColor = t.won ? C.green : C.red;
      const mark = t.won ? "✓" : "✗";
      const btcMove = t.btcExitPrice - t.btcEntryPrice;
      push(
        line(
          `${tColor}${mark}${C.reset} ` +
          `${pad(t.side, 4)} ` +
          `@ ${t.entryPrice.toFixed(2)}  ` +
          `BTC ${(btcMove >= 0 ? "+" : "") + btcMove.toFixed(0).padStart(6)}  ` +
          `${tColor}P&L ${(t.pnl >= 0 ? "+" : "") + fmtUsd(t.pnl)}${C.reset}`
        )
      );
    }
  }

  push(line());
  push(footer());
  push(
    `  ${C.dim}Updated: ${fmtTime(new Date(updatedAt))}  │  Ctrl+C to stop${C.reset}`
  );

  process.stdout.write(lines.join("\n") + "\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting BTC Polymarket Paper Trader...");

  const book = new PaperBook(CONFIG.paper.startBalance);
  const priceFeed = startPriceFeed();

  let klines = null;
  let polymarketMarket = null;
  let upTokenId = null;
  let downTokenId = null;
  let yesPrice = null;
  let noPrice = null;
  let lastResolved = null;
  let prevWindowStartMs = null;
  let windowStartPrice = null;

  // Initial data fetch
  try {
    klines = await fetchKlines({
      interval: CONFIG.indicators.klinesInterval,
      limit: CONFIG.indicators.klinesLimit,
    });
  } catch (e) {
    console.error("Failed initial klines fetch:", e.message);
  }

  // Refresh klines every 10s
  setInterval(async () => {
    try {
      klines = await fetchKlines({
        interval: CONFIG.indicators.klinesInterval,
        limit: CONFIG.indicators.klinesLimit,
      });
    } catch { /* keep stale */ }
  }, CONFIG.refreshMs.klines);

  // Refresh Polymarket market every 30s
  const refreshPolymarket = async () => {
    try {
      polymarketMarket = await fetchActiveBtcMarket();
      if (polymarketMarket) {
        const ids = getTokenIds(polymarketMarket);
        upTokenId = ids.upTokenId;
        downTokenId = ids.downTokenId;
      }
    } catch { /* keep stale */ }
  };
  await refreshPolymarket();
  setInterval(refreshPolymarket, CONFIG.refreshMs.polymarket);

  // Refresh CLOB prices every 5s
  setInterval(async () => {
    if (!upTokenId && !downTokenId) return;
    try {
      const prices = await fetchClobMidPrices(upTokenId, downTokenId);
      if (prices.yesPrice != null) yesPrice = prices.yesPrice;
      if (prices.noPrice != null) noPrice = prices.noPrice;
    } catch { /* keep stale */ }
  }, CONFIG.refreshMs.clob);

  // Main display + trading loop
  setInterval(() => {
    const price = priceFeed.get();
    const now = Date.now();
    const win = getWindowBoundary(now);

    // New window started — record the open price and resolve prior trade
    if (prevWindowStartMs !== null && win.startMs !== prevWindowStartMs) {
      // Window rolled over
      if (book.openTrade && windowStartPrice != null && price != null) {
        const resolved = book.resolve(price);
        if (resolved) lastResolved = resolved;
      }
      windowStartPrice = price;
    }

    if (prevWindowStartMs === null) {
      windowStartPrice = price;
    }

    prevWindowStartMs = win.startMs;

    // Compute indicators
    const ind = computeIndicators(klines);

    // Regime
    const regime =
      ind != null
        ? detectRegime({
            price,
            vwap: ind.vwap,
            vwapSlope: ind.vwapSlope,
            vwapCrossCount: ind.vwapCrossCount,
            volumeRecent: ind.volumeRecent,
            volumeAvg: ind.volumeAvg,
          })
        : null;

    // Probability
    let modelUp = null;
    let modelDown = null;
    if (ind != null && price != null) {
      const scored = scoreDirection({
        price,
        vwap: ind.vwap,
        vwapSlope: ind.vwapSlope,
        rsi: ind.rsi,
        rsiSlope: ind.rsiSlope,
        macd: ind.macd,
        heikenColor: ind.heikenColor,
        heikenCount: ind.heikenCount,
        failedVwapReclaim: false,
      });

      const timed = applyTimeAwareness(scored.rawUp, win.remainingMinutes, 15);
      modelUp = timed.adjustedUp;
      modelDown = timed.adjustedDown;
    }

    // Edge
    const edge = computeEdge({
      modelUp: modelUp ?? 0.5,
      modelDown: modelDown ?? 0.5,
      marketYes: yesPrice,
      marketNo: noPrice,
    });

    // Decision
    const decision =
      modelUp != null
        ? decide({
            remainingMinutes: win.remainingMinutes,
            edgeUp: edge.edgeUp,
            edgeDown: edge.edgeDown,
            modelUp,
            modelDown,
          })
        : null;

    // Paper trading — enter if signal says ENTER and window has time left
    if (
      decision?.action === "ENTER" &&
      !book.openTrade &&
      win.remainingMinutes > 1 &&
      price != null
    ) {
      const entryPrice =
        decision.side === "UP"
          ? (yesPrice ?? 0.5)
          : (noPrice ?? 0.5);

      book.enter({
        side: decision.side,
        entryPrice,
        shares: CONFIG.paper.tradeShares,
        btcEntryPrice: windowStartPrice ?? price,
        windowEndMs: win.endMs,
        edge: decision.edge,
      });
    }

    render({
      price,
      klines,
      ind,
      regime,
      window: win,
      yesPrice,
      noPrice,
      modelUp,
      modelDown,
      edge,
      decision,
      book,
      lastResolved,
      polymarketConnected: !!polymarketMarket,
      updatedAt: now,
    });
  }, CONFIG.refreshMs.display);

  // Graceful shutdown
  process.on("SIGINT", () => {
    priceFeed.close();
    process.stdout.write("\n\nStopped. Final balance: " + fmtUsd(book.balance) + "\n");
    const s = book.stats;
    if (s.n > 0) {
      process.stdout.write(
        `Trades: ${s.n}  Wins: ${s.wins} (${((s.winRate ?? 0) * 100).toFixed(1)}%)  P&L: ${fmtUsd(s.totalPnl)}\n`
      );
    }
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
