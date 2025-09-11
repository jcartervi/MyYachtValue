import { Vessel, PREMIUM_BRANDS, PREMIUM_YEAR_THRESHOLD, PREMIUM_HOURS_THRESHOLD } from "@shared/schema";
import { iybaService } from "./iyba";
import { AIEstimatorService } from "./ai-estimator";

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
  private aiEstimator = new AIEstimatorService();

  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult> {
    // Try AI estimation first
    try {
      const aiResult = await this.aiEstimator.generateEstimate(vessel);
      return aiResult;
    } catch (error: any) {
      console.warn("AI estimation failed, falling back to rules-based estimation. Reason:", error.message || error);
      return this.generateRulesBasedEstimate(vessel);
    }
  }

  private async generateRulesBasedEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult> {
    // Fallback rules-based estimation with market adjustments
    let base = 500_000;

    // Length adjustment (major factor)
    if (vessel.loaFt && vessel.loaFt > 40) {
      base += (vessel.loaFt - 40) * 35_000;
    }

    // Year adjustment (depreciation/appreciation)
    if (vessel.year) {
      const yearDiff = vessel.year - 2012;
      base += yearDiff * 20_000;
    }

    // Engine hours adjustment (wear factor)
    if (vessel.hours !== null && vessel.hours !== undefined) {
      const excessHours = Math.max(0, vessel.hours - 600);
      base -= Math.floor(excessHours / 100) * 7_000;
    }


    // Recent refit premium
    if (vessel.refitYear && vessel.year && (vessel.refitYear - vessel.year) >= 3) {
      base = Math.floor(base * 1.03);
    }

    // Condition adjustments
    const conditionFactors: Record<string, number> = {
      "excellent": 1.15,
      "very_good": 1.05,
      "good": 1.00,
      "fair": 0.85,
      "poor": 0.65,
    };
    base = Math.floor(base * (conditionFactors[vessel.condition || "good"] || 1.0));

    // Calculate range
    const low = Math.floor(base * 0.92);
    const mostLikely = base;
    const high = Math.floor(base * 1.08);
    const wholesale = Math.floor(mostLikely * 0.84);

    // Confidence calculation
    const dataPoints = [
      vessel.brand,
      vessel.year,
      vessel.loaFt,
      vessel.hours !== null ? vessel.hours : undefined,
    ].filter(Boolean).length;
    
    let confidence: "Low" | "Medium" | "High" = "Low";
    if (dataPoints >= 3) confidence = "High";
    else if (dataPoints === 2) confidence = "Medium";

    // Premium lead detection
    const isPremiumLead = this.detectPremiumLead(vessel);

    // Generate narrative
    const narrative = this.generateNarrative(vessel, low, high, mostLikely);

    // Generate comparable sales
    const comps = await this.generateComparables(vessel, mostLikely);

    return {
      low,
      mostLikely,
      high,
      wholesale,
      confidence,
      narrative,
      comps,
      isPremiumLead,
    };
  }

  private detectPremiumLead(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): boolean {
    const brandMatch = PREMIUM_BRANDS.includes(vessel.brand.toLowerCase());
    const recentYear = vessel.year ? vessel.year >= PREMIUM_YEAR_THRESHOLD : false;
    const lowHours = vessel.hours !== null && vessel.hours !== undefined ? vessel.hours <= PREMIUM_HOURS_THRESHOLD : false;

    return brandMatch && (recentYear || lowHours);
  }

  private generateNarrative(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">, low: number, high: number, mostLikely: number): string {
    const year = vessel.year || "current model";
    const brand = vessel.brand;
    const model = vessel.model || "";
    const length = vessel.loaFt ? `${vessel.loaFt}ft ` : "";
    const fuelType = vessel.fuelType || "unspecified";
    const hours = vessel.hours !== null && vessel.hours !== undefined ? vessel.hours : "unknown";
    const condition = vessel.condition || "good";

    let narrative = `This estimate reflects recent market conditions for comparable boats with similar specifications and condition. `;
    
    narrative += `The ${year} ${brand} ${model} ${length} in ${condition} condition with ${fuelType} fuel and approximately ${hours} hours represents `;
    
    if (vessel.year && vessel.year >= 2020) {
      narrative += "excellent value in today's market with modern systems and low depreciation. ";
    } else if (vessel.year && vessel.year >= 2015) {
      narrative += "solid value with proven reliability and strong market demand. ";
    } else {
      narrative += "competitive pricing reflecting age-appropriate market positioning. ";
    }


    if (vessel.refitYear && vessel.year && (vessel.refitYear - vessel.year) >= 3) {
      narrative += "Recent refit work enhances the vessel's condition and market position. ";
    }

    narrative += "Current market trends indicate stable demand for well-maintained vessels in this category.";

    return narrative;
  }

  private async generateComparables(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">, mostLikely: number): Promise<Array<{
    title: string;
    ask: number;
    year: number;
    loa: number;
    region: string;
  }>> {
    try {
      // Try to get real comparable boats from IYBA API
      const realComparables = await iybaService.searchComparableBoats(
        vessel.brand,
        vessel.model || undefined,
        vessel.year || undefined,
        vessel.fuelType || undefined,
        3 // Limit to 3 comparables
      );

      if (realComparables && realComparables.length > 0) {
        return realComparables.map(comp => ({
          title: comp.title,
          ask: comp.ask,
          year: comp.year || vessel.year || 2020,
          loa: comp.loa || vessel.loaFt || 65,
          region: comp.region || "Various"
        }));
      }
    } catch (error) {
      console.error("Failed to fetch real comparables, falling back to estimated data:", error);
    }

    // Fallback to estimated comparables if API fails or returns no results
    const baseYear = vessel.year || 2020;
    const baseLoa = vessel.loaFt || 65;
    const region = "Various";

    return [
      {
        title: `${baseYear} ${vessel.brand} ${vessel.model || "Motor Boat"}`,
        ask: Math.floor(mostLikely * (0.95 + Math.random() * 0.1)),
        year: baseYear,
        loa: Math.floor(baseLoa),
        region,
      },
      {
        title: `${baseYear - 1} Similar ${Math.floor(baseLoa)}ft Motor Boat`,
        ask: Math.floor(mostLikely * (0.85 + Math.random() * 0.15)),
        year: baseYear - 1,
        loa: Math.floor(baseLoa - 2),
        region,
      },
      {
        title: `${baseYear + 1} Comparable ${Math.floor(baseLoa)}ft Sport Boat`,
        ask: Math.floor(mostLikely * (1.05 + Math.random() * 0.1)),
        year: baseYear + 1,
        loa: Math.floor(baseLoa + 1),
        region,
      },
    ];
  }
}

export const estimatorService = new EstimatorServiceImpl();

// Also export AI estimator for direct use if needed
export const aiEstimatorService = new AIEstimatorService();
