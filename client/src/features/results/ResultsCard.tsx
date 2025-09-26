import * as React from "react";
import ProGauge from "./ProGauge";
import { LABELS } from "./labels";
import { formatUSD } from "./format";

export default function ResultsCard({
  wholesale,
  market,
  replacement,
}: {
  wholesale: number;
  market: number;
  replacement: number;
}) {
  const [preview, setPreview] = React.useState<number | null>(null);

  const min = Math.min(wholesale, replacement);
  const max = Math.max(wholesale, replacement);

  const points: {
    id: "wholesale" | "market" | "replacement";
    label: string;
    value: number;
  }[] = [
    { id: "wholesale", label: LABELS.wholesale, value: wholesale },
    { id: "market", label: LABELS.market, value: market },
    { id: "replacement", label: LABELS.replacement, value: replacement },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
      <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
        <div className="px-6 pt-8 md:px-10">
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Valuation Results</h2>
            <p className="mt-1 text-sm text-slate-500">
              Range from {LABELS.wholesale} to {LABELS.replacement}. Needle marks {LABELS.market}. Hover to preview.
            </p>
          </div>

          <div className="flex justify-center">
            <ProGauge
              min={min}
              max={max}
              value={market}
              points={points}
              size={560}
              trackWidth={16}
              valueWidth={16}
              onScrub={setPreview}
              ariaLabel="Valuation gauge. Needle indicates Market Value; hover or use arrow keys to preview."
            />
          </div>

          <div className="flex justify-center">
            <div
              className="mt-6 mb-2 inline-flex max-w-full items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-md ring-1 ring-slate-200"
              data-testid="market-tile"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="text-xs uppercase tracking-wide text-slate-500 shrink-0">
                {LABELS.market}
              </span>
              <span className="text-3xl md:text-4xl font-semibold text-slate-900 tabular-nums truncate">
                {formatUSD(preview ?? market)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4 md:p-6 border-t border-slate-100">
          <ValueTile label={LABELS.wholesale} value={wholesale} testId="wholesale-tile" />
          <ValueTile label={LABELS.replacement} value={replacement} testId="replacement-tile" />
        </div>
      </div>
    </div>
  );
}

function ValueTile({ label, value, testId }:{
  label: string; value: number; testId?: string;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">
        {formatUSD(value)}
      </div>
    </div>
  );
}
