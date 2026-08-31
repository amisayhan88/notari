/**
 * Backend-to-contract calls.
 *
 * TRUSTLESS: recordSubmission is the on-chain timestamp. If the contract
 * rejects (exact duplicate in the same event, unauthorized organizer) that
 * rejection is final — this layer only relays it.
 */

import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  scValToNative,
  StrKey,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { contractIds, getIssuer, getServer, networkPassphrase } from "./rpc";

export interface OnChainRecord {
  hash: string;
  eventId: string;
  team: string;
  metadataCid: string;
  recordedBy: string;
  timestamp: number;
  ledger: number;
}

/** Soroban contract errors (mirror contracts/submission-registry). */
export const ContractErrorCode = {
  NotAuthorizedOrganizer: 3,
  DuplicateSubmission: 4,
} as const;

export class ContractCallError extends Error {
  code: number | null;
  constructor(message: string, code: number | null = null) {
    super(message);
    this.code = code;
  }
}

function submissionRegistry(): Contract {
  return new Contract(contractIds().submissionRegistry);
}

function eventRegistry(): Contract {
  return new Contract(contractIds().eventRegistry);
}

async function issuerAccount() {
  const issuer = getIssuer();
  return getServer().getAccount(issuer.publicKey());
}

function toRecord(raw: Record<string, unknown>): OnChainRecord {
  const bytesToHex = (v: unknown) =>
    v instanceof Uint8Array ? Buffer.from(v).toString("hex") : String(v);
  return {
    hash: bytesToHex(raw.hash),
    eventId: String(raw.event_id),
    team: String(raw.team),
    metadataCid: String(raw.metadata_cid),
    recordedBy: String(raw.recorded_by),
    timestamp: Number(raw.timestamp),
    ledger: Number(raw.ledger),
  };
}

async function simulateRead(
  contract: Contract,
  method: string,
  ...args: xdr.ScVal[]
): Promise<unknown> {
  const issuer = getIssuer();
  const account = await getServer().getAccount(issuer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await getServer().simulateTransaction(tx);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
    return scValToNative(sim.result.retval);
  }
  const detail = rpc.Api.isSimulationError(sim) ? sim.error : "unknown failure";
  throw new ContractCallError(
    `Simulation failed for ${method}: ${detail}`,
    parseErrorCode(detail),
  );
}

