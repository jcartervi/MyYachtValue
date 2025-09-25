import { z } from "zod";

const vesselSchema = z.object({
  make: z
    .string()
    .trim()
    .min(2, "Boat make must be at least 2 characters"),
  makeModel: z.string().optional(),
  model: z
    .string()
    .trim()
    .min(1, "Model must be provided"),
});

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
  vessel: vesselSchema,
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
  fuelType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["gas", "diesel", "electric", "other"]).optional()),
  condition: z.enum(["project", "fair", "average", "good", "excellent"]).default("good"),
  hours: z
    .string()
    .optional()
    .refine((val) => {
      if (val === undefined) return true;
      const trimmed = val.trim();
      if (trimmed === "") return true;
      const num = Number(trimmed);
      if (Number.isNaN(num)) return false;
      return num >= 0 && num <= 20000;
    }, "Engine hours must be between 0 and 20,000"),
});

export type LeadVesselFormData = z.infer<typeof leadVesselValidationSchema>;
