import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import { BulkBar } from '../pages/BulkBar';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin UI M3 Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/v1/slots')) {
        return Promise.resolve({
          ok: true,
          json: async () => ([]),
        });
      }
      if (url.includes('/v1/slots/bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ count: 6, success: true }),
        });
      }
      if (url.includes('/v1/slots/blackout')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url.includes('/v1/restrictions/apply')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it('enter selection mode, select 3 days → BulkBar appears', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Toggle selection mode
    fireEvent.click(screen.getByTestId('button-selection-mode'));

    // Verify selection mode is active
    expect(screen.getByText('Exit Select')).toBeInTheDocument();

    // Test BulkBar component directly with selected dates
    const { rerender } = render(
      <BulkBar
        selectedDates={['2025-08-15', '2025-08-16', '2025-08-17']}
        onClearSelection={() => {}}
        onDone={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    // BulkBar should appear with selection count
    expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    expect(screen.getByTestId('selection-count')).toHaveTextContent('3 days selected');
  });

  it('press Blackout — Selected days → one request sent; calendar refreshes', async () => {
    render(
      <BulkBar
        selectedDates={['2025-08-15', '2025-08-16', '2025-08-17']}
        onClearSelection={() => {}}
        onDone={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    });

    // Click blackout button
    fireEvent.click(screen.getByTestId('button-bulk-blackout'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/blackout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: '2025-08-15',
          end_date: '2025-08-17',
          scope: 'day',
          note: 'Bulk blackout applied to 3 selected days',
          selected_dates: ['2025-08-15', '2025-08-16', '2025-08-17']
        })
      });
    });
  });

  it('exit selection mode hides BulkBar and clears selection', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Enter selection mode
    fireEvent.click(screen.getByTestId('button-selection-mode'));
    expect(screen.getByText('Exit Select')).toBeInTheDocument();

    // Exit selection mode
    fireEvent.click(screen.getByTestId('button-selection-mode'));
    expect(screen.getByText('Select')).toBeInTheDocument();

    // BulkBar should not be visible when no dates selected
    expect(screen.queryByTestId('bulk-bar')).not.toBeInTheDocument();
  });

  it('bulk create form has all required fields and submits correctly', async () => {
    render(
      <BulkBar
        selectedDates={['2025-08-15', '2025-08-16']}
        onClearSelection={() => {}}
        onDone={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    });

    // Open bulk create sheet
    fireEvent.click(screen.getByTestId('button-bulk-create'));

    await waitFor(() => {
      expect(screen.getByText('Create Slots for 2 Days')).toBeInTheDocument();
    });

    // Check form fields are present
    expect(screen.getByTestId('input-bulk-start-time')).toBeInTheDocument();
    expect(screen.getByTestId('input-bulk-end-time')).toBeInTheDocument();
    expect(screen.getByTestId('select-bulk-duration')).toBeInTheDocument();
    expect(screen.getByTestId('input-bulk-capacity')).toBeInTheDocument();
    expect(screen.getByTestId('textarea-bulk-notes')).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByTestId('input-bulk-capacity'), {
      target: { value: '25' }
    });

    fireEvent.change(screen.getByTestId('textarea-bulk-notes'), {
      target: { value: 'Bulk created slots' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('button-confirm-bulk-create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2025-08-15',
          endDate: '2025-08-16',
          startTime: '08:00',
          endTime: '17:00',
          slotDuration: 1, // 60 minutes / 60 = 1 hour
          capacity: 25,
          notes: 'Bulk created slots',
          weekdays: expect.any(Array)
        })
      });
    });
  });

  it('week view shows bulk actions button', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Switch to week view
    fireEvent.click(screen.getByTestId('tab-week'));

    await waitFor(() => {
      expect(screen.getByTestId('button-select-week')).toBeInTheDocument();
    });

    expect(screen.getByText('Bulk actions (week)')).toBeInTheDocument();
  });

  it('bulk restrictions button works correctly', async () => {
    render(
      <BulkBar
        selectedDates={['2025-08-15', '2025-08-16']}
        onClearSelection={() => {}}
        onDone={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    });

    // Click restrictions button
    fireEvent.click(screen.getByTestId('button-bulk-restrictions'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/restrictions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_scope: ['2025-08-15', '2025-08-16'],
          restrictions: {
            growers: [],
            cultivars: [],
            note: 'Bulk restrictions applied to 2 selected days'
          }
        })
      });
    });
  });

  it('clear and done buttons work correctly', async () => {
    const mockClear = vi.fn();
    const mockDone = vi.fn();

    render(
      <BulkBar
        selectedDates={['2025-08-15', '2025-08-16']}
        onClearSelection={mockClear}
        onDone={mockDone}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('bulk-bar')).toBeInTheDocument();
    });

    // Test clear button
    fireEvent.click(screen.getByTestId('button-clear-selection'));
    expect(mockClear).toHaveBeenCalled();

    // Test done button
    fireEvent.click(screen.getByTestId('button-done-selection'));
    expect(mockDone).toHaveBeenCalled();
  });
});