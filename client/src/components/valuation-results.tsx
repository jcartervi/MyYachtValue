import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/MetricCard";

interface ValuationData {
  lead: {
    id: string;
    email: string;
    name?: string;
  };
  vessel: {
    id: string;
    brand: string;
    model?: string;
    year?: number;
    loaFt?: number;
    fuelType?: string;
    hours?: number;
    condition?: string;
  };
  estimate: {
    id: string;
    low: number | null;
    mostLikely: number | null;
    high: number | null;
    wholesale: number | null;
    narrative: string;
    assumptions?: string[];
    comps?: Array<{
      title: string;
      ask: number;
      year: number;
      loa: number;
      region: string;
    }>;
    isPremiumLead?: boolean;
  };
}

interface ValuationResultsProps {
  data: ValuationData;
  onCallJames: () => void;
  onEmailReport: () => void;
}

const fmt = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
    : "—";

export default function ValuationResults({ data, onCallJames, onEmailReport }: ValuationResultsProps) {
  const { vessel, estimate } = data;

  const lowValue = typeof estimate.low === "number" ? `$${fmt(estimate.low)}` : "—";
  const midValue = typeof estimate.mostLikely === "number" ? `$${fmt(estimate.mostLikely)}` : "—";
  const highValue = typeof estimate.high === "number" ? `$${fmt(estimate.high)}` : "—";
  const wholesaleValue = typeof estimate.wholesale === "number" ? `~$${fmt(estimate.wholesale)}` : "—";
  const narrative = estimate.narrative ?? "";

  return (
    <div className="max-w-5xl mx-auto px-4 space-y-6 md:space-y-8">
      <Card className="border shadow-sm">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Your Boat Valuation</h2>
          <p className="text-sm text-muted-foreground">
            Based on current market conditions for your
            {vessel.year ? ` ${vessel.year}` : ""}
            {` ${vessel.brand}`}
            {vessel.model ? ` ${vessel.model}` : ""}
          </p>
        </CardHeader>
        <CardContent className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Low" value={lowValue} />
            <MetricCard label="Most Likely" value={midValue} />
            <MetricCard label="High" value={highValue} />
            <MetricCard label="Wholesale (Fast Cash)" value={wholesaleValue} />
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-muted-foreground leading-relaxed">{narrative}</p>
          </div>
          {estimate.assumptions && estimate.assumptions.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Key Assumptions</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                {estimate.assumptions.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-3 md:flex-row">
            <Button onClick={onCallJames} className="md:flex-1">Call Us: (954) 541-0105</Button>
            <Button onClick={onEmailReport} variant="secondary" className="md:flex-1">
              Email Full Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
