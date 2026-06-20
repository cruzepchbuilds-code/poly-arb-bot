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

const ASSET_PREFIXES = {
  BTC:  ["btc", "bitcoin"],
  ETH:  ["eth", "ethereum"],
  SOL:  ["sol", "solana"],
  XRP:  ["xrp", "ripple"],
  DOGE: ["doge", "dogecoin"],
  AVAX: ["avax", "avalanche"],
  LINK: ["link", "chainlink"],
  MATIC: ["matic", "pol", "polygon"],
  BNB:  ["bnb", "binancecoin"],
  ADA:  ["ada", "cardano"],
  DOT:  ["dot", "polkadot"],
  TRX:  ["trx", "tron"],
  TON:  ["ton", "toncoin"],
  SHIB: ["shib", "shibainu"],
  PEPE: ["pepe"],
  UNI:  ["uni", "uniswap"],
  ATOM: ["atom", "cosmos"],
  NEAR: ["near"],
  APT:  ["apt", "aptos"],
  SUI:  ["sui"],
  ARB:  ["arb", "arbitrum"],
  OP:   ["op", "optimism"],
  INJ:  ["inj", "injective"],
};

function detectAsset(text) {
  const q = String(text || "").toLowerCase();
  if (q.includes("bitcoin")     || q.match(/\bbtc\b/))      return "BTC";
  if (q.includes("ethereum")    || q.match(/\beth\b/))      return "ETH";
  if (q.includes("solana")      || q.match(/\bsol\b/))      return "SOL";
  if (q.includes("ripple")      || q.match(/\bxrp\b/))      return "XRP";
  if (q.includes("dogecoin")    || q.match(/\bdoge\b/))     return "DOGE";
  if (q.includes("avalanche")   || q.match(/\bavax\b/))     return "AVAX";
  if (q.includes("chainlink")   || q.match(/\blink\b/))     return "LINK";
  if (q.includes("polygon")     || q.match(/\bmatic\b/) || q.match(/\bpol\b/)) return "MATIC";
  if (q.includes("binancecoin") || q.match(/\bbnb\b/))      return "BNB";
  if (q.includes("cardano")     || q.match(/\bada\b/))      return "ADA";
  if (q.includes("polkadot")    || q.match(/\bdot\b/))      return "DOT";
  if (q.includes("tron")        || q.match(/\btrx\b/))      return "TRX";
  if (q.includes("toncoin")     || q.match(/\bton\b/))      return "TON";
  if (q.includes("shiba")       || q.match(/\bshib\b/))     return "SHIB";
  if (q.match(/\bpepe\b/))                                   return "PEPE";
  if (q.includes("uniswap")     || q.match(/\buni\b/))      return "UNI";
  if (q.includes("cosmos")      || q.match(/\batom\b/))     return "ATOM";
  if (q.match(/\bnear\b/))                                   return "NEAR";
  if (q.includes("aptos")       || q.match(/\bapt\b/))      return "APT";
  if (q.match(/\bsui\b/))                                    return "SUI";
  if (q.includes("arbitrum")    || q.match(/\barb\b/))      return "ARB";
  if (q.includes("optimism")    || q.match(/\bop\b/))       return "OP";
  if (q.includes("injective")   || q.match(/\binj\b/))      return "INJ";
  return "GENERAL";
}

function getTokenIds(market) {
  if (!market) return { upTokenId: null, downTokenId: null };

  try {
    let ids = market.clobTokenIds;
    if (typeof ids === "string") ids = JSON.parse(ids);
    if (Array.isArray(ids) && ids.length >= 2) {
      return { upTokenId: String(ids[0]), downTokenId: String(ids[1]) };
    }
  } catch { /* ignore */ }

  if (Array.isArray(market.tokens)) {
    const up = market.tokens.find(t => /^(up|yes|higher|above)$/i.test(String(t.outcome || "")));
    const dn = market.tokens.find(t => /^(down|no|lower|below)$/i.test(String(t.outcome || "")));
    return {
      upTokenId:   String(up?.token_id ?? up?.tokenId ?? "") || null,
      downTokenId: String(dn?.token_id ?? dn?.tokenId ?? "") || null,
    };
  }

  return { upTokenId: null, downTokenId: null };
}

