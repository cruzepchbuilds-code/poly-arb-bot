// Fade Momentum — buys the cheap side at 20-45¢ after a moderate BTC move.
// Similar to contrarian sniper but targets mid-range tokens, not extreme moves.
// Based on observed trader behavior: buy DOWN at 30-35¢ when BTC has been rising.

const DEFAULTS = {
  minTokenPrice:   0.20,   // token must be at least 20¢ (avoids overlap with sniper)
  maxTokenPrice:   0.45,   // token at most 45¢
  minPriceMovePct: 0.002,  // asset must have moved 0.2% from window open
  minTimeMs:       60_000, // at least 60s remaining
  maxTimeMs:       300_000,// enter only in final 5 minutes
  betUsdc:         5,      // flat $5 per trade while testing
  maxBetPct:       0.05,   // never more than 5% of bankroll
};

export class FadeMomentum {
  constructor(opts = {}) {
    this.cfg         = { ...DEFAULTS, ...opts };
    this._openPrices = new Map(); // marketId → { price }
    this._fired      = new Set(); // marketIds already entered this window
    this._wins       = 0;
    this._losses     = 0;
  }

  get tradeCount() { return this._wins + this._losses; }
  get winRate()    { return this.tradeCount > 0 ? this._wins / this.tradeCount : null; }

  recordOpen(marketId, currentPrice) {
    if (!this._openPrices.has(marketId) && currentPrice != null) {
      this._openPrices.set(marketId, { price: currentPrice });
    }
  }

  recordResult(won) {
    if (won === true)  this._wins++;
    else if (won === false) this._losses++;
  }

  // Returns { side, tokenId, tokenPrice, delta } or { side: null }
  // BTC rose  → Down token cheap-ish → buy Down (bet on fade)
  // BTC fell  → Up token cheap-ish   → buy Up   (bet on fade)
  getSignal(market, upTokenPrice, downTokenPrice, currentPrice) {
    const { minTokenPrice, maxTokenPrice, minPriceMovePct, minTimeMs, maxTimeMs } = this.cfg;

    if (this._fired.has(market.id)) return { side: null };

    const remaining = market.endMs - Date.now();
    if (remaining < minTimeMs || remaining > maxTimeMs) return { side: null };

    const open = this._openPrices.get(market.id);
    if (!open || currentPrice == null) return { side: null };

    const delta = (currentPrice - open.price) / open.price;

    if (delta >= minPriceMovePct && downTokenPrice != null &&
        downTokenPrice >= minTokenPrice && downTokenPrice <= maxTokenPrice) {
      return { side: "DOWN", tokenId: market.downTokenId, tokenPrice: downTokenPrice, delta };
    }

    if (delta <= -minPriceMovePct && upTokenPrice != null &&
        upTokenPrice >= minTokenPrice && upTokenPrice <= maxTokenPrice) {
      return { side: "UP", tokenId: market.upTokenId, tokenPrice: upTokenPrice, delta };
    }

    return { side: null };
  }

  calcBetSize(bankroll) {
    return Math.min(this.cfg.betUsdc, bankroll * this.cfg.maxBetPct);
  }

  markFired(marketId)   { this._fired.add(marketId); }
  clearMarket(marketId) { this._openPrices.delete(marketId); this._fired.delete(marketId); }
}
