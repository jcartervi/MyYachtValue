import * as React from "react";
import PremiumGauge from "./PremiumGauge";
import { LABELS } from "./labels";
import { formatUSD } from "./format";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function useContainerWidth(min = 260, max = 640) {
  const ref = React.useRef<HTMLDivElement>(null);
  const clamp = React.useCallback(
    (cw: number) => {
      const isCompact = cw < 420;
      const pct = isCompact ? 0.74 : 0.86;
      const targetMin = isCompact ? 240 : min;
      const target = cw * pct;
      return Math.round(Math.max(targetMin, Math.min(max, target)));
    },
    [max, min],
  );

  const [w, setW] = React.useState<number>(() => {
    if (typeof window === "undefined") return min;
    return clamp(window.innerWidth);
  });

  const update = React.useCallback(
    (cw: number) => {
      setW(clamp(cw));
    },
    [clamp],
  );

  useIsomorphicLayoutEffect(() => {
    if (!ref.current) return;
    update(ref.current.offsetWidth || min);
  }, [min, update]);

  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      update(entry.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update]);

  return { ref, w };
}

export default function ResultsCard({
  wholesale,
  market,
  replacement,
}: {
  wholesale: number;
  market: number;
  replacement: number;
}) {
  const { ref, w } = useContainerWidth();
  const min = Math.min(wholesale, replacement);
  const max = Math.max(wholesale, replacement);

  const markers: React.ComponentProps<typeof PremiumGauge>["markers"] = [
    { id: "wholesale", value: wholesale, label: LABELS.wholesale },
    { id: "market", value: market, label: LABELS.market },
    { id: "replacement", value: replacement, label: LABELS.replacement },
  ];

  return (
    <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
      <div className="px-4 md:px-10 pt-8">
        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-lg md:text-2xl font-semibold tracking-tight text-slate-900">Valuation Results</h2>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            Range from {LABELS.wholesale} to {LABELS.replacement}. Needle marks {LABELS.market}.
          </p>
        </div>

        {/* Gauge */}
        <div ref={ref} className="flex justify-center">
          <PremiumGauge
            min={min}
            max={max}
            value={market}
            markers={markers}
            size={w}
            trackWidth={14}
            valueWidth={16}
            ariaLabel="Valuation gauge with positioned values."
          />
        </div>

        {/* Emphasized, detached Market Value pill (mobile-friendly) */}
        <div className="relative flex justify-center">
          <div
            className="mt-4 md:mt-5 mb-2 inline-flex max-w-full items-center gap-2 md:gap-3 rounded-2xl bg-white px-4 md:px-6 py-3 md:py-4 shadow-md ring-1 ring-slate-200"
            style={{ minHeight: 56, zIndex: 2, boxShadow: "0 6px 20px rgba(15,23,42,0.06)" }}
            data-testid="market-tile"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="text-[10px] md:text-xs uppercase tracking-wide text-slate-500 shrink-0">
              {LABELS.market}
            </span>
            <span className="text-2xl md:text-4xl font-semibold text-slate-900 tabular-nums truncate">
              {formatUSD(market)}
            </span>
          </div>
        </div>
      </div>

      {/* Support tiles below divider (balanced, mobile-first) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 pt-7 md:pt-9 border-t border-slate-100">
        <ValueTile label={LABELS.wholesale} value={wholesale} testId="wholesale-tile" />
        <ValueTile label={LABELS.replacement} value={replacement} testId="replacement-tile" />
      </div>
    </div>
  );
}

function ValueTile({ label, value, testId }:{
  label: string; value: number; testId?: string;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
      <div className="text-[10px] md:text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 md:mt-1 text-xl md:text-3xl font-semibold text-slate-900 tabular-nums">
        {formatUSD(value)}
      </div>
    </div>
  );
}
