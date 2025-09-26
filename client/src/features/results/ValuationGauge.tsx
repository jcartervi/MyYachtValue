import * as React from "react";

type ValuationGaugeProps = {
  wholesale: number;
  market: number;
  replacement: number;
  size?: number;
  trackWidth?: number;
  valueWidth?: number;
  ariaLabel?: string;
};

const DEFAULT_SIZE = 420;
const DEFAULT_TRACK = 18;
const DEFAULT_VALUE_WIDTH = 18;

const formatUSD = (value: number) => {
  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export default function ValuationGauge({
  wholesale,
  market,
  replacement,
  size = DEFAULT_SIZE,
  trackWidth = DEFAULT_TRACK,
  valueWidth = DEFAULT_VALUE_WIDTH,
  ariaLabel = "Valuation gauge",
}: ValuationGaugeProps) {
  const width = size;
  const height = Math.round(size * 0.58);
  const cx = width / 2;
  const cy = height * 0.95;
  const radius = Math.max(10, Math.min(cx, cy) - Math.max(trackWidth, valueWidth));

  const safeWholesale = isFiniteNumber(wholesale) ? wholesale : 0;
  const safeReplacement = isFiniteNumber(replacement) ? replacement : safeWholesale + 1;

  const minValue = Math.min(safeWholesale, safeReplacement);
  const maxValue = Math.max(safeWholesale, safeReplacement);
  const span = maxValue - minValue || 1;

  const fallbackValue = minValue + span / 2;
  const rawMarket = isFiniteNumber(market) ? market : fallbackValue;
  const clampedMarket = Math.min(Math.max(rawMarket, minValue), maxValue);

  const t = (clampedMarket - minValue) / span;
  const angleOf = (ratio: number) => Math.PI - Math.PI * ratio;

  const arc = (start: number, end: number) => {
    const startAngle = angleOf(start);
    const endAngle = angleOf(end);
    const x0 = cx + radius * Math.cos(startAngle);
    const y0 = cy + radius * Math.sin(startAngle);
    const x1 = cx + radius * Math.cos(endAngle);
    const y1 = cy + radius * Math.sin(endAngle);
    const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1}`;
  };

  const needleAngle = angleOf(t);
  const needleInnerRadius = radius - valueWidth;
  const needleX = cx + needleInnerRadius * Math.cos(needleAngle);
  const needleY = cy + needleInnerRadius * Math.sin(needleAngle);

  const label = `${ariaLabel}. Wholesale ${formatUSD(safeWholesale)}. Market ${formatUSD(clampedMarket)}. Replacement ${formatUSD(safeReplacement)}.`;

  return (
    <div className="w-full flex justify-center">
      <svg
        role="img"
        aria-label={label}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ overflow: "visible" }}
      >
        <path
          d={arc(0, 1)}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />
        <path
          d={arc(0, t)}
          fill="none"
          stroke="#0F172A"
          strokeWidth={valueWidth}
          strokeLinecap="round"
        />
        <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#0F172A" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={6} fill="#0F172A" />
      </svg>
    </div>
  );
}
