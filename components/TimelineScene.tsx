"use client";

import dynamic from "next/dynamic";
import type { TimelineRecord } from "@/components/3d/ProvenanceTimeline";

const ProvenanceTimeline = dynamic(
  () => import("@/components/3d/ProvenanceTimeline"),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(91,168,255,0.1),transparent_60%)]"
      />
    ),
  },
);

export default function TimelineScene({
  records,
  suspicious,
}: {
  records: TimelineRecord[];
  suspicious: boolean;
}) {
  return <ProvenanceTimeline records={records} suspicious={suspicious} />;
}
