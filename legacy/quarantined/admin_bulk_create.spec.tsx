/**
 * Tests for Admin Bulk Create functionality - form submission, API calls, and grid refresh
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, Mock } from 'vitest';
import AdminDashboard from '../pages/admin-dashboard';
import { api } from '../lib/api';
import { authService } from '../lib/auth';
import { toast } from '../hooks/use-toast';

// Mock dependencies
vi.mock('../lib/api');
vi.mock('../lib/auth');
vi.mock('../hooks/use-toast');
vi.mock('wouter', () => ({
  useLocation: () => ['/admin', () => {}]
}));

// Mock CalendarGrid component
vi.mock('../features/booking/components/CalendarGrid', () => ({
  default: ({ onSlotClick, slots }: { onSlotClick: Function; slots: Array<any> }) => (
    <div data-testid="calendar-grid">
      <div data-testid="slots-count">{slots.length} slots</div>
      {slots.length === 0 && (
        <div data-testid="empty-state">No slots available</div>
      )}
    </div>
  )
}));

// Mock useSlotsRange hook
vi.mock('../features/booking/hooks/useSlotsRange', () => ({
  useSlotsRange: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null
  })),
  useSlotsSingle: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null
  }))
}));

// Mock TopNavigation
vi.mock('../components/top-navigation', () => ({
  default: () => <div data-testid="top-navigation">Top Navigation</div>
}));

describe('Admin Bulk Create Functionality', () => {
  let queryClient: QueryClient;
  let mockBulkCreateSlots: Mock;
  let mockToast: Mock;
  let mockInvalidateQueries: Mock;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockBulkCreateSlots = vi.fn();
    mockToast = vi.fn();
    mockInvalidateQueries = vi.fn();

    // Mock API client
    (api as any).bulkCreateSlots = mockBulkCreateSlots;
    (api as any).getDashboardStats = vi.fn().mockResolvedValue({});
    (api as any).getTemplates = vi.fn().mockResolvedValue([]);

    // Mock auth service
    (authService.getUser as Mock).mockReturnValue({
      id: 'user1',
      email: 'admin@demo.com',
      role: 'admin',
      tenantId: 'tenant1'
    });

    // Mock toast
    (toast as Mock).mockImplementation(mockToast);

    // Mock queryClient.invalidateQueries
    queryClient.invalidateQueries = mockInvalidateQueries;

    // Set environment variables
    import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES = 'false';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderAdminDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminDashboard />
      </QueryClientProvider>
    );
  };

  describe('Create Slots Button', () => {
    test('should render Create Slots button', () => {
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      expect(createButton).toBeInTheDocument();
      expect(createButton).toHaveTextContent('Create Slots');
    });

    test('should open Create Slots dialog when clicked', async () => {
      const user = userEvent.setup();
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      expect(screen.getByText('Create Slots')).toBeInTheDocument();
      expect(screen.getByTestId('start-date-input')).toBeInTheDocument();
      expect(screen.getByTestId('end-date-input')).toBeInTheDocument();
      expect(screen.getByTestId('confirm-bulk-create')).toBeInTheDocument();
    });

    test('should submit form with correct data structure', async () => {
      const user = userEvent.setup();
      mockBulkCreateSlots.mockResolvedValue({ success: true });
      
      renderAdminDashboard();
      
      // Open dialog
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      // Fill form
      const startDateInput = screen.getByTestId('start-date-input');
      const endDateInput = screen.getByTestId('end-date-input');
      const capacityInput = screen.getByTestId('capacity-input');
      const slotLengthInput = screen.getByTestId('slot-length-input');
      
      await user.clear(startDateInput);
      await user.type(startDateInput, '2025-08-18');
      await user.clear(endDateInput);
      await user.type(endDateInput, '2025-08-22');
      await user.clear(capacityInput);
      await user.type(capacityInput, '25');
      await user.clear(slotLengthInput);
      await user.type(slotLengthInput, '30');
      
      // Select additional weekdays
      const saturdayCheckbox = screen.getByTestId('weekday-sat');
      await user.click(saturdayCheckbox);
      
      // Submit form
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockBulkCreateSlots).toHaveBeenCalledWith({
          start_date: '2025-08-18',
          end_date: '2025-08-22',
          weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
          slot_length_min: 30,
          capacity: 25,
          notes: ''
        });
      });
    });
  });

  describe('Bulk Create Button', () => {
    test('should render Bulk Create button', () => {
      renderAdminDashboard();
      
      const bulkButton = screen.getByTestId('bulk-create-button');
      expect(bulkButton).toBeInTheDocument();
      expect(bulkButton).toHaveTextContent('Bulk Create');
    });

    test('should open Bulk Create dialog when clicked', async () => {
      const user = userEvent.setup();
      renderAdminDashboard();
      
      const bulkButton = screen.getByTestId('bulk-create-button');
      await user.click(bulkButton);
      
      expect(screen.getByText('Bulk Create Slots')).toBeInTheDocument();
      expect(screen.getByTestId('start-date-input')).toBeInTheDocument();
      expect(screen.getByTestId('end-date-input')).toBeInTheDocument();
    });

    test('should submit form and call API with proper structure', async () => {
      const user = userEvent.setup();
      mockBulkCreateSlots.mockResolvedValue({ success: true });
      
      renderAdminDashboard();
      
      // Open bulk create dialog
      const bulkButton = screen.getByTestId('bulk-create-button');
      await user.click(bulkButton);
      
      // Submit form with default values
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockBulkCreateSlots).toHaveBeenCalledWith(
          expect.objectContaining({
            start_date: expect.any(String),
            end_date: expect.any(String),
            weekdays: expect.arrayContaining(['mon', 'tue', 'wed', 'thu', 'fri']),
            slot_length_min: 60,
            capacity: 10,
            notes: ''
          })
        );
      });
    });
  });

  describe('Form Validation', () => {
    test('should validate required fields', async () => {
      const user = userEvent.setup();
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      // Clear required fields
      const startDateInput = screen.getByTestId('start-date-input');
      const capacityInput = screen.getByTestId('capacity-input');
      
      await user.clear(startDateInput);
      await user.clear(capacityInput);
      
      // Try to submit
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      // Should not call API with invalid data
      expect(mockBulkCreateSlots).not.toHaveBeenCalled();
    });

    test('should require at least one weekday to be selected', async () => {
      const user = userEvent.setup();
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      // Uncheck all weekdays
      const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
      for (const day of weekdays) {
        const checkbox = screen.getByTestId(`weekday-${day}`);
        await user.click(checkbox);
      }
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      // Should not call API without weekdays
      expect(mockBulkCreateSlots).not.toHaveBeenCalled();
    });
  });

  describe('Success Handling', () => {
    test('should invalidate queries and show success toast on successful creation', async () => {
      const user = userEvent.setup();
      mockBulkCreateSlots.mockResolvedValue({ success: true });
      
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ['slots', 'range', 'tenant1', expect.any(String), expect.any(String)]
        });
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ['slots']
        });
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Slots created successfully'
        });
      });
    });

    test('should close dialog after successful creation', async () => {
      const user = userEvent.setup();
      mockBulkCreateSlots.mockResolvedValue({ success: true });
      
      renderAdminDashboard();
      
      const bulkButton = screen.getByTestId('bulk-create-button');
      await user.click(bulkButton);
      
      expect(screen.getByText('Bulk Create Slots')).toBeInTheDocument();
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Bulk Create Slots')).not.toBeInTheDocument();
      });
    });

    test('should refresh grid data after successful creation', async () => {
      const user = userEvent.setup();
      mockBulkCreateSlots.mockResolvedValue({ success: true });
      
      renderAdminDashboard();
      
      // Initially should show empty state
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      // Verify cache invalidation was called with correct keys
      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ['slots', 'range', 'tenant1', expect.any(String), expect.any(String)]
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should show error toast on API failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to create slots due to capacity conflict';
      mockBulkCreateSlots.mockRejectedValue(new Error(errorMessage));
      
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive'
        });
      });
    });

    test('should handle server error messages', async () => {
      const user = userEvent.setup();
      const serverError = { message: 'Slot capacity exceeded for selected date range' };
      mockBulkCreateSlots.mockRejectedValue(serverError);
      
      renderAdminDashboard();
      
      const bulkButton = screen.getByTestId('bulk-create-button');
      await user.click(bulkButton);
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Slot capacity exceeded for selected date range',
          variant: 'destructive'
        });
      });
    });
  });

  describe('Loading States', () => {
    test('should show loading state during submission', async () => {
      const user = userEvent.setup();
      let resolvePromise: Function;
      mockBulkCreateSlots.mockImplementation(() => new Promise(resolve => {
        resolvePromise = resolve;
      }));
      
      renderAdminDashboard();
      
      const createButton = screen.getByTestId('create-slots-button');
      await user.click(createButton);
      
      const submitButton = screen.getByTestId('confirm-bulk-create');
      await user.click(submitButton);
      
      expect(submitButton).toHaveTextContent('Creating...');
      expect(submitButton).toBeDisabled();
      
      resolvePromise({ success: true });
      
      await waitFor(() => {
        expect(submitButton).toHaveTextContent('Create Slots');
        expect(submitButton).not.toBeDisabled();
      });
    });
  });
});