function normalizeSlugMarket(m, asset, windowEndMs, windowMins = 5) {
  if (!m) return null;
  const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime) ?? windowEndMs;
  if (!endMs || endMs <= Date.now()) return null;
  const tokens = getTokenIds(m);
  if (!tokens.upTokenId || !tokens.downTokenId) return null;

  let initialYes = null, initialNo = null;
  try {
    const prices = JSON.parse(m.outcomePrices ?? "[]");
    const p0 = Number(prices[0]), p1 = Number(prices[1]);
    if (Number.isFinite(p0)) initialYes = p0;
    if (Number.isFinite(p1)) initialNo  = p1;
  } catch { /* ignore */ }

  return {
    id:          m.conditionId || m.id || tokens.upTokenId,
    asset,
    question:    String(m.question || m.title || `${asset} Up or Down ${windowMins}m`),
    windowMins,
    upTokenId:   tokens.upTokenId,
    downTokenId: tokens.downTokenId,
    endMs,
    initialYes,
    initialNo,
  };
}

// ── 5-min and 10-min crypto markets ─────────────────────────────────────────

let _marketsCache = [];
let _marketsCachedAt = 0;

export async function fetchAll5minMarkets() {
  if (Date.now() - _marketsCachedAt < 15_000) return _marketsCache;

  const nowSec = Math.floor(Date.now() / 1000);

  // 5-minute windows (300s boundaries)
  const end5 = Math.ceil(nowSec / 300) * 300;
  const windows5m = [end5, end5 + 300, end5 + 600];

  // 10-minute windows (600s boundaries)
  const end10 = Math.ceil(nowSec / 600) * 600;
  const windows10m = [end10, end10 + 600, end10 + 1200];

  const fetches = [];
  for (const [asset, prefixes] of Object.entries(ASSET_PREFIXES)) {
    for (const prefix of prefixes) {
      for (const windowEnd of windows5m) {
        fetches.push({ asset, slug: `${prefix}-updown-5m-${windowEnd}`, windowEndMs: windowEnd * 1000, windowMins: 5 });
      }
      for (const windowEnd of windows10m) {
        fetches.push({ asset, slug: `${prefix}-updown-10m-${windowEnd}`, windowEndMs: windowEnd * 1000, windowMins: 10 });
      }
    }
  }

  const settled = await Promise.allSettled(
    fetches.map(({ asset, slug, windowEndMs, windowMins }) =>
      fetchEventBySlug(slug).then(events =>
        events.flatMap(ev =>
          (ev.markets ?? []).flatMap(m => {
            const n = normalizeSlugMarket(m, asset, windowEndMs, windowMins);
            return n ? [n] : [];
          })
        )
      )
    )
  );

  const all = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);
  const seen = new Set();
  _marketsCache = all.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  _marketsCachedAt = Date.now();
  return _marketsCache;
}

// ── Broad binary market scan (primary discovery) ─────────────────────────────
// Replaces the slug-based approach as the primary feed; covers all 23 assets.

let _broadCache = [];
let _broadCachedAt = 0;

