import { Keypair, rpc } from "@stellar/stellar-sdk";

let server: rpc.Server | null = null;

/** Public testnet constants — safe defaults, overridable via env. */
export function networkPassphrase(): string {
  return (
    process.env.SOROBAN_NETWORK_PASSPHRASE ||
    "Test SDF Network ; September 2015"
  );
}

export function getServer(): rpc.Server {
  if (!server) {
    const url = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
    server = new rpc.Server(url);
  }
  return server;
}

let issuer: Keypair | null = null;

/**
 * The issuer account signs and PAYS for every recording transaction, so
 * teams never need testnet XLM ("sponsored" flow). Testnet only — this key
 * only ever signs against the configured testnet network.
 */
export function getIssuer(): Keypair {
  if (!issuer) {
    const secret = process.env.ISSUER_SECRET_KEY;
    if (!secret) throw new Error("ISSUER_SECRET_KEY is not set");
    issuer = Keypair.fromSecret(secret);
  }
  return issuer;
}

export function contractIds(): {
  submissionRegistry: string;
  eventRegistry: string;
} {
  const submissionRegistry = process.env.SUBMISSION_REGISTRY_CONTRACT_ID;
  const eventRegistry = process.env.EVENT_REGISTRY_CONTRACT_ID;
  if (!submissionRegistry || !eventRegistry) {
    throw new Error(
      "SUBMISSION_REGISTRY_CONTRACT_ID / EVENT_REGISTRY_CONTRACT_ID are not set",
    );
  }
  return { submissionRegistry, eventRegistry };
}
