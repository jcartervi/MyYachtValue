import * as React from "react";

import { formatUSD } from "./format";

export type GaugePoint = {
  id: string;
  label: string;
  value: number;
};

export type ProGaugeProps = {
  min: number;
  max: number;
  value: number;
  points: GaugePoint[];
  size?: number;
  trackWidth?: number;
  valueWidth?: number;
  onScrub?: (value?: number) => void;
  ariaLabel?: string;
};

const DEFAULT_SIZE = 420;
const DEFAULT_TRACK_WIDTH = 16;
const DEFAULT_VALUE_WIDTH = 16;

const PAD_DEG = 12;
const PAD = (PAD_DEG * Math.PI) / 180;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function ProGauge({
  min,
  max,
  value,
  points,
  size = DEFAULT_SIZE,
  trackWidth = DEFAULT_TRACK_WIDTH,
  valueWidth = DEFAULT_VALUE_WIDTH,
  onScrub,
  ariaLabel = "Valuation gauge",
}: ProGaugeProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const scrubValueRef = React.useRef<number | null>(null);
  const clipId = React.useId();
  const [scrubT, setScrubT] = React.useState<number | null>(null);
  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const safePoints = React.useMemo(
    () => points.filter((pt) => Number.isFinite(pt.value)),
    [points],
  );

  const fallbackMin = safePoints.length
    ? Math.min(...safePoints.map((pt) => pt.value))
    : 0;
  const fallbackMax = safePoints.length
    ? Math.max(...safePoints.map((pt) => pt.value))
    : fallbackMin + 1;

  const domainMin = Number.isFinite(min)
    ? Math.min(min, fallbackMin)
    : fallbackMin;
  const domainMax = Number.isFinite(max)
    ? Math.max(max, fallbackMax)
    : fallbackMax;
  const span = domainMax - domainMin || 1;

  const clampValue = React.useCallback(
    (v: number) => clamp(v, domainMin, domainMax),
    [domainMin, domainMax],
  );
  const tOf = React.useCallback(
    (v: number) => (clampValue(v) - domainMin) / span,
    [clampValue, domainMin, span],
  );
  const vOf = React.useCallback(
    (t: number) => clampValue(domainMin + t * span),
    [clampValue, domainMin, span],
  );

  const w = size;
  const h = Math.round(size * 0.56);
  const cx = w / 2;
  const cy = Math.round(h * 0.88);
  const r = Math.max(18, Math.min(cx, cy) - Math.max(trackWidth, valueWidth) - 10);

  const startA = Math.PI - PAD;
  const endA = PAD;
  const angle = React.useCallback(
    (t: number) => startA + (endA - startA) * t,
    [endA, startA],
  );
  const xy = React.useCallback(
    (ang: number, rad: number) => ({
      x: cx + rad * Math.cos(ang),
      y: cy + rad * Math.sin(ang),
    }),
    [cx, cy],
  );

  const arcPath = React.useCallback(
    (t0: number, t1: number) => {
      const a0 = angle(Math.max(0, Math.min(1, t0)));
      const a1 = angle(Math.max(0, Math.min(1, t1)));
      const p0 = xy(a0, r);
      const p1 = xy(a1, r);
      const large = 0;
      const sweep = 0;
      return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} ${sweep} ${p1.x} ${p1.y}`;
    },
    [angle, r, xy],
  );

  const activeT = scrubT ?? tOf(value);
  const needleAng = angle(activeT);
  const needleLen = Math.max(28, r - valueWidth - 16);
  const needleTip = xy(needleAng, needleLen);

  const updateScrub = React.useCallback(
    (next: number | null) => {
      const nextT = next == null ? null : tOf(next);
      setScrubT(nextT);
      if (!onScrub) return;
      const current = scrubValueRef.current;
      if (current === next) return;
      scrubValueRef.current = next;
      onScrub(next ?? undefined);
    },
    [onScrub, tOf],
  );

  React.useEffect(() => {
    scrubValueRef.current = null;
    setScrubT(null);
  }, [domainMin, domainMax, value]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const ang = Math.atan2(py - cy, px - cx);
      const raw = (ang - startA) / (endA - startA);
      const t = clamp(raw, 0, 1);
      const nextValue = vOf(t);
      updateScrub(nextValue);
    },
    [cx, cy, endA, startA, updateScrub, vOf],
  );

  const handlePointerLeave = React.useCallback(() => {
    updateScrub(null);
  }, [updateScrub]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (!onScrub) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const base = scrubValueRef.current ?? value;
      const delta = span / 40;
      const next = clampValue(base + direction * delta);
      updateScrub(next);
    },
    [clampValue, onScrub, span, updateScrub, value],
  );

  const handleBlur = React.useCallback(() => {
    updateScrub(null);
  }, [updateScrub]);

  const tickCount = 6;
  const ticks = React.useMemo(
    () =>
      Array.from({ length: tickCount }, (_, index) => {
        const t = index / (tickCount - 1);
        const ang = angle(t);
        const inner = xy(ang, r - 10);
        const outer = xy(ang, r + 2);
        return { id: index, inner, outer };
      }),
    [angle, r, xy],
  );

  const previewValue = scrubT == null ? undefined : vOf(scrubT);

  const interactive = Boolean(onScrub);
  const ariaProps = interactive
    ? {
        role: "slider" as const,
        "aria-valuemin": domainMin,
        "aria-valuemax": domainMax,
        "aria-valuenow": clampValue(previewValue ?? value),
        "aria-valuetext": formatUSD(clampValue(previewValue ?? value)),
      }
    : ({ role: "img" as const } as const);

  const haloStyle = React.useMemo<React.CSSProperties>(
    () => ({
      paintOrder: "stroke",
      stroke: "white",
      strokeWidth: 3,
      strokeLinejoin: "round",
      whiteSpace: "nowrap",
    }),
    [],
  );

  const currencyFormatter = React.useMemo(() => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
    } catch (error) {
      return null;
    }
  }, []);

  const getValueParts = React.useCallback(
    (val: number) => {
      if (currencyFormatter && typeof currencyFormatter.formatToParts === "function") {
        try {
          return currencyFormatter.formatToParts(val);
        } catch (error) {
          // fall back to simple string
        }
      }
      return [
        {
          type: "literal",
          value: formatUSD(val),
        } as Intl.NumberFormatPart,
      ];
    },
    [currencyFormatter],
  );

  return (
    <svg
      ref={svgRef}
      {...ariaProps}
      aria-label={ariaLabel}
      aria-description="Use arrow keys or hover to preview."
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full"
      tabIndex={interactive ? 0 : -1}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerEnter={interactive ? handlePointerMove : undefined}
      onPointerLeave={interactive ? handlePointerLeave : undefined}
      onPointerUp={interactive ? handlePointerLeave : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onBlur={handleBlur}
      style={{
        overflow: "visible",
        cursor: interactive ? "pointer" : "default",
        transition: prefersReducedMotion ? "none" : "filter 150ms ease",
      }}
      data-prefers-reduced-motion={prefersReducedMotion ? "true" : "false"}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={w} height={cy + 2} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <path
          d={arcPath(0, 1)}
          stroke="#94A3B8"
          strokeWidth={trackWidth + 2}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={arcPath(0, activeT)}
          stroke="#0F172A"
          strokeWidth={valueWidth + 2}
          strokeLinecap="round"
          fill="none"
        />

        {ticks.map((tick) => (
          <line
            key={tick.id}
            x1={tick.inner.x}
            y1={tick.inner.y}
            x2={tick.outer.x}
            y2={tick.outer.y}
            stroke="#94A3B8"
            strokeWidth={1.5}
            opacity={0.35}
          />
        ))}

        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#0F172A"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />
      </g>

      {safePoints.map((pt) => {
        const t = tOf(pt.value);
        const a = angle(t);
        const onArc = xy(a, r);
        const outside = xy(a, r + 36);
        const anchor = t < 0.33 ? "start" : t > 0.67 ? "end" : "middle";
        const clampX = (x: number) => Math.max(12, Math.min(w - 12, x));
        const clampY = (y: number) => Math.max(12, Math.min(cy - 8, y));
        const lx = clampX(outside.x);
        const ly1 = clampY(outside.y - 8);
        const ly2 = clampY(outside.y + 10);
        const valueParts = getValueParts(pt.value);

        return (
          <g key={pt.id} pointerEvents="none">
            <line
              x1={onArc.x}
              y1={onArc.y}
              x2={lx}
              y2={clampY(outside.y)}
              stroke="#94A3B8"
              strokeWidth={1.25}
            />
            <circle cx={onArc.x} cy={onArc.y} r={4} fill="#0F172A" />
            {pt.id !== "market" && (
              <>
                <text
                  x={lx}
                  y={ly1}
                  fontSize={12}
                  textAnchor={anchor as any}
                  style={haloStyle}
                  dominantBaseline="central"
                  fill="#475569"
                >
                  {pt.label}
                </text>
                <text
                  x={lx}
                  y={ly2}
                  className="tabular-nums"
                  fontSize={13}
                  fontWeight={600}
                  textAnchor={anchor as any}
                  style={haloStyle}
                  dominantBaseline="central"
                  fill="#0F172A"
                >
                  {valueParts.map((part, idx) =>
                    part.type === "group" ? (
                      <tspan key={`${pt.id}-group-${idx}`} aria-hidden="true">
                        {part.value}
                      </tspan>
                    ) : (
                      <tspan key={`${pt.id}-part-${idx}`}>{part.value}</tspan>
                    ),
                  )}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
