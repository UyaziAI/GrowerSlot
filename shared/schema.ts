import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, numeric, boolean, date, time, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tenants (packhouses)
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  timezone: text("timezone").default("Africa/Johannesburg"),
  createdAt: timestamp("created_at").default(sql`now()`),
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
  createdAt: timestamp("created_at").default(sql`now()`),
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

// Domain Events
export const domainEvents = pgTable("domain_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  eventData: text("event_data").notNull(), // JSON string
  actorId: uuid("actor_id"),
  actorType: text("actor_type"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  tenantEventTypeIdx: index("domain_events_tenant_event_type_idx").on(table.tenantId, table.eventType),
  aggregateIdx: index("domain_events_aggregate_idx").on(table.aggregateId, table.aggregateType),
}));

// Outbox Pattern
export const outbox = pgTable("outbox", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: uuid("event_id").notNull().references(() => domainEvents.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: text("payload").notNull(), // JSON string
  status: text("status").notNull().default("pending"), // pending/processed/failed
  processedAt: timestamp("processed_at"),
  retryCount: numeric("retry_count").default("0"),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  statusIdx: index("outbox_status_idx").on(table.status),
  tenantIdx: index("outbox_tenant_idx").on(table.tenantId),
}));

// Audit Log
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").notNull(),
  actorType: text("actor_type").notNull().default("user"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  payloadSummary: text("payload_summary"), // Brief description/summary
  eventId: uuid("event_id").references(() => domainEvents.id),
  createdAt: timestamp("created_at").default(sql`now()`),
}, (table) => ({
  tenantActorIdx: index("audit_log_tenant_actor_idx").on(table.tenantId, table.actorId),
  resourceIdx: index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
}));

// Insert schemas for new tables
export const insertDomainEventSchema = createInsertSchema(domainEvents).omit({ id: true, createdAt: true });
export const insertOutboxSchema = createInsertSchema(outbox).omit({ id: true, createdAt: true, processedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });

// Types for new tables
export type DomainEvent = typeof domainEvents.$inferSelect;
export type InsertDomainEvent = z.infer<typeof insertDomainEventSchema>;
export type OutboxEntry = typeof outbox.$inferSelect;
export type InsertOutboxEntry = z.infer<typeof insertOutboxSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;

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
