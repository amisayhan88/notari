"use client";

/**
 * Hero scene v2 — the submission vault:
 * a distorted glowing core ("the ledger") orbited by a tilted chain ring of
 * linked nodes, wrapped in a particle field. The camera pulls back as the
 * user scrolls (GSAP ScrollTrigger scrub on the enclosing section).
 *
 * Reduced motion: static composition, no rotation/pulse/scroll camera.
 * No WebGL: CSS gradient fallback.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, MeshDistortMaterial, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCanRender3D, usePrefersReducedMotion } from "./hooks";

const NODE_COUNT = 10;
const RING_RADIUS = 3.4;

/** Tracks the active theme so the canvas repaints fog/lines on toggle. */
function useThemeMode(): "dark" | "light" {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const read = () =>
      setMode(
        document.documentElement.getAttribute("data-theme") === "light"
          ? "light"
          : "dark",
      );
    read();
    window.addEventListener("notari-theme-change", read);
    return () => window.removeEventListener("notari-theme-change", read);
  }, []);
  return mode;
}

function VaultCore() {
  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
      <mesh>
        <sphereGeometry args={[1.15, 48, 48]} />
        <MeshDistortMaterial
          color="#0f3d33"
          emissive="#38e1b0"
          emissiveIntensity={1}
          distort={0.28}
          speed={1.6}
          roughness={0.25}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.45, 32, 32]} />
        <meshBasicMaterial color="#38e1b0" transparent opacity={0.06} />
      </mesh>
    </Float>
  );
}

function OrbitRings({ light }: { light: boolean }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (a.current) a.current.rotation.z += delta * 0.18;
    if (b.current) b.current.rotation.x += delta * 0.12;
  });
  return (
    <>
      <mesh ref={a} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.1, 0.008, 8, 96]} />
        <meshBasicMaterial
          color={light ? "#8fa8cf" : "#2b4a75"}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={b} rotation={[Math.PI / 1.7, 0.4, 0]}>
        <torusGeometry args={[2.5, 0.006, 8, 96]} />
        <meshBasicMaterial
          color={light ? "#0b9e77" : "#38e1b0"}
          transparent
          opacity={light ? 0.45 : 0.35}
        />
      </mesh>
    </>
  );
}

function ChainRing({ reduced, light }: { reduced: boolean; light: boolean }) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);

  const positions = useMemo(() => {
    return Array.from({ length: NODE_COUNT }, (_, i) => {
      const angle = (i / NODE_COUNT) * Math.PI * 2;
      return [
        Math.cos(angle) * RING_RADIUS,
        Math.sin(angle * 2) * 0.35,
        Math.sin(angle) * RING_RADIUS,
      ] as [number, number, number];
    });
  }, []);

  useFrame((_, delta) => {
    if (reduced || !group.current) return;
    group.current.rotation.y += delta * 0.16;
    const t = performance.now() / 1000;
    meshes.current.forEach((m, i) => {
      if (!m) return;
      const pulse = 1 + 0.12 * Math.sin(t * 2 + i * 0.8);
      m.scale.setScalar(pulse);
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1 + 0.6 * Math.sin(t * 2 + i * 0.8);
    });
  });

  const linePoints = useMemo(
    () => [...positions, positions[0]],
    [positions],
  );

  return (
    <group ref={group} rotation={[0.28, 0, 0.08]}>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh
            ref={(el) => {
              meshes.current[i] = el;
            }}
          >
            <icosahedronGeometry args={[0.17, 1]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#38e1b0" : "#5ba8ff"}
              emissive={i % 2 === 0 ? "#38e1b0" : "#5ba8ff"}
              emissiveIntensity={1.1}
              roughness={0.3}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.26, 16, 16]} />
            <meshBasicMaterial
              color={i % 2 === 0 ? "#38e1b0" : "#5ba8ff"}
              transparent
              opacity={0.1}
            />
          </mesh>
        </group>
      ))}
      <Line
        points={linePoints}
        color={light ? "#9db4d8" : "#2b4a75"}
        lineWidth={1}
        transparent
        opacity={0.65}
      />
    </group>
  );
}

function Scene({
  scrollProgress,
  reduced,
  light,
}: {
  scrollProgress: React.MutableRefObject<number>;
  reduced: boolean;
  light: boolean;
}) {
  useFrame(({ camera }) => {
    if (reduced) return;
    const p = scrollProgress.current;
    const targetZ = 7 + p * 6;
    const targetY = 0.8 + p * 2;
    camera.position.z += (targetZ - camera.position.z) * 0.07;
    camera.position.y += (targetY - camera.position.y) * 0.07;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <fog
        key={light ? "light" : "dark"}
        attach="fog"
        args={[light ? "#eef2f8" : "#060a12", 9, 20]}
      />
      <ambientLight intensity={light ? 0.7 : 0.35} />
      <pointLight position={[6, 6, 6]} intensity={light ? 40 : 60} color="#5ba8ff" />
      <pointLight position={[-6, -4, 4]} intensity={light ? 28 : 45} color="#38e1b0" />
      <directionalLight position={[0, 8, 2]} intensity={0.5} color="#eafff7" />

      <VaultCore />
      <OrbitRings light={light} />
      <ChainRing reduced={reduced} light={light} />
      {!reduced && (
        <Sparkles
          count={110}
          scale={[10, 6, 10]}
          size={2.2}
          speed={0.35}
          opacity={light ? 0.4 : 0.5}
          color={light ? "#2f6fd6" : "#9fe8d4"}
        />
      )}
    </>
  );
}

export default function ChainHero({
  sectionRef,
}: {
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const can3D = useCanRender3D();
  const reduced = usePrefersReducedMotion();
  const mode = useThemeMode();
  const light = mode === "light";
  const scrollProgress = useRef(0);

  useEffect(() => {
    if (reduced || !sectionRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const trigger = ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        scrollProgress.current = self.progress;
      },
    });
    return () => {
      trigger.kill();
    };
  }, [reduced, sectionRef]);

  if (!can3D) {
    return (
      <div
        aria-hidden
        className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(56,225,176,0.2),transparent_55%),radial-gradient(ellipse_at_70%_65%,rgba(91,168,255,0.16),transparent_50%)]"
      />
    );
  }

  return (
    <Canvas
      aria-hidden
      camera={{ position: [0, 0.8, 7], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <Scene scrollProgress={scrollProgress} reduced={reduced} light={light} />
    </Canvas>
  );
}
