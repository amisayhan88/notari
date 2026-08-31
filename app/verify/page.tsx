"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyIndexPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lookup?q=${encodeURIComponent(q.trim())}`);
      const d = await res.json();
      if (!res.ok || !d.hash) {
        throw new Error(d.error ?? "No submission matches that query.");
      }
      router.push(`/verify/${d.hash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Verify a submission
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted">
        Paste a repo URL, commit hash, or submission hash. Provenance comes
        straight from the submission-registry contract — no account needed.
      </p>

      <div className="mt-8 flex gap-2">
        <input
          className="input mono text-xs"
          placeholder="https://github.com/team/project · 9f86d08… · or a 64-char submission hash"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          aria-label="Submission lookup"
        />
        <button className="btn btn-primary shrink-0" onClick={search} disabled={busy || !q.trim()}>
          {busy ? "Searching…" : "Look up"}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <div className="card mt-12 p-6 text-left text-sm text-muted">
        <h2 className="font-semibold text-foreground">What you&apos;ll see</h2>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Every event the submission hash was recorded under, in order.</li>
          <li>The ledger close time for each record — the trusted timestamp.</li>
          <li>
            A red, pulsing multi-event trail when the same content shows up
            across events — plus a plain-text timeline so color is never the
            only signal.
          </li>
        </ul>
      </div>
    </div>
  );
}
