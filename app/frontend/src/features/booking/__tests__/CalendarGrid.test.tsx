/**
 * Tests for CalendarGrid component
 */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CalendarGrid from '../components/CalendarGrid';
import { type SlotResponse } from '../../../v1/endpoints';

// Mock data
const mockSlots: SlotResponse[] = [
  {
    id: 'slot-1',
    tenant_id: 'tenant-1',
    date: '2025-08-13',
    start_time: '08:00:00',
    end_time: '09:00:00',
    capacity: 20,
    resource_unit: 'tons',
    blackout: false,
    notes: 'Test slot',
    usage: {
      capacity: 20,
      booked: 5,
      remaining: 15
    },
    restrictions: null
  },
  {
    id: 'slot-2', 
    tenant_id: 'tenant-1',
    date: '2025-08-13',
    start_time: '10:00:00',
    end_time: '11:00:00',
    capacity: 15,
    resource_unit: 'tons',
    blackout: true,
    notes: 'Maintenance',
    usage: {
      capacity: 15,
      booked: 0,
      remaining: 15
    },
    restrictions: {
      growers: ['grower-1'],
      cultivars: []
    }
  }
];

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('CalendarGrid Component', () => {
  test('renders correct number of time cells in day view', () => {
    const selectedDate = new Date('2025-08-13');
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={mockSlots}
          viewMode="day"
          selectedDate={selectedDate}
        />
      </TestWrapper>
    );
    
    expect(screen.getByTestId('calendar-grid-day')).toBeInTheDocument();
    
    // Should show both slots for the date
    expect(screen.getByTestId('slot-card-slot-1')).toBeInTheDocument();
    expect(screen.getByTestId('slot-card-slot-2')).toBeInTheDocument();
  });

  test('places slot cards at expected time positions', () => {
    const selectedDate = new Date('2025-08-13');
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={mockSlots}
          viewMode="day"
          selectedDate={selectedDate}
        />
      </TestWrapper>
    );
    
    // Check slot times are displayed
    expect(screen.getByText('08:00:00 - 09:00:00')).toBeInTheDocument();
    expect(screen.getByText('10:00:00 - 11:00:00')).toBeInTheDocument();
  });

  test('shows capacity bar and badges for blackout/restrictions', () => {
    const selectedDate = new Date('2025-08-13');
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={mockSlots}
          viewMode="day"
          selectedDate={selectedDate}
        />
      </TestWrapper>
    );
    
    // Check capacity display for available slot
    expect(screen.getByText('5.0/20.0 tons')).toBeInTheDocument();
    expect(screen.getByText('15.0 remaining')).toBeInTheDocument();
    
    // Check blackout badge
    expect(screen.getByText('Blackout')).toBeInTheDocument();
    
    // Check restricted badge  
    expect(screen.getByText('Restricted')).toBeInTheDocument();
    
    // Check capacity bars exist
    expect(screen.getByTestId('capacity-bar-slot-1')).toBeInTheDocument();
  });

  test('renders week view with 7 day columns', () => {
    const selectedDate = new Date('2025-08-13'); // Wednesday
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={[]} // Empty for week view test
          viewMode="week"
          selectedDate={selectedDate}
        />
      </TestWrapper>
    );
    
    expect(screen.getByTestId('calendar-grid-week')).toBeInTheDocument();
    
    // Should show all 7 days of the week
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    
    // Should show time column
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  test('handles empty slot list gracefully', () => {
    const selectedDate = new Date('2025-08-13');
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={[]}
          viewMode="day"
          selectedDate={selectedDate}
        />
      </TestWrapper>
    );
    
    expect(screen.getByText('No slots available for this date')).toBeInTheDocument();
  });

  test('handles slot click events', () => {
    const selectedDate = new Date('2025-08-13');
    const mockOnSlotClick = jest.fn();
    
    render(
      <TestWrapper>
        <CalendarGrid
          slots={mockSlots}
          viewMode="day"
          selectedDate={selectedDate}
          onSlotClick={mockOnSlotClick}
        />
      </TestWrapper>
    );
    
    const slotCard = screen.getByTestId('slot-card-slot-1');
    slotCard.click();
    
    expect(mockOnSlotClick).toHaveBeenCalledWith(mockSlots[0]);
  });
});