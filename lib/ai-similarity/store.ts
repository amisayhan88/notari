import { getPool } from "@/lib/db";
import { cosineSimilarity } from "./mock-embed";
import type { NeighborRow, SimilarityStore, SubmissionInput } from "./types";

/**
 * Postgres + pgvector store. Embeddings live in an untyped `vector` column
 * so the embedding model is swappable without a migration; at demo scale a
 * sequential cosine scan is fine (add an hnsw index if the corpus grows).
 */
export class PgStore implements SimilarityStore {
  async upsertEmbedding(
    sub: SubmissionInput,
    embedding: number[],
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO submissions
         (submission_hash, event_id, team_wallet, repo_url, commit_hash, description, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
       ON CONFLICT (submission_hash) DO UPDATE SET
         embedding = EXCLUDED.embedding,
         description = EXCLUDED.description,
         updated_at = now()`,
      [
        sub.hash,
        sub.eventId,
        sub.teamWallet,
        sub.repoUrl,
        sub.commitHash,
        sub.description,
        `[${embedding.join(",")}]`,
      ],
    );
  }

  async nearestNeighbors(
    embedding: number[],
    opts: { excludeEventId: string; excludeHash: string; limit: number },
  ): Promise<NeighborRow[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT submission_hash AS hash,
              event_id         AS "eventId",
              team_wallet      AS "teamWallet",
              repo_url         AS "repoUrl",
              description,
              1 - (embedding <=> $1::vector) AS score
         FROM submissions
        WHERE embedding IS NOT NULL
          AND event_id <> $2
          AND submission_hash <> $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4`,
      [
        `[${embedding.join(",")}]`,
        opts.excludeEventId,
        opts.excludeHash,
        opts.limit,
      ],
    );
    return res.rows.map((r) => ({ ...r, score: Number(r.score) }));
  }
}

/**
 * In-memory store for unit tests — same contract, zero infrastructure.
 */
export class MemoryStore implements SimilarityStore {
  private rows = new Map<
    string,
    { sub: SubmissionInput; embedding: number[] }
  >();

  async upsertEmbedding(
    sub: SubmissionInput,
    embedding: number[],
  ): Promise<void> {
    this.rows.set(sub.hash, { sub, embedding });
  }

  async nearestNeighbors(
    embedding: number[],
    opts: { excludeEventId: string; excludeHash: string; limit: number },
  ): Promise<NeighborRow[]> {
    const scored: NeighborRow[] = [];
    for (const { sub, embedding: emb } of this.rows.values()) {
      if (sub.eventId === opts.excludeEventId) continue;
      if (sub.hash === opts.excludeHash) continue;
      scored.push({
        hash: sub.hash,
        eventId: sub.eventId,
        teamWallet: sub.teamWallet,
        repoUrl: sub.repoUrl,
        description: sub.description,
        score: cosineSimilarity(embedding, emb),
      });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, opts.limit);
  }
}
