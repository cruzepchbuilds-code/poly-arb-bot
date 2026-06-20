export const CONFIG = {
  assets: ["BTC","ETH","SOL","XRP","DOGE","AVAX","LINK","MATIC","BNB","ADA","DOT","TRX","TON","SHIB","PEPE","UNI","ATOM","NEAR","APT","SUI","ARB","OP","INJ"],

  binanceBaseUrl: "https://api.binance.com",
  gammaBaseUrl:   "https://gamma-api.polymarket.com",
  clobBaseUrl:    "https://clob.polymarket.com",

  binanceSymbols: {
    BTC:  "BTCUSDT",
    ETH:  "ETHUSDT",
    SOL:  "SOLUSDT",
    XRP:  "XRPUSDT",
    DOGE: "DOGEUSDT",
    AVAX: "AVAXUSDT",
    LINK: "LINKUSDT",
    MATIC: "MATICUSDT",
    BNB:  "BNBUSDT",
    ADA:  "ADAUSDT",
    DOT:  "DOTUSDT",
    TRX:  "TRXUSDT",
    TON:  "TONUSDT",
    SHIB: "SHIBUSDT",
    PEPE: "PEPEUSDT",
    UNI:  "UNIUSDT",
    ATOM: "ATOMUSDT",
    NEAR: "NEARUSDT",
    APT:  "APTUSDT",
    SUI:  "SUIUSDT",
    ARB:  "ARBUSDT",
    OP:   "OPUSDT",
    INJ:  "INJUSDT",
  },

  combinedThreshold: Number(process.env.COMBINED_THRESHOLD) || 0.97,
  momentumMinPct: 0.0002,

  kellyFraction:    0.25,
  estimatedWinRate: 0.55,
  minBetUsdc:       1,
  maxBetPct:        0.08,

  maxTradeUsdc: Number(process.env.MAX_TRADE_USDC) || null,
  maxPositions: Number(process.env.MAX_POSITIONS) || 15,

  earlyExitMinPrice: 0.88,
  earlyExitMaxSecs:  25,

  polymarket: {
    btcSeriesSlugs:  ["btc-up-or-down-in-5-minutes","bitcoin-up-or-down-5-min","btc-5min-up-or-down","btc-updown-5m"],
    ethSeriesSlugs:  ["eth-up-or-down-in-5-minutes","ethereum-up-or-down-5-min","eth-5min-up-or-down","eth-updown-5m"],
    solSeriesSlugs:  ["sol-up-or-down-in-5-minutes","solana-up-or-down-5-min","sol-5min-up-or-down","sol-updown-5m"],
    xrpSeriesSlugs:  ["xrp-up-or-down-in-5-minutes","ripple-up-or-down-5-min","xrp-5min-up-or-down","xrp-updown-5m"],
    dogeSeriesSlugs: ["doge-up-or-down-in-5-minutes","dogecoin-up-or-down-5-min","doge-5min-up-or-down","doge-updown-5m"],
    avaxSeriesSlugs: ["avax-up-or-down-in-5-minutes","avalanche-up-or-down-5-min","avax-5min-up-or-down","avax-updown-5m"],
    linkSeriesSlugs: ["link-up-or-down-in-5-minutes","chainlink-up-or-down-5-min","link-5min-up-or-down","link-updown-5m"],
    maticSeriesSlugs:["matic-up-or-down-in-5-minutes","polygon-up-or-down-5-min","matic-5min-up-or-down","matic-updown-5m"],
  },

  indicators: {
    rsiPeriod: 14, macdFast: 12, macdSlow: 26, macdSignal: 9,
    klinesInterval: "1m", klinesLimit: 100, vwapSlopePoints: 5,
  },

  paper: { startBalance: Number(process.env.START_BALANCE) || 100, tradeShares: 10 },

  refreshMs: {
    klines: 10_000, scan: 30_000, clob: 3_000, display: 1_000,
    marketRefresh: 60_000, simSave: 30_000, priceSnap: 30_000,
  },
};
