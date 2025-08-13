import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, numeric, boolean, date, time, timestamptz, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tenants (packhouses)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  timezone: text("timezone").default("Africa/Johannesburg"),
  createdAt: timestamptz("created_at").default(sql`now()`),
});

// Growers
export const growers = pgTable("growers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contact: text("contact"),
  email: text("email"),
  role: text("role").notNull().default("grower"), // grower, admin
}, (table) => ({
  tenantNameIdx: index("growers_tenant_name_idx").on(table.tenantId, table.name),
}));

// Cultivars
export const cultivars = pgTable("cultivars", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

// Slots (capacity per window)
export const slots = pgTable("slots", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  capacity: numeric("capacity", { precision: 10, scale: 2 }).notNull(),
  resourceUnit: text("resource_unit").default("tons"),
  blackout: boolean("blackout").default(false),
  notes: text("notes"),
  createdBy: uuid("created_by"),
}, (table) => ({
  tenantDateIdx: index("slots_tenant_date_idx").on(table.tenantId, table.date),
}));

// Restrictions (optional)
export const slotRestrictions = pgTable("slot_restrictions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: uuid("slot_id").notNull().references(() => slots.id, { onDelete: "cascade" }),
  allowedGrowerId: uuid("allowed_grower_id").references(() => growers.id),
  allowedCultivarId: uuid("allowed_cultivar_id").references(() => cultivars.id),
}, (table) => ({
  slotIdx: index("slot_restrictions_slot_idx").on(table.slotId),
}));

// Bookings
export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: uuid("slot_id").notNull().references(() => slots.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  growerId: uuid("grower_id").notNull().references(() => growers.id),
  cultivarId: uuid("cultivar_id").references(() => cultivars.id),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("confirmed"), // confirmed/cancelled
  createdAt: timestamptz("created_at").default(sql`now()`),
}, (table) => ({
  slotIdx: index("bookings_slot_idx").on(table.slotId),
  tenantIdx: index("bookings_tenant_idx").on(table.tenantId),
}));

// Users for authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  growerId: uuid("grower_id").references(() => growers.id),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  role: text("role").notNull().default("grower"), // grower, admin
});

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true });
export const insertGrowerSchema = createInsertSchema(growers).omit({ id: true });
export const insertCultivarSchema = createInsertSchema(cultivars).omit({ id: true });
export const insertSlotSchema = createInsertSchema(slots).omit({ id: true });
export const insertSlotRestrictionSchema = createInsertSchema(slotRestrictions).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Grower = typeof growers.$inferSelect;
export type InsertGrower = z.infer<typeof insertGrowerSchema>;
export type Cultivar = typeof cultivars.$inferSelect;
export type InsertCultivar = z.infer<typeof insertCultivarSchema>;
export type Slot = typeof slots.$inferSelect;
export type InsertSlot = z.infer<typeof insertSlotSchema>;
export type SlotRestriction = typeof slotRestrictions.$inferSelect;
export type InsertSlotRestriction = z.infer<typeof insertSlotRestrictionSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Extended types for API responses
export type SlotWithUsage = Slot & {
  booked: number;
  remaining: number;
  bookingCount: number;
  restrictions?: {
    growers: string[];
    cultivars: string[];
  };
};

export type BookingWithDetails = Booking & {
  growerName: string;
  cultivarName?: string;
  slotDate: string;
  slotStartTime: string;
  slotEndTime: string;
};
