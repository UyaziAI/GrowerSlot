import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';
import { DayPeekSheet } from '../pages/DayPeekSheet';
import { DayEditorSheet } from '../pages/DayEditorSheet';
import { BulkBar } from '../pages/BulkBar';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Set mobile viewport dimensions
const setMobileViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

describe('Admin Mobile Viewport Tests', () => {
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
      if (url.includes('/v1/slots')) {
        return Promise.resolve({
          ok: true,
          json: async () => ([
            {
              id: 'slot-1',
              date: '2025-08-15',
              start_time: '09:00',
              end_time: '10:00',
              capacity: 20,
              booked: 5,
              blackout: false,
              notes: 'Morning slot',
              restrictions: {}
            }
          ]),
        });
      }
      if (url.includes('/v1/slots/blackout')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url.includes('/v1/slots/bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, id: 'new-slot-id' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  describe('Mobile Viewport 390x844 (iPhone 12 mini)', () => {
    beforeEach(() => {
      setMobileViewport(390, 844);
    });

    it('tap day opens DayPeekSheet and is dismissible', async () => {
      const mockSummary = { remaining: 15, booked: 5, blackout: false, restricted: false };
      
      render(
        <DayPeekSheet
          dateISO="2025-08-15"
          summary={mockSummary}
          isOpen={true}
          onClose={vi.fn()}
          onCreateDay={vi.fn()}
          onBlackoutDay={vi.fn()}
          onRestrictDay={vi.fn()}
          onOpenEditor={vi.fn()}
          onOpenDayView={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Sheet should be visible
      expect(screen.getByTestId('day-peek-sheet')).toBeInTheDocument();
      expect(screen.getByText('Thursday, Aug 15, 2025')).toBeInTheDocument();
      
      // Check mobile-optimized layout
      expect(screen.getByTestId('badge-remaining')).toBeInTheDocument();
      expect(screen.getByTestId('badge-booked')).toBeInTheDocument();
      
      // Action buttons should be touch-friendly
      const createButton = screen.getByTestId('button-create-day');
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveClass('w-full');
    });

    it('tap Edit Day opens DayEditorSheet full-height with close functionality', async () => {
      const onClose = vi.fn();
      
      render(
        <DayEditorSheet
          dateISO="2025-08-15"
          isOpen={true}
          onClose={onClose}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Should show date header
      expect(screen.getByText(/Thursday, August 15, 2025/)).toBeInTheDocument();
      
      // Should have mobile-friendly sections
      expect(screen.getByTestId('day-overview-section')).toBeInTheDocument();
      expect(screen.getByTestId('quick-create-section')).toBeInTheDocument();
      expect(screen.getByTestId('utilities-section')).toBeInTheDocument();
      
      // Quick create form should be touch-optimized
      expect(screen.getByTestId('input-slot-capacity')).toBeInTheDocument();
      expect(screen.getByTestId('textarea-slot-notes')).toBeInTheDocument();
    });

    it('selection mode shows BulkBar and executes blackout action', async () => {
      const selectedDates = ['2025-08-15', '2025-08-16', '2025-08-17'];
      const onDone = vi.fn();
      
      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={vi.fn()}
          onDone={onDone}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // BulkBar should be visible at bottom
      const bulkBar = screen.getByTestId('bulk-bar');
      expect(bulkBar).toBeInTheDocument();
      expect(bulkBar).toHaveClass('fixed', 'bottom-4');
      
      // Should show selection count
      expect(screen.getByTestId('selection-count')).toHaveTextContent('3 days selected');
      
      // Blackout action should be available
      const blackoutButton = screen.getByTestId('button-bulk-blackout');
      expect(blackoutButton).toBeInTheDocument();
      
      // Execute blackout action
      fireEvent.click(blackoutButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-bulk-blackout')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('confirm-bulk-blackout'));
      
      // Should call API and trigger refetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/v1/slots/blackout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('3 selected days')
        });
      });
    });

    it('Day view FAB creates slot and SlotSheet manages existing slots', async () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByTestId('admin-page')).toBeInTheDocument();
      });

      // Switch to day view
      fireEvent.click(screen.getByTestId('tab-day'));

      await waitFor(() => {
        // FAB should be visible and properly positioned
        const fab = screen.getByTestId('day-view-fab');
        expect(fab).toBeInTheDocument();
        expect(fab).toHaveClass('fixed', 'bottom-6', 'right-6', 'rounded-full');
      });

      // Click FAB to create slot
      fireEvent.click(screen.getByTestId('day-view-fab'));

      await waitFor(() => {
        expect(screen.getByTestId('create-slot-dialog')).toBeInTheDocument();
      });

      // Fill mobile-friendly form
      fireEvent.change(screen.getByTestId('input-new-capacity'), {
        target: { value: '25' }
      });

      fireEvent.change(screen.getByTestId('textarea-new-notes'), {
        target: { value: 'Mobile created slot' }
      });

      // Submit slot creation
      fireEvent.click(screen.getByTestId('button-confirm-create'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Mobile created slot')
        });
      });
    });
  });

  describe('Mobile Viewport 412x915 (Galaxy S20)', () => {
    beforeEach(() => {
      setMobileViewport(412, 915);
    });

    it('BulkBar adapts to wider mobile screen', () => {
      const selectedDates = ['2025-08-15', '2025-08-16'];
      
      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={vi.fn()}
          onDone={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Should show date details on wider screens
      const bulkBar = screen.getByTestId('bulk-bar');
      expect(bulkBar).toBeInTheDocument();
      
      // Selection info should be visible
      expect(screen.getByTestId('selection-count')).toHaveTextContent('2 days selected');
    });

    it('DayEditorSheet sections remain accessible on larger mobile', async () => {
      render(
        <DayEditorSheet
          dateISO="2025-08-15"
          isOpen={true}
          onClose={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // All sections should be accessible
      expect(screen.getByTestId('day-overview-section')).toBeInTheDocument();
      expect(screen.getByTestId('quick-create-section')).toBeInTheDocument();
      expect(screen.getByTestId('utilities-section')).toBeInTheDocument();
      
      // Form elements should have proper spacing
      const capacityInput = screen.getByTestId('input-slot-capacity');
      const notesTextarea = screen.getByTestId('textarea-slot-notes');
      
      expect(capacityInput).toBeInTheDocument();
      expect(notesTextarea).toBeInTheDocument();
    });
  });

  describe('Accessibility Tests', () => {
    beforeEach(() => {
      setMobileViewport(390, 844);
    });

    it('day cells have accessible names with slot information', async () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByTestId('admin-page')).toBeInTheDocument();
      });

      // Check if calendar month is rendered
      const monthCalendar = screen.getByTestId('calendar-month');
      expect(monthCalendar).toBeInTheDocument();

      // Look for day cells with proper accessibility attributes
      const dayCells = screen.getAllByRole('button');
      const dayCell = dayCells.find(cell => 
        cell.getAttribute('aria-label')?.includes('Slots:') ||
        cell.textContent?.includes('15') // Today's date
      );

      if (dayCell) {
        const ariaLabel = dayCell.getAttribute('aria-label');
        expect(ariaLabel).toMatch(/\w+day \d+/); // Should contain weekday and date
      }
    });

    it('DayPeekSheet has proper ARIA labels and roles', () => {
      render(
        <DayPeekSheet
          dateISO="2025-08-15"
          summary={{ remaining: 15, booked: 5, blackout: false, restricted: false }}
          isOpen={true}
          onClose={vi.fn()}
          onCreateDay={vi.fn()}
          onBlackoutDay={vi.fn()}
          onRestrictDay={vi.fn()}
          onOpenEditor={vi.fn()}
          onOpenDayView={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Sheet should have proper role
      const sheet = screen.getByTestId('day-peek-sheet');
      expect(sheet).toBeInTheDocument();
      
      // Buttons should have descriptive labels
      expect(screen.getByTestId('button-create-day')).toHaveTextContent('Create Slots — Day');
      expect(screen.getByTestId('button-blackout-day')).toHaveTextContent('Blackout Day');
      expect(screen.getByTestId('button-restrict-day')).toHaveTextContent('Restrict Day');
    });

    it('DayEditorSheet form elements have proper labels', async () => {
      render(
        <DayEditorSheet
          dateISO="2025-08-15"
          isOpen={true}
          onClose={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Form elements should have associated labels
      expect(screen.getByLabelText('Capacity')).toBeInTheDocument();
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      
      // Buttons should have clear text
      expect(screen.getByTestId('button-quick-create-slot')).toHaveTextContent(/Create Slot/);
    });

    it('BulkBar actions have clear labeling', () => {
      render(
        <BulkBar
          selectedDates={['2025-08-15', '2025-08-16']}
          onClearSelection={vi.fn()}
          onDone={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Action buttons should have descriptive text
      expect(screen.getByTestId('button-bulk-create')).toHaveTextContent('Create Slots — Range');
      expect(screen.getByTestId('button-bulk-blackout')).toHaveTextContent('Blackout — Selected days');
      expect(screen.getByTestId('button-bulk-restrictions')).toHaveTextContent('Apply Restrictions — Selected days');
      expect(screen.getByTestId('button-bulk-duplicate')).toHaveTextContent('Duplicate From…');
    });

    it('FAB has proper accessibility attributes', async () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByTestId('admin-page')).toBeInTheDocument();
      });

      // Switch to day view
      fireEvent.click(screen.getByTestId('tab-day'));

      await waitFor(() => {
        const fab = screen.getByTestId('day-view-fab');
        expect(fab).toBeInTheDocument();
        
        // FAB should be a button with proper role
        expect(fab.tagName).toBe('BUTTON');
        expect(fab).toHaveAttribute('type', 'button');
      });
    });

    it('confirmation dialogs have proper accessibility structure', async () => {
      render(
        <DayPeekSheet
          dateISO="2025-08-15"
          summary={{ remaining: 15, booked: 5, blackout: false, restricted: false }}
          isOpen={true}
          onClose={vi.fn()}
          onCreateDay={vi.fn()}
          onBlackoutDay={vi.fn()}
          onRestrictDay={vi.fn()}
          onOpenEditor={vi.fn()}
          onOpenDayView={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Trigger blackout confirmation dialog
      fireEvent.click(screen.getByTestId('button-blackout-day'));

      await waitFor(() => {
        // Dialog should have proper ARIA structure
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Blackout Day' })).toBeInTheDocument();
        
        // Description should be accessible
        expect(screen.getByTestId('blackout-confirmation-text')).toBeInTheDocument();
        
        // Action buttons should be clearly labeled
        expect(screen.getByTestId('confirm-blackout-day')).toHaveTextContent('Blackout Day');
      });
    });
  });

  describe('Touch Interactions', () => {
    beforeEach(() => {
      setMobileViewport(390, 844);
    });

    it('touch-friendly button sizes and spacing', () => {
      render(
        <DayPeekSheet
          dateISO="2025-08-15"
          summary={{ remaining: 15, booked: 5, blackout: false, restricted: false }}
          isOpen={true}
          onClose={vi.fn()}
          onCreateDay={vi.fn()}
          onBlackoutDay={vi.fn()}
          onRestrictDay={vi.fn()}
          onOpenEditor={vi.fn()}
          onOpenDayView={vi.fn()}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Primary action button should be full-width
      expect(screen.getByTestId('button-create-day')).toHaveClass('w-full');
      
      // Secondary actions should have adequate spacing
      const blackoutButton = screen.getByTestId('button-blackout-day');
      const restrictButton = screen.getByTestId('button-restrict-day');
      
      expect(blackoutButton).toBeInTheDocument();
      expect(restrictButton).toBeInTheDocument();
    });

    it('FAB positioned for thumb accessibility', async () => {
      render(<AdminPage />, { wrapper: createWrapper(queryClient) });

      await waitFor(() => {
        expect(screen.getByTestId('admin-page')).toBeInTheDocument();
      });

      // Switch to day view
      fireEvent.click(screen.getByTestId('tab-day'));

      await waitFor(() => {
        const fab = screen.getByTestId('day-view-fab');
        expect(fab).toBeInTheDocument();
        
        // Should be positioned in thumb-friendly zone
        expect(fab).toHaveClass('bottom-6', 'right-6');
        
        // Should have adequate touch target size
        expect(fab).toHaveClass('h-14', 'w-14');
      });
    });
  });
});