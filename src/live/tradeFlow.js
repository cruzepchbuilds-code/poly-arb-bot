/**
 * Binance real-time aggregate trade stream — volume spike + buy pressure detection.
 *
 * Subscribes to @aggTrade for all 8 assets on a single multiplexed connection.
 * Maintains a rolling 90-second buffer per asset.
 *
 * getVolumeSpike(asset)  → ratio of last-10s USD volume vs prior-50s per-10s average.
 *                          null = insufficient data, >4.0 = significant spike.
 * getBuyPressure(asset)  → fraction of last-60s volume that was buy-initiated.
 *                          null = insufficient data, >0.60 = strong buys, <0.40 = strong sells.
 */

import WebSocket from "ws";

const SYMBOLS = {
  BTC: "btcusdt", ETH: "ethusdt", SOL: "solusdt", XRP: "xrpusdt",
  DOGE: "dogeusdt", AVAX: "avaxusdt", LINK: "linkusdt", MATIC: "maticusdt",
};

const ASSET_BY_UPPER = Object.fromEntries(
  Object.entries(SYMBOLS).map(([a, s]) => [s.toUpperCase(), a])
);

// Per-asset rolling trade buffer — last 90 seconds of trades
const _buf = Object.fromEntries(Object.keys(SYMBOLS).map(a => [a, []]));

let _ws      = null;
let _stopped = false;

function _connect() {
  if (_stopped) return;
  const streams = Object.values(SYMBOLS).map(s => `${s}@aggTrade`).join("/");
  _ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  _ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const d   = msg?.data;
      if (!d || d.e !== "aggTrade") return;
      const asset = ASSET_BY_UPPER[d.s];
      if (!asset) return;

      const usd   = Number(d.p) * Number(d.q); // USD value of this trade
      const isBuy = d.m === false;              // m=true → seller is taker (sell); m=false → buyer is taker (buy)
      const ts    = Date.now();
      const b     = _buf[asset];
      b.push({ ts, usd, isBuy });
      // Trim to 90-second window
      const cutoff = ts - 90_000;
      let i = 0;
      while (i < b.length && b[i].ts < cutoff) i++;
      if (i > 0) b.splice(0, i);
    } catch { /* ignore malformed frames */ }
  });

  _ws.on("close", () => { if (!_stopped) setTimeout(_connect, 3_000); });
  _ws.on("error", () => {});
}

export function startTradeFlow() { _stopped = false; _connect(); }
export function stopTradeFlow()  { _stopped = true; try { _ws?.terminate(); } catch {} }

/**
 * Volume spike ratio: last 10s vs average 10s-bucket of the prior 50s.
 * Returns null if < 3 data points. Returns ratio (>4 = significant spike).
 */
export function getVolumeSpike(asset) {
  const b = _buf[asset];
  if (!b || b.length < 3) return null;
  const now    = Date.now();
  const recent = b.filter(t => t.ts >= now - 10_000);
  const prior  = b.filter(t => t.ts >= now - 60_000 && t.ts < now - 10_000);
  if (recent.length < 2 || prior.length < 2) return null;
  const recentVol    = recent.reduce((s, t) => s + t.usd, 0);
  const priorAvg10s  = prior.reduce((s, t) => s + t.usd, 0) / 5; // 50s / 5 = per-10s average
  if (priorAvg10s <= 0) return null;
  return recentVol / priorAvg10s;
}

/**
 * Buy pressure ratio over the last 60 seconds.
 * Returns null if < 5 data points. >0.60 = strong buy flow, <0.40 = strong sell flow.
 */
export function getBuyPressure(asset) {
  const b = _buf[asset];
  if (!b || b.length < 5) return null;
  const now    = Date.now();
  const recent = b.filter(t => t.ts >= now - 60_000);
  if (recent.length < 5) return null;
  const buyVol  = recent.reduce((s, t) => s + (t.isBuy ? t.usd : 0), 0);
  const total   = recent.reduce((s, t) => s + t.usd, 0);
  if (total <= 0) return null;
  return buyVol / total;
}
