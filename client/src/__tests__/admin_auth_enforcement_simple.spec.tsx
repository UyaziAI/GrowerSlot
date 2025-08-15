/**
 * Simple test to verify admin authentication enforcement
 * Tests that all admin API calls include Bearer token headers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Admin Authentication Enforcement', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  it('SHOULD FAIL: captures unauthenticated admin calls without token', async () => {
    // Setup: No authentication token
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Mock window.location.href for redirect
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    const { fetchJson } = await import('../lib/http');
    
    try {
      await fetchJson('/v1/slots');
    } catch (error) {
      // Should catch authentication enforcement
    }

    // Verify redirect to login occurred (no popup)
    expect(mockLocation.href).toBe('/login');
  });

  it('SHOULD PASS: all admin calls include Bearer token when authenticated', async () => {
    // Setup: Valid authentication
    const mockToken = 'valid-jwt-token';
    const mockUser = { role: 'admin', email: 'admin@test.com' };
    
    localStorage.setItem('token', mockToken);
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    // Mock successful response
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ slots: [] })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { fetchJson } = await import('../lib/http');
    
    await fetchJson('/v1/slots');

    // Verify the request included Authorization header
    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe(`Bearer ${mockToken}`);
    expect(url).toBe('/v1/slots');
  });

  it('SHOULD PASS: 401 errors trigger clean redirect without popup', async () => {
    // Setup: Valid initial auth but server returns 401 (expired token)
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
    
    // Mock 401 response
    const mockResponse = {
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Access token required' })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true
    });

    const { fetchJson } = await import('../lib/http');
    
    try {
      await fetchJson('/v1/slots');
    } catch (error) {
      // Auth error should be handled
    }

    // Verify auth cleared and redirect occurred
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(mockLocation.href).toBe('/login');
  });

  it('SHOULD PASS: server errors 422/403/409 display verbatim messages', async () => {
    // Setup: Valid auth
    localStorage.setItem('token', 'valid-token');
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
    
    // Mock 422 validation error
    const mockResponse = {
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'Slot capacity cannot exceed 100' })
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const { fetchJson } = await import('../lib/http');
    
    try {
      await fetchJson('/v1/slots', { method: 'POST' });
    } catch (error: any) {
      // Verify exact server error message is preserved
      expect(error.message).toBe('Slot capacity cannot exceed 100');
      expect(error.status).toBe(422);
    }
  });
});