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

// Slug prefixes for each asset (try multiple in case Polymarket uses different names)
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

let _marketsCache = [];
let _marketsCachedAt = 0;

export async function fetchAll5minMarkets() {
  if (Date.now() - _marketsCachedAt < 15_000) return _marketsCache;

  // 5-min windows use Unix timestamps in seconds, always on 300s boundaries.
  // Slug format: {asset}-updown-5m-{windowEndSeconds}
  const nowSec = Math.floor(Date.now() / 1000);
  const currentEnd = Math.ceil(nowSec / 300) * 300 || (Math.floor(nowSec / 300) + 1) * 300;
  const windows = [currentEnd, currentEnd + 300, currentEnd + 600];

  const fetches = [];
  for (const [asset, prefixes] of Object.entries(ASSET_PREFIXES)) {
    for (const prefix of prefixes) {
      for (const windowEnd of windows) {
        const slug = `${prefix}-updown-5m-${windowEnd}`;
        fetches.push({ asset, slug, windowEndMs: windowEnd * 1000 });
      }
    }
  }

  const settled = await Promise.allSettled(
    fetches.map(({ asset, slug, windowEndMs }) =>
      fetchEventBySlug(slug).then(events =>
        events.flatMap(ev =>
          (ev.markets ?? []).flatMap(m => {
            const n = normalizeSlugMarket(m, asset, windowEndMs);
            return n ? [n] : [];
          })
        )
      )
    )
  );

  const all = settled.flatMap(r => r.status === "fulfilled" ? r.value : []);

  const seen = new Set();
  const unique = all.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  _marketsCache = unique;
  _marketsCachedAt = Date.now();
  return unique;
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

function normalizeSlugMarket(m, asset, windowEndMs) {
  if (!m) return null;

  const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime) ?? windowEndMs;
  if (!endMs || endMs <= Date.now()) return null;

  const tokens = getTokenIds(m);
  if (!tokens.upTokenId || !tokens.downTokenId) return null;

  const question = String(m.question || m.title || `${asset} Up or Down 5m`);

  let initialYes = null, initialNo = null;
  try {
    const prices = JSON.parse(m.outcomePrices ?? "[]");
    const p0 = Number(prices[0]), p1 = Number(prices[1]);
    if (Number.isFinite(p0)) initialYes = p0;
    if (Number.isFinite(p1)) initialNo  = p1;
  } catch { /* ignore */ }

  return {
    id: m.conditionId || m.id || tokens.upTokenId,
    asset,
    question,
    windowMins: 5,
    upTokenId:   tokens.upTokenId,
    downTokenId: tokens.downTokenId,
    endMs,
    initialYes,
    initialNo,
  };
}

export async function fetchMarketById(conditionId) {
  try {
    const res = await fetch(`${CONFIG.gammaBaseUrl}/markets/${conditionId}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const m = await res.json();
    // Try to detect asset from question
    const q = String(m.question || m.title || "").toLowerCase();
    const asset =
      q.includes("bitcoin") || q.includes("btc")  ? "BTC"  :
      q.includes("ethereum") || q.includes("eth") ? "ETH"  :
      q.includes("solana") || q.includes("sol")   ? "SOL"  :
      q.includes("ripple") || q.includes("xrp")   ? "XRP"  :
      q.includes("dogecoin") || q.includes("doge")? "DOGE" :
      q.includes("avalanche") || q.includes("avax")? "AVAX":
      q.includes("chainlink") || q.includes("link")? "LINK":
      q.includes("polygon") || q.includes("matic")? "MATIC": "BTC";
    return normalizeSlugMarket(m, asset, null);
  } catch { return null; }
}

function getTokenIds(market) {
  if (!market) return { upTokenId: null, downTokenId: null };

  // clobTokenIds may be a JSON-encoded string: "[\"id1\",\"id2\"]"
  try {
    let ids = market.clobTokenIds;
    if (typeof ids === "string") ids = JSON.parse(ids);
    if (Array.isArray(ids) && ids.length >= 2) {
      return { upTokenId: String(ids[0]), downTokenId: String(ids[1]) };
    }
  } catch { /* ignore */ }

  // Fallback: tokens array
  if (Array.isArray(market.tokens)) {
    const up = market.tokens.find(t => /^(up|yes|higher|above)$/i.test(String(t.outcome || "")));
    const dn = market.tokens.find(t => /^(down|no|lower|below)$/i.test(String(t.outcome || "")));
    return {
      upTokenId:   String(up?.token_id   ?? up?.tokenId   ?? "") || null,
      downTokenId: String(dn?.token_id   ?? dn?.tokenId   ?? "") || null,
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
