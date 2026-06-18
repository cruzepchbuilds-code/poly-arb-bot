export class PaperBook {
  constructor(startBalance = 1000) {
    this.startBalance = startBalance;
    this.balance = startBalance;
    this.openTrade = null;
    this.trades = [];
  }

  // Enter a paper trade. Returns true if accepted.
  enter({ side, entryPrice, shares, btcEntryPrice, windowEndMs, edge }) {
    if (this.openTrade) return false;
    const cost = entryPrice * shares;
    if (cost > this.balance) return false;

    this.balance -= cost;
    this.openTrade = {
      side,
      entryPrice,
      shares,
      btcEntryPrice,
      windowEndMs,
      edge,
      enteredAt: Date.now(),
    };
    return true;
  }

  // Resolve the open trade given current and entry BTC prices.
  // btcWentUp: did BTC close the window higher than it opened?
  resolve(btcExitPrice) {
    const t = this.openTrade;
    if (!t) return null;
    this.openTrade = null;

    const btcWentUp = btcExitPrice > t.btcEntryPrice;
    const won =
      (t.side === "UP" && btcWentUp) || (t.side === "DOWN" && !btcWentUp);

    // Binary payout: win => receive 1 per share; lose => receive 0
    const received = won ? t.shares * 1 : 0;
    this.balance += received;

    const pnl = received - t.entryPrice * t.shares;

    const closed = {
      ...t,
      btcExitPrice,
      btcWentUp,
      won,
      pnl,
      resolvedAt: Date.now(),
    };
    this.trades.push(closed);
    return closed;
  }

  get stats() {
    const n = this.trades.length;
    const wins = this.trades.filter((t) => t.won).length;
    const totalPnl = this.balance - this.startBalance;
    const avgEdge =
      n > 0
        ? this.trades.reduce((s, t) => s + (t.edge ?? 0), 0) / n
        : null;
    return {
      n,
      wins,
      winRate: n > 0 ? wins / n : null,
      totalPnl,
      avgEdge,
    };
  }

  // Last N closed trades, newest first
  recentTrades(n = 8) {
    return this.trades.slice(-n).reverse();
  }
}
