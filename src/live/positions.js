import { cancelOrder, getOrderStatus, placeLimitBuy } from "./orders.js";
import { getClient } from "./client.js";
import { Side } from "@polymarket/clob-client";

const DANGER_PRICE = Number(process.env.DANGER_PRICE) || 0.15;
const SELL_OPPOSITE_ABOVE = Number(process.env.SELL_OPPOSITE_ABOVE) || 0.84;
const LIVE = process.env.LIVE_MODE === "true";

export class WindowPosition {
  constructor({ id, asset, upTokenId, downTokenId, windowEndMs }) {
    this.id = id;
    this.type = "window";
    this.marketId = null;   // set externally when multiple ARB entries share a market
    this.asset = asset;
    this.upTokenId = upTokenId;
    this.downTokenId = downTokenId;
    this.windowEndMs = windowEndMs;

    this.upPrice = null;
    this.downPrice = null;
    this.shares = null;          // equal shares on both sides
    this.totalSpent = null;

    this.upOrder = null;
    this.downOrder = null;

    this.upFilled = false;
    this.downFilled = false;
    this.upSizeFilled = 0;
    this.downSizeFilled = 0;
    this.exitedUp = false;
    this.exitedDown = false;

    this.enteredAt = null;
    this.log = [];
  }

  get expired() { return Date.now() >= this.windowEndMs; }
  get remainingMs() { return Math.max(0, this.windowEndMs - Date.now()); }

  get combined() {
    if (this.upPrice == null || this.downPrice == null) return null;
    return this.upPrice + this.downPrice;
  }

  // Guaranteed profit if both sides fill
  get guaranteedProfit() {
    if (this.combined == null || this.shares == null) return null;
    return this.shares * (1 - this.combined);
  }

  // Enter both sides with equal share count.
  // upPrice / downPrice = mid prices from CLOB
  // maxUsdc = total budget for both sides
  async enter(upPrice, downPrice, maxUsdc) {
    this.upPrice = upPrice;
    this.downPrice = downPrice;

    // Equal shares — spend proportional dollars on each side
    // shares × (upPrice + downPrice) = maxUsdc
    this.shares = Math.floor(maxUsdc / (upPrice + downPrice));
    // Polymarket rejects orders below 5 shares or $1 notional per leg — check both
    // before attempting, or every entry on a small account guarantees two failed
    // orders that still get treated as a placed position downstream.
    const minShares = Math.max(5, Math.ceil(1 / Math.min(upPrice, downPrice)));
    if (this.shares < minShares) {
      this._log(`Shares too small (${this.shares} < ${minShares} min), skipping`);
      return false;
    }

    this.totalSpent = this.shares * (upPrice + downPrice);
    this.enteredAt = Date.now();

    this._log(
      `Enter: ${this.asset} UP@${upPrice.toFixed(3)} + DOWN@${downPrice.toFixed(3)} ` +
      `= ${(upPrice + downPrice).toFixed(3)} combined × ${this.shares} shares ` +
      `= $${this.totalSpent.toFixed(2)} → guaranteed +$${this.guaranteedProfit.toFixed(2)}`
    );

    // Place both sides in parallel — halves order placement latency
    const [upResult, dnResult] = await Promise.allSettled([
      placeLimitBuy(this.upTokenId, upPrice, this.shares),
      placeLimitBuy(this.downTokenId, downPrice, this.shares),
    ]);
    if (upResult.status === "fulfilled") {
      this.upOrder = upResult.value;
      this._log(`UP order [${this.upOrder.orderId}]`);
    } else { this._log(`UP order failed: ${upResult.reason?.message}`); }
    if (dnResult.status === "fulfilled") {
      this.downOrder = dnResult.value;
      this._log(`DOWN order [${this.downOrder.orderId}]`);
    } else { this._log(`DOWN order failed: ${dnResult.reason?.message}`); }

    return !!(this.upOrder || this.downOrder);
  }