export async function fetchAllBinaryMarkets() {
  if (Date.now() - _broadCachedAt < 15_000) return _broadCache;

  const now = Date.now();
  const all = [];

  // Fetch 2 pages for broader coverage
  for (let offset = 0; offset <= 200; offset += 200) {
    try {
      const res = await fetch(
        `${CONFIG.gammaBaseUrl}/markets?active=true&closed=false&limit=200&offset=${offset}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!res.ok) break;
      const data = await res.json();
      const page = Array.isArray(data) ? data : (data.markets ?? []);
      all.push(...page);
      if (page.length < 200) break;
    } catch { break; }
  }

  // Also supplement with slug-based lookup for known assets (reliability fallback)
  const nowSec = Math.floor(now / 1000);
  const end5  = Math.ceil(nowSec / 300) * 300;
  const end10 = Math.ceil(nowSec / 600) * 600;
  const windows5m  = [end5,  end5  + 300, end5  + 600];
  const windows10m = [end10, end10 + 600, end10 + 1200];
  const slugFetches = [];
  for (const [asset, prefixes] of Object.entries(ASSET_PREFIXES)) {
    for (const prefix of prefixes.slice(0, 1)) { // only first prefix per asset
      for (const w of windows5m)  slugFetches.push({ asset, slug: `${prefix}-updown-5m-${w}`,  windowEndMs: w * 1000, windowMins: 5  });
      for (const w of windows10m) slugFetches.push({ asset, slug: `${prefix}-updown-10m-${w}`, windowEndMs: w * 1000, windowMins: 10 });
    }
  }
  const slugResults = await Promise.allSettled(
    slugFetches.map(({ asset, slug, windowEndMs, windowMins }) =>
      fetchEventBySlug(slug).then(events =>
        events.flatMap(ev => (ev.markets ?? []).flatMap(m => {
          const n = normalizeSlugMarket(m, asset, windowEndMs, windowMins);
          return n ? [n] : [];
        }))
      )
    )
  );
  const slugMarkets = slugResults.flatMap(r => r.status === "fulfilled" ? r.value : []);

  // Normalize broad scan results
  const broadMarkets = [];
  for (const m of all) {
    const tokens = getTokenIds(m);
    if (!tokens.upTokenId || !tokens.downTokenId) continue;
    const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
    if (!endMs || endMs <= now + 30_000 || endMs > now + 90 * 60_000) continue;
    const asset = detectAsset(m.question || m.title);
    let initialYes = null, initialNo = null;
    try {
      const prices = JSON.parse(m.outcomePrices ?? "[]");
      const p0 = Number(prices[0]), p1 = Number(prices[1]);
      if (Number.isFinite(p0)) initialYes = p0;
      if (Number.isFinite(p1)) initialNo  = p1;
    } catch { /* ignore */ }
    broadMarkets.push({
      id:          m.conditionId || m.id || tokens.upTokenId,
      asset,
      question:    String(m.question || m.title || "Unknown").slice(0, 80),
      windowMins:  Math.max(1, Math.round((endMs - now) / 60_000)),
      upTokenId:   tokens.upTokenId,
      downTokenId: tokens.downTokenId,
      endMs,
      initialYes,
      initialNo,
    });
  }

  // Merge broad + slug, deduplicate by id
  const seen = new Set();
  const merged = [...broadMarkets, ...slugMarkets].filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  _broadCache = merged;
  _broadCachedAt = now;
  return merged;
}

async function fetchEventBySlug(slug) {
  try {
    const res = await fetch(
      `${CONFIG.gammaBaseUrl}/events?slug=${encodeURIComponent(slug)}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.filter(Boolean);
    if (data && typeof data === "object") return [data];
    return [];
  } catch { return []; }
}

// ── Broader ARB candidate scan ───────────────────────────────────────────────
// Fetches all active binary markets and pre-screens for combined price < 0.97.
// Results are subscribed to the CLOB WS so the ARB trigger fires automatically.

let _arbCache = [];
let _arbCachedAt = 0;

export async function fetchArbCandidates() {
  // Delegate to the broad scan — fetchAllBinaryMarkets handles caching and dedup
  return fetchAllBinaryMarkets();
}

// ── Utility exports ──────────────────────────────────────────────────────────

export async function fetchMarketById(conditionId) {
  try {
    const res = await fetch(`${CONFIG.gammaBaseUrl}/markets/${conditionId}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const m = await res.json();
    return normalizeSlugMarket(m, detectAsset(m.question || m.title), null);
  } catch { return null; }
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
