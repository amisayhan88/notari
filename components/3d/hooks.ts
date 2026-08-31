"use client";

import { useEffect, useState } from "react";

/** True when WebGL can render in this browser; false falls back to 2D UI. */
export function useCanRender3D(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") || canvas.getContext("webgl");
      setCan(Boolean(gl));
    } catch {
      setCan(false);
    }
  }, []);
  return can;
}

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}
