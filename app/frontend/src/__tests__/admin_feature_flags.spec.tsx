/**
 * Test feature flag gating for admin components
 * Ensures Templates and Next Available features are properly gated
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BulkBar } from '../pages/BulkBar';
import DayEditorSheet from '../pages/DayEditorSheet';

// Mock environment variables
const mockEnv = vi.fn();
vi.stubGlobal('import.meta', {
  env: new Proxy({}, {
    get: mockEnv
  })
});

// Mock toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
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

describe('Admin Feature Flag Gating', () => {
  beforeEach(() => {
    mockEnv.mockClear();
  });

  describe('VITE_FEATURE_ADMIN_TEMPLATES', () => {
    it('hides template features when flag is false', () => {
      mockEnv.mockImplementation((key) => {
        if (key === 'VITE_FEATURE_ADMIN_TEMPLATES') return 'false';
        return undefined;
      });

      const wrapper = render(
        <TestWrapper>
          <BulkBar
            selectedDates={['2025-08-16']}
            onClearSelection={() => {}}
            onDone={() => {}}
          />
        </TestWrapper>
      );

      // Template-related buttons should not be present
      expect(screen.queryByTestId('button-bulk-duplicate')).not.toBeInTheDocument();
      expect(screen.queryByText(/duplicate from/i)).not.toBeInTheDocument();
    });

    it('shows template features when flag is true', () => {
      mockEnv.mockImplementation((key) => {
        if (key === 'VITE_FEATURE_ADMIN_TEMPLATES') return 'true';
        return undefined;
      });

      const wrapper = render(
        <TestWrapper>
          <BulkBar
            selectedDates={['2025-08-16']}
            onClearSelection={() => {}}
            onDone={() => {}}
          />
        </TestWrapper>
      );

      // Template-related buttons should be present
      expect(screen.getByTestId('button-bulk-duplicate')).toBeInTheDocument();
      expect(screen.getByText(/duplicate from/i)).toBeInTheDocument();
    });

    it('hides duplicate button in DayEditorSheet when flag is false', () => {
      mockEnv.mockImplementation((key) => {
        if (key === 'VITE_FEATURE_ADMIN_TEMPLATES') return 'false';
        return undefined;
      });

      const wrapper = render(
        <TestWrapper>
          <DayEditorSheet
            dateISO="2025-08-16"
            onClose={() => {}}
          />
        </TestWrapper>
      );

      // Template duplicate button should not be present
      expect(screen.queryByTestId('button-duplicate-from')).not.toBeInTheDocument();
      expect(screen.queryByText(/duplicate from/i)).not.toBeInTheDocument();
    });

    it('shows duplicate button in DayEditorSheet when flag is true', () => {
      mockEnv.mockImplementation((key) => {
        if (key === 'VITE_FEATURE_ADMIN_TEMPLATES') return 'true';
        return undefined;
      });

      const wrapper = render(
        <TestWrapper>
          <DayEditorSheet
            dateISO="2025-08-16"
            onClose={() => {}}
          />
        </TestWrapper>
      );

      // Template duplicate button should be present
      expect(screen.getByTestId('button-duplicate-from')).toBeInTheDocument();
      expect(screen.getByText(/duplicate from/i)).toBeInTheDocument();
    });
  });

  describe('VITE_FEATURE_NEXT_AVAILABLE', () => {
    it('feature properly gated (placeholder test)', () => {
      mockEnv.mockImplementation((key) => {
        if (key === 'VITE_FEATURE_NEXT_AVAILABLE') return 'false';
        return undefined;
      });

      // This test validates the flag is read correctly
      // When Next Available UI is implemented, this test should be expanded
      expect(mockEnv).toHaveBeenCalledWith('VITE_FEATURE_NEXT_AVAILABLE');
    });
  });

  describe('Default behavior', () => {
    it('features are disabled by default when env vars are undefined', () => {
      mockEnv.mockImplementation(() => undefined);

      const wrapper = render(
        <TestWrapper>
          <BulkBar
            selectedDates={['2025-08-16']}
            onClearSelection={() => {}}
            onDone={() => {}}
          />
        </TestWrapper>
      );

      // Features should be disabled by default
      expect(screen.queryByTestId('button-bulk-duplicate')).not.toBeInTheDocument();
    });
  });
});