import { Vessel } from "@shared/schema";
import { callOpenAI, callOpenAIResponses, AIResponse } from "../utils/ai-utils";

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
  aiStatus: 'ok' | 'rate_limited' | 'error';
}

export class AIEstimatorService {
  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<AIEstimate> {
    // Try AI estimation with proper error handling
    const valuationResult = await this.generateAIValuation(vessel);
    
    if (valuationResult.aiStatus === 'ok') {
      // AI worked, get comparables too
      const comparablesResult = await this.generateAIComparables(vessel);
      
      return {
        ...valuationResult,
        comps: comparablesResult.comparables,
        isPremiumLead: this.determinePremiumStatus(vessel, valuationResult),
        aiStatus: 'ok'
      };
    } else {
      // AI failed, use fallback but preserve the status
      console.warn(`AI estimation failed with status: ${valuationResult.aiStatus}`);
      return this.generateFallbackEstimate(vessel, valuationResult.aiStatus);
    }
  }

  private async generateAIValuation(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<{
    low: number;
    mostLikely: number;
    high: number;
    wholesale: number;
    confidence: "Low" | "Medium" | "High";
    narrative: string;
    aiStatus: 'ok' | 'rate_limited' | 'error';
  }> {
    // Calculate expected value range based on vessel type
    const length = vessel.loaFt || 35;
    const year = vessel.year || 2020;
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - year);
    
    // Enhanced base value calculation for different vessel types
    let baseValue = 0;
    const brand = vessel.brand?.toLowerCase() || '';
    
    if (brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut') || brand.includes('ferretti')) {
      // Luxury yacht brands - much higher values
      baseValue = length * length * 800; // $800 per sq foot equivalent for luxury yachts
    } else if (brand.includes('sea ray') || brand.includes('formula') || brand.includes('regal')) {
      // Premium brands
      baseValue = length * 4000;
    } else {
      // Standard boats
      baseValue = length * 3000;
    }
    
    // Age depreciation (luxury yachts depreciate differently)
    const luxuryBrand = brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut');
    const yearFactor = luxuryBrand ? Math.max(0.4, 1 - (age * 0.08)) : Math.max(0.3, 1 - (age * 0.12));
    
    const expectedValue = Math.round(baseValue * yearFactor);
    const minValue = Math.round(expectedValue * 0.7);
    const maxValue = Math.round(expectedValue * 1.3);

    const prompt = `You are a professional marine surveyor and yacht broker with 20+ years of experience specializing in luxury vessels. 
    
    Provide a detailed valuation for this vessel:
    - Brand: ${vessel.brand} (${luxuryBrand ? 'LUXURY BRAND' : 'STANDARD BRAND'})
    - Model: ${vessel.model || 'Unknown'}
    - Year: ${vessel.year || 'Unknown'}
    - Length: ${vessel.loaFt || 'Unknown'}ft ${luxuryBrand ? '(LARGE LUXURY YACHT)' : ''}
    - Fuel Type: ${vessel.fuelType || 'Unknown'}
    - Hours: ${vessel.hours || 'Unknown'}
    - Condition: ${vessel.condition || 'Average'}
    
    CRITICAL: Expected value range is $${minValue.toLocaleString()} - $${maxValue.toLocaleString()}
    ${luxuryBrand ? 'This is a LUXURY YACHT - values should be in MILLIONS, not thousands!' : ''}
    
    Respond with JSON in this exact format:
    {
      "low": ${minValue},
      "mostLikely": ${expectedValue},
      "high": ${maxValue},
      "wholesale": ${Math.round(expectedValue * 0.8)},
      "confidence": "High",
      "narrative": "Professional valuation based on brand prestige, market conditions, and vessel specifications"
    }`;

    console.log("Making OpenAI API call for boat valuation with new key...");
    
    // Convert the prompt to the new input format
    const input = `You are an expert marine appraiser. Provide realistic market valuations based on current boat market conditions. Always respond with valid JSON.

${prompt}

Please respond with a JSON object in exactly this format:
{
  "low": number,
  "mostLikely": number, 
  "high": number,
  "wholesale": number,
  "confidence": "High|Medium|Low",
  "narrative": "detailed explanation of valuation rationale"
}`;
    
    const aiResponse = await callOpenAIResponses("gpt-4o-mini", input);

    if (aiResponse.status !== 'ok') {
      console.log(`OpenAI valuation failed with status: ${aiResponse.status}`);
      
      // Use better fallback values based on vessel type
      const length = vessel.loaFt || 35;
      const brand = vessel.brand?.toLowerCase() || '';
      const luxuryBrand = brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut');
      
      const fallbackValue = luxuryBrand ? length * length * 600 : length * 3000;
      
      return {
        low: Math.round(fallbackValue * 0.8),
        mostLikely: Math.round(fallbackValue),
        high: Math.round(fallbackValue * 1.2),
        wholesale: Math.round(fallbackValue * 0.7),
        confidence: 'Low',
        narrative: aiResponse.status === 'rate_limited' 
          ? '⚠️ AI valuation temporarily rate-limited. Showing fallback estimate.'
          : '⚠️ AI valuation temporarily unavailable. Showing fallback estimate.',
        aiStatus: aiResponse.status
      };
    }

    console.log("OpenAI valuation API call successful");
    
    try {
      const result = JSON.parse(aiResponse.text || '{}');
      
      return {
        low: Math.round(result.low || 50000),
        mostLikely: Math.round(result.mostLikely || 75000),
        high: Math.round(result.high || 100000),
        wholesale: Math.round(result.wholesale || 45000),
        confidence: (result.confidence === 'High' || result.confidence === 'Medium' || result.confidence === 'Low') 
          ? result.confidence : 'Medium',
        narrative: result.narrative || 'AI-generated valuation based on vessel specifications and market analysis.',
        aiStatus: 'ok'
      };
    } catch (parseError) {
      console.warn("Failed to parse OpenAI valuation response:", parseError);
      return {
        low: 50000,
        mostLikely: 75000,
        high: 100000,
        wholesale: 45000,
        confidence: 'Low',
        narrative: '⚠️ AI valuation data format error. Showing fallback estimate.',
        aiStatus: 'error'
      };
    }
  }

