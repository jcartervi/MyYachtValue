interface IYBAListing {
  year?: number;
  brand?: string;
  make?: string;
  model?: string;
  price?: number;
  ask?: number;
  list_price?: number;
  length_ft?: number;
  loa?: number;
  length?: number;
  location?: string;
  region?: string;
  state?: string;
  country?: string;
  url?: string;
  detail_url?: string;
  permalink?: string;
  propulsion?: string;
  drive_type?: string;
  vessel_year?: number;
}

export interface IYBAComparable {
  title: string;
  ask: number;
  year: number | null;
  loa: number | null;
  region: string;
  url?: string;
  brand: string;
  model: string;
  engine_type: string;
}

interface IYBASearchParams {
  brand?: string;
  model?: string;
  year?: number;
  length_min?: number;
  length_max?: number;
  engine_type?: string;
  limit?: number;
}

class IYBACache {
  private cache = new Map<string, { timestamp: number; data: IYBAListing[] }>();
  private readonly TTL = 180000; // 3 minutes in milliseconds

  get(key: string): IYBAListing[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: IYBAListing[]): void {
    this.cache.set(key, {
      timestamp: Date.now(),
      data
    });
  }
}

export class IYBAService {
  private readonly baseUrl = "https://api.yachtbroker.org";
  private readonly brokerId = process.env.IYBA_BROKER_ID;
  private readonly apiKey = process.env.IYBA_KEY;
  private readonly cache = new IYBACache();

  constructor() {
    if (!this.brokerId || !this.apiKey) {
      console.warn("IYBA credentials not found. Real market data will be unavailable.");
    }
  }

