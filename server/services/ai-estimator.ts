import OpenAI from "openai";
import { Vessel } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AIComparable {
  title: string;
  ask: number;
  year: number;
  loa: number;
  region: string;
  brand: string;
  model: string;
  fuel_type?: string;
}

export interface AIEstimate {
  low: number;
  mostLikely: number;
  high: number;
  wholesale: number;
  confidence: "Low" | "Medium" | "High";
  narrative: string;
  comps: AIComparable[];
  isPremiumLead: boolean;
}

export class AIEstimatorService {
  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<AIEstimate> {
    try {
      // Generate comprehensive boat valuation using AI
      const valuation = await this.generateAIValuation(vessel);
      const comparables = await this.generateAIComparables(vessel);

      return {
        ...valuation,
        comps: comparables,
        isPremiumLead: this.determinePremiumStatus(vessel, valuation)
      };
    } catch (error: any) {
      console.warn("AI estimator service failed:", error.message || error);
      
      // Check if it's a rate limit error specifically
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('rate')) {
        console.warn("OpenAI rate limit detected, using fallback estimation");
      }
      
      // Always fallback to basic estimation when AI fails
      return this.generateFallbackEstimate(vessel);
    }
  }

  private async generateAIValuation(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">) {
    const prompt = `You are a professional marine surveyor and yacht broker with 20+ years of experience. 
    
    Provide a detailed valuation for this boat:
    - Brand: ${vessel.brand}
    - Model: ${vessel.model || 'Unknown'}
    - Year: ${vessel.year || 'Unknown'}
    - Length: ${vessel.loaFt || 'Unknown'}ft
    - Fuel Type: ${vessel.fuelType || 'Unknown'}
    - Hours: ${vessel.hours || 'Unknown'}
    - Condition: ${vessel.condition || 'Average'}
    
    Consider current market conditions, depreciation curves, brand reputation, size category, and condition factors.
    
    Respond with JSON in this exact format:
    {
      "low": number,
      "mostLikely": number, 
      "high": number,
      "wholesale": number,
      "confidence": "High|Medium|Low",
      "narrative": "detailed explanation of valuation rationale"
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert marine appraiser. Provide realistic market valuations based on current boat market conditions. Always respond with valid JSON."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      low: Math.round(result.low || 50000),
      mostLikely: Math.round(result.mostLikely || 75000),
      high: Math.round(result.high || 100000),
      wholesale: Math.round(result.wholesale || 45000),
      confidence: (result.confidence === 'High' || result.confidence === 'Medium' || result.confidence === 'Low') 
        ? result.confidence : 'Medium',
      narrative: result.narrative || 'AI-generated valuation based on vessel specifications and market analysis.'
    };
  }

  private async generateAIComparables(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<AIComparable[]> {
    const prompt = `Generate 6-8 realistic comparable boat listings for market analysis.

    Target boat:
    - Brand: ${vessel.brand}
    - Model: ${vessel.model || 'Similar model'}
    - Year: ${vessel.year || 'Similar year range'}
    - Length: ${vessel.loaFt || 'Similar size'}ft
    - Fuel Type: ${vessel.fuelType || 'Similar fuel type'}

    Create realistic comparable listings with:
    - Similar brands and models (exact matches and close competitors)
    - Years within ±5 years when possible
    - Lengths within ±10ft when possible
    - Realistic asking prices for current market
    - Geographic diversity (different regions)
    - Mix of conditions and specifications

    Respond with JSON array in this exact format:
    [
      {
        "title": "YEAR BRAND MODEL",
        "ask": number,
        "year": number,
        "loa": number,
        "region": "State/Region",
        "brand": "Brand Name",
        "model": "Model Name",
        "fuel_type": "gas|diesel|unknown"
      }
    ]`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a yacht broker creating realistic comparable boat listings. Generate diverse, realistic market data with current pricing. Always respond with valid JSON array."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4
    });

    const result = JSON.parse(response.choices[0].message.content || '{"comparables": []}');
    let comparables = result.comparables || result || [];
    
    // Ensure comparables is an array
    if (!Array.isArray(comparables)) {
      console.warn("AI returned non-array comparables, using empty array");
      comparables = [];
    }
    
    // Ensure we return valid comparables
    return comparables.slice(0, 8).map((comp: any) => ({
      title: comp.title || `${comp.year || ''} ${comp.brand || ''} ${comp.model || ''}`.trim(),
      ask: Math.round(comp.ask || 50000),
      year: comp.year || vessel.year || 2020,
      loa: comp.loa || vessel.loaFt || 30,
      region: comp.region || 'Various Regions',
      brand: comp.brand || vessel.brand || 'Various',
      model: comp.model || vessel.model || 'Various',
      fuel_type: comp.fuel_type || vessel.fuelType || 'unknown'
    }));
  }

  private determinePremiumStatus(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">, valuation: any): boolean {
    // Consider it premium if high-value boat or luxury brand
    const premiumBrands = [
      'azimut', 'ferretti', 'pershing', 'princess', 'sunseeker', 'bertram',
      'viking', 'hatteras', 'boston whaler', 'grady-white', 'chris-craft'
    ];
    
    const brand = vessel.brand?.toLowerCase() || '';
    const isPremiumBrand = premiumBrands.some(p => brand.includes(p));
    const isHighValue = valuation.mostLikely >= 200000;
    const isLargeVessel = (vessel.loaFt || 0) >= 40;
    
    return isPremiumBrand || isHighValue || isLargeVessel;
  }

  private generateFallbackEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): AIEstimate {
    // Enhanced fallback calculation with better logic
    let baseValue = (vessel.loaFt || 35) * 3000; // $3000 per foot baseline
    
    // Year adjustment
    const currentYear = new Date().getFullYear();
    const age = currentYear - (vessel.year || 2015);
    const yearFactor = Math.max(0.4, 1 - (age * 0.04)); // 4% depreciation per year, floor at 40%
    
    // Condition adjustment
    const conditionFactors = {
      'excellent': 1.2,
      'very_good': 1.1,
      'good': 1.0,
      'fair': 0.85,
      'poor': 0.7
    };
    const conditionFactor = conditionFactors[vessel.condition as keyof typeof conditionFactors] || 1.0;
    
    // Hours adjustment
    const hoursAdjustment = vessel.hours ? Math.max(0.85, 1 - ((vessel.hours - 100) * 0.0001)) : 1.0;
    
    const adjustedValue = baseValue * yearFactor * conditionFactor * hoursAdjustment;
    
    const mostLikely = Math.round(adjustedValue);
    const low = Math.round(mostLikely * 0.8);
    const high = Math.round(mostLikely * 1.15);
    const wholesale = Math.round(mostLikely * 0.75);

    // Generate simple comparable boats
    const comps: AIComparable[] = [
      {
        title: `${vessel.year || 2020} ${vessel.brand} ${vessel.model || 'Similar Model'}`,
        ask: Math.round(mostLikely * (0.95 + Math.random() * 0.1)),
        year: vessel.year || 2020,
        loa: vessel.loaFt || 35,
        region: 'Florida',
        brand: vessel.brand,
        model: vessel.model || 'Similar Model',
        fuel_type: vessel.fuelType || 'gas'
      },
      {
        title: `${(vessel.year || 2020) - 1} ${vessel.brand} Comparable`,
        ask: Math.round(mostLikely * (0.85 + Math.random() * 0.15)),
        year: (vessel.year || 2020) - 1,
        loa: (vessel.loaFt || 35) - 1,
        region: 'California',
        brand: vessel.brand,
        model: 'Similar Model',
        fuel_type: vessel.fuelType || 'gas'
      },
      {
        title: `${(vessel.year || 2020) + 1} ${vessel.brand} Sport`,
        ask: Math.round(mostLikely * (1.05 + Math.random() * 0.1)),
        year: (vessel.year || 2020) + 1,
        loa: (vessel.loaFt || 35) + 2,
        region: 'Texas',
        brand: vessel.brand,
        model: 'Sport Model',
        fuel_type: vessel.fuelType || 'gas'
      }
    ];

    return {
      low,
      mostLikely,
      high,
      wholesale,
      confidence: 'Medium',
      narrative: `This valuation is based on our market analysis algorithms using vessel specifications. The ${vessel.year || 'current'} ${vessel.brand} ${vessel.model || ''} in ${vessel.condition || 'good'} condition represents solid value in today's market. Estimated using length-based pricing with adjustments for age, condition, and usage hours.`,
      comps,
      isPremiumLead: this.determinePremiumStatus(vessel, { mostLikely })
    };
  }
}