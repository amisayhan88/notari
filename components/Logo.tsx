/**
 * Animated notari logo — three ledger nodes linked in a chain, with a
 * pulse traveling across them. Pure SVG; motion disabled for reduced-motion
 * users via the CSS media query.
 */
export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="notari-logo"
    >
      <style>{`
        .notari-logo .link { stroke: var(--line); stroke-width: 1.6; }
        .notari-logo .node { fill: #38e1b0; }
        .notari-logo .node.b { fill: #5ba8ff; }
        .notari-logo .pulse {
          fill: var(--foreground);
          animation: notari-pulse 2.4s ease-in-out infinite;
        }
        @keyframes notari-pulse {
          0%   { cx: 6;  opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { cx: 26; opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .notari-logo .pulse { animation: none; opacity: 0; }
        }
      `}</style>
      <line className="link" x1="6" y1="20" x2="16" y2="10" />
      <line className="link" x1="16" y1="10" x2="26" y2="20" />
      <circle className="node" cx="6" cy="20" r="3.4" />
      <circle className="node b" cx="16" cy="10" r="3.4" />
      <circle className="node" cx="26" cy="20" r="3.4" />
      <circle className="pulse" cx="6" cy="15" r="1.5" />
    </svg>
  );
}
