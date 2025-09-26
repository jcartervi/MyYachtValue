import * as React from "react";

import { formatUSD } from "./format";
import { LABELS, type LabelKey } from "./labels";

type ProGaugeProps = {
  wholesale: number;
  market: number;
  replacement: number;
  size?: number;
  trackWidth?: number;
  valueWidth?: number;
  ariaLabel?: string;
};

type GaugePoint = {
  key: LabelKey;
  value: number;
  ratio: number;
  angle: number;
  trackX: number;
  trackY: number;
  labelX: number;
  labelY: number;
  tileX: number;
  tileY: number;
};

type GaugePointMap = Record<LabelKey, GaugePoint>;

const DEFAULT_SIZE = 600;
const DEFAULT_TRACK_WIDTH = 16;
const DEFAULT_VALUE_WIDTH = 16;
const EDGE_PADDING_DEGREES = 10;
const LABEL_RADIUS_OFFSET = 86;
const TILE_RADIUS_FACTOR = 0.7;
const NEEDLE_MARGIN = 18;
const LABEL_CLAMP = 32;
const TOOLTIP_PADDING = 90;
const TOOLTIP_VERTICAL_OFFSET = 56;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const polarToCartesian = (cx: number, cy: number, radius: number, angle: number) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle),
});

export default function ProGauge({
  wholesale,
  market,
  replacement,
  size = DEFAULT_SIZE,
  trackWidth = DEFAULT_TRACK_WIDTH,
  valueWidth = DEFAULT_VALUE_WIDTH,
  ariaLabel = "Valuation gauge",
}: ProGaugeProps) {
  const rawId = React.useId();
  const gradientId = React.useMemo(
    () => `gaugeGradient-${rawId.replace(/:/g, "")}`,
    [rawId],
  );
  const width = size;
  const height = Math.round(size * 0.62);
  const cx = width / 2;
  const cy = height * 0.88;
  const radius = Math.max(40, Math.min(cx, cy) - Math.max(trackWidth, valueWidth) - 8);

  const edgePadding = (EDGE_PADDING_DEGREES * Math.PI) / 180;
  const startAngle = Math.PI + edgePadding;
  const endAngle = -edgePadding;
  const sweep = endAngle - startAngle;

  const safeWholesale = Number.isFinite(wholesale) ? wholesale : 0;
  const safeReplacement = Number.isFinite(replacement)
    ? replacement
    : safeWholesale + 1;

  const minValue = Math.min(safeWholesale, safeReplacement);
  const maxValue = Math.max(safeWholesale, safeReplacement);
  const span = maxValue - minValue || 1;

  const normalized = (value: number) =>
    span === 0 ? 0.5 : (clamp(value, minValue, maxValue) - minValue) / span;

  const keys: LabelKey[] = ["wholesale", "market", "replacement"];

  const fallbackValue = minValue + span / 2;
  const safeMarket = Number.isFinite(market) ? market : fallbackValue;

  const ratios: Record<LabelKey, number> = {
    wholesale: normalized(safeWholesale),
    market: normalized(safeMarket),
    replacement: normalized(safeReplacement),
  };

  const angleOf = (ratio: number) => startAngle + sweep * ratio;

  const labelRadius = radius + LABEL_RADIUS_OFFSET;
  const tileRadius = radius * TILE_RADIUS_FACTOR;

  const valueMap: Record<LabelKey, number> = {
    wholesale: safeWholesale,
    market: safeMarket,
    replacement: safeReplacement,
  };

  const points: GaugePoint[] = keys.map((key) => {
    const ratio = ratios[key];
    const angle = angleOf(ratio);
    const { x: trackX, y: trackY } = polarToCartesian(cx, cy, radius, angle);
    const { x: labelX, y: labelY } = polarToCartesian(cx, cy, labelRadius, angle);
    const { x: tileX, y: tileY } = polarToCartesian(cx, cy, tileRadius, angle);

    return {
      key,
      value: valueMap[key],
      ratio,
      angle,
      trackX,
      trackY,
      labelX,
      labelY,
      tileX,
      tileY,
    };
  });

  const pointMap = points.reduce<GaugePointMap>((acc, point) => {
    acc[point.key] = point;
    return acc;
  }, {} as GaugePointMap);

  const defaultKey: LabelKey = "market";
  const [activeKey, setActiveKey] = React.useState<LabelKey>(defaultKey);

  const clampedMarket = clamp(safeMarket, minValue, maxValue);
  const activePoint = (pointMap[activeKey] ?? pointMap[defaultKey])!;

  const activeRatio = activePoint?.ratio ?? normalized(clampedMarket);
  const needleAngle = angleOf(activeRatio);
  const needleLength = Math.max(20, tileRadius - NEEDLE_MARGIN);
  const { x: needleX, y: needleY } = polarToCartesian(cx, cy, needleLength, needleAngle);

  const arcPath = (from: number, to: number, lineRadius: number) => {
    const start = angleOf(from);
    const end = angleOf(to);
    const startPoint = polarToCartesian(cx, cy, lineRadius, start);
    const endPoint = polarToCartesian(cx, cy, lineRadius, end);
    const largeArc = Math.abs(end - start) > Math.PI ? 1 : 0;
    const sweepFlag = end > start ? 1 : 0;

    return `M ${startPoint.x} ${startPoint.y} A ${lineRadius} ${lineRadius} 0 ${largeArc} ${sweepFlag} ${endPoint.x} ${endPoint.y}`;
  };

  const labelDescription = `${ariaLabel}. ${LABELS.wholesale} ${formatUSD(safeWholesale)}. ${LABELS.market} ${formatUSD(
    clampedMarket,
  )}. ${LABELS.replacement} ${formatUSD(safeReplacement)}.`;

  const labelEntries = points.map((point) => {
    const cosine = Math.cos(point.angle);
    const isLeft = cosine < -0.15;
    const isRight = cosine > 0.15;
    const textAnchor: "start" | "middle" | "end" = isLeft ? "end" : isRight ? "start" : "middle";
    const clampedX = clamp(point.labelX, LABEL_CLAMP, width - LABEL_CLAMP);
    const clampedY = clamp(point.labelY, 36, height - 12);

    return {
      ...point,
      textAnchor,
      clampedX,
      clampedY,
    };
  });

  const basePoint = pointMap[defaultKey]!;

  React.useEffect(() => {
    setActiveKey(defaultKey);
  }, [wholesale, market, replacement]);

  const tooltipSource = pointMap[activeKey] ?? basePoint;
  const tooltipX = clamp(tooltipSource.tileX, TOOLTIP_PADDING, width - TOOLTIP_PADDING);
  const tooltipY = clamp(
    tooltipSource.tileY - TOOLTIP_VERTICAL_OFFSET,
    24,
    height - 24,
  );

  const tooltipLeft = `${(tooltipX / width) * 100}%`;
  const tooltipTop = `${(tooltipY / height) * 100}%`;

  const handleActivate = (key: LabelKey) => () => setActiveKey(key);
  const handleReset = () => setActiveKey(defaultKey);

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={labelDescription}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        focusable={false}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#cbd5f5" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <path
          d={arcPath(0, 1, radius)}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />
        <path
          d={arcPath(0, activeRatio, radius)}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={valueWidth}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out motion-reduce:transition-none"
        />

        {labelEntries.map((entry) => (
          <g key={entry.key}>
            <text
              x={entry.clampedX}
              y={entry.clampedY - 14}
              textAnchor={entry.textAnchor}
              className="select-none uppercase"
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.08em",
                fill: "#64748B",
                stroke: "#FFFFFF",
                strokeWidth: 3,
                paintOrder: "stroke fill",
              }}
            >
              {LABELS[entry.key]}
            </text>
            <text
              x={entry.clampedX}
              y={entry.clampedY + 6}
              textAnchor={entry.textAnchor}
              className="select-none"
              style={{
                fontSize: 20,
                fontWeight: 600,
                fill: "#0F172A",
                stroke: "#FFFFFF",
                strokeWidth: 3,
                paintOrder: "stroke fill",
              }}
            >
              {formatUSD(entry.value)}
            </text>
          </g>
        ))}

        {points.map((point) => (
          <circle
            key={`marker-${point.key}`}
            cx={point.trackX}
            cy={point.trackY}
            r={6}
            fill={point.key === activeKey ? "#1D4ED8" : "#94A3B8"}
            className="transition-colors duration-300 motion-reduce:transition-none"
          />
        ))}

        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#0F172A"
          strokeWidth={3}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out motion-reduce:transition-none"
        />
        <circle cx={cx} cy={cy} r={8} fill="#0F172A" />
      </svg>

      <div className="pointer-events-none absolute inset-0">
        <div
          className="pointer-events-none absolute"
          style={{
            left: tooltipLeft,
            top: tooltipTop,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="pointer-events-none whitespace-nowrap rounded-full bg-slate-900/90 px-3 py-1 text-xs font-medium text-white shadow-lg">
            {LABELS[activePoint.key]} · {formatUSD(activePoint.value)}
          </div>
        </div>
      </div>

      <div className="absolute inset-0" onMouseLeave={handleReset}>
        {points.map((point) => (
          <button
            key={`tile-${point.key}`}
            type="button"
            onMouseEnter={handleActivate(point.key)}
            onMouseLeave={handleReset}
            onFocus={handleActivate(point.key)}
            onBlur={handleReset}
            className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-lg border px-3 py-1 text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 motion-reduce:transition-none ${
              point.key === activeKey
                ? "border-slate-900 bg-slate-900 text-white focus-visible:ring-slate-700"
                : "border-white/60 bg-white/70 text-slate-700 backdrop-blur focus-visible:ring-slate-300"
            }`}
            style={{
              left: `${(point.tileX / width) * 100}%`,
              top: `${(point.tileY / height) * 100}%`,
            }}
            aria-pressed={point.key === activeKey}
            aria-label={`${LABELS[point.key]} ${formatUSD(point.value)}`}
          >
            {LABELS[point.key]}
          </button>
        ))}
      </div>
    </div>
  );
}
