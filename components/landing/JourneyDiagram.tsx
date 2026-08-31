"use client";

/**
 * Animated user-flow diagram: submit → canonicalize → AI check → organizer
 * review → on-chain timestamp → public verify. Pure SVG with a CSS
 * motion-path packet traveling the pipeline; static under reduced motion.
 */

import SectionHeading from "./SectionHeading";

const steps = [
  { x: 40, label: "Team submits", sub: "repo + commit + description", tone: "#5ba8ff" },
  { x: 240, label: "Canonical hash", sub: "sha256 · trustless identity", tone: "#38e1b0" },
  { x: 440, label: "AI similarity", sub: "advisory · cross-event", tone: "#ffb454" },
  { x: 640, label: "Organizer review", sub: "a human decides", tone: "#ffb454" },
  { x: 840, label: "On-chain timestamp", sub: "Soroban ledger", tone: "#38e1b0" },
  { x: 1040, label: "Public verify", sub: "anyone, forever", tone: "#5ba8ff" },
];

const PATH = "M 40 100 L 1040 100";

export default function JourneyDiagram() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <SectionHeading
        eyebrow="How it works"
        title="One submission, six checkpoints"
        body="Every submission walks the same pipeline. Green steps are trustless — enforced by the contract. Amber steps are advisory — AI flags, a human decides."
      />

      <div className="card journey-diagram mt-10 overflow-x-auto p-6">
        <style>{`
          .journey-diagram .flow-line {
            stroke: var(--line);
            stroke-width: 2;
          }
          .journey-diagram .flow-dash {
            stroke: var(--accent);
            stroke-width: 2;
            stroke-dasharray: 6 10;
            animation: journey-dash 1.6s linear infinite;
          }
          @keyframes journey-dash {
            to { stroke-dashoffset: -16; }
          }
          .journey-diagram .packet {
            offset-path: path('${PATH}');
            offset-rotate: 0deg;
            animation: journey-packet 7s ease-in-out infinite;
          }
          @keyframes journey-packet {
            0%   { offset-distance: 0%; opacity: 0; }
            6%   { opacity: 1; }
            94%  { opacity: 1; }
            100% { offset-distance: 100%; opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .journey-diagram .flow-dash { animation: none; }
            .journey-diagram .packet { animation: none; opacity: 0; }
          }
        `}</style>

        <svg
          viewBox="0 0 1120 210"
          className="min-w-[900px]"
          role="img"
          aria-label="Pipeline diagram: team submits, canonical hash, AI similarity check, organizer review, on-chain timestamp, public verify"
        >
          <line className="flow-line" x1="40" y1="100" x2="1080" y2="100" />
          <line className="flow-dash" x1="40" y1="100" x2="1080" y2="100" />

          {steps.map((s, i) => (
            <g key={s.label}>
              <circle cx={s.x} cy={100} r={26} fill="var(--panel)" stroke={s.tone} strokeWidth={2} />
              <circle cx={s.x} cy={100} r={26} fill={s.tone} opacity={0.12} />
              <text x={s.x} y={106} textAnchor="middle" fontSize={15} fill={s.tone} fontWeight={700}>
                {i + 1}
              </text>
              <text x={s.x} y={152} textAnchor="middle" fontSize={13.5} fill="var(--foreground)" fontWeight={600}>
                {s.label}
              </text>
              <text x={s.x} y={170} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {s.sub}
              </text>
              {i < steps.length - 1 && (
                <path
                  d={`M ${s.x + 30} 100 l 8 -5 v 10 z`}
                  fill="var(--muted)"
                  opacity={0.7}
                />
              )}
            </g>
          ))}

          <circle className="packet" r={6} fill="var(--accent)" opacity={0} />
        </svg>
      </div>

      <div className="mt-6 grid gap-3 text-sm text-muted sm:grid-cols-2">
        <p className="card p-4">
          <span className="font-semibold text-accent">Trustless:</span> steps 2 and 5
          are enforced by the submission-registry contract — identical content in
          the same event is rejected on-chain, and the ledger timestamp cannot be
          edited by anyone.
        </p>
        <p className="card p-4">
          <span className="font-semibold text-warn">Advisory:</span> steps 3 and 4
          are the AI layer. It finds likely resubmissions across events and
          explains why — but only an organizer can act on it.
        </p>
      </div>
    </section>
  );
}
