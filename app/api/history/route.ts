/**
 * GET /api/history?hash=<sha256> — public, read-only.
 *
 * Returns the ON-CHAIN provenance for a submission hash: every event it was
 * recorded under (trustless, from the submission-registry contract), merged
 * with any advisory similarity data the app layer has for those records.
 * This powers the public verification page.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionHistory } from "@/lib/stellar/contracts";
import { getSubmissionByHash } from "@/lib/submissions";

export async function GET(req: NextRequest) {
  const hash = (req.nextUrl.searchParams.get("hash") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json(
      { error: "hash must be a 64-char sha256 hex" },
      { status: 400 },
    );
  }

  const onChain = await getSubmissionHistory(hash);
  if (onChain.length === 0) {
    return NextResponse.json(
      {
        hash,
        found: false,
        records: [],
        note: "This hash has never been recorded on-chain.",
      },
      { status: 404 },
    );
  }

  const app = await getSubmissionByHash(hash);
  const similarity = (app?.similarity ?? null) as {
    flagged?: boolean;
    matches?: unknown[];
    explanation?: string;
  } | null;

  return NextResponse.json({
    hash,
    found: true,
    // A hash recorded under multiple events is the provenance shape the
    // verify page visualizes — same code submitted at several events.
    multi_event: onChain.length > 1,
    advisory_flagged: Boolean(similarity?.flagged),
    similarity,
    records: onChain.map((r) => ({
      event_id: r.eventId,
      team: r.team,
      recorded_by: r.recordedBy,
      metadata_cid: r.metadataCid,
      timestamp: r.timestamp,
      ledger: r.ledger,
    })),
    trustless_note:
      "These records come straight from the submission-registry contract on Soroban testnet. Exact-duplicate rejection (same hash, same event) is enforced by the contract and cannot be overridden.",
  });
}
