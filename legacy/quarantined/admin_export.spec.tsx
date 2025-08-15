/**
 * B16 Tests - Frontend Export CSV Button Tests
 * Tests the admin top bar export functionality
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminDashboard from '@/pages/admin-dashboard';
import { authService } from '@/lib/auth';

// Mock authService
vi.mock('@/lib/auth');
const mockAuthService = vi.mocked(authService);

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    getSlots: vi.fn(),
    getSlotsRange: vi.fn(),
    getBookings: vi.fn(),
    getDashboardStats: vi.fn(),
    getTemplates: vi.fn(),
    createSlot: vi.fn(),
    updateSlot: vi.fn(),
    deleteSlot: vi.fn(),
    bulkCreateSlots: vi.fn(),
    createBooking: vi.fn(),
    updateBooking: vi.fn(),
    deleteBooking: vi.fn(),
    applyTemplate: vi.fn(),
    getNextAvailable: vi.fn()
  }
}));

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/admin', vi.fn()]
}));

// Mock complex components
vi.mock('@/pages/InspectorPanel', () => ({
  default: () => <div data-testid="inspector-panel">Inspector Panel</div>
}));

vi.mock('@/components/NextAvailableDialog', () => ({
  default: ({ isOpen }: any) => isOpen ? <div data-testid="next-available-dialog">Next Available Dialog</div> : null
}));

vi.mock('@/components/RestrictionsDialog', () => ({
  default: ({ isOpen }: any) => isOpen ? <div data-testid="restrictions-dialog">Restrictions Dialog</div> : null
}));

vi.mock('@/components/top-navigation', () => ({
  default: () => <div data-testid="top-navigation">Top Navigation</div>
}));

vi.mock('@/features/booking/components/CalendarGrid', () => ({
  default: () => <div data-testid="calendar-grid">Calendar Grid</div>
}));

// Mock drag and drop
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false
  }),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: () => {}
  }),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => []
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: () => ''
    }
  }
}));

// Mock hooks
vi.mock('@/features/booking/hooks/useSlotsRange', () => ({
  useSlotsRange: () => ({
    data: [],
    isLoading: false,
    error: null
  }),
  useSlotsSingle: () => ({
    data: [],
    isLoading: false,
    error: null
  })
}));

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

// Mock admin user
const mockAdminUser = {
  id: 'admin-1',
  name: 'Test Admin',
  email: 'admin@test.com',
  role: 'admin' as const,
  tenantId: 'tenant-1'
};

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'mock-blob-url');
const mockRevokeObjectURL = vi.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock document.createElement and DOM manipulation
const mockLink = {
  setAttribute: vi.fn(),
  click: vi.fn(),
  style: { visibility: '' }
};
const mockCreateElement = vi.fn(() => mockLink);
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement
});
Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild
});
Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild
});

describe('B16 - Admin Export CSV Button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.getUser.mockReturnValue(mockAdminUser);
    mockAuthService.getToken.mockReturnValue('mock-token');
    mockAuthService.isAuthenticated.mockReturnValue(true);
    
    // Reset all DOM mocks
    mockCreateElement.mockReturnValue(mockLink);
    mockLink.setAttribute.mockClear();
    mockLink.click.mockClear();
    mockAppendChild.mockClear();
    mockRemoveChild.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Export Button Visibility', () => {
    it('shows Export CSV button in admin top bar', () => {
      renderWithProviders(<AdminDashboard />);

      expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    it('positions Export CSV button alongside Month/Week/Day buttons', () => {
      renderWithProviders(<AdminDashboard />);

      expect(screen.getByTestId('month-view-button')).toBeInTheDocument();
      expect(screen.getByTestId('week-view-button')).toBeInTheDocument();
      expect(screen.getByTestId('day-view-button')).toBeInTheDocument();
      expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    const mockCsvResponse = 'booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes\n' +
      'book-1,2024-08-15,09:00,10:00,Test Grower,Beaumont,5.5,confirmed,Test booking\n';

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockCsvResponse)
      });
    });

    it('calls export endpoint with correct parameters', async () => {
      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/exports/bookings.csv?start_date='),
          expect.objectContaining({
            method: 'GET',
            headers: {
              'Accept': 'text/csv',
              'Authorization': 'Bearer mock-token'
            }
          })
        );
      });
    });

    it('builds query string with current view date range', async () => {
      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const url = fetchCall[0] as string;
        
        expect(url).toMatch(/start_date=\d{4}-\d{2}-\d{2}/);
        expect(url).toMatch(/end_date=\d{4}-\d{2}-\d{2}/);
      });
    });

    it('creates blob and triggers download with correct filename', async () => {
      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateElement).toHaveBeenCalledWith('a');
        expect(mockCreateObjectURL).toHaveBeenCalledWith(
          expect.any(Blob)
        );
        expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-blob-url');
        expect(mockLink.setAttribute).toHaveBeenCalledWith(
          'download', 
          expect.stringMatching(/bookings_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv/)
        );
        expect(mockLink.click).toHaveBeenCalled();
      });
    });

    it('disables button while request is in flight', async () => {
      // Mock a slow response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(mockCsvResponse)
        }), 100))
      );

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      // Button should be disabled and show loading text
      expect(exportButton).toBeDisabled();
      expect(screen.getByText('Exporting...')).toBeInTheDocument();

      // Wait for request to complete
      await waitFor(() => {
        expect(exportButton).not.toBeDisabled();
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('shows success toast on successful export', async () => {
      const mockToast = vi.fn();
      vi.doMock('@/hooks/use-toast', () => ({
        useToast: () => ({ toast: mockToast })
      }));

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Successful",
          description: expect.stringContaining("Downloaded bookings for")
        });
      });
    });

    it('shows error toast on failed export', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const mockToast = vi.fn();
      vi.doMock('@/hooks/use-toast', () => ({
        useToast: () => ({ toast: mockToast })
      }));

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Failed",
          description: expect.stringContaining("Export failed: 500"),
          variant: "destructive"
        });
      });
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const mockToast = vi.fn();
      vi.doMock('@/hooks/use-toast', () => ({
        useToast: () => ({ toast: mockToast })
      }));

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Export Failed",
          description: "Network error",
          variant: "destructive"
        });
      });
    });

    it('cleans up URL object after download', async () => {
      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
        expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
      });
    });
  });

  describe('CSV Blob Creation', () => {
    it('creates blob with correct MIME type', async () => {
      const mockCsvData = 'test,csv,data\n1,2,3';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockCsvData)
      });

      // Spy on Blob constructor
      const originalBlob = global.Blob;
      const mockBlobConstructor = vi.fn().mockImplementation((content, options) => {
        return new originalBlob(content, options);
      });
      global.Blob = mockBlobConstructor;

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockBlobConstructor).toHaveBeenCalledWith(
          [mockCsvData],
          { type: 'text/csv;charset=utf-8;' }
        );
      });

      // Restore original Blob
      global.Blob = originalBlob;
    });
  });

  describe('Date Range Integration', () => {
    it('exports data for month view date range', async () => {
      renderWithProviders(<AdminDashboard />);

      // Switch to month view
      const monthButton = screen.getByTestId('month-view-button');
      fireEvent.click(monthButton);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const url = fetchCall[0] as string;
        
        // Month view should have full month range
        expect(url).toMatch(/start_date=\d{4}-\d{2}-01/);
        expect(url).toMatch(/end_date=\d{4}-\d{2}-\d{2}/);
      });
    });

    it('exports data for week view date range', async () => {
      renderWithProviders(<AdminDashboard />);

      // Switch to week view
      const weekButton = screen.getByTestId('week-view-button');
      fireEvent.click(weekButton);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/v1/exports/bookings.csv?'),
          expect.any(Object)
        );
      });
    });

    it('exports data for day view date range', async () => {
      renderWithProviders(<AdminDashboard />);

      // Day view is default, export should work
      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0];
        const url = fetchCall[0] as string;
        
        // Day view should have same start and end date
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const startDate = urlParams.get('start_date');
        const endDate = urlParams.get('end_date');
        
        expect(startDate).toBe(endDate);
      });
    });
  });

  describe('Authorization', () => {
    it('includes authorization header in request', async () => {
      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer mock-token'
            })
          })
        );
      });
    });

    it('handles missing token gracefully', async () => {
      mockAuthService.getToken.mockReturnValue(null);

      renderWithProviders(<AdminDashboard />);

      const exportButton = screen.getByTestId('export-csv-button');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer null'
            })
          })
        );
      });
    });
  });
});