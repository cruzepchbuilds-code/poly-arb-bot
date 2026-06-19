import { placeLimitBuy, getOrderStatus, cancelOrder } from "./orders.js";

// Single-side directional bet for the Late Entry Momentum (LEM) strategy.
// Buy the side indicated by Binance window delta in the final 15-90s.
// Resolves in sim by comparing current vs open Binance price at expiry.
export class DirectionalPosition {
  constructor({ id, asset, side, tokenId, binanceOpenPrice, windowEndMs }) {
    this.id = id;
    this.asset = asset;
    this.side = side;               // "UP" | "DOWN"
    this.tokenId = tokenId;
    this.binanceOpenPrice = binanceOpenPrice;
    this.windowEndMs = windowEndMs;
    this.type = "directional";

    this.entryPrice = null;
    this.shares     = null;
    this.totalSpent = null;
    this.order      = null;
    this.filled     = false;
    this.resolved   = false;
    this.won        = null;         // true | false | null (pending/unknown)
    this.payout     = 0;
    this.enteredAt  = null;
    this.log        = [];
  }

  get expired()     { return Date.now() >= this.windowEndMs; }
  get remainingMs() { return Math.max(0, this.windowEndMs - Date.now()); }

  async enter(price, maxUsdc) {
    this.entryPrice = price;
    this.shares     = Math.floor(maxUsdc / price);
    if (this.shares < 1) { this._log("Shares too small"); return false; }
    this.totalSpent = this.shares * price;
    this.enteredAt  = Date.now();
    this._log(
      `LEM ${this.side} @${price.toFixed(3)} × ${this.shares}sh = $${this.totalSpent.toFixed(2)}`
    );
    try {
      this.order = await placeLimitBuy(this.tokenId, price, this.shares);
      this._log(`Order [${this.order.orderId}]`);
    } catch (e) {
      this._log(`Order failed: ${e.message}`);
    }
    return true;
  }

  async tick() {
    if (!this.order || this.filled) return;
    try {
      const s = await getOrderStatus(this.order.orderId);
      if (s?.status === "matched") { this.filled = true; this._log("FILLED"); }
    } catch { /* ignore */ }
  }

  // Called at window expiry — compare current vs open Binance price to determine win/loss.
  resolveInSim(currentBinancePrice) {
    if (this.resolved) return;
    this.resolved = true;

    if (!this.filled) {
      this.won    = null;
      this.payout = this.totalSpent ?? 0; // full refund for unfilled
      this._log("Expired unfilled → refunded");
      return;
    }

    if (currentBinancePrice == null || this.binanceOpenPrice == null) {
      this.won    = null;
      this.payout = this.totalSpent ?? 0;
      this._log("Price unavailable → refunded");
      return;
    }

    const wentUp  = currentBinancePrice > this.binanceOpenPrice;
    this.won      = this.side === "UP" ? wentUp : !wentUp;
    this.payout   = this.won ? this.shares * 1.0 : 0;
    const delta   = ((currentBinancePrice - this.binanceOpenPrice) / this.binanceOpenPrice * 100).toFixed(2);
    this._log(
      `${this.won ? "WIN" : "LOSS"}  BTC ${wentUp ? "↑" : "↓"} ${delta}%  payout=$${this.payout.toFixed(2)}`
    );
  }

  // Sim-only: lock in profit early when deeply in-the-money.
  // Called by monitor when token price >= earlyExitMinPrice with little time left.
  resolveEarly(tokenPrice) {
    if (this.resolved) return;
    this.resolved = true;
    if (!this.filled) { this.payout = this.totalSpent ?? 0; return; }
    this.won    = true;
    this.payout = (this.shares ?? 0) * tokenPrice;
    this._log(`EARLY EXIT @${tokenPrice.toFixed(3)}  locked=$${this.payout.toFixed(2)}`);
  }

  async cancelAll() {
    if (this.order && !this.filled) {
      try { await cancelOrder(this.order.orderId); this._log("Cancelled"); } catch { /* ignore */ }
    }
  }

  get summary() {
    return {
      id: this.id,
      asset: this.asset,
      type: "directional",
      side: this.side,
      entryPrice: this.entryPrice,
      shares: this.shares,
      totalSpent: this.totalSpent,
      filled: this.filled,
      won: this.won,
      payout: this.payout,
      resolved: this.resolved,
      expired: this.expired,
      remainingMs: this.remainingMs,
      enteredAt: this.enteredAt,
      enteredSecsLeft: this.enteredSecsLeft ?? null,
      momentumPct: this.momentumPct ?? null,
      strategy: this.sniper ? "SNIPER" : this.fade ? "FADE" : "LEM",
      log: [...this.log],
    };
  }

  _log(msg) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    this.log.push(`[${ts}] ${msg}`);
    if (this.log.length > 20) this.log.shift();
  }
}
