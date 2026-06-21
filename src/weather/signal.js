// Weather market edge calculation, Kelly sizing, and trade decision.
//
// Core thesis from empirical research on profitable weather traders:
//   edge = model_probability(outcome) − market_implied_probability(outcome)
//
// Filters before entering:
//   edge > 8%               (consensus threshold from documented bots)
//   spread < 4¢             (YES + NO should be close to $1)
//   volume > $1,000         (liquidity floor)
//   2h < time_to_close < 72h
//
// Sizing: fractional Kelly (0.25×) capped per trade.

import { clamp } from "../utils.js";

export const EDGE_THRESHOLD  = Number(process.env.WEATHER_EDGE_MIN)    || 0.08;
export const MAX_SPREAD      = Number(process.env.WEATHER_MAX_SPREAD)  || 0.04;
export const MIN_VOLUME      = Number(process.env.WEATHER_MIN_VOLUME)  || 1_000;
export const MIN_HOURS       = Number(process.env.WEATHER_MIN_HOURS)   || 2;
export const MAX_HOURS       = Number(process.env.WEATHER_MAX_HOURS)   || 72;
export const KELLY_FRACTION  = Number(process.env.WEATHER_KELLY)       || 0.25;
export const MAX_BET_USDC    = Number(process.env.WEATHER_MAX_BET)     || 50;
export const MIN_BET_USDC    = Number(process.env.WEATHER_MIN_BET)     || 2;

/**
 * Compute edge for a weather market given the model's probability estimate.
 *
 * @param {object} market  - parsed market from markets.js
 * @param {number} modelProb - ensemble probability (0–1) that YES resolves
 * @returns EdgeResult or null if filters exclude this market
 */
export function computeEdge(market, modelProb) {
  const { yesPrice, noPrice, volume, hoursToClose } = market;

  if (yesPrice == null || noPrice == null || modelProb == null) return null;

  // Liquidity filter
  if (volume < MIN_VOLUME) return null;

  // Time window filter
  if (hoursToClose < MIN_HOURS || hoursToClose > MAX_HOURS) return null;

  // Spread sanity — YES + NO should be close to $1 for a binary market
  const rawSum = yesPrice + noPrice;
  if (Math.abs(rawSum - 1.0) > MAX_SPREAD) return null;

  // Normalize to sum exactly to 1 (removes market-maker vig)
  const normYes = rawSum > 0 ? yesPrice / rawSum : yesPrice;
  const normNo  = rawSum > 0 ? noPrice  / rawSum : noPrice;

  const edgeYes = modelProb       - normYes; // positive → YES is underpriced
  const edgeNo  = (1 - modelProb) - normNo;  // positive → NO  is underpriced

  // Bucket-sum arb: if rawSum ≠ 1.0, there's riskless profit potential
  const sumArb = rawSum < 0.96 ? (1.0 - rawSum) : 0; // underpriced side advantage

  return {
    normYes,
    normNo,
    modelProb,
    edgeYes,
    edgeNo,
    sumArb,
    bestSide: edgeYes >= edgeNo ? "YES" : "NO",
    bestEdge: Math.max(edgeYes, edgeNo),
  };
}

/**
 * Decide whether to enter, and compute position size.
 *
 * @param {object} market
 * @param {object} edgeResult - from computeEdge()
 * @param {number} bankroll - available USDC
 * @returns Decision object
 */
export function decide(market, edgeResult, bankroll) {
  if (!edgeResult) return { action: "SKIP", reason: "no_edge_data" };

  const { bestEdge, bestSide, edgeYes, edgeNo, sumArb } = edgeResult;

  if (bestEdge < EDGE_THRESHOLD) {
    return {
      action: "SKIP",
      reason: `edge_${(bestEdge * 100).toFixed(1)}%_below_${(EDGE_THRESHOLD * 100).toFixed(0)}%`,
      edgeYes,
      edgeNo,
    };
  }

  const entryPrice = bestSide === "YES" ? market.yesPrice : market.noPrice;

  // Full Kelly fraction: f = (p*b - q) / b  where b = 1/price - 1, p = win_prob, q = 1-p
  // Simplified: f = edge / (1 - entryPrice)
  const fullKelly   = entryPrice > 0 && entryPrice < 1 ? bestEdge / (1 - entryPrice) : 0;
  const fracKelly   = fullKelly * KELLY_FRACTION;
  const betFraction = clamp(fracKelly, 0, 0.15); // never more than 15% of bankroll
  const betUsdc     = clamp(bankroll * betFraction, MIN_BET_USDC, MAX_BET_USDC);
  const shares      = entryPrice > 0 ? Math.floor(betUsdc / entryPrice) : 0;

  if (shares === 0) return { action: "SKIP", reason: "bet_too_small", edgeYes, edgeNo };

  const strength = bestEdge >= 0.20 ? "STRONG"
                 : bestEdge >= 0.12 ? "GOOD"
                 : "MARGINAL";

  return {
    action:     "ENTER",
    side:       bestSide,
    edge:       bestEdge,
    edgeYes,
    edgeNo,
    entryPrice,
    betUsdc,
    shares,
    strength,
    sumArb,
    tokenId:    bestSide === "YES" ? market.yesId : market.noId,
  };
}

/**
 * Check for pure bucket-sum arbitrage: when all YES prices for a city's daily
 * markets don't sum to ~1.0, the under/overpriced side is a risk-free entry.
 *
 * @param {object[]} sameEventMarkets - all buckets for one event
 * @returns { arb: boolean, direction: "YES"|"NO", magnitude: number } or null
 */
export function detectBucketSumArb(sameEventMarkets) {
  if (sameEventMarkets.length < 2) return null;
  const yesSum = sameEventMarkets.reduce((s, m) => s + (m.yesPrice ?? 0), 0);
  const deviation = Math.abs(yesSum - 1.0);
  if (deviation < 0.03) return null; // within normal spread

  return {
    arb:       true,
    direction: yesSum < 1.0 ? "YES" : "NO", // underpriced side
    yesSum,
    deviation,
  };
}
