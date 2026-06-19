// Run once to generate POLY_API_KEY / POLY_API_SECRET / POLY_PASSPHRASE
// Usage: node --env-file=/root/poly-arb-bot/.env scripts/generate-api-keys.mjs
import { ClobClient, Chain } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

const rawKey = process.env.PRIVATE_KEY;
if (!rawKey) { console.error("PRIVATE_KEY not set in .env"); process.exit(1); }

const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const account = privateKeyToAccount(privateKey);
const walletClient = createWalletClient({ account, chain: polygon, transport: http() });

console.log(`Wallet: ${account.address}`);

// Create client with no credentials (L1 auth only)
const client = new ClobClient("https://clob.polymarket.com", Chain.POLYGON, walletClient);

function printCreds(creds) {
  const key = creds?.apiKey ?? creds?.key ?? creds?.api_key;
  const secret = creds?.secret;
  const passphrase = creds?.passphrase;
  if (key && secret && passphrase) {
    console.log("\nAdd these to /root/poly-arb-bot/.env:\n");
    console.log(`POLY_API_KEY=${key}`);
    console.log(`POLY_API_SECRET=${secret}`);
    console.log(`POLY_PASSPHRASE=${passphrase}`);
    console.log("\nThen: pm2 restart poly-arb-sim");
    return true;
  }
  return false;
}

// Try createOrDeriveApiKey first (handles both new and existing accounts)
console.log("\nAttempting createOrDeriveApiKey...");
try {
  const creds = await client.createOrDeriveApiKey();
  if (printCreds(creds)) process.exit(0);
  console.log("Raw:", JSON.stringify(creds));
} catch (e) { console.log("createOrDeriveApiKey failed:", e.message); }

// Try deriveApiKey
console.log("\nAttempting deriveApiKey...");
try {
  const creds = await client.deriveApiKey();
  if (printCreds(creds)) process.exit(0);
  console.log("Raw:", JSON.stringify(creds));
} catch (e) { console.log("deriveApiKey failed:", e.message); }

// Try createApiKey with nonce 0
console.log("\nAttempting createApiKey(0)...");
try {
  const creds = await client.createApiKey(0);
  if (printCreds(creds)) process.exit(0);
  console.log("Raw:", JSON.stringify(creds));
} catch (e) { console.log("createApiKey(0) failed:", e.message); }

// Try getApiKeys to see existing keys
console.log("\nAttempting getApiKeys...");
try {
  const keys = await client.getApiKeys();
  console.log("getApiKeys raw:", JSON.stringify(keys));
} catch (e) { console.log("getApiKeys failed:", e.message); }

console.log("\nAll methods failed. Check that PRIVATE_KEY is correct.");
