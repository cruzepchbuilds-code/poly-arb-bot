/**
 * Cross-market logical arbitrage — ALL market types
 *
 * Finds pairs (A, B) where B logically implies A, making P(A) >= P(B) always.
 * When A_YES_ask + B_NO_ask < threshold → guaranteed profit in every scenario:
 *
 *   Case 1 (neither):  B_NO  = $1         →  profit
 *   Case 2 (A not B):  A_YES = $1, B_NO = $1  →  bigger profit
 *   Case 3 (both):     A_YES = $1         →  profit
 *   (B without A is LOGICALLY IMPOSSIBLE)
 *
 * Covered categories:
 *   • Crypto price levels       ($100k vs $120k for same asset+deadline)
 *   • Crypto percentage gains   (5% vs 10% for same asset+deadline)
 *   • Tournament/esports stages (quarters → semis → finals → win for same team)
 *   • Weather thresholds        (1 inch vs 2 inches in same location)
 *   • Vote share / polling      (50% vs 60% for same candidate)
 *   • Timing / deadline markets (by June 20 vs by June 30 for same event)
 */

import { placeLimitBuy, cancelOrder, getOrderStatus } from "../live/orders.js";

// ─── Stage rank table (higher number = harder to achieve = lower probability) ──

const STAGE_WORDS = new Map([
  // Championship / title
  ['win', 10], ['wins', 10], ['winner', 10], ['champion', 10], ['champions', 10],
  ['championship', 10], ['title', 10], ['crowned', 10], ['lift the trophy', 10],
  ['world champion', 10], ['mvp', 10],

  // Grand final
  ['grand final', 9], ['grand finals', 9],
  ['finals', 9], ['final', 9], ['top 2', 9], ['last 2', 9],

  // Final Four / semis
  ['final four', 8], ['elite eight', 8],
  ['semifinals', 8], ['semifinal', 8], ['semi-final', 8], ['semi finals', 8],
  ['semis', 8], ['top 4', 8], ['last 4', 8], ['f4', 8], ['top four', 8],

  // Quarters / Elite 8
  ['quarterfinals', 7], ['quarterfinal', 7], ['quarter-final', 7], ['quarter finals', 7],
  ['quarters', 7], ['top 8', 7], ['last 8', 7], ['elite 8', 7], ['elite eight', 7],

  // Round of 16
  ['round of 16', 6], ['last 16', 6], ['top 16', 6], ['r16', 6], ['sweet 16', 6],
  ['sweet sixteen', 6],

  // Round of 32
  ['round of 32', 5], ['last 32', 5], ['top 32', 5],

  // Playoffs / postseason
  ['playoffs', 4], ['playoff', 4], ['play-off', 4], ['play off', 4],
  ['postseason', 4], ['post season', 4], ['knockout stage', 4], ['knockout', 4],

  // Group stage / qualify
  ['qualify', 3], ['qualifies', 3], ['qualified', 3], ['advance', 3],
  ['advances', 3], ['group stage', 3], ['groups', 3], ['make it', 3],
  ['reach', 3], ['reaches', 3], ['progress', 3], ['pass', 3],
]);

// top-N reverse map: lower N = harder stage = higher rank
const TOP_N_RANK = { 2: 9, 3: 8, 4: 8, 5: 7, 6: 7, 8: 7, 10: 6, 12: 6, 16: 5, 24: 4, 32: 3, 64: 2 };

// ─── Crypto asset detection ───────────────────────────────────────────────────

const CRYPTO_KEYWORDS = [
  ['bitcoin', 'BTC'], ['btc', 'BTC'],
  ['ethereum', 'ETH'], ['eth', 'ETH'],
  ['solana', 'SOL'], ['sol', 'SOL'],
  ['ripple', 'XRP'], ['xrp', 'XRP'],
  ['dogecoin', 'DOGE'], ['doge', 'DOGE'],
  ['avalanche', 'AVAX'], ['avax', 'AVAX'],
  ['chainlink', 'LINK'], ['link', 'LINK'],
  ['polygon', 'MATIC'], ['matic', 'MATIC'],
  ['binancecoin', 'BNB'], ['bnb', 'BNB'],
  ['cardano', 'ADA'], ['ada', 'ADA'],
  ['polkadot', 'DOT'], ['dot', 'DOT'],
  ['tron', 'TRX'], ['trx', 'TRX'],
  ['toncoin', 'TON'], ['ton', 'TON'],
  ['shiba', 'SHIB'], ['shib', 'SHIB'],
  ['pepe', 'PEPE'],
  ['uniswap', 'UNI'], ['uni', 'UNI'],
  ['cosmos', 'ATOM'], ['atom', 'ATOM'],
  ['near', 'NEAR'],
  ['aptos', 'APT'], ['apt', 'APT'],
  ['sui', 'SUI'],
  ['arbitrum', 'ARB'], ['arb', 'ARB'],
  ['optimism', 'OP'], ['op', 'OP'],
  ['injective', 'INJ'], ['inj', 'INJ'],
];

