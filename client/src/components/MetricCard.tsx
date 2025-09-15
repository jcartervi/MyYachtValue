export function MetricCard({label,value}: {label: string, value?: number}){
  const fmt=(n: number | undefined)=> n?.toLocaleString?.("en-US",{style:"currency",currency:"USD"}) ?? "—";
  return (
    <div className="hp-card hp-metric">
      <div className="hp-cap">{label}</div>
      <div className="hp-val">{fmt(value)}</div>
    </div>
  );
}