import { Vessel, PREMIUM_BRANDS, PREMIUM_YEAR_THRESHOLD, PREMIUM_HOURS_THRESHOLD } from "@shared/schema";

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
}

export interface EstimatorService {
  generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult>;
}

class EstimatorServiceImpl implements EstimatorService {
  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<EstimateResult> {
    // Rules-based estimation with market adjustments
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

    // Gyro/stabilizer premium
    if (vessel.gyro) {
      base = Math.floor(base * 1.05);
    }

    // Recent refit premium
    if (vessel.refitYear && vessel.year && (vessel.refitYear - vessel.year) >= 3) {
      base = Math.floor(base * 1.03);
    }

    // Regional adjustments
    const regionFactors: Record<string, number> = {
      "SE_US": 1.00,
      "NE_US": 0.98,
      "MED": 1.04,
      "CARIB": 1.02,
    };
    base = Math.floor(base * (regionFactors[vessel.region || "SE_US"] || 1.0));

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
    const comps = this.generateComparables(vessel, mostLikely);

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
    const engineType = vessel.engineType || "unspecified";
    const hours = vessel.hours !== null && vessel.hours !== undefined ? vessel.hours : "unknown";
    const region = vessel.region || "SE_US";

    let narrative = `This estimate reflects recent market conditions for comparable yachts with similar specifications in the ${region} region. `;
    
    narrative += `The ${year} ${brand} ${model} ${length}with ${engineType} engines and approximately ${hours} hours represents `;
    
    if (vessel.year && vessel.year >= 2020) {
      narrative += "excellent value in today's market with modern systems and low depreciation. ";
    } else if (vessel.year && vessel.year >= 2015) {
      narrative += "solid value with proven reliability and strong market demand. ";
    } else {
      narrative += "competitive pricing reflecting age-appropriate market positioning. ";
    }

    if (vessel.gyro) {
      narrative += "The presence of gyro stabilization adds significant value and appeal to prospective buyers. ";
    }

    if (vessel.refitYear && vessel.year && (vessel.refitYear - vessel.year) >= 3) {
      narrative += "Recent refit work enhances the vessel's condition and market position. ";
    }

    narrative += "Current market trends indicate stable demand for well-maintained vessels in this category.";

    return narrative;
  }

  private generateComparables(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">, mostLikely: number): Array<{
    title: string;
    ask: number;
    year: number;
    loa: number;
    region: string;
  }> {
    const baseYear = vessel.year || 2020;
    const baseLoa = vessel.loaFt || 65;
    const region = vessel.region === "SE_US" ? "FL" : "Various";

    return [
      {
        title: `${baseYear} ${vessel.brand} ${vessel.model || "Motor Yacht"}`,
        ask: Math.floor(mostLikely * (0.95 + Math.random() * 0.1)),
        year: baseYear,
        loa: Math.floor(baseLoa),
        region,
      },
      {
        title: `${baseYear - 1} Similar ${Math.floor(baseLoa)}ft Motor Yacht`,
        ask: Math.floor(mostLikely * (0.85 + Math.random() * 0.15)),
        year: baseYear - 1,
        loa: Math.floor(baseLoa - 2),
        region,
      },
      {
        title: `${baseYear + 1} Comparable ${Math.floor(baseLoa)}ft Sport Yacht`,
        ask: Math.floor(mostLikely * (1.05 + Math.random() * 0.1)),
        year: baseYear + 1,
        loa: Math.floor(baseLoa + 1),
        region,
      },
    ];
  }
}

export const estimatorService = new EstimatorServiceImpl();
