/**
 * Bonereaper full trade history scraper
 * Usage: WALLET=0x... node scrape-bonereaper.mjs
 *
 * Paginates backward through all trades using timestamp cursor.
 * Saves bonereaper-all-trades.json + bonereaper-analysis.txt
 */

import fs from "fs";

const WALLET = (process.env.WALLET || process.argv[2] || "").toLowerCase();
if (!WALLET || !WALLET.startsWith("0x")) {
  console.error("Usage: WALLET=0xABC... node scrape-bonereaper.mjs");
  process.exit(1);
}

const DATA_BASE = "https://data-api.polymarket.com";
const HEADERS   = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" };

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Paginate activity using `before` timestamp cursor
async function fetchAllActivity(address) {
  const all = [];
  let before = null; // Unix timestamp in seconds
  let page = 0;
  const limit = 500;

  console.log("Fetching all activity (paginating by timestamp)...");
  while (true) {
    let url = `${DATA_BASE}/activity?user=${address}&limit=${limit}`;
    if (before) url += `&before=${before}`;

    let batch;
    try {
      const data = await fetchJSON(url);
      batch = Array.isArray(data) ? data : (data.data ?? []);
    } catch (e) {
      // Try alternate param names
      try {
        const url2 = url.replace(`&before=${before}`, `&endTime=${before}`);
        const data2 = await fetchJSON(url2);
        batch = Array.isArray(data2) ? data2 : (data2.data ?? []);
      } catch { console.warn(`  Page ${page} failed:`, e.message); break; }
    }

    if (!batch || batch.length === 0) break;

    // Only keep TRADE type (skip REDEEM, MERGE, etc.)
    const trades = batch.filter(r => r.type === "TRADE");
    all.push(...trades);
    page++;

    const oldest = batch.reduce((min, r) => Math.min(min, r.timestamp ?? Infinity), Infinity);
    const newest = batch.reduce((max, r) => Math.max(max, r.timestamp ?? 0), 0);
    const oldDate = new Date(oldest * 1000).toISOString().slice(0, 10);
    const newDate = new Date(newest * 1000).toISOString().slice(0, 10);

    process.stdout.write(`\r  Page ${page}: ${all.length} TRADES so far  [${oldDate} → ${newDate}]  `);

    if (batch.length < limit) break; // Last page

    before = oldest - 1; // Cursor: go further back in time
    await new Promise(r => setTimeout(r, 250));
  }

  console.log(`\n  Done: ${all.length} total TRADE records`);
  return all;
}

