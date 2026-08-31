/**
 * POST /api/events/register — register a new event ON-CHAIN.
 *
 * { event_id, name, organizer? }
 *
 * Calls event-registry.create_event via a sponsored transaction (the issuer,
 * which is the registry admin, signs and pays — organizers need no XLM).
 * The organizer becomes the event's first on-chain organizer; defaults to
 * the connected wallet (x-organizer-address header).
 *
 * Self-registration rule on-chain: non-admin callers may only install
 * themselves. The issuer is the admin, so this sponsored flow can install
 * the requesting organizer directly.
 */

import { NextResponse, type NextRequest } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { createEvent, getEvent } from "@/lib/stellar/contracts";
import { EVENT_ID_RE } from "@/lib/api/auth";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventId = String(body.event_id ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 80);
  const organizer = (
    String(body.organizer ?? "").trim() ||
    req.headers.get("x-organizer-address")?.trim() ||
    ""
  ).toUpperCase();

  if (!EVENT_ID_RE.test(eventId)) {
    return NextResponse.json(
      { error: "event_id must be 1-32 chars of a-z, A-Z, 0-9, _ (Soroban Symbol-safe)" },
      { status: 400 },
    );
  }
  if (name.length < 3) {
    return NextResponse.json({ error: "Event name must be at least 3 characters" }, { status: 400 });
  }
  if (!StrKey.isValidEd25519PublicKey(organizer)) {
    return NextResponse.json(
      { error: "Connect a wallet or provide a valid organizer address" },
      { status: 400 },
    );
  }

  const existing = await getEvent(eventId);
  if (existing) {
    return NextResponse.json(
      { error: `Event "${eventId}" is already registered on-chain.`, existing },
      { status: 409 },
    );
  }

  try {
    const { txHash, createdAt } = await createEvent(eventId, name, organizer);
    return NextResponse.json(
      {
        ok: true,
        event_id: eventId,
        name,
        organizer,
        tx_hash: txHash,
        created_at: createdAt,
        note: "Event registered on-chain. The organizer wallet now has on-chain authority to review and timestamp submissions.",
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: message.includes("already exists") ? 409 : 502 });
  }
}
