import { Side, OrderType, AssetType } from "@polymarket/clob-client";
import { createSecureClient, relayerApiKey, OrderSide } from "@polymarket/client";
import { fetchBalanceAllowance, cancelOrder as depositCancelOrder, fetchOrder as depositFetchOrder } from "@polymarket/client/actions";
import { privateKey } from "@polymarket/client/viem";
import { getClient, isDepositWallet } from "./client.js";

export const LIVE = process.env.LIVE_MODE === "true";
const SHARES = Number(process.env.TRADE_SHARES) || 10;
const PRICE_LIMIT = Number(process.env.PRICE_LIMIT) || 0.45;

// Deposit-wallet accounts (post-V2, signature_type 3 / POLY_1271) use the official
// @polymarket/client SDK instead of @polymarket/clob-client, which has no enum value
// for signature_type 3. The relayer API key registers this EOA as the deposit
// wallet's signer — without it, order placement fails with a signer/maker mismatch.
let _secureClient = null;
async function getSecureClient() {
  if (_secureClient) return _secureClient;
  const rawKey = process.env.PRIVATE_KEY;
  const pk = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  _secureClient = await createSecureClient({
    signer: privateKey(pk),
    apiKey: relayerApiKey({
      key: process.env.RELAYER_API_KEY,
      address: process.env.RELAYER_API_KEY_ADDRESS,
    }),
  });
  return _secureClient;
}

// Place a single limit BUY order. Returns { orderId, tokenId, side, price, size }
// In sim mode, returns a fake order object without touching the API.
export async function placeLimitBuy(tokenId, price = PRICE_LIMIT, size = SHARES) {
  if (!LIVE) {
    const fakeId = `SIM_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return { orderId: fakeId, tokenId, price, size, sim: true };
  }

  if (isDepositWallet()) {
    const secureClient = await getSecureClient();
    const response = await secureClient.placeLimitOrder({ tokenId, side: OrderSide.BUY, price, size });
    if (!response.ok) {
      throw new Error(`Order rejected: ${response.message ?? JSON.stringify(response)}`);
    }
    return { orderId: response.orderId, tokenId, price, size, sim: false };
  }

  const client = getClient();
  const feeRateBps = await client.getFeeRateBps(tokenId).catch(() => 0);
  const order = await client.createOrder({
    tokenID: tokenId,
    price,
    size,
    side: Side.BUY,
    feeRateBps,
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

  if (isDepositWallet()) {
    const secureClient = await getSecureClient();
    try {
      await depositCancelOrder(secureClient, { orderId });
    } catch { /* ignore cancel errors — order may already be filled */ }
    return;
  }

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

  if (isDepositWallet()) {
    const secureClient = await getSecureClient();
    try {
      const order = await depositFetchOrder(secureClient, { orderId });
      return {
        status: order?.status ?? "unknown",
        sizeFilled: Number(order?.size_matched ?? 0),
      };
    } catch {
      return null;
    }
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
  try {
    let raw;
    if (isDepositWallet()) {
      const secureClient = await getSecureClient();
      const b = await fetchBalanceAllowance(secureClient, { assetType: AssetType.COLLATERAL });
      raw = Number(b?.balance ?? 0);
    } else {
      const b = await getClient().getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
      raw = Number(b?.balance ?? 0);
    }
    return raw > 10_000 ? raw / 1e6 : raw;
  } catch (e) {
    console.error("[balance] getBalanceAllowance error:", e?.message ?? e);
    return null;
  }
}

export { SHARES, PRICE_LIMIT };
