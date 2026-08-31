/**
 * POST /api/wallet — sponsored account onboarding.
 *
 * Generates a fresh testnet keypair and friendbot-funds it so teams without
 * a wallet get a verifiable team address. The secret is returned once and
 * never stored server-side. Testnet only (guarded inside the helper).
 */

import { NextResponse, type NextRequest } from "next/server";
import { createSponsoredAccount } from "@/lib/stellar/friendbot";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  if (String(body.action ?? "create") !== "create") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const account = await createSponsoredAccount();
  return NextResponse.json(account, { status: 201 });
}
