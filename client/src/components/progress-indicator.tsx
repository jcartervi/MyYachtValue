interface ProgressIndicatorProps {
  currentStep: number;
}

export default function ProgressIndicator({ currentStep }: ProgressIndicatorProps) {
  const steps = [
    { number: 1, label: "Contact", icon: "fas fa-user" },
    { number: 2, label: "Vessel Details", icon: "fas fa-ship" },
    { number: 3, label: "Valuation", icon: "fas fa-chart-bar" },
  ];

  return (
    <div className="flex justify-center items-center space-x-8">
      {steps.map((step, index) => (
        <div key={step.number} className={`progress-step flex flex-col items-center ${step.number <= currentStep ? 'completed' : ''}`}>
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold mb-2 transition-colors ${
              step.number <= currentStep 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
            data-testid={`progress-step-${step.number}`}
          >
            <i className={step.icon} />
          </div>
          <span 
            className={`text-sm font-medium transition-colors ${
              step.number <= currentStep ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
