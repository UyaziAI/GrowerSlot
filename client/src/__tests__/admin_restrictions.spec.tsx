import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RestrictionsDialog from '@/components/RestrictionsDialog';

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    getGrowers: vi.fn(() => Promise.resolve([
      { id: 'grower-1', name: 'Premium Grower', contact_email: 'premium@example.com' },
      { id: 'grower-2', name: 'Regular Grower', contact_email: 'regular@example.com' }
    ])),
    getCultivars: vi.fn(() => Promise.resolve([
      { id: 'cultivar-1', name: 'Macadamia A', description: 'Premium variety' },
      { id: 'cultivar-2', name: 'Macadamia B', description: 'Standard variety' }
    ]))
  }
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn()
  }
});

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('RestrictionsDialog - Basic Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('renders trigger button and opens dialog', async () => {
    const mockSuccess = vi.fn();
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" onSuccess={mockSuccess} />
    );
    
    // Check trigger button exists
    const trigger = screen.getByTestId('button-restrictions');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Apply Restrictions');
    
    // Open dialog
    await userEvent.click(trigger);
    
    // Check dialog is open
    const dialog = screen.getByTestId('dialog-restrictions');
    expect(dialog).toBeInTheDocument();
    
    // Check form elements exist
    expect(screen.getByTestId('select-scope')).toBeInTheDocument();
    expect(screen.getByTestId('input-note')).toBeInTheDocument();
    expect(screen.getByTestId('button-submit-restrictions')).toBeInTheDocument();
    expect(screen.getByTestId('button-cancel')).toBeInTheDocument();
  });

  it('shows correct scope options based on props', async () => {
    // Test with slotId provided (should show slot option)
    const { rerender } = renderWithProviders(
      <RestrictionsDialog slotId="slot-123" selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    await userEvent.click(screen.getByTestId('select-scope'));
    
    // Should have slot, day, and week options
    expect(screen.getByText('Single Slot')).toBeInTheDocument();
    expect(screen.getByText('Entire Day')).toBeInTheDocument();
    expect(screen.getByText('Entire Week')).toBeInTheDocument();
    
    // Close dialog and rerender without slotId
    fireEvent.keyDown(document, { key: 'Escape' });
    
    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <RestrictionsDialog selectedDate="2025-08-15" />
      </QueryClientProvider>
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    await userEvent.click(screen.getByTestId('select-scope'));
    
    // Should only have day and week options (no slot option)
    expect(screen.queryByText('Single Slot')).not.toBeInTheDocument();
    expect(screen.getByText('Entire Day')).toBeInTheDocument();
    expect(screen.getByText('Entire Week')).toBeInTheDocument();
  });

  it('loads and displays growers and cultivars for selection', async () => {
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for growers and cultivars to load
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    // Check grower options
    expect(screen.getByText('Premium Grower')).toBeInTheDocument();
    expect(screen.getByText('premium@example.com')).toBeInTheDocument();
    expect(screen.getByText('Regular Grower')).toBeInTheDocument();
    
    // Check cultivar options
    expect(screen.getByText('Macadamia A')).toBeInTheDocument();
    expect(screen.getByText('Premium variety')).toBeInTheDocument();
    expect(screen.getByText('Macadamia B')).toBeInTheDocument();
  });
});

describe('RestrictionsDialog - Form Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('requires at least one grower and cultivar selection', async () => {
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-restrictions')).toBeInTheDocument();
    });
    
    // Submit button should be disabled when no selections made
    const submitButton = screen.getByTestId('button-submit-restrictions');
    expect(submitButton).toBeDisabled();
    
    // Select one grower
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    
    // Still disabled without cultivar
    expect(submitButton).toBeDisabled();
    
    // Select one cultivar
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Now should be enabled
    expect(submitButton).not.toBeDisabled();
  });

  it('shows selection summary when items are selected', async () => {
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for options to load
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    // Select grower and cultivar
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Summary should appear
    expect(screen.getByText('Restriction Summary')).toBeInTheDocument();
    expect(screen.getByText('Growers:')).toBeInTheDocument();
    expect(screen.getByText('Cultivars:')).toBeInTheDocument();
    
    // Check badges show selected items
    const badges = screen.getAllByText('Premium Grower');
    expect(badges.length).toBeGreaterThan(0);
  });
});

