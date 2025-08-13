/**
 * Tests for useSlotsRange hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSlotsRange, groupSlotsByDate, getTimeSegments } from '../hooks/useSlotsRange';
import { slotsApi } from '../../../api/endpoints';

// Mock the API
jest.mock('../../../api/endpoints', () => ({
  slotsApi: {
    getSlotsRange: jest.fn()
  }
}));

const mockSlotsApi = slotsApi as jest.Mocked<typeof slotsApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSlotsRange Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queries API and returns slot data', async () => {
    const mockSlots = [
      {
        id: 'slot-1',
        date: '2025-08-13',
        start_time: '08:00:00',
        end_time: '09:00:00',
        capacity: 20,
        usage: { capacity: 20, booked: 5, remaining: 15 }
      }
    ];
    
    mockSlotsApi.getSlotsRange.mockResolvedValue(mockSlots as any);
    
    const { result } = renderHook(
      () => useSlotsRange('2025-08-13', '2025-08-15'),
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(mockSlotsApi.getSlotsRange).toHaveBeenCalledWith('2025-08-13', '2025-08-15');
    expect(result.current.data).toEqual(mockSlots);
  });

  test('is disabled when dates are missing', () => {
    const { result } = renderHook(
      () => useSlotsRange('', '2025-08-15'),
      { wrapper: createWrapper() }
    );
    
    expect(result.current.isPending).toBe(false);
    expect(mockSlotsApi.getSlotsRange).not.toHaveBeenCalled();
  });

  test('can be manually disabled', () => {
    const { result } = renderHook(
      () => useSlotsRange('2025-08-13', '2025-08-15', false),
      { wrapper: createWrapper() }
    );
    
    expect(result.current.isPending).toBe(false);
    expect(mockSlotsApi.getSlotsRange).not.toHaveBeenCalled();
  });
});

describe('groupSlotsByDate Utility', () => {
  test('groups slots by date correctly', () => {
    const slots = [
      { id: 'slot-1', date: '2025-08-13' },
      { id: 'slot-2', date: '2025-08-14' },
      { id: 'slot-3', date: '2025-08-13' }
    ] as any;
    
    const grouped = groupSlotsByDate(slots);
    
    expect(grouped['2025-08-13']).toHaveLength(2);
    expect(grouped['2025-08-14']).toHaveLength(1);
    expect(grouped['2025-08-13'][0].id).toBe('slot-1');
    expect(grouped['2025-08-13'][1].id).toBe('slot-3');
  });

  test('handles empty slot array', () => {
    const grouped = groupSlotsByDate([]);
    expect(Object.keys(grouped)).toHaveLength(0);
  });
});

describe('getTimeSegments Utility', () => {
  test('generates correct time segments', () => {
    const segments = getTimeSegments(8, 10, 30); // 8-10 AM, 30 min segments
    
    expect(segments).toHaveLength(4); // 8:00, 8:30, 9:00, 9:30
    expect(segments[0]).toEqual({
      time: '08:00',
      hour: 8,
      minute: 0,
      label: '8:00'
    });
    expect(segments[1]).toEqual({
      time: '08:30',
      hour: 8,
      minute: 30,
      label: '8:30'
    });
  });

  test('uses default parameters correctly', () => {
    const segments = getTimeSegments(); // Default 6-18, 30 min
    
    expect(segments.length).toBeGreaterThan(20); // Should have many segments
    expect(segments[0].time).toBe('06:00');
    expect(segments[segments.length - 1].time).toBe('17:30');
  });

  test('handles different segment durations', () => {
    const segments = getTimeSegments(8, 10, 60); // 1 hour segments
    
    expect(segments).toHaveLength(2); // 8:00, 9:00
    expect(segments[0].time).toBe('08:00');
    expect(segments[1].time).toBe('09:00');
  });
});