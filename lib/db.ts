import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Use the local docker-compose db or a Neon/Supabase connection string (see .env.example).",
      );
    }
    pool = new Pool({ connectionString: url, max: 10 });
  }
  return pool;
}

/** Idempotent schema bootstrap for the app tables. */
export async function migrate(): Promise<void> {
  const p = getPool();
  await p.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS submissions (
      id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      submission_hash text UNIQUE NOT NULL,
      event_id        text NOT NULL,
      team_wallet     text NOT NULL,
      repo_url        text NOT NULL,
      commit_hash     text NOT NULL,
      description     text NOT NULL,
      embedding       vector,
      status          text NOT NULL DEFAULT 'draft',
      similarity      jsonb,
      metadata_pointer text,
      tx_hash         text,
      created_at      timestamptz NOT NULL DEFAULT now(),
      updated_at      timestamptz NOT NULL DEFAULT now()
    )`);
  await p.query(
    `CREATE INDEX IF NOT EXISTS submissions_event_idx ON submissions (event_id)`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS submissions_team_idx ON submissions (team_wallet)`,
  );
  await p.query(
    `CREATE INDEX IF NOT EXISTS submissions_status_idx ON submissions (status)`,
  );
  await p.query(
    `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS metadata_json jsonb`,
  );
  await p.query(
    `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS on_chain jsonb`,
  );
  await p.query(`
    CREATE TABLE IF NOT EXISTS submission_metadata (
      submission_hash text PRIMARY KEY,
      metadata        jsonb NOT NULL,
      created_at      timestamptz NOT NULL DEFAULT now()
    )`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      wallet       text PRIMARY KEY,
      role         text NOT NULL DEFAULT 'team',
      name         text,
      organization text,
      location     text,
      bio          text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )`);
}
