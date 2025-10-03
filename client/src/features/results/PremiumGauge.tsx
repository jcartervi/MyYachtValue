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
  showSideLabels?: boolean; // whether to show wholesale/replacement labels on gauge
  ariaLabel?: string;
};

export default function PremiumGauge({
  min,
  max,
  value,
  markers,
  size = 520,              // keep main’s default
  trackWidth = 14,
  valueWidth = 16,
  showTicks = true,
  showSideLabels = true,   // default to true for backward compatibility
  ariaLabel = "Valuation gauge. Needle marks Market Value.",
}: Props) {
  // geometry (canvas derived from size; center at top, arc drawn “up” with sweep=1)
  const w = size;
  const isSmall = w < 400;
  const cx = w / 2;

  const rimPadding = Math.max(trackWidth, valueWidth) + (isSmall ? 8 : 12);
  const r = Math.max(24, cx - rimPadding);

  const topPad = isSmall ? 10 : 14;        // space above the semicircle
  const labelBand = isSmall ? 74 : 102;    // vertical room for labels below
  const cy = r + topPad;                   // arc baseline (center y)
  const h = cy + labelBand;                // svg height

  const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, Math.min(a, b)), Math.max(a, b));
  const span  = Math.max(1, Math.abs(max - min));
  const tOf   = (v: number) => (clamp(v, min, max) - min) / span; // 0..1

  // Deterministic UPPER semicircle with small angular padding
  const PAD = (10 * Math.PI) / 180;
  const startA = Math.PI - PAD;
  const endA   = PAD;
  const angle  = (u: number) => startA + (endA - startA) * u;
  // NOTE: y uses "-" here to draw “up” since cy is at the arc baseline
  const xy     = (a: number, rad: number) => ({ x: cx + rad * Math.cos(a), y: cy - rad * Math.sin(a) });

  const arcPath = (u0: number, u1: number) => {
    const a0 = angle(Math.max(0, Math.min(1, u0)));
    const a1 = angle(Math.max(0, Math.min(1, u1)));
    const p0 = xy(a0, r), p1 = xy(a1, r);
    // sweep=1 (clockwise) keeps the path on the upper half-plane with this coordinate system
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`;
  };

  // value → needle with end padding so it never hits caps
  const tVal = tOf(value);
  const PAD_T = 0.012; // ~1.2% from each end
  const tNeedle = Math.max(PAD_T, Math.min(1 - PAD_T, tVal));
  const needleLen = Math.max(26, r - valueWidth - 20);
  const needleTip = xy(angle(tNeedle), needleLen);

  // adaptive text sizes for small dials (mobile)
  const fsLabel = isSmall ? 11 : 12;
  const fsValue = isSmall ? 12.5 : 13;

  // label helpers (SVG-only; haloed text for legibility)
  const clampX = (x: number) => Math.max(20, Math.min(w - 20, x));
  const clampLeaderY = (y: number) => Math.max(topPad, Math.min(cy - (isSmall ? 10 : 14), y));
  const clampLabelY  = (y: number) => Math.max(cy + (isSmall ? 8 : 12), Math.min(cy + labelBand - (isSmall ? 14 : 18), y));
  const halo = { paintOrder: "stroke", stroke: "white", strokeWidth: 3, strokeLinejoin: "round" } as const;

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
        {/* Track & value arc (use tNeedle so the active arc also respects end padding) */}
        <path d={arcPath(0, 1)} stroke="#CBD5E1" strokeWidth={trackWidth + 1} strokeLinecap="round" fill="none" />
        <path d={arcPath(0, tNeedle)} stroke="#0F172A" strokeWidth={valueWidth + 2} strokeLinecap="round" fill="none" />

        {/* Ticks (subtle) */}
        {showTicks && Array.from({ length: 6 }).map((_, i) => {
          const u = i / 5;
          const a = angle(u);
          const p1 = xy(a, r + 2), p2 = xy(a, r - 10);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94A3B8" strokeWidth={1.5} opacity={0.35} />;
        })}

        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke="#0F172A" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />

        {/* Positioned numbers: Wholesale/Replacement; Market gets the big pill below */}
        {markers.map((m) => {
          const u = tOf(m.value);
          const a = angle(u);
          const onArc = xy(a, r);

          const isMarket = m.id === "market";
          
          // Always render market as just a dot
          if (isMarket) {
            return <circle key={m.id} cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />;
          }

          // For wholesale/replacement, only show labels if showSideLabels is true
          if (!showSideLabels) {
            return <circle key={m.id} cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />;
          }

          // Leader line end and label anchor band (responsive)
          const leader = xy(a, r + (isSmall ? 22 : 30));
          const out    = xy(a, r + (isSmall ? 52 : 72));

          const anchor = u < 0.34 ? "end" : u > 0.66 ? "start" : "middle";
          const labelOffset = isSmall ? 6 : 10;

          const shift = anchor === "end" ? -labelOffset : anchor === "start" ? labelOffset : 0;
          const lx = clampX(out.x + shift);
          const lyBase = clampLabelY(out.y + (isSmall ? 12 : 16));
          const ly1 = lyBase;
          const ly2 = Math.min(cy + labelBand - (isSmall ? 6 : 8), lyBase + (isSmall ? 13 : 15));

          return (
            <g key={m.id} pointerEvents="none">
              <line
                x1={onArc.x}
                y1={onArc.y}
                x2={clampX(leader.x + shift)}
                y2={clampLeaderY(leader.y)}
                stroke="#94A3B8"
                strokeWidth={1.25}
              />
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
