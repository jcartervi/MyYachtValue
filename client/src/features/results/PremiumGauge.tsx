import * as React from "react";
import { formatUSD } from "./format";

type Marker = { id: "wholesale" | "market" | "replacement"; value: number; label: string };

type Props = {
  min: number;   // wholesale
  max: number;   // replacement
  value: number; // market
  markers: Marker[]; // wholesale, market, replacement
  size?: number;          // dial width in px
  trackWidth?: number;    // px
  valueWidth?: number;    // px
  showTicks?: boolean;
  ariaLabel?: string;
};

export default function PremiumGauge({
  min,
  max,
  value,
  markers,
  size = 560,
  trackWidth = 14,
  valueWidth = 16,
  showTicks = true,
  ariaLabel = "Valuation gauge. Needle marks Market Value.",
}: Props) {
  // geometry
  const w = size;
  const h = Math.round(size * 0.52);                  // mobile-friendly aspect
  const cx = w / 2;
  const cy = Math.round(h * 0.90);                    // lift arc above baseline
  const r  = Math.max(22, Math.min(cx, cy) - Math.max(trackWidth, valueWidth) - 10);

  const clamp = (n:number, a:number, b:number) => Math.min(Math.max(n, Math.min(a,b)), Math.max(a,b));
  const span  = Math.max(1, Math.abs(max - min));
  const tOf   = (v:number) => (clamp(v, min, max) - min) / span; // 0..1

  // ALWAYS draw upper semicircle with small end padding (no flips)
  const PAD = (12 * Math.PI) / 180;
  const startA = Math.PI - PAD; // left end
  const endA   = PAD;           // right end
  const angle  = (u:number) => startA + (endA - startA) * u;
  const xy     = (a:number, rad:number) => ({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) });

  const arcPath = (u0:number, u1:number) => {
    const a0 = angle(Math.max(0, Math.min(1, u0)));
    const a1 = angle(Math.max(0, Math.min(1, u1)));
    const p0 = xy(a0, r), p1 = xy(a1, r);
    // sweep=0, large=0 enforces upper arc segments
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 0 ${p1.x} ${p1.y}`;
  };

  // value → needle
  const tVal = tOf(value);
  const aVal = angle(tVal);
  const needleTip = xy(aVal, Math.max(28, r - valueWidth - 18)); // stays above baseline

  // label helpers (SVG-only; haloed text for legibility)
  const clampX = (x:number) => Math.max(12, Math.min(w - 12, x));
  const clampY = (y:number) => Math.max(12, Math.min(cy - 8, y));
  const halo = { paintOrder: "stroke", stroke: "white", strokeWidth: 3, strokeLinejoin: "round" } as const;

  // adaptive text sizes for small dials (mobile)
  const isSmall = w < 400;
  const fsLabel = isSmall ? 11 : 12;
  const fsValue = isSmall ? 12.5 : 13;

  return (
    <div className="w-full flex justify-center">
      <svg
        role="img"
        aria-label={ariaLabel}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ overflow: "visible" }}
      >
        {/* Track + Value */}
        <path d={arcPath(0, 1)} stroke="#CBD5E1" strokeWidth={trackWidth + 1} strokeLinecap="round" fill="none" />
        <path d={arcPath(0, tVal)} stroke="#0F172A" strokeWidth={valueWidth + 2} strokeLinecap="round" fill="none" />

        {/* Ticks (subtle) */}
        {showTicks && Array.from({ length: 6 }).map((_, i) => {
          const u = i / 5; const a = angle(u);
          const p1 = xy(a, r + 2), p2 = xy(a, r - 10);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94A3B8" strokeWidth={1.5} opacity={0.35} />;
        })}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#0F172A" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />

        {/* Positioned NUMBERS on the arc for Wholesale/Replacement (Market is emphasized below) */}
        {markers.map((m) => {
          const u = tOf(m.value);
          const a = angle(u);
          const onArc = xy(a, r);
          const out   = xy(a, r + (isSmall ? 26 : 32));         // outward offset
          const lx = clampX(out.x);
          const ly1 = clampY(out.y - (isSmall ? 5 : 6));        // label
          const ly2 = clampY(out.y + (isSmall ? 10 : 12));      // value
          const anchor = u < 0.33 ? "start" : u > 0.67 ? "end" : "middle";
          const isMarket = m.id === "market";

          // Market: dot only (big pill handles emphasis below)
          if (isMarket) return <circle key={m.id} cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />;

          return (
            <g key={m.id} pointerEvents="none">
              <line x1={onArc.x} y1={onArc.y} x2={lx} y2={clampY(out.y)} stroke="#94A3B8" strokeWidth={1.25} />
              <circle cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />
              <text
                x={lx}
                y={ly1}
                fontSize={fsLabel}
                textAnchor={anchor as any}
                style={{ ...halo, whiteSpace: "nowrap" }}
                fill="#475569"
              >
                {m.label}
              </text>
              <text
                x={lx}
                y={ly2}
                fontSize={fsValue}
                fontWeight={600}
                textAnchor={anchor as any}
                style={{ ...halo, whiteSpace: "nowrap" }}
                className="tabular-nums"
                fill="#0F172A"
              >
                {formatUSD(m.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
