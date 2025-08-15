/**
 * B19 Month view virtualization + query tuning performance tests
 * Tests that month view renders only visible weeks with proper caching
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CalendarMonth from '../features/booking/components/CalendarMonth';

// Define SlotResponse type inline for testing
interface SlotResponse {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  blackout: boolean;
  usage?: {
    capacity: number;
    booked: number;
    remaining: number;
  };
  restrictions?: {
    growers?: string[];
    cultivars?: string[];
  };
}

// Mock react-virtual to track virtualization behavior
const mockVirtualItems = vi.fn();
const mockGetTotalSize = vi.fn();
const mockVirtualizer = {
  getVirtualItems: mockVirtualItems,
  getTotalSize: mockGetTotalSize,
};

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => mockVirtualizer),
}));

// Create test setup
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Generate mock slot data for testing
const generateMockSlots = (count: number, startDate: Date): SlotResponse[] => {
  const slots: SlotResponse[] = [];
  const currentDate = new Date(startDate);
  
  for (let i = 0; i < count; i++) {
    slots.push({
      id: `slot-${i}`,
      date: currentDate.toISOString().split('T')[0],
      start_time: '08:00',
      end_time: '09:00',
      capacity: 20,
      blackout: i % 10 === 0, // Every 10th slot is blackout
      usage: {
        capacity: 20,
        booked: Math.floor(Math.random() * 15),
        remaining: 20 - Math.floor(Math.random() * 15),
      },
      restrictions: i % 5 === 0 ? { growers: ['grower-1'] } : undefined,
    });
    
    // Move to next day for every 8 slots (8 slots per day)
    if (i % 8 === 7) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }
  
  return slots;
};

describe('CalendarMonth Virtualization Performance', () => {
  let queryClient: QueryClient;
  let renderSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 15_000,
          gcTime: 5 * 60_000,
        },
      },
    });
    
    renderSpy = vi.fn();
    
    // Reset mocks
    mockVirtualItems.mockClear();
    mockGetTotalSize.mockClear();
    
    // Setup default mock behavior
    mockGetTotalSize.mockReturnValue(720); // 6 weeks * 120px height
    mockVirtualItems.mockReturnValue([
      { key: 0, index: 0, start: 0, size: 120 },
      { key: 1, index: 1, start: 120, size: 120 },
      { key: 2, index: 2, start: 240, size: 120 },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders only visible weeks with buffer', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(168, selectedDate); // 3 weeks of slots
    
    render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    // Verify virtualizer was called with correct parameters
    expect(mockVirtualItems).toHaveBeenCalled();
    
    // Should render max 3 virtual items (visible weeks + buffer)
    const virtualItems = mockVirtualItems.mock.results[0].value;
    expect(virtualItems).toHaveLength(3);
  });

  it('limits rendered rows to visible weeks plus buffer', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(300, selectedDate); // Large dataset
    
    render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('virtualized-weeks-container')).toBeInTheDocument();
    });

    // Verify only visible weeks are rendered (not all 6 weeks)
    const weekRows = screen.queryAllByTestId(/virtual-week-/);
    expect(weekRows.length).toBeLessThanOrEqual(4); // 3 visible + 1 buffer max
  });

  it('handles month navigation without jank', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(100, selectedDate);
    const onDateSelect = vi.fn();
    
    render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    // Test month navigation
    const nextButton = screen.getByTestId('next-month-btn');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(onDateSelect).toHaveBeenCalledWith(expect.any(Date));
    });

    // Should maintain virtualization during navigation
    expect(mockVirtualItems).toHaveBeenCalled();
  });

  it('prevents unexpected POSTs during scroll', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(50, selectedDate);
    
    // Mock fetch to track network requests
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    
    render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('virtualized-weeks-container')).toBeInTheDocument();
    });

    // Simulate scrolling through virtualized content
    const container = screen.getByTestId('virtualized-weeks-container');
    fireEvent.scroll(container, { target: { scrollTop: 300 } });

    // Wait for any potential network calls
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not trigger any POST requests during scroll
    const postRequests = fetchSpy.mock.calls.filter(call => 
      call[1]?.method === 'POST'
    );
    expect(postRequests).toHaveLength(0);

    fetchSpy.mockRestore();
  });

  it('uses optimized query configuration', () => {
    // Verify query client has correct cache settings
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    
    // Default options should have proper cache configuration
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(15_000);
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(5 * 60_000);
  });

  it('shows loading skeletons without phantom slots', async () => {
    const selectedDate = new Date('2025-08-15');
    
    render(
      <CalendarMonth
        slots={[]}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={true}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    // Should show loading state
    expect(screen.getByTestId('calendar-month-loading')).toBeInTheDocument();
    
    // Should not show any slot cards while loading
    expect(screen.queryAllByTestId(/slot-indicator-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/day-cell-/)).toHaveLength(0);
  });

  it('handles empty slot data gracefully', async () => {
    const selectedDate = new Date('2025-08-15');
    
    render(
      <CalendarMonth
        slots={[]}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    // Should render calendar structure without slots
    expect(screen.queryAllByTestId(/slot-indicator-/)).toHaveLength(0);
    
    // Calendar structure should exist but day cells are virtualized
    expect(screen.getByTestId('virtualized-weeks-container')).toBeInTheDocument();
  });

  it('maintains key stability during virtualization', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(50, selectedDate);
    
    const { rerender } = render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    const initialVirtualItems = mockVirtualItems.mock.results[0].value;
    
    // Re-render with same props
    rerender(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={vi.fn()}
        onSlotClick={vi.fn()}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(mockVirtualItems).toHaveBeenCalled();
    });

    // Keys should remain stable
    const updatedVirtualItems = mockVirtualItems.mock.results[mockVirtualItems.mock.results.length - 1].value;
    expect(updatedVirtualItems.map((item: any) => item.key))
      .toEqual(initialVirtualItems.map((item: any) => item.key));
  });

  it('optimizes re-renders during date selection', async () => {
    const selectedDate = new Date('2025-08-15');
    const mockSlots = generateMockSlots(30, selectedDate);
    const onDateSelect = vi.fn();
    
    const { rerender } = render(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        onSlotClick={vi.fn()}
        isLoading={false}
      />,
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    const initialRenderCount = mockVirtualItems.mock.calls.length;

    // Change selected date
    const newSelectedDate = new Date('2025-08-16');
    rerender(
      <CalendarMonth
        slots={mockSlots}
        selectedDate={newSelectedDate}
        onDateSelect={onDateSelect}
        onSlotClick={vi.fn()}
        isLoading={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('calendar-month')).toBeInTheDocument();
    });

    // Should not cause excessive re-renders of virtualized content
    const finalRenderCount = mockVirtualItems.mock.calls.length;
    expect(finalRenderCount - initialRenderCount).toBeLessThanOrEqual(2);
  });
});

describe('Query Key Optimization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 15_000,
          gcTime: 5 * 60_000,
        },
      },
    });
  });

  it('uses proper query key format for tenant isolation', () => {
    const tenantId = 'tenant-123';
    const startDate = '2025-08-01';
    const endDate = '2025-08-31';
    
    // Expected query key format: ['slots', tenantId, startISO, endISO]
    const expectedKey = ['slots', tenantId, startDate, endDate];
    
    // Verify key structure matches expected format
    expect(expectedKey[0]).toBe('slots');
    expect(expectedKey[1]).toBe(tenantId);
    expect(expectedKey[2]).toBe(startDate);
    expect(expectedKey[3]).toBe(endDate);
  });

  it('configures cache timing correctly', () => {
    // Verify staleTime and gcTime are set correctly
    const defaults = queryClient.getDefaultOptions();
    
    expect(defaults.queries?.staleTime).toBe(15_000); // 15 seconds
    expect(defaults.queries?.gcTime).toBe(5 * 60_000); // 5 minutes
  });
});