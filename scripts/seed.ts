/**
 * Demo seed — two events, 8 submissions, one deliberate near-duplicate
 * resubmitted under a different team name at the second event.
 *
 *   npm run db:seed
 *
 * Idempotent-ish: canonical hashes are unique per content, re-running skips
 * existing rows. Similarity flags are computed by the real pipeline
 * (mock embedder unless EMBEDDINGS_API_KEY is configured).
 */

import "dotenv/config";
import { Keypair } from "@stellar/stellar-sdk";
import { canonicalHash } from "../lib/stellar/canonicalize";
import { checkSimilarity } from "../lib/ai-similarity";
import { upsertProfile } from "../lib/profiles";
import { getSubmissionByHash, insertSubmission, updateSubmission } from "../lib/submissions";

const EVENT_A = "hack4bengal_2026";
const EVENT_B = "fiem_acm_hackathon";

/**
 * Demo organizer profiles — the wallets that are on-chain organizers of the
 * demo events (see the wallet identities table in the README). Display/UX
 * data only; their authority comes from the event-registry contract.
 */
const DEMO_ORGANIZERS = [
  {
    wallet: "GBZO5KCIRZVGHTFWMVQRQJZLKASPZC4VYECXEGHMWCAX7BG442EZ34VS",
    role: "organizer",
    name: "Aritra Das",
    organization: "notari pilots",
    location: "Kolkata, IN",
    bio: "Runs the testnet pilots",
  },
  {
    wallet: "GDEQ54A5IGD4L3JMGCEAKBMJE2R5YAD2SQ5D5TLRJYAPL45KNKAP4HFD",
    role: "organizer",
    name: "FIEM ACM",
    organization: "FIEM ACM Student Chapter",
    location: "Kolkata, IN",
    bio: "Pilot community — organizes FIEM ACM Hackathon and co-organizes Hack4Bengal 2026.",
  },
  {
    wallet: "GAOYJQS222XE3S36YDDOUIDVMDKOWJEJFBCFTAKKBDBT3OP3NJSAVAX7",
    role: "organizer",
    name: "HackSpire",
    organization: "HackSpire Community",
    location: "Kolkata, IN",
    bio: "Pilot community — co-organizes Hack4Bengal 2026 and FIEM ACM Hackathon.",
  },
] as const;

interface DemoSubmission {
  eventId: string;
  teamName: string;
  repoUrl: string;
  commitHash: string;
  description: string;
}

const CLIMATE_DESCRIPTION =
  "ClimateWatch is a real-time climate risk dashboard that aggregates satellite " +
  "weather feeds, flood sensors and heat-index data into one map for city " +
  "planners. It uses a Next.js frontend, a Postgres timeseries store and " +
  "server-side rendering to publish alert zones for vulnerable districts.";

// Same project, lightly tweaked README, different team, second event.
const CLIMATE_RESUBMIT =
  "ClimateWatch is a real-time climate risk dashboard that aggregates satellite " +
  "weather feeds, flood sensors and heat-index data into one interactive map " +
  "for city planners. It uses a Next.js frontend, a Postgres timeseries store " +
  "and server-side rendering to publish live alert zones for vulnerable districts.";

