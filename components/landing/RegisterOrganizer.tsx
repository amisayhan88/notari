"use client";

/** Landing section: become an organizer — three steps, one on-chain act. */

import { motion, useReducedMotion } from "framer-motion";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    n: "1",
    title: "Connect your wallet",
    body: "Freighter if you have one, or generate a sponsored testnet wallet in two clicks. Your address is your organizer identity.",
  },
  {
    n: "2",
    title: "Name your event",
    body: "Pick an event id and a display name. We validate the id against Soroban's Symbol rules before anything touches the chain.",
  },
  {
    n: "3",
    title: "Registered on-chain",
    body: "One sponsored transaction writes your event into the event-registry and installs you as its first organizer. Nobody can gatekeep you.",
  },
];

export default function RegisterOrganizer() {
  const reduce = useReducedMotion();

  return (
    <section className="border-y border-line bg-panel/30">
      <div className="mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          eyebrow="Register as an organizer"
          title="Put your hackathon on the registry"
          body="No forms to approve, no waiting list. Registering an event is a single sponsored transaction — you become an on-chain organizer with a review queue, duplicate rejection and public verification for every submission."
          center
        />

        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          <div aria-hidden className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-line md:block" />
          {steps.map((s, i) =>
            reduce ? (
              <StepCard key={s.n} step={s} />
            ) : (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <StepCard step={s} />
              </motion.div>
            ),
          )}
        </div>

        <div className="mt-10 text-center">
          <a href="/register" className="btn btn-primary">
            Register your event →
          </a>
          <p className="mono mt-3 text-xs text-muted">
            free · sponsored transaction · zero XLM required
          </p>
        </div>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: { n: string; title: string; body: string } }) {
  return (
    <div className="card relative p-6 pt-10 text-left">
      <span className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full border border-accent/50 bg-background font-bold text-accent">
        {step.n}
      </span>
      <h3 className="font-semibold">{step.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
    </div>
  );
}
