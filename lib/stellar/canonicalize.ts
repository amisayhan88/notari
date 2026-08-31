/**
 * Canonicalization — the deterministic normalization that turns a submission
 * into its trustless identity. The sha256 of this string is what goes
 * on-chain, so two lazily-duplicated submissions (same repo, same commit,
 * same stripped description, same team wallet) produce the SAME hash and
 * the contract rejects the second one within the same event.
 */

import { createHash } from "node:crypto";

export interface CanonicalInput {
  repoUrl: string;
  commitHash: string;
  description: string;
  teamWallet: string;
}

/** Strip punctuation, collapse whitespace, lowercase. */
export function stripDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalString(input: CanonicalInput): string {
  const repo = input.repoUrl
    .trim()
    .toLowerCase()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const commit = input.commitHash.trim().toLowerCase();
  const description = stripDescription(input.description);
  // Stellar addresses are canonical base32; uppercase is the standard form.
  const wallet = input.teamWallet.trim().toUpperCase();
  return [repo, commit, description, wallet].join("\n");
}

/** sha256 hex of the canonical string — the on-chain submission hash. */
export function canonicalHash(input: CanonicalInput): string {
  return createHash("sha256").update(canonicalString(input)).digest("hex");
}
