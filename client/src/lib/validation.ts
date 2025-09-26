import { z } from "zod";

const vesselSchema = z.object({
  make: z
    .string()
    .trim()
    .min(2, "Boat make must be at least 2 characters"),
  makeModel: z.string().optional(),
  model: z
    .string()
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : value)),
});

const hullConditionSchema = z.object({
  exteriorScore: z.coerce.number().int().min(1, "Score must be 1–10").max(10, "Score must be 1–10"),
  interiorScore: z.union([
    z.coerce.number().int().min(1).max(10),
    z.null(),
    z.undefined(),
  ]),
});

const hullFeaturesSchema = z.object({
  hardtop: z.boolean().default(false),
  biminiTop: z.boolean().default(false),
  passerelle: z.boolean().default(false),
  aftDockingStation: z.boolean().default(false),
  joystick: z.boolean().default(false),
  bowThruster: z.boolean().default(false),
  sternThruster: z.boolean().default(false),
  stabilization: z.boolean().default(false),
  hydraulicSwimPlatform: z.boolean().default(false),
  teakDecking: z.boolean().default(false),
  underwaterLights: z.boolean().default(false),
  serviceRecordsUpToDate: z.boolean().default(false),
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
  vesselCondition: z.enum(["project", "fair", "average", "good", "excellent"]).default("good"),
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
  condition: hullConditionSchema,
  features: hullFeaturesSchema,
});

export type LeadVesselFormData = z.infer<typeof leadVesselValidationSchema>;
