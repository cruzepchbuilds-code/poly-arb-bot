/**
 * Economic event calendar — FOMC, CPI, NFP.
 *
 * Crypto moves 1–4% in the minutes around major macro announcements.
 * Being aware of the schedule lets the bot upsize bets in the window
 * leading up to each event (the move is coming, direction TBD but magnitude is near-certain).
 *
 * getEventMultiplier()  → 1.0–1.40 size multiplier based on proximity to next event.
 * getCurrentEvent()     → { type, name, minutesUntil, multiplier } or null if no event near.
 */

// All times are UTC. FOMC decisions at 19:00 UTC, CPI/NFP at 13:30 UTC.
const EVENTS = [
  // ── FOMC Decision Days (19:00 UTC) ──────────────────────────────────────
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2026-07-29T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2026-09-16T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2026-10-28T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2026-12-09T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-01-27T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-03-17T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-05-05T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-06-16T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-07-28T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-09-15T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-10-27T19:00:00Z" },
  { type: "FOMC", name: "FOMC Rate Decision", ts: "2027-12-08T19:00:00Z" },

  // ── CPI Releases (13:30 UTC, ~10th–15th of each month) ──────────────────
  { type: "CPI",  name: "CPI Release",        ts: "2026-07-15T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2026-08-12T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2026-09-10T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2026-10-14T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2026-11-12T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2026-12-09T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2027-01-13T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2027-02-10T13:30:00Z" },
  { type: "CPI",  name: "CPI Release",        ts: "2027-03-10T13:30:00Z" },

  // ── Non-Farm Payrolls (13:30 UTC, first Friday of each month) ───────────
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-07-10T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-08-07T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-09-04T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-10-02T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-11-06T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2026-12-04T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2027-01-08T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2027-02-05T13:30:00Z" },
  { type: "NFP",  name: "Non-Farm Payrolls",  ts: "2027-03-05T13:30:00Z" },
].map(e => ({ ...e, tsMs: new Date(e.ts).getTime() }));

// Size multipliers by event type and proximity window
const MULTIPLIERS = {
  FOMC: [
    { minsUntil: 30,  mult: 1.40 }, // final 30 min before decision = highest vol
    { minsUntil: 120, mult: 1.25 }, // 30–120 min before = elevated
    { minsUntil: 240, mult: 1.10 }, // 2–4 hours before = mild boost
  ],
  CPI:  [
    { minsUntil: 15,  mult: 1.35 },
    { minsUntil: 60,  mult: 1.20 },
    { minsUntil: 180, mult: 1.08 },
  ],
  NFP:  [
    { minsUntil: 15,  mult: 1.30 },
    { minsUntil: 60,  mult: 1.15 },
    { minsUntil: 180, mult: 1.05 },
  ],
};

function _nextEvent() {
  const now = Date.now();
  let nearest = null;
  for (const ev of EVENTS) {
    const minsUntil = (ev.tsMs - now) / 60_000;
    if (minsUntil < -15 || minsUntil > 300) continue; // -15 = still in event window; 300 = 5 hours ahead
    if (!nearest || Math.abs(minsUntil) < Math.abs((nearest.tsMs - now) / 60_000)) nearest = ev;
  }
  return nearest;
}

/**
 * Returns a size multiplier based on proximity to the nearest economic event.
 * Returns 1.0 if no event is within the look-ahead window.
 */
export function getEventMultiplier() {
  const ev = _nextEvent();
  if (!ev) return 1.0;
  const minsUntil = (ev.tsMs - Date.now()) / 60_000;
  if (minsUntil < -15) return 1.0; // event passed >15 min ago
  const schedule = MULTIPLIERS[ev.type] ?? [];
  for (const band of schedule) {
    if (minsUntil <= band.minsUntil) return band.mult;
  }
  return 1.0;
}

/**
 * Returns details about the nearest upcoming event, or null if none within 5 hours.
 * Shape: { type: "FOMC"|"CPI"|"NFP", name: string, minutesUntil: number, multiplier: number }
 */
export function getCurrentEvent() {
  const ev = _nextEvent();
  if (!ev) return null;
  const minutesUntil = Math.round((ev.tsMs - Date.now()) / 60_000);
  return { type: ev.type, name: ev.name, minutesUntil, multiplier: getEventMultiplier() };
}
