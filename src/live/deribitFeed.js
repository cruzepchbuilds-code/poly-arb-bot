/**
 * Deribit options gamma pressure feed — BTC and ETH only.
 *
 * Near-expiry options (< 48h) near spot have maximum gamma. When price moves
 * toward a concentrated cluster of calls/puts, market-makers must delta-hedge
 * by buying or selling spot — amplifying the existing move.
 *
 * Call wall ABOVE spot + price rising  → MMs forced to buy spot → UP amplifier.
 * Put  wall BELOW spot + price falling → MMs forced to sell spot → DOWN amplifier.
 *
 * Polls Deribit public API (no key needed) every 60s.
 *
 * Exports:
 *   startDeribitFeed() / stopDeribitFeed()
 *   getDeribitGamma(asset) → { direction: "UP"|"DOWN", strength: 0–1, updatedAt } | null
 */

const DERIBIT = "https://www.deribit.com/api/v2/public";
const MON = { JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11 };

// Parse Deribit instrument expiry: "BTC-29NOV24-100000-C" → timestamp (08:00 UTC)
function _parseExpiry(instrName) {
  const p = instrName.split("-");
  if (p.length < 4) return 0;
  const ds = p[1];
  const d = +ds.slice(0, 2);
  const m = MON[ds.slice(2, 5)];
  const y = 2000 + (+ds.slice(5));
  if (isNaN(d) || m === undefined || isNaN(y)) return 0;
  return Date.UTC(y, m, d, 8, 0, 0);
}

const _gamma = {};      // asset → { direction, strength, updatedAt }
let _timer   = null;
let _stopped = false;

async function _fetchGamma(asset) {
  const res = await fetch(
    `${DERIBIT}/get_book_summary_by_currency?currency=${asset}&kind=option`,
    { signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) return;
  const { result } = await res.json();
  if (!Array.isArray(result) || !result.length) return;

  // Spot price from whichever record has it
  const spot = result.find(b => Number(b.underlying_price) > 0)?.underlying_price;
  if (!spot) return;

  const now  = Date.now();
  const band = spot * 0.05; // ±5% of spot = highest gamma zone

  let callOI = 0; // calls above spot (if price rises, MMs buy spot)
  let putOI  = 0; // puts below spot (if price falls, MMs sell spot)

  for (const b of result) {
    const expTs = _parseExpiry(b.instrument_name);
    if (expTs <= now || expTs - now > 48 * 3_600_000) continue; // skip expired or far-dated
    const parts  = b.instrument_name.split("-");
    const strike = Number(parts[2]);
    const isCall = parts[3] === "C";
    if (!Number.isFinite(strike) || Math.abs(strike - spot) > band) continue;
    if (isCall && strike > spot) callOI += (b.open_interest ?? 0);
    if (!isCall && strike < spot) putOI  += (b.open_interest ?? 0);
  }

  const total = callOI + putOI;
  if (total < 10) return; // insufficient near-expiry data

  const callRatio = callOI / total;
  if (Math.abs(callRatio - 0.5) < 0.05) return; // balanced — no directional bias

  const direction = callRatio > 0.5 ? "UP" : "DOWN";
  // Strength: 0 = perfectly balanced, 1 = fully one-sided; amplify to make signal usable
  const strength = Math.min(1, Math.abs(callRatio - 0.5) * 4);
  _gamma[asset] = { direction, strength, updatedAt: now };
}

async function _poll() {
  if (_stopped) return;
  await Promise.all([
    _fetchGamma("BTC").catch(() => {}),
    _fetchGamma("ETH").catch(() => {}),
  ]);
  if (!_stopped) _timer = setTimeout(_poll, 60_000);
}

export function startDeribitFeed() { _stopped = false; _poll(); }
export function stopDeribitFeed()  { _stopped = true; clearTimeout(_timer); }

/**
 * Returns options gamma bias for an asset, or null if no signal / stale data.
 * Stale threshold: 5 minutes (would have seen at least 4 refresh cycles by then).
 */
export function getDeribitGamma(asset) {
  const g = _gamma[asset];
  if (!g || Date.now() - g.updatedAt > 5 * 60_000) return null;
  return g;
}
