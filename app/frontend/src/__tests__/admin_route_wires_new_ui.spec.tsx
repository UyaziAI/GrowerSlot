import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for API calls
global.fetch = vi.fn();

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Admin route renders new UI', () => {
  let queryClient: QueryClient;

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
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ([]), // Empty slots array
    });
  });

  it('shows Create and More, and does NOT show legacy header buttons', () => {
    render(<AdminPage />, { wrapper: createWrapper(queryClient) });
    
    // New buttons exist
    expect(screen.getByTestId('admin-header-create')).toBeInTheDocument();
    expect(screen.getByTestId('admin-header-more')).toBeInTheDocument();
    
    // Legacy labels must not be present at top level
    const legacy = ['Blackout', 'Apply Restrictions', 'Bulk Create', 'Create Slots', 'Export CSV', 'Apply Template'];
    legacy.forEach(txt => {
      // Allow these to appear inside menus or sheets later; here we assert not present in the header region.
      expect(screen.queryByRole('button', { name: txt })).toBeNull();
    });
  });
});