"use client";

/** Benefit grid with animated inline SVG icons — no external image assets. */

import { motion, useReducedMotion } from "framer-motion";
import SectionHeading from "./SectionHeading";

function IconClock() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="13" stroke="#38e1b0" strokeWidth="2" />
      <path d="M17 9v8l5 4" stroke="#38e1b0" strokeWidth="2" strokeLinecap="round" className="icon-clock-hand" style={{ transformOrigin: "17px 17px" }} />
      <style>{`.icon-clock-hand { animation: icon-sweep 6s linear infinite; } @keyframes icon-sweep { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .icon-clock-hand { animation: none; } }`}</style>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <path d="M17 3l11 4v8c0 7-4.5 12.5-11 16C10.5 27.5 6 22 6 15V7l11-4z" stroke="#5ba8ff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 17l3.2 3.2L22 13.5" stroke="#5ba8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <path d="M3 17s5-8 14-8 14 8 14 8-5 8-14 8S3 17 3 17z" stroke="#ffb454" strokeWidth="2" />
      <circle cx="17" cy="17" r="4" stroke="#ffb454" strokeWidth="2" className="icon-eye-pupil" />
      <style>{`.icon-eye-pupil { animation: icon-blink 4s ease-in-out infinite; transform-origin: 17px 17px; } @keyframes icon-blink { 0%, 92%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.1); } } @media (prefers-reduced-motion: reduce) { .icon-eye-pupil { animation: none; } }`}</style>
    </svg>
  );
}

function IconScale() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <path d="M17 5v24M9 29h16" stroke="#38e1b0" strokeWidth="2" strokeLinecap="round" />
      <path d="M17 7L7 11m10-4l10 4" stroke="#38e1b0" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17a3 3 0 006 0l-3-6-3 6zM24 17a3 3 0 006 0l-3-6-3 6z" stroke="#38e1b0" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <path d="M8 30V5" stroke="#ff5d6c" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6h16l-4 5 4 5H8" stroke="#ff5d6c" strokeWidth="2" strokeLinejoin="round" className="icon-flag-wave" />
      <style>{`.icon-flag-wave { animation: icon-wave 2.6s ease-in-out infinite; transform-origin: 8px 11px; } @keyframes icon-wave { 0%, 100% { transform: skewY(0deg); } 50% { transform: skewY(-3deg); } } @media (prefers-reduced-motion: reduce) { .icon-flag-wave { animation: none; } }`}</style>
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="13" stroke="#5ba8ff" strokeWidth="2" />
      <ellipse cx="17" cy="17" rx="6" ry="13" stroke="#5ba8ff" strokeWidth="1.5" />
      <path d="M4.5 13h25M4.5 21h25" stroke="#5ba8ff" strokeWidth="1.5" />
    </svg>
  );
}

const benefits = [
  { icon: <IconClock />, title: "Proof of when", body: "Ledger close times are produced by the network, not by us. A timestamped submission proves it existed at that moment — verifiable by anyone." },
  { icon: <IconShield />, title: "Duplicates can't hide", body: "The same repo, commit and team wallet produces the same hash — and the contract rejects a second copy in the same event. No moderation queue required." },
  { icon: <IconFlag />, title: "Resubmissions surface", body: "A tweaked README and a new team name don't fool the embedding layer. Likely cross-event repeats are flagged with an explanation before judging." },
  { icon: <IconScale />, title: "Humans stay in charge", body: "AI only advises. Approving, dismissing or rejecting a flag is always an organizer's explicit, recorded decision." },
  { icon: <IconEye />, title: "Radically verifiable", body: "Winners, sponsors and rival teams can all open the verify page and read the same on-chain history. Disputes end with evidence, not arguments." },
  { icon: <IconGlobe />, title: "Zero-friction for teams", body: "No wallet needed, no XLM needed — sponsored transactions cover the fees. Identity takes 2 minutes, proof lasts forever." },
];

export default function Benefits() {
  const reduce = useReducedMotion();
  return (
    <section className="border-y border-line bg-panel/30">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          eyebrow="Why it helps"
          title="What changes when submissions have provenance"
          center
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) =>
            reduce ? (
              <div key={b.title} className="card p-6">
                <div className="mb-4">{b.icon}</div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
              </div>
            ) : (
              <motion.div
                key={b.title}
                className="card p-6 transition-transform hover:-translate-y-1"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: (i % 3) * 0.1 }}
              >
                <div className="mb-4">{b.icon}</div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{b.body}</p>
              </motion.div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}
