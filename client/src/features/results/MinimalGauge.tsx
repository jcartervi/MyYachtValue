import * as React from "react";

type Props = {
  min: number;
  value: number;
  max: number;
  size?: number;
  trackWidth?: number;
  valueWidth?: number;
  ariaLabel?: string;
};

export default function MinimalGauge({
  min,
  value,
  max,
  size = 420,
  trackWidth = 18,
  valueWidth = 18,
  ariaLabel = "Valuation gauge",
}: Props) {
  const w = size;
  const h = Math.round(size * 0.58);
  const cx = w / 2;
  const cy = h * 0.95;
  const r = Math.max(10, Math.min(cx, cy) - Math.max(trackWidth, valueWidth));

  const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const sMin = isNum(min) ? min : 0;
  const sMax = isNum(max) ? max : 1;
  let sVal = isNum(value) ? value : (sMin + sMax) / 2;

  const span = sMax - sMin;
  const denom = span === 0 ? 1 : span;
  sVal = Math.min(Math.max(sVal, Math.min(sMin, sMax)), Math.max(sMin, sMax));

  const t = (sVal - sMin) / denom; // 0..1
  const angleOf = (tt: number) => Math.PI - Math.PI * tt;

  const arc = (t0: number, t1: number, width: number) => {
    const a0 = angleOf(t0), a1 = angleOf(t1);
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  };

  const needleAngle = angleOf(t);
  const nx = cx + (r - valueWidth) * Math.cos(needleAngle);
  const ny = cy + (r - valueWidth) * Math.sin(needleAngle);

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
        {/* debug frame guarantees visibility */}
        <rect x="0" y="0" width={w} height={h} fill="none" stroke="#CBD5E1" strokeDasharray="4 4" />
        {/* track */}
        <path d={arc(0, 1, trackWidth)} stroke="#E5E7EB" strokeWidth={trackWidth} strokeLinecap="round" fill="none" />
        {/* value */}
        <path d={arc(0, t, valueWidth)} stroke="#0F172A" strokeWidth={valueWidth} strokeLinecap="round" fill="none" />
        {/* needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#0F172A" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />
      </svg>
    </div>
  );
}