  // Poll fill status and run danger management
  async tick(yesPrice, noPrice) {
    if (!this.upOrder && !this.downOrder) return;

    // Check fills — track sizeFilled directly, not just the "matched" status string,
    // which misses orders that filled (fully or partially) without that exact status
    // ever being observed (see directional.js for the confirmed real-money incident).
    if (this.upOrder && !this.upFilled && !this.exitedUp) {
      const s = await getOrderStatus(this.upOrder.orderId);
      if (s) {
        this.upSizeFilled = Math.max(this.upSizeFilled, s.sizeFilled ?? 0);
        if (s.status === "matched" || (this.shares && this.upSizeFilled >= this.shares)) {
          this.upFilled = true; this._log("UP FILLED");
        }
      }
    }

    if (this.downOrder && !this.downFilled && !this.exitedDown) {
      const s = await getOrderStatus(this.downOrder.orderId);
      if (s) {
        this.downSizeFilled = Math.max(this.downSizeFilled, s.sizeFilled ?? 0);
        if (s.status === "matched" || (this.shares && this.downSizeFilled >= this.shares)) {
          this.downFilled = true; this._log("DOWN FILLED");
        }
      }
    }

    const remainingMins = this.remainingMs / 60_000;

    // One side filled, other not — danger management
    if (this.upFilled && !this.downFilled && !this.exitedUp) {
      if (noPrice !== null && noPrice <= DANGER_PRICE) {
        await this._marketSell(this.upTokenId, this.shares);
        await cancelOrder(this.downOrder?.orderId);
        this.exitedUp = true;
        this.exitedDown = true;
        this._log(`Danger: DOWN at ${noPrice.toFixed(3)}, sold UP for profit`);
      }
    }

    if (this.downFilled && !this.upFilled && !this.exitedDown) {
      if (yesPrice !== null && yesPrice <= DANGER_PRICE) {
        await this._marketSell(this.downTokenId, this.shares);
        await cancelOrder(this.upOrder?.orderId);
        this.exitedDown = true;
        this.exitedUp = true;
        this._log(`Danger: UP at ${yesPrice.toFixed(3)}, sold DOWN for profit`);
      }
    }

    // Both filled — sell the losing side if it's still overpriced near expiry
    if (this.upFilled && this.downFilled && remainingMins <= 2) {
      if (!this.exitedDown && noPrice !== null && noPrice >= SELL_OPPOSITE_ABOVE) {
        await this._marketSell(this.downTokenId, this.shares);
        this.exitedDown = true;
        this._log(`Sold DOWN@${noPrice.toFixed(3)} near expiry`);
      }
      if (!this.exitedUp && yesPrice !== null && yesPrice >= SELL_OPPOSITE_ABOVE) {
        await this._marketSell(this.upTokenId, this.shares);
        this.exitedUp = true;
        this._log(`Sold UP@${yesPrice.toFixed(3)} near expiry`);
      }
    }
  }

  async cancelAll() {
    if (this.upOrder && !this.upFilled) {
      await cancelOrder(this.upOrder.orderId);
      this._log("Cancelled unfilled UP");
    }
    if (this.downOrder && !this.downFilled) {
      await cancelOrder(this.downOrder.orderId);
      this._log("Cancelled unfilled DOWN");
    }
  }

  get summary() {
    return {
      id: this.id,
      asset: this.asset,
      upPrice: this.upPrice,
      downPrice: this.downPrice,
      combined: this.combined,
      shares: this.shares,
      totalSpent: this.totalSpent,
      guaranteedProfit: this.guaranteedProfit,
      upFilled: this.upFilled,
      downFilled: this.downFilled,
      upSizeFilled: this.upSizeFilled,
      downSizeFilled: this.downSizeFilled,
      exitedUp: this.exitedUp,
      exitedDown: this.exitedDown,
      expired: this.expired,
      remainingMs: this.remainingMs,
      log: [...this.log],
    };
  }

  _log(msg) {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    this.log.push(`[${ts}] ${msg}`);
    if (this.log.length > 20) this.log.shift();
  }

  async _marketSell(tokenId, size) {
    if (!LIVE) { this._log(`[SIM] market-sell ${size} of ${tokenId.slice(0, 8)}...`); return; }
    const client = getClient();
    try {
      await client.createAndPostMarketOrder({
        tokenID: tokenId, amount: size, side: Side.SELL, feeRateBps: 0,
      });
    } catch (e) { this._log(`Sell failed: ${e.message}`); }
  }
}
