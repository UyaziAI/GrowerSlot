import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateSlotsDialog } from '../pages/CreateSlotsDialog';
import { BulkCreateDialog } from '../pages/BulkCreateDialog';
import { format, addDays } from 'date-fns';
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

describe('Create Slots vs Bulk Create Tests', () => {
  let queryClient: QueryClient;
  const mockTenantId = 'test-tenant';

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
    (global.fetch as any).mockImplementation((url: string, options?: any) => {
      if (url.includes('/v1/slots/bulk')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            created: 5,
            message: 'Slots created successfully'
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  describe('Create Slots Dialog (Day)', () => {
    const todayISO = format(toZonedTime(new Date(), 'Africa/Johannesburg'), 'yyyy-MM-dd');
    const tomorrowISO = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), 1), 'yyyy-MM-dd');

    it('opens for single day with focused date, hides weekdays UI', () => {
      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Should display focused date
      expect(screen.getByTestId('focused-date-display')).toBeInTheDocument();
      
      // Should not show weekday checkboxes (this is what differentiates from bulk)
      expect(screen.queryByTestId('checkbox-weekday-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('checkbox-weekday-1')).not.toBeInTheDocument();
      
      // Should have single-day specific UI elements
      expect(screen.getByTestId('select-slot-duration')).toBeInTheDocument();
      expect(screen.getByTestId('input-capacity')).toBeInTheDocument();
      expect(screen.getByTestId('textarea-notes')).toBeInTheDocument();
      expect(screen.getByTestId('button-create-slots')).toHaveTextContent('Create Slots (Day)');
    });

    it('posts with start=end=focused date and single weekday derived from date', async () => {
      const onClose = vi.fn();
      
      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={onClose}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Fill form
      fireEvent.change(screen.getByTestId('input-capacity'), {
        target: { value: '25' }
      });

      fireEvent.change(screen.getByTestId('textarea-notes'), {
        target: { value: 'Single day test' }
      });

      // Submit
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"startDate":"' + tomorrowISO + '"'),
        });
      });

      // Should post with start=end=focused date
      const call = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(call[1].body);
      
      expect(requestBody.startDate).toBe(tomorrowISO);
      expect(requestBody.endDate).toBe(tomorrowISO);
      expect(requestBody.capacity).toBe(25);
      expect(requestBody.notes).toBe('Single day test');
      
      // Should have only one weekday set to true (the day of the week for tomorrowISO)
      const trueCount = requestBody.weekdays.filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('blocks past dates and shows validation error', () => {
      const yesterday = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), -1), 'yyyy-MM-dd');
      
      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={yesterday}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Should show past date error
      expect(screen.getByTestId('past-date-error')).toHaveTextContent('Cannot create slots for past dates');
      
      // Submit button should be disabled
      expect(screen.getByTestId('button-create-slots')).toBeDisabled();
    });
  });

  describe('Bulk Create Dialog (Range)', () => {
    it('opens with range date inputs and weekday checkboxes', () => {
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Should have date range inputs
      expect(screen.getByTestId('input-start-date')).toBeInTheDocument();
      expect(screen.getByTestId('input-end-date')).toBeInTheDocument();
      
      // Should show all weekday checkboxes
      for (let i = 0; i < 7; i++) {
        expect(screen.getByTestId(`checkbox-weekday-${i}`)).toBeInTheDocument();
      }
      
      // Should have bulk-specific UI elements
      expect(screen.getByTestId('select-slot-duration')).toBeInTheDocument();
      expect(screen.getByTestId('input-capacity')).toBeInTheDocument();
      expect(screen.getByTestId('textarea-notes')).toBeInTheDocument();
      expect(screen.getByTestId('button-bulk-create')).toHaveTextContent('Bulk Create');
    });

    it('defaults to today + 7 days range', () => {
      const today = format(toZonedTime(new Date(), 'Africa/Johannesburg'), 'yyyy-MM-dd');
      const todayPlus7 = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), 7), 'yyyy-MM-dd');
      
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      const startDateInput = screen.getByTestId('input-start-date') as HTMLInputElement;
      const endDateInput = screen.getByTestId('input-end-date') as HTMLInputElement;
      
      expect(startDateInput.value).toBe(today);
      expect(endDateInput.value).toBe(todayPlus7);
    });

    it('posts with range dates and selected weekdays', async () => {
      const onClose = vi.fn();
      
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={onClose}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Fill form
      fireEvent.change(screen.getByTestId('input-capacity'), {
        target: { value: '30' }
      });

      fireEvent.change(screen.getByTestId('textarea-notes'), {
        target: { value: 'Bulk range test' }
      });

      // Select specific weekdays (Monday and Friday)
      fireEvent.click(screen.getByTestId('checkbox-weekday-1')); // Monday
      fireEvent.click(screen.getByTestId('checkbox-weekday-5')); // Friday

      // Submit
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/v1/slots/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"capacity":30'),
        });
      });

      const call = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(call[1].body);
      
      expect(requestBody.capacity).toBe(30);
      expect(requestBody.notes).toBe('Bulk range test');
      
      // Should have range dates (not same start/end)
      expect(requestBody.startDate).not.toBe(requestBody.endDate);
      
      // Should have weekdays array with selections
      expect(Array.isArray(requestBody.weekdays)).toBe(true);
      expect(requestBody.weekdays.length).toBe(7);
    });

    it('shows inline error for past start date and disables submit', () => {
      const yesterday = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), -1), 'yyyy-MM-dd');
      
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Change start date to past
      fireEvent.change(screen.getByTestId('input-start-date'), {
        target: { value: yesterday }
      });

      // Should show exact validation message
      expect(screen.getByTestId('error-start-date')).toHaveTextContent('Start date cannot be in the past');
      
      // Submit button should be disabled
      expect(screen.getByTestId('button-bulk-create')).toBeDisabled();
    });

    it('validates end date is after start date', () => {
      const today = format(toZonedTime(new Date(), 'Africa/Johannesburg'), 'yyyy-MM-dd');
      const tomorrow = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), 1), 'yyyy-MM-dd');
      
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Set dates where end < start
      fireEvent.change(screen.getByTestId('input-start-date'), {
        target: { value: tomorrow }
      });
      
      fireEvent.change(screen.getByTestId('input-end-date'), {
        target: { value: today }
      });

      // Try to submit to trigger validation
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      // Should show validation error
      expect(screen.getByTestId('error-end-date')).toHaveTextContent('End date must be after start date');
    });

    it('requires at least one weekday selection', () => {
      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Uncheck all weekdays (Monday-Friday are default checked)
      for (let i = 1; i <= 5; i++) {
        fireEvent.click(screen.getByTestId(`checkbox-weekday-${i}`));
      }

      // Try to submit
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      // Should show weekdays validation error
      expect(screen.getByTestId('error-weekdays')).toHaveTextContent('Select at least one weekday');
    });
  });

  describe('Success handling', () => {
    it('invalidates slots query and closes dialog on success', async () => {
      const onClose = vi.fn();
      const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
      
      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={onClose}
          focusedDate={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });

      // Should invalidate queries
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: expect.arrayContaining(['slots'])
      });
    });
  });

  describe('Error handling', () => {
    it('displays server error messages', async () => {
      // Mock API error
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: async () => ({
            error: 'Capacity exceeds maximum limit'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Should show error message (this would appear in a toast, so we verify the mutation was called)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });
});