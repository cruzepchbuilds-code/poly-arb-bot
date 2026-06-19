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

let _marketsCache = [];
let _marketsCachedAt = 0;

export async function fetchAll5minMarkets() {
  if (Date.now() - _marketsCachedAt < 30_000) return _marketsCache;

  const results = [];

  try {
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
        const filtered = markets.filter(isCryptoUpDownMarket);
        results.push(...filtered);
      } catch { continue; }
    }
  } catch { /* ignore */ }

  const seen = new Set();
  const unique = [];
  for (const m of results) {
    const key = m.conditionId || m.id || m.question;
    if (!seen.has(key)) { seen.add(key); unique.push(m); }
  }

  const markets = unique.map(normalizeCryptoMarket).filter(Boolean);
  _marketsCache = markets;
  _marketsCachedAt = Date.now();
  return markets;
}

export async function fetchMarketById(conditionId) {
  try {
    const res = await fetch(`${CONFIG.gammaBaseUrl}/markets/${conditionId}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return normalizeCryptoMarket(await res.json());
  } catch { return null; }
}

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

function isCryptoUpDownMarket(m) {
  const q = String(m.question || m.title || m.slug || "").toLowerCase();

  const isCrypto =
    q.includes("bitcoin")   || /\bbtc\b/.test(q)  ||
    q.includes("ethereum")  || /\beth\b/.test(q)  ||
    q.includes("solana")    || /\bsol\b/.test(q)  ||
    q.includes("ripple")    || /\bxrp\b/.test(q)  ||
    q.includes("dogecoin")  || /\bdoge\b/.test(q) ||
    q.includes("avalanche") || /\bavax\b/.test(q) ||
    q.includes("chainlink") || /\blink\b/.test(q) ||
    q.includes("polygon")   || /\bmatic\b/.test(q);

  const isUpDown =
    q.includes("up or down") || q.includes("higher") || q.includes("above") ||
    q.includes("lower or higher") || q.includes("go up") || q.includes("price up");

  const start    = safeTimeMs(m.startDate || m.startTime);
  const end      = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
  const duration = start && end ? end - start : null;
  const is5min   = duration ? duration >= 4  * 60_000 && duration <= 6  * 60_000 : true;
  const is15min  = duration ? duration >= 12 * 60_000 && duration <= 18 * 60_000 : false;
  const isOpen   = end ? end > Date.now() : true;

  return isCrypto && isUpDown && (is5min || is15min) && isOpen;
}

function normalizeCryptoMarket(m) {
  if (!m) return null;

  const question = String(m.question || m.title || "");
  const q = question.toLowerCase();

  const asset =
    q.includes("bitcoin")   || q.includes("btc")  ? "BTC"  :
    q.includes("ethereum")  || q.includes("eth")  ? "ETH"  :
    q.includes("solana")    || q.includes("sol")  ? "SOL"  :
    q.includes("ripple")    || q.includes("xrp")  ? "XRP"  :
    q.includes("dogecoin")  || q.includes("doge") ? "DOGE" :
    q.includes("avalanche") || q.includes("avax") ? "AVAX" :
    q.includes("chainlink") || q.includes("link") ? "LINK" :
    q.includes("polygon")   || q.includes("matic")? "MATIC": null;

  if (!asset) return null;

  const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
  if (!endMs || endMs <= Date.now()) return null;

  const tokens = getTokenIds(m);
  if (!tokens.upTokenId || !tokens.downTokenId) return null;

  const startMs    = safeTimeMs(m.startDate || m.startTime);
  const duration   = startMs ? endMs - startMs : null;
  const windowMins = duration && duration > 8 * 60_000 ? 15 : 5;

  let initialYes = null, initialNo = null;
  try {
    const prices = JSON.parse(m.outcomePrices ?? "[]");
    const p0 = Number(prices[0]), p1 = Number(prices[1]);
    if (Number.isFinite(p0)) initialYes = p0;
    if (Number.isFinite(p1)) initialNo  = p1;
  } catch { /* ignore */ }

  return {
    id: m.conditionId || m.id || m.slug || question,
    asset, question, windowMins,
    upTokenId: tokens.upTokenId, downTokenId: tokens.downTokenId,
    endMs, initialYes, initialNo,
  };
}

function getTokenIds(market) {
  if (!market) return { upTokenId: null, downTokenId: null };

  if (Array.isArray(market.clobTokenIds) && market.clobTokenIds.length >= 2) {
    return { upTokenId: market.clobTokenIds[0], downTokenId: market.clobTokenIds[1] };
  }

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
      upTokenId:   up?.token_id   || up?.tokenId   || null,
      downTokenId: down?.token_id || down?.tokenId || null,
    };
  }

  return { upTokenId: null, downTokenId: null };
}

async function fetchMidPrice(tokenId) {
  if (!tokenId) return null;
  try {
    const res = await fetch(`${CONFIG.clobBaseUrl}/midpoint?token_id=${tokenId}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return toNumber(data.mid ?? data.price ?? data.midpoint);
  } catch { return null; }
}

export async function fetchClobMidPrices(upTokenId, downTokenId) {
  const [yes, no] = await Promise.all([fetchMidPrice(upTokenId), fetchMidPrice(downTokenId)]);
  return { yesPrice: yes, noPrice: no };
}
