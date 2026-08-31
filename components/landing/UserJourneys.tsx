"use client";

/** Two swim-lanes: what a team experiences vs what an organizer experiences. */

import { motion, useReducedMotion } from "framer-motion";
import SectionHeading from "./SectionHeading";

const teamSteps = [
  { t: "Lock in your build", d: "Repo, commit and description in a 2-minute form. No wallet? Get a sponsored one in-app." },
  { t: "See your check instantly", d: "The advisory similarity result appears before you walk away — no surprises at judging." },
  { t: "Get timestamped", d: "Your organizer locks it on-chain. The ledger close time becomes your proof of when." },
  { t: "Show the proof", d: "Share your verify page. Anyone can independently confirm your submission's record." },
];

const organizerSteps = [
  { t: "Register your event", d: "On-chain event with organizer RBAC — add or remove co-organizer wallets any time." },
  { t: "Watch the queue", d: "Submissions arrive with similarity scores. Flags are color-coded; clean rows stay quiet." },
  { t: "Decide on flags", d: "Approve, dismiss or reject — every advisory flag waits for your call. Nothing auto-rejects." },
  { t: "Publish with provenance", d: "Results link to verification pages. Winner claims become independently checkable." },
];

function Lane({
  title,
  accent,
  steps,
  delay,
}: {
  title: string;
  accent: string;
  steps: { t: string; d: string }[];
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="card relative p-6">
      <h3 className="text-lg font-semibold" style={{ color: accent }}>
        {title}
      </h3>
      <ol className="relative mt-5 space-y-6 border-l border-line pl-6">
        {steps.map((s, i) =>
          reduce ? (
            <li key={s.t} className="relative">
              <span
                aria-hidden
                className="absolute -left-[31px] top-1 inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: accent }}
              />
              <p className="font-medium">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </li>
          ) : (
            <motion.li
              key={s.t}
              className="relative"
              initial={{ opacity: 0, x: -18 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: delay + i * 0.15 }}
            >
              <span
                aria-hidden
                className="absolute -left-[31px] top-1 inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 10px 1px ${accent}66` }}
              />
              <p className="font-medium">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </motion.li>
          ),
        )}
      </ol>
    </div>
  );
}

export default function UserJourneys() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <SectionHeading
        eyebrow="User journeys"
        title="Built around the two people who matter"
        body="Teams want proof their work is theirs. Organizers want a defensible record without policing spreadsheets. Both flows are four steps."
        center
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Lane title="For teams" accent="#5ba8ff" steps={teamSteps} delay={0} />
        <Lane title="For organizers" accent="#38e1b0" steps={organizerSteps} delay={0.2} />
      </div>
    </section>
  );
}
