import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSimilarity, embedSubmission } from "@/lib/ai-similarity";
import {
  cosineSimilarity,
  mockEmbed,
  tokenize,
} from "@/lib/ai-similarity/mock-embed";
import { MemoryStore } from "@/lib/ai-similarity/store";
import type { SubmissionInput } from "@/lib/ai-similarity/types";

const THRESHOLD = 0.85;

const WALLET_A = "GBTEAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const WALLET_B = "GBTEAMBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const CLIMATE_DESCRIPTION =
  "ClimateWatch is a real-time climate risk dashboard that aggregates satellite " +
  "weather feeds, flood sensors and heat-index data into one map for city " +
  "planners. It uses a Next.js frontend, a Postgres timeseries store and " +
  "server-side rendering to publish alert zones for vulnerable districts.";

const RECIPE_DESCRIPTION =
  "PlateSwap is a community recipe-sharing app where home cooks exchange " +
  "regional dishes, rate each other's versions and build collaborative " +
  "cookbooks. It is built with Next.js, stores recipes in Postgres and uses " +
  "image uploads for plating photos.";

// Same project, lightly tweaked README for a resubmission at another event.
const CLIMATE_RESUBMIT =
  "ClimateWatch is a real-time climate risk dashboard that aggregates satellite " +
  "weather feeds, flood sensors and heat-index data into one interactive map for " +
  "city planners. It uses a Next.js frontend, a Postgres timeseries store and " +
  "server-side rendering to publish live alert zones for vulnerable districts.";

function sub(
  overrides: Partial<SubmissionInput> & Pick<SubmissionInput, "hash" | "eventId" | "description">,
): SubmissionInput {
  return {
    teamWallet: WALLET_A,
    repoUrl: "https://github.com/example/project",
    commitHash: "a".repeat(40),
    ...overrides,
  };
}

beforeEach(() => {
  // Force the deterministic fallback providers regardless of ambient env.
  vi.stubEnv("EMBEDDINGS_API_URL", "");
  vi.stubEnv("EMBEDDINGS_API_KEY", "");
  vi.stubEnv("LLM_API_URL", "");
  vi.stubEnv("LLM_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

describe("mock embedder sanity", () => {
  it("is deterministic and normalized", () => {
    const a = mockEmbed(CLIMATE_DESCRIPTION);
    const b = mockEmbed(CLIMATE_DESCRIPTION);
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores near-identical text high and unrelated text low", () => {
    const original = mockEmbed(CLIMATE_DESCRIPTION);
    const resubmit = mockEmbed(CLIMATE_RESUBMIT);
    const unrelated = mockEmbed(RECIPE_DESCRIPTION);
    expect(cosineSimilarity(original, resubmit)).toBeGreaterThan(THRESHOLD);
    expect(cosineSimilarity(original, unrelated)).toBeLessThan(0.5);
  });

  it("tokenizes away punctuation and stopwords", () => {
    const tokens = tokenize("The quick brown fox, jumps!");
    expect(tokens).toEqual(["quick", "brown", "fox", "jumps"]);
  });
});

describe("checkSimilarity — the three spec scenarios", () => {
  it("does NOT flag two clearly different submissions", async () => {
    const store = new MemoryStore();
    await embedSubmission(
      sub({ hash: "h-climate", eventId: "hack4bengal_2026", description: CLIMATE_DESCRIPTION }),
      store,
    );

    const result = await checkSimilarity(
      sub({ hash: "h-recipe", eventId: "fiem_acm_hackathon", description: RECIPE_DESCRIPTION, teamWallet: WALLET_B }),
      { store, threshold: THRESHOLD },
    );

    expect(result.flagged).toBe(false);
    expect(result.matches).toHaveLength(0);
    expect(result.explanation).toBeNull();
  });

  it("FLAGS a near-identical resubmission at a different event", async () => {
    const store = new MemoryStore();
    await embedSubmission(
      sub({ hash: "h-original", eventId: "hack4bengal_2026", description: CLIMATE_DESCRIPTION }),
      store,
    );

    const result = await checkSimilarity(
      sub({
        hash: "h-resubmit",
        eventId: "fiem_acm_hackathon",
        description: CLIMATE_RESUBMIT,
        teamWallet: WALLET_B,
        repoUrl: "https://github.com/example/project-v2",
      }),
      { store, threshold: THRESHOLD },
    );

    expect(result.flagged).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].hash).toBe("h-original");
    expect(result.matches[0].eventId).toBe("hack4bengal_2026");
    expect(result.matches[0].score).toBeGreaterThanOrEqual(THRESHOLD);
    // Advisory explanation is attached when flagged.
    expect(result.explanation).toBeTruthy();
    expect(result.explanation).toContain("advisory");
  });

  it("does NOT flag a legitimate iteration within the same event", async () => {
    const store = new MemoryStore();
    await embedSubmission(
      sub({ hash: "h-v1", eventId: "hack4bengal_2026", description: CLIMATE_DESCRIPTION }),
      store,
    );

    // Identical description, same event, different commit/hash — normal
    // in-event iteration, excluded from the comparison pool.
    const result = await checkSimilarity(
      sub({
        hash: "h-v2",
        eventId: "hack4bengal_2026",
        description: CLIMATE_DESCRIPTION,
        commitHash: "b".repeat(40),
      }),
      { store, threshold: THRESHOLD },
    );

    expect(result.flagged).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it("flags only neighbors above the threshold", async () => {
    const store = new MemoryStore();
    await embedSubmission(
      sub({ hash: "h-original", eventId: "hack4bengal_2026", description: CLIMATE_DESCRIPTION }),
      store,
    );
    await embedSubmission(
      sub({ hash: "h-recipe", eventId: "fiem_acm_hackathon", description: RECIPE_DESCRIPTION, teamWallet: WALLET_B }),
      store,
    );

    const result = await checkSimilarity(
      sub({ hash: "h-resubmit", eventId: "gdg_hackathon", description: CLIMATE_RESUBMIT, teamWallet: WALLET_B }),
      { store, threshold: THRESHOLD, limit: 10 },
    );

    expect(result.flagged).toBe(true);
    expect(result.matches.map((m) => m.hash)).toContain("h-original");
    expect(result.matches.map((m) => m.hash)).not.toContain("h-recipe");
  });
});