function detectCryptoAsset(q) {
  for (const [kw, asset] of CRYPTO_KEYWORDS) {
    if (q.includes(kw)) return asset;
  }
  return null;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function parsePrice(text) {
  const m = text.match(/\$\s*([0-9][0-9,]*\.?[0-9]*)\s*([km]?)\b/i);
  if (!m) return null;
  let val = parseFloat(m[1].replace(/,/g, ''));
  const suffix = m[2].toLowerCase();
  if (suffix === 'k') val *= 1_000;
  if (suffix === 'm') val *= 1_000_000;
  return Number.isFinite(val) && val > 0 ? val : null;
}

function parseDeadlineKey(q) {
  const year  = (q.match(/\b(202[4-9]|203[0-9])\b/) ?? [])[1] ?? null;
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let month = null;
  for (let i = 0; i < MONTHS.length; i++) {
    if (q.includes(MONTHS[i])) { month = String(i + 1).padStart(2, '0'); break; }
  }
  if (!year && !month) return null;
  return `${year ?? '0000'}-${month ?? '00'}`;
}

function extractStageRank(q) {
  let best = null;
  // Check longest matches first to avoid "final" matching inside "quarterfinal"
  const sorted = [...STAGE_WORDS.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [kw, rank] of sorted) {
    if (q.includes(kw)) {
      if (best === null || rank > best.rank) best = { rank, kw };
    }
  }
  const topN = q.match(/\btop[\s-]?(\d+)\b/i);
  if (topN) {
    const n = parseInt(topN[1]);
    const r = TOP_N_RANK[n];
    if (r && (best === null || r > best.rank)) best = { rank: r, kw: `top_${n}` };
  }
  return best;
}

// Extract the team/entity from "Will [TEAM] win/reach/advance/..."
function extractTeam(q) {
  const m = q.match(/will\s+(.{2,40}?)\s+(?:win|reach|make|advance|qualify|finish|place|come|claim|lift|go|be\s+(?:the|a)|take)\b/i);
  if (!m) return null;
  return m[1].toLowerCase()
    .replace(/\b(the|a|an|its|their|his|her)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract major competition name
const TOURNAMENT_RE = /\b(world\s*cup|worlds?|major|msi|championship|premier\s*league|la\s*liga|bundesliga|serie\s*a|ligue\s*1|champions\s*league|europa\s*league|super\s*bowl|nfl|nba\s*finals|nba|mlb|nhl|ncaa|wimbledon|us\s*open|french\s*open|australian\s*open|grand\s*slam|masters|stanley\s*cup|vct|valorant|blast|esl|dreamhack|iem|katowice|cologne|pgl|lcs|lec|lck|lpl|rlcs|election|primary|senate|presidential|midterm)\b/i;

function extractTournament(q) {
  const m = q.match(TOURNAMENT_RE);
  return m ? m[0].toLowerCase().replace(/\s+/g, '_') : null;
}

// ─── Market categorization ────────────────────────────────────────────────────

/**
 * Categorize a market into a logical group.
 * Returns: { type, groupKey, rank, desc } or null.
 * rank: LOWER = more likely (this market should be A — buy its YES).
 */
function categorizeMarket(market) {
  const q = String(market.question || '').toLowerCase();

  // ── 1. Crypto price level (same asset, same deadline, different $ target) ──
  const asset = detectCryptoAsset(q);
  if (asset) {
    const price = parsePrice(q);
    if (price && price >= 0.001) {
      const deadline = parseDeadlineKey(q) ?? 'open';
      return {
        type: 'crypto_level',
        groupKey: `CL:${asset}:${deadline}`,
        rank: price,
        desc: `${asset} ≥$${price >= 1e6 ? (price/1e6).toFixed(1)+'M' : price >= 1000 ? (price/1000).toFixed(0)+'k' : price} by ${deadline}`,
      };
    }
    // Crypto percentage gain (5% vs 10% for same asset+deadline)
    const pctM = q.match(/\b(\d+\.?\d*)\s*%/);
    if (pctM) {
      const pct = parseFloat(pctM[1]);
      if (pct > 0 && pct < 500) {
        const deadline = parseDeadlineKey(q) ?? 'open';
        return {
          type: 'crypto_pct',
          groupKey: `CP:${asset}:${deadline}`,
          rank: pct,
          desc: `${asset} +${pct}% by ${deadline}`,
        };
      }
    }
  }

  // ── 2. Weather threshold (same type+location+unit+deadline, different amount) ──
  const WEATHER_RE = /\b(rain|rainfall|precipitation|snow|snowfall|temperature|hurricane|typhoon|flood|wind\s*speed?)\b.*?(\d+\.?\d*)\s*(inch(?:es)?|cm|mm|°?f\b|°?c\b|mph|km\/h)/i;
  const wM = q.match(WEATHER_RE);
  if (wM) {
    const wType  = wM[1].toLowerCase().replace(/\s+/g, '_');
    const thresh = parseFloat(wM[2]);
    const unit   = wM[3].toLowerCase().replace(/[°\s]/g, '').replace('inches','inch');
    const locM   = q.match(/\bin\s+([a-z]{3,20})/i);
    const loc    = locM ? locM[1].toLowerCase() : 'loc';
    const deadline = parseDeadlineKey(q) ?? 'open';
    return {
      type: 'weather',
      groupKey: `WX:${wType}:${loc}:${unit}:${deadline}`,
      rank: thresh,
      desc: `${wType} >${thresh}${unit} in ${loc} by ${deadline}`,
    };
  }

  // ── 3. Vote share / election / polling percentage ─────────────────────────
  const voteM = q.match(/(\d+\.?\d*)\s*%/);
  if (voteM && (q.includes('vote') || q.includes('poll') || q.includes('approval') || q.includes('support') || q.includes('share'))) {
    const pct  = parseFloat(voteM[1]);
    const team = extractTeam(q);
    const deadline = parseDeadlineKey(q) ?? 'open';
    if (team && team.length >= 2) {
      return {
        type: 'vote_share',
        groupKey: `VS:${team.slice(0, 30)}:${deadline}`,
        rank: pct,
        desc: `${team.slice(0, 20)} >${pct}% by ${deadline}`,
      };
    }
  }

  // ── 4. Tournament / esports bracket stage (same team + competition) ────────
  const stage = extractStageRank(q);
  if (stage) {
    const team       = extractTeam(q);
    const tournament = extractTournament(q);
    if (team && team.length >= 2 && tournament) {
      return {
        type: 'tournament',
        groupKey: `TR:${team.slice(0, 30)}:${tournament}`,
        rank: stage.rank,
        desc: `${team.slice(0, 20)} | ${stage.kw} | ${tournament}`,
      };
    }
  }

  // ── 5. Timing / deadline markets (same event, different cutoff date) ───────
  const deadline3 = parseDeadlineKey(q);
  if (deadline3) {
    const stripped = q
      .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b/gi, '')
      .replace(/\b(202[4-9]|203[0-9])\b/g, '')
      .replace(/\b\d{1,2}(?:st|nd|rd|th)?\b/g, '')
      .replace(/\b(by|before|until|end\s+of|through|prior\s+to)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Skip very short / crypto-resolved events (handled by category 1 above)
    if (stripped.length >= 12 && !detectCryptoAsset(stripped)) {
      const epochMs  = new Date(`${deadline3}-01`).getTime() || 0;
      const eventKey = stripped.slice(0, 45).replace(/\s+/g, '_');
      return {
        type: 'timing',
        groupKey: `TM:${eventKey}`,
        rank: -epochMs,   // later deadline → more negative → lower rank → more likely (A)
        desc: `${stripped.slice(0, 30)} by ${deadline3}`,
      };
    }
  }

  return null;
}

// ─── Public: find logical arb pairs ──────────────────────────────────────────

/**
 * Scan a list of markets and return all logical arb pairs.
 * Each pair: { marketA (more likely), marketB (less likely), type, groupKey, pairDesc }
 * Trade structure: buy A_YES (marketA.upTokenId) + B_NO (marketB.downTokenId)
 */
export function findLogicalPairs(markets) {
  const now = Date.now();
  const categorized = [];

  for (const market of markets) {
    if (!market.question || !market.upTokenId || !market.downTokenId) continue;
    if (market.endMs - now < 60_000) continue; // skip < 1 min to expiry
    const cat = categorizeMarket(market);
    if (!cat) continue;
    categorized.push({ market, ...cat });
  }

  // Group by logical cluster key
  const groups = new Map();
  for (const entry of categorized) {
    if (!groups.has(entry.groupKey)) groups.set(entry.groupKey, []);
    groups.get(entry.groupKey).push(entry);
  }

  const pairs = [];
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.rank - b.rank); // ascending: lower rank = more likely

    // Generate ordered pairs (i < j → A more likely than B)
    // Limit to j <= i+3 to avoid combinatorial explosion in large groups
    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length && j <= i + 4; j++) {
        const a = entries[i]; // more likely → buy YES
        const b = entries[j]; // less likely → buy NO
        if (b.rank <= a.rank) continue;
        if (a.market.id === b.market.id) continue;
        pairs.push({
          marketA:  a.market,
          marketB:  b.market,
          type:     a.type,
          groupKey: a.groupKey,
          pairDesc: `${a.desc} ≥ ${b.desc}`,
        });
      }
    }
  }

  return pairs;
}

