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
  console.log("=== GAMMA API DIAGNOSTIC ===\n");

  // Test 1: Direct search for BTC 5-min markets
  console.log("--- Searching markets?active=true&limit=500 ---");
  const data = await fetchJson(`${GAMMA}/markets?active=true&limit=500`);
  if (!data) { console.log("FAILED to fetch markets"); }
  else {
    const markets = Array.isArray(data) ? data : (data.markets ?? []);
    console.log(`Total returned: ${markets.length}`);

    const updown = markets.filter(m => {
      const q = String(m.question || m.title || "").toLowerCase();
      return (q.includes("up or down") || q.includes("5m") || q.includes("5 min") || q.includes("5-min"));
    });
    console.log(`Up/down or 5-min matches: ${updown.length}`);
    for (const m of updown.slice(0, 5)) {
      console.log("\nMARKET:", m.question || m.title);
      console.log("  conditionId:", m.conditionId);
      console.log("  endDate:", m.endDate, "→", safeTimeMs(m.endDate), "now:", Date.now());
      console.log("  active:", m.active, "closed:", m.closed);
      console.log("  clobTokenIds:", JSON.stringify(m.clobTokenIds));
      console.log("  tokens:", JSON.stringify(m.tokens?.map(t => ({ outcome: t.outcome, token_id: t.token_id?.slice(0,10)+"..." }))));
      console.log("  outcomePrices:", m.outcomePrices);
    }
  }

  // Test 2: Events endpoint
  console.log("\n--- Searching events?active=true&limit=100 ---");
  const evData = await fetchJson(`${GAMMA}/events?active=true&limit=100`);
  if (!evData) { console.log("FAILED to fetch events"); }
  else {
    const events = Array.isArray(evData) ? evData : (evData.events ?? []);
    console.log(`Total events: ${events.length}`);
    const fiveMin = events.filter(e => {
      const q = String(e.title || e.slug || "").toLowerCase();
      return q.includes("5") && (q.includes("btc") || q.includes("bitcoin") || q.includes("crypto"));
    });
    console.log(`5-min crypto events: ${fiveMin.length}`);
    for (const e of fiveMin.slice(0, 3)) {
      console.log("\nEVENT:", e.title || e.slug);
      console.log("  id:", e.id);
      console.log("  markets count:", e.markets?.length);
      if (e.markets?.[0]) {
        const m = e.markets[0];
        console.log("  first market clobTokenIds:", JSON.stringify(m.clobTokenIds));
        console.log("  first market tokens:", JSON.stringify(m.tokens?.map(t => ({ outcome: t.outcome, token_id: t.token_id?.slice?.(0,10)+"..." }))));
        console.log("  first market endDate:", m.endDate);
        console.log("  first market active:", m.active);
      }
    }
  }

  // Test 3: Direct slug lookup
  console.log("\n--- Trying known slugs ---");
  const slugs = ["btc-up-or-down-5m", "btc-up-or-down-in-5-minutes", "bitcoin-up-or-down-5-min"];
  for (const slug of slugs) {
    const d = await fetchJson(`${GAMMA}/events?slug=${slug}`);
    if (d && (Array.isArray(d) ? d.length : d.events?.length)) {
      console.log(`FOUND via slug: ${slug}`);
      const events = Array.isArray(d) ? d : (d.events ?? []);
      const e = events[0];
      console.log("  markets:", e.markets?.length);
      const m = e.markets?.[0];
      if (m) {
        console.log("  clobTokenIds:", JSON.stringify(m.clobTokenIds));
        console.log("  endDate:", m.endDate);
      }
    } else {
      console.log(`Not found: ${slug}`);
    }
  }

  // Test 4: Search by tag
  console.log("\n--- Tag slug: crypto ---");
  const tagData = await fetchJson(`${GAMMA}/markets?active=true&limit=200&tag_slug=crypto`);
  if (tagData) {
    const ms = Array.isArray(tagData) ? tagData : (tagData.markets ?? []);
    console.log(`crypto tag returns: ${ms.length} markets`);
    const ud = ms.filter(m => String(m.question || "").toLowerCase().includes("up or down"));
    console.log(`up or down: ${ud.length}`);
    for (const m of ud.slice(0, 3)) {
      console.log("\n ", m.question);
      console.log("  endDate:", m.endDate, "expired:", safeTimeMs(m.endDate) < Date.now());
      console.log("  clobTokenIds:", JSON.stringify(m.clobTokenIds?.slice(0,2)));
    }
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
