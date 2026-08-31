/**
 * AI similarity module — ADVISORY layer.
 *
 * Nothing in this module can block or reject a submission. It surfaces
 * likely cross-event duplicates so an ORGANIZER (a human) makes the final
 * call. Exact-duplicate rejection is enforced on-chain by the
 * submission-registry contract and is a completely separate mechanism.
 */

export interface SubmissionInput {
  /** Canonical sha256 hex of the normalized submission. */
  hash: string;
  eventId: string;
  teamWallet: string;
  repoUrl: string;
  commitHash: string;
  description: string;
}

export interface SimilarityMatch {
  hash: string;
  eventId: string;
  teamWallet: string;
  repoUrl: string;
  /** Truncated description preview for UI display. */
  description: string;
  /** Cosine similarity in [0, 1]. */
  score: number;
}

export interface SimilarityResult {
  /** True when at least one cross-event neighbor cleared the threshold. */
  flagged: boolean;
  matches: SimilarityMatch[];
  /** Human-readable "why flagged" text (LLM or template fallback). */
  explanation: string | null;
  threshold: number;
  /** Which embedding provider produced the vectors. */
  embeddingProvider: string;
  /** Which explainer produced the explanation (null when not flagged). */
  explainerProvider: string | null;
}

export interface NeighborRow {
  hash: string;
  eventId: string;
  teamWallet: string;
  repoUrl: string;
  description: string;
  score: number;
}

/**
 * Storage backend for embeddings. Postgres+pgvector in production,
 * in-memory for tests.
 */
export interface SimilarityStore {
  upsertEmbedding(sub: SubmissionInput, embedding: number[]): Promise<void>;
  /**
   * Returns nearest neighbors by cosine similarity, EXCLUDING rows from
   * `excludeEventId` (a team iterating on their own project within one
   * event is normal) and the submission's own hash.
   */
  nearestNeighbors(
    embedding: number[],
    opts: { excludeEventId: string; excludeHash: string; limit: number },
  ): Promise<NeighborRow[]>;
}
