// Finds your correct Polymarket proxy address and checks balance
// Usage: node --env-file=/root/poly-arb-bot/.env scripts/check-proxy.mjs
import { ClobClient, Chain, SignatureType } from "@polymarket/clob-client";
import { AssetType } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const rawKey = process.env.PRIVATE_KEY;
const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: polygon, transport: http() });

const creds = {
  key: process.env.POLY_API_KEY,
  secret: process.env.POLY_API_SECRET,
  passphrase: process.env.POLY_PASSPHRASE,
};

console.log("EOA:", account.address);
console.log("POLY_PROXY_ADDRESS in .env:", process.env.POLY_PROXY_ADDRESS || "(not set)");

// Try with EOA mode (no proxy)
const eoaClient = new ClobClient("https://clob.polymarket.com", Chain.POLYGON, walletClient, creds, SignatureType.EOA);
try {
  const b = await eoaClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
  console.log("\nEOA balance:", b?.balance, "(raw:", JSON.stringify(b), ")");
} catch (e) { console.log("\nEOA balance check failed:", e.message); }

// Try with current proxy from .env
if (process.env.POLY_PROXY_ADDRESS) {
  const proxyClient = new ClobClient("https://clob.polymarket.com", Chain.POLYGON, walletClient, creds, SignatureType.POLY_PROXY, process.env.POLY_PROXY_ADDRESS);
  try {
    const b = await proxyClient.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    console.log("Proxy (.env) balance:", b?.balance, "(raw:", JSON.stringify(b), ")");
  } catch (e) { console.log("Proxy (.env) balance check failed:", e.message); }
}

// Fetch correct proxy from Polymarket API
try {
  const res = await fetch(`https://clob.polymarket.com/auth/api-key`, {
    headers: { "POLY_ADDRESS": account.address }
  });
  const data = await res.json();
  console.log("\nPolymarket API key info:", JSON.stringify(data));
} catch (e) { console.log("API info fetch failed:", e.message); }
