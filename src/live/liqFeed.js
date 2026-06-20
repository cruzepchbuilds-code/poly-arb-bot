// Binance public futures liquidations feed — no API key needed
// SELL order = long position force-closed → price going DOWN
// BUY  order = short position force-closed → price going UP
import WebSocket from "ws";

const BINANCE_TO_ASSET = {
  BTCUSDT: "BTC", ETHUSDT: "ETH", SOLUSDT: "SOL",
  XRPUSDT: "XRP", DOGEUSDT: "DOGE", AVAXUSDT: "AVAX",
  LINKUSDT: "LINK", MATICUSDT: "MATIC",
};

// Rolling 30s window per asset
const _accum    = new Map();
const _callbacks = [];
let _ws      = null;
let _stopped = false;

export function onLiquidationCascade(cb) { _callbacks.push(cb); }

function _emit(asset, direction, totalUsd) {
  for (const cb of _callbacks) { try { cb({ asset, direction, totalUsd }); } catch {} }
}

function _connect() {
  if (_stopped) return;
  _ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");

  _ws.on("message", (raw) => {
    try {
      const o = JSON.parse(raw.toString())?.o;
      if (!o) return;
      const asset = BINANCE_TO_ASSET[o.s];
      if (!asset) return;

      const usd       = Number(o.q) * Number(o.ap);
      const now       = Date.now();
      const WINDOW    = 30_000;
      const THRESHOLD = Number(process.env.LIQ_CASCADE_USD) || 300_000;

      if (!_accum.has(asset)) _accum.set(asset, { longUsd: 0, shortUsd: 0, resetAt: now + WINDOW });
      const acc = _accum.get(asset);

      if (now > acc.resetAt) { acc.longUsd = 0; acc.shortUsd = 0; acc.resetAt = now + WINDOW; }

      if (o.S === "SELL") acc.longUsd  += usd;  // long force-closed → DOWN cascade
      else                acc.shortUsd += usd;   // short force-closed → UP cascade

      if (acc.longUsd > THRESHOLD) {
        _emit(asset, "DOWN", acc.longUsd);
        acc.longUsd = 0; acc.resetAt = now + 60_000;  // 60s cooldown
      } else if (acc.shortUsd > THRESHOLD) {
        _emit(asset, "UP", acc.shortUsd);
        acc.shortUsd = 0; acc.resetAt = now + 60_000;
      }
    } catch {}
  });

  _ws.on("close", () => { if (!_stopped) setTimeout(_connect, 3_000); });
  _ws.on("error", () => {});
}

export function startLiqFeed() { _connect(); }
export function stopLiqFeed()  { _stopped = true; try { _ws?.terminate(); } catch {} }
