/**
 * Test week view slot ribbons functionality
 * Ensures week view displays real slot data with capacity/time information
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for slot data
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

describe('Admin Week View', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('renders 7 day columns in week view', async () => {
    // Mock empty slot response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Wait for week view to render
    const weekGrid = await screen.findByTestId('week-view-grid');
    
    // Count day columns (should be 7)
    const dayColumns = weekGrid.querySelectorAll('[data-testid*="week-day-"]');
    expect(dayColumns).toHaveLength(7);
  });

  it('displays slot ribbons with capacity and time information', async () => {
    // Mock slot data for week view
    const mockSlots = [
      {
        id: '1',
        date: '2025-08-15',
        time: '09:00',
        start_time: '09:00',
        end_time: '10:00',
        slot_length_min: 60,
        capacity: 20,
        booked: 5,
        blackout: false,
        notes: 'Morning delivery',
        restrictions: {}
      },
      {
        id: '2',
        date: '2025-08-15',
        time: '14:00',
        start_time: '14:00',
        end_time: '15:00',
        slot_length_min: 60,
        capacity: 15,
        booked: 15,
        blackout: false,
        notes: '',
        restrictions: {}
      },
      {
        id: '3',
        date: '2025-08-16',
        time: '10:00',
        start_time: '10:00',
        end_time: '11:00',
        slot_length_min: 60,
        capacity: 10,
        booked: 0,
        blackout: true,
        notes: 'Maintenance',
        restrictions: {}
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: mockSlots })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Check first slot ribbon (available)
    const slot1Ribbon = await screen.findByTestId('week-slot-ribbon-1');
    expect(slot1Ribbon).toHaveTextContent('09:00 (60m)');
    expect(slot1Ribbon).toHaveTextContent('15/20'); // remaining/capacity
    expect(slot1Ribbon).toHaveClass('bg-green-100'); // Available color

    // Check second slot ribbon (full)
    const slot2Ribbon = await screen.findByTestId('week-slot-ribbon-2');
    expect(slot2Ribbon).toHaveTextContent('14:00 (60m)');
    expect(slot2Ribbon).toHaveTextContent('0/15'); // remaining/capacity
    expect(slot2Ribbon).toHaveClass('bg-red-100'); // Full color

    // Check third slot ribbon (blackout)
    const slot3Ribbon = await screen.findByTestId('week-slot-ribbon-3');
    expect(slot3Ribbon).toHaveTextContent('10:00 (60m)');
    expect(slot3Ribbon).toHaveTextContent('10/10'); // remaining/capacity
    expect(slot3Ribbon).toHaveClass('bg-gray-100'); // Blackout color
    expect(slot3Ribbon).toHaveTextContent('⛔'); // Blackout indicator
  });

  it('shows color coding based on capacity utilization', async () => {
    // Mock slots with different utilization levels
    const mockSlots = [
      {
        id: '1',
        date: '2025-08-15',
        time: '09:00',
        capacity: 100,
        booked: 20, // 20% utilization - green
        blackout: false,
        restrictions: {}
      },
      {
        id: '2', 
        date: '2025-08-15',
        time: '14:00',
        capacity: 100,
        booked: 80, // 80% utilization - yellow
        blackout: false,
        restrictions: {}
      },
      {
        id: '3',
        date: '2025-08-15', 
        time: '17:00',
        capacity: 100,
        booked: 100, // 100% utilization - red
        blackout: false,
        restrictions: {}
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: mockSlots })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Check color coding
    const lowUtilRibbon = await screen.findByTestId('week-slot-ribbon-1');
    expect(lowUtilRibbon).toHaveClass('bg-green-100'); // Low utilization

    const highUtilRibbon = await screen.findByTestId('week-slot-ribbon-2');
    expect(highUtilRibbon).toHaveClass('bg-yellow-100'); // High utilization

    const fullRibbon = await screen.findByTestId('week-slot-ribbon-3');
    expect(fullRibbon).toHaveClass('bg-red-100'); // Full capacity
  });

  it('displays restriction indicators on slot ribbons', async () => {
    // Mock slot with restrictions
    const mockSlots = [
      {
        id: '1',
        date: '2025-08-15',
        time: '09:00',
        capacity: 20,
        booked: 5,
        blackout: false,
        restrictions: {
          growers: ['grower1', 'grower2'],
          cultivars: []
        }
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: mockSlots })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Check restriction indicator
    const slotRibbon = await screen.findByTestId('week-slot-ribbon-1');
    expect(slotRibbon).toHaveTextContent('🔒'); // Restriction indicator
  });

  it('shows "No slots" message for days without slots', async () => {
    // Mock response with no slots
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Should show "No slots" for each day
    const noSlotsMessages = await screen.findAllByText('No slots');
    expect(noSlotsMessages).toHaveLength(7); // One for each day of the week
  });

  it('opens slot sheet when ribbon is clicked', async () => {
    // Mock slot data
    const mockSlots = [
      {
        id: '1',
        date: '2025-08-15',
        time: '09:00',
        start_time: '09:00',
        end_time: '10:00',
        capacity: 20,
        booked: 5,
        blackout: false,
        notes: 'Test slot',
        restrictions: {}
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: mockSlots })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Click on slot ribbon
    const slotRibbon = await screen.findByTestId('week-slot-ribbon-1');
    fireEvent.click(slotRibbon);

    // Should open slot sheet
    expect(screen.getByTestId('slot-sheet')).toBeInTheDocument();
  });

  it('displays slot notes when present', async () => {
    // Mock slot with notes
    const mockSlots = [
      {
        id: '1',
        date: '2025-08-15',
        time: '09:00',
        capacity: 20,
        booked: 5,
        blackout: false,
        notes: 'Special handling required',
        restrictions: {}
      }
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ slots: mockSlots })
    });

    const wrapper = render(
      <TestWrapper>
        <AdminPage />
      </TestWrapper>
    );

    // Switch to week view
    const weekButton = await screen.findByText('Week');
    fireEvent.click(weekButton);

    // Check that notes are displayed
    const slotRibbon = await screen.findByTestId('week-slot-ribbon-1');
    expect(slotRibbon).toHaveTextContent('Special handling required');
  });
});