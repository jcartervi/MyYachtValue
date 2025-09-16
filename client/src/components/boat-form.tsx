import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useFormStorage } from "@/hooks/use-form-storage";
import { leadVesselValidationSchema } from "@/lib/validation";
import { apiRequest } from "@/lib/queryClient";
import { normalizeValuationResponse } from "@/lib/valuation-result";
import { Loader } from "@/components/Loader";

const generateId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

interface FormData {
  // Lead data
  name: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  city: string;
  zipCode: string;
  // Vessel data
  makeModel: string;
  year: string;
  loaFt: string;
  fuelType: string;
  condition: string;
  hours: string;
}

interface BoatFormProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete: (data: any) => void;
  onLoadingChange: (loading: boolean) => void;
  isLoading: boolean;
  utmParams: Record<string, string>;
}

export default function BoatForm({ 
  currentStep, 
  onStepChange, 
  onComplete, 
  onLoadingChange, 
  isLoading,
  utmParams 
}: BoatFormProps) {
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const isTurnstileConfigured = Boolean(import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY);
  const { toast } = useToast();
  
  const form = useForm<FormData>({
    resolver: zodResolver(leadVesselValidationSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      smsConsent: true,
      city: "",
      zipCode: "",
      makeModel: "",
      year: "",
      loaFt: "",
      fuelType: "",
      condition: "good",
      hours: "",
    },
  });

  // Auto-save form data to localStorage
  const { saveFormData, loadFormData, clearFormData } = useFormStorage("boat-valuation-form");
  
  useEffect(() => {
    const savedData = loadFormData();
    if (savedData) {
      Object.entries(savedData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          form.setValue(key as keyof FormData, value as string | boolean);
        }
      });
      toast({
        title: "Form Data Restored",
        description: "Your previously entered information has been restored.",
      });
    }
  }, []);

  // Save form data on every change
  useEffect(() => {
    const subscription = form.watch((data) => {
      saveFormData(data);
    });
    return () => subscription.unsubscribe();
  }, [form.watch, saveFormData]);

  // Initialize Turnstile when component mounts
  useEffect(() => {
    // Skip Turnstile if not configured (development mode)
    if (!isTurnstileConfigured) {
      setTurnstileToken("dev-bypass-token");
      return;
    }

    if (currentStep === 2 && typeof window !== "undefined" && (window as any).turnstile) {
      (window as any).turnstile.render("#turnstile-widget", {
        sitekey: import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY,
        callback: (token: string) => {
          setTurnstileToken(token);
        },
        "error-callback": () => {
          toast({
            title: "Security Verification Failed",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          });
        },
      });
    }
  }, [currentStep]);

  const onSubmit = async (data: FormData) => {
    if (currentStep === 1) {
      // Validate contact information
      // Debug logging removed for production
      
      const contactValid = data.email && data.phone && data.makeModel;
      if (!contactValid) {
        const missingFields = [];
        if (!data.email) missingFields.push("email");
        if (!data.phone) missingFields.push("phone");
        if (!data.makeModel) missingFields.push("boat make & model");
        
        toast({
          title: "Required Fields Missing",
          description: `Please provide: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      onStepChange(2);
      return;
    }

    if (currentStep === 2) {
      if (isTurnstileConfigured && !turnstileToken) {
        toast({
          title: "Security Verification Required",
          description: "Please complete the security verification.",
          variant: "destructive",
        });
        return;
      }

      try {
        onLoadingChange(true);

        // Prepare request data
        const trimmedMakeModel = data.makeModel.trim();
        const [primaryMake, ...modelParts] = trimmedMakeModel.split(/\s+/);
        const derivedMake = primaryMake || undefined;
        const derivedModel = modelParts.join(" ").trim();
        const normalizedModel = derivedModel.length > 0 ? derivedModel : undefined;
        const trimmedHours = data.hours.trim();
        const parsedHours = trimmedHours === "" ? undefined : Number(trimmedHours);
        const normalizedHours =
          parsedHours === undefined || Number.isNaN(parsedHours) ? undefined : parsedHours;

        const parsedYear = data.year ? Number.parseInt(data.year, 10) : undefined;
        const vesselYear = parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined;
        const parsedLength = data.loaFt ? Number.parseFloat(data.loaFt) : undefined;
        const vesselLength =
          typeof parsedLength === "number" && !Number.isNaN(parsedLength) ? parsedLength : undefined;
        const vesselFuelType = data.fuelType || undefined;
        const vesselCondition = data.condition;

        const requestData = {
          leadData: {
            name: data.name || undefined,
            email: data.email,
            phone: data.phone,
            smsConsent: data.smsConsent,
            city: data.city || undefined,
            zipCode: data.zipCode || undefined,
          },
          vesselData: {
            makeModel: data.makeModel,
            make: derivedMake,
            model: normalizedModel,
            year: vesselYear,
            loaFt: vesselLength,
            fuelType: vesselFuelType,
            condition: vesselCondition,
            hours: normalizedHours,
          },
          turnstileToken,
          utmParams,
        };

        const response = await apiRequest("POST", "/api/valuation", requestData);
        const result = await response.json();
        const normalizedResult = normalizeValuationResponse(result);

        if (!normalizedResult) {
          const message =
            typeof result?.error === "string" && result.error.trim().length > 0
              ? result.error
              : "Valuation request failed";
          throw new Error(message);
        }

        const estimate = {
          id: generateId(),
          low: normalizedResult.valuation_low,
          mostLikely: normalizedResult.valuation_mid,
          high: normalizedResult.valuation_high,
          wholesale: normalizedResult.wholesale,
          narrative: normalizedResult.narrative ?? "",
          ...(normalizedResult.assumptions
            ? { assumptions: normalizedResult.assumptions }
            : {}),
          comps: [],
          isPremiumLead: false,
        };

        const brandCandidate = derivedMake ?? trimmedMakeModel;
        const safeBrand = brandCandidate && brandCandidate.length > 0 ? brandCandidate : "Unknown";
        const lead = {
          id: generateId(),
          email: data.email,
          ...(data.name ? { name: data.name } : {}),
        };
        const vessel = {
          id: generateId(),
          brand: safeBrand,
          ...(normalizedModel ? { model: normalizedModel } : {}),
          ...(vesselYear !== undefined ? { year: vesselYear } : {}),
          ...(vesselLength !== undefined ? { loaFt: vesselLength } : {}),
          ...(vesselFuelType ? { engineType: vesselFuelType, fuelType: vesselFuelType } : {}),
          ...(normalizedHours !== undefined ? { hours: normalizedHours } : {}),
          condition: vesselCondition,
          gyro: false,
        };

        const valuationData = {
          lead,
          vessel,
          estimate,
        };

        clearFormData();
        onComplete(valuationData);
      } catch (error) {
        console.error("Submission error:", error);
        toast({
          title: "Submission Failed",
          description: error instanceof Error ? error.message : "Please try again later.",
          variant: "destructive",
        });
      } finally {
        onLoadingChange(false);
      }
    }
  };

  const handleBackStep = () => {
    if (currentStep > 1) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className="fade-in">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {currentStep === 1 && (
            <div className="hp-stack">
              <h2 style={{fontSize:20, fontWeight:700, color:"var(--ink)", marginBottom:8}}>Contact Information</h2>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Name (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          className="hp-input"
                          placeholder="Your full name" 
                          {...field} 
                          data-testid="input-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          className="hp-input"
                          type="email"
                          placeholder="your@email.com" 
                          {...field} 
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Phone Number *</FormLabel>
                      <FormControl>
                        <Input 
                          className="hp-input"
                          type="tel"
                          placeholder="(555) 123-4567" 
                          {...field} 
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="hp-grid-2">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="hp-label">City</FormLabel>
                        <FormControl>
                          <Input 
                            className="hp-input"
                            placeholder="Miami" 
                            {...field} 
                            data-testid="input-city"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="hp-label">Zip Code</FormLabel>
                        <FormControl>
                          <Input 
                            className="hp-input"
                            placeholder="33101" 
                            {...field} 
                            data-testid="input-zipcode"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="makeModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Boat Make & Model *</FormLabel>
                      <FormControl>
                        <Input 
                          className="hp-input"
                          placeholder="Sunseeker 68 Sport Boat, Azimut 55, Princess V65, etc." 
                          {...field} 
                          data-testid="input-make-model"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="smsConsent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-sms-consent"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I agree to receive texts/calls from HullPrice
                        </FormLabel>
                        <FormDescription>
                          Message & data rates may apply. You can opt out at any time.
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="hp-btn hp-btn-primary w-full"
                  data-testid="button-continue-step1"
                >
                  Continue to Vessel Details
                </Button>

                <p style={{textAlign:"center", fontSize:14, color:"#6B7C8F"}}>
                  Advanced Analytics • Instant Results • Trusted Valuations
                </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="hp-stack">
              <h2 style={{fontSize:20, fontWeight:700, color:"var(--ink)", marginBottom:8}}>Vessel Details</h2>
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Year</FormLabel>
                      <FormControl>
                        <Input 
                          className="hp-input"
                          type="number"
                          placeholder="2020" 
                          min="1950"
                          max={new Date().getFullYear() + 1}
                          {...field} 
                          data-testid="input-year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="hp-grid-2">
                  <FormField
                    control={form.control}
                    name="loaFt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="hp-label">Length Overall (ft)</FormLabel>
                        <FormControl>
                          <Input 
                            className="hp-input"
                            type="number"
                            placeholder="65" 
                            min="20"
                            max="500"
                            step="0.1"
                            {...field} 
                            data-testid="input-loa"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fuelType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="hp-label">Fuel Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="hp-select" data-testid="select-fuel-type">
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gas">Gas</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="electric">Electric</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Condition</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="hp-select" data-testid="select-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="project">Project</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="average">Average</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="excellent">Excellent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Engine Hours (total)</FormLabel>
                      <FormControl>
                        <Input
                          className="hp-input"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={20000}
                          step={10}
                          placeholder="850"
                          {...field}
                          data-testid="input-hours"
                        />
                      </FormControl>
                      <FormDescription>
                        If twin engines, enter the higher reading (we’ll normalize).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />


                {/* Cloudflare Turnstile */}
                {isTurnstileConfigured && (
                  <div className="space-y-2">
                    <Label>Security Verification</Label>
                    <div id="turnstile-widget" className="flex justify-center" />
                    <p className="text-sm text-muted-foreground text-center">
                      Please complete the security verification to continue
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleBackStep}
                    className="flex-1"
                    data-testid="button-back-step2"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={isLoading || (isTurnstileConfigured && !turnstileToken)}
                    data-testid="button-submit-valuation"
                  >
                    {isLoading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2" />
                        Generating Valuation...
                      </>
                    ) : (
                      "Get My Valuation"
                    )}
                  </Button>
                </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
