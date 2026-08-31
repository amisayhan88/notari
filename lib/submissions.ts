import { getPool, migrate } from "@/lib/db";

export type SubmissionStatus =
  | "draft" // created, not yet similarity-checked
  | "clean" // checked, no advisory flags
  | "flagged" // ADVISORY similarity flag awaiting organizer review
  | "timestamped" // recorded on-chain
  | "cleared" // organizer dismissed an advisory flag
  | "rejected"; // organizer rejected after review (advisory decision)

export interface SubmissionRow {
  id: string;
  submission_hash: string;
  event_id: string;
  team_wallet: string;
  repo_url: string;
  commit_hash: string;
  description: string;
  status: SubmissionStatus;
  similarity: unknown;
  metadata_pointer: string | null;
  tx_hash: string | null;
  on_chain: unknown;
  created_at: Date;
  updated_at: Date;
}

let migrated = false;

/** Run migrations once per process before first query. */
export async function ensureSchema(): Promise<void> {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

export async function insertSubmission(row: {
  hash: string;
  eventId: string;
  teamWallet: string;
  repoUrl: string;
  commitHash: string;
  description: string;
}): Promise<SubmissionRow> {
  await ensureSchema();
  const res = await getPool().query(
    `INSERT INTO submissions
       (submission_hash, event_id, team_wallet, repo_url, commit_hash, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     ON CONFLICT (submission_hash) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [
      row.hash,
      row.eventId,
      row.teamWallet,
      row.repoUrl,
      row.commitHash,
      row.description,
    ],
  );
  return res.rows[0];
}

export async function getSubmissionByHash(
  hash: string,
): Promise<SubmissionRow | null> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT * FROM submissions WHERE submission_hash = $1`,
    [hash],
  );
  return res.rows[0] ?? null;
}

export async function listSubmissions(filter: {
  eventId?: string;
  status?: string;
}): Promise<SubmissionRow[]> {
  await ensureSchema();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.eventId) {
    params.push(filter.eventId);
    clauses.push(`event_id = $${params.length}`);
  }
  if (filter.status) {
    params.push(filter.status);
    clauses.push(`status = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await getPool().query(
    `SELECT * FROM submissions ${where} ORDER BY created_at DESC LIMIT 200`,
    params,
  );
  return res.rows;
}

export async function updateSubmission(
  hash: string,
  patch: {
    status?: SubmissionStatus;
    similarity?: unknown;
    metadata_pointer?: string;
    metadata_json?: unknown;
    tx_hash?: string;
    on_chain?: unknown;
  },
): Promise<SubmissionRow | null> {
  await ensureSchema();
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [];
  const push = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.status) push("status", patch.status);
  if (patch.similarity !== undefined) push("similarity", JSON.stringify(patch.similarity));
  if (patch.metadata_pointer) push("metadata_pointer", patch.metadata_pointer);
  if (patch.metadata_json !== undefined) push("metadata_json", JSON.stringify(patch.metadata_json));
  if (patch.tx_hash) push("tx_hash", patch.tx_hash);
  if (patch.on_chain !== undefined) push("on_chain", JSON.stringify(patch.on_chain));
  params.push(hash);
  const res = await getPool().query(
    `UPDATE submissions SET ${sets.join(", ")} WHERE submission_hash = $${params.length} RETURNING *`,
    params,
  );
  return res.rows[0] ?? null;
}

/** Distinct event ids seen in the app db (for selectors). */
export async function listKnownEvents(): Promise<string[]> {
  await ensureSchema();
  const res = await getPool().query(
    `SELECT DISTINCT event_id FROM submissions ORDER BY event_id`,
  );
  return res.rows.map((r) => r.event_id);
}
