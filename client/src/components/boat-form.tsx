import { useState, useEffect, FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useFormStorage } from "@/hooks/use-form-storage";
import { leadVesselValidationSchema } from "@/lib/validation";
import { apiRequest } from "@/lib/queryClient";
import { normalizeValuationResponse } from "@/lib/valuation-result";

const generateId = () => {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createDefaultCondition = (): HullConditionForm => ({
  exteriorScore: undefined,
  interiorScore: null,
});

const createDefaultFeatures = (): FormFeatures => ({
  hardtop: false,
  biminiTop: false,
  passerelle: false,
  aftDockingStation: false,
  joystick: false,
  bowThruster: false,
  sternThruster: false,
  hydraulicSwimPlatform: false,
  teakDecking: false,
  underwaterLights: false,
  serviceRecordsUpToDate: false,
});

const SCORE_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);

const FEATURE_OPTIONS: Array<{ key: FeatureKey; label: string; testId: string }> = [
  { key: "hardtop", label: "Hardtop", testId: "toggle-hardtop" },
  { key: "biminiTop", label: "Bimini Top", testId: "toggle-bimini" },
  { key: "passerelle", label: "Passerelle", testId: "toggle-passerelle" },
  { key: "aftDockingStation", label: "Aft Docking Station", testId: "toggle-aft-docking" },
  { key: "joystick", label: "Joystick", testId: "toggle-joystick" },
  { key: "bowThruster", label: "Bow Thruster", testId: "toggle-bow-thruster" },
  { key: "sternThruster", label: "Stern Thruster", testId: "toggle-stern-thruster" },
  { key: "hydraulicSwimPlatform", label: "Hydraulic Swim Platform", testId: "toggle-hydraulic-platform" },
  { key: "teakDecking", label: "Teak Decking", testId: "toggle-teak" },
  { key: "underwaterLights", label: "Underwater Lights", testId: "toggle-underwater-lights" },
  { key: "serviceRecordsUpToDate", label: "Service Records Up To Date", testId: "toggle-service-records" },
];

interface VesselState {
  make: string;
  makeModel: string;
  model: string;
}

interface HullConditionForm {
  exteriorScore: number | undefined;
  interiorScore: number | null;
}

type FeatureKey =
  | "hardtop"
  | "biminiTop"
  | "passerelle"
  | "aftDockingStation"
  | "joystick"
  | "bowThruster"
  | "sternThruster"
  | "hydraulicSwimPlatform"
  | "teakDecking"
  | "underwaterLights"
  | "serviceRecordsUpToDate";

