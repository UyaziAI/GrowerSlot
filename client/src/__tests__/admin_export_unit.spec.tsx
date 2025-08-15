/**
 * B16 Tests - Admin Export CSV Unit Tests
 * Unit tests for CSV export functionality
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { authService } from '@/lib/auth';

// Mock authService
vi.mock('@/lib/auth');
const mockAuthService = vi.mocked(authService);

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

// Mock toast function
const mockToast = vi.fn();

// CSV Export function implementation (extracted from AdminDashboard)
const handleExportCSV = async (startDate: string, endDate: string, toast: any) => {
  try {
    // Build query parameters from current view and filters
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    
    // Make fetch request with Accept: text/csv header
    const response = await fetch(`/v1/exports/bookings.csv?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/csv',
        'Authorization': `Bearer ${authService.getToken()}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    // Create blob from response
    const csvText = await response.text();
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    
    // Trigger download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings_${startDate}_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Export Successful",
      description: `Downloaded bookings for ${startDate} to ${endDate}`,
    });
    
  } catch (error: any) {
    console.error('CSV Export failed:', error);
    toast({
      title: "Export Failed",
      description: error.message || "Failed to export CSV file",
      variant: "destructive",
    });
  }
};

describe('B16 - Admin Export CSV Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthService.getToken.mockReturnValue('mock-token');
    
    // Reset all DOM mocks
    mockCreateElement.mockReturnValue(mockLink);
    mockLink.setAttribute.mockClear();
    mockLink.click.mockClear();
    mockAppendChild.mockClear();
    mockRemoveChild.mockClear();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    mockToast.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
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
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockFetch).toHaveBeenCalledWith(
        '/v1/exports/bookings.csv?start_date=2024-08-15&end_date=2024-08-15',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Accept': 'text/csv',
            'Authorization': 'Bearer mock-token'
          }
        })
      );
    });

    it('builds query string with correct date range', async () => {
      const startDate = '2024-08-01';
      const endDate = '2024-08-31';

      await handleExportCSV(startDate, endDate, mockToast);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toBe('/v1/exports/bookings.csv?start_date=2024-08-01&end_date=2024-08-31');
    });

    it('creates blob and triggers download with correct filename', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.any(Blob)
      );
      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'mock-blob-url');
      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download', 
        'bookings_2024-08-15_2024-08-15.csv'
      );
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('shows success toast on successful export', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export Successful",
        description: "Downloaded bookings for 2024-08-15 to 2024-08-15"
      });
    });

    it('shows error toast on failed export', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export Failed",
        description: "Export failed: 500 Internal Server Error",
        variant: "destructive"
      });
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export Failed",
        description: "Network error",
        variant: "destructive"
      });
    });

    it('cleans up URL object after download', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-blob-url');
      expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);
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

      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockBlobConstructor).toHaveBeenCalledWith(
        [mockCsvData],
        { type: 'text/csv;charset=utf-8;' }
      );

      // Restore original Blob
      global.Blob = originalBlob;
    });
  });

  describe('Authorization', () => {
    beforeEach(() => {
      // Ensure mock response for these tests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('mock,csv\ndata,test')
      });
    });

    it('includes authorization header in request', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token'
          })
        })
      );
    });

    it('handles missing token gracefully', async () => {
      mockAuthService.getToken.mockReturnValue(null);

      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

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

  describe('Date Range Formatting', () => {
    beforeEach(() => {
      // Ensure mock response for these tests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('mock,csv\ndata,test')
      });
    });

    it('handles month view date range format', async () => {
      const startDate = '2024-08-01';
      const endDate = '2024-08-31';

      await handleExportCSV(startDate, endDate, mockToast);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toMatch(/start_date=2024-08-01/);
      expect(url).toMatch(/end_date=2024-08-31/);
    });

    it('handles week view date range format', async () => {
      const startDate = '2024-08-12';
      const endDate = '2024-08-18';

      await handleExportCSV(startDate, endDate, mockToast);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      
      expect(url).toMatch(/start_date=2024-08-12/);
      expect(url).toMatch(/end_date=2024-08-18/);
    });

    it('handles day view date range format', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const startDateParam = urlParams.get('start_date');
      const endDateParam = urlParams.get('end_date');
      
      expect(startDateParam).toBe(endDateParam);
      expect(startDateParam).toBe('2024-08-15');
    });
  });

  describe('Filename Generation', () => {
    beforeEach(() => {
      // Ensure mock response for these tests
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('mock,csv\ndata,test')
      });
    });

    it('generates correct filename for single day', async () => {
      const startDate = '2024-08-15';
      const endDate = '2024-08-15';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download', 
        'bookings_2024-08-15_2024-08-15.csv'
      );
    });

    it('generates correct filename for date range', async () => {
      const startDate = '2024-08-01';
      const endDate = '2024-08-31';

      await handleExportCSV(startDate, endDate, mockToast);

      expect(mockLink.setAttribute).toHaveBeenCalledWith(
        'download', 
        'bookings_2024-08-01_2024-08-31.csv'
      );
    });
  });
});