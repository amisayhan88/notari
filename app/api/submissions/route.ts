import { NextResponse, type NextRequest } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { canonicalHash } from "@/lib/stellar/canonicalize";
import {
  getSubmissionByHash,
  insertSubmission,
  listSubmissions,
} from "@/lib/submissions";
import { EVENT_ID_RE, requireOrganizer } from "@/lib/api/auth";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const repoUrl = String(body.repo_url ?? "").trim();
  const commitHash = String(body.commit_hash ?? "").trim();
  const description = String(body.description ?? "").trim();
  const eventId = String(body.event_id ?? "").trim();
  const teamWallet = String(body.team_wallet ?? "").trim().toUpperCase();

  const errors: string[] = [];
  if (!/^https:\/\/[^\s]+\.[^\s]+/.test(repoUrl)) errors.push("repo_url must be an https URL");
  if (!/^[0-9a-f]{7,40}$/i.test(commitHash)) errors.push("commit_hash must be a 7-40 char git commit hash");
  if (description.length < 20 || description.length > 5000)
    errors.push("description must be 20-5000 characters");
  if (!EVENT_ID_RE.test(eventId))
    errors.push("event_id must be 1-32 chars of a-z, A-Z, 0-9, _ (Soroban Symbol-safe)");
  if (!StrKey.isValidEd25519PublicKey(teamWallet))
    errors.push("team_wallet must be a valid Stellar public key");

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
  }

  const hash = canonicalHash({ repoUrl, commitHash, description, teamWallet });

  const existing = await getSubmissionByHash(hash);
  if (existing) {
    // Same canonical submission already in the app layer. The on-chain
    // contract would reject it for this event anyway (trustless), so surface
    // it early instead of burning a transaction.
    return NextResponse.json(
      {
        error:
          "A submission with this exact canonical hash already exists for this event. Exact-duplicate rejection is enforced on-chain regardless.",
        hash,
        existing_status: existing.status,
      },
      { status: 409 },
    );
  }

  const row = await insertSubmission({
    hash,
    eventId,
    teamWallet,
    repoUrl,
    commitHash,
    description,
  });

  return NextResponse.json(
    {
      hash,
      id: row.id,
      event_id: eventId,
      status: row.status,
      next: "POST /api/similarity with { hash } to run the advisory similarity check before lock-in",
    },
    { status: 201 },
  );
}

/**
 * List submissions. Organizer-gated: the caller must be an authorized
 * organizer for the requested event, verified against the event-registry
 * contract.
 */
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id") ?? "";
  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  if (!EVENT_ID_RE.test(eventId)) {
    return NextResponse.json({ error: "event_id query param required" }, { status: 400 });
  }
  const auth = await requireOrganizer(req, eventId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const rows = await listSubmissions({ eventId, status });
  return NextResponse.json({
    event_id: eventId,
    checked_organizer: auth.address,
    count: rows.length,
    submissions: rows,
  });
}
