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

interface VesselState {
  make: string;
  makeModel: string;
}

interface FormData {
  // Lead data
  name: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  city: string;
  zipCode: string;
  // Vessel data
  vessel: VesselState;
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
      vessel: {
        make: "",
        makeModel: "",
      },
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
      const normalizedData: FormData = {
        ...form.getValues(),
        ...(savedData as Partial<FormData>),
        vessel: {
          make:
            (savedData as any)?.vessel?.make ??
            (typeof (savedData as any)?.make === "string" ? (savedData as any).make : undefined) ??
            (typeof (savedData as any)?.makeModel === "string" ? (savedData as any).makeModel : ""),
          makeModel:
            (savedData as any)?.vessel?.makeModel ??
            (typeof (savedData as any)?.makeModel === "string" ? (savedData as any).makeModel : undefined) ??
            ((savedData as any)?.vessel?.make ?? ""),
        },
      };

      const trimmedMake = normalizedData.vessel.make?.trim?.() ?? "";
      const trimmedMakeModel = normalizedData.vessel.makeModel?.trim?.() ?? trimmedMake;

      normalizedData.vessel = {
        make: trimmedMake,
        makeModel: trimmedMakeModel,
      };

      form.reset(normalizedData);
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
      
      const trimmedMake = data.vessel?.make?.trim?.() ?? "";
      const contactValid = Boolean(data.email && data.phone && trimmedMake.length >= 2);
      if (!contactValid) {
        const missingFields = [];
        if (!data.email) missingFields.push("email");
        if (!data.phone) missingFields.push("phone");
        if (trimmedMake.length < 2) missingFields.push("boat make");

        if (trimmedMake !== data.vessel.make) {
          form.setValue("vessel.make", trimmedMake);
        }

        toast({
          title: "Required Fields Missing",
          description: `Please provide: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        return;
      }

      const state = form.getValues();
      state.vessel.make = trimmedMake;
      state.vessel.makeModel = trimmedMake;
      form.reset(state);
      saveFormData(state);
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
        const vesselState = data.vessel ?? { make: "", makeModel: "" };
        const trimmedMake = vesselState.make?.trim?.() ?? "";
        const fallbackCombined = vesselState.makeModel?.trim?.() ?? "";
        const combined = fallbackCombined.length > 0 ? fallbackCombined : trimmedMake;
        const [primaryMake, ...modelParts] = combined.split(/\s+/);
        const derivedMake = trimmedMake.length > 0 ? trimmedMake : primaryMake || undefined;
        const derivedModelCandidate = modelParts.join(" ").trim();
        const normalizedModel =
          combined !== trimmedMake && derivedModelCandidate.length > 0 ? derivedModelCandidate : undefined;
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
            makeModel: combined,
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

        const floor10k = (value: number | null) =>
          typeof value === "number" && Number.isFinite(value)
            ? Math.floor(value / 10000) * 10000
            : null;

        const midFallbackValue =
          normalizedResult.valuation_low !== null && normalizedResult.valuation_high !== null
            ? Math.round((normalizedResult.valuation_low + normalizedResult.valuation_high) / 2)
            : null;

        const midBaseCandidate = normalizedResult.valuation_mid ?? midFallbackValue;
        const mostLikelyValue =
          midBaseCandidate ??
          normalizedResult.valuation_high ??
          normalizedResult.valuation_low ??
          0;
        const midBaseValue = midBaseCandidate ?? mostLikelyValue;
        const lowValue = normalizedResult.valuation_low ?? mostLikelyValue;
        const highValue = normalizedResult.valuation_high ?? mostLikelyValue;

        const derivedWholesale =
          normalizedResult.wholesale ?? floor10k(midBaseValue * 0.60);

        const wholesaleValue = derivedWholesale ?? floor10k(mostLikelyValue * 0.60) ?? 0;
        const estimate = {
          id: generateId(),
          low: lowValue,
          mostLikely: mostLikelyValue,
          high: highValue,
          wholesale: wholesaleValue,
          confidence: "Medium",
          narrative: normalizedResult.narrative ?? "",
          comps: [],
          isPremiumLead: false,
        };

        const brandCandidate = derivedMake ?? combined;
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
                  name="vessel.make"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Boat Make *</FormLabel>
                      <FormControl>
                        <Input
                          className="hp-input"
                          id="vessel.make"
                          placeholder="Sea Ray, Boston Whaler, Azimut…"
                          required
                          minLength={2}
                          {...field}
                          data-testid="input-make"
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
