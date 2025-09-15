import { callOpenAIResponses } from "../utils/ai-utils";

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

export interface EstimatorInput {
  make: string;
  model: string | null;
  makeModel: string;
  year: number | null;
  loaFt: number | null;
  fuelType: string | null;
  condition: string;
  hours: number | null;
  horsepower: number | null;
  refitYear: number | null;
}

export interface EstimatorService {
  generateEstimate(vessel: EstimatorInput): Promise<EstimateResult>;
}

class EstimatorServiceImpl implements EstimatorService {
  async generateEstimate(vessel: EstimatorInput): Promise<EstimateResult> {
    // Basic placeholder valuation - adjust multipliers using available vessel context
    const basePrice = 200000;
    const lengthMultiplier = vessel.loaFt ? Math.max(1, vessel.loaFt / 30) : 1;
    const yearMultiplier = vessel.year ? Math.max(0.5, (vessel.year - 1990) / 30) : 1;
    const hoursMultiplier =
      vessel.hours !== null && vessel.hours !== undefined
        ? Math.max(0.6, 1 - vessel.hours / 40000)
        : 1;

    const mostLikely = Math.round(basePrice * lengthMultiplier * yearMultiplier * hoursMultiplier);
    const low = Math.round(mostLikely * 0.85);
    const high = Math.round(mostLikely * 1.25);
    const wholesale = Math.round(mostLikely * 0.75);

    const defaultNarrative = "This is a placeholder valuation. The new valuation system is being developed.";
    let narrative = defaultNarrative;
    let aiStatus: EstimateResult["aiStatus"] = 'error';

    const promptLines = [
      `Make: ${vessel.make || "Unknown"}`,
      `Model: ${vessel.model || "Unknown"}`,
      `Year: ${vessel.year ?? "Unknown"}`,
      `Length (ft): ${vessel.loaFt ?? "Unknown"}`,
      `Fuel Type: ${vessel.fuelType || "Unknown"}`,
      `Condition: ${vessel.condition || "Unknown"}`,
      `Hours: ${vessel.hours ?? "Unknown"}`,
    ];

    const prompt =
      "You are a marine valuation analyst. Provide a concise two sentence summary that highlights resale considerations based on the following vessel details:\n" +
      promptLines.join("\n");

    try {
      const aiResponse = await callOpenAIResponses("gpt-4o-mini", prompt);
      if (aiResponse.status === 'ok' && aiResponse.text) {
        narrative = aiResponse.text.trim();
        aiStatus = 'ok';
      } else if (aiResponse.status === 'rate_limited') {
        aiStatus = 'rate_limited';
      } else {
        aiStatus = 'error';
      }
    } catch (error) {
      aiStatus = 'error';
    }

    return {
      low,
      mostLikely,
      high,
      wholesale,
      confidence: "Low" as const,
      narrative,
      comps: [],
      isPremiumLead: false,
      aiStatus,
    };
  }
}

export const estimatorService = new EstimatorServiceImpl();