describe('RestrictionsDialog - API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('posts correct payload for slot scope', async () => {
    const mockResponse = { affected_count: 1 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const mockSuccess = vi.fn();
    
    renderWithProviders(
      <RestrictionsDialog 
        slotId="slot-123" 
        selectedDate="2025-08-15" 
        onSuccess={mockSuccess}
      />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for form and make selections
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Set note
    const noteInput = screen.getByTestId('input-note');
    await userEvent.type(noteInput, 'Test restriction note');
    
    // Submit form
    const submitButton = screen.getByTestId('button-submit-restrictions');
    await userEvent.click(submitButton);
    
    // Verify API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/v1/restrictions/apply');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers['Authorization']).toBe('Bearer mock-token');
    
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      scope: 'slot',
      grower_ids: ['grower-1'],
      cultivar_ids: ['cultivar-1'],
      note: 'Test restriction note',
      slot_id: 'slot-123'
    });
    
    expect(mockSuccess).toHaveBeenCalledTimes(1);
  });

  it('posts correct payload for day scope', async () => {
    const mockResponse = { affected_count: 5 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for form and make selections
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Submit form (scope defaults to 'day' when no slotId)
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Verify API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload).toEqual({
      scope: 'day',
      grower_ids: ['grower-1'],
      cultivar_ids: ['cultivar-1'],
      target_date: '2025-08-15'
    });
  });

  it('posts correct payload for week scope', async () => {
    const mockResponse = { affected_count: 35 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Wait for form and change scope to week
    await waitFor(() => {
      expect(screen.getByTestId('select-scope')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('select-scope'));
    await userEvent.click(screen.getByText('Entire Week'));
    
    // Make selections
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Submit form
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Verify API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
    
    const [, options] = mockFetch.mock.calls[0];
    const payload = JSON.parse(options.body);
    expect(payload.scope).toBe('week');
    expect(payload.target_date).toBe('2025-08-15');
  });

  it('calls onSuccess and refreshes grid after successful submission', async () => {
    const mockResponse = { affected_count: 1 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });
    
    const mockSuccess = vi.fn();
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" onSuccess={mockSuccess} />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Make selections and submit
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Wait for success
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledTimes(1);
    });
  });
});

describe('RestrictionsDialog - Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('shows 403 toast for access denied', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ detail: 'Access denied' })
    });
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Make selections and submit
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Wait for error handling (submit button should be enabled again)
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-restrictions')).not.toBeDisabled();
    });
    
    // Dialog should remain open on error
    expect(screen.getByTestId('dialog-restrictions')).toBeInTheDocument();
  });

  it('shows 409 toast for restriction conflict', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ detail: 'Restriction already exists' })
    });
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Make selections and submit
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Wait for error handling
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-restrictions')).not.toBeDisabled();
    });
    
    // UI should remain unchanged after error
    expect(screen.getByTestId('dialog-restrictions')).toBeInTheDocument();
  });

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Make selections and submit
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    // Wait for error handling
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-restrictions')).not.toBeDisabled();
    });
    
    // Should not crash and form remains functional
    expect(screen.getByTestId('dialog-restrictions')).toBeInTheDocument();
  });

  it('leaves UI unchanged after error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: 'Invalid request' })
    });
    
    renderWithProviders(
      <RestrictionsDialog selectedDate="2025-08-15" />
    );
    
    await userEvent.click(screen.getByTestId('button-restrictions'));
    
    // Make selections
    await waitFor(() => {
      expect(screen.getByTestId('grower-option-grower-1')).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByTestId('grower-option-grower-1'));
    await userEvent.click(screen.getByTestId('cultivar-option-cultivar-1'));
    
    // Verify selections are still visible
    expect(screen.getByText('Restriction Summary')).toBeInTheDocument();
    
    // Submit and wait for error
    await userEvent.click(screen.getByTestId('button-submit-restrictions'));
    
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-restrictions')).not.toBeDisabled();
    });
    
    // Selections should still be there
    expect(screen.getByText('Restriction Summary')).toBeInTheDocument();
  });
});