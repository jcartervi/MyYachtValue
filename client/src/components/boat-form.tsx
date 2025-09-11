import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface FormData {
  // Lead data
  name: string;
  email: string;
  phone: string;
  smsConsent: boolean;
  city: string;
  zipCode: string;
  // Vessel data
  brand: string;
  model: string;
  year: string;
  loaFt: string;
  engineType: string;
  horsepower: string;
  hours: string;
  gyro: boolean;
  refitYear: string;
  region: string;
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
      brand: "",
      model: "",
      year: "",
      loaFt: "",
      engineType: "",
      horsepower: "",
      hours: "",
      gyro: false,
      refitYear: "",
      region: "SE_US",
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
    if (currentStep === 2 && typeof window !== "undefined" && (window as any).turnstile) {
      (window as any).turnstile.render("#turnstile-widget", {
        sitekey: import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || "0x4AAAAAAAdeWP1SZJhwHKOO",
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
      const contactValid = data.email && data.phone && data.brand;
      if (!contactValid) {
        toast({
          title: "Required Fields Missing",
          description: "Please provide your email, phone, and boat brand.",
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
            brand: data.brand,
            model: data.model || undefined,
            year: data.year ? parseInt(data.year) : undefined,
            loaFt: data.loaFt ? parseFloat(data.loaFt) : undefined,
            engineType: data.engineType || undefined,
            horsepower: data.horsepower ? parseInt(data.horsepower) : undefined,
            hours: data.hours ? parseInt(data.hours) : undefined,
            gyro: data.gyro,
            refitYear: data.refitYear ? parseInt(data.refitYear) : undefined,
            region: data.region,
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
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Optional)</FormLabel>
                      <FormControl>
                        <Input 
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
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input 
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
                      <FormLabel>Phone Number *</FormLabel>
                      <FormControl>
                        <Input 
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
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
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input 
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
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Boat Brand *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Sunseeker, Azimut, Princess, etc." 
                          {...field} 
                          data-testid="input-brand"
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
                          I agree to receive texts/calls from Wave Marine Group
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
                  className="w-full"
                  data-testid="button-continue-step1"
                >
                  Continue to Vessel Details
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Licensed Broker • South Florida • #jamescarteryachting
                </p>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Vessel Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="68 Sport Boat" 
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
                        <FormLabel>Year</FormLabel>
                        <FormControl>
                          <Input 
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="loaFt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Length Overall (ft)</FormLabel>
                        <FormControl>
                          <Input 
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
                    name="engineType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine Type</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-engine-type">
                              <SelectValue placeholder="Select engine type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="shaft">Shaft Drive</SelectItem>
                            <SelectItem value="ips">IPS</SelectItem>
                            <SelectItem value="outboard">Outboard</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="horsepower"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Horsepower</FormLabel>
                        <FormControl>
                          <Input 
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
                        <FormLabel>Engine Hours</FormLabel>
                        <FormControl>
                          <Input 
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
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-region">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="SE_US">Southeast US</SelectItem>
                            <SelectItem value="NE_US">Northeast US</SelectItem>
                            <SelectItem value="MED">Mediterranean</SelectItem>
                            <SelectItem value="CARIB">Caribbean</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="gyro"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-gyro"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Seakeeper/Gyro Stabilization
                        </FormLabel>
                        <FormDescription>
                          Does your boat have gyroscopic stabilization?
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Cloudflare Turnstile */}
                <div className="space-y-2">
                  <Label>Security Verification</Label>
                  <div id="turnstile-widget" className="flex justify-center" />
                  <p className="text-sm text-muted-foreground text-center">
                    Please complete the security verification to continue
                  </p>
                </div>

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
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}
