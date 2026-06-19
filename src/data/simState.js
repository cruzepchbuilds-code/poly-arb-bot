import { readFileSync, writeFileSync } from "fs";

const STATE_FILE = "sim-state.json";

export function loadSimState(defaultBalance) {
  try {
    const data = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    return typeof data.balance === "number" ? data.balance : defaultBalance;
  } catch {
    return defaultBalance;
  }
}

export function saveSimState(balance) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ balance, savedAt: new Date().toISOString() }));
  } catch { /* ignore */ }
}
