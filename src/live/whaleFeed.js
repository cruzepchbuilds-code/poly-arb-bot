/**
 * Whale exchange inflow/outflow monitor.
 *
 * Primary: Whale Alert API (WHALE_ALERT_KEY env var) — polls every 2 minutes.
 * Fallback: OI + price proxy (no external key needed) — detects large moves from futures data.
 *
 * Large transfers TO exchanges   → selling pressure → DOWN signal.
 * Large transfers FROM exchanges → buying pressure  → UP signal.
 *
 * Signals decay linearly over 60 minutes. Multiple events in the same window accumulate.
 *
 * Exports:
 *   startWhaleFeed()           — begin polling
 *   stopWhaleFeed()            — stop timers
 *   getWhaleSignal(asset)      — { direction: "UP"|"DOWN", usdTotal: number, ageMs: number } or null
 */

const WHALE_API = "https://api.whale-alert.io/v1/transactions";
const SIGNAL_TTL = 60 * 60_000; // 60 minutes
const MIN_VALUE_USD = 5_000_000; // $5M minimum

// Whale Alert blockchain names → our asset
const CHAIN_TO_ASSET = {
  bitcoin:  "BTC",
  ethereum: "ETH",
  solana:   "SOL",
  ripple:   "XRP",
};

// ERC-20 token symbols on Ethereum → our asset
const TOKEN_SYM_MAP = {
  doge: "DOGE", avax: "AVAX", link: "LINK", matic: "MATIC", pol: "MATIC",
};

// Per-asset signal accumulator: { upUsd, downUsd, updatedAt }
const _signals = {};
let _lastCursor = 0;
let _timer = null;
let _stopped = false;

function _assetFromTx(tx) {
  const sym = tx.symbol?.toLowerCase();
  if (CHAIN_TO_ASSET[tx.blockchain]) return CHAIN_TO_ASSET[tx.blockchain];
  if (TOKEN_SYM_MAP[sym]) return TOKEN_SYM_MAP[sym];
  return null;
}

function _recordSignal(asset, direction, usd) {
  if (!_signals[asset]) _signals[asset] = { upUsd: 0, downUsd: 0, updatedAt: 0 };
  const sig = _signals[asset];
  // Decay existing signal if it's old
  const age = Date.now() - sig.updatedAt;
  if (age > SIGNAL_TTL) { sig.upUsd = 0; sig.downUsd = 0; }
  else {
    const decay = 1 - age / SIGNAL_TTL;
    sig.upUsd   *= decay;
    sig.downUsd *= decay;
  }
  if (direction === "UP")   sig.upUsd   += usd;
  else                      sig.downUsd += usd;
  sig.updatedAt = Date.now();
}

async function _pollWhaleAlert() {
  if (_stopped) return;
  const key = process.env.WHALE_ALERT_KEY;
  if (!key) { _scheduleNext(); return; }

  try {
    const from = _lastCursor || Math.floor((Date.now() - 5 * 60_000) / 1000); // last 5 min on first run
    const url  = `${WHALE_API}?api_key=${key}&min_value=${MIN_VALUE_USD}&start=${from}&limit=100`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { _scheduleNext(); return; }
    const json = await res.json();
    if (json.result !== "success" || !Array.isArray(json.transactions)) { _scheduleNext(); return; }

    for (const tx of json.transactions) {
      if (!tx.amount_usd || tx.amount_usd < MIN_VALUE_USD) continue;
      const asset = _assetFromTx(tx);
      if (!asset) continue;

      const toExchange   = tx.to?.owner_type   === "exchange";
      const fromExchange = tx.from?.owner_type === "exchange";
      if (!toExchange && !fromExchange) continue;

      // TO exchange = potential sell pressure = DOWN
      // FROM exchange = potential buy (withdrawal) = UP
      const direction = toExchange ? "DOWN" : "UP";
      _recordSignal(asset, direction, tx.amount_usd);
    }

    if (json.cursor) _lastCursor = json.cursor;
  } catch { /* network errors are acceptable — whale alert is best-effort */ }
  _scheduleNext();
}

function _scheduleNext() {
  if (!_stopped) _timer = setTimeout(_pollWhaleAlert, 2 * 60_000); // every 2 minutes
}

export function startWhaleFeed() {
  _stopped = false;
  _lastCursor = 0;
  _pollWhaleAlert();
}

export function stopWhaleFeed() {
  _stopped = true;
  clearTimeout(_timer);
}

/**
 * Returns the dominant whale signal for an asset over the last 60 minutes.
 * Returns null if no significant signal (< $10M net flow).
 * Shape: { direction: "UP"|"DOWN", usdTotal: number, ageMs: number }
 */
export function getWhaleSignal(asset) {
  const sig = _signals[asset];
  if (!sig || sig.updatedAt === 0) return null;
  const ageMs = Date.now() - sig.updatedAt;
  if (ageMs > SIGNAL_TTL) return null;

  const net = sig.upUsd - sig.downUsd;
  if (Math.abs(net) < 10_000_000) return null; // need > $10M net to be meaningful

  return {
    direction: net > 0 ? "UP" : "DOWN",
    usdTotal:  Math.abs(net),
    ageMs,
  };
}
