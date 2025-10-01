import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BoatForm from "@/components/boat-form";
import ValuationResults from "@/components/valuation-results";
import ProgressIndicator from "@/components/progress-indicator";
import { useToast } from "@/hooks/use-toast";
import { useUTMTracking } from "@/hooks/use-utm-tracking";
import MyYachtValueLogo from "@/components/MyYachtValueLogo";
import { Stepper } from "@/components/Stepper";
import { ValuationGauge } from "@/components/valuation-gauge";
import { Loader } from "@/components/Loader";

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
    engineType?: string;
    hours?: number;
    gyro: boolean;
  };
  estimate: {
    id: string;
    low: number;
    mostLikely: number;
    high: number;
    wholesale: number;
    replacement?: number;
    confidence: string;
    narrative: string;
    comps: Array<{
      title: string;
      ask: number;
      year: number;
      loa: number;
      region: string;
    }>;
    isPremiumLead: boolean;
  };
}

export default function BoatValuation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [valuationData, setValuationData] = useState<ValuationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const utmParams = useUTMTracking();

  const handleValuationComplete = (data: ValuationData) => {
    setValuationData(data);
    setCurrentStep(4);
    
    toast({
      title: "Valuation Complete!",
      description: "Your boat valuation has been generated successfully.",
    });
  };

  const handleCallJames = () => {
    window.location.href = "tel:+19545410105";
  };

  const handleEmailReport = () => {
    toast({
      title: "Report Requested",
      description: "A detailed valuation report will be sent to your email address.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div style={{maxWidth:960, margin:"24px auto", padding:"0 16px"}}>
        <Stepper step={currentStep} steps={["Contact", "Vessel", "Features & Condition", "Results"]} />

        {currentStep < 4 ? (
          <section className="hp-card" style={{padding:18, marginTop:16}}>
            <BoatForm
              currentStep={currentStep}
              onStepChange={setCurrentStep}
              onComplete={handleValuationComplete}
              onLoadingChange={setIsLoading}
              isLoading={isLoading}
              utmParams={utmParams}
            />
          </section>
        ) : (
          valuationData && (
            (() => {
              const valuation = {
                ...valuationData.estimate,
                mid: valuationData.estimate.mostLikely,
              };
              const replacementMultiplier = Number(import.meta.env.VITE_REPLACEMENT_MULTIPLIER ?? 1.35);
              const safeMultiplier = Number.isFinite(replacementMultiplier) ? replacementMultiplier : 1.35;
              return (
                <section className="hp-card" style={{ padding: 18, marginTop: 16 }}>
                  <ValuationGauge
                    wholesale={valuation.wholesale ?? valuation.low ?? 0}
                    market={valuation.mid ?? valuation.mostLikely ?? 0}
                    replacement={
                      valuation.replacement ??
                      Math.round((valuation.mid ?? 0) * safeMultiplier)
                    }
                  />
                </section>
              );
            })()
          )
        )}

        {isLoading && <div style={{marginTop:16}}><Loader/></div>}

        {/* Additional Services */}
        {currentStep === 4 && (
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-handshake text-primary text-xl" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Sell Your Boat</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Connect with qualified boat brokers to maximize your boat's value.
                </p>
                <Button variant="link" className="text-primary p-0" data-testid="button-sell-boat">
                  Learn More <i className="fas fa-arrow-right ml-1" />
                </Button>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-search text-green-600 text-xl" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Find Your Next Boat</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Browse boat listings and market opportunities in your area.
                </p>
                <Button 
                  variant="link" 
                  className="text-primary p-0" 
                  data-testid="button-find-boat"
                  onClick={() => window.open('https://www.waveyachtsales.com/yachts-for-sale/', '_blank')}
                >
                  Browse Listings <i className="fas fa-arrow-right ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trust Indicators */}
        {currentStep === 4 && (
          <Card className="mt-12 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Why Trust MyYachtValue?</h2>
                <p className="text-muted-foreground">Your boat valuation is powered by advanced technology and real market data</p>
              </div>
              <div className="grid md:grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">10K+</div>
                  <div className="text-sm text-muted-foreground">Valuations Generated</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">$5.2B</div>
                  <div className="text-sm text-muted-foreground">Analyzed Value</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">Available</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">98%</div>
                  <div className="text-sm text-muted-foreground">Client Satisfaction</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center ring-1 ring-border bg-transparent">
                  <MyYachtValueLogo size={48} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">MyYachtValue</h3>
                  <p className="text-xs text-muted-foreground">Advanced Boat Valuations</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Advanced boat valuation platform, providing instant 
                market analysis. Fast, accurate, and completely free to use.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <i className="fab fa-instagram text-xl" />
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <i className="fab fa-facebook text-xl" />
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary">
                  <i className="fab fa-youtube text-xl" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Boat Valuations</a></li>
                <li><a href="#" className="hover:text-primary">Market Analysis</a></li>
                <li><a href="#" className="hover:text-primary">Price Comparables</a></li>
                <li><a href="#" className="hover:text-primary">Instant Reports</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <i className="fas fa-question-circle mr-2" />
                  <a href="#" className="hover:text-primary">Help Center</a>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-envelope mr-2" />
                  <a href="mailto:support@myyachtvalue.com" className="hover:text-primary">support@myyachtvalue.com</a>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-shield-alt mr-2" />
                  <span>Privacy & Security</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 MyYachtValue. All rights reserved. • Advanced Technology • TCPA Compliant</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
