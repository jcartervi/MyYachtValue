import { Vessel } from "@shared/schema";
import { callOpenAI, callOpenAIResponses, AIResponse } from "../utils/ai-utils";
import { iybaService, IYBAComparable } from "./iyba-api";

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

// Type to track data source
export interface MarketDataSummary {
  realComparables: number;
  syntheticComparables: number;
  iybaStatus: 'success' | 'partial' | 'failed';
  dataSource: 'iyba' | 'synthetic' | 'mixed';
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
  marketData?: MarketDataSummary;
}

export class AIEstimatorService {
  async generateEstimate(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<AIEstimate> {
    // Get real market data from IYBA first
    const marketDataResult = await this.getMarketData(vessel);
    
    // Try AI estimation with real market data
    const valuationResult = await this.generateAIValuation(vessel, marketDataResult);
    
    if (valuationResult.aiStatus === 'ok') {
      return {
        ...valuationResult,
        comps: marketDataResult.comparables,
        isPremiumLead: this.determinePremiumStatus(vessel, valuationResult),
        aiStatus: 'ok',
        marketData: marketDataResult.summary
      };
    } else {
      // AI failed, use fallback but preserve the status
      console.warn(`AI estimation failed with status: ${valuationResult.aiStatus}`);
      return this.generateFallbackEstimate(vessel, valuationResult.aiStatus, marketDataResult);
    }
  }

  private async getMarketData(vessel: Omit<Vessel, "id" | "leadId" | "createdAt">): Promise<{
    comparables: AIComparable[];
    summary: MarketDataSummary;
  }> {
    console.log(`Getting market data for ${vessel.year || ''} ${vessel.brand} ${vessel.model || ''} (${vessel.loaFt || '?'}ft)`);
    
    try {
      // Get real comparable sales from IYBA
      const iybaComparables = await iybaService.searchComparablesForVessel(
        vessel.brand,
        vessel.model || undefined,
        vessel.year || undefined,
        vessel.loaFt || undefined,
        vessel.fuelType || undefined
      );
      
      console.log(`IYBA returned ${iybaComparables.length} real comparables`);
      
      // Convert IYBA comparables to AIComparable format
      const realComparables: AIComparable[] = iybaComparables.map((comp: IYBAComparable) => ({
        title: comp.title,
        ask: comp.ask,
        year: comp.year || 0,
        loa: comp.loa || 0,
        region: comp.region,
        brand: comp.brand,
        model: comp.model,
        fuel_type: comp.engine_type || 'unknown'
      }));
      
      let allComparables = realComparables;
      let summary: MarketDataSummary;
      
      if (realComparables.length >= 3) {
        // We have enough real data
        summary = {
          realComparables: realComparables.length,
          syntheticComparables: 0,
          iybaStatus: 'success',
          dataSource: 'iyba'
        };
      } else if (realComparables.length > 0) {
        // Mix real data with synthetic to get enough comparables
        const syntheticComparables = this.generateSyntheticComparables(vessel);
        allComparables = [...realComparables, ...syntheticComparables.slice(0, 8 - realComparables.length)];
        
        summary = {
          realComparables: realComparables.length,
          syntheticComparables: 8 - realComparables.length,
          iybaStatus: 'partial',
          dataSource: 'mixed'
        };
      } else {
        // No real data available, use synthetic
        allComparables = this.generateSyntheticComparables(vessel);
        
        summary = {
          realComparables: 0,
          syntheticComparables: allComparables.length,
          iybaStatus: 'failed',
          dataSource: 'synthetic'
        };
      }
      
      return {
        comparables: allComparables,
        summary
      };
    } catch (error) {
      console.error('Error fetching IYBA market data:', error);
      
      // Fallback to synthetic data
      const syntheticComparables = this.generateSyntheticComparables(vessel);
      
      return {
        comparables: syntheticComparables,
        summary: {
          realComparables: 0,
          syntheticComparables: syntheticComparables.length,
          iybaStatus: 'failed',
          dataSource: 'synthetic'
        }
      };
    }
  }

  private async generateAIValuation(
    vessel: Omit<Vessel, "id" | "leadId" | "createdAt">,
    marketData: { comparables: AIComparable[]; summary: MarketDataSummary }
  ): Promise<{
    low: number;
    mostLikely: number;
    high: number;
    wholesale: number;
    confidence: "Low" | "Medium" | "High";
    narrative: string;
    aiStatus: 'ok' | 'rate_limited' | 'error';
  }> {
    // Extract pricing from real market data if available
    const realComparables = marketData.comparables.filter(c => c.ask > 0);
    
    let marketInsights = '';
    let expectedValue = 0;
    let minValue = 0;
    let maxValue = 0;
    
    if (realComparables.length >= 2) {
      // Use real market data for pricing guidance
      const prices = realComparables.map(c => c.ask).sort((a, b) => a - b);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      const medianPrice = prices.length % 2 === 0
        ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
        : prices[Math.floor(prices.length / 2)];
      
      expectedValue = Math.round(medianPrice);
      minValue = Math.round(Math.min(...prices) * 0.9);
      maxValue = Math.round(Math.max(...prices) * 1.1);
      
      marketInsights = `\n\nREAL MARKET DATA ANALYSIS:\n`;
      marketInsights += `- Found ${realComparables.length} comparable sales in IYBA database\n`;
      marketInsights += `- Price range: $${Math.min(...prices).toLocaleString()} - $${Math.max(...prices).toLocaleString()}\n`;
      marketInsights += `- Average asking price: $${Math.round(avgPrice).toLocaleString()}\n`;
      marketInsights += `- Median asking price: $${Math.round(medianPrice).toLocaleString()}\n`;
      
      if (marketData.summary.dataSource === 'iyba') {
        marketInsights += `- Data confidence: HIGH (All real IYBA data)\n`;
      } else if (marketData.summary.dataSource === 'mixed') {
        marketInsights += `- Data confidence: MEDIUM (${marketData.summary.realComparables} real + ${marketData.summary.syntheticComparables} synthetic)\n`;
      }
    } else {
      // Fallback to traditional calculation when no real data available
      const length = vessel.loaFt || 35;
      const year = vessel.year || 2020;
      const currentYear = new Date().getFullYear();
      const age = Math.max(0, currentYear - year);
      const brand = vessel.brand?.toLowerCase() || '';
      
      let baseValue = 0;
      if (brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut') || brand.includes('ferretti') || 
          brand.includes('palmer johnson') || brand.includes('hatteras') || brand.includes('viking') || brand.includes('bertram')) {
        baseValue = length * length * 700;
      } else if (brand.includes('sea ray') || brand.includes('formula') || brand.includes('regal') || 
                 brand.includes('scout') || brand.includes('boston whaler') || brand.includes('grady-white') || 
                 brand.includes('pursuit') || brand.includes('jupiter') || brand.includes('yellowfin')) {
        baseValue = length * 5000;
      } else {
        baseValue = length * 3000;
      }
      
      const luxuryBrand = brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut') || brand.includes('ferretti') ||
                          brand.includes('palmer johnson') || brand.includes('hatteras') || brand.includes('viking') || brand.includes('bertram');
      
      let yearFactor;
      if (luxuryBrand) {
        yearFactor = Math.max(0.18, 0.85 * Math.exp(-0.06 * age) + 0.10);
      } else {
        yearFactor = Math.max(0.15, 1 - (age * 0.12));
      }
      
      expectedValue = Math.round(baseValue * yearFactor);
      
      if (length >= 70 && age >= 25) {
        expectedValue = Math.round(expectedValue * 0.9);
      }
      
      minValue = Math.round(expectedValue * 0.7);
      maxValue = Math.round(expectedValue * 1.3);
      
      marketInsights = '\n\nNOTE: Using algorithmic pricing due to limited real market data availability.\n';
    }

    const dataSource = marketData.summary.dataSource === 'iyba' ? 'IYBA real market data' :
                      marketData.summary.dataSource === 'mixed' ? 'IYBA real market data supplemented with market analysis' :
                      'algorithmic market analysis';
    
    const prompt = `You are a professional marine surveyor and yacht broker with 20+ years of experience specializing in vessel valuations.
    
    Provide a detailed valuation for this vessel:
    - Brand: ${vessel.brand}
    - Model: ${vessel.model || 'Unknown'}
    - Year: ${vessel.year || 'Unknown'}
    - Length: ${vessel.loaFt || 'Unknown'}ft
    - Fuel Type: ${vessel.fuelType || 'Unknown'}
    - Hours: ${vessel.hours || 'Unknown'}
    - Condition: ${vessel.condition || 'Average'}
    
    MARKET DATA ANALYSIS: ${dataSource}
    ${marketInsights}
    
    Based on this analysis, expected value range is $${minValue.toLocaleString()} - $${maxValue.toLocaleString()}
    Most likely value: $${expectedValue.toLocaleString()}
    
    Respond with JSON in this exact format:
    {
      "low": ${minValue},
      "mostLikely": ${expectedValue},
      "high": ${maxValue},
      "wholesale": ${Math.round(expectedValue * 0.8)},
      "confidence": "${marketData.summary.dataSource === 'iyba' ? 'High' : marketData.summary.dataSource === 'mixed' ? 'Medium' : 'Medium'}",
      "narrative": "Professional valuation based on ${dataSource} and vessel specifications"
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

  // Legacy method - now deprecated since we get real comparables from IYBA
  // Keeping for fallback scenarios only

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
    // Generate realistic synthetic comparables based on vessel type
    const length = vessel.loaFt || 35;
    const brand = vessel.brand?.toLowerCase() || '';
    const luxuryBrand = brand.includes('sunseeker') || brand.includes('princess') || brand.includes('azimut') || brand.includes('ferretti') ||
                        brand.includes('palmer johnson') || brand.includes('hatteras') || brand.includes('viking') || brand.includes('bertram');

    // Base price calculation mirrors main valuation/comparables
    let baseValue = 0;
    const year = vessel.year || 2020;
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - year);
    if (luxuryBrand) {
      baseValue = length * length * 700; // luxury brands baseline
      const yearFactor = Math.max(0.18, 0.85 * Math.exp(-0.06 * age) + 0.10);
      baseValue = Math.round(baseValue * yearFactor);
      if (length >= 70 && age >= 25) {
        baseValue = Math.round(baseValue * 0.9); // vintage penalty
      }
    } else if (brand.includes('sea ray') || brand.includes('formula') || 
               brand.includes('scout') || brand.includes('boston whaler') || brand.includes('grady-white') ||
               brand.includes('pursuit') || brand.includes('jupiter') || brand.includes('yellowfin')) {
      baseValue = length * 5000;
    } else {
      baseValue = length * 2500;
    }
    
    
    return [
      {
        title: `${vessel.year || 2020} ${vessel.brand} ${vessel.model || 'Similar Model'}`,
        ask: Math.round(baseValue * (0.95 + Math.random() * 0.1)),
        year: vessel.year || 2020,
        loa: vessel.loaFt || 35,
        region: 'Florida',
        brand: vessel.brand,
        model: vessel.model || 'Similar Model',
        fuel_type: vessel.fuelType || 'diesel'
      },
      {
        title: `${(vessel.year || 2020) - 1} ${luxuryBrand ? 'Princess' : vessel.brand} Comparable`,
        ask: Math.round(baseValue * (0.85 + Math.random() * 0.15)),
        year: (vessel.year || 2020) - 1,
        loa: (vessel.loaFt || 35) - 2,
        region: 'California',
        brand: luxuryBrand ? 'Princess' : vessel.brand,
        model: luxuryBrand ? 'Motor Yacht' : 'Similar Model',
        fuel_type: vessel.fuelType || 'diesel'
      },
      {
        title: `${(vessel.year || 2020) + 1} ${luxuryBrand ? 'Azimut' : vessel.brand} Sport`,
        ask: Math.round(baseValue * (1.05 + Math.random() * 0.1)),
        year: (vessel.year || 2020) + 1,
        loa: (vessel.loaFt || 35) + 1,
        region: 'Texas',
        brand: luxuryBrand ? 'Azimut' : vessel.brand,
        model: luxuryBrand ? 'Flybridge' : 'Sport Model',
        fuel_type: vessel.fuelType || 'diesel'
      }
    ];
  }

  private generateFallbackEstimate(
    vessel: Omit<Vessel, "id" | "leadId" | "createdAt">,
    aiStatus: 'rate_limited' | 'error',
    marketData?: { comparables: AIComparable[]; summary: MarketDataSummary }
  ): AIEstimate {
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
      comps: marketData?.comparables || this.generateSyntheticComparables(vessel),
      marketData: marketData?.summary,
      isPremiumLead: this.determinePremiumStatus(vessel, { mostLikely }),
      aiStatus
    };
  }
}