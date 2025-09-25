import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  smsConsent: boolean("sms_consent").default(false),
  city: text("city"),
  zipCode: text("zip_code"),
  ipAddress: text("ip_address"),
  tcpaTimestamp: timestamp("tcpa_timestamp").defaultNow(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vessels = pgTable("vessels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  makeModel: text("make_model").notNull(),
  year: integer("year"),
  loaFt: real("loa_ft"),
  fuelType: text("fuel_type"), // gas | diesel | electric | other
  condition: text("condition").default("good"), // project | fair | average | good | excellent
  hours: integer("hours"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
  low: integer("low").notNull(),
  mostLikely: integer("most_likely").notNull(),
  high: integer("high").notNull(),
  wholesale: integer("wholesale").notNull(),
  confidence: text("confidence").notNull(),
  narrative: text("narrative"),
  comps: jsonb("comps"),
  isPremiumLead: boolean("is_premium_lead").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  activityType: text("activity_type").notNull(), // form_submit | sms_sent | email_sent | pipedrive_created
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
});


// Zod schemas for validation
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  tcpaTimestamp: true,
}).extend({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number"),
  name: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  smsConsent: z.boolean().default(false),
});

export const insertVesselSchema = createInsertSchema(vessels).omit({
  id: true,
  leadId: true,
  createdAt: true,
}).extend({
  makeModel: z.string().min(1, "Make & Model is required"),
  year: z.number().min(1950, "Year must be after 1950").max(new Date().getFullYear() + 1, "Year cannot be in the future").optional(),
  loaFt: z.number().min(20, "Length must be at least 20 feet").max(500, "Length cannot exceed 500 feet").optional(),
  fuelType: z.enum(["gas", "diesel", "electric", "other"]).optional(),
  condition: z.enum(["project", "fair", "average", "good", "excellent"]).default("good"),
  hours: z
    .number({ invalid_type_error: "Engine hours must be a number" })
    .int("Engine hours must be a whole number")
    .min(0, "Engine hours must be at least 0")
    .max(20000, "Engine hours cannot exceed 20,000")
    .optional(),
});

const vesselRequestSchema = insertVesselSchema.extend({
  make: z.string().optional(),
  model: z.string().optional(),
});

export const createEstimateRequestSchema = z.object({
  leadData: insertLeadSchema,
  vesselData: vesselRequestSchema,
  turnstileToken: z.string().min(1, "Please complete the security verification"),
  utmParams: z.object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
  }).optional(),
});

// TypeScript types
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type Estimate = typeof estimates.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type CreateEstimateRequest = z.infer<typeof createEstimateRequestSchema>;

export type HullCondition = {
  interiorScore?: number | null;
  exteriorScore: number;
};

export type HullFeatures = {
  hardtop: boolean;
  biminiTop: boolean;
  passerelle: boolean;
  aftDockingStation: boolean;
  joystick: boolean;
  bowThruster: boolean;
  sternThruster: boolean;
  hydraulicSwimPlatform: boolean;
  teakDecking: boolean;
  underwaterLights: boolean;
  serviceRecordsUpToDate: boolean;
};

