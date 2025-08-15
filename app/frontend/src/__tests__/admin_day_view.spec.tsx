/**
 * Test day view timeline and mobile FAB functionality
 * Ensures desktop timeline draw-to-create and mobile FAB work correctly
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for slot data
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

// Mock window.innerWidth for mobile/desktop detection
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1024, // Default to desktop
});

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

describe('Admin Day View', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    window.innerWidth = 1024; // Reset to desktop
    
    // Mock empty slot response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });
  });

  describe('Desktop Timeline', () => {
    it('renders timeline with hourly slots on desktop', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Check timeline exists
      const timeline = await screen.findByTestId('day-timeline');
      expect(timeline).toBeInTheDocument();
      expect(timeline).toHaveTextContent('Timeline (drag to create slot)');

      // Check timeline hours (6 AM to 8 PM = 15 hours)
      const timelineHours = screen.getAllByTestId(/timeline-hour-\d+/);
      expect(timelineHours).toHaveLength(15);
      
      // Check specific hours
      expect(screen.getByTestId('timeline-hour-6')).toHaveTextContent('6:00');
      expect(screen.getByTestId('timeline-hour-12')).toHaveTextContent('12:00');
      expect(screen.getByTestId('timeline-hour-20')).toHaveTextContent('20:00');
    });

    it('supports draw-to-create by mouse drag on timeline', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Start drag at 9 AM
      const hour9 = await screen.findByTestId('timeline-hour-9');
      fireEvent.mouseDown(hour9);

      // Drag to 11 AM
      const hour11 = screen.getByTestId('timeline-hour-11');
      fireEvent.mouseOver(hour11);

      // Should show drag feedback
      expect(screen.getByText(/Creating slot: 09:00 - 11:00/)).toBeInTheDocument();

      // End drag
      fireEvent.mouseUp(hour11);

      // Should open slot sheet with calculated time range
      await waitFor(() => {
        expect(screen.getByTestId('slot-sheet')).toBeInTheDocument();
      });
    });

    it('shows existing slots on timeline with visual indicators', async () => {
      // Mock slot data for day view
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

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Check that 9 AM slot has visual indicator
      const hour9 = await screen.findByTestId('timeline-hour-9');
      expect(hour9).toHaveClass('bg-blue-100'); // Has slot styling
      expect(hour9).toHaveTextContent('•'); // Slot indicator dot
    });

    it('opens day editor when desktop add button is clicked', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Click desktop add button
      const addButton = await screen.findByTestId('desktop-add-slot-button');
      fireEvent.click(addButton);

      // Should open day editor sheet
      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile FAB', () => {
    beforeEach(() => {
      window.innerWidth = 500; // Mobile viewport
    });

    it('shows mobile FAB button instead of timeline on mobile', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Should show mobile add button
      expect(screen.getByTestId('mobile-add-slot-button')).toBeInTheDocument();
      
      // Should not show timeline on mobile
      expect(screen.queryByTestId('day-timeline')).not.toBeInTheDocument();
    });

    it('opens FAB dialog when mobile add button is clicked', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Click mobile add button
      const fabButton = await screen.findByTestId('mobile-add-slot-button');
      fireEvent.click(fabButton);

      // Should show FAB overlay
      expect(screen.getByTestId('mobile-fab-overlay')).toBeInTheDocument();
      expect(screen.getByText('Create New Slot')).toBeInTheDocument();

      // Check form fields
      expect(screen.getByTestId('mobile-fab-start-time')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-fab-duration')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-fab-capacity')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-fab-notes')).toBeInTheDocument();
    });

    it('creates slot with mobile FAB form values', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Open FAB dialog
      const fabButton = await screen.findByTestId('mobile-add-slot-button');
      fireEvent.click(fabButton);

      // Fill form fields
      const startTimeInput = screen.getByTestId('mobile-fab-start-time') as HTMLInputElement;
      const durationInput = screen.getByTestId('mobile-fab-duration') as HTMLInputElement;
      const capacityInput = screen.getByTestId('mobile-fab-capacity') as HTMLInputElement;
      const notesInput = screen.getByTestId('mobile-fab-notes') as HTMLInputElement;

      fireEvent.change(startTimeInput, { target: { value: '14:30' } });
      fireEvent.change(durationInput, { target: { value: '90' } });
      fireEvent.change(capacityInput, { target: { value: '15' } });
      fireEvent.change(notesInput, { target: { value: 'Afternoon delivery' } });

      // Click create
      const createButton = screen.getByTestId('mobile-fab-create');
      fireEvent.click(createButton);

      // Should open slot sheet with form values
      await waitFor(() => {
        expect(screen.getByTestId('slot-sheet')).toBeInTheDocument();
      });

      // FAB dialog should close
      expect(screen.queryByTestId('mobile-fab-overlay')).not.toBeInTheDocument();
    });

    it('closes FAB dialog when cancel or close is clicked', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Open FAB dialog
      const fabButton = await screen.findByTestId('mobile-add-slot-button');
      fireEvent.click(fabButton);

      // Click close button
      const closeButton = screen.getByTestId('mobile-fab-close');
      fireEvent.click(closeButton);

      // Dialog should close
      expect(screen.queryByTestId('mobile-fab-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Slot List Display', () => {
    it('displays existing slots in list format', async () => {
      // Mock slot data
      const mockSlots = [
        {
          id: '1',
          date: '2025-08-15',
          time: '09:00',
          slot_length_min: 60,
          capacity: 20,
          remaining: 15,
          booked: 5,
          notes: 'Morning slot'
        },
        {
          id: '2',
          date: '2025-08-15',
          time: '14:00',
          slot_length_min: 90,
          capacity: 15,
          remaining: 0,
          booked: 15,
          notes: ''
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

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Check slots are displayed
      const slot1 = await screen.findByTestId('day-slot-1');
      expect(slot1).toHaveTextContent('09:00 (60min)');
      expect(slot1).toHaveTextContent('15/20');
      expect(slot1).toHaveTextContent('Morning slot');

      const slot2 = await screen.findByTestId('day-slot-2');
      expect(slot2).toHaveTextContent('14:00 (90min)');
      expect(slot2).toHaveTextContent('0/15');
    });

    it('shows empty state when no slots exist', async () => {
      const wrapper = render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Should show empty state
      const emptyMessage = await screen.findByText('No slots for this day');
      expect(emptyMessage).toBeInTheDocument();
      
      // Desktop should show timeline instruction
      if (window.innerWidth >= 768) {
        expect(screen.getByText('Drag on timeline above to create')).toBeInTheDocument();
      }
    });

    it('opens slot sheet when existing slot is clicked', async () => {
      // Mock slot data
      const mockSlots = [
        {
          id: '1',
          date: '2025-08-15',
          time: '09:00',
          capacity: 20,
          booked: 5
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

      // Switch to day view
      const dayButton = await screen.findByText('Day');
      fireEvent.click(dayButton);

      // Click on slot
      const slot = await screen.findByTestId('day-slot-1');
      fireEvent.click(slot);

      // Should open slot sheet
      await waitFor(() => {
        expect(screen.getByTestId('slot-sheet')).toBeInTheDocument();
      });
    });
  });
});