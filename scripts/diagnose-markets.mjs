// Run on VPS: node scripts/diagnose-markets.mjs
// Shows exactly what the Gamma API returns for 5-min crypto markets

const GAMMA = "https://gamma-api.polymarket.com";

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
  console.log("=== GAMMA API DIAGNOSTIC v2 ===\n");

  // Show what the 100 markets actually ARE
  console.log("--- What are the 100 markets? (first 10 questions) ---");
  const d100 = await fetchJson(`${GAMMA}/markets?active=true&limit=100`);
  const m100 = Array.isArray(d100) ? d100 : (d100?.markets ?? []);
  for (const m of m100.slice(0, 10)) {
    const end = safeTimeMs(m.endDate);
    const mins = end ? Math.round((end - Date.now()) / 60000) : null;
    console.log(` "${m.question?.slice(0, 70)}" ends in ${mins}m`);
  }

  // Test pagination with offset
  console.log("\n--- Paginating: offset 0, 100, 200, 300, 400 ---");
  for (const offset of [0, 100, 200, 300, 400]) {
    const data = await fetchJson(`${GAMMA}/markets?active=true&limit=100&offset=${offset}`);
    const ms = Array.isArray(data) ? data : (data?.markets ?? []);
    const ud = ms.filter(m => String(m.question || "").toLowerCase().includes("up or down"));
    console.log(`  offset=${offset}: ${ms.length} markets, ${ud.length} up/down`);
    if (ud.length > 0) {
      for (const m of ud.slice(0, 3)) {
        console.log(`    FOUND: "${m.question?.slice(0,60)}" endDate=${m.endDate}`);
        console.log(`    clobTokenIds: ${JSON.stringify(m.clobTokenIds)}`);
      }
    }
    if (ms.length < 100) { console.log("  (reached end of results)"); break; }
  }

  // Try text search
  console.log("\n--- Text search: ?question=up+or+down ---");
  const searchData = await fetchJson(`${GAMMA}/markets?active=true&limit=100&question=up+or+down`);
  const searchMs = Array.isArray(searchData) ? searchData : (searchData?.markets ?? []);
  console.log(`Results: ${searchMs.length}`);
  for (const m of searchMs.slice(0, 5)) {
    console.log(` "${m.question?.slice(0,70)}" clobTokenIds: ${!!m.clobTokenIds}`);
  }

  // Try fetching events with pagination
  console.log("\n--- Events pagination ---");
  for (const offset of [0, 100]) {
    const data = await fetchJson(`${GAMMA}/events?active=true&limit=100&offset=${offset}`);
    const evs = Array.isArray(data) ? data : (data?.events ?? []);
    console.log(`  offset=${offset}: ${evs.length} events`);
    const crypto5 = evs.filter(e => {
      const t = String(e.title || e.slug || "").toLowerCase();
      return (t.includes("btc") || t.includes("bitcoin") || t.includes("crypto") || t.includes("eth")) &&
             (t.includes("5") || t.includes("up") || t.includes("down"));
    });
    console.log(`  crypto 5-min events: ${crypto5.length}`);
    for (const e of crypto5.slice(0, 5)) {
      console.log(`  EVENT: "${e.title || e.slug}"`);
      console.log(`    markets: ${e.markets?.length}`);
      const m = e.markets?.[0];
      if (m) {
        console.log(`    first market: "${m.question}" endDate=${m.endDate}`);
        console.log(`    clobTokenIds: ${JSON.stringify(m.clobTokenIds)}`);
      }
    }
  }

  // Try CLOB API for token lookup
  console.log("\n--- CLOB API: /markets endpoint ---");
  const clobData = await fetchJson("https://clob.polymarket.com/markets?limit=50&active=true");
  const clobMs = Array.isArray(clobData) ? clobData : (clobData?.data ?? []);
  console.log(`CLOB markets returned: ${clobMs.length}`);
  const clobUD = clobMs.filter(m => {
    const q = String(m.question || m.description || "").toLowerCase();
    return q.includes("up or down") || (q.includes("btc") && q.includes("5"));
  });
  console.log(`CLOB up/down or btc-5: ${clobUD.length}`);
  for (const m of clobUD.slice(0, 3)) {
    console.log(` "${m.question?.slice(0,60)}"`);
    console.log(`  tokens: ${JSON.stringify(m.tokens?.map(t => t.token_id?.slice(0,10)))}`);
  }

  // Try the strapi / data API
  console.log("\n--- Strapi API ---");
  const strapiData = await fetchJson("https://strapi-matic.poly.market/markets?is_active=true&_limit=50&category=Crypto&market_type=yesno");
  console.log(`Strapi result: ${JSON.stringify(strapiData)?.slice(0,200)}`);

  console.log("\n=== DONE ===");
}

main().catch(console.error);
