import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    low: number;
    mostLikely: number;
    high: number;
    wholesale: number;
    confidence: string;
    narrative: string;
    comps: Array<{
      title: string;
      ask: number;
      year: number;
      loa: number;
      region: string;
      brand?: string;
      model?: string;
      fuel_type?: string;
    }>;
    isPremiumLead: boolean;
    aiStatus?: string;
    marketData?: {
      realComparables: number;
      syntheticComparables: number;
      iybaStatus: 'success' | 'partial' | 'failed';
      dataSource: 'iyba' | 'synthetic' | 'mixed';
    };
  };
}

interface ValuationResultsProps {
  data: ValuationData;
  onCallJames: () => void;
  onEmailReport: () => void;
}

export default function ValuationResults({ data, onCallJames, onEmailReport }: ValuationResultsProps) {
  const { lead, vessel, estimate } = data;

  return (
    <div className="fade-in">
      <Card className="shadow-lg border overflow-hidden">
        {/* Results Header */}
        <div className="gradient-bg text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="text-valuation-title">
                Your Boat Valuation
              </h2>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-blue-100">Based on current market conditions and comparable sales</p>
                {estimate.marketData && (
                  <div className="flex gap-2">
                    {estimate.marketData.dataSource === 'iyba' && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium" data-testid="badge-iyba-data">
                        Live Market Data
                      </span>
                    )}
                    {estimate.marketData.dataSource === 'mixed' && (
                      <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium" data-testid="badge-mixed-data">
                        Market + AI Analysis
                      </span>
                    )}
                    {estimate.marketData.realComparables > 0 && (
                      <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-1 rounded-full font-medium" data-testid="badge-real-comps">
                        {estimate.marketData.realComparables} Real Sales
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white bg-opacity-20 rounded-lg px-3 py-1">
                <span className="text-sm font-medium" data-testid="text-confidence">
                  Confidence: {estimate.confidence}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Vessel Summary */}
        <CardContent className="p-6 border-b">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Vessel Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Brand:</span>
                  <span className="font-medium" data-testid="text-vessel-brand">{vessel.brand}</span>
                </div>
                {vessel.model && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-medium" data-testid="text-vessel-model">{vessel.model}</span>
                  </div>
                )}
                {vessel.year && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Year:</span>
                    <span className="font-medium" data-testid="text-vessel-year">{vessel.year}</span>
                  </div>
                )}
                {vessel.loaFt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Length:</span>
                    <span className="font-medium" data-testid="text-vessel-length">{vessel.loaFt}ft</span>
                  </div>
                )}
                {vessel.fuelType && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fuel Type:</span>
                    <span className="font-medium" data-testid="text-vessel-fuel">
                      {vessel.fuelType === 'gas' ? 'Gas' : 
                       vessel.fuelType === 'diesel' ? 'Diesel' : 
                       vessel.fuelType === 'unknown' ? 'Unknown' : vessel.fuelType}
                    </span>
                  </div>
                )}
                {vessel.hours !== null && vessel.hours !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hours:</span>
                    <span className="font-medium" data-testid="text-vessel-hours">{vessel.hours.toLocaleString()}</span>
                  </div>
                )}
                {vessel.condition && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Condition:</span>
                    <span className="font-medium" data-testid="text-vessel-condition">
                      {vessel.condition === 'very_good' ? 'Very Good' : 
                       vessel.condition.charAt(0).toUpperCase() + vessel.condition.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Valuation Range</h3>
              <div className="space-y-4">
                <div className="text-center p-4 bg-primary bg-opacity-10 rounded-lg">
                  <div className="text-sm text-white font-medium mb-1">Estimated Value</div>
                  <div className="text-3xl font-bold text-white" data-testid="text-most-likely-value">
                    ${estimate.mostLikely.toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-muted-foreground mb-1">Low</div>
                    <div className="font-semibold" data-testid="text-low-value">
                      ${estimate.low.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-muted-foreground mb-1">High</div>
                    <div className="font-semibold" data-testid="text-high-value">
                      ${estimate.high.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-center p-3 bg-secondary rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Wholesale Estimate</div>
                  <div className="font-semibold text-foreground" data-testid="text-wholesale-value">
                    ${estimate.wholesale.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        {/* Market Analysis */}
        <CardContent className="p-6 border-b">
          <h3 className="text-lg font-semibold text-foreground mb-4">Market Analysis</h3>
          
          {/* Market Data Insights */}
          {estimate.marketData && (
            <div className="grid md:grid-cols-3 gap-4 mb-6 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-real-comparables">
                  {estimate.marketData.realComparables}
                </div>
                <div className="text-sm text-muted-foreground">Real Market Sales</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-data-source">
                  {estimate.marketData.dataSource === 'iyba' ? 'IYBA' : 
                   estimate.marketData.dataSource === 'mixed' ? 'MIXED' : 'AI'}
                </div>
                <div className="text-sm text-muted-foreground">Data Source</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" data-testid="text-iyba-status">
                  {estimate.marketData.iybaStatus === 'success' ? '✓' : 
                   estimate.marketData.iybaStatus === 'partial' ? '~' : '✗'}
                </div>
                <div className="text-sm text-muted-foreground">Market Coverage</div>
              </div>
            </div>
          )}
          
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground leading-relaxed" data-testid="text-narrative">
              {estimate.narrative}
            </p>
          </div>
        </CardContent>

        {/* Comparable Sales */}
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent Comparable Sales</h3>
            {estimate.marketData && estimate.marketData.realComparables > 0 && (
              <span className="text-sm text-green-600 font-medium bg-green-50 px-2 py-1 rounded" data-testid="badge-live-data">
                Live IYBA Data
              </span>
            )}
          </div>
          <div className="space-y-4">
            {estimate.comps.map((comp, index) => {
              const isRealComparable = estimate.marketData && index < estimate.marketData.realComparables;
              return (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    isRealComparable ? 'bg-green-50 border border-green-200' : 'bg-muted'
                  }`}
                  data-testid={`comp-${index}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground" data-testid={`comp-title-${index}`}>
                        {comp.title}
                      </h4>
                      {isRealComparable && (
                        <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium" data-testid={`comp-badge-${index}`}>
                          Real Sale
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span data-testid={`comp-details-${index}`}>
                        {comp.year} • {comp.loa}ft • {comp.region}
                        {comp.brand && ` • ${comp.brand}`}
                        {comp.fuel_type && comp.fuel_type !== 'unknown' && ` • ${comp.fuel_type === 'gas' ? 'Gas' : 'Diesel'}`}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground" data-testid={`comp-price-${index}`}>
                      ${comp.ask.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isRealComparable ? 'Market Price' : 'Asking Price'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {estimate.marketData && estimate.marketData.realComparables === 0 && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center text-blue-800">
                <i className="fas fa-info-circle mr-2" />
                <span className="text-sm">
                  Limited market data available for this vessel. Analysis includes AI-generated comparables based on similar vessels.
                </span>
              </div>
            </div>
          )}
        </CardContent>

        {/* Actions */}
        <CardContent className="p-6 bg-muted">
          <div className="flex flex-col md:flex-row gap-4">
            <Button 
              onClick={onCallJames}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-call-james"
            >
              <i className="fas fa-phone mr-2" />
              Call Us: (954) 541-0105
            </Button>
            <Button 
              onClick={onEmailReport}
              variant="secondary"
              className="flex-1"
              data-testid="button-email-report"
            >
              <i className="fas fa-envelope mr-2" />
              Email Full Report
            </Button>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Questions about your valuation? Our expert team is standing by to help.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Email Confirmation */}
      <Card className="mt-8 border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <i className="fas fa-check-circle text-green-500 text-xl" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-green-800" data-testid="text-confirmation-title">
                Valuation Report Generated!
              </h3>
              <p className="text-green-700 mt-1" data-testid="text-confirmation-message">
                Your detailed valuation report for the {vessel.year} {vessel.brand} {vessel.model}{" "}
                has been generated successfully. A comprehensive analysis including market trends 
                and selling strategies will be sent to {" "}
                <span className="font-semibold" data-testid="text-lead-email">james.jr@wavemarinegroup.com</span>{" "}
                upon request.
              </p>
              <p className="text-sm text-green-600 mt-2">
                <i className="fas fa-clock mr-1" />
                Generated just now • Contact us for detailed market insights
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
