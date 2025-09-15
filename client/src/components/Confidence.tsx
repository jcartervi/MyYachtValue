export function Confidence({level="Medium"}: {level?: "Low" | "Medium" | "High"}){
  const idx = level==="High" ? 3 : level==="Low" ? 1 : 2;
  return (
    <div className="hp-conf">
      <div style={{fontSize:13,color:"#5B6B7E"}}>Confidence: <b>{level}</b></div>
      <div className="bar">
        {[1,2,3].map(i=> <div key={i} className={`seg ${i<=idx?"on":""}`} />)}
      </div>
    </div>
  );
}