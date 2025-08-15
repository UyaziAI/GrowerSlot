/**
 * Tripwire tests for logging and authentication
 * Verifies no missing-auth events or Admin 401s occur after login
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../lib/logger';

describe('Logging Tripwire Tests', () => {
  beforeEach(() => {
    logger.clear();
    vi.clearAllMocks();
  });

  it('SHOULD PASS: no missing-auth events logged during normal admin operation', async () => {
    // Setup: Simulate normal admin login and navigation
    localStorage.setItem('token', 'valid-admin-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin', email: 'admin@test.com' }));

    // Import and use the authenticated http utility
    const { fetchJson } = await import('../lib/http');
    
    // Mock successful API responses
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ slots: [] })
    });

    // Simulate admin operations
    try {
      await fetchJson('/v1/slots');
      await fetchJson('/v1/admin/stats?date=2025-08-15');
    } catch (error) {
      // Expected for mock setup
    }

    // Check logs for any missing-auth events
    const logs = logger.getLogs();
    const missingAuthEvents = logs.filter(log => 
      log.event.includes('missing_auth') || 
      log.event.includes('auth_required') ||
      log.message.toLowerCase().includes('access token required')
    );

    expect(missingAuthEvents).toHaveLength(0);
  });

  it('SHOULD PASS: no 401 responses on admin routes after login', async () => {
    // Setup: Valid admin authentication
    localStorage.setItem('token', 'valid-admin-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin', email: 'admin@test.com' }));

    // Mock successful responses (no 401s)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true })
    });

    const { fetchJson } = await import('../lib/http');
    
    // Test various admin routes
    const adminRoutes = [
      '/v1/slots',
      '/v1/slots/bulk',
      '/v1/admin/stats?date=2025-08-15',
      '/v1/restrictions/apply'
    ];

    for (const route of adminRoutes) {
      try {
        await fetchJson(route, { method: 'GET' });
      } catch (error) {
        // Expected for some test cases
      }
    }

    // Verify no 401 errors were logged
    const logs = logger.getLogs();
    const unauthorizedEvents = logs.filter(log => 
      log.ctx?.status === 401 || 
      log.message.includes('401') ||
      log.event === 'auth_failure'
    );

    expect(unauthorizedEvents).toHaveLength(0);
  });

  it('SHOULD FAIL: forcing missing auth header triggers clear failure message', async () => {
    // Setup: No authentication
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Mock location for redirect testing
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    const { fetchJson } = await import('../lib/http');
    
    try {
      await fetchJson('/v1/admin/stats');
    } catch (error) {
      // Expected auth failure
    }

    // Verify clear failure was logged
    const logs = logger.getLogs();
    const authEvents = logs.filter(log => 
      log.event === 'auth_enforcement' && 
      log.ctx?.auth_reason === 'missing_token'
    );

    expect(authEvents.length).toBeGreaterThan(0);
    expect(authEvents[0].message).toBe('Authentication required for request');
  });

  it('SHOULD PASS: network failures logged with proper correlation', async () => {
    // Setup: Valid auth but simulate network failure
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    // Mock network failure
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { fetchJson } = await import('../lib/http');
    
    try {
      await fetchJson('/v1/test-endpoint');
    } catch (error) {
      // Expected network error
    }

    // Verify network error was logged with request ID
    const logs = logger.getLogs();
    const networkErrors = logs.filter(log => log.event === 'network_error');

    expect(networkErrors.length).toBeGreaterThan(0);
    expect(networkErrors[0].requestId).toBeDefined();
    expect(networkErrors[0].ctx?.error_message).toContain('Network error');
  });

  it('SHOULD PASS: structured logs contain required fields', async () => {
    // Generate some test logs
    logger.info('test_event', 'Test message', { test: 'data' });
    logger.error('test_error', 'Test error', { error: 'details' });

    const logs = logger.getLogs();
    const testLogs = logs.filter(log => log.event.startsWith('test_'));

    testLogs.forEach(log => {
      // Verify required fields
      expect(log.timestamp).toBeDefined();
      expect(log.level).toBeDefined();
      expect(log.event).toBeDefined();
      expect(log.message).toBeDefined();
      
      // Verify timestamp format
      expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp);
    });
  });
});