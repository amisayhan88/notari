"use client";

import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";

export default function FinalCTA() {
  const reduce = useReducedMotion();
  const card = (
    <div className="card relative overflow-hidden border-accent/30 p-10 text-center sm:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(56,225,176,0.14),transparent_60%)]"
      />
      <div className="relative">
        <div className="flex justify-center">
          <Logo size={44} />
        </div>
        <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
          Put your next event on the record.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Teams lock in their work in minutes. Organizers get a review queue
          instead of a rumor mill. Everyone gets proof that survives the
          afterparty.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/submit" className="btn btn-primary">Submit a project</a>
          <a href="/register" className="btn btn-ghost">Register as organizer</a>
          <a href="/verify" className="btn btn-ghost">Verify a submission</a>
        </div>
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      {reduce ? (
        card
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {card}
        </motion.div>
      )}
    </section>
  );
}
