// Discover and parse active temperature/weather markets from the Polymarket Gamma API.
// Extracts: city, measurement type (high/low), threshold/range, resolution date.

import { CONFIG } from "../config.js";
import { detectCity } from "./cities.js";

const GAMMA = CONFIG.gammaBaseUrl;
const CLOB  = CONFIG.clobBaseUrl;

// ── Market discovery ─────────────────────────────────────────────────────────

let _cache = { data: [], at: 0 };
const CACHE_TTL = 90_000; // 90s — markets update slowly

export async function fetchWeatherMarkets() {
  if (Date.now() - _cache.at < CACHE_TTL) return _cache.data;

  const raw = await fetchRawMarkets();
  const parsed = raw.map(parseWeatherMarket).filter(Boolean);

  // Sort: secondary cities first, then by hours-to-close ascending (closer = more certain)
  parsed.sort((a, b) => {
    const pa = a.city.id === "buenos-aires" || a.city.id === "cape-town" || a.city.id === "atlanta" || a.city.id === "dallas" || a.city.id === "seoul" ? 0 : 1;
    const pb = b.city.id === "buenos-aires" || b.city.id === "cape-town" || b.city.id === "atlanta" || b.city.id === "dallas" || b.city.id === "seoul" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.hoursToClose - b.hoursToClose;
  });

  _cache = { data: parsed, at: Date.now() };
  return parsed;
}

