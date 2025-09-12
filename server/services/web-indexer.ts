import axios from 'axios';
import * as cheerio from 'cheerio';
import { comparables, type Comparable } from '../../shared/schema';
import { callOpenAI } from '../utils/ai-utils';
import { and, eq, gte, ilike, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const USER_AGENT = 'Mozilla/5.0 (WaveBot; +https://wavemarinegroup.com)';

// Regex patterns for extracting boat data
const PRICE_RE = /(\$|USD)\s?([0-9][0-9\.,]{4,})/;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const LOA_RE = /(\d{2,3})\s?(ft|feet|'|′)/;

interface EstimateRequest {
  model: string;
  year?: number;
  loaFt?: number;
  fuelType?: string;
  brand?: string;
}

interface ScrapedData {
  url: string;
  title: string;
  ask?: number;
  year?: number;
  loa?: number;
  region?: string;
  fuelType?: string;
  source: string;
}

export class WebIndexerService {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  // Generate optimized search queries
  private generateSearchQueries(req: EstimateRequest): string[] {
    const model = req.model?.trim() || '';
    const brand = req.brand?.trim() || '';
    const extras: string[] = [];
    
    if (req.year) extras.push(String(req.year));
    if (req.loaFt) extras.push(`${req.loaFt} ft`);
    if (req.fuelType && req.fuelType !== 'unknown') extras.push(req.fuelType);

    const baseTerms = brand ? `${brand} ${model}` : model;
    const extraTerms = extras.join(' ');
    
    return [
      `${baseTerms} for sale ${extraTerms}`,
      `${baseTerms} yacht for sale ${extraTerms}`,
      `${baseTerms} boat for sale ${extraTerms}`,
      `${baseTerms} marine trader ${extraTerms}`
    ].filter(Boolean);
  }

  // Search using SerpAPI
  private async serpApiSearch(query: string, limit: number = 8): Promise<string[]> {
    if (!SERPAPI_KEY) {
      console.warn('SERPAPI_KEY not configured');
      return [];
    }

    try {
      const response = await axios.get('https://serpapi.com/search.json', {
        params: {
          engine: 'google',
          q: query,
          num: limit,
          api_key: SERPAPI_KEY,
          hl: 'en'
        },
        timeout: 12000
      });

      const urls: string[] = [];
      const results = response.data.organic_results || [];
      
      for (const result of results) {
        const url = result.link;
        if (url && url.startsWith('http')) {
          // Clean URL (remove query params and fragments)
          const cleanUrl = url.split('?')[0].split('#')[0].trim();
          urls.push(cleanUrl);
        }
      }

      return urls.slice(0, limit);
    } catch (error) {
      console.error('SerpAPI search error:', error);
      return [];
    }
  }

  // Extract data using regex patterns
  private extractRegexData(text: string): Partial<ScrapedData> {
    const data: Partial<ScrapedData> = {};

    // Extract price
    const priceMatch = text.replace(/,/g, '').match(PRICE_RE);
    if (priceMatch) {
      try {
        const priceStr = priceMatch[0].replace(/\D/g, '');
        const price = parseInt(priceStr, 10);
        if (price >= 10000 && price <= 50000000) {
          data.ask = price;
        }
      } catch (e) {
        // Ignore price extraction errors
      }
    }

    // Extract year
    const yearMatch = text.match(YEAR_RE);
    if (yearMatch) {
      try {
        const year = parseInt(yearMatch[0], 10);
        if (year >= 1950 && year <= 2035) {
          data.year = year;
        }
      } catch (e) {
        // Ignore year extraction errors
      }
    }

    // Extract length
    const loaMatch = text.toLowerCase().match(LOA_RE);
    if (loaMatch) {
      try {
        const loa = parseInt(loaMatch[1], 10);
        if (loa >= 10 && loa <= 200) {
          data.loa = loa;
        }
      } catch (e) {
        // Ignore length extraction errors
      }
    }

    return data;
  }

  // Extract data using AI when regex fails
  private async extractAIData(htmlText: string): Promise<Partial<ScrapedData>> {
    const snippet = htmlText.slice(0, 15000); // Limit text size for AI processing
    
    const prompt = `Extract boat listing fields as JSON with keys ask (int USD), year (int), loa (int feet).
If unknown, return null. Text:
<<<
${snippet}
>>>`;

    try {
      const response = await callOpenAI('gpt-4o-mini', [
        { role: 'user', content: prompt }
      ], {
        max_tokens: 200,
        temperature: 0
      });

      const content = response.text?.trim();
      if (!content) return {};

      const parsed = JSON.parse(content);
      const result: Partial<ScrapedData> = {};

      // Validate and convert extracted data
      for (const key of ['ask', 'year', 'loa']) {
        let value = parsed[key];
        if (typeof value === 'string') {
          try {
            value = parseInt(value.replace(/\D/g, ''), 10);
          } catch (e) {
            value = null;
          }
        }
        if (typeof value === 'number' && !isNaN(value)) {
          result[key as keyof ScrapedData] = value as any;
        }
      }

      return result;
    } catch (error) {
      console.error('AI extraction error:', error);
      return {};
    }
  }

  // Scrape individual URL
  private async scrapeUrl(url: string, useAI: boolean = true): Promise<ScrapedData | null> {
    try {
      const response = await axios.get(url, {
        timeout: 14000,
        headers: { 'User-Agent': USER_AGENT }
      });

      if (response.status !== 200) return null;

      const $ = cheerio.load(response.data);
      const title = $('title').text() || url;
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      // First try regex extraction
      const regexData = this.extractRegexData(text);
      
      // If regex didn't find key data, try AI
      let aiData: Partial<ScrapedData> = {};
      if (useAI && !regexData.ask && !regexData.year) {
        aiData = await this.extractAIData(text);
      }

      // Combine regex and AI data (regex takes precedence)
      const combinedData = { ...aiData, ...regexData };

      return {
        url,
        title: title.trim(),
        ask: combinedData.ask,
        year: combinedData.year,
        loa: combinedData.loa,
        region: undefined,
        fuelType: undefined,
        source: 'web'
      };
    } catch (error) {
      console.error(`Scraping error for ${url}:`, error);
      return null;
    }
  }

  // Refresh index with new data
  async refreshIndex(
    req: EstimateRequest, 
    cap: number = 18, 
    useAI: boolean = true
  ): Promise<number> {
    console.log(`Refreshing index for ${req.brand} ${req.model} ${req.year || ''} (${req.loaFt || '?'}ft)`);

    // Generate search queries
    const queries = this.generateSearchQueries(req);
    const urls: string[] = [];

    // Collect URLs from all queries
    for (const query of queries) {
      const queryUrls = await this.serpApiSearch(query, 8);
      urls.push(...queryUrls);
    }

    // Deduplicate URLs
    const uniqueUrls = Array.from(new Set(urls));
    console.log(`Found ${uniqueUrls.length} unique URLs to scrape`);

    let added = 0;
    const maxUrls = Math.min(uniqueUrls.length, cap * 2);

    for (let i = 0; i < maxUrls && added < cap; i++) {
      const url = uniqueUrls[i];
      const scrapedData = await this.scrapeUrl(url, useAI);
      
      if (!scrapedData) continue;

      // Skip if no useful data
      if (!scrapedData.ask && !scrapedData.year) continue;

      // Validate price range
      if (scrapedData.ask && (scrapedData.ask < 10000 || scrapedData.ask > 50000000)) {
        scrapedData.ask = undefined;
      }

      // Check if URL already exists
      const existing = await this.db
        .select()
        .from(comparables)
        .where(eq(comparables.url, scrapedData.url))
        .limit(1);

      if (existing.length > 0) {
        // Update existing record if we have new data
        const existingRecord = existing[0];
        const updates: Partial<Comparable> = {};
        let hasUpdates = false;

        if (scrapedData.ask && !existingRecord.ask) {
          updates.ask = scrapedData.ask;
          hasUpdates = true;
        }
        if (scrapedData.year && !existingRecord.year) {
          updates.year = scrapedData.year;
          hasUpdates = true;
        }
        if (scrapedData.loa && !existingRecord.loa) {
          updates.loa = scrapedData.loa;
          hasUpdates = true;
        }

        if (hasUpdates) {
          await this.db
            .update(comparables)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(comparables.id, existingRecord.id));
        }
        continue;
      }

      // Insert new record
      try {
        await this.db.insert(comparables).values({
          status: 'active',
          title: scrapedData.title,
          model: req.model,
          year: scrapedData.year,
          loa: scrapedData.loa,
          ask: scrapedData.ask,
          url: scrapedData.url,
          region: scrapedData.region,
          brand: req.brand,
          fuelType: scrapedData.fuelType,
          source: scrapedData.source
        });
        
        added++;
        console.log(`Added comparable: ${scrapedData.title} - $${scrapedData.ask || 'N/A'}`);
      } catch (error) {
        console.error('Error inserting comparable:', error);
      }
    }

    console.log(`Index refresh complete. Added ${added} new comparables.`);
    return added;
  }

  // Get recent indexed comparables
  async getRecentComparables(
    req: EstimateRequest,
    days: number = 14,
    limit: number = 24
  ): Promise<Comparable[]> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const conditions = [
      gte(comparables.createdAt, cutoffDate),
      ilike(comparables.model, `%${req.model}%`)
    ];

    const results = await this.db
      .select()
      .from(comparables)
      .where(and(...conditions))
      .orderBy(comparables.createdAt)
      .limit(limit * 2); // Get more than needed for filtering

    // Filter by subject closeness
    const filtered: Comparable[] = [];
    for (const comp of results) {
      // Year filter (within 3 years)
      if (req.year && comp.year && Math.abs(comp.year - req.year) > 3) continue;
      
      // Length filter (within 10% range)
      if (req.loaFt && comp.loa) {
        const minLoa = req.loaFt * 0.9;
        const maxLoa = req.loaFt * 1.1;
        if (comp.loa < minLoa || comp.loa > maxLoa) continue;
      }
      
      // Fuel type filter
      if (req.fuelType && comp.fuelType && req.fuelType.toLowerCase() !== 'unknown') {
        if (!comp.fuelType.toLowerCase().includes(req.fuelType.toLowerCase())) continue;
      }

      filtered.push(comp);
      if (filtered.length >= limit) break;
    }

    return filtered;
  }

  // Get index metrics
  async getIndexMetrics(): Promise<{ totalComparables: number; recentComparables: number }> {
    const totalResult = await this.db
      .select({ count: sql`count(*)` })
      .from(comparables);

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentResult = await this.db
      .select({ count: sql`count(*)` })
      .from(comparables)
      .where(gte(comparables.createdAt, recentCutoff));

    return {
      totalComparables: Number(totalResult[0]?.count) || 0,
      recentComparables: Number(recentResult[0]?.count) || 0
    };
  }
}