/** Pull `#N` contract error codes out of RPC error strings. */
function parseErrorCode(text: string): number | null {
  const m = text.match(/#(\d+)/);
  return m ? Number(m[1]) : null;
}

/**
 * Record a submission on-chain. The issuer pays the fee (teams need no XLM).
 * Throws ContractCallError with code DuplicateSubmission when the contract
 * rejects an exact same-event duplicate — TRUSTLESS rejection.
 */
export async function recordSubmission(params: {
  eventSymbol: string;
  teamWallet: string;
  hashHex: string;
  metadataCid: string;
}): Promise<{ record: OnChainRecord; txHash: string }> {
  const issuer = getIssuer();
  if (!StrKey.isValidEd25519PublicKey(params.teamWallet)) {
    throw new ContractCallError("team wallet is not a valid Stellar address");
  }
  const hashBuf = Buffer.from(params.hashHex, "hex");
  if (hashBuf.length !== 32) {
    throw new ContractCallError("submission hash must be 32 bytes (sha256 hex)");
  }

  const account = await issuerAccount();
  const op = submissionRegistry().call(
    "record",
    Address.fromString(issuer.publicKey()).toScVal(),
    nativeToScVal(params.eventSymbol, { type: "symbol" }),
    Address.fromString(params.teamWallet).toScVal(),
    nativeToScVal(hashBuf),
    nativeToScVal(params.metadataCid, { type: "string" }),
  );

  // Simulate first: surfaces contract rejections (e.g. exact-duplicate)
  // with the error code before we spend a transaction, and produces the
  // resource data the assembled envelope needs.
  const simTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const sim = await getServer().simulateTransaction(simTx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const detail = rpc.Api.isSimulationError(sim) ? sim.error : "simulation failed";
    const code = parseErrorCode(detail ?? "");
    throw new ContractCallError(
      code === ContractErrorCode.DuplicateSubmission
        ? "Exact duplicate rejected on-chain: this submission hash is already recorded for this event."
        : code === ContractErrorCode.NotAuthorizedOrganizer
          ? "The issuer is not an authorized organizer for this event (on-chain check)."
          : `Contract rejected the record call: ${detail}`,
      code,
    );
  }

  // Assemble the envelope WITH simulated Soroban resource data, then sign.
  const tx = rpc.assembleTransaction(simTx, sim).build();
  tx.sign(issuer);

  const sent = await getServer().sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new ContractCallError(
      `sendTransaction rejected: ${sent.errorResult ? JSON.stringify(sent.errorResult) : "unknown"}`,
    );
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await getServer().getTransaction(sent.hash);
    if (status.status === "SUCCESS") {
      const raw = status.returnValue
        ? scValToNative(status.returnValue)
        : undefined;
      if (!raw || typeof raw !== "object") {
        throw new ContractCallError("Transaction succeeded but returned no record");
      }
      return {
        record: toRecord(raw as Record<string, unknown>),
        txHash: sent.hash,
      };
    }
    if (status.status === "FAILED") {
      // The simulate pre-check makes this rare (race only); relay faithfully.
      throw new ContractCallError(
        "Transaction failed on-chain after passing simulation — the contract's rejection is final.",
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new ContractCallError("Timed out waiting for transaction confirmation");
}

/** Read every on-chain record for a hash, across all events. */
export async function getSubmissionHistory(hashHex: string): Promise<OnChainRecord[]> {
  const raw = await simulateRead(
    submissionRegistry(),
    "get_submission_history",
    nativeToScVal(Buffer.from(hashHex, "hex")),
  );
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((r) => toRecord(r as Record<string, unknown>));
}

/** Read all on-chain records for a team wallet. */
export async function getSubmissionsByTeam(team: string): Promise<OnChainRecord[]> {
  if (!StrKey.isValidEd25519PublicKey(team)) return [];
  const raw = await simulateRead(
    submissionRegistry(),
    "get_submissions_by_team",
    Address.fromString(team).toScVal(),
  );
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((r) => toRecord(r as Record<string, unknown>));
}

/** On-chain organizer check — the RBAC source of truth for dashboard access. */
export async function isAuthorizedOrganizer(
  eventSymbol: string,
  organizer: string,
): Promise<boolean> {
  if (!StrKey.isValidEd25519PublicKey(organizer)) return false;
  const raw = await simulateRead(
    eventRegistry(),
    "is_authorized_organizer",
    nativeToScVal(eventSymbol, { type: "symbol" }),
    Address.fromString(organizer).toScVal(),
  );
  return raw === true;
}

/** Read the organizer list for an event (dashboard display). */
export async function getOrganizers(eventSymbol: string): Promise<string[]> {
  const raw = await simulateRead(
    eventRegistry(),
    "get_organizers",
    nativeToScVal(eventSymbol, { type: "symbol" }),
  );
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((a) => String(a));
}

/** Read the event-registry admin (demo-grade admin gating for API routes). */
export async function getEventRegistryAdmin(): Promise<string> {
  const raw = await simulateRead(eventRegistry(), "get_admin");
  return String(raw);
}

/** Admin-only (issuer-signed): grant organizer authority for an event. */
export async function addOrganizer(eventSymbol: string, organizer: string): Promise<string> {
  return adminInvoke("add_organizer", eventSymbol, organizer);
}

/** Admin-only (issuer-signed): revoke organizer authority for an event. */
export async function removeOrganizer(eventSymbol: string, organizer: string): Promise<string> {
  return adminInvoke("remove_organizer", eventSymbol, organizer);
}

/**
 * Register a NEW event on-chain (issuer-signed sponsored flow).
 * The issuer is the event-registry admin, so it may install any organizer.
 */
export async function createEvent(
  eventSymbol: string,
  name: string,
  firstOrganizer: string,
): Promise<{ txHash: string; createdAt: number }> {
  const issuer = getIssuer();
  if (!StrKey.isValidEd25519PublicKey(firstOrganizer)) {
    throw new ContractCallError("Invalid organizer address");
  }
  const account = await issuerAccount();
  const op = eventRegistry().call(
    "create_event",
    Address.fromString(issuer.publicKey()).toScVal(),
    nativeToScVal(eventSymbol, { type: "symbol" }),
    nativeToScVal(name, { type: "string" }),
    Address.fromString(firstOrganizer).toScVal(),
  );
  const simTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const sim = await getServer().simulateTransaction(simTx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const detail = rpc.Api.isSimulationError(sim) ? sim.error : "simulation failed";
    const code = parseErrorCode(detail ?? "");
    throw new ContractCallError(
      code === 5
        ? `Event "${eventSymbol}" already exists on-chain.`
        : `Contract rejected create_event: ${detail}`,
      code,
    );
  }
  const tx = rpc.assembleTransaction(simTx, sim).build();
  tx.sign(issuer);
  const sent = await getServer().sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new ContractCallError(
      `sendTransaction rejected: ${sent.errorResult ? JSON.stringify(sent.errorResult) : "unknown"}`,
    );
  }
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await getServer().getTransaction(sent.hash);
    if (status.status === "SUCCESS") {
      const raw = status.returnValue ? scValToNative(status.returnValue) : undefined;
      const createdAt = Number((raw as Record<string, unknown>)?.created_at ?? 0);
      return { txHash: sent.hash, createdAt };
    }
    if (status.status === "FAILED") {
      throw new ContractCallError("Transaction failed on-chain (create_event)");
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new ContractCallError("Timed out waiting for transaction confirmation");
}

export interface EventInfoView {
  eventId: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

/** Read event metadata; null when the event doesn't exist on-chain. */
export async function getEvent(eventSymbol: string): Promise<EventInfoView | null> {
  try {
    const raw = await simulateRead(
      eventRegistry(),
      "get_event",
      nativeToScVal(eventSymbol, { type: "symbol" }),
    );
    const r = raw as Record<string, unknown>;
    return {
      eventId: String(r.event_id),
      name: String(r.name),
      createdBy: String(r.created_by),
      createdAt: Number(r.created_at),
    };
  } catch {
    return null;
  }
}

/** All registered event ids, on-chain, in creation order. */
export async function getEvents(): Promise<string[]> {
  const raw = await simulateRead(eventRegistry(), "get_events");
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((s) => String(s));
}

/** All on-chain records for an event (chain-native event page). */
export async function getEventSubmissions(eventSymbol: string): Promise<OnChainRecord[]> {
  const raw = await simulateRead(
    submissionRegistry(),
    "get_event_submissions",
    nativeToScVal(eventSymbol, { type: "symbol" }),
  );
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((r) => toRecord(r as Record<string, unknown>));
}

async function adminInvoke(
  method: "add_organizer" | "remove_organizer",
  eventSymbol: string,
  organizer: string,
): Promise<string> {
  const issuer = getIssuer();
  if (!StrKey.isValidEd25519PublicKey(organizer)) {
    throw new ContractCallError("Invalid organizer address");
  }
  const account = await issuerAccount();
  const op = eventRegistry().call(
    method,
    Address.fromString(issuer.publicKey()).toScVal(),
    nativeToScVal(eventSymbol, { type: "symbol" }),
    Address.fromString(organizer).toScVal(),
  );
  const simTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const sim = await getServer().simulateTransaction(simTx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    const detail = rpc.Api.isSimulationError(sim) ? sim.error : "simulation failed";
    throw new ContractCallError(`Contract rejected ${method}: ${detail}`);
  }
  const tx = rpc.assembleTransaction(simTx, sim).build();
  tx.sign(issuer);
  const sent = await getServer().sendTransaction(tx);
  if (sent.status === "ERROR") {
    throw new ContractCallError(
      `sendTransaction rejected: ${sent.errorResult ? JSON.stringify(sent.errorResult) : "unknown"}`,
    );
  }
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const status = await getServer().getTransaction(sent.hash);
    if (status.status === "SUCCESS") return sent.hash;
    if (status.status === "FAILED") {
      throw new ContractCallError(`Transaction failed on-chain (${method})`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new ContractCallError("Timed out waiting for transaction confirmation");
}
