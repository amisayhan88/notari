import type { Metadata } from "next";
import Link from "next/link";
import TimelineScene from "@/components/TimelineScene";
import { getSubmissionHistory } from "@/lib/stellar/contracts";
import { getSubmissionByHash } from "@/lib/submissions";

export const metadata: Metadata = {
  title: "Verification",
};

export const dynamic = "force-dynamic";

interface RecordView {
  eventId: string;
  team: string;
  recordedBy: string;
  metadataCid: string;
  timestamp: number;
  ledger: number;
}

function formatDate(unix: number): string {
  return new Date(unix * 1000).toUTCString();
}

export default async function VerifyPage({ params }: PageProps<"/verify/[hash]">) {
  const { hash } = await params;
  const normalized = (hash ?? "").trim().toLowerCase();
  const valid = /^[0-9a-f]{64}$/.test(normalized);

  let records: RecordView[] = [];
  let lookupError: string | null = null;

  if (!valid) {
    lookupError = "That doesn't look like a submission hash (64 hex characters).";
  } else {
    try {
      records = await getSubmissionHistory(normalized);
    } catch (err) {
      lookupError = err instanceof Error ? err.message : "Chain read failed";
    }
  }

  const appRow = valid ? await getSubmissionByHash(normalized).catch(() => null) : null;
  const similarity = (appRow?.similarity ?? null) as {
    flagged?: boolean;
    explanation?: string;
    matches?: { eventId: string; score: number }[];
  } | null;

  const suspicious = records.length > 1 || Boolean(similarity?.flagged);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="mono mb-2 text-xs text-muted">
        /verify/{normalized.slice(0, 24)}…
      </p>

      {!valid || lookupError ? (
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold">Can&apos;t verify this</h1>
          <p className="mt-2 text-sm text-muted">{lookupError}</p>
          <Link href="/verify" className="btn btn-ghost mt-5">← Try another lookup</Link>
        </div>
      ) : records.length === 0 ? (
        <div className="card p-8 text-center">
          <h1 className="text-xl font-semibold">Not recorded on-chain</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            This hash has never been recorded by the submission-registry
            contract. If it was submitted through this app, it is still in
            draft and hasn&apos;t been locked in by an organizer yet.
          </p>
          <Link href="/verify" className="btn btn-ghost mt-5">← Try another lookup</Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Provenance report
              </h1>
              <p className="mono mt-2 max-w-2xl break-all text-xs text-muted">{normalized}</p>
            </div>
            {suspicious ? (
              <p
                role="status"
                className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger"
              >
                ⚠ FLAGGED — recorded under {records.length} event{records.length > 1 ? "s" : ""} /
                carries an advisory similarity flag
              </p>
            ) : (
              <p
                role="status"
                className="rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent"
              >
                ✓ VERIFIED — single clean on-chain record
              </p>
            )}
          </div>

          <div className="card stage-dark mt-8 h-80 overflow-hidden sm:h-96">
            <TimelineScene
              records={records.map((r) => ({
                eventId: r.eventId,
                timestamp: r.timestamp,
                ledger: r.ledger,
              }))}
              suspicious={suspicious}
            />
          </div>

          {/* Text timeline — the color-independent, screen-reader-friendly twin
              of the 3D scene. Always rendered; the red-flag state is never
              conveyed by color alone. */}
          <section className="card mt-6 p-6" aria-label="Provenance timeline (text)">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              On-chain history (read from the contract)
            </h2>
            <ol className="mt-4 space-y-4">
              {records.map((r, i) => (
                <li key={`${r.eventId}-${r.ledger}`} className="flex gap-4">
                  <span
                    aria-hidden
                    className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${
                      suspicious ? "bg-danger" : "bg-accent"
                    }`}
                  />
                  <div>
                    <p className="font-semibold">
                      {suspicious && <span aria-hidden>⚠ </span>}
                      {r.eventId}
                      <span className="ml-2 text-xs font-normal text-muted">
                        {i === 0 ? "first recorded" : `also recorded (${i + 1} of ${records.length})`}
                      </span>
                    </p>
                    <p className="mono mt-1 text-xs text-muted">
                      ledger {r.ledger} · {formatDate(r.timestamp)}
                    </p>
                    <p className="mono mt-1 text-xs text-muted">
                      team {r.team.slice(0, 12)}… · recorded by {r.recordedBy.slice(0, 12)}…
                    </p>
                    <p className="mono mt-1 break-all text-xs text-muted">
                      metadata: {r.metadataCid}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {similarity?.flagged && (
            <section className="card mt-6 border-danger/40 bg-danger/5 p-6" aria-label="Advisory similarity flag">
              <h2 className="font-semibold text-danger">⚠ Advisory similarity flag (off-chain)</h2>
              {similarity.explanation && (
                <p className="mt-2 text-sm text-muted">{similarity.explanation}</p>
              )}
              <p className="mt-3 text-xs text-muted">
                This flag was produced off-chain by the AI similarity layer. It
                is advisory: an organizer makes the final call. The on-chain
                records above are unaffected by it.
              </p>
            </section>
          )}

          <section className="card mt-6 border-accent/30 bg-accent/5 p-6 text-sm leading-relaxed text-muted">
            <p>
              <strong className="text-foreground">Trust model:</strong> the
              records above are returned directly by the submission-registry
              contract on Soroban testnet
              {process.env.SUBMISSION_REGISTRY_CONTRACT_ID ? (
                <span className="mono text-xs"> ({process.env.SUBMISSION_REGISTRY_CONTRACT_ID})</span>
              ) : null}
              . Exact-duplicate rejection — the same hash twice in one event —
              is enforced by the contract itself and cannot be overridden by
              this website.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
