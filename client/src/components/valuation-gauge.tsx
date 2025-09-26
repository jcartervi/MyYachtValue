import ResultsCard from "@/features/results/ResultsCard";

type ValuationGaugeProps = {
  wholesale: number;
  market: number;
  replacement: number;
};

export function ValuationGauge(props: ValuationGaugeProps) {
  return <ResultsCard {...props} />;
}

export { default as MinimalGauge } from "@/features/results/MinimalGauge";
export { default as HardenedValuationGauge } from "@/features/results/ValuationGauge";