// ─── CrossArbPosition ─────────────────────────────────────────────────────────

const _LIVE = process.env.LIVE_MODE === 'true';

export class CrossArbPosition {
  constructor({ id, marketA, marketB, aAsk, bNoAsk, shares, pairDesc }) {
    this.id        = id;
    this.type      = 'crossarb';
    this.marketA   = marketA;
    this.marketB   = marketB;
    this.aAsk      = aAsk;
    this.bNoAsk    = bNoAsk;
    this.combined  = aAsk + bNoAsk;
    this.shares    = shares;
    this.totalSpent       = shares * (aAsk + bNoAsk);
    this.guaranteedProfit = shares * (1 - this.combined);
    this.enteredAt = Date.now();
    this.pairDesc  = pairDesc;

    this.aOrder      = null;
    this.bNoOrder    = null;
    this.aFilled     = false;
    this.bNoFilled   = false;
    this.aSizeFilled   = 0;
    this.bNoSizeFilled = 0;
    this.log = [];
  }

  get latestEndMs() { return Math.max(this.marketA.endMs, this.marketB.endMs); }
  get expired()     { return Date.now() >= this.latestEndMs; }

  async enter() {
    this._log(
      `XARB enter: ${this.pairDesc}  ` +
      `A@${this.aAsk.toFixed(3)} + B_NO@${this.bNoAsk.toFixed(3)} ` +
      `= ${this.combined.toFixed(3)} × ${this.shares} shr ` +
      `= $${this.totalSpent.toFixed(2)} → lock +$${this.guaranteedProfit.toFixed(2)}`
    );

    const [aRes, bRes] = await Promise.allSettled([
      placeLimitBuy(this.marketA.upTokenId,  this.aAsk,   this.shares),
      placeLimitBuy(this.marketB.downTokenId, this.bNoAsk, this.shares),
    ]);

    if (aRes.status === 'fulfilled') {
      this.aOrder = aRes.value;
      this._log(`A_YES [${this.aOrder.orderId}]`);
    } else { this._log(`A_YES failed: ${aRes.reason?.message}`); }

    if (bRes.status === 'fulfilled') {
      this.bNoOrder = bRes.value;
      this._log(`B_NO  [${this.bNoOrder.orderId}]`);
    } else { this._log(`B_NO failed: ${bRes.reason?.message}`); }

    return !!(this.aOrder || this.bNoOrder);
  }

