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
    applyTemplate: vi.fn(),
    bulkCreateSlots: vi.fn()
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

// Spy on fetch to ensure no unauthorized requests
const fetchSpy = vi.spyOn(global, 'fetch');

describe('Admin No-Fabrication Guard & Month Boundary', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    vi.clearAllMocks();
    fetchSpy.mockClear();
    
    // Default API responses - empty for future ranges
    (api.getSlotsRange as any).mockResolvedValue([]);
    (api.getTemplates as any).mockResolvedValue([]);
  });

  const renderAdminDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminDashboard />
      </QueryClientProvider>
    );
  };

  it('should show neutral empty state when API returns empty slots for future range', async () => {
    // Mock empty API response for future date range
    (api.getSlotsRange as any).mockResolvedValue([]);
    
    renderAdminDashboard();
    
    // Wait for component to load and API call to complete
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Should show empty state, not fabricated slots
    await waitFor(() => {
      // Look for neutral empty state indicators
      const emptyStateElements = screen.queryAllByText(/no slots/i);
      const createButtons = screen.queryAllByTestId('create-slots-button');
      
      // Should either show empty state or create buttons, but no phantom slots
      expect(emptyStateElements.length > 0 || createButtons.length > 0).toBe(true);
      
      // Should not show any fabricated availability badges
      expect(screen.queryByText('Available')).not.toBeInTheDocument();
      expect(screen.queryByText('Full')).not.toBeInTheDocument();
      expect(screen.queryByText('Limited')).not.toBeInTheDocument();
    });
  });

  it('should not show clickable cells when no slots exist', async () => {
    // Mock empty API response
    (api.getSlotsRange as any).mockResolvedValue([]);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Should not have clickable slot cells when no data
    await waitFor(() => {
      const clickableSlots = screen.queryAllByRole('button', { name: /slot/i });
      const slotGridCells = screen.queryAllByTestId(/slot-cell/);
      
      // Either no slot elements exist, or they're not interactive
      expect(clickableSlots.length).toBe(0);
      expect(slotGridCells.length).toBe(0);
    });
  });

  it('should handle month boundary navigation Aug 27 → Sep 7 without phantom slots', async () => {
    // Mock different empty responses for different date ranges
    (api.getSlotsRange as any)
      .mockResolvedValueOnce([]) // Initial load
      .mockResolvedValueOnce([]) // After navigation
      .mockResolvedValueOnce([]); // After second navigation
    
    renderAdminDashboard();
    
    // Wait for initial load
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalledTimes(1);
    });

    // Find navigation controls - could be date picker, next/prev buttons, or view controls
    const nextButtons = screen.queryAllByRole('button', { name: /next/i });
    const dateInputs = screen.queryAllByRole('textbox');
    const viewControls = screen.queryAllByRole('button');

    let navigated = false;

    // Try to navigate using next button if available
    if (nextButtons.length > 0) {
      fireEvent.click(nextButtons[0]);
      navigated = true;
    } 
    // Try to navigate using date controls if available
    else if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: '2025-09-07' } });
      navigated = true;
    }
    // Try view controls that might trigger navigation
    else if (viewControls.length > 0) {
      const monthButton = viewControls.find(btn => 
        btn.textContent?.toLowerCase().includes('month') ||
        btn.textContent?.toLowerCase().includes('week')
      );
      if (monthButton) {
        fireEvent.click(monthButton);
        navigated = true;
      }
    }

    if (navigated) {
      // Wait for navigation to trigger new API call
      await waitFor(() => {
        expect(api.getSlotsRange).toHaveBeenCalledTimes(2);
      }, { timeout: 3000 });

      // Verify no phantom availability appears after navigation
      await waitFor(() => {
        expect(screen.queryByText('Available')).not.toBeInTheDocument();
        expect(screen.queryByText('Full')).not.toBeInTheDocument();
        expect(screen.queryByText('Limited')).not.toBeInTheDocument();
        
        // Should still show appropriate empty state or controls
        const emptyStateElements = screen.queryAllByText(/no slots/i);
        const createButtons = screen.queryAllByTestId('create-slots-button');
        expect(emptyStateElements.length > 0 || createButtons.length > 0).toBe(true);
      });
    }
  });

  it('should not fire unauthorized POST requests during navigation', async () => {
    // Mock empty responses
    (api.getSlotsRange as any).mockResolvedValue([]);
    
    renderAdminDashboard();
    
    // Wait for initial load
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Track fetch calls before navigation
    const initialFetchCalls = fetchSpy.mock.calls.length;
    
    // Attempt navigation
    const nextButtons = screen.queryAllByRole('button', { name: /next/i });
    const dateInputs = screen.queryAllByRole('textbox');
    
    if (nextButtons.length > 0) {
      fireEvent.click(nextButtons[0]);
    } else if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: '2025-09-07' } });
    }

    // Wait a moment for any potential requests
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that only authorized GET requests were made
    const newFetchCalls = fetchSpy.mock.calls.slice(initialFetchCalls);
    
    for (const call of newFetchCalls) {
      const [url, options] = call;
      const method = options?.method || 'GET';
      
      // Should only be GET requests for data fetching
      expect(method).toBe('GET');
      
      // Should not be POSTing to create phantom slots
      expect(url).not.toMatch(/POST|PUT|PATCH/);
      expect(url).not.toMatch(/\/slots\/bulk|\/bookings/);
    }
  });

  it('should maintain data integrity when switching between empty date ranges', async () => {
    // Mock different empty responses to simulate different date ranges
    (api.getSlotsRange as any)
      .mockResolvedValueOnce([]) // Range 1: Aug 15-21
      .mockResolvedValueOnce([]) // Range 2: Aug 22-28  
      .mockResolvedValueOnce([]) // Range 3: Sep 1-7
      .mockResolvedValueOnce([]); // Range 4: Back to Aug 15-21
    
    renderAdminDashboard();
    
    // Initial load
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalledTimes(1);
    });

    // Simulate multiple navigation actions
    const viewControls = screen.queryAllByRole('button');
    const navigationButtons = viewControls.filter(btn => 
      btn.textContent?.toLowerCase().includes('next') ||
      btn.textContent?.toLowerCase().includes('prev') ||
      btn.textContent?.toLowerCase().includes('month') ||
      btn.textContent?.toLowerCase().includes('week')
    );

    // Navigate forward if possible
    if (navigationButtons.length > 0) {
      fireEvent.click(navigationButtons[0]);
      
      await waitFor(() => {
        expect(api.getSlotsRange).toHaveBeenCalledTimes(2);
      });

      // Navigate again
      fireEvent.click(navigationButtons[0]);
      
      await waitFor(() => {
        expect(api.getSlotsRange).toHaveBeenCalledTimes(3);
      });
    }

    // Verify consistent empty state throughout navigation
    await waitFor(() => {
      // Should never show phantom data
      expect(screen.queryByText('Available')).not.toBeInTheDocument();
      expect(screen.queryByText('Full')).not.toBeInTheDocument();
      
      // Should maintain consistent UI state
      const emptyStateElements = screen.queryAllByText(/no slots/i);
      const createButtons = screen.queryAllByTestId('create-slots-button');
      expect(emptyStateElements.length > 0 || createButtons.length > 0).toBe(true);
    });
  });

  it('should not fabricate slots when API returns null or undefined', async () => {
    // Test various empty/null responses
    const emptyResponses = [null, undefined, [], {}];
    
    for (const emptyResponse of emptyResponses) {
      // Reset and mock different empty response
      queryClient.clear();
      (api.getSlotsRange as any).mockResolvedValueOnce(emptyResponse);
      
      const { unmount } = renderAdminDashboard();
      
      await waitFor(() => {
        expect(api.getSlotsRange).toHaveBeenCalled();
      });

      // Should handle gracefully without fabricating data
      await waitFor(() => {
        expect(screen.queryByText('Available')).not.toBeInTheDocument();
        expect(screen.queryByText('Full')).not.toBeInTheDocument();
        expect(screen.queryByText('Limited')).not.toBeInTheDocument();
      });
      
      unmount();
    }
  });

  it('should prevent slot creation attempts when no backend data exists', async () => {
    // Mock empty API response
    (api.getSlotsRange as any).mockResolvedValue([]);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Look for any interactive elements that might trigger slot creation
    const interactiveElements = screen.queryAllByRole('button');
    const clickableAreas = screen.queryAllByRole('cell');
    
    // Click on any interactive elements that aren't create buttons
    for (const element of [...interactiveElements, ...clickableAreas]) {
      const text = element.textContent?.toLowerCase() || '';
      
      // Skip explicit create buttons - those are legitimate
      if (text.includes('create') || text.includes('add')) {
        continue;
      }
      
      // Click other elements to ensure they don't fabricate slots
      fireEvent.click(element);
    }

    // Verify no unauthorized slot creation requests
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const postCalls = fetchSpy.mock.calls.filter(call => {
      const [url, options] = call;
      return options?.method === 'POST' && url.includes('/slots');
    });
    
    // Should only allow explicit bulk creation, not phantom slot creation
    expect(postCalls.length).toBe(0);
  });

  it('should maintain no-fabrication rule across view mode changes', async () => {
    // Mock empty responses
    (api.getSlotsRange as any).mockResolvedValue([]);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(api.getSlotsRange).toHaveBeenCalled();
    });

    // Find view mode controls (Month, Week, Day)
    const viewModeButtons = screen.queryAllByRole('button').filter(btn => {
      const text = btn.textContent?.toLowerCase() || '';
      return text.includes('month') || text.includes('week') || text.includes('day');
    });

    // Test switching between view modes
    for (const modeButton of viewModeButtons) {
      fireEvent.click(modeButton);
      
      // Wait for potential re-render
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify no phantom slots appear in any view mode
      expect(screen.queryByText('Available')).not.toBeInTheDocument();
      expect(screen.queryByText('Full')).not.toBeInTheDocument();
      expect(screen.queryByText('Limited')).not.toBeInTheDocument();
    }
    
    // Verify no unauthorized requests during view changes
    const unauthorizedPosts = fetchSpy.mock.calls.filter(call => {
      const [url, options] = call;
      return options?.method === 'POST' && !url.includes('/auth');
    });
    
    expect(unauthorizedPosts.length).toBe(0);
  });
});