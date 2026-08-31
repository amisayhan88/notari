/**
 * Freighter normalization — v6+ returns result objects instead of raw
 * values, older versions returned primitives. Handles both shapes.
 *
 * Connect flow (v6): a domain must be explicitly allowed in the extension
 * before `getAddress()` works. On a fresh deployment (new hostname) the site
 * is not allowed yet, so we must call `requestAccess()` — that is what
 * opens the extension's approval popup — instead of calling `getAddress()`
 * directly and failing.
 */

export interface FreighterResult {
  address: string | null;
  error: string | null;
}

/** v6 result objects carry the value plus an optional error string. */
function errorOf(res: unknown): string | null {
  if (res && typeof res === "object") {
    const err = (res as { error?: unknown }).error;
    if (typeof err === "string" && err.trim()) return err;
  }
  return null;
}

function stringOf(res: unknown, key: string): string | null {
  if (typeof res === "string") return res || null;
  if (res && typeof res === "object") {
    const v = (res as Record<string, unknown>)[key];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export async function getFreighterAddress(): Promise<FreighterResult> {
  if (typeof window === "undefined") {
    return { address: null, error: "Wallet connection requires a browser." };
  }

  let freighter: typeof import("@stellar/freighter-api");
  try {
    freighter = await import("@stellar/freighter-api");
  } catch {
    return {
      address: null,
      error:
        "Freighter not detected. Install the Freighter extension, or use the sponsored wallet instead.",
    };
  }

  try {
    // 1. Is the extension installed and responding?
    const connected = await freighter.isConnected();
    const isConnected =
      typeof connected === "boolean"
        ? connected
        : Boolean((connected as { isConnected?: boolean }).isConnected);
    if (!isConnected) {
      return {
        address: null,
        error:
          "Freighter not detected. Install the Freighter extension, or use the sponsored wallet instead.",
      };
    }

    // 2. Is this site allowed in the extension? If not, request access —
    //    this opens Freighter's approval popup. Without it, getAddress()
    //    just rejects on any domain the user hasn't allowed yet (e.g. a
    //    freshly deployed Vercel hostname).
    let allowed = false;
    if (typeof freighter.isAllowed === "function") {
      const allowedRes = await freighter.isAllowed();
      allowed =
        typeof allowedRes === "boolean"
          ? allowedRes
          : Boolean((allowedRes as { isAllowed?: boolean }).isAllowed);
    }

    if (!allowed && typeof freighter.requestAccess === "function") {
      const access = await freighter.requestAccess();
      const accessAddress = stringOf(access, "address");
      if (accessAddress) return { address: accessAddress, error: null };
      const declined = errorOf(access);
      return {
        address: null,
        error: `Freighter access was declined${declined ? ` (${declined})` : ""}. Open Freighter → Settings and allow this site to connect.`,
      };
    }

    // 3. Site already allowed — read the address.
    const res = await freighter.getAddress();
    const address = stringOf(res, "address");
    if (!address) {
      const detail = errorOf(res);
      return {
        address: null,
        error: `Freighter did not return an address${detail ? ` (${detail})` : ""}. Open Freighter → Settings and make sure this site is allowed.`,
      };
    }
    return { address, error: null };
  } catch (err) {
    return {
      address: null,
      error:
        err instanceof Error && err.message
          ? err.message
          : "Freighter connection was declined.",
    };
  }
}
