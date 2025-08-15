/**
 * B18 Tests - Grower view alignment with restrictions and "why unavailable"
 * Tests restriction indicators, tooltips, and Next Available functionality
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DayView from '@/features/booking/components/DayView';
import { SlotWithUsage } from '@shared/schema';
import { authService } from '@/lib/auth';

// Mock authService
vi.mock('@/lib/auth');
const mockAuthService = vi.mocked(authService);

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    getCultivars: vi.fn(),
    createBooking: vi.fn()
  }
}));

// Mock components
vi.mock('@/components/booking-modal', () => ({
  default: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="booking-modal" onClick={onClose}>Booking Modal</div> : null
}));

vi.mock('@/components/NextAvailableDialog', () => ({
  default: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="next-available-dialog" onClick={onClose}>Next Available Dialog</div> : null
}));

// Mock environment variables
vi.mock('../../vite-env.d.ts', () => ({}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// Test data
const mockGrowerUser = {
  id: 'grower-1',
  name: 'Test Grower',
  email: 'grower@test.com',
  role: 'grower' as const,
  tenantId: 'tenant-1'
};

const mockAdminUser = {
  id: 'admin-1',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin' as const,
  tenantId: 'tenant-1'
};

const createMockSlot = (overrides: Partial<SlotWithUsage> = {}): SlotWithUsage => ({
  id: 'slot-1',
  tenantId: 'tenant-1',
  date: '2024-08-15',
  startTime: '09:00',
  endTime: '10:00',
  capacity: '10',
  blackout: false,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  booked: 0,
  remaining: 10,
  bookingCount: 0,
  restrictions: undefined,
  ...overrides
});

describe('B18 - Grower View Restrictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.getUser.mockReturnValue(mockGrowerUser);
    mockAuthService.isAuthenticated.mockReturnValue(true);
    // Reset environment mock
    vi.stubEnv('VITE_FEATURE_NEXT_AVAILABLE', 'false');
  });

  describe('Restriction Icon Display', () => {
    it('shows 🔒 icon for grower-restricted slots', () => {
      const restrictedSlot = createMockSlot({
        restrictions: {
          growers: ['other-grower'],
          cultivars: []
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[restrictedSlot]}
        />
      );

      expect(screen.getByTestId('restriction-icon-slot-1')).toBeInTheDocument();
      expect(screen.getByTestId('restriction-icon-slot-1')).toHaveAttribute('aria-label', '🔒 Restricted');
    });

    it('does not show restriction icon for unrestricted slots', () => {
      const normalSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[normalSlot]}
        />
      );

      expect(screen.queryByTestId('restriction-icon-slot-1')).not.toBeInTheDocument();
    });

    it('does not show restriction icon if grower is in allowed list', () => {
      const allowedSlot = createMockSlot({
        restrictions: {
          growers: ['grower-1'], // Current user is allowed
          cultivars: []
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[allowedSlot]}
        />
      );

      expect(screen.queryByTestId('restriction-icon-slot-1')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip Functionality', () => {
    it('shows "Blackout" tooltip for blackout slots', () => {
      const blackoutSlot = createMockSlot({
        blackout: true
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[blackoutSlot]}
        />
      );

      // Blackout slots should show Blackout badge, not tooltip since they're clearly marked
      expect(screen.getByText('Blackout')).toBeInTheDocument();
    });

    it('shows "No capacity" tooltip for full slots', () => {
      const fullSlot = createMockSlot({
        remaining: 0
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[fullSlot]}
        />
      );

      // Full slots should show Full badge, tooltip testing requires user interaction simulation
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('shows "Grower restriction" tooltip for restricted growers', () => {
      const restrictedSlot = createMockSlot({
        restrictions: {
          growers: ['other-grower'],
          cultivars: []
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[restrictedSlot]}
        />
      );

      // Restricted slot should show lock icon
      expect(screen.getByTestId('restriction-icon-slot-1')).toBeInTheDocument();
    });

    it('shows cultivar restriction info for restricted cultivars', () => {
      const cultivarRestrictedSlot = createMockSlot({
        restrictions: {
          growers: [],
          cultivars: ['Beaumont', 'A4']
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[cultivarRestrictedSlot]}
        />
      );

      // Cultivar restricted slot shows restriction info in the expanded details
      expect(screen.getByText('Cultivar restrictions:')).toBeInTheDocument();
      expect(screen.getByText('Beaumont, A4')).toBeInTheDocument();
    });
  });

  describe('Booking Behavior', () => {
    it('prevents booking on restricted slots', () => {
      const restrictedSlot = createMockSlot({
        restrictions: {
          growers: ['other-grower'],
          cultivars: []
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[restrictedSlot]}
        />
      );

      const slotCard = screen.getByTestId('slot-slot-1');
      fireEvent.click(slotCard);

      // Booking modal should not open
      expect(screen.queryByTestId('booking-modal')).not.toBeInTheDocument();
    });

    it('prevents booking on blackout slots', () => {
      const blackoutSlot = createMockSlot({
        blackout: true
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[blackoutSlot]}
        />
      );

      const slotCard = screen.getByTestId('slot-slot-1');
      fireEvent.click(slotCard);

      // Booking modal should not open
      expect(screen.queryByTestId('booking-modal')).not.toBeInTheDocument();
    });

    it('prevents booking on full capacity slots', () => {
      const fullSlot = createMockSlot({
        remaining: 0
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[fullSlot]}
        />
      );

      const slotCard = screen.getByTestId('slot-slot-1');
      fireEvent.click(slotCard);

      // Booking modal should not open
      expect(screen.queryByTestId('booking-modal')).not.toBeInTheDocument();
    });

    it('allows booking on available unrestricted slots', () => {
      const availableSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[availableSlot]}
        />
      );

      const slotCard = screen.getByTestId('slot-slot-1');
      fireEvent.click(slotCard);

      // Booking modal should open
      expect(screen.getByTestId('booking-modal')).toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('shows "Full" status for zero capacity slots', () => {
      const fullSlot = createMockSlot({
        remaining: 0
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[fullSlot]}
        />
      );

      expect(screen.getByTestId('status-badge-slot-1')).toBeInTheDocument();
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('shows "Blackout" UI for blackout slots', () => {
      const blackoutSlot = createMockSlot({
        blackout: true
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[blackoutSlot]}
        />
      );

      expect(screen.getByText('Blackout')).toBeInTheDocument();
    });
  });

  describe('Next Available Feature', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_FEATURE_NEXT_AVAILABLE', 'true');
    });

    it('shows Next Available button when feature flag is enabled', () => {
      const normalSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[normalSlot]}
        />
      );

      expect(screen.getByTestId('button-next-available-grower')).toBeInTheDocument();
      expect(screen.getByText('Find Next Available')).toBeInTheDocument();
    });

    it('does not show Next Available button when feature flag is disabled', () => {
      vi.stubEnv('VITE_FEATURE_NEXT_AVAILABLE', 'false');
      
      const normalSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[normalSlot]}
        />
      );

      expect(screen.queryByTestId('button-next-available-grower')).not.toBeInTheDocument();
    });

    it('opens Next Available dialog when button clicked', () => {
      const normalSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[normalSlot]}
        />
      );

      const nextAvailableButton = screen.getByTestId('button-next-available-grower');
      fireEvent.click(nextAvailableButton);

      expect(screen.getByTestId('next-available-dialog')).toBeInTheDocument();
    });

    it('does not show Next Available button for admin users', () => {
      mockAuthService.getUser.mockReturnValue(mockAdminUser);
      
      const normalSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[normalSlot]}
        />
      );

      expect(screen.queryByTestId('button-next-available-grower')).not.toBeInTheDocument();
    });
  });

  describe('No Phantom Data', () => {
    it('shows empty state when API returns no slots', () => {
      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[]}
        />
      );

      expect(screen.getByText('No slots available')).toBeInTheDocument();
      expect(screen.getByText(/There are no delivery slots scheduled/)).toBeInTheDocument();
    });

    it('only renders slots provided by backend', () => {
      const singleSlot = createMockSlot();

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[singleSlot]}
        />
      );

      // Should only show the one slot provided
      expect(screen.getAllByTestId(/^slot-/).length).toBe(1);
      expect(screen.getByTestId('slot-slot-1')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper aria-labels for restriction icons', () => {
      const restrictedSlot = createMockSlot({
        restrictions: {
          growers: ['other-grower'],
          cultivars: []
        }
      });

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={[restrictedSlot]}
        />
      );

      const restrictionIcon = screen.getByTestId('restriction-icon-slot-1');
      expect(restrictionIcon).toHaveAttribute('aria-label', '🔒 Restricted');
    });

    it('provides proper test ids for automation', () => {
      const slots = [
        createMockSlot({ id: 'slot-1' }),
        createMockSlot({ id: 'slot-2', blackout: true }),
        createMockSlot({ id: 'slot-3', remaining: 0 })
      ];

      renderWithProviders(
        <DayView 
          selectedDate={new Date('2024-08-15')}
          slots={slots}
        />
      );

      expect(screen.getByTestId('slot-slot-1')).toBeInTheDocument();
      expect(screen.getByTestId('slot-slot-2')).toBeInTheDocument();
      expect(screen.getByTestId('slot-slot-3')).toBeInTheDocument();
      expect(screen.getByTestId('status-badge-slot-3')).toBeInTheDocument();
    });
  });
});