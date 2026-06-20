import WebSocket from "ws";
import { CONFIG } from "../config.js";

const WS_BASE = "wss://stream.binance.com:9443/stream";

// Live trade-tick feed — every print pushed the instant it happens, instead
// of polling a REST ticker every 2s. Replaces the old Kraken poll: the
// strategies are designed and labeled around Binance specifically (it's the
// dominant venue price discovery happens on first), so this also fixes a
// mismatch where "Binance lag arb" was actually measuring Kraken's lag.
export class BinanceWsFeed {
  constructor(assets) {
    this._assets   = assets.filter(a => CONFIG.binanceSymbols[a]);
    this._symToAsset = {};
    for (const a of this._assets) this._symToAsset[CONFIG.binanceSymbols[a].toLowerCase()] = a;
    this._prices    = new Map(); // asset -> { price, updatedAt }
    this._ws        = null;
    this._closed    = false;
    this._reconnDelay = 1_000;
  }

  get(asset)            { return this._prices.get(asset)?.price ?? null; }
  getAgeMs(asset)       { const p = this._prices.get(asset); return p ? Date.now() - p.updatedAt : null; }
  getVolPressure()      { return 0.5; } // unused signal, kept for interface parity with the old feed

  connect() {
    if (this._closed) return;
    const streams = this._assets.map(a => `${CONFIG.binanceSymbols[a].toLowerCase()}@trade`).join("/");
    this._ws = new WebSocket(`${WS_BASE}?streams=${streams}`);

    this._ws.on("open", () => {
      this._reconnDelay = 1_000;
      console.log("[binanceWs] connected");
    });

    this._ws.on("message", (buf) => {
      try {
        const msg = JSON.parse(buf.toString());
        const data = msg?.data;
        if (!data || data.e !== "trade") return;
        const asset = this._symToAsset[String(data.s ?? "").toLowerCase()];
        if (!asset) return;
        const p = Number(data.p);
        if (!Number.isFinite(p) || p <= 0) return;
        this._prices.set(asset, { price: p, updatedAt: Date.now() });
      } catch { /* ignore */ }
    });

    let retried = false;
    const retry = () => {
      if (retried) return; // "close" and "error" can both fire for one dropped connection
      retried = true;
      if (this._closed) return;
      try { this._ws?.terminate(); } catch { /* ignore */ }
      const d = this._reconnDelay;
      this._reconnDelay = Math.min(30_000, Math.floor(this._reconnDelay * 1.5));
      setTimeout(() => this.connect(), d);
    };
    this._ws.on("close", retry);
    this._ws.on("error", (e) => { console.log("[binanceWs] error:", e?.message ?? e); retry(); });
  }

  close() {
    this._closed = true;
    try { this._ws?.close(); } catch { /* ignore */ }
  }
}
