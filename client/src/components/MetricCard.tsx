export function MetricCard({label,value}: {label: string, value?: number}){
  const fmt=(n: number | undefined)=> n?.toLocaleString?.("en-US",{style:"currency",currency:"USD"}) ?? "—";
  return (
    <div className="dw-card dw-metric">
      <div className="dw-cap">{label}</div>
      <div className="dw-val">{fmt(value)}</div>
    </div>
  );
}