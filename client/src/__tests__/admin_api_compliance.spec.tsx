/**
 * Test API compliance for admin interface
 * Ensures all admin calls use correct /v1/ endpoints and proper formats
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch to track API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

// Test wrapper with query client
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin API Compliance', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });
  });

  it('uses /v1/slots endpoint with start and end query parameters', async () => {
    render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Verify API call format
    const [url] = mockFetch.mock.calls[0];
    expect(url).toMatch(/^\/v1\/slots\?start=\d{4}-\d{2}-\d{2}&end=\d{4}-\d{2}-\d{2}$/);
    expect(url).not.toContain('/v1/slots/range'); // Should not use old format
  });

  it('maintains /v1/ prefix across different view modes', async () => {
    render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Test Month view (default)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    let lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toMatch(/^\/v1\/slots/);

    // Switch to Week view
    mockFetch.mockClear();
    const weekButton = screen.getByText('Week');
    fireEvent.click(weekButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toMatch(/^\/v1\/slots/);

    // Switch to Day view
    mockFetch.mockClear();
    const dayButton = screen.getByText('Day');
    fireEvent.click(dayButton);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[0]).toMatch(/^\/v1\/slots/);
  });

  it('uses standard query parameter format for date ranges', async () => {
    render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Check query parameters match YYYY-MM-DD format
    const [url] = mockFetch.mock.calls[0];
    const urlObj = new URL(url, 'http://localhost');
    
    expect(urlObj.searchParams.get('start')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(urlObj.searchParams.get('end')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects legacy endpoint patterns', async () => {
    render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Ensure no calls use legacy patterns
    mockFetch.mock.calls.forEach(call => {
      const url = call[0];
      expect(url).not.toContain('/slots/range');
      expect(url).not.toContain('/api/slots');
      expect(url).toMatch(/^\/v1\//); // Must start with /v1/
    });
  });
});