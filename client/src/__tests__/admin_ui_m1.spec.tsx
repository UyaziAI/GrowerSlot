import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin UI M1 Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.resetAllMocks();

    // Mock successful API responses
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ([]), // Empty slots array
    });
  });

  describe('Header Simplification', () => {
    it('renders header with only Create and More buttons on the right', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Should have Create dropdown button
      expect(screen.getByTestId('button-create-dropdown')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();

      // Should have More dropdown button  
      expect(screen.getByTestId('button-more-dropdown')).toBeInTheDocument();
      expect(screen.getByText('More')).toBeInTheDocument();
    });

    it('does not show legacy header buttons', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // These legacy buttons should not be in the global header
      expect(screen.queryByText('Blackout')).not.toBeInTheDocument();
      expect(screen.queryByText('Apply Restrictions')).not.toBeInTheDocument();
      expect(screen.queryByText('Create Slots')).not.toBeInTheDocument(); // Not as top-level button
      expect(screen.queryByText('Bulk Create')).not.toBeInTheDocument(); // Not as top-level button
    });

    it('shows Create menu items when dropdown is clicked', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click Create dropdown
      fireEvent.click(screen.getByTestId('button-create-dropdown'));

      // Should show Create Slots (Day) in menu
      expect(screen.getByTestId('menuitem-create-slots')).toBeInTheDocument();
      expect(screen.getByText('Create Slots (Day)')).toBeInTheDocument();

      // Should show Bulk Create Slots in menu
      expect(screen.getByTestId('menuitem-bulk-create')).toBeInTheDocument();
      expect(screen.getByText('Bulk Create Slots')).toBeInTheDocument();

      // Should show Apply Template in menu
      expect(screen.getByTestId('menuitem-apply-template')).toBeInTheDocument();
      expect(screen.getByText('Apply Template')).toBeInTheDocument();
    });

    it('shows More menu items when dropdown is clicked', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click More dropdown
      fireEvent.click(screen.getByTestId('button-more-dropdown'));

      // Should show Export CSV in More menu (not as top-level button)
      expect(screen.getByTestId('menuitem-export-csv')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();

      // Should show Open Filters... in menu
      expect(screen.getByTestId('menuitem-open-filters')).toBeInTheDocument();
      expect(screen.getByText('Open Filters...')).toBeInTheDocument();

      // Should show Help in menu
      expect(screen.getByTestId('menuitem-help')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('shows segmented control for view modes', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Should show Month/Week/Day tabs on the left
      expect(screen.getByTestId('view-mode-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('tab-month')).toBeInTheDocument();
      expect(screen.getByTestId('tab-week')).toBeInTheDocument();
      expect(screen.getByTestId('tab-day')).toBeInTheDocument();
    });

    it('shows date navigation in center', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Should show date navigation controls
      expect(screen.getByTestId('button-prev-date')).toBeInTheDocument();
      expect(screen.getByTestId('button-next-date')).toBeInTheDocument();
      expect(screen.getByTestId('button-today')).toBeInTheDocument();
      expect(screen.getByTestId('button-date-picker')).toBeInTheDocument();
    });
  });

  describe('Day Peek Functionality', () => {
    it('opens DayPeekSheet when a day is clicked', () => {
      // Mock CalendarMonth to simulate day click
      const mockCalendarMonth = vi.fn(({ onDayClick }) => (
        <div data-testid="mock-calendar">
          <button onClick={() => onDayClick('2025-08-15')} data-testid="mock-day-cell">
            Mock Day 15
          </button>
        </div>
      ));

      // Mock the CalendarMonth import
      vi.mock('@/features/booking/components/CalendarMonth', () => ({
        default: mockCalendarMonth
      }));

      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click on a day
      fireEvent.click(screen.getByTestId('mock-day-cell'));

      // Should show Day Peek Sheet
      expect(screen.getByTestId('day-peek-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('day-peek-title')).toBeInTheDocument();
    });

    it('shows correct Day Peek actions', () => {
      // Same mock setup as previous test
      const mockCalendarMonth = vi.fn(({ onDayClick }) => (
        <div data-testid="mock-calendar">
          <button onClick={() => onDayClick('2025-08-15')} data-testid="mock-day-cell">
            Mock Day 15
          </button>
        </div>
      ));

      vi.mock('@/features/booking/components/CalendarMonth', () => ({
        default: mockCalendarMonth
      }));

      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click day to open peek
      fireEvent.click(screen.getByTestId('mock-day-cell'));

      // Should show all required Day Peek actions
      expect(screen.getByTestId('button-create-slots-day')).toBeInTheDocument();
      expect(screen.getByText('Create Slots — Day')).toBeInTheDocument();

      expect(screen.getByTestId('button-blackout-day')).toBeInTheDocument();
      expect(screen.getByText('Blackout Day')).toBeInTheDocument();

      expect(screen.getByTestId('button-restrict-day')).toBeInTheDocument();
      expect(screen.getByText('Restrict Day')).toBeInTheDocument();

      expect(screen.getByTestId('button-open-day-view')).toBeInTheDocument();
      expect(screen.getByText('Open Day view')).toBeInTheDocument();

      expect(screen.getByTestId('button-edit-day')).toBeInTheDocument();
      expect(screen.getByText('Edit Day')).toBeInTheDocument();
    });

    it('shows day summary information in peek', () => {
      const mockCalendarMonth = vi.fn(({ onDayClick }) => (
        <div data-testid="mock-calendar">
          <button onClick={() => onDayClick('2025-08-15')} data-testid="mock-day-cell">
            Mock Day 15
          </button>
        </div>
      ));

      vi.mock('@/features/booking/components/CalendarMonth', () => ({
        default: mockCalendarMonth
      }));

      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click day to open peek
      fireEvent.click(screen.getByTestId('mock-day-cell'));

      // Should show summary badges
      expect(screen.getByTestId('summary-remaining')).toBeInTheDocument();
      expect(screen.getByTestId('summary-booked')).toBeInTheDocument();
      
      // Should show summary values (from mock data)
      expect(screen.getByText(/Remaining: 15/)).toBeInTheDocument();
      expect(screen.getByText(/Booked: 8/)).toBeInTheDocument();
    });

    it('closes Day Peek when close button is clicked', () => {
      const mockCalendarMonth = vi.fn(({ onDayClick }) => (
        <div data-testid="mock-calendar">
          <button onClick={() => onDayClick('2025-08-15')} data-testid="mock-day-cell">
            Mock Day 15
          </button>
        </div>
      ));

      vi.mock('@/features/booking/components/CalendarMonth', () => ({
        default: mockCalendarMonth
      }));

      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click day to open peek
      fireEvent.click(screen.getByTestId('mock-day-cell'));
      expect(screen.getByTestId('day-peek-sheet')).toBeInTheDocument();

      // Click close button
      fireEvent.click(screen.getByTestId('button-close-day-peek'));

      // Should close the peek sheet
      expect(screen.queryByTestId('day-peek-sheet')).not.toBeInTheDocument();
    });

    it('triggers create slots dialog from Day Peek', () => {
      const mockCalendarMonth = vi.fn(({ onDayClick }) => (
        <div data-testid="mock-calendar">
          <button onClick={() => onDayClick('2025-08-15')} data-testid="mock-day-cell">
            Mock Day 15
          </button>
        </div>
      ));

      vi.mock('@/features/booking/components/CalendarMonth', () => ({
        default: mockCalendarMonth
      }));

      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Open day peek
      fireEvent.click(screen.getByTestId('mock-day-cell'));

      // Click Create Slots — Day in peek
      fireEvent.click(screen.getByTestId('button-create-slots-day'));

      // Should open create slots dialog
      expect(screen.getByTestId('create-slots-dialog')).toBeInTheDocument();
      
      // Should close day peek
      expect(screen.queryByTestId('day-peek-sheet')).not.toBeInTheDocument();
    });
  });

  describe('Filter Integration', () => {
    it('opens filter drawer from More menu', () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      // Click More dropdown
      fireEvent.click(screen.getByTestId('button-more-dropdown'));

      // Click Open Filters...
      fireEvent.click(screen.getByTestId('menuitem-open-filters'));

      // Should open filter drawer
      expect(screen.getByTestId('filter-drawer')).toBeInTheDocument();
      expect(screen.getByTestId('filter-drawer-title')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Filters (coming soon)')).toBeInTheDocument();
    });
  });
});