function analyze(trades, outFile) {
  if (trades.length === 0) { console.log("No trades to analyze."); return; }

  const lines = [];
  const log = (s = "") => { lines.push(s); console.log(s); };

  // ── Basic stats ──────────────────────────────────────────────────────────────
  let totalUsdc = 0, totalShares = 0;
  let firstTs = Infinity, lastTs = 0;

  for (const t of trades) {
    totalUsdc   += Number(t.usdcSize  ?? 0);
    totalShares += Number(t.size      ?? 0);
    if (t.timestamp < firstTs) firstTs = t.timestamp;
    if (t.timestamp > lastTs)  lastTs  = t.timestamp;
  }

  const firstDate = new Date(firstTs * 1000).toISOString().slice(0, 10);
  const lastDate  = new Date(lastTs  * 1000).toISOString().slice(0, 10);
  const days      = (lastTs - firstTs) / 86400;
  const dailyUsdc = totalUsdc / Math.max(1, days);

  log("═══════════════════════════════════════════════════════");
  log(" BONEREAPER TRADE ANALYSIS");
  log("═══════════════════════════════════════════════════════");
  log(`  Wallet:        ${WALLET}`);
  log(`  Period:        ${firstDate} → ${lastDate} (${days.toFixed(0)} days)`);
  log(`  Total trades:  ${trades.length.toLocaleString()}`);
  log(`  Total USDC:    $${totalUsdc.toFixed(2)}`);
  log(`  Avg per trade: $${(totalUsdc / trades.length).toFixed(2)}`);
  log(`  Daily volume:  $${dailyUsdc.toFixed(2)}/day`);
  log();

  // ── Outcome breakdown ────────────────────────────────────────────────────────
  const byOutcome = {};
  for (const t of trades) {
    const o = (t.outcome || "unknown").toLowerCase();
    if (!byOutcome[o]) byOutcome[o] = { count: 0, usdc: 0 };
    byOutcome[o].count++;
    byOutcome[o].usdc += Number(t.usdcSize ?? 0);
  }
  log("── Outcome breakdown ───────────────────────────────────");
  for (const [o, d] of Object.entries(byOutcome).sort((a,b) => b[1].count - a[1].count)) {
    const pct = (d.count / trades.length * 100).toFixed(1);
    log(`  ${o.padEnd(10)} ${String(d.count).padStart(6)} trades (${pct}%)  $${d.usdc.toFixed(2)}`);
  }
  log();

  // ── Asset breakdown ──────────────────────────────────────────────────────────
  const byAsset = {};
  for (const t of trades) {
    const asset = t.title?.match(/\b(Bitcoin|BTC|Ethereum|ETH|Solana|SOL|XRP|Ripple)\b/i)?.[1]?.toUpperCase() || "OTHER";
    const a = asset === "BITCOIN" ? "BTC" : asset === "ETHEREUM" ? "ETH" : asset === "SOLANA" ? "SOL" : asset === "RIPPLE" ? "XRP" : asset;
    if (!byAsset[a]) byAsset[a] = { count: 0, usdc: 0 };
    byAsset[a].count++;
    byAsset[a].usdc += Number(t.usdcSize ?? 0);
  }
  log("── Asset breakdown ─────────────────────────────────────");
  for (const [a, d] of Object.entries(byAsset).sort((a,b) => b[1].count - a[1].count)) {
    const pct = (d.count / trades.length * 100).toFixed(1);
    log(`  ${a.padEnd(10)} ${String(d.count).padStart(6)} trades (${pct}%)  $${d.usdc.toFixed(2)}`);
  }
  log();

  // ── Price distribution (what prices does Bonereaper buy at?) ─────────────────
  const priceBuckets = { "0-0.20": 0, "0.20-0.35": 0, "0.35-0.50": 0, "0.50-0.65": 0, "0.65-0.80": 0, "0.80+": 0 };
  for (const t of trades) {
    const p = Number(t.price ?? 0);
    if      (p < 0.20) priceBuckets["0-0.20"]++;
    else if (p < 0.35) priceBuckets["0.20-0.35"]++;
    else if (p < 0.50) priceBuckets["0.35-0.50"]++;
    else if (p < 0.65) priceBuckets["0.50-0.65"]++;
    else if (p < 0.80) priceBuckets["0.65-0.80"]++;
    else               priceBuckets["0.80+"]++;
  }
  log("── Entry price distribution ────────────────────────────");
  for (const [b, c] of Object.entries(priceBuckets)) {
    const pct = (c / trades.length * 100).toFixed(1);
    const bar = "█".repeat(Math.round(c / trades.length * 30));
    log(`  ${b.padEnd(12)} ${bar.padEnd(30)} ${c} (${pct}%)`);
  }
  log();

  // ── Hour of day (ET) ─────────────────────────────────────────────────────────
  const hourly = Array(24).fill(0);
  for (const t of trades) {
    const h = (Math.floor(t.timestamp / 3600) % 24 - 4 + 24) % 24; // UTC → ET
    hourly[h]++;
  }
  const peakH = hourly.indexOf(Math.max(...hourly));
  log("── Hour of day (ET, 24h) ────────────────────────────────");
  for (let h = 0; h < 24; h++) {
    const bar = "█".repeat(Math.round(hourly[h] / Math.max(...hourly) * 25));
    const label = `${String(h).padStart(2)}:00`;
    if (hourly[h] > 0) log(`  ${label}  ${bar.padEnd(25)} ${hourly[h]}`);
  }
  log(`\n  Peak trading hour (ET): ${peakH}:00`);
  log();

  // ── Entry timing: seconds before window close ─────────────────────────────────
  // Window end time is embedded in the title e.g. "4:45PM-4:50PM ET"
  // We can't compute this without endDate — note if missing
  const withEnd = trades.filter(t => t.endDate || t.endTime);
  if (withEnd.length > 0) {
    const timingBuckets = { "0-30s": 0, "30-60s": 0, "60-90s": 0, "90s+": 0 };
    for (const t of withEnd) {
      const endTs = new Date(t.endDate ?? t.endTime).getTime() / 1000;
      const secsBefore = endTs - t.timestamp;
      if      (secsBefore <=  30) timingBuckets["0-30s"]++;
      else if (secsBefore <=  60) timingBuckets["30-60s"]++;
      else if (secsBefore <=  90) timingBuckets["60-90s"]++;
      else                        timingBuckets["90s+"]++;
    }
    log("── Entry timing (seconds before window close) ──────────");
    for (const [b, c] of Object.entries(timingBuckets)) {
      const pct = (c / withEnd.length * 100).toFixed(1);
      log(`  ${b.padEnd(10)} ${c} (${pct}%)`);
    }
  } else {
    log("── Entry timing: no endDate in activity records (need CLOB API for this)");
  }
  log();

  // ── Most traded markets ───────────────────────────────────────────────────────
  const byMarket = {};
  for (const t of trades) {
    const k = t.slug || t.conditionId || "unknown";
    if (!byMarket[k]) byMarket[k] = { count: 0, usdc: 0, title: t.title };
    byMarket[k].count++;
    byMarket[k].usdc += Number(t.usdcSize ?? 0);
  }
  log("── Top 15 most traded market types ─────────────────────");
  for (const [, d] of Object.entries(byMarket).sort((a,b) => b[1].count - a[1].count).slice(0, 15)) {
    const title = (d.title ?? "unknown").slice(0, 55);
    log(`  ${title.padEnd(55)} ${d.count} trades  $${d.usdc.toFixed(2)}`);
  }

  fs.writeFileSync(outFile, lines.join("\n"));
  console.log(`\nAnalysis saved to ${outFile}`);
}

(async () => {
  console.log(`\nScraping all trades for: ${WALLET}\n`);
  const trades = await fetchAllActivity(WALLET);

  fs.writeFileSync("bonereaper-all-trades.json", JSON.stringify(trades, null, 2));
  console.log(`Saved ${trades.length} trades to bonereaper-all-trades.json\n`);

  analyze(trades, "bonereaper-analysis.txt");
})();
