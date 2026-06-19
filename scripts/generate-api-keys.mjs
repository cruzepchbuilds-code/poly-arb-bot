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
console.log("Generating API credentials from wallet signature...\n");

const client = new ClobClient("https://clob.polymarket.com", Chain.POLYGON, walletClient);

try {
  const creds = await client.createApiKey();
  const key = creds.apiKey ?? creds.key ?? creds.api_key;
  const secret = creds.secret;
  const passphrase = creds.passphrase;
  if (!key) {
    console.log("Raw response:", JSON.stringify(creds, null, 2));
    process.exit(1);
  }
  console.log("Success! Add these to /root/poly-arb-bot/.env:\n");
  console.log(`POLY_API_KEY=${key}`);
  console.log(`POLY_API_SECRET=${secret}`);
  console.log(`POLY_PASSPHRASE=${passphrase}`);
  console.log("\nThen restart: pm2 restart poly-arb-sim");
} catch (e) {
  // Try deriveApiKey if createApiKey fails
  try {
    const creds = await client.deriveApiKey();
    const key = creds.apiKey ?? creds.key ?? creds.api_key;
    const secret = creds.secret;
    const passphrase = creds.passphrase;
    if (!key) {
      console.log("Raw response:", JSON.stringify(creds, null, 2));
      process.exit(1);
    }
    console.log("Success! Add these to /root/poly-arb-bot/.env:\n");
    console.log(`POLY_API_KEY=${key}`);
    console.log(`POLY_API_SECRET=${secret}`);
    console.log(`POLY_PASSPHRASE=${passphrase}`);
    console.log("\nThen restart: pm2 restart poly-arb-sim");
  } catch (e2) {
    console.error("Failed:", e2.message);
    console.error("\nCheck that PRIVATE_KEY is correct and you have internet access.");
  }
}
