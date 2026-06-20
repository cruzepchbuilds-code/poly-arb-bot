import { ClobClient, Chain, SignatureType } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

let _client = null;
let _signer = null;

// POLY_PROXY_ADDRESS holds funds for both proxy flavors Polymarket uses:
// browser-wallet signups (MetaMask, etc.) get a Gnosis Safe -> POLY_GNOSIS_SAFE,
// email/magic-link signups get a Polymarket-managed proxy -> POLY_PROXY.
// Override with POLY_SIGNATURE_TYPE=PROXY if you signed up via email/magic-link.
// POLY_SIGNATURE_TYPE=DEPOSIT_WALLET is for post-V2 accounts (signature_type 3 /
// POLY_1271) — these use @polymarket/client (see orders.js) instead of getClient().
function resolveSignatureType(proxy) {
  if (!proxy) return SignatureType.EOA;
  const t = (process.env.POLY_SIGNATURE_TYPE || "GNOSIS_SAFE").toUpperCase();
  return t.includes("PROXY") ? SignatureType.POLY_PROXY : SignatureType.POLY_GNOSIS_SAFE;
}

export function isDepositWallet() {
  return (process.env.POLY_SIGNATURE_TYPE || "").toUpperCase() === "DEPOSIT_WALLET";
}

function buildSigner() {
  if (_signer) return _signer;

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY not set in environment");

  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(privateKey);
  _signer = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });
  return _signer;
}

function buildCreds() {
  return process.env.POLY_API_KEY
    ? {
        key: process.env.POLY_API_KEY,
        secret: process.env.POLY_API_SECRET,
        passphrase: process.env.POLY_PASSPHRASE,
      }
    : undefined;
}

export function getClient() {
  if (_client) return _client;

  const walletClient = buildSigner();
  const creds = buildCreds();
  const proxy = process.env.POLY_PROXY_ADDRESS || undefined;
  const sigType = resolveSignatureType(proxy);

  _client = new ClobClient(
    "https://clob.polymarket.com",
    Chain.POLYGON,
    walletClient,
    creds,
    sigType,
    proxy
  );

  return _client;
}

export function walletAddress() {
  const rawKey = process.env.PRIVATE_KEY || "";
  if (!rawKey) return null;
  try {
    const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
    return privateKeyToAccount(key).address;
  } catch { return null; }
}
