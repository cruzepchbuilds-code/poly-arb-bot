// Run on VPS: node scripts/diagnose-markets.mjs
const GAMMA = "https://gamma-api.polymarket.com";
const CLOB  = "https://clob.polymarket.com";

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) { console.log(`HTTP ${res.status} for ${url}`); return null; }
    return res.json();
  } catch (e) { console.log(`FETCH ERROR ${url}: ${e.message}`); return null; }
}

function safeTimeMs(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

async function main() {
  console.log("=== DIAGNOSTIC v4 ===\n");
  const now = Date.now();

  // --- 1: CLOB with closed=false ---
  console.log("--- CLOB: closed=false ---");
  const clobActive = await fetchJson(`${CLOB}/markets?limit=500&closed=false`);
  const caMs = clobActive?.data ?? (Array.isArray(clobActive) ? clobActive : []);
  console.log(`closed=false returned: ${caMs.length}`);
  const caShort = caMs.filter(m => {
    const end = safeTimeMs(m.end_date_iso || m.endDate);
    return end && end > now && end < now + 6 * 60 * 60_000;
  });
  console.log(`Expiring within 6h: ${caShort.length}`);
  for (const m of caShort.slice(0, 10)) {
    const end = safeTimeMs(m.end_date_iso || m.endDate);
    const minsLeft = Math.round((end - now) / 60000);
    console.log(`  [${minsLeft}m] "${m.question?.slice(0, 70)}"`);
    console.log(`    tokens: ${m.tokens?.map(t => t.outcome).join(" / ")}`);
  }

  // --- 2: CLOB paginate to find newer markets ---
  console.log("\n--- CLOB: paginate with next_cursor ---");
  let cursor = "MA=="; // base64 of "0" - start cursor
  let page = 0;
  let foundActive = [];
  while (page < 5) {
    const d = await fetchJson(`${CLOB}/markets?limit=500&next_cursor=${cursor}`);
    if (!d) break;
    const ms = d.data ?? (Array.isArray(d) ? d : []);
    const nextCursor = d.next_cursor;
    const active = ms.filter(m => !m.closed && m.active);
    foundActive.push(...active);
    console.log(`  page ${page}: ${ms.length} markets, ${active.length} active, cursor=${nextCursor?.slice(0,20)}`);
    if (!nextCursor || nextCursor === cursor || ms.length < 500) break;
    cursor = nextCursor;
    page++;
  }
  console.log(`Total active found: ${foundActive.length}`);
  const shortActive = foundActive.filter(m => {
    const end = safeTimeMs(m.end_date_iso || m.endDate);
    return end && end > now && end < now + 6 * 60 * 60_000;
  });
  console.log(`Expiring within 6h: ${shortActive.length}`);
  for (const m of shortActive.slice(0, 5)) {
    const end = safeTimeMs(m.end_date_iso || m.endDate);
    console.log(`  [${Math.round((end-now)/60000)}m] "${m.question?.slice(0,70)}"`);
    console.log(`    tokens: ${m.tokens?.map(t => t.outcome+"/"+t.token_id?.slice(0,8)).join(" | ")}`);
  }

  // --- 3: Gamma events NO tag filter ---
  console.log("\n--- Gamma events NO tag filter ---");
  for (const offset of [0, 100, 200]) {
    const d = await fetchJson(`${GAMMA}/events?active=true&limit=100&offset=${offset}`);
    const evs = Array.isArray(d) ? d : (d?.events ?? []);
    const updown = evs.filter(e => {
      const t = String(e.title || e.slug || "").toLowerCase();
      return t.includes("up or down") || t.includes("up-or-down") || t.includes("5m") || t.includes("5-min");
    });
    console.log(`  offset=${offset}: ${evs.length} events, ${updown.length} up/down or 5m`);
    for (const e of updown.slice(0, 5)) {
      console.log(`    "${e.title}" slug=${e.slug} markets:${e.markets?.length}`);
      const m = e.markets?.find(mx => {
        const end = safeTimeMs(mx.endDate);
        return end && end > now;
      });
      if (m) {
        console.log(`    ACTIVE market: "${m.question?.slice(0,60)}" ends=${m.endDate}`);
        console.log(`    clobTokenIds: ${JSON.stringify(m.clobTokenIds)?.slice(0, 80)}`);
      }
    }
  }

  // --- 4: Gamma: search= param ---
  console.log("\n--- Gamma: search=btc ---");
  for (const q of ["btc up", "bitcoin up", "up or down", "5 minutes", "5m"]) {
    const d = await fetchJson(`${GAMMA}/markets?active=true&limit=100&search=${encodeURIComponent(q)}`);
    const ms = Array.isArray(d) ? d : (d?.markets ?? []);
    console.log(`  search="${q}": ${ms.length} results`);
    for (const m of ms.slice(0, 3)) {
      const end = safeTimeMs(m.endDate);
      const minsLeft = end ? Math.round((end - now) / 60000) : null;
      console.log(`    [${minsLeft}m] "${m.question?.slice(0,60)}" clobTokenIds:${!!m.clobTokenIds}`);
    }
  }

  // --- 5: Check data-api.polymarket.com ---
  console.log("\n--- data-api.polymarket.com ---");
  const dataApi = await fetchJson("https://data-api.polymarket.com/markets?limit=50&active=true");
  if (dataApi) {
    const ms = Array.isArray(dataApi) ? dataApi : (dataApi?.markets ?? dataApi?.data ?? []);
    console.log(`data-api returned: ${ms.length}`);
    const updown = ms.filter(m => String(m.question||"").toLowerCase().includes("up or down"));
    console.log(`up or down: ${updown.length}`);
    for (const m of updown.slice(0, 3)) {
      const end = safeTimeMs(m.endDate || m.end_date_iso);
      console.log(`  [${end ? Math.round((end-now)/60000)+"m" : "?"}] "${m.question?.slice(0,60)}"`);
    }
  }

  console.log("\n=== DONE ===");
}

main().catch(console.error);
