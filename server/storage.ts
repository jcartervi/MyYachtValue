import { type Lead, type InsertLead, type Vessel, type InsertVessel, type Estimate, type LeadActivity, leads, vessels, estimates, leadActivities } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Lead operations
  createLead(lead: InsertLead & { ipAddress: string; utmParams?: any }): Promise<Lead>;
  getLead(id: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string): Promise<Lead | undefined>;

  // Vessel operations
  createVessel(vessel: InsertVessel & { leadId: string }): Promise<Vessel>;
  getVessel(id: string): Promise<Vessel | undefined>;
  getVesselsByLeadId(leadId: string): Promise<Vessel[]>;

  // Estimate operations
  createEstimate(estimate: Omit<Estimate, "id" | "createdAt">): Promise<Estimate>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  getEstimateByVesselId(vesselId: string): Promise<Estimate | undefined>;

  // Activity operations
  createActivity(activity: Omit<LeadActivity, "id" | "createdAt">): Promise<LeadActivity>;
  getActivitiesByLeadId(leadId: string): Promise<LeadActivity[]>;

  // Rate limiting
  getRequestCount(ipAddress: string, timeWindow: number, customKey?: string): Promise<number>;
  incrementRequestCount(ipAddress: string, customKey?: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private requestCounts: Map<string, { count: number; timestamp: number }> = new Map(); // Keep rate limiting in memory

  async createLead(leadData: InsertLead & { ipAddress: string; utmParams?: any }): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values({
        name: leadData.name || null,
        email: leadData.email,
        phone: leadData.phone,
        smsConsent: leadData.smsConsent || false,
        city: leadData.city || null,
        zipCode: leadData.zipCode || null,
        ipAddress: leadData.ipAddress,
        utmSource: leadData.utmParams?.utm_source || null,
        utmMedium: leadData.utmParams?.utm_medium || null,
        utmCampaign: leadData.utmParams?.utm_campaign || null,
        utmTerm: leadData.utmParams?.utm_term || null,
        utmContent: leadData.utmParams?.utm_content || null,
      })
      .returning();
    return lead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || undefined;
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || undefined;
  }

  async createVessel(vesselData: InsertVessel & { leadId: string }): Promise<Vessel> {
    const [vessel] = await db
      .insert(vessels)
      .values({
        leadId: vesselData.leadId,
        makeModel: vesselData.makeModel,
        year: vesselData.year || null,
        loaFt: vesselData.loaFt || null,
        fuelType: vesselData.fuelType || null,
        condition: vesselData.condition || 'good',
        hours: vesselData.hours ?? null,
      })
      .returning();
    return vessel;
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, id));
    return vessel || undefined;
  }

  async getVesselsByLeadId(leadId: string): Promise<Vessel[]> {
    const results = await db.select().from(vessels).where(eq(vessels.leadId, leadId));
    return results;
  }

  async createEstimate(estimateData: Omit<Estimate, "id" | "createdAt">): Promise<Estimate> {
    const [estimate] = await db
      .insert(estimates)
      .values(estimateData)
      .returning();
    return estimate;
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate || undefined;
  }

  async getEstimateByVesselId(vesselId: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.vesselId, vesselId));
    return estimate || undefined;
  }

  async createActivity(activityData: Omit<LeadActivity, "id" | "createdAt">): Promise<LeadActivity> {
    const [activity] = await db
      .insert(leadActivities)
      .values(activityData)
      .returning();
    return activity;
  }

  async getActivitiesByLeadId(leadId: string): Promise<LeadActivity[]> {
    const results = await db.select().from(leadActivities).where(eq(leadActivities.leadId, leadId));
    return results;
  }

  async getRequestCount(ipAddress: string, timeWindow: number, customKey?: string): Promise<number> {
    const key = customKey || ipAddress;
    const record = this.requestCounts.get(key);
    if (!record) return 0;
    
    const now = Date.now();
    if (now - record.timestamp > timeWindow) {
      this.requestCounts.delete(key);
      return 0;
    }
    
    return record.count;
  }

  async incrementRequestCount(ipAddress: string, customKey?: string): Promise<void> {
    const key = customKey || ipAddress;
    const now = Date.now();
    const record = this.requestCounts.get(key);
    
    if (!record) {
      this.requestCounts.set(key, { count: 1, timestamp: now });
    } else {
      record.count++;
      record.timestamp = now;
    }
  }
}

export const storage = new DatabaseStorage();