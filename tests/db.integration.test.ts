/**
 * Postgres/pgvector integration test — runs only when DATABASE_URL is set
 * (local docker-compose db or hosted Neon/Supabase).
 *
 *   DATABASE_URL=postgresql://notari:notari@localhost:5432/notari npm test
 */
import { describe, expect, it } from "vitest";
import { checkSimilarity, embedSubmission } from "@/lib/ai-similarity";
import { PgStore } from "@/lib/ai-similarity/store";
import { migrate } from "@/lib/db";
import type { SubmissionInput } from "@/lib/ai-similarity/types";

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

const base = {
  teamWallet: "GBINTEGRATIONTESTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  repoUrl: "https://github.com/example/pg-test",
  commitHash: "c".repeat(40),
};

function sub(overrides: Partial<SubmissionInput> & Pick<SubmissionInput, "hash" | "eventId" | "description">): SubmissionInput {
  return { ...base, ...overrides };
}

describeWithDb("PgStore + pgvector round trip", () => {
  it("stores embeddings and finds cross-event neighbors", async () => {
    await migrate();
    const store = new PgStore();
    const suffix = Date.now();

    const original = sub({
      hash: `pg-orig-${suffix}`,
      eventId: "pgtest_event_a",
      description:
        "OrbitNotes is a collaborative note-taking app for study groups with live cursors, markdown and spaced-repetition flashcards generated from shared notes.",
    });
    const resubmit = sub({
      hash: `pg-resub-${suffix}`,
      eventId: "pgtest_event_b",
      description:
        "OrbitNotes is a collaborative note-taking app for study groups with live cursors, markdown support and spaced-repetition flashcards generated from shared notes.",
    });

    await embedSubmission(original, store);
    const result = await checkSimilarity(resubmit, {
      store,
      threshold: 0.85,
    });

    expect(result.flagged).toBe(true);
    expect(result.matches[0].hash).toBe(original.hash);
  }, 30_000);
});
