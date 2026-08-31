"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function SectionHeading({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  const reduce = useReducedMotion();
  const inner = (
    <>
      <p className="text-sm font-semibold uppercase tracking-widest text-accent">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {body && (
        <p className={`mt-3 max-w-2xl text-base leading-relaxed text-muted ${center ? "mx-auto" : ""}`}>
          {body}
        </p>
      )}
    </>
  );
  if (reduce) return <div className={center ? "text-center" : ""}>{inner}</div>;
  return (
    <motion.div
      className={center ? "text-center" : ""}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {inner}
    </motion.div>
  );
}
