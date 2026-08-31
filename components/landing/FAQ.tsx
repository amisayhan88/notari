"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState } from "react";
import SectionHeading from "./SectionHeading";

const faqs = [
  {
    q: "What exactly goes on-chain?",
    a: "Only the canonical sha256 hash of your submission, an IPFS metadata pointer, the team wallet, the event id and the ledger timestamp. Your description and repo content live off-chain — the chain stores the fingerprint, not the file.",
  },
  {
    q: "Can the AI flag reject my submission?",
    a: "No. Similarity matches are advisory only: they surface in the organizer review queue with an explanation, and a human approves, dismisses or rejects. The only automatic rejection is the contract's exact-hash duplicate check.",
  },
  {
    q: "Do teams need a wallet or XLM?",
    a: "Neither. Teams can generate a sponsored testnet address in-app, and the event issuer pays every recording transaction's fee. Freighter works too if you already have a wallet.",
  },
  {
    q: "What stops an organizer from gaming the registry?",
    a: "Organizer authority is on-chain (event-registry RBAC), records are immutable once written, and the verify page reads straight from the contract — an organizer can't edit history or hide a record that exists.",
  },
  {
    q: "My project legitimately continues between events. Will I be flagged?",
    a: "Possibly — and that's fine. A flag is a conversation, not a verdict. Your verify page will show the full multi-event provenance, which is honest: judges can see the project grew instead of being smuggled in.",
  },
  {
    q: "Is this mainnet?",
    a: "No. Everything runs on Soroban testnet. The contracts, patterns and UX are production-shaped, but no real value is at stake.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-3xl px-4 py-24">
      <SectionHeading eyebrow="FAQ" title="Fair questions" center />
      <div className="mt-10 space-y-3">
        {faqs.map((f, i) => (
          <div key={f.q} className="card overflow-hidden">
            <button
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
            >
              <span className="font-medium">{f.q}</span>
              <motion.span
                aria-hidden
                animate={{ rotate: open === i ? 45 : 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}
                className="text-xl text-accent"
              >
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.3, ease: "easeInOut" }}
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
