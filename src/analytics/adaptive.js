const MIN_TRADES = 5;
const WINDOW     = 12; // 20→12: respond to hot/cold streaks ~2× faster

// Per-strategy theoretical break-even win rates (fee-adjusted).
// Adaptive sizer normalizes observed WR against this baseline.
const BASE_WR = {
  LATENCYBOND:  0.65, // ask ≤0.70, payout 1.00 → breakeven at 70%
  ORACLESNIPE:  0.65,
  OPENSNIPE:    0.62, // slightly lower: ask ≤0.55, better prices
  FUNDINGSNIPE: 0.62,
  CLOBIMB:      0.62,
};

// Tracks rolling win rate per (asset, strategy) combo.
// Returns a multiplier 0.4x–1.8x to scale Kelly bet sizes.
export class AdaptiveSizer {
  constructor() {
    this._history = new Map(); // "ASSET:STRATEGY" → [true, false, ...]
  }

  record(asset, strategy, won) {
    const key = `${asset}:${strategy}`;
    if (!this._history.has(key)) this._history.set(key, []);
    const arr = this._history.get(key);
    arr.push(won);
    if (arr.length > WINDOW) arr.shift();
  }

  getMultiplier(asset, strategy, baseWinRate) {
    const key = `${asset}:${strategy}`;
    const arr = this._history.get(key);
    if (!arr || arr.length < MIN_TRADES) return 1.0;
    const wins = arr.filter(Boolean).length;
    const observedWr = wins / arr.length;
    const base  = baseWinRate ?? BASE_WR[strategy] ?? 0.62;
    const ratio = observedWr / base;
    return Math.max(0.4, Math.min(1.8, ratio)); // 0.5→0.4 floor, 1.5→1.8 ceiling
  }

  getStats() {
    const result = {};
    for (const [key, arr] of this._history) {
      if (arr.length === 0) continue;
      const wins = arr.filter(Boolean).length;
      const winRate = wins / arr.length;
      result[key] = {
        trades:     arr.length,
        winRate,
        multiplier: this.getMultiplier(...key.split(":")),
      };
    }
    return result;
  }
}
