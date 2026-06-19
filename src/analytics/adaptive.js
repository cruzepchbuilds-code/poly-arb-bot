const MIN_TRADES = 5;
const WINDOW = 20;

// Tracks rolling win rate per (asset, strategy) combo.
// Returns a multiplier 0.5x–1.5x to scale Kelly bet sizes.
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

  getMultiplier(asset, strategy, baseWinRate = 0.62) {
    const key = `${asset}:${strategy}`;
    const arr = this._history.get(key);
    if (!arr || arr.length < MIN_TRADES) return 1.0;
    const wins = arr.filter(Boolean).length;
    const observedWr = wins / arr.length;
    const ratio = observedWr / baseWinRate;
    return Math.max(0.5, Math.min(1.5, ratio));
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
