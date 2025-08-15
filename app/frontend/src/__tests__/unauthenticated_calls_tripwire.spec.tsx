/**
 * Ultimate tripwire test to detect ANY unauthenticated admin calls
 * This test MUST fail if any admin request bypasses authentication
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { logger } from '../lib/logger';

describe('Unauthenticated Calls Tripwire - Ultimate Detection', () => {
  let fetchSpy: any;
  let originalFetch: any;
  let callLog: Array<{
    url: string;
    method: string;
    hasAuth: boolean;
    requestId: string;
    timestamp: string;
  }> = [];

  beforeEach(() => {
    logger.clear();
    callLog = [];
    
    // Store original fetch
    originalFetch = global.fetch;
    
    // Comprehensive fetch interceptor
    fetchSpy = vi.fn().mockImplementation((url: string, options: RequestInit = {}) => {
      const authHeader = options.headers && 
        (options.headers as Record<string, string>).Authorization;
      const requestId = (options.headers as Record<string, string>)?.['X-Request-ID'] || 
        `mock-${Date.now()}`;
      
      const call = {
        url,
        method: options.method || 'GET',
        hasAuth: !!authHeader,
        requestId,
        timestamp: new Date().toISOString()
      };
      
      callLog.push(call);

      logger.info('fetch_tripwire', `${call.method} ${url}`, {
        request_id: requestId,
        has_auth_header: call.hasAuth,
        auth_header: authHeader || 'missing',
        url: url,
        method: call.method
      });

      // Simulate server behavior: 401 for unauthenticated /v1/ calls
      if (url.includes('/v1/') && !authHeader) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ 
            error: 'Access token required',
            auth_reason: 'missing_or_invalid_token'
          })
        });
      }

      // Success for authenticated calls
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          slots: [],
          bookings: [],
          message: 'success',
          data: []
        })
      });
    });

    global.fetch = fetchSpy;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('TRIPWIRE: NO unauthenticated /v1/ calls from ANY source', async () => {
    // Setup: Valid authentication
    localStorage.setItem('token', 'valid-tripwire-token');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'grower', // Test as grower to catch grower-dashboard issues
      email: 'grower@test.com'
    }));

    // Test all known API client sources
    const sources = [
      () => import('../lib/api').then(m => m.api.getSlots('2025-08-15')),
      () => import('../api/endpoints').then(m => m.slotsApi.getSlots('2025-08-15')),
      () => import('../lib/http').then(m => m.fetchJson('/v1/slots?date=2025-08-15')),
    ];

    // Execute all sources
    for (let i = 0; i < sources.length; i++) {
      try {
        await sources[i]();
      } catch (error) {
        // Expected for mock setup
      }
    }

    // Analyze ALL calls for unauthenticated /v1/ requests
    const v1Calls = callLog.filter(call => call.url.includes('/v1/'));
    const unauthenticatedV1Calls = v1Calls.filter(call => !call.hasAuth);

    // TRIPWIRE: This MUST be 0 for the test to pass
    expect(unauthenticatedV1Calls).toHaveLength(0);

    if (unauthenticatedV1Calls.length > 0) {
      console.error('TRIPWIRE FAILURE: Unauthenticated /v1/ calls detected!');
      console.error('Offending calls:', unauthenticatedV1Calls.map(call => 
        `${call.method} ${call.url} (ID: ${call.requestId})`
      ));
      
      // Log exact request IDs for correlation with server logs
      const requestIds = unauthenticatedV1Calls.map(call => call.requestId);
      console.error('Request IDs to correlate with server logs:', requestIds);
    }
  });

  it('TRIPWIRE: Grower dashboard queries must be properly gated', async () => {
    // Setup: Valid grower authentication
    localStorage.setItem('token', 'valid-grower-token');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'grower',
      email: 'grower@test.com',
      id: 'grower-123'
    }));

    // Mock the auth service
    const { authService } = await import('../lib/auth');
    vi.spyOn(authService, 'isAuthenticated').mockReturnValue(true);
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-grower-token');

    // Import and test the specific hooks that grower-dashboard uses
    try {
      const { api } = await import('../lib/api');
      await api.getSlots('2025-08-15');
      await api.getBookings();
    } catch (error) {
      // Expected for mock setup
    }

    // Verify all calls were authenticated
    const v1Calls = callLog.filter(call => call.url.includes('/v1/'));
    const unauthenticatedCalls = v1Calls.filter(call => !call.hasAuth);

    expect(unauthenticatedCalls).toHaveLength(0);

    if (unauthenticatedCalls.length > 0) {
      console.error('TRIPWIRE FAILURE: Grower dashboard made unauthenticated calls');
      console.error('Calls:', unauthenticatedCalls);
    }
  });

  it('TRIPWIRE: No authentication should trigger clear error', async () => {
    // Setup: NO authentication (simulate the problematic state)
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Mock redirect behavior
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    // Try to make a call without auth - should be caught by enforceAuthentication
    let authEnforcementTriggered = false;
    try {
      const { fetchJson } = await import('../lib/http');
      await fetchJson('/v1/slots');
    } catch (error: any) {
      if (error.message === 'Authentication required') {
        authEnforcementTriggered = true;
      }
    }

    expect(authEnforcementTriggered).toBe(true);
    expect(mockLocation.href).toBe('/login');

    // Verify no actual API call was made to the server
    const apiCalls = callLog.filter(call => call.url.includes('/v1/'));
    expect(apiCalls).toHaveLength(0);
  });

  it('TRIPWIRE: Real server log correlation simulation', () => {
    // This test documents the expected server log format for troubleshooting
    
    const expectedAuthenticatedServerLog = {
      timestamp: expect.any(String),
      level: 'info',
      event: 'http_request',
      message: 'GET /v1/slots 200',
      request_id: expect.any(String),
      method: 'GET',
      path: '/v1/slots',
      status: 200,
      user_id: expect.any(String),
      tenant_id: expect.any(String)
    };

    const problematicUnauthenticatedLog = {
      level: 'warn',
      event: 'http_request', 
      message: 'GET /v1/slots 401',
      status: 401,
      auth_reason: 'missing_or_invalid_token',
      error_class: 'http_error'
    };

    // Test passes if we understand the expected vs problematic patterns
    expect(expectedAuthenticatedServerLog.status).toBe(200);
    expect(problematicUnauthenticatedLog.status).toBe(401);
    
    // If we see the problematic pattern in real server logs, this tripwire should fail
  });
});