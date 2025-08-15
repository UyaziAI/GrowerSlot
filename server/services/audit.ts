/**
 * Audit Service - Domain Events and Audit Trail for Admin Actions
 * Implements the domain events + outbox pattern for reliable event delivery
 */
import { storage } from "../storage";
import { InsertDomainEvent, InsertOutboxEntry, InsertAuditLogEntry } from "@shared/schema";

export interface EventPayload {
  [key: string]: any;
}

export interface AuditContext {
  tenantId: string;
  actorId: string;
  actorType?: string;
}

export class AuditService {
  /**
   * Emit a domain event with outbox entry for reliable delivery
   */
  static async emitEvent(
    context: AuditContext,
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    eventData: EventPayload
  ): Promise<string> {
    try {
      // Create domain event
      const domainEvent: InsertDomainEvent = {
        tenantId: context.tenantId,
        eventType,
        aggregateId,
        aggregateType,
        eventData: JSON.stringify(eventData),
        actorId: context.actorId,
        actorType: context.actorType || 'user'
      };

      const event = await storage.createDomainEvent(domainEvent);

      // Create outbox entry for reliable delivery
      const outboxEntry: InsertOutboxEntry = {
        eventId: event.id,
        tenantId: context.tenantId,
        eventType,
        payload: JSON.stringify({
          eventId: event.id,
          eventType,
          aggregateId,
          aggregateType,
          eventData,
          timestamp: new Date().toISOString()
        }),
        status: 'pending',
        retryCount: "0"
      };

      await storage.createOutboxEntry(outboxEntry);

      console.log(`Domain event emitted: ${eventType} for ${aggregateType}:${aggregateId}`);
      return event.id;

    } catch (error) {
      console.error('Failed to emit domain event:', error);
      throw error;
    }
  }

  /**
   * Log an audit action (admin operations tracking)
   */
  static async logAction(
    context: AuditContext,
    action: string,
    resourceType: string,
    resourceId: string | null,
    payloadSummary: string,
    eventId?: string
  ): Promise<void> {
    try {
      const auditEntry: InsertAuditLogEntry = {
        tenantId: context.tenantId,
        actorId: context.actorId,
        actorType: context.actorType || 'user',
        action,
        resourceType,
        resourceId: resourceId || undefined,
        payloadSummary,
        eventId: eventId || undefined
      };

      await storage.createAuditLogEntry(auditEntry);

      console.log(`Audit logged: ${action} on ${resourceType} by ${context.actorId}`);

    } catch (error) {
      console.error('Failed to log audit action:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Combined emit event + log audit for admin actions
   */
  static async emitAdminEvent(
    context: AuditContext,
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    eventData: EventPayload,
    auditAction: string,
    auditSummary: string
  ): Promise<string> {
    const eventId = await this.emitEvent(context, eventType, aggregateId, aggregateType, eventData);
    
    await this.logAction(
      context,
      auditAction,
      aggregateType,
      aggregateId,
      auditSummary,
      eventId
    );

    return eventId;
  }
}

// Event type constants for admin actions
export const AdminEventTypes = {
  SLOTS_BULK_CREATED: 'SLOTS_BULK_CREATED',
  SLOT_UPDATED: 'SLOT_UPDATED',
  SLOTS_BLACKED_OUT: 'SLOTS_BLACKED_OUT',
  TEMPLATE_APPLIED: 'TEMPLATE_APPLIED',
  BOOKING_UPDATED: 'BOOKING_UPDATED',
} as const;

// Audit action constants
export const AuditActions = {
  BULK_CREATE_SLOTS: 'BULK_CREATE_SLOTS',
  UPDATE_SLOT: 'UPDATE_SLOT',
  BLACKOUT_SLOTS: 'BLACKOUT_SLOTS',
  APPLY_TEMPLATE: 'APPLY_TEMPLATE',
  UPDATE_BOOKING: 'UPDATE_BOOKING',
} as const;