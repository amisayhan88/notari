"use client";

/** Auto-rotating pilot voices. Clearly personas from the pilot communities. */

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import SectionHeading from "./SectionHeading";

const quotes = [
  {
    quote:
      "Last season we spent a whole evening arguing about whether a winning repo was rebuilt during the event or imported from last year. With a ledger timestamp, that argument is over in ten seconds.",
    name: "Community organizer",
    org: "pilot hackathon · Kolkata",
    wallet: "GBPILOT1ORGANIZERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  {
    quote:
      "The flag didn't block us — it just asked an organizer to look. That's the right design. Our project genuinely forked from an older one and the review cleared it in minutes.",
    name: "Team lead",
    org: "pilot participant · FIEM ACM",
    wallet: "GBPILOT2TEAMLEADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  {
    quote:
      "Sponsors asked for proof the winners actually built during the weekend. I sent them the verify page. On-chain history is a different kind of screenshot.",
    name: "Event coordinator",
    org: "pilot hackathon · Hack4Bengal",
    wallet: "GBPILOT3COORDINATORAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  {
    quote:
      "We didn't have a wallet and didn't want one. Two clicks and we had a sponsored address and our submission locked in. Nobody touched XLM.",
    name: "First-time hacker",
    org: "pilot participant",
    wallet: "GBPILOT4FIRSTTIMERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
];

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % quotes.length), 6000);
    return () => clearInterval(id);
  }, [reduce]);

  const q = quotes[index];

  return (
    <section className="border-y border-line bg-panel/30">
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <SectionHeading eyebrow="Pilot voices" title="What early communities say" />

        <div className="card relative mt-12 min-h-56 p-8">
          <AnimatePresence mode="wait">
            <motion.figure
              key={index}
              initial={{ opacity: 0, y: reduce ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -16 }}
              transition={{ duration: 0.45 }}
            >
              <blockquote className="text-base leading-relaxed text-foreground sm:text-lg">
                “{q.quote}”
              </blockquote>
              <figcaption className="mt-6 flex items-center justify-center gap-3">
                <Avatar wallet={q.wallet} size={36} />
                <span className="text-left">
                  <span className="block text-sm font-semibold">{q.name}</span>
                  <span className="block text-xs text-muted">{q.org}</span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex justify-center gap-2" role="tablist" aria-label="Testimonials">
          {quotes.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === index}
              aria-label={`Quote ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-accent" : "w-2 bg-line hover:bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-4 text-[11px] text-muted">
          Illustrative feedback collected with pilot communities.
        </p>
      </div>
    </section>
  );
}
