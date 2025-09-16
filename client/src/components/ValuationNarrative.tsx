import * as React from "react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-slate-700">{children}</div>;
}

export function ValuationNarrative({
  narrative,
  low, mid, high, wholesale
}: {
  narrative?: string | null;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  wholesale?: number | null;
}) {
  // Fallback-safe formatter; no math
  const fmt = (n?: number | null) =>
    typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—";

  // If the AI already included the token line, we just show the paragraph.
  // Below we also repeat the tokens in a clean summary row for scannability.
  return (
    <div className="space-y-3">
      <SectionTitle>Valuation Summary</SectionTitle>
      <p className="rounded-2xl border border-slate-200 bg-white p-4 leading-7 text-slate-700">
        {narrative || "Your valuation summary will appear here."}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Estimated Range</div>
          <div className="text-sm font-semibold text-slate-800">${fmt(low)}–${fmt(high)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Most Likely</div>
          <div className="text-sm font-semibold text-slate-800">${fmt(mid)}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs text-slate-500">Wholesale (Fast Cash)</div>
          <div className="text-sm font-semibold text-slate-800">~${fmt(wholesale)}</div>
        </div>
      </div>
    </div>
  );
}
