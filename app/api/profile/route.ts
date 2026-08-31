/**
 * Profile API — wallet-keyed identity.
 *
 * GET  /api/profile?wallet=G… → profile + best-effort on-chain organizer scope
 * POST /api/profile           → upsert { wallet, role, name, organization, location, bio }
 *
 * TRUST NOTE (demo-grade): POST does not require cryptographic proof of
 * wallet ownership — profiles are display/UX data with no privileges
 * attached (all real authority lives on-chain). Production should require a
 * signed challenge (SEP-0010-style) from the wallet before accepting a
 * profile write.
 */

import { NextResponse, type NextRequest } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { getProfile, upsertProfile } from "@/lib/profiles";
import { getOrganizers } from "@/lib/stellar/contracts";
import { listKnownEvents } from "@/lib/submissions";

async function eventsOrganized(wallet: string): Promise<string[]> {
  try {
    const demoEvents = (process.env.DEMO_EVENT_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const dbEvents = await listKnownEvents().catch(() => [] as string[]);
    const events = Array.from(new Set([...demoEvents, ...dbEvents])).slice(0, 12);
    const results = await Promise.all(
      events.map(async (id) => {
        try {
          const organizers = await getOrganizers(id);
          return organizers.includes(wallet) ? id : null;
        } catch {
          return null;
        }
      }),
    );
    return results.filter((x): x is string => x !== null);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get("wallet") ?? "").toUpperCase();
  if (!StrKey.isValidEd25519PublicKey(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const profile = await getProfile(wallet).catch(() => null);
  const organized = await eventsOrganized(wallet);
  return NextResponse.json({
    wallet,
    profile,
    events_organized: organized,
    is_organizer: organized.length > 0,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const wallet = String(body.wallet ?? "").toUpperCase();
  if (!StrKey.isValidEd25519PublicKey(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const name = String(body.name ?? "").slice(0, 80);
  const organization = String(body.organization ?? "").slice(0, 120);
  const location = String(body.location ?? "").slice(0, 120);
  const bio = String(body.bio ?? "").slice(0, 500);
  const role = body.role === "organizer" ? "organizer" : "team";

  const profile = await upsertProfile({
    wallet,
    role,
    name,
    organization,
    location,
    bio,
  });
  return NextResponse.json({ profile });
}
