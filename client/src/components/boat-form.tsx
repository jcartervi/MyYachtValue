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
import { Loader } from "@/components/Loader";

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
  horsepower: string;
  hours: string;
  refitYear: string;
  condition: string;
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
      horsepower: "",
      hours: "",
      refitYear: "",
      condition: "good",
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
    if (!import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY) {
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
      if (!turnstileToken) {
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
            year: data.year ? parseInt(data.year) : undefined,
            loaFt: data.loaFt ? parseFloat(data.loaFt) : undefined,
            fuelType: data.fuelType || undefined,
            horsepower: data.horsepower ? parseInt(data.horsepower) : undefined,
            hours: data.hours ? parseInt(data.hours) : undefined,
            refitYear: data.refitYear ? parseInt(data.refitYear) : undefined,
            condition: data.condition,
          },
          turnstileToken,
          utmParams,
        };

        const response = await apiRequest("POST", "/api/valuation", requestData);
        const result = await response.json();

        if (result.success) {
          clearFormData();
          onComplete(result);
        } else {
          throw new Error(result.error || "Valuation request failed");
        }
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
            <div className="dw-stack">
              <h2 style={{fontSize:20, fontWeight:700, color:"var(--ink)", marginBottom:8}}>Contact Information</h2>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dw-label">Name (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          className="dw-input"
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
                      <FormLabel className="dw-label">Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          className="dw-input"
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
                      <FormLabel className="dw-label">Phone Number *</FormLabel>
                      <FormControl>
                        <Input 
                          className="dw-input"
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

                <div className="dw-grid-2">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dw-label">City</FormLabel>
                        <FormControl>
                          <Input 
                            className="dw-input"
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
                        <FormLabel className="dw-label">Zip Code</FormLabel>
                        <FormControl>
                          <Input 
                            className="dw-input"
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
                      <FormLabel className="dw-label">Boat Make & Model *</FormLabel>
                      <FormControl>
                        <Input 
                          className="dw-input"
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
                          I agree to receive texts/calls from AI Boat Valuation
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
                  className="dw-btn dw-btn-primary w-full"
                  data-testid="button-continue-step1"
                >
                  Continue to Vessel Details
                </Button>

                <p style={{textAlign:"center", fontSize:14, color:"#6B7C8F"}}>
                  AI Powered Tool • Advanced Analytics • Instant Results
                </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="dw-stack">
              <h2 style={{fontSize:20, fontWeight:700, color:"var(--ink)", marginBottom:8}}>Vessel Details</h2>
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dw-label">Year</FormLabel>
                      <FormControl>
                        <Input 
                          className="dw-input"
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

                <div className="dw-grid-2">
                  <FormField
                    control={form.control}
                    name="loaFt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dw-label">Length Overall (ft)</FormLabel>
                        <FormControl>
                          <Input 
                            className="dw-input"
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
                        <FormLabel className="dw-label">Fuel Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="dw-select" data-testid="select-fuel-type">
                              <SelectValue placeholder="Select fuel type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gas">Gas</SelectItem>
                            <SelectItem value="diesel">Diesel</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="dw-grid-2">
                  <FormField
                    control={form.control}
                    name="horsepower"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dw-label">Total Horsepower</FormLabel>
                        <FormControl>
                          <Input 
                            className="dw-input"
                            type="number"
                            placeholder="1200" 
                            min="1"
                            max="50000"
                            {...field} 
                            data-testid="input-horsepower"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dw-label">Engine Hours</FormLabel>
                        <FormControl>
                          <Input 
                            className="dw-input"
                            type="number"
                            placeholder="420" 
                            min="0"
                            max="50000"
                            {...field} 
                            data-testid="input-hours"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="refitYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refit Year (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            placeholder="2022" 
                            min="1950"
                            max={new Date().getFullYear()}
                            {...field} 
                            data-testid="input-refit-year"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-condition">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="very_good">Very Good</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>


                {/* Cloudflare Turnstile */}
                {import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY ? (
                  <div className="space-y-2">
                    <Label>Security Verification</Label>
                    <div id="turnstile-widget" className="flex justify-center" />
                    <p className="text-sm text-muted-foreground text-center">
                      Please complete the security verification to continue
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Security Verification</Label>
                    <div className="flex justify-center p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center text-green-700">
                        <i className="fas fa-check-circle mr-2" />
                        Security verification bypassed (development mode)
                      </div>
                    </div>
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
                    disabled={isLoading || !turnstileToken}
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
