"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import WalletOnboarding from "@/components/WalletOnboarding";
import { useAuth } from "@/components/auth/AuthProvider";
import Avatar from "@/components/Avatar";

interface SimilarityMatch {
  hash: string;
  eventId: string;
  score: number;
  teamWallet: string;
}

interface SimilarityResponse {
  flagged: boolean;
  matches: SimilarityMatch[];
  explanation: string | null;
  threshold: number;
  note: string;
}

const stepVariants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export default function SubmitPage() {
  const { wallet: authWallet, profile, openConnect } = useAuth();
  const [step, setStep] = useState(0);
  const [events, setEvents] = useState<string[]>([]);
  const [form, setForm] = useState({
    eventId: "",
    repoUrl: "",
    commitHash: "",
    description: "",
    teamWallet: "",
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<SimilarityResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => setEvents((d.events ?? []).map((e: { event_id: string }) => e.event_id)))
      .catch(() => setEvents([]));
  }, []);

  // Prefill the team wallet from the connected identity.
  useEffect(() => {
    if (authWallet) {
      setForm((f) => (f.teamWallet ? f : { ...f, teamWallet: authWallet }));
    }
  }, [authWallet]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setFieldError(null);
  };

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.eventId) return "Choose your event.";
      if (!/^https:\/\/[^\s]+\.[^\s]+/.test(form.repoUrl.trim())) return "Repo URL must be an https link.";
      if (!/^[0-9a-f]{7,40}$/i.test(form.commitHash.trim())) return "Commit hash must be 7-40 hex characters.";
    }
    if (step === 1) {
      if (form.description.trim().length < 20) return "Describe your project in at least 20 characters.";
    }
    if (step === 2) {
      if (!form.teamWallet.startsWith("G") || form.teamWallet.length !== 56)
        return "Connect a wallet or generate a sponsored one to continue.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep();
    if (err) return setFieldError(err);
    setStep((s) => s + 1);
  };

  const finish = useCallback(async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_id: form.eventId,
          repo_url: form.repoUrl.trim(),
          commit_hash: form.commitHash.trim(),
          description: form.description.trim(),
          team_wallet: form.teamWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setHash(data.hash);

      const simRes = await fetch("/api/similarity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hash: data.hash }),
      });
      const sim = await simRes.json();
      if (!simRes.ok) throw new Error(sim.error ?? "Similarity check failed");
      setSimilarity(sim);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [form]);

  const progress = hash ? 4 : step;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Submit your project</h1>
      <p className="mt-2 text-sm text-muted">
        Lock in what you built. Your submission gets a canonical hash and an
        advisory similarity check before the organizer timestamps it on-chain.
      </p>

      <ol className="mt-8 flex items-center gap-2" aria-label="Progress">
        {["Project", "Description", "Wallet", "Review"].map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                i <= progress ? "bg-accent" : "bg-line"
              }`}
            />
            <span
              className={`hidden text-xs sm:inline ${
                i <= progress ? "text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
            {i < 3 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {step === 0 && !hash && (
            <motion.div key="s0" variants={stepVariants} initial="enter" animate="center" exit="exit" className="card space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="event">Event</label>
                <select id="event" className="input" value={form.eventId} onChange={set("eventId")}>
                  <option value="">Select your hackathon…</option>
                  {events.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="repo">Repository URL</label>
                <input id="repo" className="input mono text-xs" placeholder="https://github.com/team/project" value={form.repoUrl} onChange={set("repoUrl")} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="commit">Commit hash (final submission commit)</label>
                <input id="commit" className="input mono text-xs" placeholder="9f86d08…" value={form.commitHash} onChange={set("commitHash")} />
              </div>
              <div className="flex justify-end">
                <button className="btn btn-primary" onClick={next}>Continue →</button>
              </div>
            </motion.div>
          )}

          {step === 1 && !hash && (
            <motion.div key="s1" variants={stepVariants} initial="enter" animate="center" exit="exit" className="card space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="desc">Project description</label>
                <textarea
                  id="desc"
                  className="input min-h-40"
                  placeholder="What does it do, how does it work, what did you build during the event?"
                  value={form.description}
                  onChange={set("description")}
                />
                <p className="mt-1 text-xs text-muted">
                  This text is embedded for the advisory similarity check and
                  stored with your metadata — write it like a judge will read it.
                </p>
              </div>
              <div className="flex justify-between">
                <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
                <button className="btn btn-primary" onClick={next}>Continue →</button>
              </div>
            </motion.div>
          )}

          {step === 2 && !hash && (
            <motion.div key="s2" variants={stepVariants} initial="enter" animate="center" exit="exit" className="space-y-4">
              {authWallet ? (
                <div className="card flex flex-wrap items-center justify-between gap-3 border-accent/40 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar wallet={authWallet} size={34} />
                    <div>
                      <p className="text-sm font-semibold">
                        {profile?.name ?? "Connected wallet"}
                        {profile?.organization && (
                          <span className="ml-2 text-xs font-normal text-muted">· {profile.organization}</span>
                        )}
                      </p>
                      <p className="mono text-xs text-muted">{authWallet}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary text-xs"
                      onClick={() => setForm((f) => ({ ...f, teamWallet: authWallet }))}
                    >
                      {form.teamWallet === authWallet ? "Using this wallet ✓" : "Use this wallet"}
                    </button>
                    <button className="btn btn-ghost text-xs" onClick={() => openConnect("team")}>
                      Switch
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-muted">
                    Connect your wallet to use it as your team identity — or
                    generate a sponsored one below.
                  </p>
                  <button className="btn btn-primary text-xs" onClick={() => openConnect("team")}>
                    Connect wallet
                  </button>
                </div>
              )}
              <WalletOnboarding onWallet={(addr) => setForm((f) => ({ ...f, teamWallet: addr }))} />
              {form.teamWallet && (
                <p className="text-sm text-accent">
                  Team wallet: <span className="mono text-xs">{form.teamWallet}</span>
                </p>
              )}
              <div className="flex justify-between">
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" onClick={next}>Continue →</button>
              </div>
            </motion.div>
          )}

          {step === 3 && !hash && (
            <motion.div key="s3" variants={stepVariants} initial="enter" animate="center" exit="exit" className="card space-y-4 p-6">
              <h2 className="text-lg font-semibold">Lock it in?</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Event</dt><dd className="mono text-xs">{form.eventId}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Repo</dt><dd className="mono max-w-60 truncate text-xs">{form.repoUrl}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Commit</dt><dd className="mono text-xs">{form.commitHash}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Team wallet</dt><dd className="mono text-xs">{form.teamWallet.slice(0, 12)}…</dd></div>
              </dl>
              <p className="text-xs text-muted">
                Submitting creates the canonical hash and immediately runs the
                advisory cross-event similarity check so you see exactly what
                an organizer will see.
              </p>
              {apiError && <p role="alert" className="text-sm text-danger">{apiError}</p>}
              <div className="flex justify-between">
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary" disabled={submitting} onClick={finish}>
                  {submitting ? "Hashing + checking…" : "Submit & run similarity check"}
                </button>
              </div>
            </motion.div>
          )}

          {hash && similarity && (
            <motion.div key="done" variants={stepVariants} initial="enter" animate="center" className="space-y-4">
              <div className="card border-accent/40 p-6">
                <h2 className="text-lg font-semibold text-accent">Submission received ✓</h2>
                <p className="mt-1 text-sm text-muted">Canonical hash:</p>
                <p className="mono mt-1 break-all text-xs">{hash}</p>
                <a href={`/verify/${hash}`} className="btn btn-ghost mt-4 text-xs">View public verification page →</a>
              </div>

              {similarity.flagged ? (
                <div className="card border-danger/50 bg-danger/5 p-6" role="alert">
                  <h3 className="flex items-center gap-2 font-semibold text-danger">
                    <span aria-hidden>⚠</span> Flagged for organizer review
                  </h3>
                  <p className="mt-2 text-sm text-muted">{similarity.explanation}</p>
                  <ul className="mt-3 space-y-2">
                    {similarity.matches.map((m) => (
                      <li key={m.hash} className="rounded border border-danger/30 p-3 text-xs">
                        <p className="mono">{(m.score * 100).toFixed(1)}% similar · {m.eventId}</p>
                        <p className="mono mt-1 break-all text-muted">{m.hash}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-muted">
                    This is ADVISORY — it does not block you. An organizer
                    reviews the match and decides. Nothing auto-rejects on
                    similarity alone.
                  </p>
                </div>
              ) : (
                <div className="card border-accent/40 bg-accent/5 p-6">
                  <h3 className="font-semibold text-accent">Similarity check passed ✓</h3>
                  <p className="mt-2 text-sm text-muted">{similarity.note}</p>
                  <p className="mt-2 text-xs text-muted">
                    Your organizer can now timestamp this on-chain — the
                    contract will then trustlessly reject any exact duplicate
                    of it in this event.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {fieldError && !hash && (
          <p role="alert" className="mt-3 text-sm text-danger">{fieldError}</p>
        )}
      </div>
    </div>
  );
}
