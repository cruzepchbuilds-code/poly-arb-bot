// Run on VPS: node scripts/diagnose-markets.mjs
// Tests the slug-based discovery that the bot now uses

const GAMMA = "https://gamma-api.polymarket.com";
const ASSET_PREFIXES = {
  BTC: ["btc"], ETH: ["eth"], SOL: ["sol"], XRP: ["xrp"],
  DOGE: ["doge"], AVAX: ["avax"], LINK: ["link"], MATIC: ["matic", "pol"],
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) { return null; }
    return res.json();
  } catch { return null; }
}

async function main() {
  const nowSec = Math.floor(Date.now() / 1000);
  const currentEnd = Math.ceil(nowSec / 300) * 300 || (Math.floor(nowSec / 300) + 1) * 300;
  const windows = [currentEnd, currentEnd + 300, currentEnd + 600];

  console.log(`Now: ${new Date().toISOString()}`);
  console.log(`Windows to check: ${windows.map(w => new Date(w * 1000).toISOString()).join(", ")}\n`);

  let found = 0;
  for (const [asset, prefixes] of Object.entries(ASSET_PREFIXES)) {
    for (const prefix of prefixes) {
      for (const w of windows) {
        const slug = `${prefix}-updown-5m-${w}`;
        const data = await fetchJson(`${GAMMA}/events?slug=${slug}`);
        const events = Array.isArray(data) ? data : (data ? [data] : []);
        for (const ev of events) {
          if (!ev?.markets?.length) continue;
          const m = ev.markets[0];
          let ids = m.clobTokenIds;
          if (typeof ids === "string") try { ids = JSON.parse(ids); } catch { ids = []; }
          const upId   = Array.isArray(ids) ? ids[0] : null;
          const downId = Array.isArray(ids) ? ids[1] : null;
          const endMs  = new Date(m.endDate || w * 1000).getTime();
          const minsLeft = Math.round((endMs - Date.now()) / 60000);
          console.log(`FOUND: ${slug}`);
          console.log(`  question: ${m.question}`);
          console.log(`  endDate: ${m.endDate}  (${minsLeft}m left)`);
          console.log(`  upTokenId:   ${String(upId).slice(0,20)}...`);
          console.log(`  downTokenId: ${String(downId).slice(0,20)}...`);
          found++;
        }
      }
    }
  }

  console.log(`\nTotal markets found: ${found}`);
}

main().catch(console.error);
