import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DayPeekSheet } from '../pages/DayPeekSheet';
import { DayEditorSheet } from '../pages/DayEditorSheet';
import { BulkBar } from '../pages/BulkBar';
import { toZonedTime } from 'date-fns-tz';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin UI M5 Copy & Safeguards Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Mock successful API responses by default
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
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

  describe('Past Date Blocking', () => {
    it('DayPeekSheet disables actions for past dates', () => {
      const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      render(
        <DayPeekSheet
          dateISO={yesterdayISO}
          summary={{ remaining: 0, booked: 5, blackout: false, restricted: false }}
          isOpen={true}
          onClose={() => {}}
          onCreateDay={() => {}}
          onBlackoutDay={() => {}}
          onRestrictDay={() => {}}
          onOpenEditor={() => {}}
          onOpenDayView={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Buttons should be disabled
      expect(screen.getByTestId('button-create-day')).toBeDisabled();
      expect(screen.getByTestId('button-blackout-day')).toBeDisabled();
      expect(screen.getByTestId('button-restrict-day')).toBeDisabled();
      
      // Past date warning should be shown
      expect(screen.getByTestId('past-date-warning')).toBeInTheDocument();
    });

    it('DayEditorSheet disables quick create for past dates', async () => {
      const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      render(
        <DayEditorSheet
          dateISO={yesterdayISO}
          isOpen={true}
          onClose={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Quick create button should be disabled
      expect(screen.getByTestId('button-quick-create-slot')).toBeDisabled();
      expect(screen.getByTestId('button-blackout-day')).toBeDisabled();
    });

    it('BulkBar disables actions when selection includes past dates', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const selectedDates = [yesterday, today];

      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => {}}
          onDone={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Bulk actions should be disabled
      expect(screen.getByTestId('button-bulk-blackout')).toBeDisabled();
      expect(screen.getByTestId('button-bulk-restrictions')).toBeDisabled();
      
      // Past date warning should be shown
      expect(screen.getByTestId('bulk-past-date-warning')).toBeInTheDocument();
    });
  });

  describe('Scoped Confirmations', () => {
    it('DayPeekSheet shows date-specific confirmation text', async () => {
      const todayISO = new Date().toISOString().split('T')[0];
      
      render(
        <DayPeekSheet
          dateISO={todayISO}
          summary={{ remaining: 10, booked: 0, blackout: false, restricted: false }}
          isOpen={true}
          onClose={() => {}}
          onCreateDay={() => {}}
          onBlackoutDay={() => {}}
          onRestrictDay={() => {}}
          onOpenEditor={() => {}}
          onOpenDayView={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Click blackout button to open dialog
      fireEvent.click(screen.getByTestId('button-blackout-day'));

      await waitFor(() => {
        const confirmationText = screen.getByTestId('blackout-confirmation-text');
        expect(confirmationText).toBeInTheDocument();
        // Should contain the specific date
        expect(confirmationText.textContent).toContain(todayISO);
      });
    });

    it('BulkBar shows count-specific confirmation text', async () => {
      const selectedDates = ['2025-08-16', '2025-08-17', '2025-08-18'];

      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => {}}
          onDone={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Click blackout button to open dialog
      fireEvent.click(screen.getByTestId('button-bulk-blackout'));

      await waitFor(() => {
        const confirmationText = screen.getByTestId('bulk-blackout-confirmation-text');
        expect(confirmationText).toBeInTheDocument();
        // Should contain the count "3 selected days"
        expect(confirmationText.textContent).toContain('3 selected days');
      });
    });

    it('DayEditorSheet shows contextual blackout confirmation', async () => {
      const todayISO = new Date().toISOString().split('T')[0];
      
      render(
        <DayEditorSheet
          dateISO={todayISO}
          isOpen={true}
          onClose={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Click blackout button to open dialog
      fireEvent.click(screen.getByTestId('button-blackout-day'));

      await waitFor(() => {
        const confirmationText = screen.getByTestId('blackout-day-confirmation-text');
        expect(confirmationText).toBeInTheDocument();
        // Should contain the specific date
        expect(confirmationText.textContent).toContain(todayISO);
      });
    });
  });

  describe('Error Message Handling', () => {
    it('DayEditorSheet displays verbatim 422 error from server', async () => {
      // Mock 422 error response
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({ 
            error: 'Slot capacity cannot exceed 50 for this cultivar type' 
          }),
        });
      });

      const todayISO = new Date().toISOString().split('T')[0];
      
      render(
        <DayEditorSheet
          dateISO={todayISO}
          isOpen={true}
          onClose={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Fill out form and submit
      fireEvent.change(screen.getByTestId('input-slot-capacity'), {
        target: { value: '100' }
      });

      fireEvent.click(screen.getByTestId('button-quick-create-slot'));

      // Should show the exact error message from server
      await waitFor(() => {
        const errorMessage = screen.getByTestId('api-error-message');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toBe('Slot capacity cannot exceed 50 for this cultivar type');
      });
    });

    it('BulkBar displays verbatim 403 error from server', async () => {
      // Mock 403 error response
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({ 
            error: 'Insufficient permissions to blackout protected days' 
          }),
        });
      });

      const selectedDates = ['2025-08-16', '2025-08-17'];

      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => {}}
          onDone={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Click blackout and confirm
      fireEvent.click(screen.getByTestId('button-bulk-blackout'));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-bulk-blackout')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('confirm-bulk-blackout'));

      // Should show the exact error message from server
      await waitFor(() => {
        const errorMessage = screen.getByTestId('bulk-api-error-message');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toBe('Insufficient permissions to blackout protected days');
      });
    });

    it('handles 409 conflict error with specific message', async () => {
      // Mock 409 conflict response
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ 
            error: 'Cannot modify slots with existing bookings' 
          }),
        });
      });

      const todayISO = new Date().toISOString().split('T')[0];
      
      render(
        <DayEditorSheet
          dateISO={todayISO}
          isOpen={true}
          onClose={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });

      // Trigger blackout action
      fireEvent.click(screen.getByTestId('button-blackout-day'));
      
      await waitFor(() => {
        expect(screen.getByTestId('confirm-blackout-day-action')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('confirm-blackout-day-action'));

      // Should show the exact 409 error message
      await waitFor(() => {
        const errorMessage = screen.getByTestId('api-error-message');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage.textContent).toBe('Cannot modify slots with existing bookings');
      });
    });
  });

  describe('Date Input Validation', () => {
    it('BulkBar source date input has min attribute set to today', () => {
      const selectedDates = ['2025-08-20', '2025-08-21'];

      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => {}}
          onDone={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Open duplicate sheet to access source date input
      fireEvent.click(screen.getByTestId('button-bulk-duplicate'));

      const sourceDateInput = screen.getByTestId('input-source-date');
      expect(sourceDateInput).toHaveAttribute('min');
      
      // Min should be today's date in Africa/Johannesburg timezone
      const todayISO = toZonedTime(new Date(), 'Africa/Johannesburg').toISOString().split('T')[0];
      expect(sourceDateInput).toHaveAttribute('min', todayISO);
    });

    it('form validation prevents submission with invalid dates', () => {
      const selectedDates = ['2025-08-20', '2025-08-21'];

      render(
        <BulkBar
          selectedDates={selectedDates}
          onClearSelection={() => {}}
          onDone={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Open duplicate sheet
      fireEvent.click(screen.getByTestId('button-bulk-duplicate'));

      // Button should be disabled without valid source date
      expect(screen.getByTestId('button-confirm-duplicate')).toBeDisabled();

      // Set a past date (should still be disabled due to validation)
      const yesterdayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      fireEvent.change(screen.getByTestId('input-source-date'), {
        target: { value: yesterdayISO }
      });

      // Should remain disabled due to past date
      expect(screen.getByTestId('button-confirm-duplicate')).toBeDisabled();
    });
  });

  describe('Integration Tests', () => {
    it('complete flow: future date → enabled actions → confirmation → success', async () => {
      const futureISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      render(
        <DayPeekSheet
          dateISO={futureISO}
          summary={{ remaining: 15, booked: 0, blackout: false, restricted: false }}
          isOpen={true}
          onClose={() => {}}
          onCreateDay={() => {}}
          onBlackoutDay={vi.fn()}
          onRestrictDay={() => {}}
          onOpenEditor={() => {}}
          onOpenDayView={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Actions should be enabled for future date
      expect(screen.getByTestId('button-blackout-day')).not.toBeDisabled();
      
      // Should not show past date warning
      expect(screen.queryByTestId('past-date-warning')).not.toBeInTheDocument();

      // Click blackout and verify confirmation dialog
      fireEvent.click(screen.getByTestId('button-blackout-day'));

      await waitFor(() => {
        const confirmationText = screen.getByTestId('blackout-confirmation-text');
        expect(confirmationText.textContent).toContain(futureISO);
      });

      // Confirm action
      fireEvent.click(screen.getByTestId('confirm-blackout-day'));

      // Should call the API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/v1/slots/blackout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        });
      });
    });

    it('complete flow: past date → disabled actions → warning shown', () => {
      const pastISO = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      render(
        <DayPeekSheet
          dateISO={pastISO}
          summary={{ remaining: 0, booked: 10, blackout: false, restricted: false }}
          isOpen={true}
          onClose={() => {}}
          onCreateDay={() => {}}
          onBlackoutDay={() => {}}
          onRestrictDay={() => {}}
          onOpenEditor={() => {}}
          onOpenDayView={() => {}}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // All actions should be disabled
      expect(screen.getByTestId('button-create-day')).toBeDisabled();
      expect(screen.getByTestId('button-blackout-day')).toBeDisabled();
      expect(screen.getByTestId('button-restrict-day')).toBeDisabled();
      
      // Warning should be visible
      expect(screen.getByTestId('past-date-warning')).toBeInTheDocument();
      expect(screen.getByTestId('past-date-warning').textContent).toContain('Actions disabled for past dates');
    });
  });
});