type FormFeatures = Record<FeatureKey, boolean>;

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
  vesselCondition: string;
  hours: string;
  condition: HullConditionForm;
  features: FormFeatures;
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
        model: "",
      },
      year: "",
      loaFt: "",
      fuelType: "",
      vesselCondition: "good",
      hours: "",
      condition: createDefaultCondition(),
      features: createDefaultFeatures(),
    },
  });

  // Auto-save form data to localStorage
  const { saveFormData, loadFormData, clearFormData } = useFormStorage("boat-valuation-form");
  
  useEffect(() => {
    const savedData = loadFormData();
    if (savedData) {
      const defaults = form.getValues();
      const normalizedData: FormData = {
        ...defaults,
        vessel: {
          make:
            (savedData as any)?.vessel?.make ??
            (typeof (savedData as any)?.make === "string" ? (savedData as any).make : undefined) ??
            (typeof (savedData as any)?.makeModel === "string" ? (savedData as any).makeModel : ""),
          makeModel:
            (savedData as any)?.vessel?.makeModel ??
            (typeof (savedData as any)?.makeModel === "string" ? (savedData as any).makeModel : undefined) ??
            ((savedData as any)?.vessel?.make ?? ""),
          model:
            (savedData as any)?.vessel?.model ??
            (typeof (savedData as any)?.model === "string" ? (savedData as any).model : undefined) ??
            "",
        },
        name: typeof (savedData as any)?.name === "string" ? (savedData as any).name : defaults.name,
        email: typeof (savedData as any)?.email === "string" ? (savedData as any).email : defaults.email,
        phone: typeof (savedData as any)?.phone === "string" ? (savedData as any).phone : defaults.phone,
        city: typeof (savedData as any)?.city === "string" ? (savedData as any).city : defaults.city,
        zipCode: typeof (savedData as any)?.zipCode === "string" ? (savedData as any).zipCode : defaults.zipCode,
        year: typeof (savedData as any)?.year === "string" ? (savedData as any).year : defaults.year,
        loaFt: typeof (savedData as any)?.loaFt === "string" ? (savedData as any).loaFt : defaults.loaFt,
        fuelType: typeof (savedData as any)?.fuelType === "string" ? (savedData as any).fuelType : defaults.fuelType,
        hours: typeof (savedData as any)?.hours === "string" ? (savedData as any).hours : defaults.hours,
        smsConsent:
          typeof (savedData as any)?.smsConsent === "boolean"
            ? (savedData as any).smsConsent
            : defaults.smsConsent,
      };

      const trimmedMake = normalizedData.vessel.make?.trim?.() ?? "";
      const trimmedMakeModel = normalizedData.vessel.makeModel?.trim?.() ?? trimmedMake;
      const trimmedModel = normalizedData.vessel.model?.trim?.() ?? "";

      const combined =
        trimmedMake.length > 0 && trimmedModel.length > 0
          ? `${trimmedMake} ${trimmedModel}`.trim()
          : trimmedMakeModel;
      const derivedModelFromCombined =
        trimmedModel.length > 0
          ? trimmedModel
          : trimmedMake.length > 0 && combined.startsWith(trimmedMake)
            ? combined.slice(trimmedMake.length).trim()
            : combined === trimmedMake
              ? ""
              : combined;

      normalizedData.vessel = {
        make: trimmedMake,
        makeModel: combined,
        model: derivedModelFromCombined,
      };

      const savedConditionScores = (savedData as any)?.condition;
      const normalizedCondition = createDefaultCondition();
      const parseScore = (value: unknown): number | undefined => {
        if (value === null || value === undefined) return undefined;
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string" && value.trim().length > 0) {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
        return undefined;
      };

      if (savedConditionScores && typeof savedConditionScores === "object") {
        const exteriorCandidate = parseScore((savedConditionScores as any).exteriorScore);
        if (typeof exteriorCandidate === "number" && exteriorCandidate >= 1 && exteriorCandidate <= 10) {
          normalizedCondition.exteriorScore = exteriorCandidate;
        }

        const interiorValue = (savedConditionScores as any).interiorScore;
        if (interiorValue === null) {
          normalizedCondition.interiorScore = null;
        } else {
          const interiorCandidate = parseScore(interiorValue);
          if (typeof interiorCandidate === "number" && interiorCandidate >= 1 && interiorCandidate <= 10) {
            normalizedCondition.interiorScore = interiorCandidate;
          }
        }
      }

      normalizedData.condition = normalizedCondition;

      const normalizedFeatures = createDefaultFeatures();
      const savedFeatures = (savedData as any)?.features;
      if (savedFeatures && typeof savedFeatures === "object") {
        (Object.keys(normalizedFeatures) as FeatureKey[]).forEach((key) => {
          const rawValue = (savedFeatures as Record<string, unknown>)[key];
          normalizedFeatures[key] = rawValue === true || rawValue === "true";
        });
      }
      normalizedData.features = normalizedFeatures;

      const savedVesselCondition =
        typeof (savedData as any)?.vesselCondition === "string"
          ? (savedData as any).vesselCondition
          : undefined;
      const legacyConditionString =
        typeof (savedData as any)?.condition === "string"
          ? (savedData as any).condition
          : undefined;

      normalizedData.vesselCondition =
        savedVesselCondition ?? legacyConditionString ?? normalizedData.vesselCondition ?? "good";

      form.reset(normalizedData);
      toast({
        title: "Form Data Restored",
        description: "Your previously entered information has been restored.",
      });
    }
  }, []);

  // Save form data on every change
  useEffect(() => {
    const subscription = form.watch((_, { name }) => {
      const currentValues = form.getValues();

      if (name === "vessel.make" || name === "vessel.model") {
        const vesselState = currentValues.vessel ?? { make: "", makeModel: "", model: "" };
        const trimmedMake = vesselState.make?.trim?.() ?? "";
        const trimmedModel = vesselState.model?.trim?.() ?? "";
        const combined =
          trimmedMake.length > 0 && trimmedModel.length > 0
            ? `${trimmedMake} ${trimmedModel}`.trim()
            : trimmedMake;
        const currentCombined = vesselState.makeModel ?? "";
        if (combined !== currentCombined) {
          form.setValue("vessel.makeModel", combined, {
            shouldDirty: false,
            shouldTouch: false,
            shouldValidate: false,
          });
          currentValues.vessel = {
            ...vesselState,
            makeModel: combined,
          };
        }
      }

      saveFormData(currentValues);
    });
    return () => subscription.unsubscribe();
  }, [form, form.watch, saveFormData]);

  // Initialize Turnstile when component mounts
  useEffect(() => {
    // Skip Turnstile if not configured (development mode)
    if (!isTurnstileConfigured) {
      setTurnstileToken("dev-bypass-token");
      return;
    }

    if (currentStep === 3 && typeof window !== "undefined" && (window as any).turnstile) {
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
  }, [currentStep, isTurnstileConfigured, toast]);

  const handleContactNext = async () => {
    const stepOneFields = [
      "email",
      "phone",
      "city",
      "zipCode",
      "vessel.make",
    ] as const;

    const isStepOneValid = await form.trigger(stepOneFields, { shouldFocus: true });
    if (!isStepOneValid) {
      return;
    }

    const state = form.getValues();
    const trimmedMake = state.vessel?.make?.trim?.() ?? "";
    const existingModel = state.vessel?.model?.trim?.() ?? "";

    if (trimmedMake !== state.vessel.make) {
      form.setValue("vessel.make", trimmedMake, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }

    state.vessel.make = trimmedMake;
    state.vessel.model = existingModel;
    state.vessel.makeModel = trimmedMake.length > 0 ? trimmedMake : "";

    form.setValue("vessel.makeModel", state.vessel.makeModel, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    });

    form.reset(state);
    saveFormData(state);
    onStepChange(2);
  };

  const handleVesselNext = async () => {
    const stepTwoFields = [
      "vessel.model",
      "year",
      "loaFt",
      "fuelType",
      "vesselCondition",
      "hours",
    ] as const;

    const rawModelValue = form.getValues("vessel.model") ?? "";
    const isStepTwoValid = await form.trigger(stepTwoFields, { shouldFocus: true });
    const trimmedModelValue = rawModelValue.trim();

    if (!isStepTwoValid || trimmedModelValue.length === 0) {
      if (trimmedModelValue.length === 0) {
        form.setError("vessel.model", {
          type: "manual",
          message: "Model must be provided",
        });
      }
      return;
    }

    form.clearErrors("vessel.model");

    if (trimmedModelValue !== rawModelValue) {
      form.setValue("vessel.model", trimmedModelValue, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }

    onStepChange(3);
  };

  const onSubmit = async (data: FormData) => {
    if (currentStep !== 3) {
      return;
    }

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

      const vesselState = data.vessel ?? { make: "", makeModel: "", model: "" };
      const trimmedMake = vesselState.make?.trim?.() ?? "";
      const trimmedModel = vesselState.model?.trim?.() ?? "";
      const fallbackCombined = vesselState.makeModel?.trim?.() ?? "";
      const preliminaryCombined =
        trimmedMake.length > 0 && trimmedModel.length > 0
          ? `${trimmedMake} ${trimmedModel}`.trim()
          : fallbackCombined.length > 0
            ? fallbackCombined
            : trimmedMake;
      const [primaryMake, ...modelParts] = preliminaryCombined.split(/\s+/);
      const derivedMake = trimmedMake.length > 0 ? trimmedMake : primaryMake || undefined;
      const derivedModelCandidate =
        trimmedModel.length > 0 ? trimmedModel : modelParts.join(" ").trim();
      const normalizedModel = derivedModelCandidate.length > 0 ? derivedModelCandidate : undefined;
      const combined =
        derivedMake !== undefined
          ? `${derivedMake}${normalizedModel ? ` ${normalizedModel}` : ""}`.trim()
          : preliminaryCombined;
      const trimmedHours = data.hours?.trim?.() ?? "";
      const parsedHours = trimmedHours === "" ? undefined : Number(trimmedHours);
      const normalizedHours =
        parsedHours === undefined || Number.isNaN(parsedHours) ? undefined : parsedHours;

      const parsedYear = data.year ? Number.parseInt(data.year, 10) : undefined;
      const vesselYear = parsedYear && !Number.isNaN(parsedYear) ? parsedYear : undefined;
      const parsedLength = data.loaFt ? Number.parseFloat(data.loaFt) : undefined;
      const vesselLength =
        typeof parsedLength === "number" && !Number.isNaN(parsedLength) ? parsedLength : undefined;
      const vesselFuelType = data.fuelType || undefined;
      const vesselCondition = data.vesselCondition;

      const conditionPayload = {
        exteriorScore: data.condition.exteriorScore,
        interiorScore:
          typeof data.condition.interiorScore === "number"
            ? data.condition.interiorScore
            : null,
      };

      const featuresPayload = data.features ?? createDefaultFeatures();

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
        condition: conditionPayload,
        features: featuresPayload,
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
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (currentStep === 3) {
      form.handleSubmit(onSubmit)(event);
      return;
    }

    event.preventDefault();
  };

  const handleBackStep = () => {
    if (currentStep > 1) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className="fade-in">
      <Form {...form}>
        <form onSubmit={handleFormSubmit}>
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
                  type="button"
                  className="hp-btn hp-btn-primary w-full"
                  data-testid="button-continue-step1"
                  onClick={handleContactNext}
                  disabled={isLoading}
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
                  name="vessel.model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="hp-label">Model *</FormLabel>
                      <FormControl>
                        <Input
                          className="hp-input"
                          id="vessel.model"
                          placeholder="Sundancer 340, Outrage 280, etc."
                          required
                          minLength={1}
                          {...field}
                          data-testid="input-model"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="vesselCondition"
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
                    type="button"
                    className="flex-1"
                    disabled={isLoading}
                    data-testid="button-continue-step2"
                    onClick={handleVesselNext}
                  >
                    Continue to Features
                  </Button>
                </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="hp-stack">
              <h2 style={{fontSize:20, fontWeight:700, color:"var(--ink)", marginBottom:8}}>Features & Condition</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="condition.exteriorScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="hp-label">Overall Exterior Condition (1–10)</FormLabel>
                          <FormControl>
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                <span>Poor</span>
                                <span>Excellent</span>
                              </div>
                              <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                className="grid grid-cols-5 sm:grid-cols-10 gap-2"
                                value={typeof field.value === "number" ? String(field.value) : undefined}
                                onValueChange={(value) => {
                                  if (!value) {
                                    return;
                                  }
                                  field.onChange(Number(value));
                                }}
                                aria-label="Exterior condition score"
                                data-testid="score-exterior"
                              >
                                {SCORE_VALUES.map((score) => (
                                  <ToggleGroupItem
                                    key={score}
                                    value={String(score)}
                                    aria-label={`Exterior score ${score}`}
                                    className="w-full justify-center"
                                  >
                                    {score}
                                  </ToggleGroupItem>
                                ))}
                              </ToggleGroup>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <FormField
                      control={form.control}
                      name="condition.interiorScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="hp-label">Overall Interior Condition (1–10)</FormLabel>
                          <FormDescription>Optional</FormDescription>
                          <FormControl>
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                <span>Poor</span>
                                <span>Excellent</span>
                              </div>
                              <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                className="grid grid-cols-5 sm:grid-cols-10 gap-2"
                                value={typeof field.value === "number" ? String(field.value) : undefined}
                                onValueChange={(value) => {
                                  if (!value) {
                                    field.onChange(null);
                                    return;
                                  }
                                  field.onChange(Number(value));
                                }}
                                aria-label="Interior condition score"
                                data-testid="score-interior"
                              >
                                {SCORE_VALUES.map((score) => (
                                  <ToggleGroupItem
                                    key={score}
                                    value={String(score)}
                                    aria-label={`Interior score ${score}`}
                                    className="w-full justify-center"
                                  >
                                    {score}
                                  </ToggleGroupItem>
                                ))}
                              </ToggleGroup>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 style={{fontSize:16, fontWeight:600, color:"var(--ink)", marginBottom:8}}>Features</h3>
                  <p className="text-sm text-muted-foreground">
                    Select the onboard upgrades that apply to your vessel.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {FEATURE_OPTIONS.map((feature) => (
                    <FormField
                      key={feature.key}
                      control={form.control}
                      name={`features.${feature.key}` as const}
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-3 rounded-md border border-border p-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => field.onChange(checked === true)}
                              data-testid={feature.testId}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer text-sm font-medium text-foreground">
                            {feature.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

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
                  data-testid="button-back-step3"
                  disabled={isLoading}
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
