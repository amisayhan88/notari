/**
 * GET /api/lookup?q=<repo url | commit hash | submission hash>
 *
 * Public search entry for the verify page. Submission hashes resolve
 * directly; repo URLs / commit hashes are matched against known app-layer
 * submissions; anything unknown falls through to a live on-chain history
 * probe so independently-derived hashes still verify.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getSubmissionHistory } from "@/lib/stellar/contracts";
import { getPool } from "@/lib/db";
import { ensureSchema } from "@/lib/submissions";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ error: "q query param required" }, { status: 400 });
  }

  const normalized = q.toLowerCase().replace(/\.git$/, "").replace(/\/+$/, "");

  // 1) exact submission hash
  if (/^[0-9a-f]{64}$/.test(normalized)) {
    return NextResponse.json({ hash: normalized, matched_by: "hash" });
  }

  // App-layer lookups need the db; skip gracefully when DATABASE_URL is unset.
  try {
    await ensureSchema();
    const pool = getPool();

    // 2) commit hash
    if (/^[0-9a-f]{7,40}$/.test(normalized)) {
      const res = await pool.query(
        `SELECT submission_hash FROM submissions WHERE commit_hash ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
        [`${normalized}%`],
      );
      if (res.rows[0]) {
        return NextResponse.json({
          hash: res.rows[0].submission_hash,
          matched_by: "commit_hash",
        });
      }
    }

    // 3) repo URL
    const res = await pool.query(
      `SELECT submission_hash FROM submissions WHERE lower(repo_url) = $1 OR lower(repo_url) LIKE $2 ORDER BY created_at DESC LIMIT 1`,
      [normalized, `%${normalized.replace(/^https?:\/\//, "")}`],
    );
    if (res.rows[0]) {
      return NextResponse.json({ hash: res.rows[0].submission_hash, matched_by: "repo_url" });
    }
  } catch {
    // fall through to the on-chain probe
  }

  // 4) if it looked hash-like, probe the chain directly
  if (/^[0-9a-f]{64}$/.test(q.toLowerCase())) {
    const history = await getSubmissionHistory(q.toLowerCase());
    if (history.length > 0) {
      return NextResponse.json({ hash: q.toLowerCase(), matched_by: "on-chain" });
    }
  }

  return NextResponse.json(
    { error: "No submission matches that query.", hash: null },
    { status: 404 },
  );
}
