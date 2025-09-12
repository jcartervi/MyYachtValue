import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { createEstimateRequestSchema } from "@shared/schema";
import { turnstileService } from "./services/turnstile";
import { estimatorService } from "./services/estimator";
import { twilioService } from "./services/twilio";
import { pipedriveService } from "./services/pipedrive";
import { submitFormRateLimit, generalRateLimit } from "./middleware/rateLimit";
import { openAIHealth } from "./utils/ai-utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply general rate limiting to all API routes except admin endpoints
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
  app.post("/api/valuation", submitFormRateLimit, async (req: Request, res: Response) => {
    try {
      const clientIp = req.ip || req.connection.remoteAddress || "unknown";
      
      // Validate request body
      const validationResult = createEstimateRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationResult.error.issues,
        });
      }

      const { leadData, vesselData, turnstileToken, utmParams } = validationResult.data;

      // Verify Turnstile token
      const turnstileResult = await turnstileService.verifyToken(turnstileToken, clientIp);
      if (!turnstileResult.success) {
        return res.status(400).json({
          error: turnstileResult.error || "Security verification failed",
        });
      }

      // Create lead with IP and UTM tracking
      const lead = await storage.createLead({
        ...leadData,
        ipAddress: clientIp,
        utmParams,
      });

      // Log form submission activity
      await storage.createActivity({
        leadId: lead.id,
        activityType: "form_submit",
        details: { ip: clientIp, userAgent: req.headers["user-agent"] },
      });

      // Create vessel record
      const vessel = await storage.createVessel({
        ...vesselData,
        leadId: lead.id,
      });

      // Generate valuation estimate - convert undefined to null for estimator
      const estimateInputData = {
        brand: vesselData.brand,
        model: vesselData.model || null,
        year: vesselData.year || null,
        loaFt: vesselData.loaFt || null,
        fuelType: vesselData.fuelType || null,
        horsepower: vesselData.horsepower || null,
        hours: vesselData.hours || null,
        refitYear: vesselData.refitYear || null,
        condition: vesselData.condition || "good",
      };
      const estimateResult = await estimatorService.generateEstimate(estimateInputData);

      // Create estimate record
      const estimate = await storage.createEstimate({
        vesselId: vessel.id,
        ...estimateResult,
      });

      // Handle premium lead notifications
      if (estimateResult.isPremiumLead && lead.smsConsent && lead.phone) {
        const smsMessage = `🚨 PREMIUM LEAD ALERT: ${lead.name || lead.email} - ${vessel.year} ${vessel.brand} ${vessel.model} - Est: $${estimateResult.mostLikely.toLocaleString()} - Phone: ${lead.phone}`;
        
        const smsResult = await twilioService.sendSMS(
          process.env.ALERT_PHONE_NUMBER || "+19545410105",
          smsMessage
        );

        if (smsResult.success) {
          await storage.createActivity({
            leadId: lead.id,
            activityType: "sms_sent",
            details: { messageId: smsResult.messageId, type: "premium_lead_alert" },
          });
        }
      }

      // Create Pipedrive records
      try {
        const personResult = await pipedriveService.createPerson(
          lead.name || "",
          lead.email,
          lead.phone || ""
        );

        if (personResult.success && personResult.personId) {
          // Map vessel data to custom fields (configure field keys in environment)
          const customFields: Record<string, any> = {};
          
          if (process.env.PIPEDRIVE_FIELD_BRAND) customFields[process.env.PIPEDRIVE_FIELD_BRAND] = vessel.brand;
          if (process.env.PIPEDRIVE_FIELD_MODEL) customFields[process.env.PIPEDRIVE_FIELD_MODEL] = vessel.model;
          if (process.env.PIPEDRIVE_FIELD_YEAR) customFields[process.env.PIPEDRIVE_FIELD_YEAR] = vessel.year;
          if (process.env.PIPEDRIVE_FIELD_LOA) customFields[process.env.PIPEDRIVE_FIELD_LOA] = vessel.loaFt;
          if (process.env.PIPEDRIVE_FIELD_FUEL_TYPE) customFields[process.env.PIPEDRIVE_FIELD_FUEL_TYPE] = vessel.fuelType;
          if (process.env.PIPEDRIVE_FIELD_HOURS) customFields[process.env.PIPEDRIVE_FIELD_HOURS] = vessel.hours;
          if (process.env.PIPEDRIVE_FIELD_VALUATION) customFields[process.env.PIPEDRIVE_FIELD_VALUATION] = JSON.stringify({
            low: estimate.low,
            mostLikely: estimate.mostLikely,
            high: estimate.high,
            wholesale: estimate.wholesale,
            confidence: estimate.confidence,
          });

          const dealTitle = `Valuation: ${vessel.brand} ${vessel.model || ""} ${vessel.year || ""}`.trim();
          const dealResult = await pipedriveService.createDeal(
            dealTitle,
            personResult.personId,
            estimateResult.mostLikely,
            customFields
          );

          if (dealResult.success && dealResult.dealId) {
            // Create follow-up activity for high-value leads
            if (estimateResult.mostLikely >= 1000000 || estimateResult.isPremiumLead) {
              await pipedriveService.createActivity(
                dealResult.dealId,
                "High-Value Lead Follow-Up",
                `Premium lead with ${vessel.year} ${vessel.brand} ${vessel.model}. Estimated value: $${estimateResult.mostLikely.toLocaleString()}. Contact within 24 hours.`,
                "call"
              );
            }

            await storage.createActivity({
              leadId: lead.id,
              activityType: "pipedrive_created",
              details: { personId: personResult.personId, dealId: dealResult.dealId },
            });
          }
        }
      } catch (pipedriveError) {
        console.error("Pipedrive integration error:", pipedriveError);
        // Continue execution - don't fail the request if Pipedrive fails
      }

      // Return valuation results
      res.json({
        success: true,
        lead: {
          id: lead.id,
          email: lead.email,
          name: lead.name,
        },
        vessel: {
          id: vessel.id,
          brand: vessel.brand,
          model: vessel.model,
          year: vessel.year,
          loaFt: vessel.loaFt,
          fuelType: vessel.fuelType,
          hours: vessel.hours,
          condition: vessel.condition,
        },
        estimate: {
          id: estimate.id,
          low: estimate.low,
          mostLikely: estimate.mostLikely,
          high: estimate.high,
          wholesale: estimate.wholesale,
          confidence: estimate.confidence,
          narrative: estimate.narrative,
          comps: estimate.comps,
          isPremiumLead: estimate.isPremiumLead,
          aiStatus: estimateResult.aiStatus || 'unknown',
        },
      });

    } catch (error) {
      console.error("Valuation endpoint error:", error);
      res.status(500).json({
        error: "An error occurred while processing your request. Please try again.",
      });
    }
  });

  // Create admin rate limiter once at the top
  const adminRateLimit = createAdminRateLimit();

  // Get lead activities (Admin endpoint - requires authentication)
  app.get("/api/lead/:id/activities", apiKeyAuth, adminRateLimit, async (req: Request, res: Response) => {
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
