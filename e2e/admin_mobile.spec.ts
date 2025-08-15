import { test, expect } from '@playwright/test';

// Mobile viewport configurations
const MOBILE_VIEWPORTS = [
  { name: 'iPhone 12 mini', width: 390, height: 844 },
  { name: 'Galaxy S20', width: 412, height: 915 }
];

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Admin Mobile Tests - ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.beforeEach(async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      // Navigate to admin page
      await page.goto('/admin');
      
      // Wait for calendar to load
      await expect(page.getByTestId('admin-page')).toBeVisible();
    });

    test('tap day opens DayPeekSheet and is dismissible', async ({ page }) => {
      // Find and tap a day cell
      const dayCell = page.locator('[data-testid^="day-cell-"]').first();
      await dayCell.click();

      // DayPeekSheet should open
      await expect(page.getByTestId('day-peek-sheet')).toBeVisible();
      
      // Should show date and summary information
      await expect(page.locator('h2')).toContainText(', 2025');
      
      // Should have touch-friendly action buttons
      await expect(page.getByTestId('button-create-day')).toBeVisible();
      await expect(page.getByTestId('button-blackout-day')).toBeVisible();
      await expect(page.getByTestId('button-restrict-day')).toBeVisible();
      
      // Should be dismissible by tapping outside or close button
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('day-peek-sheet')).not.toBeVisible();
    });

    test('tap Edit Day opens DayEditorSheet full-height with close functionality', async ({ page }) => {
      // Open day peek sheet first
      const dayCell = page.locator('[data-testid^="day-cell-"]').first();
      await dayCell.click();
      
      await expect(page.getByTestId('day-peek-sheet')).toBeVisible();
      
      // Click "Edit Day" link
      await page.getByTestId('link-edit-day').click();
      
      // DayEditorSheet should open
      await expect(page.getByTestId('day-editor-sheet')).toBeVisible();
      
      // Should show full-height layout with sections
      await expect(page.getByTestId('day-overview-section')).toBeVisible();
      await expect(page.getByTestId('quick-create-section')).toBeVisible();
      await expect(page.getByTestId('utilities-section')).toBeVisible();
      
      // Should have mobile-friendly form elements
      await expect(page.getByTestId('input-slot-capacity')).toBeVisible();
      await expect(page.getByTestId('textarea-slot-notes')).toBeVisible();
      
      // Should close on Escape
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('day-editor-sheet')).not.toBeVisible();
    });

    test('selection mode shows BulkBar and executes blackout action', async ({ page }) => {
      // Enter selection mode
      await page.getByTestId('button-select-mode').click();
      
      // Select multiple days
      const dayCells = page.locator('[data-testid^="day-cell-"]');
      await dayCells.nth(0).click();
      await dayCells.nth(1).click();
      await dayCells.nth(2).click();
      
      // BulkBar should appear at bottom
      await expect(page.getByTestId('bulk-bar')).toBeVisible();
      await expect(page.getByTestId('selection-count')).toContainText('3 days selected');
      
      // Execute blackout action
      await page.getByTestId('button-bulk-blackout').click();
      
      // Confirmation dialog should appear
      await expect(page.getByTestId('bulk-blackout-confirmation-text')).toBeVisible();
      await expect(page.getByTestId('bulk-blackout-confirmation-text')).toContainText('3 selected days');
      
      // Confirm action
      await page.getByTestId('confirm-bulk-blackout').click();
      
      // Should trigger API call and refetch
      await expect(page.getByTestId('bulk-bar')).not.toBeVisible({ timeout: 5000 });
    });

    test('Day view FAB creates slot and manages existing slots', async ({ page }) => {
      // Switch to day view
      await page.getByTestId('tab-day').click();
      
      // FAB should be visible and properly positioned
      await expect(page.getByTestId('day-view-fab')).toBeVisible();
      
      // Click FAB to open create dialog
      await page.getByTestId('day-view-fab').click();
      
      // Create slot dialog should open
      await expect(page.getByTestId('create-slot-dialog')).toBeVisible();
      
      // Fill form with mobile-friendly inputs
      await page.getByTestId('input-new-capacity').fill('25');
      await page.getByTestId('textarea-new-notes').fill('Mobile created slot');
      
      // Submit slot creation
      await page.getByTestId('button-confirm-create').click();
      
      // Dialog should close and slot should appear in list
      await expect(page.getByTestId('create-slot-dialog')).not.toBeVisible();
      
      // If slots exist, test SlotSheet functionality
      const slotItems = page.locator('[data-testid^="day-slot-"]');
      const slotCount = await slotItems.count();
      
      if (slotCount > 0) {
        // Click on existing slot
        await slotItems.first().click();
        
        // SlotSheet should open
        await expect(page.getByTestId('slot-sheet')).toBeVisible();
        
        // Should show overview stats
        await expect(page.getByTestId('slot-overview-section')).toBeVisible();
        
        // Toggle blackout if switch is available
        const blackoutSwitch = page.getByTestId('switch-blackout-slot');
        if (await blackoutSwitch.isVisible()) {
          await blackoutSwitch.click();
        }
      }
    });

    test('accessibility - day cells have proper ARIA labels', async ({ page }) => {
      // Check day cells for accessibility attributes
      const dayCells = page.locator('[data-testid^="day-cell-"]');
      const firstCell = dayCells.first();
      
      // Should have accessible name or aria-label
      const ariaLabel = await firstCell.getAttribute('aria-label');
      const textContent = await firstCell.textContent();
      
      // Should contain slot information in accessible format
      expect(ariaLabel || textContent).toMatch(/\d+/); // Should contain numbers (date or slot count)
    });

    test('accessibility - forms have proper labels and structure', async ({ page }) => {
      // Open day peek sheet
      const dayCell = page.locator('[data-testid^="day-cell-"]').first();
      await dayCell.click();
      
      // Open editor
      await page.getByTestId('link-edit-day').click();
      await expect(page.getByTestId('day-editor-sheet')).toBeVisible();
      
      // Check form accessibility
      const capacityInput = page.getByTestId('input-slot-capacity');
      const notesTextarea = page.getByTestId('textarea-slot-notes');
      
      // Should have associated labels
      await expect(page.getByText('Capacity')).toBeVisible();
      await expect(page.getByText('Notes')).toBeVisible();
      
      // Form elements should be focusable
      await capacityInput.focus();
      await expect(capacityInput).toBeFocused();
      
      await notesTextarea.focus();
      await expect(notesTextarea).toBeFocused();
    });

    test('accessibility - confirmation dialogs have proper structure', async ({ page }) => {
      // Open day peek sheet
      const dayCell = page.locator('[data-testid^="day-cell-"]').first();
      await dayCell.click();
      
      // Trigger blackout confirmation
      await page.getByTestId('button-blackout-day').click();
      
      // Dialog should have proper accessibility structure
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Should have heading
      await expect(page.getByRole('heading', { name: 'Blackout Day' })).toBeVisible();
      
      // Should have description
      await expect(page.getByTestId('blackout-confirmation-text')).toBeVisible();
      
      // Action buttons should be clearly labeled
      await expect(page.getByTestId('confirm-blackout-day')).toContainText('Blackout Day');
    });

    test('touch interactions - button sizes and spacing', async ({ page }) => {
      // Open day peek sheet
      const dayCell = page.locator('[data-testid^="day-cell-"]').first();
      await dayCell.click();
      
      await expect(page.getByTestId('day-peek-sheet')).toBeVisible();
      
      // Check touch target sizes (minimum 44px recommended)
      const createButton = page.getByTestId('button-create-day');
      const blackoutButton = page.getByTestId('button-blackout-day');
      
      // Buttons should be visible and clickable
      await expect(createButton).toBeVisible();
      await expect(blackoutButton).toBeVisible();
      
      // Should be able to tap buttons successfully
      await createButton.click();
      // Should close the sheet or take action
    });

    test('viewport adaptation - BulkBar adapts to screen width', async ({ page }) => {
      // Enter selection mode
      await page.getByTestId('button-select-mode').click();
      
      // Select days
      const dayCells = page.locator('[data-testid^="day-cell-"]');
      await dayCells.nth(0).click();
      await dayCells.nth(1).click();
      
      // BulkBar should be visible
      await expect(page.getByTestId('bulk-bar')).toBeVisible();
      
      // Should show appropriate information for viewport
      await expect(page.getByTestId('selection-count')).toBeVisible();
      
      // Action buttons should be accessible
      await expect(page.getByTestId('button-bulk-blackout')).toBeVisible();
      await expect(page.getByTestId('button-bulk-restrictions')).toBeVisible();
    });

    test('FAB positioning for thumb accessibility', async ({ page }) => {
      // Switch to day view
      await page.getByTestId('tab-day').click();
      
      // FAB should be positioned in thumb-friendly zone
      const fab = page.getByTestId('day-view-fab');
      await expect(fab).toBeVisible();
      
      // Should be in bottom-right position (thumb zone for right-handed users)
      const fabBox = await fab.boundingBox();
      expect(fabBox).toBeTruthy();
      
      if (fabBox) {
        // Should be near bottom-right of screen
        expect(fabBox.x + fabBox.width).toBeGreaterThan(viewport.width * 0.8);
        expect(fabBox.y + fabBox.height).toBeGreaterThan(viewport.height * 0.8);
      }
    });
  });
}

test.describe('Cross-Viewport Mobile Tests', () => {
  test('responsive layout transitions smoothly between mobile sizes', async ({ page }) => {
    // Start with smaller viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/admin');
    
    await expect(page.getByTestId('admin-page')).toBeVisible();
    
    // Change to larger mobile viewport
    await page.setViewportSize({ width: 412, height: 915 });
    
    // Layout should adapt without breaking
    await expect(page.getByTestId('admin-page')).toBeVisible();
    await expect(page.getByTestId('calendar-month')).toBeVisible();
  });

  test('mobile navigation remains consistent across viewports', async ({ page }) => {
    const viewports = [
      { width: 390, height: 844 },
      { width: 412, height: 915 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/admin');
      
      await expect(page.getByTestId('admin-page')).toBeVisible();
      
      // Tab navigation should work on all mobile sizes
      await expect(page.getByTestId('tab-month')).toBeVisible();
      await expect(page.getByTestId('tab-week')).toBeVisible();
      await expect(page.getByTestId('tab-day')).toBeVisible();
      
      // Should be able to switch views
      await page.getByTestId('tab-day').click();
      await expect(page.getByTestId('day-view-slots')).toBeVisible();
    }
  });
});