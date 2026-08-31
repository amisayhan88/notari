"use client";

import { useRef } from "react";
import HeroScene from "@/components/HeroScene";

export default function Hero({
  timestampedCount,
  eventCount,
}: {
  timestampedCount: number;
  eventCount: number;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      className="hero-bg grid-backdrop relative flex min-h-[92vh] items-center overflow-hidden"
    >
      {/* 3D scene — offset right on desktop so it never sits under the copy */}
      <div className="absolute inset-0 md:left-[32%]" aria-hidden>
        <HeroScene sectionRef={sectionRef} />
      </div>

      {/* Scrim between scene and text — theme-aware so the copy stays
          readable in dark and light modes */}
      <div
        aria-hidden
        className="absolute inset-0 z-[1] bg-gradient-to-r from-background via-background/80 to-transparent md:via-background/60"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 z-[1] h-24 bg-gradient-to-t from-background to-transparent"
      />

      <div className="hero-copy pointer-events-none relative z-10 mx-auto w-full max-w-6xl px-4">
        <div className="max-w-2xl space-y-6">
          <p className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1 text-xs text-muted backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            Soroban testnet · trustless timestamping
          </p>
          <h1 className="hero-title pointer-events-auto text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
            Every hackathon submission,
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              provably on the record.
            </span>
          </h1>
          <p className="hero-sub pointer-events-auto max-w-xl text-base text-muted sm:text-lg">
            The moment a team locks in their project, its canonical hash is
            timestamped on Soroban — immutable proof of what was submitted, by
            whom, and when. Anyone can verify it. Duplicates can&apos;t hide.
          </p>
          <div className="pointer-events-auto flex flex-wrap gap-3">
            <a href="/submit" className="btn btn-primary">
              Submit a project
            </a>
            <a href="/verify" className="btn btn-ghost">
              Verify a submission
            </a>
          </div>
          <p className="pointer-events-auto mono text-xs text-muted">
            {timestampedCount} on-chain records · {eventCount} events · 0 XLM
            needed to submit
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce text-muted"
      >
        ↓
      </div>
    </section>
  );
}
