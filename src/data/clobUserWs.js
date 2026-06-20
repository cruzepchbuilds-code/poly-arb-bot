import WebSocket from "ws";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/user";
const MAX_AGE_MS = 30 * 60_000;

// Authenticated user channel — pushes our own order/trade updates the instant
// they happen, instead of waiting for the next REST poll. Pure speed layer:
// getOrderStatus() in orders.js still calls REST as the ground truth and only
// takes the larger of the two sizeFilled values, so if this feed is ever down,
// misconfigured, or wrong, fill detection degrades to exactly today's REST-only
// behavior — it can never be worse, only slower.
export class ClobUserWsFeed {
  constructor({ apiKey, secret, passphrase }) {
    this._auth = { apiKey, secret, passphrase };
    this._orders = new Map(); // orderId -> { status, sizeFilled, updatedAt }
    this._marketIds = new Set();
    this._pending = new Set();
    this._ws = null;
    this._closed = false;
    this._reconnDelay = 1_000;
    this._pingTimer = null;
    this.connected = false;
  }

  getOrder(orderId) {
    const o = this._orders.get(orderId);
    if (!o) return null;
    if (Date.now() - o.updatedAt > MAX_AGE_MS) { this._orders.delete(orderId); return null; }
    return o;
  }

  addMarkets(conditionIds) {
    const fresh = conditionIds.filter(id => id && !this._marketIds.has(id));
    if (!fresh.length) return;
    for (const id of fresh) this._marketIds.add(id);
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._subscribe(fresh);
    } else {
      for (const id of fresh) this._pending.add(id);
    }
  }

  removeMarket(conditionId) {
    this._marketIds.delete(conditionId);
  }

  connect() {
    if (this._closed) return;
    this._ws = new WebSocket(WS_URL);

    this._ws.on("open", () => {
      this.connected = true;
      this._reconnDelay = 1_000;
      console.log("[userWs] connected");
      const ids = [...new Set([...this._pending, ...this._marketIds])];
      this._pending.clear();
      if (ids.length) this._subscribe(ids);
      this._pingTimer = setInterval(() => {
        try { this._ws?.send("PING"); } catch { /* ignore */ }
      }, 10_000);
    });

    this._ws.on("message", (buf) => {
      const text = buf.toString();
      if (text === "PONG") return;
      try {
        const msgs = JSON.parse(text);
        for (const msg of (Array.isArray(msgs) ? msgs : [msgs])) this._handle(msg);
      } catch { /* ignore non-JSON */ }
    });

    const retry = () => {
      this.connected = false;
      clearInterval(this._pingTimer);
      if (this._closed) return;
      try { this._ws?.terminate(); } catch { /* ignore */ }
      const d = this._reconnDelay;
      this._reconnDelay = Math.min(30_000, Math.floor(this._reconnDelay * 1.5));
      setTimeout(() => this.connect(), d);
    };
    this._ws.on("close", retry);
    this._ws.on("error", (e) => { console.log("[userWs] error:", e?.message ?? e); retry(); });
  }

  close() {
    this._closed = true;
    clearInterval(this._pingTimer);
    try { this._ws?.close(); } catch { /* ignore */ }
  }

  _subscribe(conditionIds) {
    if (this._ws?.readyState !== WebSocket.OPEN) return;
    this._ws.send(JSON.stringify({ auth: this._auth, markets: conditionIds, type: "user" }));
  }

  _handle(msg) {
    if (msg?.event_type === "order" && msg.id) {
      const sizeFilled   = Number(msg.size_matched ?? 0);
      const originalSize = Number(msg.original_size ?? 0);
      const status = msg.type === "CANCELLATION" ? "cancelled"
        : (originalSize > 0 && sizeFilled >= originalSize) ? "matched"
        : "live";
      this._orders.set(msg.id, { status, sizeFilled, updatedAt: Date.now() });
    } else if (msg?.event_type === "trade" && msg.taker_order_id) {
      const existing = this._orders.get(msg.taker_order_id);
      const size = Number(msg.size ?? 0);
      if (existing) {
        existing.sizeFilled = Math.max(existing.sizeFilled, size);
        existing.updatedAt = Date.now();
      }
    }
  }
}

let _feed = null;
export function getUserOrderFeed() {
  if (_feed) return _feed;
  const apiKey     = process.env.POLY_API_KEY;
  const secret     = process.env.POLY_API_SECRET;
  const passphrase = process.env.POLY_PASSPHRASE;
  if (!apiKey || !secret || !passphrase) return null; // no creds — REST-only fallback
  _feed = new ClobUserWsFeed({ apiKey, secret, passphrase });
  _feed.connect();
  return _feed;
}
