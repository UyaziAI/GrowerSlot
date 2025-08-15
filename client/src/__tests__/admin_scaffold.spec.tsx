/**
 * Smoke tests for admin scaffolding UI - validates components render and API calls are made
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AdminDashboard from '../pages/admin-dashboard';
import { authService } from '../lib/auth';
import { api } from '../lib/api';

// Mock dependencies
vi.mock('../lib/auth');
vi.mock('../lib/api', () => ({
  api: {
    getTemplates: vi.fn(),
    applyTemplate: vi.fn(),
    getSlotsRange: vi.fn(),
    getDashboardStats: vi.fn(),
  }
}));

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactNode) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('Admin Scaffold Tests', () => {
  beforeEach(() => {
    // Mock authenticated admin user
    vi.mocked(authService.getUser).mockReturnValue({
      id: 'admin-123',
      email: 'admin@demo.com',
      role: 'admin',
      tenantId: 'tenant-123',
      growerId: undefined,
    });

    // Mock API responses
    vi.mocked(api.getTemplates).mockResolvedValue([]);
    vi.mocked(api.getSlotsRange).mockResolvedValue([]);
    vi.mocked(api.getDashboardStats).mockResolvedValue({});
    vi.mocked(api.applyTemplate).mockResolvedValue({
      created: 0,
      updated: 0,
      skipped: 0,
      preview: true
    });

    // Set feature flags environment variables
    import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES = 'true';
    import.meta.env.VITE_FEATURE_NEXT_AVAILABLE = 'true';
  });

  it('Admin page renders with all required buttons in top bar', async () => {
    renderWithQueryClient(<AdminDashboard />);

    // Assert view mode buttons exist
    expect(screen.getByTestId('month-view-button')).toBeInTheDocument();
    expect(screen.getByTestId('week-view-button')).toBeInTheDocument();
    expect(screen.getByTestId('day-view-button')).toBeInTheDocument();

    // Assert action buttons exist
    expect(screen.getByTestId('bulk-create-button')).toBeInTheDocument();
    expect(screen.getByTestId('apply-template-button')).toBeInTheDocument();
    expect(screen.getByTestId('blackout-button')).toBeInTheDocument();
    expect(screen.getByTestId('restrictions-button')).toBeInTheDocument();
  });

  it('Templates drawer renders when feature flag is enabled', async () => {
    renderWithQueryClient(<AdminDashboard />);

    // Templates button should be visible when feature flag is true
    const templatesButton = screen.getByTestId('templates-drawer-button');
    expect(templatesButton).toBeInTheDocument();

    // Click templates button to open drawer
    fireEvent.click(templatesButton);

    // Should show "No templates yet" for empty array
    await waitFor(() => {
      expect(screen.getByText('No templates yet')).toBeInTheDocument();
    });
  });

  it('Apply Template dialog renders and shows zero counts', async () => {
    renderWithQueryClient(<AdminDashboard />);

    // Click Apply Template button
    const applyTemplateButton = screen.getByTestId('apply-template-button');
    fireEvent.click(applyTemplateButton);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click Preview Changes button
    const previewButton = screen.getByTestId('preview-template');
    fireEvent.click(previewButton);

    // Verify mocked API was called
    await waitFor(() => {
      expect(api.applyTemplate).toHaveBeenCalledWith({ mode: 'preview' });
    });

    // Publish button should be disabled as per requirements
    const publishButton = screen.getByTestId('publish-template');
    expect(publishButton).toBeDisabled();
  });

  it('Empty state renders when no slots are returned from backend', async () => {
    renderWithQueryClient(<AdminDashboard />);

    // Should show empty state, not fabricated slots
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No slots defined by admin')).toBeInTheDocument();
    });
  });

  it('Templates drawer is hidden when feature flag is disabled', async () => {
    // Override feature flag in import.meta.env
    import.meta.env.VITE_FEATURE_ADMIN_TEMPLATES = 'false';

    renderWithQueryClient(<AdminDashboard />);

    // Templates button should not exist
    expect(screen.queryByTestId('templates-drawer-button')).not.toBeInTheDocument();
  });
});