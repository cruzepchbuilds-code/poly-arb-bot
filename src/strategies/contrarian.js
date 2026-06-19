// Contrarian Sniper — buys severely mispriced tokens after extreme moves
// Based on 0xa689's proven playbook: buy 3-12¢ tokens, hold to resolution
// Edge: market underprices mean-reversion probability after violent BTC moves

const DEFAULTS = {
  maxTokenPrice:    0.15,   // buy when token is 15 cents or less
  minPriceMovePct:  0.0020, // asset must have moved 0.20% from market open
  minTimeMs:        30_000, // at least 30s remaining at entry
  maxTimeMs:        180_000,// enter only in final 3 minutes
  kellyFraction:    0.25,   // 25% fractional Kelly — conservative until edge confirmed
  minBetUsdc:       5,      // never bet less than $5
  maxBetPct:        0.04,   // never more than 4% of bankroll per snipe
  maxBetUsdc:       500,    // hard cap — Polymarket liquidity limit
  baseWinRate:      0.15,   // raised from 9.5% — allows edge on tokens up to 14.9¢
  minTradesForLive: 20,     // switch to observed win rate after this many trades
};

export class ContrarianSniper {
  constructor(opts = {}) {
    this.cfg    = { ...DEFAULTS, ...opts };
    this._wins  = opts.initialWins   ?? 0;
    this._losses= opts.initialLosses ?? 0;
    this._openPrices = new Map(); // marketId → { price }
    this._fired      = new Set(); // marketIds already entered this window
  }

  // Dynamic Kelly bet size — scales automatically with bankroll
  // Bigger bankroll = bigger bet. Better edge (cheaper token) = bigger fraction.
  calcBetSize(tokenPrice, bankroll) {
    const winRate = this.winRate;
    const edge    = winRate - tokenPrice;
    if (edge <= 0) return 0; // token price ≥ win rate → no edge, skip

    const kelly  = edge / (1 - tokenPrice);          // full Kelly fraction
    const scaled = bankroll * kelly * this.cfg.kellyFraction;

    return Math.max(
      this.cfg.minBetUsdc,
      Math.min(scaled, bankroll * this.cfg.maxBetPct, this.cfg.maxBetUsdc)
    );
  }

  // Win rate: use observed once we have enough data, else 0xa689 baseline
  get winRate() {
    const total = this._wins + this._losses;
    return total >= this.cfg.minTradesForLive
      ? this._wins / total
      : this.cfg.baseWinRate;
  }

  get tradeCount() { return this._wins + this._losses; }

  // Call after each resolved sniper position so win rate self-updates
  recordResult(won) {
    if (won === true)  this._wins++;
    else if (won === false) this._losses++;
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

    // Skip if token price has no edge vs current win rate
    if (delta <= -minPriceMovePct && upTokenPrice != null && upTokenPrice <= maxTokenPrice) {
      if (upTokenPrice >= this.winRate) return { side: null }; // no edge
      return { side: "UP", tokenId: market.upTokenId, tokenPrice: upTokenPrice, delta };
    }

    if (delta >= minPriceMovePct && downTokenPrice != null && downTokenPrice <= maxTokenPrice) {
      if (downTokenPrice >= this.winRate) return { side: null }; // no edge
      return { side: "DOWN", tokenId: market.downTokenId, tokenPrice: downTokenPrice, delta };
    }

    return { side: null };
  }

  markFired(marketId)   { this._fired.add(marketId); }
  clearMarket(marketId) { this._openPrices.delete(marketId); this._fired.delete(marketId); }
}
