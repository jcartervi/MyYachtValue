import ProGauge from "./ProGauge";
import { LABELS } from "./labels";
import { formatUSD } from "./format";

export default function ResultsCard({
  wholesale,
  market,
  replacement,
}: { wholesale: number; market: number; replacement: number; }) {
  const gaugeWidth = "min(100%, clamp(340px, 60vw, 640px))";
  const safeWholesale = Number.isFinite(wholesale) ? wholesale : 0;
  const safeReplacement = Number.isFinite(replacement) ? replacement : safeWholesale + 1;
  const minValue = Math.min(safeWholesale, safeReplacement);
  const maxValue = Math.max(safeWholesale, safeReplacement);
  const span = maxValue - minValue || 1;
  const fallbackMarket = minValue + span / 2;
  const safeMarket = Number.isFinite(market) ? market : fallbackMarket;
  const clampedMarket = Math.min(Math.max(safeMarket, minValue), maxValue);

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

          <div className="flex justify-center">
            <div className="relative flex w-full justify-center" style={{ width: gaugeWidth }}>
              <ProGauge
                wholesale={wholesale}
                market={market}
                replacement={replacement}
                ariaLabel={`Valuation gauge. Needle indicates ${LABELS.market}.`}
              />

              <div
                className="pointer-events-none absolute left-1/2 top-[98%] -translate-x-1/2 -translate-y-1/2"
                aria-live="polite"
                aria-atomic="true"
              >
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-md">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {LABELS.market}
                  </span>
                  <span className="tabular-nums text-lg font-semibold text-slate-900">
                    {formatUSD(clampedMarket)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 pb-8 pt-8 md:px-10">
          <div className="grid gap-4 sm:grid-cols-2">
            <ValueTile label={LABELS.wholesale} value={safeWholesale} testId="wholesale-tile" />
            <ValueTile label={LABELS.replacement} value={safeReplacement} testId="replacement-tile" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueTile({ label, value, testId }:{
  label: string; value: number; testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 shadow-sm"
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">
        {formatUSD(value)}
      </div>
    </div>
  );
}
