// Run on VPS: node scripts/diagnose-markets.mjs
const GAMMA = "https://gamma-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) { console.log(`HTTP ${res.status} for ${url}`); return null; }
  return res.json();
}

function safeTimeMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

async function main() {
  console.log("=== DIAGNOSTIC v3 ===\n");
  const now = Date.now();

  // --- CLOB: find short-duration markets (expire < 2h from now) ---
  console.log("--- CLOB: short-duration markets (expire within 2h) ---");
  const clob1 = await fetchJson(`${CLOB}/markets?limit=500`);
  const clobMs = clob1?.data ?? (Array.isArray(clob1) ? clob1 : []);
  console.log(`CLOB returned: ${clobMs.length} markets`);

  // Show structure of first market
  if (clobMs[0]) {
    console.log("\nFirst CLOB market fields:", Object.keys(clobMs[0]).join(", "));
    console.log("Sample:", JSON.stringify({
      question: clobMs[0].question,
      condition_id: clobMs[0].condition_id,
      end_date_iso: clobMs[0].end_date_iso,
      active: clobMs[0].active,
      closed: clobMs[0].closed,
      tokens: clobMs[0].tokens?.map(t => ({ outcome: t.outcome, token_id: t.token_id?.slice(0,12) })),
    }, null, 2));
  }

  const short = clobMs.filter(m => {
    const end = safeTimeMs(m.end_date_iso || m.endDate || m.end_date);
    return end && end > now && end < now + 2 * 60 * 60_000;
  });
  console.log(`\nExpires within 2h: ${short.length}`);
  for (const m of short.slice(0, 10)) {
    const end = safeTimeMs(m.end_date_iso || m.endDate);
    const minsLeft = end ? Math.round((end - now) / 60000) : null;
    console.log(`  [${minsLeft}m left] "${m.question?.slice(0,70)}"`);
    console.log(`    tokens: ${m.tokens?.map(t => t.outcome).join(" / ")}`);
    console.log(`    condition_id: ${m.condition_id}`);
  }

  // --- Gamma: try limit=1000 ---
  console.log("\n--- Gamma: limit=1000 ---");
  const g1000 = await fetchJson(`${GAMMA}/markets?active=true&limit=1000`);
  const gMs = Array.isArray(g1000) ? g1000 : (g1000?.markets ?? []);
  console.log(`Gamma limit=1000 returned: ${gMs.length}`);

  // --- Gamma: try specific category params ---
  console.log("\n--- Gamma: tag_slug variations ---");
  for (const tag of ["crypto", "bitcoin", "btc", "5-min", "5min", "short"]) {
    const d = await fetchJson(`${GAMMA}/markets?active=true&limit=100&tag_slug=${tag}`);
    const ms = Array.isArray(d) ? d : (d?.markets ?? []);
    const ud = ms.filter(m => {
      const q = String(m.question || "").toLowerCase();
      return q.includes("up or down") || q.includes("higher or lower") || (q.includes("btc") && q.includes("5"));
    });
    console.log(`  tag_slug=${tag}: ${ms.length} markets, ${ud.length} up/down/5min`);
  }

  // --- Gamma: look for short-duration markets by endDate ---
  console.log("\n--- Gamma: markets expiring within 1h ---");
  const allG = [];
  for (const offset of [0, 100, 200, 300, 400]) {
    const d = await fetchJson(`${GAMMA}/markets?active=true&limit=100&offset=${offset}`);
    const ms = Array.isArray(d) ? d : (d?.markets ?? []);
    allG.push(...ms);
    if (ms.length < 100) break;
  }
  const shortG = allG.filter(m => {
    const end = safeTimeMs(m.endDate);
    return end && end > now && end < now + 60 * 60_000;
  });
  console.log(`Markets expiring within 1h: ${shortG.length}`);
  for (const m of shortG.slice(0, 5)) {
    const end = safeTimeMs(m.endDate);
    const minsLeft = Math.round((end - now) / 60000);
    console.log(`  [${minsLeft}m] "${m.question?.slice(0,70)}"`);
    console.log(`    clobTokenIds: ${JSON.stringify(m.clobTokenIds)}`);
  }

  // --- Try Gamma events with crypto tag ---
  console.log("\n--- Gamma events with tag_slug=crypto ---");
  const evCrypto = await fetchJson(`${GAMMA}/events?active=true&limit=100&tag_slug=crypto`);
  const evMs = Array.isArray(evCrypto) ? evCrypto : (evCrypto?.events ?? []);
  console.log(`Events returned: ${evMs.length}`);
  const shortEv = evMs.filter(e => {
    const t = String(e.title || "").toLowerCase();
    return t.includes("5") || t.includes("btc") || t.includes("bitcoin");
  });
  console.log(`BTC/5min events: ${shortEv.length}`);
  for (const e of shortEv.slice(0, 5)) {
    console.log(`  "${e.title}" markets:${e.markets?.length}`);
    const m = e.markets?.[0];
    if (m) console.log(`    first: "${m.question?.slice(0,60)}" clobTokenIds:${JSON.stringify(m.clobTokenIds?.slice(0,1))?.slice(0,30)}...`);
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
