import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BoatForm from "@/components/boat-form";
import ValuationResults from "@/components/valuation-results";
import ProgressIndicator from "@/components/progress-indicator";
import { useToast } from "@/hooks/use-toast";
import { useUTMTracking } from "@/hooks/use-utm-tracking";

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
    setCurrentStep(3);
    
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
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                <i className="fas fa-ship text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Wave Marine Group</h1>
                <p className="text-xs text-muted-foreground">#jamescarteryachting</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-4 text-sm text-muted-foreground">
              <span className="flex items-center">
                <i className="fas fa-shield-alt mr-1" />
                Licensed Broker
              </span>
              <span className="flex items-center">
                <i className="fas fa-map-marker-alt mr-1" />
                South Florida
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="gradient-bg text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-20" />
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1544551763-46a013bb70d5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1920&h=1080')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">What's Your Boat Worth Today?</h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">Instant AI-powered valuation with recent market comparables</p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center">
                <i className="fas fa-lock mr-2" />
                100% Private & Secure
              </div>
              <div className="flex items-center">
                <i className="fas fa-chart-line mr-2" />
                Real Market Data
              </div>
              <div className="flex items-center">
                <i className="fas fa-clock mr-2" />
                Instant Results
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Application */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* Progress Indicator */}
        <div className="mb-12">
          <ProgressIndicator currentStep={currentStep} />
        </div>

        {/* Form or Results */}
        {currentStep < 3 ? (
          <BoatForm
            currentStep={currentStep}
            onStepChange={setCurrentStep}
            onComplete={handleValuationComplete}
            onLoadingChange={setIsLoading}
            isLoading={isLoading}
            utmParams={utmParams}
          />
        ) : (
          valuationData && (
            <ValuationResults
              data={valuationData}
              onCallJames={handleCallJames}
              onEmailReport={handleEmailReport}
            />
          )
        )}

        {/* Additional Services */}
        {currentStep === 3 && (
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-handshake text-primary text-xl" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Sell Your Boat</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Get maximum value with our proven marketing strategy and expert negotiation.
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
                  Access exclusive listings and off-market opportunities in your price range.
                </p>
                <Button variant="link" className="text-primary p-0" data-testid="button-find-boat">
                  Browse Listings <i className="fas fa-arrow-right ml-1" />
                </Button>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="p-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-calculator text-purple-600 text-xl" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Financing Options</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Competitive rates and flexible terms for your boat purchase or refi.
                </p>
                <Button variant="link" className="text-primary p-0" data-testid="button-financing">
                  Get Rates <i className="fas fa-arrow-right ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Trust Indicators */}
        {currentStep === 3 && (
          <Card className="mt-12 shadow-lg">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Why Trust Wave Marine Group?</h2>
                <p className="text-muted-foreground">Your boat valuation is backed by years of market expertise</p>
              </div>
              <div className="grid md:grid-cols-4 gap-8 text-center">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">500+</div>
                  <div className="text-sm text-muted-foreground">Boats Sold</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">$2.1B</div>
                  <div className="text-sm text-muted-foreground">Sales Volume</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">15+</div>
                  <div className="text-sm text-muted-foreground">Years Experience</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">98%</div>
                  <div className="text-sm text-muted-foreground">Client Satisfaction</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center">
                  <i className="fas fa-ship text-white text-lg" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Wave Marine Group</h3>
                  <p className="text-xs text-muted-foreground">#jamescarteryachting</p>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                South Florida's premier boat brokerage, specializing in luxury motor boats 
                and sport fishers. Licensed, bonded, and committed to exceptional service.
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
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Boat Sales</a></li>
                <li><a href="#" className="hover:text-primary">Boat Purchase</a></li>
                <li><a href="#" className="hover:text-primary">Valuations</a></li>
                <li><a href="#" className="hover:text-primary">Financing</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <i className="fas fa-phone mr-2" />
                  <a href="tel:+19545410105" className="hover:text-primary">(954) 541-0105</a>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-envelope mr-2" />
                  <a href="mailto:james@wavemarinegroup.com" className="hover:text-primary">james@wavemarinegroup.com</a>
                </div>
                <div className="flex items-center">
                  <i className="fas fa-map-marker-alt mr-2" />
                  <span>Fort Lauderdale, FL</span>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2024 Wave Marine Group. All rights reserved. • Licensed Boat Broker • TCPA Compliant</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
