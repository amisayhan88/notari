/**
 * POST /api/timestamp — lock a submission in on-chain.
 *
 * ORGANIZER-GATED for every status: teams submit, organizers lock in. The
 * caller must identify via x-organizer-address and be verified against the
 * event-registry contract for this submission's event.
 *
 * 1. Draft rows get their advisory similarity check auto-run here first —
 *    no submission can reach the chain without the advisory layer seeing it.
 * 2. Re-derives the canonical hash server-side from the stored submission
 *    (the client never chooses the hash).
 * 3. Uploads full metadata to IPFS (Pinata) or the labeled dev store.
 * 4. Calls submission-registry.record() via a sponsored transaction — the
 *    issuer signs and pays, so teams need no testnet XLM.
 *
 * If the contract rejects the hash as an exact same-event duplicate, that
 * rejection is TRUSTLESS and final. Advisory flags never block by
 * themselves — but they are visible to the organizer who triggers lock-in.
 */

import { NextResponse, type NextRequest } from "next/server";
import { canonicalHash } from "@/lib/stellar/canonicalize";
import {
  ContractCallError,
  ContractErrorCode,
  recordSubmission,
} from "@/lib/stellar/contracts";
import { getIssuer } from "@/lib/stellar/rpc";
import { uploadSubmissionMetadata } from "@/lib/ipfs";
import { getSubmissionByHash, updateSubmission } from "@/lib/submissions";
import { requireOrganizer } from "@/lib/api/auth";
import { checkSimilarity } from "@/lib/ai-similarity";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const hash = String(body.hash ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: "hash must be a 64-char sha256 hex" }, { status: 400 });
  }

  const row = await getSubmissionByHash(hash);
  if (!row) {
    return NextResponse.json({ error: "Unknown submission hash" }, { status: 404 });
  }
  if (row.status === "timestamped") {
    return NextResponse.json(
      { error: "Already timestamped on-chain", tx_hash: row.tx_hash, on_chain: row.on_chain },
      { status: 409 },
    );
  }
  if (row.status === "rejected") {
    return NextResponse.json(
      { error: "This submission was rejected by an organizer after review." },
      { status: 409 },
    );
  }

  // Timestamping is an organizer action in every case — verified on-chain.
  const auth = await requireOrganizer(req, row.event_id);
  if (!auth.ok) {
    return NextResponse.json(
      {
        error: `Lock-in requires an authorized organizer for "${row.event_id}": ${auth.error}`,
      },
      { status: 403 },
    );
  }

  // Never let a submission reach the chain without the advisory layer
  // having seen it: run the check now for drafts that skipped it.
  let similarityNote: string | null = null;
  if (row.status === "draft") {
    try {
      const result = await checkSimilarity({
        hash: row.submission_hash,
        eventId: row.event_id,
        teamWallet: row.team_wallet,
        repoUrl: row.repo_url,
        commitHash: row.commit_hash,
        description: row.description,
      });
      await updateSubmission(hash, {
        status: result.flagged ? "flagged" : "clean",
        similarity: { ...result, checked_at: new Date().toISOString() },
      });
      if (result.flagged) {
        similarityNote =
          "Note: the advisory similarity check flagged this submission during lock-in; the flag remains on record for transparency.";
      }
    } catch {
      // Advisory layer degraded (embeddings/db unavailable) — never a reason
      // to block an organizer's trustless lock-in; the row stays auditable.
      similarityNote =
        "Note: the advisory similarity check was unavailable at lock-in time.";
    }
  }

  // Server-side canonicalization — the hash is recomputed from stored data.
  const recomputed = canonicalHash({
    repoUrl: row.repo_url,
    commitHash: row.commit_hash,
    description: row.description,
    teamWallet: row.team_wallet,
  });
  if (recomputed !== row.submission_hash) {
    return NextResponse.json(
      { error: "Stored submission does not match its canonical hash" },
      { status: 500 },
    );
  }

  const metadata = {
    version: 1 as const,
    hash: row.submission_hash,
    eventId: row.event_id,
    teamWallet: row.team_wallet,
    repoUrl: row.repo_url,
    commitHash: row.commit_hash,
    description: row.description,
    recordedAt: new Date().toISOString(),
  };
  const upload = await uploadSubmissionMetadata(metadata);

  try {
    const { record, txHash } = await recordSubmission({
      eventSymbol: row.event_id,
      teamWallet: row.team_wallet,
      hashHex: row.submission_hash,
      metadataCid: upload.pointer,
    });

    const updated = await updateSubmission(hash, {
      status: "timestamped",
      metadata_pointer: upload.pointer,
      metadata_json: metadata,
      tx_hash: txHash,
      on_chain: { ...record, sponsored_by: getIssuer().publicKey() },
    });

    return NextResponse.json({
      hash,
      status: "timestamped",
      tx_hash: txHash,
      ledger: record.ledger,
      timestamp: record.timestamp,
      metadata_pointer: upload.pointer,
      metadata_provider: upload.provider,
      gateway_url: upload.gatewayUrl,
      verify_url: `/verify/${hash}`,
      note:
        "Recorded on-chain. Exact-duplicate rejection for this event is now enforced trustlessly by the contract." +
        (similarityNote ? ` ${similarityNote}` : ""),
      row: updated,
    });
  } catch (err) {
    if (err instanceof ContractCallError) {
      const status =
        err.code === ContractErrorCode.DuplicateSubmission ? 409 : 502;
      return NextResponse.json(
        { error: err.message, contract_error_code: err.code },
        { status },
      );
    }
    throw err;
  }
}
