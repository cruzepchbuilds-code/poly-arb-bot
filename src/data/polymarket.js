import { CONFIG } from "../config.js";

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function safeTimeMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

// ── Market discovery ────────────────────────────────────────────────────────

// Fetch all currently active 5-min up/down markets for BTC and ETH.
// Returns array of: { id, asset, question, upTokenId, downTokenId, endMs }
export async function fetchAll5minMarkets() {
  const results = [];

  try {
    // Broad fetch of active markets — filter client-side for 5-min crypto
    const urls = [
      `${CONFIG.gammaBaseUrl}/markets?active=true&limit=100`,
      `${CONFIG.gammaBaseUrl}/markets?active=true&limit=100&tag_slug=crypto`,
      `${CONFIG.gammaBaseUrl}/events?active=true&limit=50`,
    ];

    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const data = await res.json();
        const markets = extractMarkets(data);
        const filtered = markets.filter(is5minCryptoMarket);
        results.push(...filtered);
      } catch { continue; }
    }
  } catch { /* ignore */ }

  // Deduplicate by conditionId / id
  const seen = new Set();
  const unique = [];
  for (const m of results) {
    const key = m.conditionId || m.id || m.question;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  return unique.map(normalize5minMarket).filter(Boolean);
}

// Fetch a single previously-active market by conditionId for price refresh
export async function fetchMarketById(conditionId) {
  try {
    const res = await fetch(
      `${CONFIG.gammaBaseUrl}/markets/${conditionId}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return normalize5minMarket(data);
  } catch { return null; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractMarkets(data) {
  if (!data) return [];
  if (Array.isArray(data)) {
    const flat = [];
    for (const item of data) {
      if (item.markets && Array.isArray(item.markets)) flat.push(...item.markets);
      else flat.push(item);
    }
    return flat;
  }
  if (data.markets) return Array.isArray(data.markets) ? data.markets : [];
  return [data];
}

function is5minCryptoMarket(m) {
  const q = String(m.question || m.title || m.slug || "").toLowerCase();
  const isCrypto =
    q.includes("bitcoin") || q.includes(" btc") ||
    q.includes("ethereum") || q.includes(" eth");
  const isUpDown =
    q.includes("up or down") || q.includes("higher") || q.includes("above");

  // Check window duration ≈ 5 min
  const start = safeTimeMs(m.startDate || m.startTime);
  const end = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
  const duration = start && end ? end - start : null;
  const is5min = duration ? duration >= 4 * 60_000 && duration <= 6 * 60_000 : true;

  // Must be currently open
  const now = Date.now();
  const isOpen = end ? end > now : true;

  return isCrypto && isUpDown && is5min && isOpen;
}

function normalize5minMarket(m) {
  if (!m) return null;

  const question = String(m.question || m.title || "");
  const q = question.toLowerCase();

  const asset =
    q.includes("bitcoin") || q.includes("btc") ? "BTC" :
    q.includes("ethereum") || q.includes("eth") ? "ETH" : null;

  if (!asset) return null;

  const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
  if (!endMs || endMs <= Date.now()) return null;

  const tokens = getTokenIds(m);
  if (!tokens.upTokenId || !tokens.downTokenId) return null;

  return {
    id: m.conditionId || m.id || m.slug || question,
    asset,
    question,
    upTokenId: tokens.upTokenId,
    downTokenId: tokens.downTokenId,
    endMs,
  };
}

function getTokenIds(market) {
  if (!market) return { upTokenId: null, downTokenId: null };

  // clobTokenIds array: [yesId, noId]
  if (Array.isArray(market.clobTokenIds) && market.clobTokenIds.length >= 2) {
    return { upTokenId: market.clobTokenIds[0], downTokenId: market.clobTokenIds[1] };
  }

  // tokens array with outcome labels
  if (Array.isArray(market.tokens)) {
    const up = market.tokens.find((t) => {
      const o = String(t.outcome || "").toLowerCase();
      return o === "up" || o === "yes" || o === "higher" || o === "above";
    });
    const down = market.tokens.find((t) => {
      const o = String(t.outcome || "").toLowerCase();
      return o === "down" || o === "no" || o === "lower" || o === "below";
    });
    return {
      upTokenId: up?.token_id || up?.tokenId || null,
      downTokenId: down?.token_id || down?.tokenId || null,
    };
  }

  return { upTokenId: null, downTokenId: null };
}

// ── CLOB pricing ─────────────────────────────────────────────────────────────

async function fetchMidPrice(tokenId) {
  if (!tokenId) return null;
  try {
    const res = await fetch(
      `${CONFIG.clobBaseUrl}/midpoint?token_id=${tokenId}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return toNumber(data.mid ?? data.price ?? data.midpoint);
  } catch { return null; }
}

// Returns { yesPrice, noPrice } for a market
export async function fetchClobMidPrices(upTokenId, downTokenId) {
  const [yes, no] = await Promise.all([
    fetchMidPrice(upTokenId),
    fetchMidPrice(downTokenId),
  ]);
  return { yesPrice: yes, noPrice: no };
}
