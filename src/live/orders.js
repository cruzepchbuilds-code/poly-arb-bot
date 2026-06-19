import { Side, OrderType } from "@polymarket/clob-client";
import { getClient } from "./client.js";

export const LIVE = process.env.LIVE_MODE === "true";
const SHARES = Number(process.env.TRADE_SHARES) || 10;
const PRICE_LIMIT = Number(process.env.PRICE_LIMIT) || 0.45;

// Place a single limit BUY order. Returns { orderId, tokenId, side, price, size }
// In sim mode, returns a fake order object without touching the API.
export async function placeLimitBuy(tokenId, price = PRICE_LIMIT, size = SHARES) {
  if (!LIVE) {
    const fakeId = `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return { orderId: fakeId, tokenId, price, size, sim: true };
  }

  const client = getClient();
  const order = await client.createOrder({
    tokenID: tokenId,
    price,
    size,
    side: Side.BUY,
    feeRateBps: 0,
    nonce: 0,
    expiration: 0,
  });

  const resp = await client.postOrder(order, OrderType.GTC);
  if (!resp?.orderID) {
    throw new Error(`Order rejected: ${JSON.stringify(resp)}`);
  }

  return { orderId: resp.orderID, tokenId, price, size, sim: false };
}

// Cancel an order by ID
export async function cancelOrder(orderId) {
  if (!orderId || orderId.startsWith("SIM_")) return;
  const client = getClient();
  try {
    await client.cancelOrder({ orderID: orderId });
  } catch { /* ignore cancel errors — order may already be filled */ }
}

// Fetch live order status. Returns null if not found.
// status: 'live' | 'matched' | 'cancelled' | 'expired' | unknown
export async function getOrderStatus(orderId) {
  if (!orderId || orderId.startsWith("SIM_")) {
    // Simulate a random fill after a few seconds
    const age = Date.now() - Number(orderId?.split("_")[1] ?? 0);
    if (age > 8_000 && Math.random() < 0.6) return { status: "matched", sizeFilled: SHARES };
    return { status: "live", sizeFilled: 0 };
  }

  const client = getClient();
  try {
    const order = await client.getOrder(orderId);
    return {
      status: order?.status ?? "unknown",
      sizeFilled: Number(order?.size_matched ?? 0),
    };
  } catch {
    return null;
  }
}

// Get USDC balance (returns null on failure or in sim mode)
export async function getUsdcBalance() {
  if (!LIVE) return null;
  const client = getClient();
  try {
    const b = await client.getBalanceAllowance();
    const raw = Number(b?.balance ?? 0);
    // clob-client returns a normalized string like "100.00" — not raw micro-USDC
    // If the value looks like raw micro-USDC (>10 000), divide by 1e6; otherwise use as-is
    return raw > 10_000 ? raw / 1e6 : raw;
  } catch {
    return null;
  }
}

export { SHARES, PRICE_LIMIT };
