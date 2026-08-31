"use client";

/**
 * "What gets caught" — user-behavior examples with animated similarity
 * meters. Shows exactly how each kind of behavior is treated, and keeps the
 * trustless/advisory split visible.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import SectionHeading from "./SectionHeading";

function Meter({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className="h-2 w-full overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`similarity ${value}%`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: reduce ? `${value}%` : "0%" }}
        animate={{ width: inView || reduce ? `${value}%` : "0%" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
    </div>
  );
}

const cases = [
  {
    title: "The lazy duplicate",
    verdict: "REJECTED — on-chain, trustless",
    tone: "#ff5d6c",
    similarity: 100,
    story:
      "Same repo, same commit, same team wallet, same event. Canonical hash is identical, so the contract refuses the second record before it ever touches the ledger.",
    detail: "No AI involved. The hash is the whole argument.",
  },
  {
    title: "The tweaked resubmission",
    verdict: "FLAGGED — organizer decides",
    tone: "#ffb454",
    similarity: 98,
    story:
      "Same project, new README sentence, different team name, different event. Hashes differ — but the embedding similarity is 98%, so the review queue lights up with an explanation.",
    detail: "Advisory: the team still submits; a human approves, dismisses or rejects.",
  },
  {
    title: "The honest iteration",
    verdict: "ALLOWED — same event is your sandbox",
    tone: "#38e1b0",
    similarity: 12,
    story:
      "A team pushes a new commit and resubmits within their own event. Same-event history is excluded from the comparison pool — iterating on your own build is normal.",
    detail: "Cross-event comparison only; in-event iteration never flags.",
  },
];

export default function BehaviorExamples() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <SectionHeading
        eyebrow="User behavior, handled"
        title="Three ways people cheat — and what happens"
        body="notari is built around real hackathon behavior. Here is exactly how each pattern is treated, and which layer does the work."
      />
      <div className="mt-12 space-y-5">
        {cases.map((c, i) =>
          reduce ? (
            <div key={c.title} className="card p-6" style={{ borderLeft: `4px solid ${c.tone}` }}>
              <CaseBody c={c} />
            </div>
          ) : (
            <motion.div
              key={c.title}
              className="card p-6"
              style={{ borderLeft: `4px solid ${c.tone}` }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
            >
              <CaseBody c={c} />
            </motion.div>
          ),
        )}
      </div>
    </section>
  );
}

function CaseBody({ c }: { c: (typeof cases)[number] }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">{c.title}</h3>
          <span
            className="rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
            style={{ color: c.tone, background: `${c.tone}1a`, border: `1px solid ${c.tone}55` }}
          >
            {c.verdict}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{c.story}</p>
        <p className="mt-2 text-xs text-muted">{c.detail}</p>
      </div>
      <div className="flex flex-col justify-center gap-2">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>cross-event similarity</span>
          <span className="mono" style={{ color: c.tone }}>{c.similarity}%</span>
        </div>
        <Meter value={c.similarity} color={c.tone} />
      </div>
    </div>
  );
}
