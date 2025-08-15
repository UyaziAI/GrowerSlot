/**
 * Test to verify AdminPage uses correct /v1/slots endpoint per blueprint spec
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AdminPage from '../pages/AdminPage';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

describe('Admin API Compliance', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });
  });

  it('uses correct /v1/slots endpoint without /range suffix', async () => {
    render(<AdminPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify the correct endpoint format is used
    const fetchCall = mockFetch.mock.calls[0];
    const url = fetchCall[0];
    
    expect(url).toMatch(/^\/v1\/slots\?start=\d{4}-\d{2}-\d{2}&end=\d{4}-\d{2}-\d{2}$/);
    expect(url).not.toContain('/v1/slots/range');
  });

  it('fetches month view data with proper date range', async () => {
    render(<AdminPage />);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const fetchCall = mockFetch.mock.calls[0];
    const url = fetchCall[0];
    
    // Should include start and end parameters for month view
    expect(url).toContain('start=');
    expect(url).toContain('end=');
  });
});