const demo: DemoSubmission[] = [
  // ---- Event A: Hack4Bengal 2026 -------------------------------------
  {
    eventId: EVENT_A,
    teamName: "team-monsoon",
    repoUrl: "https://github.com/team-monsoon/climatewatch",
    commitHash: "4a7b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
    description: CLIMATE_DESCRIPTION,
  },
  {
    eventId: EVENT_A,
    teamName: "team-spice",
    repoUrl: "https://github.com/team-spice/plateswap",
    commitHash: "b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7",
    description:
      "PlateSwap is a community recipe-sharing app where home cooks exchange regional dishes, rate each other's versions and build collaborative cookbooks. It is built with Next.js, stores recipes in Postgres and uses image uploads for plating photos.",
  },
  {
    eventId: EVENT_A,
    teamName: "team-orbit",
    repoUrl: "https://github.com/team-orbit/orbitnotes",
    commitHash: "c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0",
    description:
      "OrbitNotes is a collaborative note-taking app for study groups with live cursors, markdown support and spaced-repetition flashcards generated automatically from shared notes. Built on Next.js with Postgres and websockets for presence.",
  },
  {
    eventId: EVENT_A,
    teamName: "team-hopper",
    repoUrl: "https://github.com/team-hopper/transitpulse",
    commitHash: "d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3",
    description:
      "TransitPulse predicts bus arrival times for Kolkata's transit network using historical GPS traces and a lightweight gradient-boosted model, served through a Next.js map UI with live vehicle positions.",
  },
  // ---- Event B: FIEM ACM Hackathon ------------------------------------
  {
    eventId: EVENT_B,
    teamName: "team-lighthouse",
    repoUrl: "https://github.com/team-lighthouse/mentorloop",
    commitHash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4",
    description:
      "MentorLoop matches students with industry mentors based on skill gaps extracted from their resumes, schedules recurring check-ins and tracks growth goals. Next.js frontend, Postgres, and a rules-based matching engine.",
  },
  {
    eventId: EVENT_B,
    teamName: "team-cobalt",
    repoUrl: "https://github.com/team-cobalt/accesslens",
    commitHash: "f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5",
    description:
      "AccessLens is a browser extension that audits any web page for accessibility issues, highlights failing elements in an overlay and generates a prioritized fix list mapped to WCAG criteria.",
  },
  // ⚠ THE DELIBERATE NEAR-DUPLICATE: ClimateWatch resubmitted at Event B
  // under a different team name with a tweaked description.
  {
    eventId: EVENT_B,
    teamName: "team-greenhorizon",
    repoUrl: "https://github.com/team-greenhorizon/climatewatch-pro",
    commitHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    description: CLIMATE_RESUBMIT,
  },
];

async function main() {
  console.log("Seeding demo data…\n");

  for (const o of DEMO_ORGANIZERS) {
    await upsertProfile(o);
    console.log(`+ organizer profile: ${o.name} (${o.wallet.slice(0, 8)}…)`);
  }

  const wallets = new Map<string, string>();

  for (const d of demo) {
    if (!wallets.has(d.teamName)) {
      wallets.set(d.teamName, Keypair.random().publicKey());
    }
    const teamWallet = wallets.get(d.teamName)!;
    const hash = canonicalHash({
      repoUrl: d.repoUrl,
      commitHash: d.commitHash,
      description: d.description,
      teamWallet,
    });

    const existing = await getSubmissionByHash(hash);
    if (existing) {
      console.log(`= ${d.eventId} / ${d.teamName}: already seeded (${hash.slice(0, 12)}…)`);
      continue;
    }

    await insertSubmission({
      hash,
      eventId: d.eventId,
      teamWallet,
      repoUrl: d.repoUrl,
      commitHash: d.commitHash,
      description: d.description,
    });

    // Real advisory pipeline: embed + pgvector neighbor search + explain.
    const result = await checkSimilarity({
      hash,
      eventId: d.eventId,
      teamWallet,
      repoUrl: d.repoUrl,
      commitHash: d.commitHash,
      description: d.description,
    });

    await updateSubmission(hash, {
      status: result.flagged ? "flagged" : "clean",
      similarity: { ...result, checked_at: new Date().toISOString() },
    });

    const flag = result.flagged
      ? `⚠ FLAGGED (${result.matches
          .map((m) => `${(m.score * 100).toFixed(0)}% vs ${m.eventId}`)
          .join(", ")})`
      : "✓ clean";
    console.log(`+ ${d.eventId} / ${d.teamName}: ${flag}  (${hash.slice(0, 12)}…)`);
  }

  console.log("\nSeed complete.");
  console.log("- Open /dashboard as the issuer organizer to review the flag.");
  console.log("- The flagged row is ClimateWatch resubmitted at the second event.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
