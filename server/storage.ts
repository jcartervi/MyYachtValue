import { type Lead, type InsertLead, type Vessel, type InsertVessel, type Estimate, type LeadActivity } from "@shared/schema";
import { randomUUID } from "crypto";

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
  getRequestCount(ipAddress: string, timeWindow: number): Promise<number>;
  incrementRequestCount(ipAddress: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private leads: Map<string, Lead> = new Map();
  private vessels: Map<string, Vessel> = new Map();
  private estimates: Map<string, Estimate> = new Map();
  private activities: Map<string, LeadActivity> = new Map();
  private requestCounts: Map<string, { count: number; timestamp: number }> = new Map();

  async createLead(leadData: InsertLead & { ipAddress: string; utmParams?: any }): Promise<Lead> {
    const id = randomUUID();
    const now = new Date();
    const lead: Lead = {
      name: leadData.name || null,
      email: leadData.email,
      phone: leadData.phone,
      smsConsent: leadData.smsConsent || null,
      city: leadData.city || null,
      zipCode: leadData.zipCode || null,
      ipAddress: leadData.ipAddress,
      id,
      tcpaTimestamp: now,
      createdAt: now,
      utmSource: leadData.utmParams?.utm_source || null,
      utmMedium: leadData.utmParams?.utm_medium || null,
      utmCampaign: leadData.utmParams?.utm_campaign || null,
      utmTerm: leadData.utmParams?.utm_term || null,
      utmContent: leadData.utmParams?.utm_content || null,
    };
    this.leads.set(id, lead);
    return lead;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    return this.leads.get(id);
  }

  async getLeadByEmail(email: string): Promise<Lead | undefined> {
    return Array.from(this.leads.values()).find(lead => lead.email === email);
  }

  async createVessel(vesselData: InsertVessel & { leadId: string }): Promise<Vessel> {
    const id = randomUUID();
    const vessel: Vessel = {
      brand: vesselData.brand,
      model: vesselData.model || null,
      year: vesselData.year || null,
      loaFt: vesselData.loaFt || null,
      engineType: vesselData.engineType || null,
      horsepower: vesselData.horsepower || null,
      hours: vesselData.hours || null,
      gyro: vesselData.gyro || null,
      refitYear: vesselData.refitYear || null,
      region: vesselData.region || null,
      leadId: vesselData.leadId,
      id,
      createdAt: new Date(),
    };
    this.vessels.set(id, vessel);
    return vessel;
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    return this.vessels.get(id);
  }

  async getVesselsByLeadId(leadId: string): Promise<Vessel[]> {
    return Array.from(this.vessels.values()).filter(vessel => vessel.leadId === leadId);
  }

  async createEstimate(estimateData: Omit<Estimate, "id" | "createdAt">): Promise<Estimate> {
    const id = randomUUID();
    const estimate: Estimate = {
      ...estimateData,
      id,
      createdAt: new Date(),
    };
    this.estimates.set(id, estimate);
    return estimate;
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    return this.estimates.get(id);
  }

  async getEstimateByVesselId(vesselId: string): Promise<Estimate | undefined> {
    return Array.from(this.estimates.values()).find(estimate => estimate.vesselId === vesselId);
  }

  async createActivity(activityData: Omit<LeadActivity, "id" | "createdAt">): Promise<LeadActivity> {
    const id = randomUUID();
    const activity: LeadActivity = {
      ...activityData,
      id,
      createdAt: new Date(),
    };
    this.activities.set(id, activity);
    return activity;
  }

  async getActivitiesByLeadId(leadId: string): Promise<LeadActivity[]> {
    return Array.from(this.activities.values()).filter(activity => activity.leadId === leadId);
  }

  async getRequestCount(ipAddress: string, timeWindow: number): Promise<number> {
    const record = this.requestCounts.get(ipAddress);
    if (!record) return 0;
    
    const now = Date.now();
    if (now - record.timestamp > timeWindow) {
      this.requestCounts.delete(ipAddress);
      return 0;
    }
    
    return record.count;
  }

  async incrementRequestCount(ipAddress: string): Promise<void> {
    const now = Date.now();
    const record = this.requestCounts.get(ipAddress);
    
    if (!record) {
      this.requestCounts.set(ipAddress, { count: 1, timestamp: now });
    } else {
      record.count++;
      record.timestamp = now;
    }
  }
}

export const storage = new MemStorage();
