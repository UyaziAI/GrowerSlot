/**
 * B17 Tests - Admin Audit Events Tests
 * Tests domain events and audit trail for admin actions
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { storage } from '../storage';
import { AuditService, AdminEventTypes, AuditActions } from '../services/audit';

// Mock storage
vi.mock('../storage');
const mockStorage = vi.mocked(storage);

describe('B17 - Admin Audit Events', () => {
  const mockAuditContext = {
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    actorType: 'user'
  };

  const mockDomainEvent = {
    id: 'event-1',
    tenantId: 'tenant-1',
    eventType: 'SLOTS_BULK_CREATED',
    aggregateId: 'tenant-1',
    aggregateType: 'slots',
    eventData: '{"operation":"bulk_create"}',
    actorId: 'admin-1',
    actorType: 'user',
    createdAt: new Date()
  };

  const mockOutboxEntry = {
    id: 'outbox-1',
    eventId: 'event-1',
    tenantId: 'tenant-1',
    eventType: 'SLOTS_BULK_CREATED',
    payload: '{"eventId":"event-1"}',
    status: 'pending' as const,
    processedAt: null,
    retryCount: '0',
    createdAt: new Date()
  };

  const mockAuditEntry = {
    id: 'audit-1',
    tenantId: 'tenant-1',
    actorId: 'admin-1',
    actorType: 'user',
    action: 'BULK_CREATE_SLOTS',
    resourceType: 'slots',
    resourceId: 'tenant-1',
    payloadSummary: 'Created 10 slots',
    eventId: 'event-1',
    createdAt: new Date()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.createDomainEvent.mockResolvedValue(mockDomainEvent);
    mockStorage.createOutboxEntry.mockResolvedValue(mockOutboxEntry);
    mockStorage.createAuditLogEntry.mockResolvedValue(mockAuditEntry);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Bulk Slots Creation Events', () => {
    it('should emit SLOTS_BULK_CREATED domain event', async () => {
      const eventData = {
        operation: 'bulk_create',
        slotCount: 10,
        dateRange: '2024-08-15 to 2024-08-20'
      };

      const eventId = await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.SLOTS_BULK_CREATED,
        'tenant-1',
        'slots',
        eventData
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        eventType: 'SLOTS_BULK_CREATED',
        aggregateId: 'tenant-1',
        aggregateType: 'slots',
        eventData: JSON.stringify(eventData),
        actorId: 'admin-1',
        actorType: 'user'
      });

      expect(eventId).toBe('event-1');
    });

    it('should create outbox entry for reliable delivery', async () => {
      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.SLOTS_BULK_CREATED,
        'tenant-1',
        'slots',
        { operation: 'bulk_create' }
      );

      expect(mockStorage.createOutboxEntry).toHaveBeenCalledWith({
        eventId: 'event-1',
        tenantId: 'tenant-1',
        eventType: 'SLOTS_BULK_CREATED',
        payload: expect.stringContaining('"eventType":"SLOTS_BULK_CREATED"'),
        status: 'pending',
        retryCount: '0'
      });
    });

    it('should log audit action for bulk slots creation', async () => {
      await AuditService.logAction(
        mockAuditContext,
        AuditActions.BULK_CREATE_SLOTS,
        'slots',
        'tenant-1',
        'Created 10 slots from 2024-08-15 to 2024-08-20'
      );

      expect(mockStorage.createAuditLogEntry).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorId: 'admin-1',
        actorType: 'user',
        action: 'BULK_CREATE_SLOTS',
        resourceType: 'slots',
        resourceId: 'tenant-1',
        payloadSummary: 'Created 10 slots from 2024-08-15 to 2024-08-20',
        eventId: undefined
      });
    });

    it('should emit combined event and audit for admin action', async () => {
      const eventData = { operation: 'bulk_create', slotCount: 5 };

      await AuditService.emitAdminEvent(
        mockAuditContext,
        AdminEventTypes.SLOTS_BULK_CREATED,
        'tenant-1',
        'slots',
        eventData,
        AuditActions.BULK_CREATE_SLOTS,
        'Created 5 slots'
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalled();
      expect(mockStorage.createOutboxEntry).toHaveBeenCalled();
      expect(mockStorage.createAuditLogEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'BULK_CREATE_SLOTS',
          payloadSummary: 'Created 5 slots',
          eventId: 'event-1'
        })
      );
    });
  });

  describe('Slot Update Events', () => {
    it('should emit SLOT_UPDATED domain event', async () => {
      const eventData = {
        operation: 'update',
        changes: { blackout: true, notes: 'Maintenance' },
        slotId: 'slot-1'
      };

      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.SLOT_UPDATED,
        'slot-1',
        'slot',
        eventData
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        eventType: 'SLOT_UPDATED',
        aggregateId: 'slot-1',
        aggregateType: 'slot',
        eventData: JSON.stringify(eventData),
        actorId: 'admin-1',
        actorType: 'user'
      });
    });

    it('should create audit log for slot blackout operation', async () => {
      await AuditService.logAction(
        mockAuditContext,
        AuditActions.UPDATE_SLOT,
        'slot',
        'slot-1',
        'Updated slot slot-1: blackout, notes'
      );

      expect(mockStorage.createAuditLogEntry).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorId: 'admin-1',
        actorType: 'user',
        action: 'UPDATE_SLOT',
        resourceType: 'slot',
        resourceId: 'slot-1',
        payloadSummary: 'Updated slot slot-1: blackout, notes',
        eventId: undefined
      });
    });
  });

  describe('Template Application Events', () => {
    it('should emit TEMPLATE_APPLIED domain event', async () => {
      const eventData = {
        operation: 'apply_template',
        templateId: 'template-1',
        dateRange: '2024-08-15 to 2024-08-20',
        results: { created: 5, updated: 3, skipped: 0 }
      };

      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.TEMPLATE_APPLIED,
        'template-1',
        'template',
        eventData
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        eventType: 'TEMPLATE_APPLIED',
        aggregateId: 'template-1',
        aggregateType: 'template',
        eventData: JSON.stringify(eventData),
        actorId: 'admin-1',
        actorType: 'user'
      });
    });

    it('should create audit log for template application', async () => {
      await AuditService.logAction(
        mockAuditContext,
        AuditActions.APPLY_TEMPLATE,
        'template',
        'template-1',
        'Applied template template-1 to 2024-08-15-2024-08-20 (5 created, 3 updated)'
      );

      expect(mockStorage.createAuditLogEntry).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorId: 'admin-1',
        actorType: 'user',
        action: 'APPLY_TEMPLATE',
        resourceType: 'template',
        resourceId: 'template-1',
        payloadSummary: 'Applied template template-1 to 2024-08-15-2024-08-20 (5 created, 3 updated)',
        eventId: undefined
      });
    });
  });

  describe('Booking Update Events', () => {
    it('should emit BOOKING_UPDATED domain event', async () => {
      const eventData = {
        operation: 'cancel',
        bookingId: 'booking-1',
        status: 'cancelled'
      };

      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.BOOKING_UPDATED,
        'booking-1',
        'booking',
        eventData
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        eventType: 'BOOKING_UPDATED',
        aggregateId: 'booking-1',
        aggregateType: 'booking',
        eventData: JSON.stringify(eventData),
        actorId: 'admin-1',
        actorType: 'user'
      });
    });

    it('should create audit log for booking cancellation', async () => {
      await AuditService.logAction(
        mockAuditContext,
        AuditActions.UPDATE_BOOKING,
        'booking',
        'booking-1',
        'Cancelled booking booking-1'
      );

      expect(mockStorage.createAuditLogEntry).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorId: 'admin-1',
        actorType: 'user',
        action: 'UPDATE_BOOKING',
        resourceType: 'booking',
        resourceId: 'booking-1',
        payloadSummary: 'Cancelled booking booking-1',
        eventId: undefined
      });
    });
  });

  describe('Event Constants', () => {
    it('should have all required admin event types', () => {
      expect(AdminEventTypes.SLOTS_BULK_CREATED).toBe('SLOTS_BULK_CREATED');
      expect(AdminEventTypes.SLOT_UPDATED).toBe('SLOT_UPDATED');
      expect(AdminEventTypes.SLOTS_BLACKED_OUT).toBe('SLOTS_BLACKED_OUT');
      expect(AdminEventTypes.TEMPLATE_APPLIED).toBe('TEMPLATE_APPLIED');
      expect(AdminEventTypes.BOOKING_UPDATED).toBe('BOOKING_UPDATED');
    });

    it('should have all required audit action types', () => {
      expect(AuditActions.BULK_CREATE_SLOTS).toBe('BULK_CREATE_SLOTS');
      expect(AuditActions.UPDATE_SLOT).toBe('UPDATE_SLOT');
      expect(AuditActions.BLACKOUT_SLOTS).toBe('BLACKOUT_SLOTS');
      expect(AuditActions.APPLY_TEMPLATE).toBe('APPLY_TEMPLATE');
      expect(AuditActions.UPDATE_BOOKING).toBe('UPDATE_BOOKING');
    });
  });

  describe('Error Handling', () => {
    it('should handle domain event creation failure', async () => {
      mockStorage.createDomainEvent.mockRejectedValue(new Error('Database error'));

      await expect(
        AuditService.emitEvent(
          mockAuditContext,
          AdminEventTypes.SLOTS_BULK_CREATED,
          'tenant-1',
          'slots',
          { operation: 'bulk_create' }
        )
      ).rejects.toThrow('Database error');
    });

    it('should not throw on audit log failure', async () => {
      mockStorage.createAuditLogEntry.mockRejectedValue(new Error('Audit error'));

      // Should not throw - audit logging should not break main flow
      await expect(
        AuditService.logAction(
          mockAuditContext,
          AuditActions.BULK_CREATE_SLOTS,
          'slots',
          'tenant-1',
          'Test summary'
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('Payload Validation', () => {
    it('should serialize event data to JSON', async () => {
      const complexEventData = {
        operation: 'bulk_create',
        metadata: {
          timestamp: '2024-08-15T10:00:00Z',
          user: { id: 'admin-1', name: 'Admin User' }
        },
        results: [1, 2, 3]
      };

      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.SLOTS_BULK_CREATED,
        'tenant-1',
        'slots',
        complexEventData
      );

      expect(mockStorage.createDomainEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: JSON.stringify(complexEventData)
        })
      );
    });

    it('should create valid outbox payload structure', async () => {
      await AuditService.emitEvent(
        mockAuditContext,
        AdminEventTypes.SLOT_UPDATED,
        'slot-1',
        'slot',
        { operation: 'update' }
      );

      expect(mockStorage.createOutboxEntry).toHaveBeenCalledWith({
        eventId: 'event-1',
        tenantId: 'tenant-1',
        eventType: 'SLOT_UPDATED',
        payload: expect.stringContaining('"aggregateId":"slot-1"'),
        status: 'pending',
        retryCount: '0'
      });

      // Verify payload is valid JSON
      const call = mockStorage.createOutboxEntry.mock.calls[0][0];
      expect(() => JSON.parse(call.payload)).not.toThrow();
    });
  });
});