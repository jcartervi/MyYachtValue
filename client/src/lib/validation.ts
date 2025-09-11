import { z } from "zod";

export const leadVesselValidationSchema = z.object({
  // Lead validation
  name: z.string().optional(),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number"),
  smsConsent: z.boolean().default(true),
  city: z.string().optional(),
  zipCode: z.string().optional(),

  // Vessel validation
  brand: z.string().min(1, "Brand is required"),
  model: z.string().optional(),
  year: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return num >= 1950 && num <= new Date().getFullYear() + 1;
  }, "Year must be between 1950 and next year"),
  loaFt: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return num >= 20 && num <= 500;
  }, "Length must be between 20 and 500 feet"),
  fuelType: z.string().optional(),
  horsepower: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return num >= 1 && num <= 50000;
  }, "Horsepower must be between 1 and 50,000"),
  hours: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return num >= 0 && num <= 50000;
  }, "Hours must be between 0 and 50,000"),
  refitYear: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseInt(val);
    return num >= 1950 && num <= new Date().getFullYear();
  }, "Refit year must be between 1950 and current year"),
  condition: z.string().default("good"),
});

export type LeadVesselFormData = z.infer<typeof leadVesselValidationSchema>;
