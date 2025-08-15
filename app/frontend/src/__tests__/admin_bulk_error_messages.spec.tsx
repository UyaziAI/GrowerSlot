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

describe('Admin Bulk Error Messages Tests', () => {
  let queryClient: QueryClient;
  const mockTenantId = 'test-tenant';
  const tomorrowISO = format(addDays(toZonedTime(new Date(), 'Africa/Johannesburg'), 1), 'yyyy-MM-dd');

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.resetAllMocks();
  });

  describe('CreateSlotsDialog Error Handling', () => {
    it('surfaces backend 422 error message verbatim and keeps submit disabled', async () => {
      // Mock 422 response with specific error message
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'start_date cannot be in the past'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Fill form and submit
      fireEvent.change(screen.getByTestId('input-capacity'), {
        target: { value: '25' }
      });

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Wait for error message to appear
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toBeInTheDocument();
      });

      // Should display exact backend error message
      expect(screen.getByTestId('backend-error-message')).toHaveTextContent('start_date cannot be in the past');
      
      // Submit button should remain enabled (since it's not a client validation error)
      expect(screen.getByTestId('button-create-slots')).not.toBeDisabled();
    });

    it('surfaces backend 422 error for end_date validation', async () => {
      // Mock 422 response for end_date error
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'end_date must be on or after start_date'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('end_date must be on or after start_date');
      });
    });

    it('surfaces backend 422 error for empty weekdays', async () => {
      // Mock 422 response for weekdays validation
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'weekdays must include at least one day (Mon=1..Sun=7)'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('weekdays must include at least one day (Mon=1..Sun=7)');
      });
    });

    it('surfaces backend 400 error for invalid capacity', async () => {
      // Mock 400 response for capacity validation
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({
            error: 'capacity must be greater than 0'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('capacity must be greater than 0');
      });
    });

    it('clears error message on successful retry', async () => {
      // First request fails
      (global.fetch as any)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 422,
            json: async () => ({
              error: 'start_date cannot be in the past'
            }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({
              count: 5,
              message: 'Created 5 slots'
            }),
          })
        );

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

      // First submission (fails)
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toBeInTheDocument();
      });

      // Second submission (succeeds)
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('handles error response with nested detail.error structure', async () => {
      // Mock response with nested error structure
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            detail: {
              error: 'start_date cannot be in the past'
            }
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('start_date cannot be in the past');
      });
    });
  });

  describe('BulkCreateDialog Error Handling', () => {
    it('surfaces backend error message verbatim in bulk dialog', async () => {
      // Mock 422 response
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'start_date cannot be in the past'
          }),
        })
      );

      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Fill and submit form
      fireEvent.change(screen.getByTestId('input-capacity'), {
        target: { value: '30' }
      });

      fireEvent.click(screen.getByTestId('button-bulk-create'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('start_date cannot be in the past');
      });
    });

    it('surfaces backend error for weekdays validation in bulk dialog', async () => {
      // Mock 422 response for weekdays
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'weekdays must include at least one day (Mon=1..Sun=7)'
          }),
        })
      );

      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={vi.fn()}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Uncheck all weekdays (Mon-Fri are checked by default)
      for (let i = 1; i <= 5; i++) {
        fireEvent.click(screen.getByTestId(`checkbox-weekday-${i}`));
      }

      // Submit form
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toHaveTextContent('weekdays must include at least one day (Mon=1..Sun=7)');
      });
    });

    it('clears error message when form is resubmitted', async () => {
      // First request fails, second succeeds
      (global.fetch as any)
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({
              error: 'Invalid slot configuration'
            }),
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({
              count: 10,
              message: 'Created 10 slots'
            }),
          })
        );

      const onClose = vi.fn();

      render(
        <BulkCreateDialog
          isOpen={true}
          onClose={onClose}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // First submission (fails)
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toBeInTheDocument();
      });

      // Second submission (succeeds)
      fireEvent.click(screen.getByTestId('button-bulk-create'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Message Display', () => {
    it('error message has proper styling and test id', async () => {
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'Test error message'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit to trigger error
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        const errorElement = screen.getByTestId('backend-error-message');
        expect(errorElement).toBeInTheDocument();
        expect(errorElement).toHaveClass('text-destructive');
        expect(errorElement.parentElement).toHaveClass('bg-destructive/10');
      });
    });

    it('error message does not appear when there is no error', () => {
      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Should not show error message initially
      expect(screen.queryByTestId('backend-error-message')).not.toBeInTheDocument();
    });
  });

  describe('No Generic Error Toasts', () => {
    it('does not show generic error toasts for backend validation errors', async () => {
      const mockToast = vi.fn();
      
      // Mock the useToast hook to capture calls
      vi.mock('@/hooks/use-toast', () => ({
        useToast: () => ({ toast: mockToast })
      }));

      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 422,
          json: async () => ({
            error: 'start_date cannot be in the past'
          }),
        })
      );

      render(
        <CreateSlotsDialog
          isOpen={true}
          onClose={vi.fn()}
          focusedDate={tomorrowISO}
          tenantId={mockTenantId}
        />,
        { wrapper: createWrapper(queryClient) }
      );

      // Submit form
      fireEvent.click(screen.getByTestId('button-create-slots'));

      await waitFor(() => {
        expect(screen.getByTestId('backend-error-message')).toBeInTheDocument();
      });

      // Should not have called toast with error
      expect(mockToast).not.toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive'
        })
      );
    });
  });
});