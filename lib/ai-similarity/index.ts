/**
 * Cross-event near-duplicate detection — ADVISORY layer.
 *
 * Exposes the two module entry points:
 *
 * - embedSubmission: embed a submission's description and store the vector
 *   alongside its event_id + hash in the vector store.
 * - checkSimilarity: compare against the historical corpus, scoped to OTHER
 *   events (a team iterating on their own project within one event is
 *   normal and is excluded from the comparison pool). Matches above the
 *   threshold are flagged for organizer review with an explanation.
 *
 * This module never rejects anything. Exact-hash duplicate rejection is
 * enforced on-chain by submission-registry and is a separate mechanism.
 */

import { getEmbedder } from "./embedder";
import { explainFlag } from "./explainer";
import { PgStore } from "./store";
import type {
  SimilarityMatch,
  SimilarityResult,
  SimilarityStore,
  SubmissionInput,
} from "./types";

export type { SubmissionInput, SimilarityMatch, SimilarityResult };

export function defaultThreshold(): number {
  const raw = process.env.SIMILARITY_THRESHOLD;
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0.85;
}

let defaultStore: SimilarityStore | null = null;

function getStore(store?: SimilarityStore): SimilarityStore {
  if (store) return store;
  if (!defaultStore) defaultStore = new PgStore();
  return defaultStore;
}

/** Embed a submission and persist the vector keyed by hash/event. */
export async function embedSubmission(
  submission: SubmissionInput,
  store?: SimilarityStore,
): Promise<{ embedding: number[]; provider: string }> {
  const embedder = getEmbedder();
  const [embedding] = await embedder.embed([submission.description]);
  await getStore(store).upsertEmbedding(submission, embedding);
  return { embedding, provider: embedder.name };
}

/**
 * ADVISORY similarity check. Flags when any OTHER-EVENT submission clears
 * the cosine threshold; attaches a human-readable explanation when flagged.
 */
export async function checkSimilarity(
  submission: SubmissionInput,
  opts?: { store?: SimilarityStore; threshold?: number; limit?: number },
): Promise<SimilarityResult> {
  const threshold = opts?.threshold ?? defaultThreshold();
  const store = getStore(opts?.store);

  const { embedding, provider } = await embedSubmission(submission, store);
  const neighbors = await store.nearestNeighbors(embedding, {
    excludeEventId: submission.eventId,
    excludeHash: submission.hash,
    limit: opts?.limit ?? 10,
  });

  const matches: SimilarityMatch[] = neighbors
    .filter((n) => n.score >= threshold)
    .map((n) => ({
      hash: n.hash,
      eventId: n.eventId,
      teamWallet: n.teamWallet,
      repoUrl: n.repoUrl,
      description: n.description,
      score: Math.round(n.score * 1000) / 1000,
    }));

  if (matches.length === 0) {
    return {
      flagged: false,
      matches: [],
      explanation: null,
      threshold,
      embeddingProvider: provider,
      explainerProvider: null,
    };
  }

  const { explanation, provider: explainerProvider } = await explainFlag(
    submission.description,
    matches,
  );

  return {
    flagged: true,
    matches,
    explanation,
    threshold,
    embeddingProvider: provider,
    explainerProvider,
  };
}
