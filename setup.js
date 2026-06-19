/**
 * One-time setup: derives Polymarket API credentials from your wallet
 * and writes them to .env.
 *
 * Usage:  node setup.js
 *
 * Requirements:
 *   1. Copy .env.example → .env
 *   2. Fill in PRIVATE_KEY (and POLY_PROXY_ADDRESS if applicable)
 *   3. Run this script once — it will fill in the POLY_* fields
 */

import { ClobClient, Chain, SignatureType } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "fs";

function loadEnv(path = ".env") {
  if (!existsSync(path)) {
    console.error(
      `\n.env not found. Copy .env.example → .env and fill in PRIVATE_KEY first.\n`
    );
    process.exit(1);
  }

  const lines = readFileSync(path, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
  }
  return { lines, env };
}

function updateEnvFile(path, updates) {
  let content = readFileSync(path, "utf8");
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`^(${key}=).*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, `$1${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  }
  writeFileSync(path, content, "utf8");
}

async function main() {
  console.log("\nPolymarket API Key Setup\n" + "─".repeat(40));

  const { env } = loadEnv();

  const rawKey = env.PRIVATE_KEY || "";
  if (!rawKey || rawKey === "your_private_key_here") {
    console.error("PRIVATE_KEY is not set in .env. Add your wallet private key first.");
    process.exit(1);
  }

  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });
  console.log(`Wallet address: ${account.address}`);

  const proxy = env.POLY_PROXY_ADDRESS || undefined;
  const sigType = proxy ? SignatureType.POLY_PROXY : SignatureType.EOA;

  const client = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    walletClient,
    undefined,
    sigType,
    proxy
  );

  console.log("Deriving API credentials from wallet signature...");

  let creds;
  try {
    creds = await client.createOrDeriveApiKey(0);
  } catch (e) {
    console.error(`\nFailed: ${e.message}`);
    console.error(
      "Make sure your wallet has been used on Polymarket at least once\n" +
      "(fund it and visit polymarket.com to accept terms)."
    );
    process.exit(1);
  }

  console.log("\nCredentials generated successfully.");
  console.log(`  API Key:     ${creds.key}`);
  console.log(`  Passphrase:  ${creds.passphrase}`);
  console.log(`  Secret:      ${creds.secret.slice(0, 8)}...`);

  updateEnvFile(".env", {
    POLY_API_KEY: creds.key,
    POLY_API_SECRET: creds.secret,
    POLY_PASSPHRASE: creds.passphrase,
  });

  console.log("\n.env updated with API credentials.");
  console.log("Next steps:");
  console.log("  1. Fund your Polymarket wallet with USDC (Polygon network)");
  console.log("  2. Make sure you have a small amount of MATIC for gas (~$2 worth)");
  console.log("  3. Set LIVE_MODE=true in .env when ready");
  console.log("  4. Run: npm run live\n");
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
