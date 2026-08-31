/**
 * POST /api/review — organizer decision on an ADVISORY similarity flag.
 *
 * { hash, action: "clear" | "reject" | "approve_timestamp" }
 *
 * Gated by on-chain organizer check for the submission's event. This is the
 * human-in-the-loop half of the trustless/advisory split: the flag came from
 * AI similarity, the decision comes from a person.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireOrganizer } from "@/lib/api/auth";
import { getSubmissionByHash, updateSubmission } from "@/lib/submissions";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const hash = String(body.hash ?? "").trim().toLowerCase();
  const action = String(body.action ?? "").trim();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: "Invalid hash" }, { status: 400 });
  }
  if (!["clear", "reject", "approve_timestamp"].includes(action)) {
    return NextResponse.json(
      { error: "action must be clear | reject | approve_timestamp" },
      { status: 400 },
    );
  }

  const row = await getSubmissionByHash(hash);
  if (!row) {
    return NextResponse.json({ error: "Unknown submission hash" }, { status: 404 });
  }

  // Once a record is on-chain, the chain is the source of truth — app-layer
  // state changes (clear/reject/approve) no longer apply.
  if (row.status === "timestamped") {
    return NextResponse.json(
      {
        error:
          "Already timestamped on-chain — review actions are closed for this submission. Its provenance lives at /verify/" +
          hash,
        tx_hash: row.tx_hash,
      },
      { status: 409 },
    );
  }

  const auth = await requireOrganizer(req, row.event_id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  if (action === "clear") {
    const updated = await updateSubmission(hash, { status: "cleared" });
    return NextResponse.json({
      hash,
      status: "cleared",
      decided_by: auth.address,
      note: "Advisory flag dismissed by organizer. Submission may now be timestamped.",
      updated_at: updated?.updated_at,
    });
  }
  if (action === "reject") {
    const updated = await updateSubmission(hash, { status: "rejected" });
    return NextResponse.json({
      hash,
      status: "rejected",
      decided_by: auth.address,
      note: "Organizer rejected the submission after review. It cannot be timestamped now.",
      updated_at: updated?.updated_at,
    });
  }
  // approve_timestamp: advisory flag stays on record (transparency), but
  // the organizer's sign-off is persisted for auditability.
  const prevSimilarity = (row.similarity ?? {}) as Record<string, unknown>;
  const updated = await updateSubmission(hash, {
    status: "flagged",
    similarity: {
      ...prevSimilarity,
      approved_by: auth.address,
      approved_at: new Date().toISOString(),
    },
  });
  return NextResponse.json({
    hash,
    status: "flagged",
    approved_by: auth.address,
    note: "Organizer approved lock-in despite the advisory flag. Proceed with POST /api/timestamp.",
    updated_at: updated?.updated_at,
  });
}
