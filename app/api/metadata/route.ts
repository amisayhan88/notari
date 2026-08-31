/**
 * GET /api/metadata?hash=<sha256> — resolves off-chain submission metadata.
 * Handles `dev:` pointers (local Postgres store) used when no Pinata key is
 * configured. For IPFS pointers, clients fetch the CID from any gateway.
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveDevMetadata } from "@/lib/ipfs";
import { getSubmissionByHash } from "@/lib/submissions";

export async function GET(req: NextRequest) {
  const hash = (req.nextUrl.searchParams.get("hash") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ error: "hash query param required" }, { status: 400 });
  }

  const meta = await resolveDevMetadata(hash);
  if (meta) {
    return NextResponse.json({ pointer: `dev:${hash}`, provider: "dev-db", metadata: meta });
  }

  const row = await getSubmissionByHash(hash);
  if (row?.metadata_pointer && !row.metadata_pointer.startsWith("dev:")) {
    return NextResponse.json({
      pointer: row.metadata_pointer,
      provider: "ipfs",
      gateway_url: `https://gateway.pinata.cloud/ipfs/${row.metadata_pointer}`,
    });
  }

  return NextResponse.json({ error: "No metadata found for this hash" }, { status: 404 });
}
