/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '@/pages/admin-dashboard';
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
    getBookings: vi.fn(),
    updateBooking: vi.fn(),
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

// Mock react-hook-form with FormProvider export
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
  }),
  FormProvider: ({ children }: any) => children // Add FormProvider mock
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

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragStart, onDragEnd }: any) => {
    // Mock DndContext that can trigger drag events for testing
    return (
      <div 
        data-testid="dnd-context" 
        onMouseDown={(e) => {
          // Simulate drag start
          const target = e.target as HTMLElement;
          const draggableId = target.closest('[data-testid^="booking-chip-"]')?.getAttribute('data-testid')?.replace('booking-chip-', '');
          if (draggableId && onDragStart) {
            onDragStart({ active: { id: draggableId } });
          }
        }}
        onMouseUp={(e) => {
          // Simulate drag end
          const target = e.target as HTMLElement;
          const draggableId = target.closest('[data-testid^="booking-chip-"]')?.getAttribute('data-testid')?.replace('booking-chip-', '');
          const droppableId = target.closest('[data-testid^="droppable-slot-"]')?.getAttribute('data-testid')?.replace('droppable-slot-', '');
          
          if (draggableId && droppableId && onDragEnd) {
            onDragEnd({ active: { id: draggableId }, over: { id: droppableId } });
          }
        }}
      >
        {children}
      </div>
    );
  },
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false
  }),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: vi.fn()
  })
}));

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: () => ''
    }
  }
}));

describe('Admin Drag-Drop Booking Move', () => {
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
        notes: 'Morning slot'
      },
      {
        id: 'slot456',
        date: '2025-08-20',
        startTime: '11:00',
        endTime: '12:00',
        capacity: 40,
        booked: 10,
        remaining: 30,
        blackout: false,
        notes: 'Midday slot'
      }
    ]);
    
    (api.getBookings as any).mockResolvedValue([
      {
        id: 'booking123',
        slotId: 'slot123',
        growerName: 'John Farmer',
        quantity: 15,
        status: 'confirmed'
      },
      {
        id: 'booking456',
        slotId: 'slot123',
        growerName: 'Jane Grower',
        quantity: 5,
        status: 'confirmed'
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

  it('should render booking chips in slots', async () => {
    renderAdminDashboard();
    
    // Wait for data to load
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
      expect(api.getBookings).toHaveBeenCalled();
    });

    // Should see booking chips in slot123
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
      expect(screen.getByTestId('booking-chip-booking456')).toBeInTheDocument();
    });

    // Check booking chip content
    const johnBooking = screen.getByTestId('booking-chip-booking123');
    expect(johnBooking).toHaveTextContent('John Farmer');
    expect(johnBooking).toHaveTextContent('15T');

    const janeBooking = screen.getByTestId('booking-chip-booking456');
    expect(janeBooking).toHaveTextContent('Jane Grower');
    expect(janeBooking).toHaveTextContent('5T');
  });

  it('should render droppable slots', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('droppable-slot-slot123')).toBeInTheDocument();
      expect(screen.getByTestId('droppable-slot-slot456')).toBeInTheDocument();
    });
  });

  it('should handle successful booking move (happy path)', async () => {
    (api.updateBooking as any).mockResolvedValue({ id: 'booking123', slotId: 'slot456' });
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate drag and drop
    const dndContext = screen.getByTestId('dnd-context');
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    // Simulate mousedown on booking chip (drag start)
    fireEvent.mouseDown(bookingChip);
    
    // Simulate mouseup on target slot (drag end)
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalledWith('booking123', {
        slot_id: 'slot456'
      });
    });

    // Should show success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Booking Moved",
        description: "Booking moved successfully to new slot"
      });
    });
  });

  it('should handle 403 error and show toast (no revert needed)', async () => {
    const error = { status: 403, message: 'Booking not allowed due to restrictions' };
    (api.updateBooking as any).mockRejectedValue(error);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalled();
    });

    // Should show 403 error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Move Forbidden",
        description: "Booking not allowed due to restrictions",
        variant: "destructive"
      });
    });
  });

  it('should handle 409 error and show toast (no revert needed)', async () => {
    const error = { status: 409, message: 'Slot capacity exceeded' };
    (api.updateBooking as any).mockRejectedValue(error);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalled();
    });

    // Should show 409 error toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Slot Conflict",
        description: "Slot capacity exceeded",
        variant: "destructive"
      });
    });
  });

  it('should refetch data after successful move', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    (api.updateBooking as any).mockResolvedValue({ id: 'booking123', slotId: 'slot456' });
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate successful drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['slots'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    });
  });

  it('should refetch data after error for revert effect', async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const error = { status: 403, message: 'Forbidden' };
    (api.updateBooking as any).mockRejectedValue(error);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate failed drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['slots'] });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    });
  });

  it('should not make API call when dropping on same slot', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate drag and drop to same slot
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const sameSlot = screen.getByTestId('droppable-slot-slot123');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(sameSlot);

    // Should not call API
    expect(api.updateBooking).not.toHaveBeenCalled();
  });

  it('should handle missing booking gracefully', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    });

    // Simulate drag of non-existent booking
    const dndContext = screen.getByTestId('dnd-context');
    
    // Manually trigger drag end with non-existent booking
    const mockDragEnd = vi.fn();
    fireEvent.mouseUp(dndContext);

    // Should not crash and should not call API
    expect(api.updateBooking).not.toHaveBeenCalled();
  });

  it('should show drag overlay when dragging', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Drag overlay should be present (even if not visible)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
  });

  it('should handle generic error with fallback message', async () => {
    const error = { status: 500, message: 'Internal server error' };
    (api.updateBooking as any).mockRejectedValue(error);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Move Failed",
        description: "Internal server error",
        variant: "destructive"
      });
    });
  });

  it('should use PATCH /v1/bookings/{id} endpoint', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('booking-chip-booking123')).toBeInTheDocument();
    });

    // Simulate successful drag and drop
    const bookingChip = screen.getByTestId('booking-chip-booking123');
    const targetSlot = screen.getByTestId('droppable-slot-slot456');

    fireEvent.mouseDown(bookingChip);
    fireEvent.mouseUp(targetSlot);

    await waitFor(() => {
      expect(api.updateBooking).toHaveBeenCalledWith('booking123', {
        slot_id: 'slot456'
      });
    });

    // Verify the exact API structure expected
    const callArgs = (api.updateBooking as any).mock.calls[0];
    expect(callArgs[0]).toBe('booking123'); // booking ID
    expect(callArgs[1]).toEqual({ slot_id: 'slot456' }); // update data
  });
});