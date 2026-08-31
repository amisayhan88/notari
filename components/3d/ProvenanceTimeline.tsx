"use client";

/**
 * Provenance timeline v2 — every event a submission hash was recorded
 * under, rendered as monument pedestals along a chronological axis.
 *
 * - Clean single record: one calm teal monument.
 * - Multi-event record or advisory flag: red monuments linked by a beam
 *   with a traveling pulse — the resubmission trail reads at a glance.
 *
 * Accessibility: color is never the only signal — the verify page renders
 * an explicit text timeline with FLAGGED/VERIFIED labels alongside.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useCanRender3D, usePrefersReducedMotion } from "./hooks";

export interface TimelineRecord {
  eventId: string;
  timestamp: number;
  ledger: number;
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Monument({
  position,
  suspicious,
  index,
  reduced,
}: {
  position: [number, number, number];
  suspicious: boolean;
  index: number;
  reduced: boolean;
}) {
  const orb = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const color = suspicious ? "#ff5d6c" : "#38e1b0";

  useFrame(() => {
    if (reduced || !orb.current || !mat.current) return;
    const t = performance.now() / 1000;
    const k = Math.abs(Math.sin(t * 2.2 + index * 0.7));
    orb.current.scale.setScalar(suspicious ? 1 + 0.2 * k : 1 + 0.05 * k);
    mat.current.emissiveIntensity = suspicious ? 1.4 + 1.1 * k : 0.9 + 0.2 * k;
  });

  return (
    <group position={position}>
      {/* pedestal */}
      <mesh position={[0, -1.15, 0]}>
        <cylinderGeometry args={[0.34, 0.46, 0.18, 24]} />
        <meshStandardMaterial color="#0e1626" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.95, 12]} />
        <meshStandardMaterial
          color="#16233c"
          emissive={color}
          emissiveIntensity={0.25}
          roughness={0.5}
        />
      </mesh>
      {/* orb */}
      <mesh ref={orb} position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial
          ref={mat}
          color={color}
          emissive={color}
          emissiveIntensity={suspicious ? 1.6 : 1}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={suspicious ? 0.12 : 0.06} />
      </mesh>
      {suspicious && !reduced && (
        <Sparkles
          position={[0, 0.4, 0]}
          count={18}
          scale={[1, 1.6, 1]}
          size={2.6}
          speed={0.5}
          opacity={0.7}
          color="#ff8f9a"
        />
      )}
    </group>
  );
}

function Timeline({
  records,
  suspicious,
  reduced,
}: {
  records: TimelineRecord[];
  suspicious: boolean;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);

  const positions = useMemo(() => {
    const span = Math.max(records.length - 1, 1);
    return records.map(
      (_, i) => [(i - span / 2) * 2.6, 0, 0] as [number, number, number],
    );
  }, [records]);

  useFrame(() => {
    if (reduced || !group.current) return;
    const t = performance.now() / 1000;
    group.current.rotation.y = Math.sin(t * 0.22) * 0.08;
  });

  return (
    <group ref={group}>
      {positions.map((pos, i) => (
        <group key={i}>
          <Monument position={pos} suspicious={suspicious} index={i} reduced={reduced} />
          <Html center distanceFactor={9} position={[pos[0], -1.75, 0]} style={{ pointerEvents: "none" }}>
            <div
              style={{
                textAlign: "center",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono), monospace",
                fontSize: "13px",
                color: suspicious ? "#ff8f9a" : "#9fe8d4",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {suspicious ? "⚠ " : "✓ "}
                {records[i].eventId}
              </div>
              <div style={{ opacity: 0.75 }}>
                {formatDate(records[i].timestamp)} · L{records[i].ledger}
              </div>
            </div>
          </Html>
        </group>
      ))}
      {positions.slice(0, -1).map((pos, i) => (
        <group key={`b${i}`} rotation={[0, 0, 0]}>
          <HorizontalBeam from={pos} to={positions[i + 1]} suspicious={suspicious} reduced={reduced} />
        </group>
      ))}
    </group>
  );
}

function HorizontalBeam({
  from,
  to,
  suspicious,
  reduced,
}: {
  from: [number, number, number];
  to: [number, number, number];
  suspicious: boolean;
  reduced: boolean;
}) {
  const pulse = useRef<THREE.Mesh>(null);
  const length = Math.abs(to[0] - from[0]);
  const color = suspicious ? "#a33644" : "#2b4a75";

  useFrame(() => {
    if (reduced || !pulse.current) return;
    const t = (performance.now() / 1500) % 1;
    pulse.current.position.x = from[0] + (to[0] - from[0]) * t;
    (pulse.current.material as THREE.MeshBasicMaterial).opacity =
      0.9 * Math.sin(Math.PI * t);
  });

  return (
    <group position={[0, 0.15, 0]}>
      <mesh
        position={[(from[0] + to[0]) / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.02, 0.02, length, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {!reduced && (
        <mesh ref={pulse} position={[from[0], 0, 0]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial
            color={suspicious ? "#ff5d6c" : "#9fe8d4"}
            transparent
            opacity={0}
          />
        </mesh>
      )}
    </group>
  );
}

export default function ProvenanceTimeline({
  records,
  suspicious,
}: {
  records: TimelineRecord[];
  suspicious: boolean;
}) {
  const can3D = useCanRender3D();
  const reduced = usePrefersReducedMotion();

  if (!can3D || records.length === 0) {
    return (
      <div
        aria-hidden
        className="h-full w-full bg-[radial-gradient(ellipse_at_center,rgba(91,168,255,0.12),transparent_60%)]"
      />
    );
  }

  return (
    <Canvas
      aria-hidden
      camera={{ position: [0, 1.1, 7.2], fov: 45 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={["#060a12", 8, 18]} />
      <ambientLight intensity={0.45} />
      <pointLight position={[5, 6, 5]} intensity={50} color="#5ba8ff" />
      <pointLight position={[-5, 3, 4]} intensity={35} color="#38e1b0" />
      <Timeline records={records} suspicious={suspicious} reduced={reduced} />
      {/* horizon line */}
      <mesh position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial color="#080d18" roughness={0.9} />
      </mesh>
    </Canvas>
  );
}
