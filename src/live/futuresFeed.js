/**
 * Binance perpetual futures data feed.
 *
 * Exports:
 *   startFuturesFeed()          — begin polling OI + funding data
 *   stopFuturesFeed()           — stop all timers
 *   getOIDelta(asset, windowMs) — OI change ratio over the last windowMs (positive = growing, negative = shrinking)
 *   getFundingData(asset)       — { rate, markPrice, indexPrice, basis } or null
 *
 * Usage in LatencyBond:
 *   const oi = getOIDelta(asset, 120_000);
 *   if (oi !== null && oi < -0.003) skip; // OI shrinking → squeeze/unwind, weaker signal
 *   if (oi !== null && oi > 0.005) multiplier *= 1.2; // OI growing → genuine breakout
 *
 * Usage in FundingSnipe:
 *   const f = getFundingData(asset);
 *   if (f.rate > 0.0004) → DOWN squeeze imminent (longs overextended)
 *   if (f.rate < -0.0002) → UP squeeze imminent (shorts overextended)
 */

const BASE = "https://fapi.binance.com";

const SYMBOLS = {
  BTC:  "BTCUSDT",
  ETH:  "ETHUSDT",
  SOL:  "SOLUSDT",
  XRP:  "XRPUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  LINK: "LINKUSDT",
  MATIC: "MATICUSDT",
};

// Rolling OI history — asset → [{ oi: number, ts: number }, ...]
const _oi = Object.fromEntries(Object.keys(SYMBOLS).map(a => [a, []]));

// Latest funding data — asset → { rate, markPrice, indexPrice, basis, ts }
const _funding = Object.fromEntries(Object.keys(SYMBOLS).map(a => [a, null]));

let _oiTimer      = null;
let _fundingTimer = null;
let _stopped      = false;

// ── OI polling (every 10s, all assets in parallel) ───────────────────────────
async function pollOI() {
  if (_stopped) return;
  try {
    const results = await Promise.allSettled(
      Object.entries(SYMBOLS).map(async ([asset, symbol]) => {
        const res = await fetch(`${BASE}/fapi/v1/openInterest?symbol=${symbol}`,
          { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return;
        const json = await res.json();
        const oi = Number(json.openInterest);
        if (!Number.isFinite(oi) || oi <= 0) return;
        const buf = _oi[asset];
        buf.push({ oi, ts: Date.now() });
        // Keep 30 minutes of history (10s × 180 = 30 min)
        if (buf.length > 180) buf.shift();
      })
    );
    void results; // errors are silenced — network blips are acceptable
  } catch { /* ignore */ }
  if (!_stopped) _oiTimer = setTimeout(pollOI, 10_000);
}

// ── Funding rate polling (every 30s, all assets in parallel) ─────────────────
async function pollFunding() {
  if (_stopped) return;
  try {
    const results = await Promise.allSettled(
      Object.entries(SYMBOLS).map(async ([asset, symbol]) => {
        const res = await fetch(`${BASE}/fapi/v1/premiumIndex?symbol=${symbol}`,
          { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return;
        const json = await res.json();
        const rate       = Number(json.lastFundingRate);
        const markPrice  = Number(json.markPrice);
        const indexPrice = Number(json.indexPrice);
        if (!Number.isFinite(rate) || !Number.isFinite(markPrice)) return;
        const basis = indexPrice > 0 ? (markPrice - indexPrice) / indexPrice : 0;
        _funding[asset] = { rate, markPrice, indexPrice, basis, ts: Date.now() };
      })
    );
    void results;
  } catch { /* ignore */ }
  if (!_stopped) _fundingTimer = setTimeout(pollFunding, 30_000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startFuturesFeed() {
  _stopped = false;
  pollOI();
  pollFunding();
}

export function stopFuturesFeed() {
  _stopped = true;
  clearTimeout(_oiTimer);
  clearTimeout(_fundingTimer);
}

/**
 * Returns the proportional change in open interest over the last `windowMs`.
 * Positive → OI increasing (real breakout). Negative → OI decreasing (squeeze/unwind).
 * Returns null if insufficient data.
 */
export function getOIDelta(asset, windowMs = 120_000) {
  const buf = _oi[asset];
  if (!buf || buf.length < 2) return null;
  const now  = Date.now();
  const cutoff = now - windowMs;
  // Find the oldest sample within the window
  const old = buf.find(s => s.ts >= cutoff) ?? buf[0];
  const cur  = buf[buf.length - 1];
  if (old === cur || cur.ts - old.ts < 5_000) return null;
  return (cur.oi - old.oi) / old.oi; // e.g. +0.005 = +0.5% OI growth
}

/**
 * Returns the latest funding data for the given asset, or null if unavailable / stale.
 * Data is considered stale after 5 minutes.
 */
export function getFundingData(asset) {
  const d = _funding[asset];
  if (!d) return null;
  if (Date.now() - d.ts > 5 * 60_000) return null; // stale
  return d;
}
