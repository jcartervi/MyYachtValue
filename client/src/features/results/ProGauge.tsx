import * as React from "react";
import { formatUSD } from "./format";

type LabeledPoint = {
  id: "wholesale" | "market" | "replacement";
  label: string;
  value: number;
};

type Props = {
  min: number;
  max: number;
  value: number;                // locked/true market value
  points: LabeledPoint[];       // wholesale, market, replacement
  size?: number;
  trackWidth?: number;
  valueWidth?: number;
  onScrub?: (previewValue: number | null) => void; // null when not scrubbing
  ariaLabel?: string;
};

export default function ProGauge({
  min,
  max,
  value,
  points,
  size = 560,
  trackWidth = 16,
  valueWidth = 16,
  onScrub,
  ariaLabel = "Valuation gauge. Needle indicates Market Value; hover to preview.",
}: Props) {
  const w = size;
  const h = Math.round(size * 0.56);
  const cx = w / 2;
  const cy = Math.round(h * 0.94);
  const r  = Math.max(12, Math.min(cx, cy) - Math.max(trackWidth, valueWidth) - 4);

  const clamp = (n: number) => Math.min(Math.max(n, Math.min(min, max)), Math.max(min, max));
  const span  = Math.max(1, Math.abs(max - min));
  const tOf   = (v: number) => (clamp(v) - min) / span;             // 0..1
  const angle = (t: number) => Math.PI - Math.PI * t;               // 180°..0°
  const xy    = (ang: number, rad: number) => ({ x: cx + rad * Math.cos(ang), y: cy + rad * Math.sin(ang) });

  const arc = (t0: number, t1: number, width: number) => {
    const a0 = angle(t0), a1 = angle(t1);
    const p0 = xy(a0, r), p1 = xy(a1, r);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };

  const [scrubT, setScrubT] = React.useState<number | null>(null);
  const activeT    = scrubT ?? tOf(value);
  const needleAng  = angle(activeT);
  const needleLen  = r - valueWidth - 8;
  const needleTip  = xy(needleAng, needleLen);
  const needleRotationDeg = (needleAng * 180) / Math.PI;

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mq.matches);
    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }

    if (typeof mq.addListener === "function") {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }

    return undefined;
  }, []);

  const shouldAnimate = !prefersReducedMotion;

  const updateFromEvent = (e: React.PointerEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - cx;
    const dy = my - cy;
    const ang = Math.atan2(dy, dx); // -PI..PI
    if (ang <= 0 && ang >= -Math.PI) {
      const t = 1 - Math.abs(ang) / Math.PI; // map -PI..0 to 0..1
      setScrubT(t);
      onScrub?.(min + t * span);
    } else {
      setScrubT(null);
      onScrub?.(null);
    }
  };

  const endScrub = () => {
    setScrubT(null);
    onScrub?.(null);
  };

  // keyboard a11y
  const step = span / 50;
  const handleKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      const next = clamp((scrubT != null ? min + scrubT * span : value) - step);
      setScrubT(tOf(next)); onScrub?.(next); e.preventDefault();
    }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      const next = clamp((scrubT != null ? min + scrubT * span : value) + step);
      setScrubT(tOf(next)); onScrub?.(next); e.preventDefault();
    }
    if (e.key === "Escape" || e.key === "Enter") {
      setScrubT(null); onScrub?.(null);
    }
  };

  const previewValue = scrubT != null ? min + scrubT * span : null;
  const tooltipWidth = w < 480 ? 96 : 120;
  const tooltipHeight = 40;
  const tooltipX = Math.min(Math.max(needleTip.x - tooltipWidth / 2, 0), w - tooltipWidth);
  const tooltipY = Math.min(Math.max(needleTip.y - tooltipHeight - 8, 0), h - tooltipHeight);

  return (
    <div className="w-full flex justify-center select-none">
      <svg
        ref={svgRef}
        role="slider"
        aria-label={ariaLabel}
        aria-description="Use arrow keys to preview values."
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(previewValue ?? value)}
        tabIndex={0}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ overflow: "hidden" }}
        onPointerDown={updateFromEvent}
        onPointerMove={updateFromEvent}
        onPointerLeave={endScrub}
        onKeyDown={handleKey}
      >
        {/* Track */}
        <path d={arc(0, 1, trackWidth)} stroke="#E5E7EB" strokeWidth={trackWidth} strokeLinecap="round" fill="none" />
        {/* Value arc */}
        <path
          d={arc(0, activeT, valueWidth)}
          stroke="#0F172A"
          strokeWidth={valueWidth}
          strokeLinecap="round"
          fill="none"
          style={shouldAnimate ? { transition: "all 180ms ease-out" } : undefined}
        />
        {/* Ticks */}
        {Array.from({ length: 6 }).map((_, i) => {
          const t = i / 5;
          const a = angle(t);
          const p1 = xy(a, r + 2);
          const p2 = xy(a, r - 10);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94A3B8" strokeWidth={2} opacity={0.5} />;
        })}
        {/* Needle */}
        <g
          transform={`rotate(${needleRotationDeg} ${cx} ${cy})`}
          style={shouldAnimate ? { transition: "transform 180ms ease-out" } : undefined}
        >
          <line x1={cx} y1={cy} x2={cx + needleLen} y2={cy} stroke="#0F172A" strokeWidth={3} strokeLinecap="round" />
          <circle cx={cx} cy={cy} r={6} fill="#0F172A" />
        </g>

        {/* Labels on arc with collision guard */}
        {points.map((pt) => {
          const t = tOf(pt.value);
          const a = angle(t);
          const onArc   = xy(a, r);
          const outside = xy(a, r + 24);
          const anchor  = t < 0.33 ? "start" : t > 0.67 ? "end" : "middle";
          const dy      = (t > 0.8 || t < 0.2) ? -2 : 0; // nudge extremes
          return (
            <g key={pt.id} pointerEvents="none">
              <line x1={onArc.x} y1={onArc.y} x2={outside.x} y2={outside.y} stroke="#94A3B8" strokeWidth={1.5} />
              <circle cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />
              <text x={outside.x} y={outside.y - 6 + dy} fontSize={12} fill="#475569" textAnchor={anchor as any}>
                {pt.label}
              </text>
              <text
                x={outside.x}
                y={outside.y + 12 + dy}
                className="tabular-nums"
                fontSize={13}
                fontWeight={600}
                fill="#0F172A"
                textAnchor={anchor as any}
              >
                {formatUSD(pt.value)}
              </text>
            </g>
          );
        })}

        {/* Hover tooltip for preview */}
        {previewValue != null && (
          <foreignObject x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} pointerEvents="none">
            <div className="rounded-md bg-slate-900 text-white text-xs px-2 py-1 text-center shadow">
              {formatUSD(previewValue)}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
}
