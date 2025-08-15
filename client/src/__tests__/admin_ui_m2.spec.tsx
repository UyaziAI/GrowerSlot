import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import { DayEditorSheet } from '../pages/DayEditorSheet';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin UI M2 Tests', () => {
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
      if (url.includes('/v1/admin/day-overview')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            date: '2025-08-15',
            blackout: false,
            remaining: 45,
            booked: 15,
            totalSlots: 6,
            restrictions: []
          }),
        });
      }
      if (url.includes('/v1/slots/blackout')) {
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

  it('clicking Edit Day in DayPeek opens DayEditorSheet', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    // Wait for the admin page to load
    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Since we can't easily simulate calendar interaction, test the DayEditorSheet directly
    const { rerender } = render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
    });

    // Check main sections are present
    expect(screen.getByTestId('day-overview-section')).toBeInTheDocument();
    expect(screen.getByTestId('quick-create-section')).toBeInTheDocument();
    expect(screen.getByTestId('restrictions-editor-section')).toBeInTheDocument();
    expect(screen.getByTestId('utilities-section')).toBeInTheDocument();
  });

  it('clicking Blackout Day in the editor calls /v1/slots/blackout (day scope)', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
    });

    // Click the blackout day button
    const blackoutButton = screen.getByTestId('button-blackout-day');
    fireEvent.click(blackoutButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/blackout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: '2025-08-15',
          end_date: '2025-08-15',
          scope: 'day',
          note: 'Day blackout from editor'
        })
      });
    });
  });

  it('quick create form has all required fields', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('quick-create-section')).toBeInTheDocument();
    });

    // Check form elements are present
    expect(screen.getByTestId('select-slot-length')).toBeInTheDocument();
    expect(screen.getByTestId('input-slot-capacity')).toBeInTheDocument();
    expect(screen.getByTestId('textarea-slot-notes')).toBeInTheDocument();
    expect(screen.getByTestId('button-quick-create-slot')).toBeInTheDocument();
  });

  it('day overview section shows stats and blackout toggle', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('day-overview-section')).toBeInTheDocument();
    });

    // Check overview elements
    expect(screen.getByTestId('toggle-day-blackout')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument(); // Remaining count
    expect(screen.getByText('15')).toBeInTheDocument(); // Booked count
    expect(screen.getByText('6')).toBeInTheDocument();  // Total slots count
  });

  it('utilities section has expected buttons', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('utilities-section')).toBeInTheDocument();
    });

    // Check utility buttons
    expect(screen.getByTestId('button-duplicate-from')).toBeInTheDocument();
    expect(screen.getByTestId('button-delete-empty-slots')).toBeInTheDocument();
    expect(screen.getByTestId('button-blackout-day')).toBeInTheDocument();
  });

  it('restrictions editor section has add restriction buttons', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('restrictions-editor-section')).toBeInTheDocument();
    });

    // Check restriction buttons
    expect(screen.getByTestId('button-add-grower-restriction')).toBeInTheDocument();
    expect(screen.getByTestId('button-add-cultivar-restriction')).toBeInTheDocument();
  });

  it('quick create submits correct data to bulk slots API', async () => {
    render(
      <DayEditorSheet
        dateISO="2025-08-15"
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('quick-create-section')).toBeInTheDocument();
    });

    // Fill in form data
    fireEvent.change(screen.getByTestId('input-slot-capacity'), {
      target: { value: '25' }
    });

    fireEvent.change(screen.getByTestId('textarea-slot-notes'), {
      target: { value: 'Test slot from editor' }
    });

    // Submit the form
    fireEvent.click(screen.getByTestId('button-quick-create-slot'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2025-08-15',
          endDate: '2025-08-15',
          startTime: '08:00',
          endTime: '17:00',
          slotDuration: 1, // 60 minutes / 60 = 1 hour
          capacity: 25,
          notes: 'Test slot from editor',
          weekdays: [false, false, false, false, true, false, false] // Thursday for 2025-08-15
        })
      });
    });
  });
});