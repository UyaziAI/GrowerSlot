/**
 * Comprehensive tripwire test to detect recurring admin errors
 * This test MUST fail if the specific patterns identified in the logs reappear
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger } from '../lib/logger';

describe('Admin Errors Tripwire - Recurring Pattern Detection', () => {
  let fetchSpy: any;
  let originalFetch: any;
  let requestLog: Array<{ url: string; method: string; hasAuth: boolean; requestId: string }> = [];

  beforeEach(() => {
    logger.clear();
    requestLog = [];
    
    // Store original fetch
    originalFetch = global.fetch;
    
    // Mock fetch to capture all requests and detect patterns
    fetchSpy = vi.fn().mockImplementation((url: string, options: RequestInit = {}) => {
      const authHeader = options.headers && 
        (options.headers as Record<string, string>).Authorization;
      const requestId = (options.headers as Record<string, string>)?.['X-Request-ID'] || 'no-id';
      
      // Log every request for pattern analysis
      requestLog.push({
        url,
        method: options.method || 'GET',
        hasAuth: !!authHeader,
        requestId
      });

      logger.info('fetch_intercept', `${options.method || 'GET'} ${url}`, {
        url,
        method: options.method || 'GET',
        has_auth_header: !!authHeader,
        request_id: requestId
      });

      // Simulate 401 for unauthenticated /v1/ requests (the bug pattern)
      if (url.includes('/v1/') && !authHeader) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: 'Access token required' })
        });
      }

      // Simulate success for authenticated requests
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ slots: [], bookings: [], message: 'success' })
      });
    });

    global.fetch = fetchSpy;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('TRIPWIRE PATTERN 1: No repeated GET /v1/slots 401 errors (30s polling issue)', async () => {
    // Setup: Valid admin authentication
    localStorage.setItem('token', 'valid-admin-token-pattern1');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'admin', 
      email: 'admin@test.com'
    }));

    // Test the specific pattern: useSlotsRange polling via slotsApi
    const { slotsApi } = await import('../api/endpoints');
    
    // Simulate multiple polling requests (like 30s interval)
    try {
      await slotsApi.getSlotsRange('2025-08-01', '2025-08-31');
      await slotsApi.getSlotsRange('2025-08-01', '2025-08-31');
      await slotsApi.getSlotsRange('2025-08-01', '2025-08-31');
    } catch (error) {
      // Expected for mock setup
    }

    // Analyze the requests for the specific pattern
    const slotsRequests = requestLog.filter(req => 
      req.url.includes('/v1/slots') && 
      req.method === 'GET'
    );
    
    const unauthenticatedSlotsRequests = slotsRequests.filter(req => !req.hasAuth);

    // TRIPWIRE: This specific pattern (repeated GET /v1/slots without auth) MUST NOT occur
    expect(unauthenticatedSlotsRequests).toHaveLength(0);
    
    if (unauthenticatedSlotsRequests.length > 0) {
      console.error('TRIPWIRE FAILURE - PATTERN 1: Repeated unauthenticated GET /v1/slots detected');
      console.error('Request IDs:', unauthenticatedSlotsRequests.map(req => req.requestId));
    }
  });

  it('TRIPWIRE PATTERN 2: No POST /v1/restrictions/apply 401 errors', async () => {
    // Setup: Valid admin authentication
    localStorage.setItem('token', 'valid-admin-token-pattern2');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'admin', 
      email: 'admin@test.com'
    }));

    // Test the specific restriction apply pattern
    const { restrictionsApi } = await import('../api/endpoints');
    
    try {
      await restrictionsApi.applyRestrictions({
        date_scope: ['2025-08-15'],
        restrictions: { growers: ['test-grower'] }
      });
    } catch (error) {
      // Expected for mock setup
    }

    // Analyze the requests for this specific pattern
    const restrictionRequests = requestLog.filter(req => 
      req.url.includes('/v1/restrictions/apply') && 
      req.method === 'POST'
    );
    
    const unauthenticatedRestrictionRequests = restrictionRequests.filter(req => !req.hasAuth);

    // TRIPWIRE: This specific pattern (POST /v1/restrictions/apply without auth) MUST NOT occur
    expect(unauthenticatedRestrictionRequests).toHaveLength(0);
    
    if (unauthenticatedRestrictionRequests.length > 0) {
      console.error('TRIPWIRE FAILURE - PATTERN 2: Unauthenticated POST /v1/restrictions/apply detected');
      console.error('Request IDs:', unauthenticatedRestrictionRequests.map(req => req.requestId));
    }
  });

  it('TRIPWIRE: Both API clients (lib/api.ts and api/client.ts) now use authentication', async () => {
    // Setup: Valid authentication
    localStorage.setItem('token', 'dual-client-test-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    // Test both API clients
    const { api } = await import('../lib/api');
    const { slotsApi, restrictionsApi } = await import('../api/endpoints');
    
    try {
      // lib/api.ts client
      await api.getSlots('2025-08-15');
      
      // api/client.ts client (via endpoints)
      await slotsApi.getSlots('2025-08-15');
      await restrictionsApi.applyRestrictions({ test: true });
    } catch (error) {
      // Expected for mock setup
    }

    // Verify ALL requests have auth headers
    const allV1Requests = requestLog.filter(req => req.url.includes('/v1/'));
    const unauthenticatedV1Requests = allV1Requests.filter(req => !req.hasAuth);

    // TRIPWIRE: NO /v1/ requests should be unauthenticated with either client
    expect(unauthenticatedV1Requests).toHaveLength(0);
    
    if (unauthenticatedV1Requests.length > 0) {
      console.error('TRIPWIRE FAILURE: API client bypass detected');
      console.error('Unauthenticated requests:', unauthenticatedV1Requests);
    }
  });

  it('TRIPWIRE: Forcing the old patterns should trigger clear auth enforcement', async () => {
    // Setup: No authentication (simulating the old broken state)
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Mock redirect for enforceAuthentication
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    // Test the patterns that used to fail
    const { slotsApi, restrictionsApi } = await import('../api/endpoints');
    
    let authEnforcementCount = 0;
    try {
      await slotsApi.getSlotsRange('2025-08-01', '2025-08-31');
    } catch (error: any) {
      if (error.message === 'Authentication required') authEnforcementCount++;
    }
    
    try {
      await restrictionsApi.applyRestrictions({ test: true });
    } catch (error: any) {
      if (error.message === 'Authentication required') authEnforcementCount++;
    }

    // Verify authentication enforcement triggered for both patterns
    expect(authEnforcementCount).toBeGreaterThan(0);
    expect(mockLocation.href).toBe('/login');

    // Verify the enforcement was logged
    const logs = logger.getLogs();
    const authEvents = logs.filter(log => 
      log.event === 'auth_enforcement' && 
      log.ctx?.auth_reason === 'missing_token'
    );

    expect(authEvents.length).toBeGreaterThan(0);
  });
});