"use client";

import { useEffect, useState } from "react";

/** True when WebGL can render in this browser; false falls back to 2D UI. */
export function useCanRender3D(): boolean {
  const [can, setCan] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // WebGL capability is a browser-only fact; the probe can only run
    // post-mount, and the component lives behind a dynamic(ssr:false) scene.
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl2") || canvas.getContext("webgl");
      setCan(Boolean(gl));
    } catch {
      setCan(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  return can;
}

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    // matchMedia is browser-only; initial sync read + listener is the
    // standard pattern for a preference hook.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  return reduce;
}
