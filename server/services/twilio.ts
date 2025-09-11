export interface TwilioService {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

class TwilioServiceImpl implements TwilioService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || "";
  }

  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.log("[Twilio] SMS skipped - missing configuration");
      return { success: false, error: "Twilio not configured" };
    }

    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: this.fromNumber,
          Body: message,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("[Twilio] SMS failed:", error);
        return { success: false, error: `Twilio API error: ${response.status}` };
      }

      const result = await response.json();
      console.log("[Twilio] SMS sent successfully:", result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error("[Twilio] SMS error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export const twilioService = new TwilioServiceImpl();
