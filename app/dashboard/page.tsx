"use client";

/**
 * Organizer dashboard — a working tool, not a showcase.
 *
 * Access is gated on-chain: the queue only loads when the connected address
 * is an authorized organizer for the selected event (verified against the
 * event-registry contract by the API). Flagged submissions are visually
 * distinct and severity-coded by similarity score; every flag routes to a
 * human decision (clear / reject / approve lock-in).
 */

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { getFreighterAddress } from "@/lib/freighter";
import { useAuth } from "@/components/auth/AuthProvider";
import Avatar from "@/components/Avatar";

interface Submission {
  submission_hash: string;
  event_id: string;
  team_wallet: string;
  repo_url: string;
  commit_hash: string;
  description: string;
  status: string;
  similarity: {
    flagged?: boolean;
    matches?: { hash: string; eventId: string; score: number }[];
    explanation?: string;
  } | null;
  tx_hash: string | null;
  on_chain: { timestamp: number; ledger: number } | null;
  created_at: string;
}

interface EventInfo {
  event_id: string;
  organizers: string[];
  name: string | null;
  created_at: number | null;
  onchain_records: number;
}

function severityColor(score: number): string {
  if (score >= 0.95) return "border-danger text-danger";
  if (score >= 0.9) return "border-warn text-warn";
  return "border-accent-2 text-accent-2";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: "bg-line text-muted",
    clean: "bg-accent/15 text-accent",
    flagged: "bg-danger/15 text-danger",
    timestamped: "bg-accent/25 text-accent",
    cleared: "bg-accent-2/15 text-accent-2",
    rejected: "bg-danger/30 text-danger",
  };
  return map[status] ?? "bg-line text-muted";
}

