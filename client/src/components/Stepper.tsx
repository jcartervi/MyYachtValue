export function Stepper({step=1, steps=["Boat","Options","Estimate"]}: {step?: number, steps?: string[]}){
  return (
    <div className="dw-stepper">
      {steps.map((s,i)=>{
        const n=i+1, active=n<=step;
        return (
          <div className="dw-step" key={s}>
            <div className={`dw-bubble ${active?"dw-bubble--active":""}`}>{n}</div>
            <div className={`dw-steptext ${active?"dw-steptext--active":""}`}>{s}</div>
            {i<steps.length-1 && <div className="dw-divider" />}
          </div>
        );
      })}
    </div>
  );
}