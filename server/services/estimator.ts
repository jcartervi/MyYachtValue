import { Vessel } from "@shared/schema";

export interface EstimateResult {
  low: number;
  mostLikely: number;
  high: number;
  wholesale: number;
  confidence: "Low" | "Medium" | "High";
  narrative: string;
  comps: Array<{
    title: string;
    ask: number;
    year: number;
    loa: number;
    region: string;
  }>;
  isPremiumLead: boolean;
  aiStatus?: 'ok' | 'rate_limited' | 'error';
}

export interface EstimatorService {
  generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult>;
}

class EstimatorServiceImpl implements EstimatorService {
  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult> {
    // Basic placeholder valuation - replace this with your new system
    const basePrice = 200000;
    const lengthMultiplier = vessel.loaFt ? Math.max(1, vessel.loaFt / 30) : 1;
    const yearMultiplier = vessel.year ? Math.max(0.5, (vessel.year - 1990) / 30) : 1;
    
    const mostLikely = Math.round(basePrice * lengthMultiplier * yearMultiplier);
    const low = Math.round(mostLikely * 0.85);
    const high = Math.round(mostLikely * 1.25);
    const wholesale = Math.round(mostLikely * 0.75);
    
    return {
      low,
      mostLikely,
      high,
      wholesale,
      confidence: "Low" as const,
      narrative: "This is a placeholder valuation. The new valuation system is being developed.",
      comps: [],
      isPremiumLead: false,
      aiStatus: 'ok'
    };
  }
}

export const estimatorService = new EstimatorServiceImpl();