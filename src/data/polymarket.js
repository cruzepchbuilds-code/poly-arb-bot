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
  BTC:  ["btc"],
  ETH:  ["eth"],
  SOL:  ["sol"],
  XRP:  ["xrp"],
  DOGE: ["doge"],
  AVAX: ["avax"],
  LINK: ["link"],
  MATIC: ["matic", "pol"],
};

function detectAsset(text) {
  const q = String(text || "").toLowerCase();
  if (q.includes("bitcoin")   || q.includes("btc"))  return "BTC";
  if (q.includes("ethereum")  || q.includes("eth"))  return "ETH";
  if (q.includes("solana")    || q.includes("sol"))  return "SOL";
  if (q.includes("ripple")    || q.includes("xrp"))  return "XRP";
  if (q.includes("dogecoin")  || q.includes("doge")) return "DOGE";
  if (q.includes("avalanche") || q.includes("avax")) return "AVAX";
  if (q.includes("chainlink") || q.includes("link")) return "LINK";
  if (q.includes("polygon")   || q.includes("matic"))return "MATIC";
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
  if (Date.now() - _arbCachedAt < 60_000) return _arbCache;

  const now = Date.now();
  const results = [];

  try {
    const res = await fetch(
      `${CONFIG.gammaBaseUrl}/markets?active=true&closed=false&limit=200`,
      { signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return _arbCache;
    const data = await res.json();
    const markets = Array.isArray(data) ? data : (data.markets ?? []);

    for (const m of markets) {
      const tokens = getTokenIds(m);
      if (!tokens.upTokenId || !tokens.downTokenId) continue;

      const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
      if (!endMs || endMs <= now + 30_000) continue;

      let initialYes = null, initialNo = null;
      try {
        const prices = JSON.parse(m.outcomePrices ?? "[]");
        const p0 = Number(prices[0]), p1 = Number(prices[1]);
        if (Number.isFinite(p0)) initialYes = p0;
        if (Number.isFinite(p1)) initialNo  = p1;
      } catch { /* ignore */ }

      // Skip if REST prices already show combined is not discounted
      if (initialYes !== null && initialNo !== null && initialYes + initialNo >= 0.97) continue;

      results.push({
        id:          m.conditionId || m.id || tokens.upTokenId,
        asset:       detectAsset(m.question || m.title),
        question:    String(m.question || m.title || "Unknown").slice(0, 80),
        windowMins:  Math.max(1, Math.round((endMs - now) / 60_000)),
        upTokenId:   tokens.upTokenId,
        downTokenId: tokens.downTokenId,
        endMs,
        initialYes,
        initialNo,
      });
    }
  } catch { /* network error — return cached */ }

  _arbCache = results;
  _arbCachedAt = Date.now();
  return results;
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
