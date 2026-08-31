/**
 * Off-chain metadata storage. Only the CID/pointer goes on Soroban; the full
 * submission content lives here.
 *
 * - Pinata (PINATA_JWT set): pins the JSON to IPFS, pointer = the CID.
 * - Dev fallback (no key): stores the JSON in Postgres and returns a
 *   pointer prefixed `dev:` — clearly labeled, resolved via /api/metadata.
 *   This keeps the whole flow runnable without external accounts; swap in
 *   Pinata for production pinning.
 */

import { PinataSDK } from "pinata";
import { getPool } from "@/lib/db";

export interface SubmissionMetadata {
  version: 1;
  hash: string;
  eventId: string;
  teamWallet: string;
  repoUrl: string;
  commitHash: string;
  description: string;
  recordedAt: string;
}

export interface MetadataUploadResult {
  pointer: string;
  provider: "pinata" | "dev-db";
  gatewayUrl: string | null;
}

export async function uploadSubmissionMetadata(
  meta: SubmissionMetadata,
): Promise<MetadataUploadResult> {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud";

  if (jwt) {
    const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: gateway });
    const upload = await pinata.upload.public.json(
      meta as unknown as Record<string, unknown>,
    );
    const cid = upload.cid;
    return {
      pointer: cid,
      provider: "pinata",
      gatewayUrl: `https://${gateway.replace(/^https?:\/\//, "")}/ipfs/${cid}`,
    };
  }

  // Dev fallback: persist in Postgres, labeled so nobody mistakes it for IPFS.
  const pool = getPool();
  await pool.query(
    `INSERT INTO submission_metadata (submission_hash, metadata)
     VALUES ($1, $2)
     ON CONFLICT (submission_hash) DO UPDATE SET metadata = EXCLUDED.metadata`,
    [meta.hash, JSON.stringify(meta)],
  );
  return {
    pointer: `dev:${meta.hash}`,
    provider: "dev-db",
    gatewayUrl: null,
  };
}

export async function resolveDevMetadata(
  hash: string,
): Promise<SubmissionMetadata | null> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT metadata FROM submission_metadata WHERE submission_hash = $1`,
    [hash],
  );
  return res.rows[0]?.metadata ?? null;
}
