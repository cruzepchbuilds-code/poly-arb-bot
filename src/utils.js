export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fmtUsd = (n) =>
  n == null
    ? "N/A"
    : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n, decimals = 2) =>
  n == null ? "N/A" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;

export const fmtTime = (d = new Date()) =>
  d.toLocaleTimeString("en-US", { hour12: false });

export const fmtDuration = (ms) => {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const pad = (s, n, char = " ") => String(s).padEnd(n, char).slice(0, n);
export const padL = (s, n, char = " ") => String(s).padStart(n, char).slice(-n);
