/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '@/pages/admin-dashboard';
import InspectorPanel from '@/pages/InspectorPanel';
import { authService } from '@/lib/auth';
import { api } from '@/lib/api';

// Mock the auth service
vi.mock('@/lib/auth', () => ({
  authService: {
    getUser: vi.fn(() => ({
      id: 'admin123',
      email: 'admin@demo.com',
      role: 'admin',
      tenantId: 'tenant123'
    })),
    getToken: vi.fn(() => 'mock-token')
  }
}));

// Mock the API calls
vi.mock('@/lib/api', () => ({
  api: {
    getSlotsRange: vi.fn(),
    getTemplates: vi.fn(),
    blackoutSlot: vi.fn(),
    applyRestrictions: vi.fn(),
    updateSlot: vi.fn()
  }
}));

// Mock the router
vi.mock('wouter', () => ({
  useLocation: () => ['/admin', vi.fn()]
}));

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_FEATURE_ADMIN_TEMPLATES: 'true'
  }
});

// Mock react-hook-form
vi.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({});
    },
    formState: { errors: {} },
    setValue: vi.fn(),
    getValues: vi.fn(() => ({}))
  }),
  Controller: ({ render }: any) => render({
    field: { onChange: vi.fn(), value: '' },
    fieldState: {}
  })
}));

