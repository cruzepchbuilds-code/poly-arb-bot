import { appendFileSync } from "fs";

const LOG_FILE = "trades.jsonl";

export function logTrade(trade) {
  try {
    appendFileSync(LOG_FILE, JSON.stringify({ ...trade, loggedAt: new Date().toISOString() }) + "\n");
  } catch { /* ignore */ }
}
