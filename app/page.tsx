import type { Metadata } from "next";
import Hero from "@/components/landing/Hero";
import TrustMarquee from "@/components/landing/TrustMarquee";
import JourneyDiagram from "@/components/landing/JourneyDiagram";
import UserJourneys from "@/components/landing/UserJourneys";
import Benefits from "@/components/landing/Benefits";
import BehaviorExamples from "@/components/landing/BehaviorExamples";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import RegisterOrganizer from "@/components/landing/RegisterOrganizer";
import ScrollProgress from "@/components/landing/ScrollProgress";
import LiveRegistry, { type FeedItem } from "@/components/landing/LiveRegistry";
import { CountUp } from "@/components/animations/motion";
import { getPool, migrate } from "@/lib/db";

export const metadata: Metadata = {
  title: "notari — hackathon submissions, provably timestamped",
};

export const dynamic = "force-dynamic";

async function loadStats() {
  try {
    await migrate();
    const pool = getPool();
    const [timestamped, events, flagged] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS n FROM submissions WHERE status = 'timestamped'`,
      ),
      pool.query(`SELECT COUNT(DISTINCT event_id)::int AS n FROM submissions`),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM submissions WHERE status IN ('flagged', 'rejected')`,
      ),
    ]);
    return {
      timestamped: timestamped.rows[0].n as number,
      events: events.rows[0].n as number,
      flagged: flagged.rows[0].n as number,
    };
  } catch {
    return { timestamped: 0, events: 0, flagged: 0 };
  }
}

async function loadFeed(): Promise<FeedItem[]> {
  try {
    await migrate();
    const res = await getPool().query(
      `SELECT submission_hash, event_id, repo_url, status, created_at
         FROM submissions
        ORDER BY created_at DESC
        LIMIT 6`,
    );
    return res.rows.map((r) => ({
      hash: r.submission_hash,
      eventId: r.event_id,
      repoUrl: r.repo_url,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const [stats, feed] = await Promise.all([loadStats(), loadFeed()]);

  return (
    <>
      <ScrollProgress />
      <Hero timestampedCount={stats.timestamped} eventCount={stats.events} />
      <TrustMarquee />
      <JourneyDiagram />
      <UserJourneys />
      <Benefits />

      <section aria-label="Registry statistics">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-16 text-center sm:grid-cols-3">
          <div>
            <p className="text-4xl font-bold text-accent">
              <CountUp value={stats.timestamped} />
            </p>
            <p className="mt-2 text-sm text-muted">submissions timestamped</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-accent-2">
              <CountUp value={stats.events} />
            </p>
            <p className="mt-2 text-sm text-muted">events on the registry</p>
          </div>
          <div>
            <p className="text-4xl font-bold text-warn">
              <CountUp value={stats.flagged} />
            </p>
            <p className="mt-2 text-sm text-muted">duplicates caught &amp; flagged</p>
          </div>
        </div>
      </section>

      <LiveRegistry items={feed} />

      <BehaviorExamples />
      <RegisterOrganizer />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </>
  );
}
