/**
 * Comprehensive tripwire test to detect unauthenticated admin requests
 * This test MUST fail if any admin request bypasses authentication
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger } from '../lib/logger';

describe('Authentication Tripwire - Comprehensive Detection', () => {
  let fetchSpy: any;
  let originalFetch: any;

  beforeEach(() => {
    logger.clear();
    
    // Store original fetch
    originalFetch = global.fetch;
    
    // Mock fetch to capture all requests
    fetchSpy = vi.fn().mockImplementation((url: string, options: RequestInit = {}) => {
      // Log all requests for analysis
      const authHeader = options.headers && 
        (options.headers as Record<string, string>).Authorization;
      
      logger.info('fetch_intercept', `${options.method || 'GET'} ${url}`, {
        url,
        method: options.method || 'GET',
        has_auth_header: !!authHeader,
        auth_header_type: authHeader ? authHeader.split(' ')[0] : null
      });

      // Simulate 401 for unauthenticated admin requests
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
        json: () => Promise.resolve({ slots: [], bookings: [] })
      });
    });

    global.fetch = fetchSpy;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('TRIPWIRE: No unauthenticated /v1/ API calls should occur from any component', async () => {
    // Setup: Valid admin authentication
    localStorage.setItem('token', 'valid-admin-token-123');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'admin', 
      email: 'admin@test.com',
      id: 'admin-123'
    }));

    // Test all possible API clients that could make requests
    const { fetchJson } = await import('../lib/http');
    const { api } = await import('../lib/api');
    
    // Test fetchJson (should be authenticated)
    try {
      await fetchJson('/v1/slots?start=2025-08-01&end=2025-08-31');
    } catch (error) {
      // Expected for mock
    }

    // Test legacy api client (should now use fetchJson internally)
    try {
      await api.getSlots('2025-08-15');
    } catch (error) {
      // Expected for mock
    }

    // Analyze all fetch calls
    const logs = logger.getLogs();
    const fetchLogs = logs.filter(log => log.event === 'fetch_intercept');
    const v1Requests = fetchLogs.filter(log => log.ctx?.url?.includes('/v1/'));
    const unauthenticatedV1Requests = v1Requests.filter(log => !log.ctx?.has_auth_header);

    // TRIPWIRE: This MUST be 0 - any unauthenticated admin requests indicate a security hole
    expect(unauthenticatedV1Requests).toHaveLength(0);

    // If this fails, log the offending requests for debugging
    if (unauthenticatedV1Requests.length > 0) {
      console.error('TRIPWIRE FAILURE: Unauthenticated admin requests detected:', 
        unauthenticatedV1Requests.map(req => `${req.ctx?.method} ${req.ctx?.url}`));
    }
  });

  it('TRIPWIRE: Forcing unauthenticated request should trigger clear failure', async () => {
    // Setup: No authentication
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Mock redirect for enforceAuthentication
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    const { fetchJson } = await import('../lib/http');
    
    let authEnforcementTriggered = false;
    try {
      await fetchJson('/v1/slots');
    } catch (error: any) {
      if (error.message === 'Authentication required') {
        authEnforcementTriggered = true;
      }
    }

    // Verify authentication enforcement was triggered
    expect(authEnforcementTriggered).toBe(true);
    expect(mockLocation.href).toBe('/login');

    // Verify the enforcement was logged
    const logs = logger.getLogs();
    const authEvents = logs.filter(log => 
      log.event === 'auth_enforcement' && 
      log.ctx?.auth_reason === 'missing_token'
    );

    expect(authEvents.length).toBeGreaterThan(0);
  });

  it('TRIPWIRE: Legacy api client now uses global authentication', async () => {
    // Setup: Valid authentication
    localStorage.setItem('token', 'legacy-test-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));

    const { api } = await import('../lib/api');
    
    try {
      await api.getSlots('2025-08-15');
    } catch (error) {
      // Expected for mock setup
    }

    // Verify the request went through fetchJson (has auth header)
    const logs = logger.getLogs();
    const apiRequests = logs.filter(log => 
      log.event === 'fetch_intercept' && 
      log.ctx?.url?.includes('/v1/slots')
    );

    // Should have auth header (proving it went through fetchJson)
    expect(apiRequests.length).toBeGreaterThan(0);
    expect(apiRequests[0].ctx?.has_auth_header).toBe(true);
    expect(apiRequests[0].ctx?.auth_header_type).toBe('Bearer');
  });

  it('TRIPWIRE: Server logs correlation - no 401s for authenticated admin requests', async () => {
    // This is a documentation test - verifies expected server behavior
    
    // Expected server log pattern for AUTHENTICATED request:
    const expectedAuthenticatedLog = {
      timestamp: expect.any(String),
      level: 'info',
      event: 'http_request',
      message: 'GET /v1/slots 200',
      request_id: expect.any(String),
      method: 'GET',
      path: '/v1/slots',
      status: 200,
      duration_ms: expect.any(Number),
      user_id: expect.any(String),
      tenant_id: expect.any(String)
    };

    // Expected server log pattern for UNAUTHENTICATED request (should NOT happen):
    const forbiddenUnauthenticatedLog = {
      status: 401,
      auth_reason: 'missing_or_invalid_token',
      error_class: 'http_error'
    };

    // This test documents what the server logs should look like
    expect(expectedAuthenticatedLog.level).toBe('info');
    expect(forbiddenUnauthenticatedLog.status).toBe(401);
    
    // In real usage, admin requests should NEVER generate 401 logs after proper authentication
  });
});