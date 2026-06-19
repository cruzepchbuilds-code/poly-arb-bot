import { ClobClient, Chain, SignatureType } from "@polymarket/clob-client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";

let _client = null;

export function getClient() {
  if (_client) return _client;

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY not set in environment");

  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http(),
  });

  const creds =
    process.env.POLY_API_KEY
      ? {
          key: process.env.POLY_API_KEY,
          secret: process.env.POLY_API_SECRET,
          passphrase: process.env.POLY_PASSPHRASE,
        }
      : undefined;

  const proxy = process.env.POLY_PROXY_ADDRESS || undefined;
  const sigType = proxy ? SignatureType.POLY_PROXY : SignatureType.EOA;

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
  const key = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  return privateKeyToAccount(key).address;
}
