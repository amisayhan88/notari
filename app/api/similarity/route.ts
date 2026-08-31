/**
 * POST /api/similarity — ADVISORY cross-event similarity check.
 *
 * Runs the submission's description through the embedding + pgvector
 * pipeline and returns any flagged historical matches with an explanation.
 * The result is stored for the organizer dashboard. This endpoint can NEVER
 * reject a submission — it only flags. Exact-hash duplicates are a separate
 * mechanism enforced on-chain.
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkSimilarity } from "@/lib/ai-similarity";
import { getSubmissionByHash, updateSubmission } from "@/lib/submissions";

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
    return NextResponse.json(
      { error: "Unknown submission hash. Create it first via POST /api/submissions." },
      { status: 404 },
    );
  }

  // The advisory layer must degrade gracefully, never hard-fail the
  // submission flow (e.g. embeddings provider outage, embedding dimension
  // mismatch in pgvector after a model swap). The check can be re-run from
  // the dashboard at any time.
  try {
    const result = await checkSimilarity({
      hash: row.submission_hash,
      eventId: row.event_id,
      teamWallet: row.team_wallet,
      repoUrl: row.repo_url,
      commitHash: row.commit_hash,
      description: row.description,
    });

    const status = result.flagged ? "flagged" : "clean";
    await updateSubmission(hash, {
      status,
      similarity: { ...result, checked_at: new Date().toISOString() },
    });

    return NextResponse.json({
      hash,
      status,
      flagged: result.flagged,
      matches: result.matches,
      explanation: result.explanation,
      threshold: result.threshold,
      embedding_provider: result.embeddingProvider,
      explainer_provider: result.explainerProvider,
      note: result.flagged
        ? "ADVISORY: this flag routes to organizer review. Only an exact on-chain hash match can auto-reject."
        : "No cross-event near-duplicates above threshold.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      hash,
      degraded: true,
      flagged: false,
      matches: [],
      explanation: null,
      warning: `Similarity check unavailable (${message}). This is ADVISORY infrastructure — the submission is not blocked; an organizer can re-run the check before lock-in.`,
    });
  }
}
