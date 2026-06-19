// Fade Momentum — buys the clearly discounted side (20-45¢) with time remaining.
// Similar to contrarian sniper but targets mid-range tokens, not extreme moves.
// Based on observed trader behavior: buy DOWN at 30-35¢ when BTC has been rising.
// Signal: the token being cheap already encodes the directional move — no separate
// asset-price confirmation needed (that was blocking signals in calm markets).

const DEFAULTS = {
  minTokenPrice:   0.20,   // token must be at least 20¢ (avoids overlap with sniper)
  maxTokenPrice:   0.45,   // token at most 45¢ — clearly discounted from 50/50
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
  // Buys whichever side is clearly discounted (20-45¢) — the cheap token
  // already encodes the directional move; no separate asset confirmation needed.
  getSignal(market, upTokenPrice, downTokenPrice) {
    const { minTokenPrice, maxTokenPrice, minTimeMs, maxTimeMs } = this.cfg;

    if (this._fired.has(market.id)) return { side: null };

    const remaining = market.endMs - Date.now();
    if (remaining < minTimeMs || remaining > maxTimeMs) return { side: null };

    // Skip if combined is so low it's already an ARB situation
    if (upTokenPrice != null && downTokenPrice != null &&
        upTokenPrice + downTokenPrice < 0.80) return { side: null };

    if (downTokenPrice != null &&
        downTokenPrice >= minTokenPrice && downTokenPrice <= maxTokenPrice) {
      return { side: "DOWN", tokenId: market.downTokenId, tokenPrice: downTokenPrice, delta: 0 };
    }

    if (upTokenPrice != null &&
        upTokenPrice >= minTokenPrice && upTokenPrice <= maxTokenPrice) {
      return { side: "UP", tokenId: market.upTokenId, tokenPrice: upTokenPrice, delta: 0 };
    }

    return { side: null };
  }

  calcBetSize(bankroll) {
    return Math.min(this.cfg.betUsdc, bankroll * this.cfg.maxBetPct);
  }

  markFired(marketId)   { this._fired.add(marketId); }
  clearMarket(marketId) { this._openPrices.delete(marketId); this._fired.delete(marketId); }
}
