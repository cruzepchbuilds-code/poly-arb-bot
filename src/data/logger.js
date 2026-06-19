import { appendFileSync, readFileSync } from "fs";

const LOG_FILE = "trades.jsonl";

export function logTrade(trade) {
  try {
    appendFileSync(LOG_FILE, JSON.stringify({ ...trade, loggedAt: new Date().toISOString() }) + "\n");
  } catch { /* ignore */ }
}

export function loadTrades() {
  try {
    return readFileSync(LOG_FILE, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}
