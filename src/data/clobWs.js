import WebSocket from "ws";

const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

export class ClobWsFeed {
  constructor() {
    this._threshold   = 0.95;
    this._prices      = new Map(); // tokenId → { bid, ask, mid, updatedAt }
    this._markets     = new Map(); // marketId → market object
    this._tokenToMkt  = new Map(); // tokenId → marketId
    this._askHistory  = new Map(); // tokenId → [{ price, ts }]
    this._onOpportunity = null;
    this._onSweep       = null;
    this._ws            = null;
    this._closed        = false;
    this._reconnDelay   = 1_000;
    this._pending       = new Set(); // tokenIds awaiting subscribe
    this.connected      = false;
    this.lastUpdate     = null;
  }

  get marketCount() { return this._markets.size; }

  setThreshold(t)    { this._threshold = t; }
  onOpportunity(fn)  { this._onOpportunity = fn; }
  onSweep(fn)        { this._onSweep = fn; }

  addMarkets(markets) {
    const fresh = [];
    for (const m of markets) {
      if (this._markets.has(m.id)) continue;
      this._markets.set(m.id, m);
      this._tokenToMkt.set(m.upTokenId,   m.id);
      this._tokenToMkt.set(m.downTokenId, m.id);
      fresh.push(m.upTokenId, m.downTokenId);
    }
    if (!fresh.length) return;
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._subscribe(fresh);
    } else {
      for (const id of fresh) this._pending.add(id);
    }
  }

  removeMarket(marketId) {
    const m = this._markets.get(marketId);
    if (!m) return;
    this._markets.delete(marketId);
    this._tokenToMkt.delete(m.upTokenId);
    this._tokenToMkt.delete(m.downTokenId);
    this._prices.delete(m.upTokenId);
    this._prices.delete(m.downTokenId);
    this._askHistory.delete(m.upTokenId);
    this._askHistory.delete(m.downTokenId);
  }

  getPrices(upTokenId, downTokenId) {
    return {
      yesPrice: this._prices.get(upTokenId)?.mid   ?? null,
      noPrice:  this._prices.get(downTokenId)?.mid ?? null,
    };
  }

  getMid(tokenId)   { return this._prices.get(tokenId)?.mid ?? null; }
  getAsk(tokenId)   { return this._prices.get(tokenId)?.ask ?? null; }
  getBid(tokenId)   { return this._prices.get(tokenId)?.bid ?? null; }
  getAgeMs(tokenId) {
    const p = this._prices.get(tokenId);
    return p ? Date.now() - p.updatedAt : null;
  }

  connect() {
    if (this._closed) return;
    this._ws = new WebSocket(WS_URL);

    this._ws.on("open", () => {
      this.connected    = true;
      this._reconnDelay = 1_000;
      const ids = [...new Set([
        ...this._pending,
        ...[...this._markets.values()].flatMap(m => [m.upTokenId, m.downTokenId]),
      ])];
      this._pending.clear();
      if (ids.length) this._subscribe(ids);
    });

    this._ws.on("message", (buf) => {
      try {
        const msgs = JSON.parse(buf.toString());
        for (const msg of (Array.isArray(msgs) ? msgs : [msgs])) {
          this._handle(msg);
        }
      } catch { /* ignore */ }
    });

    const retry = () => {
      this.connected = false;
      if (this._closed) return;
      try { this._ws?.terminate(); } catch { /* ignore */ }
      const d = this._reconnDelay;
      this._reconnDelay = Math.min(30_000, Math.floor(this._reconnDelay * 1.5));
      setTimeout(() => this.connect(), d);
    };
    this._ws.on("close", retry);
    this._ws.on("error", retry);
  }

  close() {
    this._closed = true;
    try { this._ws?.close(); } catch { /* ignore */ }
  }

  _subscribe(tokenIds) {
    if (this._ws?.readyState !== WebSocket.OPEN) return;
    this._ws.send(JSON.stringify({ assets_ids: tokenIds, type: "market" }));
  }

  _handle(msg) {
    if (!msg?.event_type || !msg?.asset_id) return;
    this.lastUpdate = Date.now();

    const tokenId = msg.asset_id;
    const existing = this._prices.get(tokenId);
    let bid = existing?.bid ?? null;
    let ask = existing?.ask ?? null;

    if (msg.event_type === "book") {
      // Full order book snapshot — Polymarket sends bids/asks (not buy/sell)
      const bids = Array.isArray(msg.bids) ? msg.bids : [];
      const asks = Array.isArray(msg.asks) ? msg.asks : [];
      const newBid = bids.length ? Math.max(...bids.map(o => Number(o.price)).filter(Number.isFinite)) : null;
      const newAsk = asks.length ? Math.min(...asks.map(o => Number(o.price)).filter(Number.isFinite)) : null;
      if (newBid != null) bid = newBid;
      if (newAsk != null) ask = newAsk;
    } else if (msg.event_type === "price_change") {
      // Incremental changes: [{price, size, side: "BUY"|"SELL"}]
      const changes = Array.isArray(msg.changes) ? msg.changes : [];
      const buys  = changes.filter(c => c.side === "BUY"  && Number(c.size) > 0);
      const sells = changes.filter(c => c.side === "SELL" && Number(c.size) > 0);
      if (buys.length)  bid = Math.max(...buys.map(o  => Number(o.price)).filter(Number.isFinite));
      if (sells.length) ask = Math.min(...sells.map(o => Number(o.price)).filter(Number.isFinite));
    } else if (msg.event_type === "last_trade_price") {
      const p = Number(msg.price);
      if (Number.isFinite(p) && p > 0 && bid == null && ask == null) bid = p;
    } else {
      return;
    }

    const mid = (bid != null && ask != null) ? (bid + ask) / 2 : (bid ?? ask ?? null);
    if (mid == null) return;

    this._prices.set(tokenId, { bid, ask, mid, updatedAt: Date.now() });

    // Sweep detection: ask rose ≥ $0.012 within the last 5s
    if (ask != null && this._onSweep) {
      const now  = Date.now();
      const hist = this._askHistory.get(tokenId) ?? [];
      hist.push({ price: ask, ts: now });
      while (hist.length > 1 && now - hist[0].ts > 5_000) hist.shift();
      this._askHistory.set(tokenId, hist);

      if (hist.length >= 2) {
        const rise = ask - hist[0].price;
        if (rise >= 0.012) {
          const marketId = this._tokenToMkt.get(tokenId);
          const m        = marketId ? this._markets.get(marketId) : null;
          if (m) {
            const side = tokenId === m.upTokenId ? "UP" : "DOWN";
            this._onSweep({ tokenId, marketId, side, price: ask, rise });
          }
        }
      }
    }

    // Arb opportunity check
    if (this._onOpportunity) {
      const marketId = this._tokenToMkt.get(tokenId);
      const m        = marketId ? this._markets.get(marketId) : null;
      if (!m) return;
      const up = this._prices.get(m.upTokenId);
      const dn = this._prices.get(m.downTokenId);
      if (up?.mid == null || dn?.mid == null) return;
      if (up.mid + dn.mid < this._threshold) {
        this._onOpportunity(marketId, up.mid, dn.mid);
      }
    }
  }
}
