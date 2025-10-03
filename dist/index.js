var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/services/iyba-api.ts
var iyba_api_exports = {};
__export(iyba_api_exports, {
  IYBAService: () => IYBAService,
  iybaService: () => iybaService
});
var IYBACache, IYBAService, iybaService;
var init_iyba_api = __esm({
  "server/services/iyba-api.ts"() {
    "use strict";
    IYBACache = class {
      cache = /* @__PURE__ */ new Map();
      TTL = 18e4;
      // 3 minutes in milliseconds
      get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > this.TTL) {
          this.cache.delete(key);
          return null;
        }
        return entry.data;
      }
      set(key, data) {
        this.cache.set(key, {
          timestamp: Date.now(),
          data
        });
      }
    };
    IYBAService = class {
      baseUrl = "https://api.yachtbroker.org";
      brokerId = process.env.IYBA_BROKER_ID;
      apiKey = process.env.IYBA_KEY;
      cache = new IYBACache();
      constructor() {
        if (!this.brokerId || !this.apiKey) {
          console.warn("IYBA credentials not found. Real market data will be unavailable.");
        }
      }
      buildQueryParams(params) {
        const baseParams = {
          key: this.apiKey,
          id: this.brokerId,
          // Only request essential data for performance
          gallery: "false",
          engines: "true",
          generators: "false",
          textblocks: "false",
          media: "false",
          status: "On,Under Contract"
        };
        const filteredParams = {};
        Object.entries({ ...baseParams, ...params }).forEach(([key, value]) => {
          if (value !== null && value !== void 0) {
            filteredParams[key] = String(value);
          }
        });
        return filteredParams;
      }
      normalizeItem(item) {
        const year = item.year || item.vessel_year;
        const brand = item.brand || item.make;
        const model = item.model;
        const price = item.price || item.ask || item.list_price || 0;
        const loa = item.length_ft || item.loa || item.length;
        const region = item.location || item.region || item.state || item.country;
        const url = item.url || item.detail_url || item.permalink;
        const title = `${year || ""} ${brand || ""} ${model || ""}`.trim();
        if (!price || !year) return null;
        return {
          title,
          ask: Math.round(Number(price)),
          year: year ? Number(year) : null,
          loa: loa ? Number(loa) : null,
          region: region || "Unknown",
          url,
          brand: (brand || "").trim(),
          model: (model || "").trim(),
          engine_type: (item.propulsion || item.drive_type || "").toLowerCase()
        };
      }
      async fetchFilteredComparables(searchParams) {
        if (!this.brokerId || !this.apiKey) {
          console.warn("IYBA credentials missing, cannot fetch listings");
          return [];
        }
        const url = `${this.baseUrl}/listings`;
        const apiParams = {};
        if (searchParams.brand) {
          apiParams.brand = searchParams.brand;
        }
        if (searchParams.model) {
          apiParams.model = searchParams.model;
        }
        if (searchParams.year) {
          apiParams.year_min = searchParams.year - 3;
          apiParams.year_max = searchParams.year + 3;
        }
        if (searchParams.length_min) {
          apiParams.length_min = Math.floor(searchParams.length_min);
        }
        if (searchParams.length_max) {
          apiParams.length_max = Math.ceil(searchParams.length_max);
        }
        if (searchParams.engine_type) {
          apiParams.fuel = searchParams.engine_type;
        }
        apiParams.limit = searchParams.limit || 50;
        const queryParams = this.buildQueryParams(apiParams);
        const cacheKey = [
          searchParams.brand || "",
          searchParams.model || "",
          searchParams.year || "",
          searchParams.length_min || "",
          searchParams.length_max || "",
          searchParams.engine_type || "",
          searchParams.limit || 8
        ].join("|");
        const cached = this.cache.get(cacheKey);
        if (cached) {
          console.log(`IYBA: Using cached comparables (${cached.length} items)`);
          return cached;
        }
        try {
          console.log(`IYBA: Fetching filtered data from API with params:`, apiParams);
          const searchParamsObj = new URLSearchParams(queryParams);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15e3);
          const response = await fetch(`${url}?${searchParamsObj}`, {
            method: "GET",
            signal: controller.signal,
            headers: {
              "User-Agent": "AI-Boat-Valuation/1.0"
            }
          });
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error(`IYBA API returned ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          let items = [];
          if (data.results) {
            items = data.results;
          } else if (data.data) {
            items = data.data;
          } else if (Array.isArray(data)) {
            items = data;
          }
          console.log(`IYBA: Fetched ${items.length} filtered raw listings`);
          const comparables = [];
          for (const listing of items) {
            const normalized = this.normalizeItem(listing);
            if (!normalized) continue;
            let matches = true;
            if (searchParams.brand && !normalized.brand.toLowerCase().includes(searchParams.brand.toLowerCase())) {
              matches = false;
            }
            if (searchParams.model && !normalized.model.toLowerCase().includes(searchParams.model.toLowerCase())) {
              matches = false;
            }
            if (searchParams.year && normalized.year && Math.abs(normalized.year - searchParams.year) > 3) {
              matches = false;
            }
            if (searchParams.length_min && normalized.loa && normalized.loa < searchParams.length_min) {
              matches = false;
            }
            if (searchParams.length_max && normalized.loa && normalized.loa > searchParams.length_max) {
              matches = false;
            }
            if (searchParams.engine_type) {
              const targetEngine = searchParams.engine_type.toLowerCase();
              const listingEngine = normalized.engine_type;
              if (!listingEngine.includes(targetEngine)) {
                const isShaftMatch = targetEngine.includes("shaft") && listingEngine.includes("shaft");
                const isIPSMatch = targetEngine.includes("ips") && listingEngine.includes("ips");
                const isOutboardMatch = targetEngine.includes("outboard") && listingEngine.includes("outboard");
                if (!isShaftMatch && !isIPSMatch && !isOutboardMatch) {
                  matches = false;
                }
              }
            }
            if (matches) {
              comparables.push(normalized);
            }
          }
          console.log(`IYBA: Found ${comparables.length} matching comparables after normalization`);
          if (searchParams.year) {
            comparables.sort((a, b) => {
              const targetYear = searchParams.year;
              const yearDiffA = Math.abs((a.year || targetYear) - targetYear);
              const yearDiffB = Math.abs((b.year || targetYear) - targetYear);
              if (yearDiffA !== yearDiffB) {
                return yearDiffA - yearDiffB;
              }
              return Math.abs(a.ask - b.ask);
            });
          } else {
            comparables.sort((a, b) => b.ask - a.ask);
          }
          const finalResults = comparables.slice(0, searchParams.limit || 8);
          this.cache.set(cacheKey, finalResults);
          return finalResults;
        } catch (error) {
          console.error("IYBA API fetch error:", error);
          return [];
        }
      }
      async searchComparables(params) {
        return this.fetchFilteredComparables(params);
      }
      async searchComparablesForVessel(brand, model, year, loaFt, fuelType) {
        console.log(`IYBA: Searching comparables for ${year || ""} ${brand} ${model || ""} (${loaFt || "?"}ft) with server-side filtering`);
        let length_min;
        let length_max;
        if (loaFt) {
          const tolerance = loaFt * 0.15;
          length_min = loaFt - tolerance;
          length_max = loaFt + tolerance;
        }
        let engine_type;
        if (fuelType) {
          const fuelLower = fuelType.toLowerCase();
          if (fuelLower.includes("gas") || fuelLower.includes("gasoline")) {
            engine_type = "gas";
          } else if (fuelLower.includes("diesel")) {
            engine_type = "diesel";
          }
        }
        return this.fetchFilteredComparables({
          brand,
          model,
          year,
          length_min,
          length_max,
          engine_type,
          limit: 8
        });
      }
      async getMarketSummary(comparables) {
        if (comparables.length === 0) {
          return {
            avgPrice: 0,
            medianPrice: 0,
            priceRange: { min: 0, max: 0 },
            sampleSize: 0
          };
        }
        const prices = comparables.map((c) => c.ask).sort((a, b) => a - b);
        const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const medianPrice = prices.length % 2 === 0 ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2 : prices[Math.floor(prices.length / 2)];
        return {
          avgPrice: Math.round(avgPrice),
          medianPrice: Math.round(medianPrice),
          priceRange: {
            min: prices[0],
            max: prices[prices.length - 1]
          },
          sampleSize: comparables.length
        };
      }
      // Test endpoint for verification
      async smokeTest() {
        console.log("IYBA: Running smoke test with server-side filtering...");
        const comparables = await this.searchComparables({
          brand: "Sunseeker",
          year: 2019,
          engine_type: "diesel",
          limit: 5
        });
        return {
          count: comparables.length,
          sample: comparables.slice(0, 3)
        };
      }
    };
    iybaService = new IYBAService();
  }
});

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  createEstimateRequestSchema: () => createEstimateRequestSchema,
  estimates: () => estimates,
  insertLeadSchema: () => insertLeadSchema,
  insertVesselSchema: () => insertVesselSchema,
  leadActivities: () => leadActivities,
  leads: () => leads,
  vessels: () => vessels
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var leads = pgTable("leads", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var vessels = pgTable("vessels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  makeModel: text("make_model").notNull(),
  year: integer("year"),
  loaFt: real("loa_ft"),
  fuelType: text("fuel_type"),
  // gas | diesel | electric | other
  condition: text("condition").default("good"),
  // project | fair | average | good | excellent
  hours: integer("hours"),
  createdAt: timestamp("created_at").defaultNow()
});
var estimates = pgTable("estimates", {
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
  createdAt: timestamp("created_at").defaultNow()
});
var leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull().references(() => leads.id),
  activityType: text("activity_type").notNull(),
  // form_submit | sms_sent | email_sent | pipedrive_created
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  tcpaTimestamp: true
}).extend({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^[\d\s\-\(\)\+\.]+$/, "Please enter a valid phone number"),
  name: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  smsConsent: z.boolean().default(false)
});
var insertVesselSchema = createInsertSchema(vessels).omit({
  id: true,
  leadId: true,
  createdAt: true
}).extend({
  makeModel: z.string().min(1, "Make & Model is required"),
  year: z.number().min(1950, "Year must be after 1950").max((/* @__PURE__ */ new Date()).getFullYear() + 1, "Year cannot be in the future").optional(),
  loaFt: z.number().min(20, "Length must be at least 20 feet").max(500, "Length cannot exceed 500 feet").optional(),
  fuelType: z.enum(["gas", "diesel", "electric", "other"]).optional(),
  condition: z.enum(["project", "fair", "average", "good", "excellent"]).default("good"),
  hours: z.number({ invalid_type_error: "Engine hours must be a number" }).int("Engine hours must be a whole number").min(0, "Engine hours must be at least 0").max(2e4, "Engine hours cannot exceed 20,000").optional()
});
var vesselRequestSchema = insertVesselSchema.extend({
  make: z.string().optional(),
  model: z.string().optional()
});
var createEstimateRequestSchema = z.object({
  leadData: insertLeadSchema,
  vesselData: vesselRequestSchema,
  turnstileToken: z.string().min(1, "Please complete the security verification"),
  utmParams: z.object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional()
  }).optional()
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq } from "drizzle-orm";
var DatabaseStorage = class {
  requestCounts = /* @__PURE__ */ new Map();
  // Keep rate limiting in memory
  async createLead(leadData) {
    const [lead] = await db.insert(leads).values({
      name: leadData.name || null,
      email: leadData.email,
      phone: leadData.phone,
      smsConsent: leadData.smsConsent || false,
      city: leadData.city || null,
      zipCode: leadData.zipCode || null,
      ipAddress: leadData.ipAddress,
      utmSource: leadData.utmParams?.utm_source || null,
      utmMedium: leadData.utmParams?.utm_medium || null,
      utmCampaign: leadData.utmParams?.utm_campaign || null,
      utmTerm: leadData.utmParams?.utm_term || null,
      utmContent: leadData.utmParams?.utm_content || null
    }).returning();
    return lead;
  }
  async getLead(id) {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || void 0;
  }
  async getLeadByEmail(email) {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || void 0;
  }
  async createVessel(vesselData) {
    const [vessel] = await db.insert(vessels).values({
      leadId: vesselData.leadId,
      makeModel: vesselData.makeModel,
      year: vesselData.year || null,
      loaFt: vesselData.loaFt || null,
      fuelType: vesselData.fuelType || null,
      condition: vesselData.condition || "good",
      hours: vesselData.hours ?? null
    }).returning();
    return vessel;
  }
  async getVessel(id) {
    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, id));
    return vessel || void 0;
  }
  async getVesselsByLeadId(leadId) {
    const results = await db.select().from(vessels).where(eq(vessels.leadId, leadId));
    return results;
  }
  async createEstimate(estimateData) {
    const [estimate] = await db.insert(estimates).values(estimateData).returning();
    return estimate;
  }
  async getEstimate(id) {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate || void 0;
  }
  async getEstimateByVesselId(vesselId) {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.vesselId, vesselId));
    return estimate || void 0;
  }
  async createActivity(activityData) {
    const [activity] = await db.insert(leadActivities).values(activityData).returning();
    return activity;
  }
  async getActivitiesByLeadId(leadId) {
    const results = await db.select().from(leadActivities).where(eq(leadActivities.leadId, leadId));
    return results;
  }
  async getRequestCount(ipAddress, timeWindow, customKey) {
    const key = customKey || ipAddress;
    const record = this.requestCounts.get(key);
    if (!record) return 0;
    const now = Date.now();
    if (now - record.timestamp > timeWindow) {
      this.requestCounts.delete(key);
      return 0;
    }
    return record.count;
  }
  async incrementRequestCount(ipAddress, customKey) {
    const key = customKey || ipAddress;
    const now = Date.now();
    const record = this.requestCounts.get(key);
    if (!record) {
      this.requestCounts.set(key, { count: 1, timestamp: now });
    } else {
      record.count++;
      record.timestamp = now;
    }
  }
};
var storage = new DatabaseStorage();

// server/middleware/rateLimit.ts
function createRateLimit(options) {
  return async (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    try {
      const requestCount = await storage.getRequestCount(clientIp, options.windowMs);
      if (requestCount >= options.maxRequests) {
        return res.status(429).json({
          error: options.message || "Too many requests. Please try again later.",
          retryAfter: Math.ceil(options.windowMs / 1e3)
        });
      }
      await storage.incrementRequestCount(clientIp);
      next();
    } catch (error) {
      console.error("Rate limiting error:", error);
      next();
    }
  };
}
var submitFormRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  maxRequests: 10,
  // 10 submissions per 5 minutes per IP
  message: "Too many valuation requests. Please wait before submitting again."
});
var generalRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  maxRequests: 60,
  // 60 requests per minute per IP
  message: "Too many requests. Please slow down."
});

// server/utils/ai-utils.ts
import OpenAI from "openai";
if (!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY2) {
  console.error("Missing OPENAI_API_KEY");
}
var openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1"
});
function openAIHealth() {
  const hasKey2 = !!process.env.OPENAI_API_KEY2;
  const hasKey1 = !!process.env.OPENAI_API_KEY;
  if (hasKey2) {
    return { ok: true, reason: "key2_present" };
  } else if (hasKey1) {
    return { ok: true, reason: "key1_present" };
  }
  return { ok: false, reason: "no_api_key" };
}

// backend/ai-utils.ts
import OpenAI2 from "openai";
var OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
var openai2 = new OpenAI2({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://api.openai.com/v1"
});

// backend/prompts/valuation.ts
var VALUATION_SYSTEM_PROMPT = `
You are the MyYachtValue valuation engine. Output STRICT JSON ONLY (no markdown). Compute ALL numeric fields from inputs and market reasoning; do not reuse example values.

DETERMINISM & CONSISTENCY
- Compute: valuation_low < valuation_mid < valuation_high from inputs only.
- Wholesale is AI-derived: realistic fast-cash liquidation. Target 60% of valuation_mid; stay within 55\u201365% unless strong evidence forces otherwise, and explain any deviation in "assumptions".
- Favor SOLD prices or time-to-sell\u2013realistic figures over aspirational asks; when only asks exist, discount accordingly.

GLOBAL VALUATION POLICY (APPLIES TO ALL BOATS)
- Prioritize comps by: region \u2192 size/segment \u2192 vintage \u2192 brand reputation \u2192 condition \u2192 hours \u2192 refit/modernization.
- South Florida and high-supply markets: be conservative vs. national averages.
- Age & hours adjustments (guidance, not fixed math):
  \u2022 Older vintage (\u224815\u201325+ years) and/or high engine hours should pull valuation toward the lower half of the comp band unless a major refit is present.
  \u2022 Recent major refit (engines/paint/interior/electronics within ~5 years) can justify mid-to-upper band.
- Condition normalization: map to {Below Average, Average, Above Average, Excellent} and reflect that in the band selection.
- Seasonality & demand: in shoulder/off seasons or saturated segments, bias toward lower band unless evidence suggests otherwise.
- Don\u2019t over-index on length alone; vintage/brand/upgrades and liquidity matter more for price realization.

MARKET VALUATION POLICY (STRICT)
- Pricing must reflect actual resale behavior, not aspirational or size-based assumptions.
- For vessels older than 15 years with 2,000+ engine hours and no major refit:
  \u2022 valuation_mid must fall within the lower or middle of the comparable sales band.
  \u2022 DO NOT return valuation_high values in excess of $2M unless strongly justified.
- If valuation_mid exceeds $2M for any vessel older than 15 years, AI must explain this in "assumptions[]" (e.g., rare refit, exceptional demand, special comps).
- South Florida is a high-supply region \u2014 bias toward conservative pricing by default.
- NEVER justify valuations based on length or prestige alone.

WHOLESALE POLICY (MANDATORY)
- Wholesale must reflect a realistic fast-cash price an investor might pay to assume risk, re-list, and carry the vessel.
- Target: 60% of valuation_mid.
- Required range: 55%\u201365% of valuation_mid.
- If wholesale falls outside this band, AI MUST explain it in "assumptions[]".
- Always consider age, hours, and location when computing liquidation price.
- Do not inflate wholesale for size or brand name \u2014 this is a financial decision, not a reputation contest.

NARRATIVE STYLE (STRICT)
- Audience: boat owners choosing between listing at fair market vs instant offers.
- Tone: positive, professional, transparent; lead with opportunity; avoid fear language.
- Do NOT use: "reduces value", "limits pricing", "issues", "concerning".
- Prefer: "influences pricing", "typical for age", "room to modernize".
- 110\u2013130 words, 3\u20135 complete sentences, one paragraph, US English.
- Include these exact tokens in the paragraph with thousands separators:
  - "Estimated Market Range: $<low>\u2013$<high>"
  - "Most Likely: $<mid>"
  - "Wholesale: ~$<wholesale>"
  - "Confidence: <Low|Medium|High>"

STRICT JSON SHAPE (only these keys):
{
  "valuation_low": number | null,
  "valuation_mid": number | null,
  "valuation_high": number | null,
  "wholesale": number | null,
  "narrative": string | null,
  "assumptions": string[] | null,
  "inputs_echo": object
}
`;
function buildValuationUserPayload(input) {
  const fields = {
    make: input?.vesselData?.make ?? input?.make ?? null,
    model: input?.vesselData?.model ?? input?.model ?? null,
    year: input?.vesselData?.year ?? input?.year ?? null,
    loaFt: input?.vesselData?.loaFt ?? input?.loaFt ?? null,
    fuelType: input?.vesselData?.fuelType ?? input?.fuelType ?? null,
    hours: input?.vesselData?.hours ?? input?.hours ?? null,
    condition: input?.vesselData?.condition ?? input?.condition ?? null,
    exteriorConditionScore: input?.condition?.exteriorScore ?? null,
    interiorConditionScore: input?.condition?.interiorScore ?? null,
    notableFeatures: input?.features ?? null,
    region: input?.region ?? input?.market_region ?? "South Florida"
  };
  return {
    instruction: `
Return STRICT JSON matching the shape above.
- Compute valuation_low/mid/high and wholesale from the inputs only, following the Global Valuation Policy and Wholesale Policy.
- Choose Confidence (Low/Medium/High) and include it only within the narrative token.
- Keep "assumptions" as short bullet-like strings; include one reason if wholesale leaves the 55\u201365% band.
- Copy original inputs into "inputs_echo".
`,
    fields
  };
}

// server/routes.ts
async function postValuation(req, res) {
  const payload = req.body ?? {};
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(502).json({ error: "AIUnavailable", detail: "Missing OPENAI_API_KEY" });
    }
    console.log("Valuation calling OpenAI", {
      model: OPENAI_MODEL,
      keyPresent: !!process.env.OPENAI_API_KEY
    });
    const resp = await openai2.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: VALUATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(buildValuationUserPayload(payload)) }
      ],
      text: { format: { type: "json_object" } },
      temperature: 0.1,
      top_p: 1
    });
    const text2 = resp.output_text ?? resp.output?.[0]?.content?.[0]?.text?.value ?? "{}";
    let ai;
    try {
      ai = JSON.parse(text2);
    } catch {
      return res.status(502).json({ error: "BadAIOutput", detail: "Non\u2011JSON AI response" });
    }
    if (!ai || typeof ai !== "object") {
      ai = {};
    }
    if (ai && typeof ai.narrative === "string") {
      ai.narrative = ai.narrative.replace(/reduces value/gi, "").replace(/limits pricing/gi, "").replace(/\bissues\b/gi, "").replace(/\bconcerning\b/gi, "").replace(/\s+/g, " ").trim();
    }
    const fmt = (n) => typeof n === "number" ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "\u2014";
    const floor10k = (n) => typeof n === "number" && Number.isFinite(n) ? Math.floor(n / 1e4) * 1e4 : null;
    const low = typeof ai?.valuation_low === "number" && Number.isFinite(ai.valuation_low) ? ai.valuation_low : null;
    const mid = typeof ai?.valuation_mid === "number" && Number.isFinite(ai.valuation_mid) ? ai.valuation_mid : null;
    const high = typeof ai?.valuation_high === "number" && Number.isFinite(ai.valuation_high) ? ai.valuation_high : null;
    const midFallback = low !== null && high !== null ? Math.round((low + high) / 2) : null;
    const midBase = mid ?? midFallback;
    const wholesaleRaw = typeof midBase === "number" ? midBase * 0.6 : null;
    const wholesale = floor10k(wholesaleRaw);
    const tokenLine = ` Estimated Market Range: $${fmt(low)}\u2013$${fmt(high)}. Most Likely: $${fmt(midBase)}. Wholesale: ~$${fmt(wholesale)}. Confidence: ${ai?.confidence ?? "Medium"}.`;
    ai.narrative = typeof ai.narrative === "string" ? ai.narrative : "";
    ai.narrative = ai.narrative.replace(/Estimated Market Range:[^.]*\./i, "").replace(/Most Likely:[^.]*\./i, "").replace(/Wholesale:[^.]*\./i, "").replace(/Confidence:[^.]*\./i, "").trim();
    ai.narrative = (ai.narrative.endsWith(".") ? ai.narrative : ai.narrative + ".") + tokenLine;
    const result = {
      valuation_low: low,
      valuation_mid: mid,
      valuation_high: high,
      wholesale,
      narrative: typeof ai.narrative === "string" ? ai.narrative : null,
      assumptions: Array.isArray(ai.assumptions) ? ai.assumptions : null,
      inputs_echo: payload
    };
    return res.json(result);
  } catch (err) {
    console.error("Valuation OpenAI error:", err);
    return res.status(502).json({ error: "AIUnavailable", detail: "OpenAI request failed" });
  }
}
async function registerRoutes(app2) {
  app2.use("/api", (req, res, next) => {
    if (req.path.startsWith("/lead/")) {
      return next();
    }
    return generalRateLimit(req, res, next);
  });
  app2.use("/api", (req, res, next) => {
    const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(",") || ["http://localhost:5000"];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app2.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app2.get("/api/health/openai", (req, res) => {
    const health = openAIHealth();
    res.json(health);
  });
  app2.get("/api/iyba-smoke", async (req, res) => {
    try {
      const { iybaService: iybaService2 } = await Promise.resolve().then(() => (init_iyba_api(), iyba_api_exports));
      const data = await iybaService2.smokeTest();
      res.json({
        ...data,
        hasApiKey: !!process.env.IYBA_KEY,
        hasBrokerId: !!process.env.IYBA_BROKER_ID
      });
    } catch (error) {
      console.error("IYBA smoke test error:", error);
      res.status(500).json({
        error: "IYBA test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.get("/api/iyba-test-scout", async (req, res) => {
    try {
      const { iybaService: iybaService2 } = await Promise.resolve().then(() => (init_iyba_api(), iyba_api_exports));
      const comparables = await iybaService2.searchComparablesForVessel(
        "Scout",
        "22",
        2016,
        22,
        "gas"
      );
      const marketSummary = await iybaService2.getMarketSummary(comparables);
      res.json({
        vessel: "2016 Scout 22",
        comparablesFound: comparables.length,
        comparables: comparables.slice(0, 5),
        // Show first 5
        marketSummary,
        hasApiKey: !!process.env.IYBA_KEY,
        hasBrokerId: !!process.env.IYBA_BROKER_ID
      });
    } catch (error) {
      console.error("IYBA Scout test error:", error);
      res.status(500).json({
        error: "IYBA Scout test failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app2.post("/api/valuation", submitFormRateLimit, postValuation);
  app2.get("/api/lead/:id/activities", async (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    const leadId = req.params.id;
    try {
      if (!leadId || typeof leadId !== "string" || leadId.trim().length === 0) {
        console.warn(`[Security] Invalid lead activities request from ${clientIp}: missing or invalid lead ID`);
        return res.status(400).json({ error: "Valid lead ID is required" });
      }
      console.log(`[Admin] Lead activities requested by ${clientIp} for lead: ${leadId}`);
      const activities = await storage.getActivitiesByLeadId(leadId.trim());
      console.log(`[Admin] Lead activities delivered to ${clientIp}: ${activities.length} activities for lead ${leadId}`);
      res.json({
        success: true,
        leadId,
        count: activities.length,
        activities
      });
    } catch (error) {
      console.error(`[Admin] Get activities error for ${clientIp}, lead ${leadId}:`, error);
      res.status(500).json({
        error: "Failed to fetch activities",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
console.log("OpenAI baseURL =", openai2.baseURL || "default");
console.log("OPENAI key present =", !!process.env.OPENAI_API_KEY);
if ((openai2.baseURL || "").includes("dpg-")) {
  throw new Error("Misconfigured OpenAI baseURL (points to Postgres host).");
}
var app = express2();
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.get("/health/openai", (_req, res) => {
  res.json({
    deprecated: true,
    use: "/api/health/openai",
    key: !!process.env.OPENAI_API_KEY,
    model: OPENAI_MODEL
  });
});
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
