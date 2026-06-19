/**
 * Late Entry Momentum (LEM) — multi-timeframe edition
 *
 * Signal factors (all from Binance real-time feed):
 *   1. Window delta    — price move since 5-min market opened    (5× weight)
 *   2. Short momentum  — last 30-60s price trend from snapshots  (2× weight)
 *   3. 15m trend       — where asset has been trending           (2× weight)
 *
 * Confidence modifiers applied on top:
 *   +15% when 15m trend agrees with window direction (riding the macro move)
 *   +10% when 1h  trend agrees with window direction (long-term alignment)
 *   −25% when 15m trend strongly opposes (window move is fighting bigger trend)
 *   +vol  bonus applied externally from Binance buy/sell pressure
 */

const MAX_HISTORY_SNAPS = 180; // 180 × 30s = 90 min of asset price history

export class LateEntrySignal {
  constructor() {
    this._opens = new Map(); // marketId → { price, ts }
    this._snaps = new Map(); // asset    → [{ price, ts }]  (rolling 90min)
  }

  // Record the Binance price when a market first appears. Call once per market.
  recordOpen(marketId, binancePrice) {
    if (!this._opens.has(marketId) && binancePrice) {
      this._opens.set(marketId, { price: binancePrice, ts: Date.now() });
    }
  }

  // Called every 30s from snapPrices() — feeds the multi-timeframe history.
  recordPriceSnap(asset, price) {
    if (!asset || !price) return;
    const arr = this._snaps.get(asset) ?? [];
    arr.push({ price, ts: Date.now() });
    if (arr.length > MAX_HISTORY_SNAPS) arr.shift();
    this._snaps.set(asset, arr);
  }

  clearMarket(marketId) { this._opens.delete(marketId); }
  getOpenPrice(marketId) { return this._opens.get(marketId)?.price ?? null; }

  // Price change % over the last windowMs milliseconds for an asset.
  _trendOver(asset, windowMs) {
    const arr = this._snaps.get(asset) ?? [];
    if (arr.length < 3) return 0;
    const cutoff = Date.now() - windowMs;
    const anchor = arr.find(s => s.ts >= cutoff);
    if (!anchor) return 0;
    return (arr[arr.length - 1].price - anchor.price) / anchor.price;
  }

  getTrend15m(asset) { return this._trendOver(asset, 15 * 60_000); }
  getTrend1h(asset)  { return this._trendOver(asset, 60 * 60_000); }

  /**
   * Returns { side, delta, confidence, trend15m, trend1h, score }
   * @param {string}   marketId      - market to evaluate
   * @param {number}   currentPrice  - live Binance price
   * @param {Array}    priceSnaps    - [{ price, ts }] recent snapshots (newest last)
   * @param {string}   asset         - "BTC"|"ETH"|"SOL"|"XRP" — for trend lookup
   * @param {number}   volPressure   - 0–1 buy ratio from Binance trade feed (0.5 = neutral)
   */
  getSignal(marketId, currentPrice, priceSnaps = [], asset = null, volPressure = 0.5) {
    const open = this._opens.get(marketId);
    if (!open?.price || !currentPrice) {
      return { side: null, delta: 0, confidence: 0, trend15m: 0, trend1h: 0 };
    }

    // Factor 1: window delta — most predictive single factor
    const windowDelta = (currentPrice - open.price) / open.price;

    // Factor 2: short momentum from 30s snapshot pairs
    let momentum = 0;
    if (priceSnaps.length >= 2) {
      const prev = priceSnaps[priceSnaps.length - 2].price;
      const curr = priceSnaps[priceSnaps.length - 1].price;
      momentum = (curr - prev) / prev;
    }

    // Factor 3: 15m and 1h trends
    const trend15m = asset ? this.getTrend15m(asset) : 0;
    const trend1h  = asset ? this.getTrend1h(asset)  : 0;

    // Composite score — window delta dominates, 15m trend adds macro context
    const score    = (windowDelta * 5 + momentum * 2 + trend15m * 2) / 9;
    const absScore = Math.abs(score);

    // Lowered threshold: 0.08% composite (was 0.10%) — catches more setups
    if (absScore < 0.0008) {
      return { side: null, delta: windowDelta, confidence: 0, trend15m, trend1h };
    }

    const side = score > 0 ? "UP" : "DOWN";

    // Base confidence from signal strength (0–80%)
    let confidence = Math.min(0.80, absScore / 0.004);

    // Trend alignment modifiers
    const agrees15m        = (score > 0 && trend15m > 0) || (score < 0 && trend15m < 0);
    const agrees1h         = (score > 0 && trend1h  > 0) || (score < 0 && trend1h  < 0);
    const strong15mOppose  = !agrees15m && Math.abs(trend15m) > 0.0015;

    if (agrees15m)       confidence = Math.min(1.0, confidence + 0.15);
    if (agrees1h)        confidence = Math.min(1.0, confidence + 0.10);
    if (strong15mOppose) confidence *= 0.75;

    // Volume pressure: buyers dominating → boost UP confidence, vice versa
    const volDeviation = volPressure - 0.5; // negative = sellers winning
    const volAligned   = (side === "UP" && volDeviation > 0) || (side === "DOWN" && volDeviation < 0);
    if (volAligned) confidence = Math.min(1.0, confidence + Math.abs(volDeviation) * 0.30);
    else            confidence *= (1 - Math.abs(volDeviation) * 0.20);

    return {
      side,
      delta:      windowDelta,
      confidence: Math.max(0, confidence),
      score,
      trend15m,
      trend1h,
    };
  }
}
