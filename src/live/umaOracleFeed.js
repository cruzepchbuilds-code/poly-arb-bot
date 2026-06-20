/**
 * UMA OptimisticOracleV2 settlement watcher (Polygon).
 *
 * When a Polymarket 5-min (or 10-min) crypto market expires, the UMA oracle
 * receives a ProposePrice call within ~30-120s. This gives us CERTAIN knowledge
 * of the winner before the CLOB has repriced — replacing the Binance-price proxy
 * used by the fallback OracleSnipe with 100% accurate settlement data.
 *
 * Polls Polygon via JSON-RPC every 10s for recent ProposePrice events.
 * Extracts: market endTimestamp + ancillaryData → side (UP or DOWN).
 *
 * No API key required. Uses POLYGON_RPC env var or public default.
 * UMA contract address overridable via UMA_OOV2_ADDRESS env var.
 *
 * Exports:
 *   startUmaFeed()             — begin polling
 *   stopUmaFeed()              — stop polling and destroy provider
 *   getUmaSettlement(asset, endMs) → { side, confirmedAt } | null
 */

import { ethers } from "ethers";

const POLYGON_RPC  = process.env.POLYGON_RPC        ?? "https://polygon-rpc.com";
const UMA_ADDRESS  = process.env.UMA_OOV2_ADDRESS   ?? "0xee3Afe347D5C74317041E2618C49534dAf887c24";
const POLL_MS      = 10_000;
const BLOCK_LOOKBACK = 15n; // ~30 seconds at Polygon's 2s block time

const PROPOSE_ABI = [{
  name: "ProposePrice",
  type: "event",
  inputs: [
    { name: "requester",           type: "address", indexed: true  },
    { name: "identifier",          type: "bytes32", indexed: true  },
    { name: "timestamp",           type: "uint256", indexed: false },
    { name: "ancillaryData",       type: "bytes",   indexed: false },
    { name: "proposer",            type: "address", indexed: false },
    { name: "proposedPrice",       type: "int256",  indexed: false },
    { name: "expirationTimestamp", type: "uint256", indexed: false },
    { name: "currency",            type: "address", indexed: false },
  ],
}];

const ASSET_KEYWORDS = {
  BTC:   ["btc", "bitcoin"],
  ETH:   ["eth", "ethereum"],
  SOL:   ["sol", "solana"],
  XRP:   ["xrp", "ripple"],
  DOGE:  ["doge", "dogecoin"],
  AVAX:  ["avax", "avalanche"],
  LINK:  ["link", "chainlink"],
  MATIC: ["matic", "polygon", "pol"],
};

function _detectAsset(text) {
  const lower = text.toLowerCase();
  for (const [asset, keywords] of Object.entries(ASSET_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return asset;
  }
  return null;
}

// [ { asset, endSec, side, confirmedAt } ]  — kept for 2 hours then evicted
const _settlements = [];
let _provider = null;
let _contract  = null;
let _lastBlock  = 0n;
let _timer      = null;
let _stopped    = false;

async function _poll() {
  if (_stopped) return;
  try {
    if (!_provider) {
      _provider = new ethers.JsonRpcProvider(POLYGON_RPC, 137, { staticNetwork: true });
      _contract  = new ethers.Contract(UMA_ADDRESS, PROPOSE_ABI, _provider);
    }
    const latest  = BigInt(await _provider.getBlockNumber());
    const fromBlk = _lastBlock > 0n ? _lastBlock + 1n : latest - BLOCK_LOOKBACK;
    _lastBlock    = latest;

    const logs = await _contract.queryFilter(
      _contract.filters.ProposePrice(),
      Number(fromBlk),
      Number(latest),
    );

    const now = Date.now();
    for (const log of logs) {
      const { timestamp, ancillaryData, proposedPrice } = log.args;
      const endSec = Number(timestamp);

      let question = "";
      try { question = ethers.toUtf8String(ancillaryData); } catch { continue; }

      const asset = _detectAsset(question);
      if (!asset) continue;

      // UMA binary prices: 1e18 = YES (UP resolves), 0 = NO (DOWN resolves)
      const side = BigInt(proposedPrice.toString()) >= 500_000_000_000_000_000n ? "UP" : "DOWN";

      // Avoid duplicates (same asset + same endSec)
      const exists = _settlements.some(s => s.asset === asset && s.endSec === endSec);
      if (!exists) {
        _settlements.push({ asset, endSec, side, confirmedAt: now });
        console.error(`[uma] ${asset} ${side} confirmed  endSec=${endSec}`);
      }
    }

    // Evict entries older than 2 hours
    const cutoff = now - 2 * 3_600_000;
    for (let i = _settlements.length - 1; i >= 0; i--) {
      if (_settlements[i].confirmedAt < cutoff) _settlements.splice(i, 1);
    }
  } catch { /* RPC hiccup — provider may reconnect automatically on next poll */ }

  if (!_stopped) _timer = setTimeout(_poll, POLL_MS);
}

export function startUmaFeed() {
  _stopped = false;
  _poll();
}

export function stopUmaFeed() {
  _stopped = true;
  clearTimeout(_timer);
  try { _provider?.destroy?.(); } catch { /* ignore */ }
  _provider = null;
  _contract  = null;
}

/**
 * Returns the UMA-confirmed settlement for a market, or null if not yet proposed.
 * Tolerance: ±150 seconds around market.endMs to handle clock/block variance.
 *
 * @param {string} asset  "BTC"|"ETH"|…
 * @param {number} endMs  market.endMs (milliseconds)
 */
export function getUmaSettlement(asset, endMs) {
  const endSec = endMs / 1000;
  const match  = _settlements.find(
    s => s.asset === asset && Math.abs(s.endSec - endSec) < 150,
  );
  return match ? { side: match.side, confirmedAt: match.confirmedAt } : null;
}

export function getUmaStats() {
  return { settlementCount: _settlements.length };
}
