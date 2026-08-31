/**
 * Organizer gating for API routes.
 *
 * Source of truth is ON-CHAIN: the event-registry contract decides whether
 * an address organizes an event. The caller identifies themselves via the
 * x-organizer-address header — demo-grade auth (testnet). A production
 * deployment should require a signed challenge (SEP-style) from that key.
 */

import type { NextRequest } from "next/server";
import {
  getEventRegistryAdmin,
  isAuthorizedOrganizer,
} from "@/lib/stellar/contracts";

export const EVENT_ID_RE = /^[a-zA-Z0-9_]{1,32}$/;

export interface AuthResult {
  ok: boolean;
  address?: string;
  error?: string;
}

export async function requireOrganizer(
  req: NextRequest,
  eventId: string,
): Promise<AuthResult> {
  const address = req.headers.get("x-organizer-address")?.trim();
  if (!address) {
    return { ok: false, error: "Missing x-organizer-address header" };
  }
  if (!EVENT_ID_RE.test(eventId)) {
    return { ok: false, error: "Invalid event id" };
  }
  const authorized = await isAuthorizedOrganizer(eventId, address);
  if (!authorized) {
    return {
      ok: false,
      error: `Address ${address} is not an authorized organizer for "${eventId}" (verified on-chain)`,
    };
  }
  return { ok: true, address };
}

export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const address = req.headers.get("x-organizer-address")?.trim();
  if (!address) {
    return { ok: false, error: "Missing x-organizer-address header" };
  }
  const admin = await getEventRegistryAdmin();
  if (address !== admin) {
    return {
      ok: false,
      error: "Only the event-registry admin may manage organizers (verified on-chain)",
    };
  }
  return { ok: true, address };
}
