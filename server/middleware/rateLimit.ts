import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export function createRateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    
    try {
      const requestCount = await storage.getRequestCount(clientIp, options.windowMs);
      
      if (requestCount >= options.maxRequests) {
        return res.status(429).json({
          error: options.message || "Too many requests. Please try again later.",
          retryAfter: Math.ceil(options.windowMs / 1000),
        });
      }

      await storage.incrementRequestCount(clientIp);
      next();
    } catch (error) {
      console.error("Rate limiting error:", error);
      next(); // Continue on error to avoid blocking legitimate requests
    }
  };
}

// Pre-configured rate limiters
export const submitFormRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 3, // 3 submissions per 15 minutes per IP
  message: "Too many valuation requests. Please wait before submitting again.",
});

export const generalRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute per IP
  message: "Too many requests. Please slow down.",
});