async function fetchRawMarkets() {
  const all = [];
  const seen = new Set();

  const add = (list) => {
    for (const m of list) {
      const id = m.conditionId || m.id;
      if (id && !seen.has(id)) { seen.add(id); all.push(m); }
    }
  };

  // Strategy 1: broad active market scan (2 pages)
  for (let offset = 0; offset <= 200; offset += 200) {
    try {
      const r = await fetch(
        `${GAMMA}/markets?active=true&closed=false&limit=200&offset=${offset}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      if (!r.ok) break;
      const d = await r.json();
      add(Array.isArray(d) ? d : (d.markets ?? []));
    } catch { break; }
  }

  // Strategy 2: keyword search (supplemental)
  for (const kw of ["temperature", "weather", "high temperature"]) {
    try {
      const r = await fetch(
        `${GAMMA}/markets?active=true&closed=false&limit=100&keyword=${encodeURIComponent(kw)}`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (r.ok) {
        const d = await r.json();
        add(Array.isArray(d) ? d : (d.markets ?? []));
      }
    } catch { /* ignore */ }
  }

  return all;
}

// ── Live price refresh ───────────────────────────────────────────────────────

export async function refreshMarketPrices(markets) {
  if (markets.length === 0) return;

  const tokenIds = markets.flatMap((m) => [m.yesId, m.noId].filter(Boolean));
  if (tokenIds.length === 0) return;

  // Batch midpoint fetch (up to 20 at a time to avoid URL length limits)
  const batches = [];
  for (let i = 0; i < tokenIds.length; i += 20) {
    batches.push(tokenIds.slice(i, i + 20));
  }

  const priceMap = new Map();
  await Promise.allSettled(
    batches.map(async (batch) => {
      try {
        const qs = batch.map((id) => `token_id=${id}`).join("&");
        const r = await fetch(`${CLOB}/midpoints?${qs}`, { signal: AbortSignal.timeout(6_000) });
        if (!r.ok) return;
        const d = await r.json();
        // Response: { "tokenId": price, ... }
        for (const [k, v] of Object.entries(d)) {
          const n = Number(v);
          if (Number.isFinite(n)) priceMap.set(String(k), n);
        }
      } catch { /* ignore */ }
    })
  );

  for (const m of markets) {
    if (m.yesId && priceMap.has(m.yesId)) m.yesPrice = priceMap.get(m.yesId);
    if (m.noId  && priceMap.has(m.noId))  m.noPrice  = priceMap.get(m.noId);
  }
}

// ── Market parsing ───────────────────────────────────────────────────────────

function parseWeatherMarket(m) {
  const text = String(m.question || m.title || "");
  if (!text) return null;

  // Must look like a temperature market
  if (!/\b(temperature|temp|high|low|degrees?|°[fc]|fahrenheit|celsius|°)\b/i.test(text)) return null;

  const city = detectCity(text);
  if (!city) return null;

  const threshold = parseThreshold(text, city.unit);
  if (!threshold) return null;

  const date = parseDate(text);
  const measureType = /\b(low|min|minimum|overnight|night)\b/i.test(text) ? "min" : "max";

  const endMs = safeTimeMs(m.endDate || m.endTime || m.resolutionTime);
  if (!endMs || endMs <= Date.now() + 60_000) return null;

  const hoursToClose = (endMs - Date.now()) / 3_600_000;
  if (hoursToClose > 120) return null; // skip >5 day markets — forecast unreliable

  const tokens = extractTokenIds(m);
  if (!tokens.yesId || !tokens.noId) return null;

  let yesPrice = null, noPrice = null;
  try {
    const prices = JSON.parse(m.outcomePrices ?? "[]");
    if (Number.isFinite(Number(prices[0]))) yesPrice = Number(prices[0]);
    if (Number.isFinite(Number(prices[1]))) noPrice  = Number(prices[1]);
  } catch { /* ignore */ }

  const volume = Number(m.volume ?? m.volumeNum ?? m.volume24hr ?? 0) || 0;

  return {
    id:           String(m.conditionId || m.id),
    question:     text.slice(0, 120),
    city,
    measureType,
    threshold,    // { type, val?, lo?, hi?, unit }
    date,         // "YYYY-MM-DD" or null
    endMs,
    hoursToClose,
    yesId:        tokens.yesId,
    noId:         tokens.noId,
    yesPrice,
    noPrice,
    volume,
  };
}

// ── Threshold parser ─────────────────────────────────────────────────────────

function parseThreshold(text, defaultUnit) {
  const unit = /fahrenheit|\b°f\b/i.test(text) ? "F"
             : /celsius|\b°c\b/i.test(text)     ? "C"
             : defaultUnit;

  // Range: "85 to 90", "85-90°F", "between 85 and 90", "85°F-90°F"
  const rangeRe = /(\d+(?:\.\d+)?)\s*(?:°[fc])?\s*(?:to|-|–|and)\s*(\d+(?:\.\d+)?)\s*(?:°[fc])?/i;
  const rangeM  = text.match(rangeRe);
  if (rangeM) {
    const lo = Number(rangeM[1]), hi = Number(rangeM[2]);
    if (lo < hi && isReasonableTemp(lo, unit) && isReasonableTemp(hi, unit)) {
      return { type: "range", lo, hi, unit };
    }
  }

  // Above: "above 85°F", "exceed 90", "over 80", ">= 85", "at least 80"
  const aboveRe = /(?:above|exceed(?:s)?|over|at least|≥|>=)\s*(\d+(?:\.\d+)?)\s*°?[fc]?/i;
  const aboveM  = text.match(aboveRe);
  if (aboveM) {
    const val = Number(aboveM[1]);
    if (isReasonableTemp(val, unit)) return { type: "above", val, unit };
  }

  // Shorthand >85
  const gtM = text.match(/>\s*(\d+(?:\.\d+)?)\s*°?[fc]?/);
  if (gtM) {
    const val = Number(gtM[1]);
    if (isReasonableTemp(val, unit)) return { type: "above", val, unit };
  }

  // Below: "below 60°F", "under 50", "less than 40"
  const belowRe = /(?:below|under|less than|≤|<=)\s*(\d+(?:\.\d+)?)\s*°?[fc]?/i;
  const belowM  = text.match(belowRe);
  if (belowM) {
    const val = Number(belowM[1]);
    if (isReasonableTemp(val, unit)) return { type: "below", val, unit };
  }

  // Shorthand <85
  const ltM = text.match(/<\s*(\d+(?:\.\d+)?)\s*°?[fc]?/);
  if (ltM) {
    const val = Number(ltM[1]);
    if (isReasonableTemp(val, unit)) return { type: "below", val, unit };
  }

  return null;
}

// Sanity check: temperature must be in a physically plausible range
function isReasonableTemp(val, unit) {
  if (unit === "F") return val > -60 && val < 140;
  return val > -60 && val < 60;
}

// ── Date parser ──────────────────────────────────────────────────────────────

function parseDate(text) {
  // ISO: 2026-06-22
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  // Named month: "June 22", "Jun 22, 2026", "22 June 2026"
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const named = text.match(
    /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*(\d{4})?/i
  ) || text.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\s*,?\s*(\d{4})?/i
  );

  if (named) {
    const monthStr = (named[2] || named[1]).slice(0, 3).toLowerCase();
    const mo = months[monthStr];
    const day = Number(named[1].match(/^\d+$/) ? named[1] : named[2]);
    const yr  = named[3] ? Number(named[3]) : new Date().getFullYear();
    if (mo && day) return `${yr}-${String(mo).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractTokenIds(m) {
  try {
    let ids = m.clobTokenIds;
    if (typeof ids === "string") ids = JSON.parse(ids);
    if (Array.isArray(ids) && ids.length >= 2) {
      return { yesId: String(ids[0]), noId: String(ids[1]) };
    }
  } catch { /* ignore */ }

  if (Array.isArray(m.tokens)) {
    const yes = m.tokens.find((t) => /^(yes|true|higher|above|over|exceed)$/i.test(String(t.outcome || "")));
    const no  = m.tokens.find((t) => /^(no|false|lower|below|under)$/i.test(String(t.outcome || "")));
    return { yesId: String(yes?.token_id ?? yes?.tokenId ?? "") || null,
             noId:  String(no?.token_id  ?? no?.tokenId  ?? "") || null };
  }

  return { yesId: null, noId: null };
}

function safeTimeMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
