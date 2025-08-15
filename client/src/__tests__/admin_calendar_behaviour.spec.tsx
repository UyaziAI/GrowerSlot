import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import '@testing-library/jest-dom';

// Mock the toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock fetch globally
global.fetch = vi.fn();

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('Admin Calendar Behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ slots: [] })
    });
  });

  it('renders Admin header with testids admin-header-create and admin-header-more', () => {
    render(<AdminPage />, { wrapper });
    
    expect(screen.getByTestId('admin-header-create')).toBeInTheDocument();
    expect(screen.getByTestId('admin-header-more')).toBeInTheDocument();
  });

  it('Month shows 42 day cells; clicking a day opens DayPeekSheet', async () => {
    render(<AdminPage />, { wrapper });
    
    // Wait for calendar to render
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      // Filter to day cell buttons (not header buttons)
      const dayCells = buttons.filter(btn => {
        const text = btn.textContent || '';
        return /^\d{1,2}$/.test(text);
      });
      expect(dayCells).toHaveLength(42);
    });

    // Click a day cell
    const dayCells = screen.getAllByRole('button').filter(btn => {
      const text = btn.textContent || '';
      return /^\d{1,2}$/.test(text);
    });
    
    fireEvent.click(dayCells[15]); // Click middle of month

    // DayPeekSheet should open (checking for its characteristic elements)
    await waitFor(() => {
      // The DayPeekSheet would render with day info
      expect(screen.getByText(/Edit Day/i)).toBeInTheDocument();
    });
  });

  it('Clicking Edit Day opens DayEditorSheet', async () => {
    render(<AdminPage />, { wrapper });
    
    // Wait for calendar
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const dayCells = buttons.filter(btn => /^\d{1,2}$/.test(btn.textContent || ''));
      expect(dayCells).toHaveLength(42);
    });

    // Click a day
    const dayCells = screen.getAllByRole('button').filter(btn => /^\d{1,2}$/.test(btn.textContent || ''));
    fireEvent.click(dayCells[10]);

    // Wait for DayPeekSheet
    await waitFor(() => {
      expect(screen.getByText(/Edit Day/i)).toBeInTheDocument();
    });

    // Click Edit Day button
    const editButton = screen.getByText(/Edit Day/i);
    fireEvent.click(editButton);

    // DayEditorSheet should open
    await waitFor(() => {
      // Check for DayEditorSheet specific content
      expect(screen.getByText(/Quick Create/i)).toBeInTheDocument();
    });
  });

  it('Toggling selection mode and selecting 3 days shows BulkBar', async () => {
    render(<AdminPage />, { wrapper });
    
    // Wait for calendar
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const dayCells = buttons.filter(btn => /^\d{1,2}$/.test(btn.textContent || ''));
      expect(dayCells).toHaveLength(42);
    });

    // Toggle selection mode
    const selectSwitch = screen.getByRole('switch', { name: /Select days/i });
    fireEvent.click(selectSwitch);

    // Select 3 days
    const dayCells = screen.getAllByRole('button').filter(btn => /^\d{1,2}$/.test(btn.textContent || ''));
    fireEvent.click(dayCells[5]);
    fireEvent.click(dayCells[10]);
    fireEvent.click(dayCells[15]);

    // BulkBar should appear
    await waitFor(() => {
      expect(screen.getByText(/Create Range/i)).toBeInTheDocument();
    });
  });

  it('Mock 422 {error:"start_date cannot be in the past"} on bulk create; assert that exact text renders', async () => {
    render(<AdminPage />, { wrapper });
    
    // Mock 422 response
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/v1/slots/bulk')) {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({ error: 'start_date cannot be in the past' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ slots: [] })
      });
    });

    // Toggle selection mode
    const selectSwitch = screen.getByRole('switch', { name: /Select days/i });
    fireEvent.click(selectSwitch);

    // Select a day
    const dayCells = screen.getAllByRole('button').filter(btn => /^\d{1,2}$/.test(btn.textContent || ''));
    fireEvent.click(dayCells[5]);

    // BulkBar appears
    await waitFor(() => {
      expect(screen.getByText(/Create Range/i)).toBeInTheDocument();
    });

    // Click Create Range
    const createButton = screen.getByText(/Create Range/i);
    fireEvent.click(createButton);

    // Error message should appear via toast
    await waitFor(() => {
      // The error would be shown in a toast notification
      const toastMock = vi.mocked((global as any).useToast).mock.results[0]?.value?.toast;
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'start_date cannot be in the past',
          variant: 'destructive'
        })
      );
    });
  });
});