  private async generateAIComparables(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<{
    comparables: AIComparable[];
    aiStatus: 'ok' | 'rate_limited' | 'error';
  }> {
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

    console.log("Making OpenAI API call for comparables with new key...");
    
    // Convert the prompt to the new input format  
    const input = `You are a yacht broker creating realistic comparable boat listings. Generate diverse, realistic market data with current pricing. Always respond with valid JSON array.

${prompt}

Please respond with a JSON object containing a "comparables" array in exactly this format:
{
  "comparables": [
    {
      "title": "boat listing title",
      "ask": number,
      "year": number,
      "loa": number,
      "region": "location",
      "brand": "manufacturer",
      "model": "model name", 
      "fuel_type": "gas|diesel|unknown"
    }
  ]
}`;
    
    const aiResponse = await callOpenAIResponses("gpt-4o-mini", input);

    if (aiResponse.status !== 'ok') {
      console.log(`OpenAI comparables failed with status: ${aiResponse.status}`);
      return { 
        comparables: this.generateSyntheticComparables(vessel),
        aiStatus: aiResponse.status 
      };
    }

    console.log("OpenAI comparables API call successful");
    
    try {
      const result = JSON.parse(aiResponse.text || '{"comparables": []}');
      let comparables = result.comparables || result || [];
      
      // Ensure comparables is an array
      if (!Array.isArray(comparables)) {
        console.warn("AI returned non-array comparables, using synthetic comparables");
        return { 
          comparables: this.generateSyntheticComparables(vessel),
          aiStatus: 'ok' 
        };
      }
      
      // Ensure we return valid comparables
      const validComparables = comparables.slice(0, 8).map((comp: any) => ({
        title: comp.title || `${comp.year || ''} ${comp.brand || ''} ${comp.model || ''}`.trim(),
        ask: Math.round(comp.ask || 50000),
        year: comp.year || vessel.year || 2020,
        loa: comp.loa || vessel.loaFt || 30,
        region: comp.region || 'Various Regions',
        brand: comp.brand || vessel.brand || 'Various',
        model: comp.model || vessel.model || 'Various',
        fuel_type: comp.fuel_type || vessel.fuelType || 'unknown'
      }));

      return { comparables: validComparables, aiStatus: 'ok' };
    } catch (parseError) {
      console.warn("Failed to parse OpenAI comparables response:", parseError);
      return { 
        comparables: this.generateSyntheticComparables(vessel),
        aiStatus: 'error' 
      };
    }
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

  private generateSyntheticComparables(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): AIComparable[] {
    // Generate basic synthetic comparables when AI fails
    const baseValue = (vessel.loaFt || 35) * 3000;
    
    return [
      {
        title: `${vessel.year || 2020} ${vessel.brand} ${vessel.model || 'Similar Model'}`,
        ask: Math.round(baseValue * (0.95 + Math.random() * 0.1)),
        year: vessel.year || 2020,
        loa: vessel.loaFt || 35,
        region: 'Florida',
        brand: vessel.brand,
        model: vessel.model || 'Similar Model',
        fuel_type: vessel.fuelType || 'gas'
      },
      {
        title: `${(vessel.year || 2020) - 1} ${vessel.brand} Comparable`,
        ask: Math.round(baseValue * (0.85 + Math.random() * 0.15)),
        year: (vessel.year || 2020) - 1,
        loa: (vessel.loaFt || 35) - 1,
        region: 'California',
        brand: vessel.brand,
        model: 'Similar Model',
        fuel_type: vessel.fuelType || 'gas'
      },
      {
        title: `${(vessel.year || 2020) + 1} ${vessel.brand} Sport`,
        ask: Math.round(baseValue * (1.05 + Math.random() * 0.1)),
        year: (vessel.year || 2020) + 1,
        loa: (vessel.loaFt || 35) + 2,
        region: 'Texas',
        brand: vessel.brand,
        model: 'Sport Model',
        fuel_type: vessel.fuelType || 'gas'
      }
    ];
  }

  private generateFallbackEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">, aiStatus: 'rate_limited' | 'error'): AIEstimate {
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

    const statusMessage = aiStatus === 'rate_limited' 
      ? '⚠️ AI analysis temporarily rate-limited. Showing rules-based estimate.' 
      : '⚠️ AI analysis temporarily unavailable. Showing rules-based estimate.';

    return {
      low,
      mostLikely,
      high,
      wholesale,
      confidence: 'Medium',
      narrative: `${statusMessage} This valuation uses market analysis algorithms and vessel specifications. The ${vessel.year || 'current'} ${vessel.brand} ${vessel.model || ''} in ${vessel.condition || 'good'} condition represents solid value in today's market. Estimated using length-based pricing with adjustments for age, condition, and usage hours.`,
      comps: this.generateSyntheticComparables(vessel),
      isPremiumLead: this.determinePremiumStatus(vessel, { mostLikely }),
      aiStatus
    };
  }
}