import { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  isAuthenticated?: boolean;
}

/**
 * API Key authentication middleware for admin endpoints
 * Validates the API key from either Authorization header or x-api-key header
 */
export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const apiKey = process.env.ADMIN_API_KEY;
  
  if (!apiKey) {
    console.warn("[Security] ADMIN_API_KEY not configured - admin endpoints will be blocked");
    return res.status(503).json({
      error: "Admin functionality not configured",
      message: "Contact administrator to enable this feature"
    });
  }

  // Extract API key from headers
  const providedKey = req.headers.authorization?.replace(/^Bearer\s+/, '') || 
                     req.headers['x-api-key'] as string;

  if (!providedKey) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Provide API key in Authorization header (Bearer token) or x-api-key header"
    });
  }

  if (providedKey !== apiKey) {
    // Log failed authentication attempts for security monitoring
    console.warn(`[Security] Invalid API key attempt from IP: ${req.ip || 'unknown'}, User-Agent: ${req.headers['user-agent'] || 'unknown'}`);
    
    return res.status(403).json({
      error: "Invalid API key",
      message: "Access denied"
    });
  }

  // Log successful authentication
  console.log(`[Security] Authenticated admin request from IP: ${req.ip || 'unknown'} to ${req.path}`);
  
  req.isAuthenticated = true;
  next();
}

/**
 * Admin-specific rate limiter with much stricter limits
 */
export function createAdminRateLimit() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";
    const key = `admin_rate_limit:${clientIp}`;
    
    try {
      // Import storage here to avoid circular dependencies
      const { storage } = await import("../storage");
      
      // Very strict limits: 5 requests per 10 minutes for admin endpoints
      const windowMs = 10 * 60 * 1000; // 10 minutes
      const maxRequests = 5;
      
      const requestCount = await storage.getRequestCount(clientIp, windowMs, key);
      
      if (requestCount >= maxRequests) {
        console.warn(`[Security] Admin rate limit exceeded for IP: ${clientIp}, requests: ${requestCount}`);
        return res.status(429).json({
          error: "Rate limit exceeded for admin endpoints",
          message: "Too many admin requests. Please wait before trying again.",
          retryAfter: Math.ceil(windowMs / 1000),
        });
      }

      await storage.incrementRequestCount(clientIp, key);
      next();
    } catch (error) {
      console.error("Admin rate limiting error:", error);
      // Fail secure - deny access on error
      return res.status(500).json({
        error: "Rate limiting service unavailable",
        message: "Please try again later"
      });
    }
  };
}