// Mock @hookform/resolvers/zod
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: vi.fn()
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('Admin Inspector Panel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
    
    // Default API responses
    (api.getSlotsRange as any).mockResolvedValue([
      {
        id: 'slot123',
        date: '2025-08-20',
        startTime: '09:00',
        endTime: '10:00',
        capacity: 50,
        booked: 20,
        remaining: 30,
        blackout: false,
        notes: 'Regular morning slot'
      }
    ]);
    (api.getTemplates as any).mockResolvedValue([]);
  });

  const renderAdminDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminDashboard />
      </QueryClientProvider>
    );
  };

  const renderInspectorPanel = (slotData = null) => {
    const mockSlot = slotData || {
      id: 'slot123',
      date: '2025-08-20',
      startTime: '09:00',
      endTime: '10:00',
      capacity: 50,
      booked: 20,
      remaining: 30,
      blackout: false,
      notes: 'Regular morning slot'
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <InspectorPanel
          selectedSlot={mockSlot}
          onClose={vi.fn()}
          dateRange={{ startDate: '2025-08-20', endDate: '2025-08-20' }}
        />
      </QueryClientProvider>
    );
  };

  it('should render inspector panel when slot is selected', async () => {
    renderAdminDashboard();
    
    // Wait for slots to load
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Simulate slot click - look for day view slots
    await waitFor(() => {
      const daySlot = screen.queryByTestId('day-slot-slot123');
      if (daySlot) {
        fireEvent.click(daySlot);
      }
    });

    // Inspector should appear
    await waitFor(() => {
      expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    });
  });

  it('should show server data in inspector panel', () => {
    renderInspectorPanel();

    // Check that server data is displayed
    expect(screen.getByTestId('slot-time')).toHaveTextContent('09:00 - 10:00');
    expect(screen.getByTestId('slot-capacity')).toHaveTextContent('50');
    expect(screen.getByTestId('slot-booked')).toHaveTextContent('20');
    expect(screen.getByTestId('slot-remaining')).toHaveTextContent('30');
    expect(screen.getByTestId('slot-notes')).toHaveTextContent('Regular morning slot');
    expect(screen.getByTestId('blackout-status')).toHaveTextContent('Active');
  });

  it('should show availability percentage badge', () => {
    renderInspectorPanel();

    // 30 remaining / 50 capacity = 60%
    const availabilityBadge = screen.getByTestId('availability-badge');
    expect(availabilityBadge).toHaveTextContent('60%');
  });

  it('should handle blackout toggle and call correct endpoint', async () => {
    (api.blackoutSlot as any).mockResolvedValue({ id: 'slot123', blackout: true });
    
    renderInspectorPanel();

    // Click blackout toggle
    const blackoutToggle = screen.getByTestId('blackout-toggle');
    fireEvent.click(blackoutToggle);

    await waitFor(() => {
      expect(api.blackoutSlot).toHaveBeenCalledWith('slot123', {
        start_date: '2025-08-20',
        end_date: '2025-08-20',
        scope: 'slot',
        note: 'Blackout applied via Inspector'
      });
    });

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Blackout Updated",
        description: "Slot blackout removed successfully"
      });
    });
  });

  it('should handle blackout button click', async () => {
    (api.blackoutSlot as any).mockResolvedValue({ id: 'slot123', blackout: true });
    
    renderInspectorPanel();

    // Click blackout button
    const blackoutButton = screen.getByTestId('blackout-button');
    expect(blackoutButton).toHaveTextContent('Set Blackout');
    
    fireEvent.click(blackoutButton);

    await waitFor(() => {
      expect(api.blackoutSlot).toHaveBeenCalledWith('slot123', {
        start_date: '2025-08-20',
        end_date: '2025-08-20',
        scope: 'slot',
        note: 'Blackout applied via Inspector'
      });
    });
  });

  it('should open restriction dialog when restrict button clicked', async () => {
    renderInspectorPanel();

    // Click restrict button
    const restrictButton = screen.getByTestId('restrict-button');
    fireEvent.click(restrictButton);

    await waitFor(() => {
      expect(screen.getByTestId('restriction-dialog')).toBeInTheDocument();
      expect(screen.getByText('Apply Restriction')).toBeInTheDocument();
    });
  });

  it('should apply restriction with correct data', async () => {
    (api.applyRestrictions as any).mockResolvedValue({ success: true });
    
    renderInspectorPanel();

    // Open restriction dialog
    const restrictButton = screen.getByTestId('restrict-button');
    fireEvent.click(restrictButton);

    await waitFor(() => {
      expect(screen.getByTestId('restriction-dialog')).toBeInTheDocument();
    });

    // Set scope to 'day'
    const scopeSelect = screen.getByTestId('restriction-scope-select');
    fireEvent.click(scopeSelect);
    
    await waitFor(() => {
      const dayOption = screen.getByText('Entire Day');
      fireEvent.click(dayOption);
    });

    // Add note
    const noteInput = screen.getByTestId('restriction-note-input');
    fireEvent.change(noteInput, { target: { value: 'Emergency restriction' } });

    // Apply restriction
    const applyButton = screen.getByTestId('restriction-apply');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(api.applyRestrictions).toHaveBeenCalledWith({
        restriction_date: '2025-08-20',
        slot_id: null,
        grower_ids: [],
        cultivar_ids: [],
        note: 'Emergency restriction'
      });
    });

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Restriction Applied",
        description: "Day restriction applied successfully"
      });
    });
  });

  it('should handle 403 error without UI write', async () => {
    const error = { status: 403, message: 'Forbidden' };
    (api.applyRestrictions as any).mockRejectedValue(error);
    
    renderInspectorPanel();

    // Open restriction dialog and apply
    const restrictButton = screen.getByTestId('restrict-button');
    fireEvent.click(restrictButton);

    await waitFor(() => {
      const applyButton = screen.getByTestId('restriction-apply');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Restriction Forbidden",
        description: "You don't have permission to apply this restriction",
        variant: "destructive"
      });
    });

    // Dialog should still be open (no UI update on failure)
    expect(screen.getByTestId('restriction-dialog')).toBeInTheDocument();
  });

  it('should handle 409 error without UI write', async () => {
    const error = { status: 409, message: 'Conflict' };
    (api.applyRestrictions as any).mockRejectedValue(error);
    
    renderInspectorPanel();

    // Open restriction dialog and apply
    const restrictButton = screen.getByTestId('restrict-button');
    fireEvent.click(restrictButton);

    await waitFor(() => {
      const applyButton = screen.getByTestId('restriction-apply');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Restriction Conflict",
        description: "This restriction conflicts with existing rules",
        variant: "destructive"
      });
    });

    // Dialog should still be open (no UI update on failure)
    expect(screen.getByTestId('restriction-dialog')).toBeInTheDocument();
  });

  it('should invalidate cache after successful operations', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    (api.blackoutSlot as any).mockResolvedValue({ id: 'slot123', blackout: true });
    
    renderInspectorPanel();

    // Trigger blackout
    const blackoutToggle = screen.getByTestId('blackout-toggle');
    fireEvent.click(blackoutToggle);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['slots', 'range', 'tenant123', '2025-08-20', '2025-08-20']
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ['slots']
      });
    });
  });

  it('should show empty state when no slot selected', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <InspectorPanel
          selectedSlot={null}
          onClose={vi.fn()}
          dateRange={{ startDate: '2025-08-20', endDate: '2025-08-20' }}
        />
      </QueryClientProvider>
    );

    expect(screen.getByText('Select a slot to view details')).toBeInTheDocument();
  });

  it('should close inspector when close button clicked', () => {
    const mockOnClose = vi.fn();
    
    render(
      <QueryClientProvider client={queryClient}>
        <InspectorPanel
          selectedSlot={{
            id: 'slot123',
            date: '2025-08-20',
            startTime: '09:00',
            endTime: '10:00',
            capacity: 50,
            booked: 20,
            remaining: 30,
            blackout: false,
            notes: 'Test slot'
          }}
          onClose={mockOnClose}
          dateRange={{ startDate: '2025-08-20', endDate: '2025-08-20' }}
        />
      </QueryClientProvider>
    );

    const closeButton = screen.getByTestId('inspector-close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show correct slot scope restriction', async () => {
    renderInspectorPanel();

    // Open restriction dialog
    const restrictButton = screen.getByTestId('restrict-button');
    fireEvent.click(restrictButton);

    // Default should be slot scope
    await waitFor(() => {
      const scopeSelect = screen.getByTestId('restriction-scope-select');
      expect(scopeSelect).toHaveTextContent('This Slot Only');
    });

    // Apply with slot scope
    const applyButton = screen.getByTestId('restriction-apply');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(api.applyRestrictions).toHaveBeenCalledWith({
        restriction_date: null,
        slot_id: 'slot123',
        grower_ids: [],
        cultivar_ids: [],
        note: 'slot restriction applied via Inspector'
      });
    });
  });
});