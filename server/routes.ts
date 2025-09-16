import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { submitFormRateLimit, generalRateLimit } from "./middleware/rateLimit";
import { openAIHealth } from "./utils/ai-utils";
import { openai } from "../backend/ai-utils";
import { VALUATION_SYSTEM_PROMPT, buildValuationUserPayload } from "../backend/prompts/valuation";
import { ValuationResult } from "../backend/types";

export async function postValuation(req: Request, res: Response) {
  const payload = req.body ?? {};
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(502).json({ error: "AIUnavailable", detail: "Missing OPENAI_API_KEY" });
    }

    const userPayload = buildValuationUserPayload(payload);
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // (Optional debug) quick visibility in logs
    console.log("Valuation calling OpenAI", {
      model,
      keyPresent: !!process.env.OPENAI_API_KEY,
    });

    const resp: any = await openai.responses.create({
      model,
      temperature: 0,
      top_p: 1,
      seed: 7,
      response_format: { type: "json_object" },
      input: [
        { role: "system", content: VALUATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) }
      ]
    } as any);

    const text = resp.output_text
      ?? resp.output?.[0]?.content?.[0]?.text?.value
      ?? "{}";

    let ai: any;
    try {
      ai = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: "BadAIOutput", detail: "Non‑JSON AI response" });
    }

    if (!ai || typeof ai !== "object") {
      ai = {};
    }

    if (ai && typeof ai.narrative === "string") {
      ai.narrative = ai.narrative
        .replace(/Estimated Market Range:[^.]*\./gi, "")
        .replace(/Most Likely:[^.]*\./gi, "")
        .replace(/Wholesale:[^.]*\./gi, "")
        .replace(/Confidence:\s*(Low|Medium|High)\.?/gi, "")
        .replace(/reduces value/gi, "")
        .replace(/limits pricing/gi, "")
        .replace(/\bissues\b/gi, "")
        .replace(/\bconcerning\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const valuationLow = typeof ai?.valuation_low === "number" && Number.isFinite(ai.valuation_low)
      ? ai.valuation_low
      : null;
    const valuationMid = typeof ai?.valuation_mid === "number" && Number.isFinite(ai.valuation_mid)
      ? ai.valuation_mid
      : null;
    const valuationHigh = typeof ai?.valuation_high === "number" && Number.isFinite(ai.valuation_high)
      ? ai.valuation_high
      : null;
    const wholesale = typeof ai?.wholesale === "number" && Number.isFinite(ai.wholesale)
      ? ai.wholesale
      : null;

    const assumptions = Array.isArray(ai?.assumptions)
      ? ai.assumptions.filter((item: unknown): item is string => typeof item === "string")
      : null;

    const inputsEcho = ai && ai.inputs_echo && typeof ai.inputs_echo === "object" && !Array.isArray(ai.inputs_echo)
      ? ai.inputs_echo
      : userPayload.fields;

    const result: ValuationResult = {
      valuation_low: valuationLow,
      valuation_mid: valuationMid,
      valuation_high: valuationHigh,
      wholesale,
      narrative: typeof ai.narrative === "string" && ai.narrative.length > 0 ? ai.narrative : null,
      assumptions,
      inputs_echo: inputsEcho
    };

    return res.json(result);
  } catch (err) {
    console.error("Valuation OpenAI error:", err);
    return res.status(502).json({ error: "AIUnavailable", detail: "OpenAI request failed" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply general rate limiting to all API routes except lead activity endpoints
  app.use("/api", (req, res, next) => {
    // Skip general rate limiting for admin endpoints
    if (req.path.startsWith('/lead/')) {
      return next();
    }
    return generalRateLimit(req, res, next);
  });

  // CORS configuration
  app.use("/api", (req, res, next) => {
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

  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // OpenAI health check endpoint
  app.get("/api/health/openai", (req: Request, res: Response) => {
    const health = openAIHealth();
    res.json(health);
  });

  // IYBA smoke test endpoint
  app.get("/api/iyba-smoke", async (req: Request, res: Response) => {
    try {
      const { iybaService } = await import("./services/iyba-api");
      const data = await iybaService.smokeTest();
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

  // IYBA test endpoint for Scout 22
  app.get("/api/iyba-test-scout", async (req: Request, res: Response) => {
    try {
      const { iybaService } = await import("./services/iyba-api");
      const comparables = await iybaService.searchComparablesForVessel(
        "Scout",
        "22", 
        2016,
        22,
        "gas"
      );
      const marketSummary = await iybaService.getMarketSummary(comparables);
      
      res.json({ 
        vessel: "2016 Scout 22",
        comparablesFound: comparables.length,
        comparables: comparables.slice(0, 5), // Show first 5
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

  // Main valuation endpoint
  app.post("/api/valuation", submitFormRateLimit, postValuation);


  // Get lead activities (for debugging/admin)
  app.get("/api/lead/:id/activities", async (req: Request, res: Response) => {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    const leadId = req.params.id;
    
    try {
      // Validate lead ID format
      if (!leadId || typeof leadId !== 'string' || leadId.trim().length === 0) {
        console.warn(`[Security] Invalid lead activities request from ${clientIp}: missing or invalid lead ID`);
        return res.status(400).json({ error: "Valid lead ID is required" });
      }
      
      console.log(`[Admin] Lead activities requested by ${clientIp} for lead: ${leadId}`);
      
      const activities = await storage.getActivitiesByLeadId(leadId.trim());
      
      console.log(`[Admin] Lead activities delivered to ${clientIp}: ${activities.length} activities for lead ${leadId}`);
      
      res.json({ 
        success: true,
        leadId: leadId,
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



  const httpServer = createServer(app);
  return httpServer;
}
