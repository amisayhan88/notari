"use client";

/**
 * "See it working" — the registry feed, live from the app database with
 * links straight to the on-chain verify pages. Proves the pipeline end to
 * end without leaving the landing page.
 */

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import SectionHeading from "./SectionHeading";

export interface FeedItem {
  hash: string;
  eventId: string;
  repoUrl: string;
  status: string;
  createdAt: string;
}

function statusBadge(status: string) {
  const map: Record<string, { cls: string; label: string }> = {
    draft: { cls: "bg-line text-muted", label: "draft" },
    clean: { cls: "bg-accent/15 text-accent", label: "clean" },
    flagged: { cls: "bg-danger/15 text-danger", label: "⚠ flagged" },
    timestamped: { cls: "bg-accent/25 text-accent", label: "✓ on-chain" },
    cleared: { cls: "bg-accent-2/15 text-accent-2", label: "cleared" },
    rejected: { cls: "bg-danger/30 text-danger", label: "rejected" },
  };
  return map[status] ?? { cls: "bg-line text-muted", label: status };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LiveRegistry({ items }: { items: FeedItem[] }) {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="See it working"
          title="The registry, live from testnet"
          body="Real submissions flowing through the pipeline right now — click any of them and read its provenance straight from the contract."
        />
        <p className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
          <motion.span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-accent"
            animate={reduce ? undefined : { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          live feed
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-sm text-muted">
          The registry is empty — be the first:{" "}
          <Link href="/submit" className="text-accent underline">
            submit a project
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-10 grid gap-3 md:grid-cols-2">
          {items.map((item, i) => {
            const badge = statusBadge(item.status);
            const card = (
              <div className="card flex items-center justify-between gap-4 p-4 transition-colors hover:border-accent-2/60">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="mono text-xs text-muted">{item.eventId}</span>
                    <span className="text-[10px] text-muted">· {timeAgo(item.createdAt)}</span>
                  </div>
                  <p className="mono mt-2 truncate text-xs text-accent-2">{item.repoUrl}</p>
                  <p className="mono mt-1 truncate text-[10px] text-muted">
                    sha256 {item.hash.slice(0, 34)}…
                  </p>
                </div>
                <span aria-hidden className="shrink-0 text-muted">→</span>
              </div>
            );
            return reduce ? (
              <li key={item.hash}>
                <Link href={`/verify/${item.hash}`} aria-label={`Verify submission ${item.hash.slice(0, 12)} from ${item.eventId}`}>
                  {card}
                </Link>
              </li>
            ) : (
              <motion.li
                key={item.hash}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 2) * 0.08 + Math.floor(i / 2) * 0.05 }}
              >
                <Link href={`/verify/${item.hash}`} aria-label={`Verify submission ${item.hash.slice(0, 12)} from ${item.eventId}`}>
                  {card}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}

      <div className="card mt-6 flex flex-col items-start justify-between gap-3 p-5 text-sm text-muted sm:flex-row sm:items-center">
        <p>
          <span className="font-semibold text-foreground">How each row gets here:</span>{" "}
          POST /api/submissions → canonical sha256 → advisory similarity check →
          organizer lock-in via <span className="mono text-xs">submission_registry.record()</span>.
        </p>
        <Link href="/verify" className="btn btn-ghost shrink-0 text-xs">
          Open verification →
        </Link>
      </div>
    </section>
  );
}