  private buildQueryParams(params: Record<string, any>): Record<string, string> {
    const baseParams = {
      key: this.apiKey!,
      id: this.brokerId!,
      gallery: "true",
      engines: "true",
      generators: "true", 
      textblocks: "true",
      media: "true",
      status: "On,Under Contract"
    };

    // Add additional params, filtering out null/undefined
    const filteredParams: Record<string, string> = {};
    Object.entries({ ...baseParams, ...params }).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        filteredParams[key] = String(value);
      }
    });

    return filteredParams;
  }

  private normalizeItem(item: IYBAListing): IYBAComparable | null {
    const year = item.year || item.vessel_year;
    const brand = item.brand || item.make;
    const model = item.model;
    const price = item.price || item.ask || item.list_price || 0;
    const loa = item.length_ft || item.loa || item.length;
    const region = item.location || item.region || item.state || item.country;
    const url = item.url || item.detail_url || item.permalink;
    const title = `${year || ''} ${brand || ''} ${model || ''}`.trim();

    // Skip items without essential data
    if (!price || !year) return null;

    return {
      title,
      ask: Math.round(Number(price)),
      year: year ? Number(year) : null,
      loa: loa ? Number(loa) : null,
      region: region || "Unknown",
      url,
      brand: (brand || "").trim(),
      model: (model || "").trim(),
      engine_type: (item.propulsion || item.drive_type || "").toLowerCase()
    };
  }

  private async fetchFullSpecs(params: Record<string, any> = {}): Promise<IYBAListing[]> {
    if (!this.brokerId || !this.apiKey) {
      console.warn("IYBA credentials missing, cannot fetch listings");
      return [];
    }

    const url = `${this.baseUrl}/listings`;
    const queryParams = this.buildQueryParams(params);
    
    // Create cache key from URL and sorted params
    const cacheKey = url + "|" + Object.keys(queryParams)
      .sort()
      .map(k => `${k}=${queryParams[k]}`)
      .join("&");

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log("IYBA: Using cached data");
      return cached;
    }

    try {
      console.log("IYBA: Fetching fresh data from API...");
      
      const searchParams = new URLSearchParams(queryParams);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`${url}?${searchParams}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AI-Boat-Valuation/1.0'
        }
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IYBA API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      let items: IYBAListing[] = [];
      if (data.results) {
        items = data.results;
      } else if (data.data) {
        items = data.data;
      } else if (Array.isArray(data)) {
        items = data;
      }

      console.log(`IYBA: Fetched ${items.length} raw listings`);
      
      // Cache the results
      this.cache.set(cacheKey, items);
      
      return items;
    } catch (error) {
      console.error("IYBA API fetch error:", error);
      return [];
    }
  }

  async searchComparables(params: IYBASearchParams): Promise<IYBAComparable[]> {
    const { brand, model, year, length_min, length_max, engine_type, limit = 8 } = params;
    
    // Fetch all listings (we'll filter client-side for now)
    const rawListings = await this.fetchFullSpecs();
    
    if (rawListings.length === 0) {
      console.log("IYBA: No raw listings available");
      return [];
    }

    // Normalize and filter listings
    const comparables: IYBAComparable[] = [];
    
    for (const listing of rawListings) {
      const normalized = this.normalizeItem(listing);
      if (!normalized) continue;

      // Apply filters
      let matches = true;

      // Brand filter (case-insensitive partial match)
      if (brand && !normalized.brand.toLowerCase().includes(brand.toLowerCase())) {
        matches = false;
      }

      // Model filter (case-insensitive partial match)
      if (model && !normalized.model.toLowerCase().includes(model.toLowerCase())) {
        matches = false;
      }

      // Year filter (+/- 3 years)
      if (year && normalized.year && Math.abs(normalized.year - year) > 3) {
        matches = false;
      }

      // Length filter (15% range)
      if (length_min && normalized.loa && normalized.loa < length_min) {
        matches = false;
      }
      if (length_max && normalized.loa && normalized.loa > length_max) {
        matches = false;
      }

      // Engine type filter
      if (engine_type) {
        const targetEngine = engine_type.toLowerCase();
        const listingEngine = normalized.engine_type;
        
        if (!listingEngine.includes(targetEngine)) {
          // Allow some flexibility in engine matching
          const isShaftMatch = targetEngine.includes('shaft') && listingEngine.includes('shaft');
          const isIPSMatch = targetEngine.includes('ips') && listingEngine.includes('ips');
          const isOutboardMatch = targetEngine.includes('outboard') && listingEngine.includes('outboard');
          
          if (!isShaftMatch && !isIPSMatch && !isOutboardMatch) {
            matches = false;
          }
        }
      }

      if (matches) {
        comparables.push(normalized);
      }
    }

    console.log(`IYBA: Found ${comparables.length} matching comparables`);

    // Sort by year proximity if year was specified, otherwise by price
    if (year) {
      comparables.sort((a, b) => {
        const yearDiffA = Math.abs((a.year || year) - year);
        const yearDiffB = Math.abs((b.year || year) - year);
        if (yearDiffA !== yearDiffB) {
          return yearDiffA - yearDiffB;
        }
        return Math.abs(a.ask - b.ask);
      });
    } else {
      comparables.sort((a, b) => b.ask - a.ask); // Sort by price descending
    }

    return comparables.slice(0, limit);
  }

  async searchComparablesForVessel(
    brand: string,
    model?: string,
    year?: number,
    loaFt?: number,
    fuelType?: string
  ): Promise<IYBAComparable[]> {
    console.log(`IYBA: Searching comparables for ${year || ''} ${brand} ${model || ''} (${loaFt || '?'}ft)`);

    // Calculate length range (+/- 15%)
    let length_min: number | undefined;
    let length_max: number | undefined;
    
    if (loaFt) {
      const tolerance = loaFt * 0.15;
      length_min = loaFt - tolerance;
      length_max = loaFt + tolerance;
    }

    // Map fuel type to engine type for IYBA search
    let engine_type: string | undefined;
    if (fuelType) {
      const fuelLower = fuelType.toLowerCase();
      if (fuelLower.includes('gas') || fuelLower.includes('gasoline')) {
        engine_type = 'gas';
      } else if (fuelLower.includes('diesel')) {
        engine_type = 'diesel';
      }
    }

    return this.searchComparables({
      brand,
      model,
      year,
      length_min,
      length_max,
      engine_type,
      limit: 8
    });
  }

  async getMarketSummary(comparables: IYBAComparable[]): Promise<{
    avgPrice: number;
    medianPrice: number;
    priceRange: { min: number; max: number };
    sampleSize: number;
  }> {
    if (comparables.length === 0) {
      return {
        avgPrice: 0,
        medianPrice: 0,
        priceRange: { min: 0, max: 0 },
        sampleSize: 0
      };
    }

    const prices = comparables.map(c => c.ask).sort((a, b) => a - b);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const medianPrice = prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

    return {
      avgPrice: Math.round(avgPrice),
      medianPrice: Math.round(medianPrice),
      priceRange: {
        min: prices[0],
        max: prices[prices.length - 1]
      },
      sampleSize: comparables.length
    };
  }

  // Test endpoint for verification
  async smokeTest(): Promise<{ count: number; sample: IYBAComparable[] }> {
    console.log("IYBA: Running smoke test...");
    const comparables = await this.searchComparables({
      brand: "Sunseeker",
      year: 2019,
      engine_type: "shaft",
      limit: 5
    });

    return {
      count: comparables.length,
      sample: comparables.slice(0, 3)
    };
  }
}

// Export singleton instance
export const iybaService = new IYBAService();