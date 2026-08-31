/** Deterministic avatar from a wallet address — no external images. */
export default function Avatar({
  wallet,
  size = 28,
}: {
  wallet: string;
  size?: number;
}) {
  let h = 0;
  for (let i = 0; i < wallet.length; i++) {
    h = (h * 31 + wallet.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  const hue2 = (hue + 70) % 360;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-1 ring-line"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(from ${hue}deg, hsl(${hue} 80% 55%), hsl(${hue2} 80% 45%), hsl(${hue} 80% 55%))`,
      }}
    />
  );
}
