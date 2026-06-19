// Contrarian Sniper — buys severely mispriced tokens after extreme moves
// Based on 0xa689's proven playbook: buy 3-12¢ tokens, hold to resolution
// Edge: market underprices mean-reversion probability after violent BTC moves

const DEFAULTS = {
  maxTokenPrice:   0.12,    // only buy when token is 12 cents or less
  minPriceMovePct: 0.0025,  // asset must have moved 0.25% from market open
  minTimeMs:       30_000,  // at least 30s remaining at entry
  maxTimeMs:       180_000, // enter only in final 3 minutes
  betSizeUsdc:     25,      // flat $25 per snipe — small, repeatable
};

export class ContrarianSniper {
  constructor(opts = {}) {
    this.cfg = { ...DEFAULTS, ...opts };
    this._openPrices = new Map(); // marketId → { price }
    this._fired      = new Set(); // marketIds already entered this window
  }

  recordOpen(marketId, currentPrice) {
    if (!this._openPrices.has(marketId) && currentPrice != null) {
      this._openPrices.set(marketId, { price: currentPrice });
    }
  }

  getOpenPrice(marketId) {
    return this._openPrices.get(marketId)?.price ?? null;
  }

  // Returns { side, tokenId, tokenPrice, delta } or { side: null }
  // Contrarian logic:
  //   BTC fell  → UP token is cheap  → buy UP  (bet on bounce back above open)
  //   BTC rose  → DOWN token is cheap → buy DOWN (bet on reversal below open)
  getSignal(market, upTokenPrice, downTokenPrice, currentPrice) {
    const { maxTokenPrice, minPriceMovePct, minTimeMs, maxTimeMs } = this.cfg;

    if (this._fired.has(market.id)) return { side: null };

    const remaining = market.endMs - Date.now();
    if (remaining < minTimeMs || remaining > maxTimeMs) return { side: null };

    const open = this._openPrices.get(market.id);
    if (!open || currentPrice == null) return { side: null };

    const delta = (currentPrice - open.price) / open.price;

    if (delta <= -minPriceMovePct && upTokenPrice != null && upTokenPrice <= maxTokenPrice) {
      return { side: "UP", tokenId: market.upTokenId, tokenPrice: upTokenPrice, delta };
    }

    if (delta >= minPriceMovePct && downTokenPrice != null && downTokenPrice <= maxTokenPrice) {
      return { side: "DOWN", tokenId: market.downTokenId, tokenPrice: downTokenPrice, delta };
    }

    return { side: null };
  }

  markFired(marketId)   { this._fired.add(marketId); }
  clearMarket(marketId) { this._openPrices.delete(marketId); this._fired.delete(marketId); }
}
