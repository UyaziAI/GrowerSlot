import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and, sql, gte, lte, desc, asc } from "drizzle-orm";
import { 
  tenants, growers, cultivars, slots, bookings, slotRestrictions, users,
  type Tenant, type InsertTenant, type Grower, type InsertGrower, 
  type Cultivar, type InsertCultivar, type Slot, type InsertSlot,
  type Booking, type InsertBooking, type User, type InsertUser,
  type SlotWithUsage, type BookingWithDetails
} from "@shared/schema";

export interface IStorage {
  // Auth
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  // Growers
  getGrowersByTenant(tenantId: string): Promise<Grower[]>;
  getGrower(id: string): Promise<Grower | undefined>;
  createGrower(grower: InsertGrower): Promise<Grower>;
  
  // Cultivars
  getCultivarsByTenant(tenantId: string): Promise<Cultivar[]>;
  createCultivar(cultivar: InsertCultivar): Promise<Cultivar>;
  
  // Slots
  getSlotsByDate(tenantId: string, date: string): Promise<SlotWithUsage[]>;
  getSlotsRange(tenantId: string, startDate: string, endDate: string): Promise<SlotWithUsage[]>;
  getSlot(id: string): Promise<Slot | undefined>;
  createSlot(slot: InsertSlot): Promise<Slot>;
  updateSlot(id: string, updates: Partial<Slot>): Promise<Slot>;
  bulkCreateSlots(slots: InsertSlot[]): Promise<Slot[]>;
  
  // Bookings
  createBookingTransactional(booking: InsertBooking): Promise<{ success: boolean; booking?: Booking; error?: string }>;
  getBookingsByGrower(growerId: string): Promise<BookingWithDetails[]>;
  getBookingsBySlot(slotId: string): Promise<Booking[]>;
  cancelBooking(id: string): Promise<boolean>;
  
  // Admin
  getDashboardStats(tenantId: string, date: string): Promise<{
    totalSlots: number;
    availableSlots: number;
    bookedSlots: number;
    blackoutSlots: number;
    totalCapacity: number;
    bookedCapacity: number;
  }>;
  
  // CSV Export
  getBookingsForExport(params: {
    tenantId: string;
    startDate: string;
    endDate: string;
    growerId?: string;
    cultivarId?: string;
    status?: string;
  }): Promise<{
    bookingId: string;
    slotDate: string;
    startTime: string;
    endTime: string;
    growerName: string;
    cultivarName: string;
    quantity: string;
    status: string;
    notes: string;
  }[]>;
}