export default function DashboardPage() {
  const { wallet: authWallet, profile, eventsOrganized, openConnect } = useAuth();
  const [address, setAddress] = useState("");
  const [savedAddress, setSavedAddress] = useState("");
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [eventId, setEventId] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const [newOrganizer, setNewOrganizer] = useState("");
  const [createName, setCreateName] = useState("");
  const [createId, setCreateId] = useState("");
  const [adminAddress, setAdminAddress] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("notari-organizer");
    if (stored) {
      setAddress(stored);
      setSavedAddress(stored);
    }
  }, []);

  // Adopt the globally connected wallet when nothing is set locally.
  useEffect(() => {
    if (authWallet && !localStorage.getItem("notari-organizer")) {
      setAddress(authWallet);
      setSavedAddress(authWallet);
    }
  }, [authWallet]);

  const loadEvents = useCallback(async () => {
    const res = await fetch("/api/events");
    const d = await res.json();
    setEvents(d.events ?? []);
    setAdminAddress(d.admin ?? null);
  }, []);

  useEffect(() => {
    loadEvents().catch(() => setError("Could not load events"));
  }, [loadEvents]);

  const loadQueue = useCallback(
    async (ev: string, addr: string) => {
      if (!ev || !addr) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/submissions?event_id=${encodeURIComponent(ev)}`, {
          headers: { "x-organizer-address": addr },
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Failed to load queue");
        setSubmissions(d.submissions ?? []);
      } catch (err) {
        setSubmissions([]);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (eventId && savedAddress) loadQueue(eventId, savedAddress);
  }, [eventId, savedAddress, loadQueue]);

  const connect = () => {
    localStorage.setItem("notari-organizer", address.trim());
    setSavedAddress(address.trim());
  };

  const connectFreighter = async () => {
    const { address: addr, error } = await getFreighterAddress();
    if (error || !addr) {
      setError(error ?? "Freighter connection failed.");
      return;
    }
    setAddress(addr);
    localStorage.setItem("notari-organizer", addr);
    setSavedAddress(addr);
  };

  const act = async (hash: string, action: string) => {
    setBusyHash(hash);
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organizer-address": savedAddress,
        },
        body: JSON.stringify({ hash, action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Action failed");
      setActionMsg(d.note ?? "Done");
      await loadQueue(eventId, savedAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyHash(null);
    }
  };

  const timestamp = async (hash: string) => {
    setBusyHash(hash);
    setActionMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/timestamp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organizer-address": savedAddress,
        },
        body: JSON.stringify({ hash }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Timestamp failed");
      setActionMsg(`Recorded on-chain at ledger ${d.ledger}. ${d.note}`);
      await loadQueue(eventId, savedAddress);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyHash(null);
    }
  };

  const manageOrganizer = async (action: "add" | "remove") => {
    setBusyHash(`org-${action}`);
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organizer-address": savedAddress,
        },
        body: JSON.stringify({ action, event_id: eventId, organizer: newOrganizer.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setActionMsg(`Organizer ${action === "add" ? "added" : "removed"} (tx ${d.tx_hash.slice(0, 12)}…)`);
      setNewOrganizer("");
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyHash(null);
    }
  };

  const registerEvent = async () => {
    setBusyHash("create-event");
    setError(null);
    setActionMsg(null);
    try {
      const res = await fetch("/api/events/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-organizer-address": savedAddress,
        },
        body: JSON.stringify({
          event_id: createId.trim(),
          name: createName.trim(),
          organizer: savedAddress,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Registration failed");
      setActionMsg(`Event ${d.event_id} registered on-chain (tx ${d.tx_hash.slice(0, 12)}…). Select it above.`);
      setCreateName("");
      setCreateId("");
      await loadEvents();
      setEventId(d.event_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyHash(null);
    }
  };

  const selectedEvent = events.find((e) => e.event_id === eventId);
  const isAdmin = adminAddress !== null && savedAddress === adminAddress;

  const flaggedCount = submissions.filter((s) => s.status === "flagged").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizer dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Review queue access is verified on-chain via the event-registry contract.
          </p>
        </div>
        {!savedAddress && (
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <input
              className="input w-72 mono text-xs"
              placeholder="Organizer wallet address (G…)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-label="Organizer wallet address"
            />
            <button className="btn btn-primary text-xs" onClick={connect} disabled={!address.trim()}>
              Connect
            </button>
            <button className="btn btn-ghost text-xs" onClick={connectFreighter}>
              Freighter
            </button>
          </div>
        )}
      </div>

      {savedAddress && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <Avatar wallet={savedAddress} size={22} />
          <span>
            Acting as{" "}
            <span className="mono">{savedAddress}</span>
            {profile?.name && (
              <> · {profile.name}{profile.organization ? ` (${profile.organization})` : ""}{profile.location ? ` · ${profile.location}` : ""}</>
            )}
            {eventsOrganized.length > 0 && (
              <span className="ml-2 text-accent">on-chain organizer of: {eventsOrganized.join(", ")}</span>
            )}
          </span>
          <button
            className="underline"
            onClick={() => {
              localStorage.removeItem("notari-organizer");
              setSavedAddress("");
              setAddress("");
              setSubmissions([]);
            }}
          >
            switch
          </button>
          <button className="underline" onClick={() => openConnect("organizer")}>
            edit details
          </button>
        </div>
      )}

      {savedAddress && events.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {events.map((ev) => {
            const authorized = ev.organizers.includes(savedAddress);
            return (
              <button
                key={ev.event_id}
                onClick={() => setEventId(ev.event_id)}
                className={`btn flex-col items-start gap-0 text-xs ${
                  eventId === ev.event_id ? "btn-primary" : "btn-ghost"
                }`}
                title={authorized ? "You are an organizer" : "Not an organizer for this event"}
              >
                <span>
                  {authorized ? "✓ " : ""}
                  {ev.name ?? ev.event_id}
                </span>
                <span className="text-[10px] font-normal opacity-70">
                  {ev.name ? `${ev.event_id} · ` : ""}
                  {ev.onchain_records} on-chain record{ev.onchain_records === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      {actionMsg && <p className="mt-4 rounded border border-accent/40 bg-accent/10 p-3 text-sm text-accent">{actionMsg}</p>}

      {eventId && savedAddress && (
        <>
          <section className="mt-10" aria-label="Review queue">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                Review queue <span className="mono text-sm text-muted">({eventId})</span>
              </h2>
              {flaggedCount > 0 && (
                <span className="rounded-full bg-danger/15 px-3 py-1 text-xs font-semibold text-danger">
                  ⚠ {flaggedCount} flagged for review
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-6 text-sm text-muted">Loading queue…</p>
            ) : submissions.length === 0 ? (
              <p className="mt-6 text-sm text-muted">
                No submissions yet for this event — or your address is not an
                authorized organizer for it.
              </p>
            ) : (
              <motion.ul layout className="mt-6 space-y-4">
                <AnimatePresence>
                  {submissions.map((s) => {
                    const topScore = s.similarity?.matches?.[0]?.score ?? 0;
                    const isFlagged = s.status === "flagged";
                    return (
                      <motion.li
                        layout
                        key={s.submission_hash}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`card p-5 ${
                          isFlagged ? `border-l-4 ${severityColor(topScore)}` : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${statusBadge(s.status)}`}>
                                {s.status}
                              </span>
                              {isFlagged && (
                                <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${severityColor(topScore)}`}>
                                  {(topScore * 100).toFixed(0)}% match
                                </span>
                              )}
                            </div>
                            <a
                              href={s.repo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mono mt-2 block truncate text-sm text-accent-2 underline-offset-2 hover:underline"
                            >
                              {s.repo_url}
                            </a>
                            <p className="mono mt-1 text-[11px] text-muted">
                              {s.commit_hash} · team {s.team_wallet.slice(0, 8)}… · hash {s.submission_hash.slice(0, 16)}…
                            </p>
                          </div>
                          <a href={`/verify/${s.submission_hash}`} className="btn btn-ghost text-xs">
                            Verify page →
                          </a>
                        </div>

                        <p className="mt-3 line-clamp-3 text-sm text-muted">{s.description}</p>

                        {isFlagged && s.similarity && (
                          <div className="mt-3 rounded border border-danger/30 bg-danger/5 p-3 text-xs">
                            <p className="font-semibold text-danger">⚠ Advisory flag — human decision required</p>
                            {s.similarity.explanation && (
                              <p className="mt-1 text-muted">{s.similarity.explanation}</p>
                            )}
                            <ul className="mt-2 space-y-1">
                              {(s.similarity.matches ?? []).map((m) => (
                                <li key={m.hash} className="mono text-muted">
                                  {(m.score * 100).toFixed(1)}% · {m.eventId} · {m.hash.slice(0, 16)}…
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          {s.status === "flagged" && (
                            <>
                              <button className="btn btn-primary text-xs" disabled={busyHash === s.submission_hash} onClick={() => act(s.submission_hash, "approve_timestamp")}>
                                Approve lock-in
                              </button>
                              <button className="btn btn-ghost text-xs" disabled={busyHash === s.submission_hash} onClick={() => act(s.submission_hash, "clear")}>
                                Dismiss flag
                              </button>
                              <button className="btn btn-danger text-xs" disabled={busyHash === s.submission_hash} onClick={() => act(s.submission_hash, "reject")}>
                                Reject
                              </button>
                            </>
                          )}
                          {(s.status === "clean" || s.status === "cleared" || s.status === "draft") && (
                            <button className="btn btn-primary text-xs" disabled={busyHash === s.submission_hash} onClick={() => timestamp(s.submission_hash)}>
                              Timestamp on-chain
                            </button>
                          )}
                          {s.status === "timestamped" && s.on_chain && (
                            <span className="mono text-xs text-accent">
                              ✓ ledger {s.on_chain.ledger} · {new Date(s.on_chain.timestamp * 1000).toUTCString()}
                            </span>
                          )}
                          {s.status === "rejected" && (
                            <span className="text-xs text-danger">Rejected — cannot be timestamped.</span>
                          )}
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </motion.ul>
            )}
          </section>

          <section className="mt-12 grid gap-4 lg:grid-cols-2" aria-label="Event management">
            <div className="card p-6">
              <h2 className="text-lg font-semibold">Event management</h2>
              <p className="mt-1 text-xs text-muted">
                Roster changes for <span className="mono">{eventId}</span> are
                transactions on the event-registry contract — allowed for the
                admin or any existing organizer.
              </p>

              {selectedEvent && (
                <div className="mt-4 rounded-lg border border-line bg-background/40 p-4 text-xs">
                  <p className="font-semibold text-foreground">
                    {selectedEvent.name ?? selectedEvent.event_id}
                  </p>
                  <p className="mono mt-1 text-muted">
                    id {selectedEvent.event_id}
                    {selectedEvent.created_at
                      ? ` · registered ${new Date(selectedEvent.created_at * 1000).toLocaleDateString()}`
                      : ""}
                    {` · ${selectedEvent.onchain_records} on-chain record${selectedEvent.onchain_records === 1 ? "" : "s"}`}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  className="input w-72 mono text-xs"
                  placeholder="Organizer wallet address (G…)"
                  value={newOrganizer}
                  onChange={(e) => setNewOrganizer(e.target.value)}
                  aria-label="New organizer address"
                />
                <button className="btn btn-primary text-xs" disabled={busyHash === "org-add" || !newOrganizer.trim()} onClick={() => manageOrganizer("add")}>
                  Add organizer
                </button>
                <button className="btn btn-danger text-xs" disabled={busyHash === "org-remove" || !newOrganizer.trim()} onClick={() => manageOrganizer("remove")}>
                  Remove
                </button>
              </div>
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Current organizers (on-chain)</h3>
                <ul className="mt-2 space-y-1">
                  {(events.find((e) => e.event_id === eventId)?.organizers ?? []).map((o) => (
                    <li key={o} className="mono text-xs text-muted">{o}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-6">
                <h2 className="text-lg font-semibold">Register a new event</h2>
                <p className="mt-1 text-xs text-muted">
                  One sponsored transaction: creates the event on the
                  event-registry and installs you as its first organizer.
                </p>
                <div className="mt-4 space-y-2">
                  <input
                    className="input"
                    placeholder="Event name (e.g. GDG Winter Hack 2026)"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    aria-label="New event name"
                  />
                  <input
                    className="input mono text-xs"
                    placeholder="event_id (a-z, 0-9, _)"
                    value={createId}
                    onChange={(e) =>
                      setCreateId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 32))
                    }
                    aria-label="New event id"
                  />
                  <button
                    className="btn btn-primary w-full text-xs"
                    disabled={busyHash === "create-event" || !createId.trim() || createName.trim().length < 3 || !savedAddress}
                    onClick={registerEvent}
                  >
                    {busyHash === "create-event" ? "Registering on-chain…" : "Register event on-chain"}
                  </button>
                </div>
              </div>

              <div className="card p-6">
                <h3 className="text-sm font-semibold">Registry admin (on-chain)</h3>
                <p className="mono mt-2 break-all text-xs text-muted">{adminAddress ?? "unknown"}</p>
                <p className="mt-2 text-xs text-muted">
                  {isAdmin ? (
                    <span className="text-accent">✓ You are the registry admin — you can manage any event&apos;s roster and register events for others via /register.</span>
                  ) : (
                    "The admin manages cross-event settings. Organizers manage their own event rosters."
                  )}
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {!savedAddress && (
        <div className="card mt-12 p-8 text-center">
          <p className="text-sm text-muted">
            Connect an organizer wallet to load your event&apos;s review queue.
            Authorization is checked against the event-registry contract — no
            off-chain roles.
          </p>
          <p className="mt-3 text-sm text-muted">
            Running a new hackathon?{" "}
            <a href="/register" className="text-accent underline">
              Register your event on-chain →
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
