import * as React from "react";

import ProGauge from "./ProGauge";
import { LABELS } from "./labels";
import { formatUSD } from "./format";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function ResultsCard({
  wholesale,
  market,
  replacement,
}: {
  wholesale: number;
  market: number;
  replacement: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(420);
  const [preview, setPreview] = React.useState<number | undefined>(undefined);
  const handleScrub = React.useCallback((next?: number) => {
    setPreview(next);
  }, []);

  React.useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth((prev) => {
          const next = entry.contentRect.width;
          if (Math.abs(prev - next) < 0.5) {
            return prev;
          }
          return next;
        });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const safeWholesale = Number.isFinite(wholesale) ? wholesale : 0;
  const safeReplacement = Number.isFinite(replacement)
    ? replacement
    : safeWholesale + 1;
  const safeMarket = Number.isFinite(market)
    ? market
    : safeWholesale + (safeReplacement - safeWholesale) / 2;

  let min = Math.min(safeWholesale, safeReplacement, safeMarket);
  let max = Math.max(safeWholesale, safeReplacement, safeMarket);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const clampedMarket = clamp(safeMarket, min, max);
  const points = React.useMemo(
    () => [
      { id: "wholesale", label: LABELS.wholesale, value: safeWholesale },
      { id: "market", label: LABELS.market, value: clampedMarket },
      { id: "replacement", label: LABELS.replacement, value: safeReplacement },
    ],
    [clampedMarket, safeReplacement, safeWholesale],
  );

  const gaugeSize = clamp(width, 340, 640);
  const displayValue = clamp(preview ?? clampedMarket, min, max);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
      <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
        <div className="px-6 pt-8 pb-16 md:px-10">
          <div className="mb-6 text-center">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
              Valuation Results
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Range from {LABELS.wholesale} to {LABELS.replacement}. Needle marks {LABELS.market}.
            </p>
          </div>

          {/* Gauge */}
          <div ref={ref} className="flex justify-center px-2">
            <ProGauge
              min={min}
              max={max}
              value={clampedMarket}
              points={points}
              size={gaugeSize}
              trackWidth={16}
              valueWidth={16}
              onScrub={handleScrub}
              ariaLabel="Valuation gauge. Needle indicates Market Value; hover or use arrow keys to preview."
            />
          </div>

          <div className="relative flex justify-center">
            <div
              className="mt-[-8px] mb-2 inline-flex max-w-full items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200"
              style={{ minHeight: 56 }}
              data-testid="market-tile"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">
                Market Value
              </span>
              <span
                className="truncate text-3xl font-semibold text-slate-900 tabular-nums md:text-4xl"
                title={formatUSD(displayValue)}
                aria-label={formatUSD(displayValue)}
              >
                {formatUSD(displayValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider + support tiles (no stray “Market Value” chip below) */}
        <div className="grid gap-4 border-t border-slate-100 p-4 pt-6 md:grid-cols-2 md:p-6">
          <ValueTile
            label={LABELS.wholesale}
            value={safeWholesale}
            testId="wholesale-tile"
          />
          <ValueTile
            label={LABELS.replacement}
            value={safeReplacement}
            testId="replacement-tile"
          />
        </div>
      </div>
    </div>
  );
}

function ValueTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm"
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums md:text-3xl">
        {formatUSD(value)}
      </div>
    </div>
  );
}
