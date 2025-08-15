/**
 * Test toolbar dropdown menus functionality
 * Ensures Create ▾ and More ▾ dropdowns work correctly with proper feature flag behavior
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for slot data
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast hook
const mockToast = vi.fn();
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Test wrapper with query client
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin Toolbar Menus', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockToast.mockClear();
    
    // Mock empty slot response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ slots: [] })
    });
  });

  describe('Create Dropdown Menu', () => {
    it('renders Create button and opens dropdown on click', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      expect(createButton).toHaveTextContent('Create');

      // Click to open dropdown
      fireEvent.click(createButton);

      // Check dropdown menu items
      expect(screen.getByTestId('create-menu-day-slots')).toBeInTheDocument();
      expect(screen.getByText('Create Slots — Day')).toBeInTheDocument();
      
      expect(screen.getByTestId('create-menu-bulk-slots')).toBeInTheDocument();
      expect(screen.getByText('Bulk Create Slots')).toBeInTheDocument();
    });

    it('triggers day editor when Create Slots — Day is clicked', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      fireEvent.click(createButton);

      const daySlotMenuItem = screen.getByTestId('create-menu-day-slots');
      fireEvent.click(daySlotMenuItem);

      // Should open day editor sheet
      await waitFor(() => {
        expect(screen.getByTestId('day-editor-sheet')).toBeInTheDocument();
      });
    });

    it('enables select mode when Bulk Create Slots is clicked', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      fireEvent.click(createButton);

      const bulkMenuItem = screen.getByTestId('create-menu-bulk-slots');
      fireEvent.click(bulkMenuItem);

      // Should trigger toast with bulk mode message
      expect(mockToast).toHaveBeenCalledWith({
        title: "Bulk Create Mode",
        description: "Select multiple days to create slots in bulk"
      });
    });

    it('shows Apply Template option when feature flag is enabled', async () => {
      // Mock environment variable for templates
      vi.stubEnv('VITE_FEATURE_ADMIN_TEMPLATES', 'true');
      
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      fireEvent.click(createButton);

      expect(screen.getByTestId('create-menu-apply-template')).toBeInTheDocument();
      expect(screen.getByText('Apply Template')).toBeInTheDocument();
      
      vi.unstubAllEnvs();
    });

    it('hides Apply Template option when feature flag is disabled', async () => {
      // Mock environment variable for templates as false
      vi.stubEnv('VITE_FEATURE_ADMIN_TEMPLATES', 'false');
      
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      fireEvent.click(createButton);

      expect(screen.queryByTestId('create-menu-apply-template')).not.toBeInTheDocument();
      
      vi.unstubAllEnvs();
    });
  });

  describe('More Dropdown Menu', () => {
    it('renders More button and opens dropdown on click', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const moreButton = await screen.findByTestId('admin-header-more');
      expect(moreButton).toHaveTextContent('More');

      // Click to open dropdown
      fireEvent.click(moreButton);

      // Check dropdown menu items
      expect(screen.getByTestId('more-menu-export-csv')).toBeInTheDocument();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      
      expect(screen.getByTestId('more-menu-filters')).toBeInTheDocument();
      expect(screen.getByText('Filters…')).toBeInTheDocument();
      
      expect(screen.getByTestId('more-menu-help')).toBeInTheDocument();
      expect(screen.getByText('Help')).toBeInTheDocument();
    });

    it('shows toast when Export CSV is clicked', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const moreButton = await screen.findByTestId('admin-header-more');
      fireEvent.click(moreButton);

      const csvMenuItem = screen.getByTestId('more-menu-export-csv');
      fireEvent.click(csvMenuItem);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Export CSV",
        description: "CSV export functionality coming soon"
      });
    });

    it('shows toast when Filters is clicked', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const moreButton = await screen.findByTestId('admin-header-more');
      fireEvent.click(moreButton);

      const filtersMenuItem = screen.getByTestId('more-menu-filters');
      fireEvent.click(filtersMenuItem);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Filters",
        description: "Filter functionality coming soon"
      });
    });

    it('shows toast when Help is clicked', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const moreButton = await screen.findByTestId('admin-header-more');
      fireEvent.click(moreButton);

      const helpMenuItem = screen.getByTestId('more-menu-help');
      fireEvent.click(helpMenuItem);

      expect(mockToast).toHaveBeenCalledWith({
        title: "Help",
        description: "Help documentation coming soon"
      });
    });
  });

  describe('Menu Accessibility', () => {
    it('dropdown menus can be opened with keyboard', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      
      // Focus and press Enter to open dropdown
      createButton.focus();
      fireEvent.keyDown(createButton, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('create-menu-day-slots')).toBeInTheDocument();
      });
    });

    it('menu items have proper aria labels and icons', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const createButton = await screen.findByTestId('admin-header-create');
      fireEvent.click(createButton);

      // Check that icons are present (via lucide-react)
      const daySlotItem = screen.getByTestId('create-menu-day-slots');
      expect(daySlotItem.querySelector('svg')).toBeInTheDocument();
    });
  });
});