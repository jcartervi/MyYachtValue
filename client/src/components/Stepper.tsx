export function Stepper({step=1, steps=["Boat","Options","Estimate"]}: {step?: number, steps?: string[]}){
  return (
    <div className="hp-stepper">
      {steps.map((s,i)=>{
        const n=i+1, active=n<=step;
        return (
          <div className="hp-step" key={s}>
            <div className={`hp-bubble ${active?"hp-bubble--active":""}`}>{n}</div>
            <div className={`hp-steptext ${active?"hp-steptext--active":""}`}>{s}</div>
            {i<steps.length-1 && <div className="hp-divider" />}
          </div>
        );
      })}
    </div>
  );
}