/**
 * Freighter normalization — v6+ returns result objects instead of raw
 * values, older versions returned primitives. Handles both shapes.
 */

export interface FreighterResult {
  address: string | null;
  error: string | null;
}

export async function getFreighterAddress(): Promise<FreighterResult> {
  try {
    const freighter = await import("@stellar/freighter-api");
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
    const res = await freighter.getAddress();
    const address =
      typeof res === "string"
        ? res
        : (res as { address?: string }).address ?? null;
    if (!address) {
      return { address: null, error: "Freighter did not return an address." };
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