export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;
  private pool: Pool;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    
    this.db = drizzle(this.pool);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await this.db.insert(users).values(user).returning();
    return created;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [created] = await this.db.insert(tenants).values(tenant).returning();
    return created;
  }

  async getGrowersByTenant(tenantId: string): Promise<Grower[]> {
    return await this.db.select().from(growers).where(eq(growers.tenantId, tenantId));
  }

  async getGrower(id: string): Promise<Grower | undefined> {
    const [grower] = await this.db.select().from(growers).where(eq(growers.id, id)).limit(1);
    return grower;
  }

  async createGrower(grower: InsertGrower): Promise<Grower> {
    const [created] = await this.db.insert(growers).values(grower).returning();
    return created;
  }

  async getCultivarsByTenant(tenantId: string): Promise<Cultivar[]> {
    return await this.db.select().from(cultivars).where(eq(cultivars.tenantId, tenantId));
  }

  async createCultivar(cultivar: InsertCultivar): Promise<Cultivar> {
    const [created] = await this.db.insert(cultivars).values(cultivar).returning();
    return created;
  }

  async getSlotsByDate(tenantId: string, date: string): Promise<SlotWithUsage[]> {
    const result = await this.db
      .select({
        id: slots.id,
        tenantId: slots.tenantId,
        date: slots.date,
        startTime: slots.startTime,
        endTime: slots.endTime,
        capacity: slots.capacity,
        resourceUnit: slots.resourceUnit,
        blackout: slots.blackout,
        notes: slots.notes,
        createdBy: slots.createdBy,
        booked: sql<number>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.quantity} END), 0)`,
        bookingCount: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'confirmed' THEN 1 END)`,
      })
      .from(slots)
      .leftJoin(bookings, eq(bookings.slotId, slots.id))
      .where(and(eq(slots.tenantId, tenantId), eq(slots.date, date)))
      .groupBy(slots.id)
      .orderBy(asc(slots.startTime));

    return result.map(row => ({
      ...row,
      remaining: Number(row.capacity) - Number(row.booked),
    }));
  }

  async getSlotsRange(tenantId: string, startDate: string, endDate: string): Promise<SlotWithUsage[]> {
    const result = await this.db
      .select({
        id: slots.id,
        tenantId: slots.tenantId,
        date: slots.date,
        startTime: slots.startTime,
        endTime: slots.endTime,
        capacity: slots.capacity,
        resourceUnit: slots.resourceUnit,
        blackout: slots.blackout,
        notes: slots.notes,
        createdBy: slots.createdBy,
        booked: sql<number>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.quantity} END), 0)`,
        bookingCount: sql<number>`COUNT(CASE WHEN ${bookings.status} = 'confirmed' THEN 1 END)`,
      })
      .from(slots)
      .leftJoin(bookings, eq(bookings.slotId, slots.id))
      .where(and(
        eq(slots.tenantId, tenantId),
        gte(slots.date, startDate),
        lte(slots.date, endDate)
      ))
      .groupBy(slots.id)
      .orderBy(asc(slots.date), asc(slots.startTime));

    return result.map(row => ({
      ...row,
      remaining: Number(row.capacity) - Number(row.booked),
    }));
  }

  async getSlot(id: string): Promise<Slot | undefined> {
    const [slot] = await this.db.select().from(slots).where(eq(slots.id, id)).limit(1);
    return slot;
  }

  async createSlot(slot: InsertSlot): Promise<Slot> {
    const [created] = await this.db.insert(slots).values(slot).returning();
    return created;
  }

  async updateSlot(id: string, updates: Partial<Slot>): Promise<Slot> {
    const [updated] = await this.db.update(slots).set(updates).where(eq(slots.id, id)).returning();
    return updated;
  }

  async bulkCreateSlots(slotList: InsertSlot[]): Promise<Slot[]> {
    return await this.db.insert(slots).values(slotList).returning();
  }

  async createBookingTransactional(booking: InsertBooking): Promise<{ success: boolean; booking?: Booking; error?: string }> {
    try {
      return await this.db.transaction(async (tx) => {
        // Lock the slot and get current capacity
        const [slotData] = await tx
          .select({
            capacity: slots.capacity,
            booked: sql<number>`COALESCE(SUM(CASE WHEN ${bookings.status} = 'confirmed' THEN ${bookings.quantity} END), 0)`,
          })
          .from(slots)
          .leftJoin(bookings, eq(bookings.slotId, slots.id))
          .where(eq(slots.id, booking.slotId))
          .groupBy(slots.id)
          .for("update");

        if (!slotData) {
          return { success: false, error: "Slot not found" };
        }

        const remaining = Number(slotData.capacity) - Number(slotData.booked);
        
        if (Number(booking.quantity) > remaining) {
          return { success: false, error: "Exceeds remaining capacity" };
        }

        // Create the booking
        const [created] = await tx.insert(bookings).values(booking).returning();
        
        return { success: true, booking: created };
      });
    } catch (error) {
      console.error("Booking transaction failed:", error);
      return { success: false, error: "Transaction failed" };
    }
  }

  async getBookingsByGrower(growerId: string): Promise<BookingWithDetails[]> {
    const results = await this.db
      .select({
        id: bookings.id,
        slotId: bookings.slotId,
        tenantId: bookings.tenantId,
        growerId: bookings.growerId,
        cultivarId: bookings.cultivarId,
        quantity: bookings.quantity,
        status: bookings.status,
        createdAt: bookings.createdAt,
        growerName: growers.name,
        cultivarName: cultivars.name,
        slotDate: slots.date,
        slotStartTime: slots.startTime,
        slotEndTime: slots.endTime,
      })
      .from(bookings)
      .innerJoin(growers, eq(bookings.growerId, growers.id))
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .leftJoin(cultivars, eq(bookings.cultivarId, cultivars.id))
      .where(eq(bookings.growerId, growerId))
      .orderBy(desc(bookings.createdAt));
      
    return results.map(result => ({
      ...result,
      cultivarName: result.cultivarName || undefined
    }));
  }

  async getBookingsBySlot(slotId: string): Promise<Booking[]> {
    return await this.db.select().from(bookings).where(eq(bookings.slotId, slotId));
  }

  async cancelBooking(id: string): Promise<boolean> {
    const result = await this.db
      .update(bookings)
      .set({ status: "cancelled" })
      .where(eq(bookings.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getDashboardStats(tenantId: string, date: string) {
    const [stats] = await this.db
      .select({
        totalSlots: sql<number>`COUNT(*)`,
        availableSlots: sql<number>`COUNT(CASE WHEN NOT ${slots.blackout} THEN 1 END)`,
        blackoutSlots: sql<number>`COUNT(CASE WHEN ${slots.blackout} THEN 1 END)`,
        totalCapacity: sql<number>`SUM(${slots.capacity})`,
      })
      .from(slots)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.date, date)));

    const [bookingStats] = await this.db
      .select({
        bookedCapacity: sql<number>`COALESCE(SUM(${bookings.quantity}), 0)`,
        bookedSlots: sql<number>`COUNT(DISTINCT ${bookings.slotId})`,
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(and(
        eq(slots.tenantId, tenantId),
        eq(slots.date, date),
        eq(bookings.status, "confirmed")
      ));

    return {
      totalSlots: Number(stats.totalSlots),
      availableSlots: Number(stats.availableSlots),
      bookedSlots: Number(bookingStats.bookedSlots),
      blackoutSlots: Number(stats.blackoutSlots),
      totalCapacity: Number(stats.totalCapacity),
      bookedCapacity: Number(bookingStats.bookedCapacity),
    };
  }
  
  async getBookingsForExport(params: {
    tenantId: string;
    startDate: string;
    endDate: string;
    growerId?: string;
    cultivarId?: string;
    status?: string;
  }) {
    let whereConditions = [
      eq(bookings.tenantId, params.tenantId),
      gte(slots.date, params.startDate),
      lte(slots.date, params.endDate)
    ];
    
    // Add optional filters
    if (params.growerId) {
      whereConditions.push(eq(bookings.growerId, params.growerId));
    }
    if (params.cultivarId) {
      whereConditions.push(eq(bookings.cultivarId, params.cultivarId));
    }
    if (params.status) {
      whereConditions.push(eq(bookings.status, params.status));
    }
    
    const results = await this.db
      .select({
        bookingId: bookings.id,
        slotDate: sql<string>`${slots.date}::text`,
        startTime: sql<string>`${slots.startTime}::text`,
        endTime: sql<string>`${slots.endTime}::text`,
        growerName: growers.name,
        cultivarName: sql<string>`COALESCE(${cultivars.name}, '')`,
        quantity: sql<string>`${bookings.quantity}::text`,
        status: bookings.status,
        notes: sql<string>`COALESCE(${slots.notes}, '')`
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .innerJoin(growers, eq(bookings.growerId, growers.id))
      .leftJoin(cultivars, eq(bookings.cultivarId, cultivars.id))
      .where(and(...whereConditions))
      .orderBy(asc(slots.date), asc(slots.startTime), asc(bookings.createdAt));
    
    return results;
  }
}

export const storage = new DbStorage();
