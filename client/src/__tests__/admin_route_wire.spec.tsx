import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock auth service to simulate admin user
vi.mock('../lib/auth', () => ({
  authService: {
    isAuthenticated: () => true,
    isAdmin: () => true,
    getUser: () => ({ role: 'admin', tenantId: 'test' }),
    getToken: () => 'mock-token',
  },
}));

describe('Admin Route Wire Test', () => {
  it('renders new AdminPage UI with Create and More dropdowns', async () => {
    // Create a fresh query client for this test
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Render AdminPage directly (simulating /admin route)
    render(
      <QueryClientProvider client={queryClient}>
        <AdminPage />
      </QueryClientProvider>
    );

    // Wait for the component to render
    await screen.findByTestId('admin-page');

    // Test 1: Check for new header structure (preferred test IDs)
    try {
      const createButton = screen.getByTestId('admin-header-create');
      const moreButton = screen.getByTestId('admin-header-more');
      
      expect(createButton).toBeInTheDocument();
      expect(moreButton).toBeInTheDocument();
      
      // Verify button text content
      expect(createButton).toHaveTextContent('Create');
      expect(moreButton).toHaveTextContent('More');
      
      console.log('✅ New admin UI structure confirmed via data-testids');
      
    } catch (error) {
      // Fallback: Check for absence of legacy buttons
      const legacyLabels = [
        'Blackout',
        'Apply Restrictions', 
        'Create Slots',
        'Bulk Create',
        'Export CSV',
        'Apply Template'
      ];

      let legacyFound = false;
      let foundLabels: string[] = [];

      for (const label of legacyLabels) {
        try {
          // Look for buttons with this exact text
          const element = screen.getByRole('button', { name: new RegExp(label, 'i') });
          if (element) {
            legacyFound = true;
            foundLabels.push(label);
          }
        } catch {
          // Label not found (good)
        }
      }

      if (legacyFound) {
        throw new Error(`❌ FAIL: Legacy admin buttons found: ${foundLabels.join(', ')}`);
      }

      // Check for presence of Create and More buttons (even without data-testids)
      let hasCreate = false;
      let hasMore = false;

      try {
        const createButton = screen.getByRole('button', { name: /create/i });
        hasCreate = !!createButton;
      } catch {}

      try {
        const moreButton = screen.getByRole('button', { name: /more/i });
        hasMore = !!moreButton;
      } catch {}

      if (!hasCreate || !hasMore) {
        throw new Error(`❌ FAIL: Missing new admin structure. Create: ${hasCreate}, More: ${hasMore}`);
      }

      console.log('✅ New admin UI structure confirmed via fallback method');
    }

    // Additional verification: Check that we're in admin context
    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    
    // Test 2: Verify no legacy admin component remnants
    const bodyText = document.body.textContent || '';
    const suspiciousPatterns = [
      'admin-page', 
      'legacy-admin',
      'old-admin'
    ];

    for (const pattern of suspiciousPatterns) {
      if (bodyText.toLowerCase().includes(pattern)) {
        throw new Error(`❌ FAIL: Found legacy admin pattern: ${pattern}`);
      }
    }

    console.log('✅ Admin route wire test PASSED');
  });

  it('confirms AdminPage component structure', () => {
    // This test validates that the right component structure exists
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminPage />
      </QueryClientProvider>
    );

    // The admin-page testid should only exist in AdminPage.tsx
    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
    
    // Should have view mode tabs (Month/Week/Day)
    expect(screen.getByTestId('view-mode-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-month')).toBeInTheDocument();
    expect(screen.getByTestId('tab-week')).toBeInTheDocument();
    expect(screen.getByTestId('tab-day')).toBeInTheDocument();
  });
});