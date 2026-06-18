import { fetchMarketById } from "../data/polymarket.js";

// Polls a target wallet every 1s and mirrors new BUY trades immediately.
// Set COPY_WALLET=0x... in your .env to activate.
export class CopyTrader {
  constructor() {
    this.wallet      = null;
    this.lastPoll    = null;
    this.error       = null;
    this.copied      = 0;
    this.skipped     = 0;
    this.recentCopies = [];   // last 5 copied trades for dashboard

    this._seen        = new Set();
    this._initialized = false;
    this._running     = false;
    this._timer       = null;

    // Set by init()
    this._getMarkets = null;  // () => market[]
    this._getActive  = null;  // () => Map
    this._getBalance = null;  // () => number
    this._onEntry    = null;  // async ({ market, side, tokenId, price, betSize }) => bool
  }

  init({ wallet, getMarkets, getActive, getBalance, onEntry }) {
    this.wallet      = wallet.toLowerCase();
    this._getMarkets = getMarkets;
    this._getActive  = getActive;
    this._getBalance = getBalance;
    this._onEntry    = onEntry;
  }

  start() {
    if (!this.wallet || this._timer) return;
    // Immediate first poll to seed seen-set, then every 1s
    this._poll();
    this._timer = setInterval(() => this._poll(), 1_000);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  async _poll() {
    if (this._running) return;
    this._running = true;
    try {
      const res = await fetch(
        `https://data-api.polymarket.com/activity?user=${this.wallet}&limit=20`,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(850),
        }
      );
      if (!res.ok) { this.error = `HTTP ${res.status}`; return; }

      const data    = await res.json();
      const records = Array.isArray(data) ? data : (data.data ?? []);
      this.lastPoll = Date.now();
      this.error    = null;

      // First poll: seed seen-set only — don't copy old trades
      if (!this._initialized) {
        for (const r of records) {
          if (r.transactionHash) this._seen.add(r.transactionHash);
        }
        this._initialized = true;
        return;
      }

      // Subsequent polls: find new BUY trades
      for (const r of records) {
        if (r.type !== "TRADE" || r.side !== "BUY") continue;
        const tx = r.transactionHash;
        if (!tx || this._seen.has(tx)) continue;
        this._seen.add(tx);
        this._copyTrade(r).catch(() => {});
      }
    } catch (e) {
      this.error = e.message?.slice(0, 50) ?? "timeout";
    } finally {
      this._running = false;
    }
  }

  async _copyTrade(r) {
    // Determine side from outcome field
    const outcome = (r.outcome || "").toLowerCase();
    const side    = (outcome === "up" || outcome === "yes") ? "UP" : "DOWN";

    // Find market — check our live list first, then fetch if missing
    let market = this._getMarkets().find(m => m.id === r.conditionId);
    if (!market) {
      market = await fetchMarketById(r.conditionId).catch(() => null);
    }
    if (!market) { this.skipped++; return; }

    const remaining = market.endMs - Date.now();
    if (remaining < 15_000) { this.skipped++; return; }   // < 15s left — skip
    if (this._getActive().has(market.id)) { this.skipped++; return; }

    // Size: match Bonereaper's dollar amount, capped at 20% of our balance
    const theirUsdc = Number(r.usdcSize ?? 5);
    const available = this._getBalance();
    const betSize   = Math.min(theirUsdc, available * 0.20);
    if (betSize < 1) { this.skipped++; return; }

    const price   = Number(r.price ?? 0.5);
    const tokenId = side === "UP" ? market.upTokenId : market.downTokenId;

    const entered = await this._onEntry({ market, side, tokenId, price, betSize });
    if (entered) {
      this.copied++;
      this.recentCopies.unshift({
        asset: market.asset, side, price,
        betSize, remainingS: Math.round(remaining / 1000),
        ts: Date.now(),
      });
      if (this.recentCopies.length > 5) this.recentCopies.pop();
    } else {
      this.skipped++;
    }
  }
}
