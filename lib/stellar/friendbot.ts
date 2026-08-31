import { Keypair } from "@stellar/stellar-sdk";

export interface SponsoredAccount {
  publicKey: string;
  secret: string;
  funded: boolean;
  note: string;
}

/**
 * Auto-generate a fresh testnet account and fund it via friendbot, so teams
 * without a wallet can still hold a verifiable team address. TESTNET ONLY —
 * guarded by the network env; this never runs against mainnet passphrases.
 *
 * The secret is returned ONCE for the team to save; it is never stored
 * server-side.
 */
export async function createSponsoredAccount(): Promise<SponsoredAccount> {
  const pass = process.env.SOROBAN_NETWORK_PASSPHRASE ?? "";
  if (!pass.includes("Test SDF Network")) {
    throw new Error("Sponsored accounts are testnet-only.");
  }
  const keypair = Keypair.random();
  let funded = false;
  try {
    const res = await fetch(
      `https://friendbot.stellar.org/?addr=${encodeURIComponent(keypair.publicKey())}`,
    );
    funded = res.ok;
  } catch {
    funded = false;
  }
  return {
    publicKey: keypair.publicKey(),
    secret: keypair.secret(),
    funded,
    note: funded
      ? "Account created and funded with testnet XLM via friendbot."
      : "Account created; friendbot funding failed — the issuer still sponsors submission recording, so this address works as a team identity.",
  };
}