  async tick() {
    if (this.aOrder && !this.aFilled) {
      const s = await getOrderStatus(this.aOrder.orderId).catch(() => null);
      if (s) {
        this.aSizeFilled = Math.max(this.aSizeFilled, s.sizeFilled ?? 0);
        if (s.status === 'matched' || (this.shares && this.aSizeFilled >= this.shares)) {
          this.aFilled = true; this._log('A_YES FILLED');
        }
      }
    }
    if (this.bNoOrder && !this.bNoFilled) {
      const s = await getOrderStatus(this.bNoOrder.orderId).catch(() => null);
      if (s) {
        this.bNoSizeFilled = Math.max(this.bNoSizeFilled, s.sizeFilled ?? 0);
        if (s.status === 'matched' || (this.shares && this.bNoSizeFilled >= this.shares)) {
          this.bNoFilled = true; this._log('B_NO FILLED');
        }
      }
    }
  }

  async cancelAll() {
    if (this.aOrder   && !this.aFilled)   { await cancelOrder(this.aOrder.orderId).catch(() => {}); this._log('Cancelled A_YES'); }
    if (this.bNoOrder && !this.bNoFilled) { await cancelOrder(this.bNoOrder.orderId).catch(() => {}); this._log('Cancelled B_NO'); }
  }

  get summary() {
    return {
      id: this.id, type: this.type,
      assetA: this.marketA.asset, assetB: this.marketB.asset,
      questionA: (this.marketA.question ?? '').slice(0, 70),
      questionB: (this.marketB.question ?? '').slice(0, 70),
      pairDesc: this.pairDesc,
      aAsk: this.aAsk, bNoAsk: this.bNoAsk, combined: this.combined,
      shares: this.shares, totalSpent: this.totalSpent,
      guaranteedProfit: this.guaranteedProfit,
      aFilled: this.aFilled, bNoFilled: this.bNoFilled,
      aSizeFilled: this.aSizeFilled, bNoSizeFilled: this.bNoSizeFilled,
      expired: this.expired, latestEndMs: this.latestEndMs,
      enteredAt: this.enteredAt, log: [...this.log],
    };
  }

  _log(msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.log.push(`[${ts}] ${msg}`);
    if (this.log.length > 20) this.log.shift();
  }
}
