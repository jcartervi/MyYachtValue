import MinimalGauge from "./MinimalGauge";

export default function ResultsCard({
  wholesale,
  market,
  replacement,
}: { wholesale: number; market: number; replacement: number; }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
      <div className="rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
        <div className="px-6 pt-8 pb-4 md:px-10">
          <div className="text-center mb-6">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
              Valuation Results
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Range from Wholesale to Replacement Cost. Needle marks Market Value.
            </p>
          </div>

          <div className="flex justify-center">
            <MinimalGauge
              min={wholesale}
              value={market}
              max={replacement}
              size={420}
              trackWidth={18}
              valueWidth={18}
              ariaLabel="Valuation gauge. Needle indicates Market Value."
            />
          </div>
        </div>

        {/* Show values ONLY here */}
        <div className="grid md:grid-cols-3 gap-4 p-4 md:p-6 border-t border-slate-100">
          <ValueTile label="Wholesale" value={wholesale} testId="wholesale-tile" />
          <ValueTile label="Market Value" value={market} emphasis testId="market-tile" />
          <ValueTile label="Replacement Cost" value={replacement} testId="replacement-tile" />
        </div>
      </div>
    </div>
  );
}

function ValueTile({ label, value, emphasis = false, testId }:{
  label: string; value: number; emphasis?: boolean; testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 ${emphasis ? "ring-1 ring-slate-300 bg-white shadow-sm" : ""}`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900 tabular-nums">
        {formatCurrency(value)}
      </div>
    </div>
  );
}

function formatCurrency(n: number) {
  try {
    return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}
