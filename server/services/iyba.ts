import axios from 'axios';

// IYBA API Configuration
const IYBA_KEY = process.env.IYBA_KEY || "9d5aa567b7b54f0619611cf3b2415b4661ecfc94";
const IYBA_BROKER_ID = process.env.IYBA_BROKER_ID || "83692";
const BASE_URL = "https://api.yachtbroker.org";

// Cache configuration
const CACHE_TTL = 180; // seconds
const cache: Map<string, { timestamp: number; data: any[] }> = new Map();

interface IYBAListing {
  title: string;
  ask: number;
  year: number | null;
  loa: number | null;
  region: string;
  url?: string;
  brand: string;
  model: string;
  fuel_type: string;
}

interface RawIYBAItem {
  year?: number;
  vessel_year?: number;
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
  fuel?: string;
  fuel_type?: string;
}

function getCachedData(key: string): any[] | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  const now = Date.now() / 1000;
  if (now - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCachedData(key: string, data: any[]): void {
  cache.set(key, {
    timestamp: Date.now() / 1000,
    data
  });
}

function inferFuelType(item: RawIYBAItem): string {
  // Check if we have explicit fuel type data
  const fuelType = item.fuel || item.fuel_type;
  if (fuelType) {
    const fuel = fuelType.toLowerCase().trim();
    if (fuel.includes('gas') || fuel.includes('gasoline') || fuel.includes('petrol')) return 'gas';
    if (fuel.includes('diesel')) return 'diesel';
  }

  // Infer from propulsion/drive type
  const propulsion = (item.propulsion || item.drive_type || "").toLowerCase().trim();
  
  // Outboard engines are typically gas
  if (propulsion.includes('outboard')) return 'gas';
  
  // Shaft drive and IPS are typically diesel on larger boats
  if (propulsion.includes('shaft') || propulsion.includes('ips')) return 'diesel';
  
  // Pod drives and sterndrives can be either, but commonly gas on smaller boats
  if (propulsion.includes('pod') || propulsion.includes('sterndrive')) return 'gas';
  
  // Default to unknown if we can't determine
  return 'unknown';
}

function normalizeItem(item: RawIYBAItem): IYBAListing {
  const year = item.year || item.vessel_year;
  const brand = item.brand || item.make || "";
  const model = item.model || "";
  const price = item.price || item.ask || item.list_price || 0;
  const loa = item.length_ft || item.loa || item.length;
  const region = item.location || item.region || item.state || item.country || "";
  const url = item.url || item.detail_url || item.permalink;
  const title = `${year || ''} ${brand} ${model}`.trim();

  return {
    title,
    ask: parseInt(String(price)) || 0,
    year: year ? parseInt(String(year)) : null,
    loa: loa ? parseInt(String(loa)) : null,
    region,
    url,
    brand: brand.trim(),
    model: model.trim(),
    fuel_type: inferFuelType(item)
  };
}

async function fetchFullSpecs(params: Record<string, any> = {}): Promise<IYBAListing[]> {
  const url = `${BASE_URL}/listings`;
  
  // Base parameters for Full Specs JSON API
  const queryParams = {
    key: IYBA_KEY,
    id: IYBA_BROKER_ID,
    gallery: "true",
    engines: "true",
    generators: "true",
    textblocks: "true",
    media: "true",
    status: "On,Under Contract",
    ...Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value != null)
    )
  };

  // Create cache key
  const cacheKey = url + "|" + Object.entries(queryParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await axios.get(url, {
      params: queryParams,
      timeout: 15000
    });

    const data = response.data;
    const items = data.results || data.data || (Array.isArray(data) ? data : []);
    
    const normalized = items
      .filter((item: any) => typeof item === 'object' && item !== null)
      .map((item: RawIYBAItem) => normalizeItem(item))
      .filter((item: IYBAListing) => item.ask > 0 && item.year !== null);

    setCachedData(cacheKey, normalized);
    return normalized;
    
  } catch (error) {
    console.error("IYBA fetch error:", error);
    return [];
  }
}

export async function searchComparableBoats(
  brand?: string,
  model?: string,
  year?: number,
  fuelType?: string,
  limit: number = 8
): Promise<IYBAListing[]> {
  try {
    // Fetch broad dataset first
    const allListings = await fetchFullSpecs({});
    
    if (!allListings.length) {
      return [];
    }

    // Filter client-side for better matching
    const filteredListings = allListings.filter(listing => {
      // Brand matching
      if (brand && !listing.brand.toLowerCase().includes(brand.toLowerCase())) {
        return false;
      }

      // Model matching
      if (model && !listing.model.toLowerCase().includes(model.toLowerCase())) {
        return false;
      }

      // Year matching (within 3 years)
      if (year && listing.year && Math.abs(listing.year - year) > 3) {
        return false;
      }

      // Fuel type matching
      if (fuelType) {
        const fuelTypeLower = fuelType.toLowerCase();
        const listingFuel = listing.fuel_type;
        
        if (fuelTypeLower !== 'unknown' && listingFuel !== 'unknown') {
          if (listingFuel !== fuelTypeLower) {
            return false;
          }
        }
      }

      return true;
    });

    // Sort by year proximity if year is provided, then by price similarity
    if (year) {
      filteredListings.sort((a, b) => {
        const yearDiffA = Math.abs((a.year || year) - year);
        const yearDiffB = Math.abs((b.year || year) - year);
        
        if (yearDiffA !== yearDiffB) {
          return yearDiffA - yearDiffB;
        }
        
        // Secondary sort by price (ascending)
        return Math.abs(a.ask) - Math.abs(b.ask);
      });
    }

    return filteredListings.slice(0, limit);

  } catch (error) {
    console.error("searchComparableBoats error:", error);
    return [];
  }
}

export const iybaService = {
  searchComparableBoats,
  fetchFullSpecs
};