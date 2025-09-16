export function MetricCard({ label, value }: { label: string; value?: number | null }) {
  const fmt = (n: number | null | undefined) =>
    typeof n === "number"
      ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
      : "—";
  return (
    <div className="hp-card hp-metric rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="hp-cap">{label}</div>
      <div className="hp-val">{fmt(value)}</div>
    </div>
  );
}