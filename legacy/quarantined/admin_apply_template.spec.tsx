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
    applyTemplate: vi.fn()
  }
}));

// Mock the router
vi.mock('wouter', () => ({
  useLocation: () => ['/admin', vi.fn()]
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  env: {
    VITE_FEATURE_ADMIN_TEMPLATES: 'true'
  }
}));

// Set up environment variable
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

describe('Admin Apply Template', () => {
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
    (api.getSlotsRange as any).mockResolvedValue([]);
    (api.getTemplates as any).mockResolvedValue([
      {
        id: 'template1',
        name: 'Weekday Template',
        description: 'Standard weekday slots',
        weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        slot_length_min: 60,
        capacity: 15,
        start_time: '09:00',
        end_time: '17:00'
      }
    ]);
  });

  const renderAdminDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AdminDashboard />
      </QueryClientProvider>
    );
  };

  it('should render Apply Template button when feature flag is enabled', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      expect(screen.getByTestId('apply-template-button')).toBeInTheDocument();
    });
  });

  it('should open dialog and show template selection', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Apply Template')).toBeInTheDocument();
      expect(screen.getByText('Select a template to apply')).toBeInTheDocument();
    });
  });

  it('should display available templates for selection', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('template-template1')).toBeInTheDocument();
      expect(screen.getByText('Weekday Template')).toBeInTheDocument();
      expect(screen.getByText('Standard weekday slots')).toBeInTheDocument();
    });
  });

  it('should select template and show preview option', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preview-template')).toBeInTheDocument();
      expect(screen.getByText('Preview Changes')).toBeInTheDocument();
    });
  });

  it('should generate preview with non-zero counts for seeded template', async () => {
    const mockPreviewResult = {
      created: 25,
      updated: 5,
      skipped: 10,
      samples: {
        created: [
          { date: '2025-08-18', start_time: '09:00', end_time: '10:00', capacity: 15 },
          { date: '2025-08-18', start_time: '10:00', end_time: '11:00', capacity: 15 }
        ],
        updated: [
          { date: '2025-08-19', start_time: '09:00', end_time: '10:00', capacity: 15, old_capacity: 10 }
        ],
        skipped: []
      }
    };

    (api.applyTemplate as any).mockResolvedValue(mockPreviewResult);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preview-created-count')).toHaveTextContent('25');
      expect(screen.getByTestId('preview-updated-count')).toHaveTextContent('5');
      expect(screen.getByTestId('preview-skipped-count')).toHaveTextContent('10');
    });

    // Verify API was called with correct parameters
    expect(api.applyTemplate).toHaveBeenCalledWith({
      template_id: 'template1',
      start_date: expect.any(String),
      end_date: expect.any(String),
      mode: 'preview'
    });
  });

  it('should show preview samples when available', async () => {
    const mockPreviewResult = {
      created: 2,
      updated: 1,
      skipped: 0,
      samples: {
        created: [
          { date: '2025-08-18', start_time: '09:00', end_time: '10:00', capacity: 15 },
          { date: '2025-08-18', start_time: '10:00', end_time: '11:00', capacity: 15 }
        ],
        updated: [
          { date: '2025-08-19', start_time: '09:00', end_time: '10:00', capacity: 15, old_capacity: 10 }
        ]
      }
    };

    (api.applyTemplate as any).mockResolvedValue(mockPreviewResult);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preview-created-samples')).toBeInTheDocument();
      expect(screen.getByTestId('preview-updated-samples')).toBeInTheDocument();
      expect(screen.getByText('2025-08-18 09:00-10:00 (Capacity: 15)')).toBeInTheDocument();
      expect(screen.getByText('2025-08-19 09:00-10:00 (Capacity: 10→15)')).toBeInTheDocument();
    });
  });

  it('should enable publish button after successful preview', async () => {
    const mockPreviewResult = {
      created: 10,
      updated: 5,
      skipped: 2
    };

    (api.applyTemplate as any).mockResolvedValue(mockPreviewResult);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    await waitFor(() => {
      const publishButton = screen.getByTestId('publish-template');
      expect(publishButton).toBeInTheDocument();
      expect(publishButton).not.toBeDisabled();
    });
  });

  it('should publish changes and update grid', async () => {
    const mockPreviewResult = {
      created: 10,
      updated: 5,
      skipped: 2
    };

    const mockPublishResult = {
      created: 10,
      updated: 5,
      skipped: 2
    };

    (api.applyTemplate as any)
      .mockResolvedValueOnce(mockPreviewResult) // Preview call
      .mockResolvedValueOnce(mockPublishResult); // Publish call
    
    renderAdminDashboard();
    
    // Open dialog and select template
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    // Generate preview
    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    // Publish changes
    await waitFor(() => {
      const publishButton = screen.getByTestId('publish-template');
      fireEvent.click(publishButton);
    });

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Template Published",
        description: "Applied: 10 created, 5 updated, 2 skipped"
      });
    });

    // Verify API was called with publish mode
    expect(api.applyTemplate).toHaveBeenCalledWith({
      template_id: 'template1',
      start_date: expect.any(String),
      end_date: expect.any(String),
      mode: 'publish'
    });
  });

  it('should show zero counts on re-publishing same template', async () => {
    const mockFirstPreview = {
      created: 10,
      updated: 5,
      skipped: 2
    };

    const mockSecondPreview = {
      created: 0,
      updated: 0,
      skipped: 17 // All slots now exist and unchanged
    };

    (api.applyTemplate as any)
      .mockResolvedValueOnce(mockFirstPreview) // First preview
      .mockResolvedValueOnce(mockFirstPreview) // First publish
      .mockResolvedValueOnce(mockSecondPreview); // Second preview
    
    renderAdminDashboard();
    
    // First cycle: preview and publish
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    await waitFor(() => {
      const publishButton = screen.getByTestId('publish-template');
      fireEvent.click(publishButton);
    });

    // Wait for dialog to close and reopen
    await waitFor(() => {
      expect(screen.queryByText('Apply Template')).not.toBeInTheDocument();
    });

    // Second cycle: preview again
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    // Verify zero counts for re-publish
    await waitFor(() => {
      expect(screen.getByTestId('preview-created-count')).toHaveTextContent('0');
      expect(screen.getByTestId('preview-updated-count')).toHaveTextContent('0');
      expect(screen.getByTestId('preview-skipped-count')).toHaveTextContent('17');
    });
  });

  it('should disable publish button when no changes to apply', async () => {
    const mockPreviewResult = {
      created: 0,
      updated: 0,
      skipped: 10
    };

    (api.applyTemplate as any).mockResolvedValue(mockPreviewResult);
    
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    await waitFor(() => {
      const previewButton = screen.getByTestId('preview-template');
      fireEvent.click(previewButton);
    });

    await waitFor(() => {
      const publishButton = screen.getByTestId('publish-template');
      expect(publishButton).toBeDisabled();
    });
  });

  it('should reset dialog state when closed', async () => {
    renderAdminDashboard();
    
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    await waitFor(() => {
      const templateOption = screen.getByTestId('template-template1');
      fireEvent.click(templateOption);
    });

    // Close dialog
    fireEvent.keyDown(document, { key: 'Escape' });

    // Reopen dialog
    await waitFor(() => {
      const applyButton = screen.getByTestId('apply-template-button');
      fireEvent.click(applyButton);
    });

    // Should be back to template selection
    await waitFor(() => {
      expect(screen.getByText('Select a template to apply')).toBeInTheDocument();
    });
  });
});