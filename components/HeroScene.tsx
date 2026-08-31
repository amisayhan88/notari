"use client";

import dynamic from "next/dynamic";

const ChainHero = dynamic(() => import("@/components/3d/ChainHero"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(56,225,176,0.12),transparent_60%)]"
    />
  ),
});

export default function HeroScene({
  sectionRef,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  return <ChainHero sectionRef={sectionRef} />;
}
