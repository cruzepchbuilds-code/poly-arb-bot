// Fetch temperature ensemble forecasts from the Open-Meteo free API.
// Uses the 31-member GFS ensemble as primary source — no API key needed.
// Cache TTL is 25 minutes; GFS updates every 6 hours, so a miss at most
// costs one model cycle worth of stale data.

import { sleep } from "../utils.js";

const ENSEMBLE_URL = "https://api.open-meteo.com/v1/ensemble";
const CACHE_TTL_MS = 25 * 60 * 1000;

// { "lat,lon,unit" → { data: DayForecast[], fetchedAt: number } }
const _cache = new Map();

/**
 * DayForecast: {
 *   date:       "YYYY-MM-DD",
 *   maxMembers: number[],   // ensemble °values for daily high
 *   minMembers: number[],   // ensemble °values for daily low
 *   maxMean:    number,
 *   minMean:    number,
 * }
 */

export async function fetchEnsemble(lat, lon, unit = "F") {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${unit}`;
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  const url = new URL(ENSEMBLE_URL);
  url.searchParams.set("latitude",         lat.toFixed(4));
  url.searchParams.set("longitude",        lon.toFixed(4));
  url.searchParams.set("daily",            "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("temperature_unit", unit === "F" ? "fahrenheit" : "celsius");
  url.searchParams.set("models",           "gfs_seamless");
  url.searchParams.set("forecast_days",    "7");
  url.searchParams.set("timezone",         "UTC");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12_000) });
      if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
      if (!res.ok) return null;

      const json = await res.json();
      const data = parseResponse(json);
      if (data) _cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    } catch {
      if (attempt < 2) await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

function parseResponse(json) {
  const daily = json?.daily;
  if (!daily || !Array.isArray(daily.time)) return null;

  const maxKeys = Object.keys(daily).filter((k) => k.startsWith("temperature_2m_max_member"));
  const minKeys = Object.keys(daily).filter((k) => k.startsWith("temperature_2m_min_member"));
  if (maxKeys.length === 0) return null;

  return daily.time.map((date, i) => {
    const maxMembers = maxKeys.map((k) => daily[k][i]).filter((v) => v != null && Number.isFinite(v));
    const minMembers = minKeys.map((k) => daily[k][i]).filter((v) => v != null && Number.isFinite(v));
    const maxMean = maxMembers.length ? maxMembers.reduce((a, b) => a + b, 0) / maxMembers.length : null;
    const minMean = minMembers.length ? minMembers.reduce((a, b) => a + b, 0) / minMembers.length : null;
    return { date, maxMembers, minMembers, maxMean, minMean };
  });
}

/**
 * Given an array of ensemble member values and a threshold description,
 * return the fraction of members that satisfy the condition.
 *
 * threshold: one of
 *   { type: "above", val: number }   → member >= val
 *   { type: "below", val: number }   → member <  val
 *   { type: "range", lo, hi }        → lo <= member < hi
 */
export function ensembleProbability(members, threshold) {
  if (!members || members.length === 0 || !threshold) return null;

  let hits = 0;
  for (const v of members) {
    if (threshold.type === "above" && v >= threshold.val) hits++;
    else if (threshold.type === "below" && v <  threshold.val) hits++;
    else if (threshold.type === "range" && v >= threshold.lo && v < threshold.hi) hits++;
  }
  return hits / members.length;
}

// Invalidate a specific city's cache (call after a known model update window)
export function invalidateCache(lat, lon) {
  for (const key of _cache.keys()) {
    if (key.startsWith(`${lat.toFixed(4)},${lon.toFixed(4)}`)) _cache.delete(key);
  }
}

// Returns approximate minutes until the next GFS ensemble update is available.
// GFS runs at 00Z/06Z/12Z/18Z; output available ~3.5hrs after init.
export function minutesToNextGfsUpdate() {
  const now = new Date();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const releaseHours = [3.5, 9.5, 15.5, 21.5]; // approx availability times UTC
  for (const r of releaseHours) {
    if (r > utcHour) return Math.round((r - utcHour) * 60);
  }
  return Math.round((24 + 3.5 - utcHour) * 60); // next day's 00Z run
}
