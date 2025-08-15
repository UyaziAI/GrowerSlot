/**
 * Test verbatim error message handling for admin components
 * Ensures 4xx server errors are displayed exactly as received
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import { BulkBar } from '../pages/BulkBar';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
const mockToast = vi.fn();
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
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

describe('Admin Error Message Handling', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockToast.mockClear();
  });

  it('displays verbatim 422 error for slot creation', async () => {
    const exactServerMessage = 'start_date cannot be in the past';
    
    // Mock 422 response with exact error message
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: exactServerMessage })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Wait for component to mount and trigger slot creation error
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: exactServerMessage,
        variant: 'destructive'
      });
    }, { timeout: 3000 });
  });

  it('displays verbatim 409 error for blackout conflict', async () => {
    const exactServerMessage = 'Cannot blackout date with existing bookings';
    
    // Mock successful initial fetch, then 409 for blackout
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ slots: [] })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ error: exactServerMessage })
      });

    const wrapper = render(
      <TestWrapper>
        <BulkBar
          selectedDates={['2025-08-16']}
          onClearSelection={() => {}}
          onDone={() => {}}
        />
      </TestWrapper>
    );

    // Find and click blackout button
    const blackoutButton = await screen.findByText(/blackout/i);
    fireEvent.click(blackoutButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: exactServerMessage,
          variant: 'destructive'
        })
      );
    });
  });

  it('displays verbatim 403 error for unauthorized restriction', async () => {
    const exactServerMessage = 'Insufficient permissions to apply restrictions';
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: exactServerMessage })
    });

    const wrapper = render(
      <TestWrapper>
        <BulkBar
          selectedDates={['2025-08-16']}
          onClearSelection={() => {}}
          onDone={() => {}}
        />
      </TestWrapper>
    );

    // Trigger restriction operation
    const restrictButton = await screen.findByText(/restrict/i);
    fireEvent.click(restrictButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: exactServerMessage,
          variant: 'destructive'
        })
      );
    });
  });

  it('handles error responses without error field gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}) // No error field
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        description: 'Internal Server Error',
        variant: 'destructive'
      });
    });
  });
});