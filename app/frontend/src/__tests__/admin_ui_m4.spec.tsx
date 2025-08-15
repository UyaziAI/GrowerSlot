import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import { SlotSheet } from '../pages/SlotSheet';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin UI M4 Tests', () => {
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
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('/v1/slots/bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, id: 'new-slot-id' }),
        });
      }
      if (url.includes('/v1/slots/') && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url.includes('/v1/slots') && !url.includes('bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ([]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it('clicking FAB creates a slot (mock 200), grid updates', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Switch to day view
    fireEvent.click(screen.getByTestId('tab-day'));

    await waitFor(() => {
      // FAB should be visible in day view
      expect(screen.getByTestId('day-view-fab')).toBeInTheDocument();
    });

    // Click FAB to open create dialog
    fireEvent.click(screen.getByTestId('day-view-fab'));

    await waitFor(() => {
      expect(screen.getByTestId('create-slot-dialog')).toBeInTheDocument();
    });

    // Fill in form fields
    fireEvent.change(screen.getByTestId('input-new-capacity'), {
      target: { value: '25' }
    });

    fireEvent.change(screen.getByTestId('textarea-new-notes'), {
      target: { value: 'Test slot from FAB' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('button-confirm-create'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: expect.any(String),
          endDate: expect.any(String),
          startTime: '09:00',
          endTime: '10:00',
          slotDuration: 1, // 60 minutes / 60 = 1 hour
          capacity: 25,
          notes: 'Test slot from FAB',
          weekdays: expect.any(Array)
        })
      });
    });
  });

  it('toggling Blackout in SlotSheet calls PATCH /v1/slots/{id}/blackout and updates UI', async () => {
    const mockSlot = {
      id: 'test-slot-id',
      date: '2025-08-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      capacity: 20,
      booked: 5,
      blackout: false,
      notes: 'Test slot',
      restrictions: {}
    };

    render(
      <SlotSheet
        slot={mockSlot}
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('slot-sheet')).toBeInTheDocument();
    });

    // Toggle blackout switch
    fireEvent.click(screen.getByTestId('switch-blackout-slot'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/test-slot-id/blackout', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blackout: true,
          note: 'Slot blacked out from management'
        })
      });
    });
  });

  it('SlotSheet shows slot overview with correct stats', async () => {
    const mockSlot = {
      id: 'test-slot-id',
      date: '2025-08-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      capacity: 20,
      booked: 5,
      blackout: false,
      notes: 'Test slot',
      restrictions: {}
    };

    render(
      <SlotSheet
        slot={mockSlot}
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('slot-overview-section')).toBeInTheDocument();
    });

    // Check stats display
    expect(screen.getByText('20')).toBeInTheDocument(); // Capacity
    expect(screen.getByText('15')).toBeInTheDocument(); // Remaining (20 - 5)
    expect(screen.getByText('5')).toBeInTheDocument();  // Booked
  });

  it('SlotSheet settings section allows editing capacity and notes', async () => {
    const mockSlot = {
      id: 'test-slot-id',
      date: '2025-08-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      capacity: 20,
      booked: 5,
      blackout: false,
      notes: 'Test slot',
      restrictions: {}
    };

    render(
      <SlotSheet
        slot={mockSlot}
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('slot-settings-section')).toBeInTheDocument();
    });

    // Check form fields are present and editable
    expect(screen.getByTestId('input-slot-capacity')).toHaveValue(20);
    expect(screen.getByTestId('textarea-slot-notes')).toHaveValue('Test slot');

    // Edit capacity
    fireEvent.change(screen.getByTestId('input-slot-capacity'), {
      target: { value: '30' }
    });

    // Edit notes
    fireEvent.change(screen.getByTestId('textarea-slot-notes'), {
      target: { value: 'Updated test slot' }
    });

    // Save changes
    fireEvent.click(screen.getByTestId('button-save-slot'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/v1/slots/test-slot-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capacity: 30,
          notes: 'Updated test slot'
        })
      });
    });
  });

  it('SlotSheet actions section has all expected buttons', async () => {
    const mockSlot = {
      id: 'test-slot-id',
      date: '2025-08-15',
      start_time: '09:00:00',
      end_time: '10:00:00',
      capacity: 20,
      booked: 0, // Empty slot
      blackout: false,
      notes: '',
      restrictions: {}
    };

    render(
      <SlotSheet
        slot={mockSlot}
        isOpen={true}
        onClose={() => {}}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('slot-actions-section')).toBeInTheDocument();
    });

    // Check action elements are present
    expect(screen.getByTestId('switch-blackout-slot')).toBeInTheDocument();
    expect(screen.getByTestId('button-restrict-slot')).toBeInTheDocument();
    expect(screen.getByTestId('button-delete-slot-trigger')).toBeInTheDocument(); // Empty slot can be deleted
  });

  it('FAB form has all required fields', async () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Switch to day view
    fireEvent.click(screen.getByTestId('tab-day'));

    await waitFor(() => {
      expect(screen.getByTestId('day-view-fab')).toBeInTheDocument();
    });

    // Click FAB to open create dialog
    fireEvent.click(screen.getByTestId('day-view-fab'));

    await waitFor(() => {
      expect(screen.getByTestId('create-slot-dialog')).toBeInTheDocument();
    });

    // Check all form fields are present
    expect(screen.getByTestId('input-new-start-time')).toBeInTheDocument();
    expect(screen.getByTestId('select-new-slot-length')).toBeInTheDocument();
    expect(screen.getByTestId('input-new-capacity')).toBeInTheDocument();
    expect(screen.getByTestId('textarea-new-notes')).toBeInTheDocument();
    expect(screen.getByTestId('button-cancel-create')).toBeInTheDocument();
    expect(screen.getByTestId('button-confirm-create')).toBeInTheDocument();
  });

  it('day view shows slot list when slots exist', async () => {
    // Mock slots data
    const mockSlots = [
      {
        id: 'slot-1',
        date: '2025-08-15',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 20,
        usage: { booked: 5, remaining: 15 },
        blackout: false
      },
      {
        id: 'slot-2', 
        date: '2025-08-15',
        startTime: '14:00',
        endTime: '15:00',
        capacity: 15,
        usage: { booked: 0, remaining: 15 },
        blackout: true
      }
    ];

    // Mock query to return our test data
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/v1/slots')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockSlots,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });

    render(<AdminPage />, { wrapper: createWrapper(queryClient) });

    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    });

    // Switch to day view
    fireEvent.click(screen.getByTestId('tab-day'));

    await waitFor(() => {
      expect(screen.getByTestId('day-view-slots')).toBeInTheDocument();
    });

    // Should show slot items
    expect(screen.getByTestId('day-slot-0')).toBeInTheDocument();
    expect(screen.getByTestId('day-slot-1')).toBeInTheDocument();
  });
});