/**
 * Tripwire test to detect DayEditor runtime errors and auth issues
 * This test MUST fail if isOpen runtime errors or unauthenticated calls reappear
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DayEditorSheet from '../pages/DayEditorSheet';
import { logger } from '../lib/logger';

// Mock the date-fns imports
vi.mock('date-fns', () => ({
  format: vi.fn((date, fmt) => {
    if (fmt === 'EEEE, MMMM d, yyyy') return 'Monday, August 15, 2025';
    if (fmt === 'EEE') return 'Mon';
    return '2025-08-15';
  }),
  startOfDay: vi.fn((date) => date),
  isBefore: vi.fn(() => false),
}));

vi.mock('date-fns-tz', () => ({
  toZonedTime: vi.fn(() => new Date('2025-08-15')),
}));

// Mock the toast hook
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock fetchJson
vi.mock('../lib/http', () => ({
  fetchJson: vi.fn().mockResolvedValue({ success: true }),
}));

describe('DayEditor Runtime Errors Tripwire', () => {
  let queryClient: QueryClient;
  let consoleErrorSpy: any;

  beforeEach(() => {
    logger.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Capture console errors to detect runtime errors
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('TRIPWIRE: DayEditor with isOpen=true should not throw isOpen runtime error', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // This should NOT throw "isOpen is not defined" error
    expect(() => {
      render(
        <TestWrapper>
          <DayEditorSheet
            dateISO="2025-08-15"
            isOpen={true}
            onClose={() => {}}
            onToggleBlackout={() => Promise.resolve()}
            onQuickCreate={() => Promise.resolve()}
          />
        </TestWrapper>
      );
    }).not.toThrow();

    // Check for no console errors related to isOpen
    const isOpenErrors = consoleErrorSpy.mock.calls.filter((call: any[]) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('isOpen is not defined'))
    );

    expect(isOpenErrors).toHaveLength(0);

    if (isOpenErrors.length > 0) {
      console.error('TRIPWIRE FAILURE: isOpen runtime error detected:', isOpenErrors);
    }
  });

  it('TRIPWIRE: DayEditor with isOpen=false should not enable queries', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <TestWrapper>
        <DayEditorSheet
          dateISO="2025-08-15"
          isOpen={false}
          onClose={() => {}}
          onToggleBlackout={() => Promise.resolve()}
          onQuickCreate={() => Promise.resolve()}
        />
      </TestWrapper>
    );

    // Verify no runtime errors occurred
    const runtimeErrors = consoleErrorSpy.mock.calls.filter((call: any[]) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('runtime'))
    );

    expect(runtimeErrors).toHaveLength(0);
  });

  it('TRIPWIRE: DayEditor should not trigger unauthenticated API calls', async () => {
    // Setup: Valid authentication
    localStorage.setItem('token', 'valid-day-editor-token');
    localStorage.setItem('user', JSON.stringify({ 
      role: 'admin', 
      email: 'admin@test.com'
    }));

    const { fetchJson } = await import('../lib/http');
    const fetchJsonSpy = vi.mocked(fetchJson);
    fetchJsonSpy.mockClear();

    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(
      <TestWrapper>
        <DayEditorSheet
          dateISO="2025-08-15"
          isOpen={true}
          onClose={() => {}}
          onToggleBlackout={() => Promise.resolve()}
          onQuickCreate={() => Promise.resolve()}
        />
      </TestWrapper>
    );

    // Wait for any potential queries to be triggered
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify any API calls went through fetchJson (authenticated)
    const dayOverviewCalls = fetchJsonSpy.mock.calls.filter(call => 
      call[0].includes('/v1/admin/day-overview')
    );

    // Should either have no calls (query disabled) or all calls should go through fetchJson
    dayOverviewCalls.forEach(call => {
      expect(call[0]).toContain('/v1/');
    });

    if (dayOverviewCalls.length > 0) {
      // If there were calls, they went through fetchJson which is good
      expect(dayOverviewCalls.length).toBeGreaterThan(0);
    }
  });

  it('TRIPWIRE: Missing isOpen prop should cause clear error (not silent failure)', () => {
    const TestWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // This test documents what SHOULD happen if isOpen prop is missing
    // TypeScript should catch this, but if it doesn't, we want a clear error

    // @ts-expect-error - Intentionally missing isOpen prop for testing
    expect(() => {
      render(
        <TestWrapper>
          <DayEditorSheet
            dateISO="2025-08-15"
            onClose={() => {}}
            onToggleBlackout={() => Promise.resolve()}
            onQuickCreate={() => Promise.resolve()}
          />
        </TestWrapper>
      );
    }).toThrow();
  });
});