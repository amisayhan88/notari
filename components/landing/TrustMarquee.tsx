"use client";

import { motion, useReducedMotion } from "framer-motion";

const items = [
  "FIEM ACM",
  "Hack4Bengal",
  "on-chain provenance",
  "advisory AI review",
  "zero-XLM submissions",
  "your community here?",
];

export default function TrustMarquee() {
  const reduce = useReducedMotion();
  const row = [...items, ...items];

  return (
    <section className="overflow-hidden border-y border-line bg-panel/40 py-4">
      {reduce ? (
        <div className="flex flex-wrap justify-center gap-8 px-4">
          {items.map((t) => (
            <span key={t} className="text-sm text-muted">
              {t}
            </span>
          ))}
        </div>
      ) : (
        <motion.div
          className="flex w-max gap-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 26, ease: "linear", repeat: Infinity }}
        >
          {row.map((t, i) => (
            <span key={i} className="flex items-center gap-8 text-sm text-muted">
              {t}
              <span aria-hidden className="text-accent">✦</span>
            </span>
          ))}
        </motion.div>
      )}
    </section>
  );
}
