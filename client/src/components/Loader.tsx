export function Loader({label="Estimating..."}: {label?: string}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,color:"var(--sea)"}}>
      <div className="hp-spin" />
      <span style={{fontWeight:600,fontSize:14}}>{label}</span>
    </div>
  );
}