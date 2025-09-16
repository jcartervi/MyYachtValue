import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { submitFormRateLimit, generalRateLimit } from "./middleware/rateLimit";
import { openAIHealth } from "./utils/ai-utils";
import { openai, OPENAI_MODEL } from "../backend/ai-utils";
import { VALUATION_SYSTEM_PROMPT, buildValuationUserPayload } from "../backend/prompts/valuation";
import { ValuationResult } from "../backend/types";

export async function postValuation(req: Request, res: Response) {
  const payload = req.body ?? {};
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(502).json({ error: "AIUnavailable", detail: "Missing OPENAI_API_KEY" });
    }

    // (Optional debug) quick visibility in logs
    console.log("Valuation calling OpenAI", {
      model: OPENAI_MODEL,
      keyPresent: !!process.env.OPENAI_API_KEY,
    });

    const resp: any = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: VALUATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(buildValuationUserPayload(payload)) }
      ],
      text: { format: { type: "json_object" } },
      temperature: 0.1,
      top_p: 1
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

    // Scrub banned phrases
    if (ai && typeof ai.narrative === "string") {
      ai.narrative = ai.narrative
        .replace(/reduces value/gi, "")
        .replace(/limits pricing/gi, "")
        .replace(/\bissues\b/gi, "")
        .replace(/\bconcerning\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Clean formatting
    const fmt = (n: number | null) => (
      typeof n === "number"
        ? n.toLocaleString("en-US", { maximumFractionDigits: 0 })
        : "—"
    );

    const floor10k = (n: number | null) => (
      typeof n === "number" && Number.isFinite(n)
        ? Math.floor(n / 10000) * 10000
        : null
    );

    const low = typeof ai?.valuation_low === "number" && Number.isFinite(ai.valuation_low)
      ? ai.valuation_low
      : null;
    const mid = typeof ai?.valuation_mid === "number" && Number.isFinite(ai.valuation_mid)
      ? ai.valuation_mid
      : null;
    const high = typeof ai?.valuation_high === "number" && Number.isFinite(ai.valuation_high)
      ? ai.valuation_high
      : null;

    const midFallback = low !== null && high !== null ? Math.round((low + high) / 2) : null;
    const midBase = mid ?? midFallback;
    const wholesaleRaw = typeof midBase === "number" ? midBase * 0.60 : null;
    const wholesale = floor10k(wholesaleRaw);

    const tokenLine =
      ` Estimated Market Range: $${fmt(low)}–$${fmt(high)}.` +
      ` Most Likely: $${fmt(midBase)}.` +
      ` Wholesale: ~$${fmt(wholesale)}.` +
      ` Confidence: ${ai?.confidence ?? "Medium"}.`;

    // Remove any AI-generated token lines to avoid duplicates
    ai.narrative = typeof ai.narrative === "string" ? ai.narrative : "";

    ai.narrative = ai.narrative
      .replace(/Estimated Market Range:[^.]*\./i, "")
      .replace(/Most Likely:[^.]*\./i, "")
      .replace(/Wholesale:[^.]*\./i, "")
      .replace(/Confidence:[^.]*\./i, "")
      .trim();

    // Append clean final version
    ai.narrative = (ai.narrative.endsWith(".") ? ai.narrative : ai.narrative + ".") + tokenLine;

    const result: ValuationResult = {
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
