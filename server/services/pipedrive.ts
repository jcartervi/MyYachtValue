export interface PipedriveService {
  createPerson(name: string, email: string, phone: string): Promise<{ success: boolean; personId?: number; error?: string }>;
  createDeal(title: string, personId: number, value: number, customFields?: Record<string, any>): Promise<{ success: boolean; dealId?: number; error?: string }>;
  createActivity(dealId: number, subject: string, note: string, activityType?: string): Promise<{ success: boolean; activityId?: number; error?: string }>;
}

class PipedriveServiceImpl implements PipedriveService {
  private apiToken: string;
  private baseUrl: string;
  private pipelineId: string;
  private stageId: string;

  constructor() {
    this.apiToken = process.env.PIPEDRIVE_API_TOKEN || "";
    this.baseUrl = process.env.PIPEDRIVE_BASE_URL || "https://api.pipedrive.com/v1";
    this.pipelineId = process.env.PIPEDRIVE_PIPELINE_ID || "";
    this.stageId = process.env.PIPEDRIVE_STAGE_ID || "";
  }

  private async makeRequest(endpoint: string, method: string = 'GET', data?: any) {
    if (!this.apiToken) {
      return { success: false, error: "Pipedrive not configured" };
    }

    const url = `${this.baseUrl}${endpoint}?api_token=${this.apiToken}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Pipedrive] ${method} ${endpoint} failed:`, error);
        return { success: false, error: `Pipedrive API error: ${response.status}` };
      }

      const result = await response.json();
      return { success: true, data: result.data };
    } catch (error) {
      console.error(`[Pipedrive] ${method} ${endpoint} error:`, error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async createPerson(name: string, email: string, phone: string): Promise<{ success: boolean; personId?: number; error?: string }> {
    const result = await this.makeRequest('/persons', 'POST', {
      name: name || email,
      email: [{ value: email, primary: true }],
      phone: phone ? [{ value: phone, primary: true }] : undefined,
    });

    if (result.success) {
      console.log("[Pipedrive] Person created:", result.data.id);
      return { success: true, personId: result.data.id };
    }

    return { success: false, error: result.error };
  }

  async createDeal(title: string, personId: number, value: number, customFields?: Record<string, any>): Promise<{ success: boolean; dealId?: number; error?: string }> {
    const dealData: any = {
      title,
      person_id: personId,
      value,
      currency: 'USD',
    };

    if (this.pipelineId) dealData.pipeline_id = parseInt(this.pipelineId);
    if (this.stageId) dealData.stage_id = parseInt(this.stageId);
    if (customFields) Object.assign(dealData, customFields);

    const result = await this.makeRequest('/deals', 'POST', dealData);

    if (result.success) {
      console.log("[Pipedrive] Deal created:", result.data.id);
      return { success: true, dealId: result.data.id };
    }

    return { success: false, error: result.error };
  }

  async createActivity(dealId: number, subject: string, note: string, activityType: string = 'call'): Promise<{ success: boolean; activityId?: number; error?: string }> {
    const result = await this.makeRequest('/activities', 'POST', {
      subject,
      note,
      type: activityType,
      deal_id: dealId,
      due_date: new Date().toISOString().split('T')[0], // Today's date
      due_time: '09:00', // 9 AM
    });

    if (result.success) {
      console.log("[Pipedrive] Activity created:", result.data.id);
      return { success: true, activityId: result.data.id };
    }

    return { success: false, error: result.error };
  }
}

export const pipedriveService = new PipedriveServiceImpl();
