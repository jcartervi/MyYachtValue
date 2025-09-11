export interface TurnstileService {
  verifyToken(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }>;
}

class TurnstileServiceImpl implements TurnstileService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";
  }

  async verifyToken(token: string, remoteIp?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.secretKey) {
      console.log("[Turnstile] Verification skipped - secret key not configured");
      return { success: true }; // Allow in development
    }

    try {
      const formData = new FormData();
      formData.append('secret', this.secretKey);
      formData.append('response', token);
      if (remoteIp) formData.append('remoteip', remoteIp);

      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error("[Turnstile] API request failed:", response.status);
        return { success: false, error: "Turnstile verification failed" };
      }

      const result = await response.json();
      
      if (result.success) {
        console.log("[Turnstile] Token verified successfully");
        return { success: true };
      } else {
        console.error("[Turnstile] Token verification failed:", result['error-codes']);
        return { success: false, error: "Invalid security token" };
      }
    } catch (error) {
      console.error("[Turnstile] Verification error:", error);
      return { success: false, error: "Security verification failed" };
    }
  }
}

export const turnstileService = new TurnstileServiceImpl();
