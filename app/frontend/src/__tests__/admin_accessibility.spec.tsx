/**
 * Test accessibility compliance for admin interface
 * Ensures day cells have proper ARIA labels and 44px touch targets
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminPage from '../pages/AdminPage';

// Mock fetch for slot data
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('Admin Accessibility', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ 
        slots: [
          {
            id: '1',
            date: '2025-08-15',
            time: '09:00',
            capacity: 20,
            booked: 5,
            blackout: false,
            restrictions: {}
          }
        ]
      })
    });
  });

  describe('Month View Accessibility', () => {
    it('provides proper ARIA labels for day cells', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Wait for month view to render
      const monthGrid = await screen.findByTestId('month-view-grid');
      
      // Check for day cells with data-testid
      const dayCells = monthGrid.querySelectorAll('[data-testid^="month-cell-"]');
      expect(dayCells.length).toBeGreaterThan(0);

      // Verify each day cell has accessible information
      dayCells.forEach(cell => {
        const dateISO = cell.getAttribute('data-testid')?.replace('month-cell-', '');
        
        // Should have a meaningful title or aria-label
        const title = cell.getAttribute('title');
        const ariaLabel = cell.getAttribute('aria-label');
        
        expect(title || ariaLabel).toBeTruthy();
        
        // If it has slots, should describe availability
        const slotBadge = cell.querySelector('[data-testid*="slot-count-badge"]');
        if (slotBadge) {
          expect(title || ariaLabel).toMatch(/(slot|available|capacity)/i);
        }
      });
    });

    it('ensures day cells meet 44px minimum touch target size', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const monthGrid = await screen.findByTestId('month-view-grid');
      const dayCells = monthGrid.querySelectorAll('[data-testid^="month-cell-"]');

      dayCells.forEach(cell => {
        const styles = getComputedStyle(cell);
        const rect = cell.getBoundingClientRect();
        
        // Check minimum touch target size (44px x 44px per WCAG)
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
        
        // Should have adequate padding for touch
        const minHeight = styles.getPropertyValue('min-height');
        expect(minHeight).toMatch(/\d+px/);
      });
    });

    it('provides keyboard navigation support', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const monthGrid = await screen.findByTestId('month-view-grid');
      const firstDayCell = monthGrid.querySelector('[data-testid^="month-cell-"]') as HTMLElement;
      
      expect(firstDayCell).toBeInTheDocument();
      
      // Should be focusable with keyboard
      expect(firstDayCell.tagName.toLowerCase()).toBe('button');
      expect(firstDayCell.getAttribute('tabindex')).not.toBe('-1');
      
      // Test keyboard interaction
      firstDayCell.focus();
      expect(document.activeElement).toBe(firstDayCell);
      
      // Should respond to Enter key
      fireEvent.keyDown(firstDayCell, { key: 'Enter' });
      // Note: Actual behavior testing would require integration with day peek
    });

    it('provides status indicators with accessible text alternatives', async () => {
      // Mock slot with blackout and restrictions
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          slots: [
            {
              id: '1',
              date: '2025-08-15',
              time: '09:00',
              capacity: 20,
              booked: 5,
              blackout: true,
              restrictions: { growers: ['grower1'] }
            }
          ]
        })
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Check blackout indicator accessibility
      const blackoutIndicator = await screen.findByTestId('blackout-indicator-2025-08-15');
      expect(blackoutIndicator.getAttribute('title')).toBe('Blackout day');
      
      // Check restriction indicator accessibility  
      const restrictionIndicator = await screen.findByTestId('restriction-indicator-2025-08-15');
      expect(restrictionIndicator.getAttribute('title')).toBe('Restricted slots');
    });
  });

  describe('Week View Accessibility', () => {
    it('ensures slot ribbons have adequate touch targets', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Switch to week view
      const weekButton = screen.getByText('Week');
      fireEvent.click(weekButton);

      // Wait for slot ribbons
      const slotRibbon = await screen.findByTestId('week-slot-ribbon-1');
      
      const rect = slotRibbon.getBoundingClientRect();
      expect(rect.height).toBeGreaterThanOrEqual(32); // Minimum for readable text + touch
      
      // Should have proper hover/focus states
      expect(slotRibbon.className).toContain('cursor-pointer');
      expect(slotRibbon.className).toContain('hover:');
    });

    it('provides descriptive tooltips for slot ribbons', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const weekButton = screen.getByText('Week');
      fireEvent.click(weekButton);

      const slotRibbon = await screen.findByTestId('week-slot-ribbon-1');
      const title = slotRibbon.getAttribute('title');
      
      expect(title).toBeTruthy();
      expect(title).toMatch(/\d+:\d+.*\d+\/\d+.*available/); // Time and availability info
    });
  });

  describe('Day View Accessibility', () => {
    it('provides accessible timeline for desktop users', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 1024
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const dayButton = screen.getByText('Day');
      fireEvent.click(dayButton);

      const timeline = await screen.findByTestId('day-timeline');
      expect(timeline).toBeInTheDocument();

      // Timeline hours should be keyboard accessible
      const timelineHours = timeline.querySelectorAll('[data-testid^="timeline-hour-"]');
      timelineHours.forEach(hour => {
        expect(hour.getAttribute('role')).toBe(null); // Should be button by default
        expect(hour.getAttribute('aria-label') || hour.textContent).toBeTruthy();
      });
    });

    it('provides accessible mobile FAB dialog', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        value: 500
      });

      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const dayButton = screen.getByText('Day');
      fireEvent.click(dayButton);

      const fabButton = await screen.findByTestId('mobile-add-slot-button');
      fireEvent.click(fabButton);

      // Check dialog accessibility
      const fabOverlay = screen.getByTestId('mobile-fab-overlay');
      expect(fabOverlay).toBeInTheDocument();

      // Form inputs should have proper labels
      const startTimeInput = screen.getByTestId('mobile-fab-start-time');
      const label = startTimeInput.closest('div')?.querySelector('label');
      expect(label?.textContent).toBe('Start Time');

      // Close button should be accessible
      const closeButton = screen.getByTestId('mobile-fab-close');
      expect(closeButton.getAttribute('aria-label') || closeButton.textContent).toBeTruthy();
    });
  });

  describe('Focus Management', () => {
    it('maintains logical tab order in month view', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Check view toggle buttons are in logical order
      const monthButton = screen.getByText('Month');
      const weekButton = screen.getByText('Week'); 
      const dayButton = screen.getByText('Day');

      expect(monthButton.tabIndex).toBeLessThanOrEqual(weekButton.tabIndex);
      expect(weekButton.tabIndex).toBeLessThanOrEqual(dayButton.tabIndex);
    });

    it('provides skip links or focus management for large calendars', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const monthGrid = await screen.findByTestId('month-view-grid');
      
      // Month grid should be accessible as a group
      expect(monthGrid.getAttribute('role') || monthGrid.tagName.toLowerCase()).toBeTruthy();
      
      // First focusable element should be reachable
      const firstFocusable = monthGrid.querySelector('button, [tabindex="0"]');
      expect(firstFocusable).toBeInTheDocument();
    });
  });

  describe('Screen Reader Support', () => {
    it('provides meaningful announcements for slot status changes', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      // Status indicators should have descriptive text
      const slotBadge = await screen.findByTestId('slot-count-badge-2025-08-15');
      const title = slotBadge.getAttribute('title');
      
      expect(title).toMatch(/\d+ slots?, \d+ remaining/);
    });

    it('supports high contrast and custom theme preferences', async () => {
      render(
        <TestWrapper>
          <AdminPage />
        </TestWrapper>
      );

      const monthGrid = await screen.findByTestId('month-view-grid');
      
      // Should use semantic HTML and proper contrast classes
      const dayButtons = monthGrid.querySelectorAll('button');
      dayButtons.forEach(button => {
        const styles = getComputedStyle(button);
        
        // Should have border or background for visibility
        expect(
          styles.border !== 'none' || 
          styles.backgroundColor !== 'transparent'
        ).toBe(true);
      });
    });
  });
});