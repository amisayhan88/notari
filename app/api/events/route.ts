/**
 * Event management.
 *
 * GET  /api/events — public: on-chain registered events (with names and
 *                    organizer lists), merged with db-known/demo events.
 * POST /api/events — organizer management: { action: add|remove } is gated
 *                    by the event-registry contract itself (admin or an
 *                    existing organizer may manage the roster).
 */

import { NextResponse, type NextRequest } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import {
  addOrganizer,
  getEvent,
  getEventRegistryAdmin,
  getEvents,
  getEventSubmissions,
  getOrganizers,
  isAuthorizedOrganizer,
  removeOrganizer,
} from "@/lib/stellar/contracts";
import { EVENT_ID_RE } from "@/lib/api/auth";
import { listKnownEvents } from "@/lib/submissions";

export async function GET() {
  const demoEvents = (process.env.DEMO_EVENT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dbEvents = await listKnownEvents().catch(() => [] as string[]);
  const chainEvents = await getEvents().catch(() => [] as string[]);
  const eventIds = Array.from(new Set([...chainEvents, ...demoEvents, ...dbEvents]));

  const events = await Promise.all(
    eventIds.map(async (id) => {
      const [info, organizers, records] = await Promise.all([
        getEvent(id).catch(() => null),
        getOrganizers(id).catch(() => [] as string[]),
        getEventSubmissions(id).catch(() => []),
      ]);
      return {
        event_id: id,
        name: info?.name ?? null,
        created_at: info?.createdAt ?? null,
        created_by: info?.createdBy ?? null,
        organizers,
        onchain_records: records.length,
      };
    }),
  );

  const admin = await getEventRegistryAdmin().catch(() => null);
  return NextResponse.json({ events, admin });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = String(body.action ?? "add");
  const eventId = String(body.event_id ?? "").trim();
  const organizer = String(body.organizer ?? "").trim().toUpperCase();

  if (!EVENT_ID_RE.test(eventId)) {
    return NextResponse.json({ error: "Invalid event_id" }, { status: 400 });
  }
  if (!StrKey.isValidEd25519PublicKey(organizer)) {
    return NextResponse.json({ error: "Invalid organizer address" }, { status: 400 });
  }

  // AUTHZ: the on-chain caller of add/remove_organizer is the issuer
  // (registry admin), which the contract always accepts — so the HTTP layer
  // must verify the REQUESTER independently. Allowed: the registry admin or
  // an existing organizer of this event (both checked on-chain).
  const requester = req.headers.get("x-organizer-address")?.trim().toUpperCase() ?? "";
  if (!StrKey.isValidEd25519PublicKey(requester)) {
    return NextResponse.json(
      { error: "Missing x-organizer-address header" },
      { status: 403 },
    );
  }
  const [admin, authorized] = await Promise.all([
    getEventRegistryAdmin().catch(() => null),
    isAuthorizedOrganizer(eventId, requester).catch(() => false),
  ]);
  if (requester !== admin && !authorized) {
    return NextResponse.json(
      {
        error: `Address ${requester} is neither the registry admin nor an organizer of "${eventId}" (verified on-chain)`,
      },
      { status: 403 },
    );
  }

  try {
    const txHash =
      action === "remove"
        ? await removeOrganizer(eventId, organizer)
        : await addOrganizer(eventId, organizer);
    return NextResponse.json({
      ok: true,
      action,
      event_id: eventId,
      organizer,
      requested_by: requester,
      tx_hash: txHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
