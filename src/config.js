export const CONFIG = {
  // Assets to trade — mirrors spiralgalaxy (BTC + ETH 5-min markets)
  assets: ["BTC", "ETH"],

  binanceBaseUrl: "https://api.binance.com",
  gammaBaseUrl: "https://gamma-api.polymarket.com",
  clobBaseUrl: "https://clob.polymarket.com",

  // 5-minute window config
  windowMinutes: 5,

  // Arbitrage entry: only enter when YES + NO combined < this threshold
  // spiralgalaxy's best trades were at 0.54. Start conservative at 0.85
  // and tighten once you confirm it's working.
  combinedThreshold: Number(process.env.COMBINED_THRESHOLD) || 0.85,

  // Max USDC to commit per market (both sides combined)
  maxTradeUsdc: Number(process.env.MAX_TRADE_USDC) || 100,

  // Polymarket series slugs for 5-min markets
  polymarket: {
    btcSeriesSlugs: [
      "btc-up-or-down-in-5-minutes",
      "bitcoin-up-or-down-5-min",
      "btc-5min-up-or-down",
    ],
    ethSeriesSlugs: [
      "eth-up-or-down-in-5-minutes",
      "ethereum-up-or-down-5-min",
      "eth-5min-up-or-down",
    ],
  },

  // TA indicators (kept for the paper trader / signal display)
  indicators: {
    rsiPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    klinesInterval: "1m",
    klinesLimit: 100,
    vwapSlopePoints: 5,
  },

  paper: {
    startBalance: 1000,
    tradeShares: 10,
  },

  refreshMs: {
    klines: 10_000,
    scan: 5_000,      // how often to scan for new arbitrage opportunities
    clob: 3_000,      // how often to refresh prices on open positions
    display: 1_000,
  },
};
