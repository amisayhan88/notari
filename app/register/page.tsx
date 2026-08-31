"use client";

/**
 * Organizer registration — one sponsored on-chain transaction.
 *
 * Connect (or generate) a wallet, name the event, and the event-registry
 * contract records it with you as the first organizer. Existing on-chain
 * events are listed live below the form.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Avatar from "@/components/Avatar";

interface ChainEvent {
  event_id: string;
  name: string | null;
  created_at: number | null;
  organizers: string[];
  onchain_records: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
}

export default function RegisterPage() {
  const { wallet, profile, openConnect } = useAuth();
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState("");
  const [touchedId, setTouchedId] = useState(false);
  const [organizer, setOrganizer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ event_id: string; tx_hash: string } | null>(null);
  const [events, setEvents] = useState<ChainEvent[]>([]);

  const suggestedId = useMemo(() => slugify(name), [name]);

  useEffect(() => {
    // Prefill the organizer field when a wallet connects (reactive, not init).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wallet) setOrganizer(wallet);
  }, [wallet]);

  const loadEvents = useCallback(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const idValue = touchedId ? eventId : suggestedId;
  const idValid = /^[a-zA-Z0-9_]{1,32}$/.test(idValue);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_id: idValue, name: name.trim(), organizer }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Registration failed");
      setSuccess({ event_id: d.event_id, tx_hash: d.tx_hash });
      setName("");
      setEventId("");
      setTouchedId(false);
      loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Register as an organizer</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        One sponsored transaction registers your event on the event-registry
        contract and installs you as its first organizer. No XLM, no waiting
        list — the chain is the approval.
      </p>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="card mt-10 border-accent/50 bg-accent/5 p-8 text-center"
          >
            <p className="text-2xl">🎉</p>
            <h2 className="mt-2 text-xl font-semibold text-accent">
              {success.event_id} is live on-chain
            </h2>
            <p className="mono mt-2 break-all text-xs text-muted">tx {success.tx_hash}</p>
            <p className="mt-3 text-sm text-muted">
              Your wallet now has on-chain authority to review and timestamp
              submissions for this event.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <a href="/dashboard" className="btn btn-primary">Open the dashboard →</a>
              <button
                className="btn btn-ghost"
                onClick={() => setSuccess(null)}
              >
                Register another
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card mt-10 space-y-5 p-6"
          >
            {/* Organizer identity */}
            <div>
              <label className="mb-1 block text-sm font-medium">Organizer wallet</label>
              {wallet ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-3">
                  <Avatar wallet={wallet} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {profile?.name ?? "Connected wallet"}
                      {profile?.organization && (
                        <span className="ml-2 text-xs text-muted">· {profile.organization}</span>
                      )}
                    </p>
                    <p className="mono truncate text-xs text-muted">{wallet}</p>
                  </div>
                  <button className="btn btn-ghost text-xs" onClick={() => openConnect("organizer")}>
                    Switch
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    className="input mono text-xs"
                    placeholder="Paste your organizer address (G…) or connect below"
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value.trim())}
                    aria-label="Organizer wallet address"
                  />
                  <button className="btn btn-primary text-xs" onClick={() => openConnect("organizer")}>
                    Connect wallet / generate sponsored wallet
                  </button>
                </div>
              )}
            </div>

            {/* Event details */}
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="evname">Event name</label>
              <input
                id="evname"
                className="input"
                placeholder="e.g. Hack4Bengal 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="evid">
                Event ID <span className="text-xs text-muted">(on-chain Symbol)</span>
              </label>
              <input
                id="evid"
                className="input mono text-xs"
                placeholder="auto-generated from the name"
                value={idValue}
                onChange={(e) => {
                  setTouchedId(true);
                  setEventId(slugify(e.target.value));
                }}
              />
              <p className={`mt-1 text-xs ${idValid ? "text-muted" : "text-danger"}`}>
                {idValid
                  ? "a-z, 0-9 and _ only · max 32 chars — enforced by the contract"
                  : "Event ID is required (1-32 chars of a-z, A-Z, 0-9, _)"}
              </p>
            </div>

            {error && <p role="alert" className="text-sm text-danger">{error}</p>}

            <button
              className="btn btn-primary w-full"
              disabled={busy || !idValid || name.trim().length < 3 || !organizer.startsWith("G")}
              onClick={submit}
            >
              {busy ? "Registering on-chain…" : "Register event on-chain (sponsored)"}
            </button>
            <p className="text-center text-xs text-muted">
              The issuer signs and pays the fee. Duplicate event ids are rejected
              by the contract itself.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live on-chain registry */}
      <section className="mt-14" aria-label="Registered events">
        <h2 className="text-lg font-semibold">Already on the registry</h2>
        <p className="mt-1 text-xs text-muted">
          Read live from the event-registry contract — names, organizers and
          recorded submission counts.
        </p>
        {events.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No events registered yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {events.map((ev) => (
              <li key={ev.event_id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {ev.name ?? ev.event_id}
                    {ev.name && <span className="mono ml-2 text-xs text-muted">{ev.event_id}</span>}
                  </p>
                  <p className="mono mt-1 text-xs text-muted">
                    {ev.organizers.length} organizer{ev.organizers.length === 1 ? "" : "s"}
                    {ev.created_at ? ` · registered ${new Date(ev.created_at * 1000).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                  {ev.onchain_records} on-chain record{ev.onchain_records === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
