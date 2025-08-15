# Repository Scan Report
Generated: August 14, 2025

## Executive Summary
Comprehensive scan of the Grower Slot SaaS repository to align with Blueprint.md specifications and resolve all issues.

## 1. API Endpoint Migration Status

### ✅ GOOD: API Client (client/src/lib/api.ts)
- Already uses `/v1` prefix for all endpoints
- Properly structured with apiRequest wrapper

### ❌ ISSUES: Query Keys Still Using `/api/`
Found legacy `/api/` references in query keys:
- `client/src/components/booking-modal.tsx` - Lines with `/api/cultivars`, `/api/slots`, `/api/bookings`
- `client/src/pages/grower-dashboard.tsx` - `/api/bookings` query key
- `client/src/pages/admin-dashboard.tsx` - `/api/admin/stats` query key
- `client/src/pages/admin-slots.tsx` - `/api/admin/stats`, `/api/slots` query keys
- `client/src/pages/grower-dashboard-old.tsx` - Multiple `/api/` references (legacy file)
- `client/src/pages/admin-dashboard-old.tsx` - Multiple `/api/` references (legacy file)
- `client/src/hooks/useSlotsRange.ts` - Direct fetch to `/api/slots/range`

### ❌ ISSUES: Direct API Calls Not Using apiRequest
- `client/src/hooks/useSlotsRange.ts` - Direct fetch() instead of using api.getSlotsRange()

## 2. Data Fabrication & Phantom Slots

### ✅ GOOD: No Client-Side Slot Generation Found
- No `generateSlots`, `buildDayGrid`, or `placeholderData` functions found
- Components appear to render only backend data

### ⚠️ POTENTIAL ISSUES
- Need to verify empty state handling when API returns []
- Check for any keepPreviousData usage that might show stale data

## 3. Query Key Structure

### ❌ ISSUES: Inconsistent Query Keys
Current query keys don't consistently include:
- `tenantId` for proper multi-tenant isolation
- Date ranges (startISO, endISO) for cache management
- Proper array structure for hierarchical invalidation

Example issues:
- `["/api/bookings"]` should be `["bookings", tenantId, startDate, endDate]`
- `["/api/slots"]` should be `["slots", tenantId, startDate, endDate]`

## 4. TypeScript/LSP Diagnostics

### ✅ GOOD: No LSP Errors Found
- No TypeScript compilation errors detected
- No Python linting issues found

## 5. Backend Compliance

### ⚠️ TO VERIFY
Need to check:
- Booking concurrency with SELECT FOR UPDATE pattern
- Domain events and outbox emission on booking operations
- 409/403 error handling in UI
- No side effects in GET endpoints

## 6. Database Schema

### ⚠️ TO VERIFY
Need to confirm:
- All migrations match Blueprint §4
- Timezone handling defaults to Africa/Johannesburg
- Extensibility tables present (parties, products, consignments, etc.)

## 7. RBAC & Authentication

### ✅ GOOD: Basic RBAC Present
- Admin dashboard checks user role
- Redirects non-admin users to /calendar

### ⚠️ TO VERIFY
- Token includes tenant_id and roles
- All admin-only operations properly protected

## 8. Legacy Code

### ❌ ISSUES: Unused Legacy Files
Found legacy files that should be removed:
- `client/src/pages/grower-dashboard-old.tsx`
- `client/src/pages/admin-dashboard-old.tsx`

## Proposed Fixes

### Priority 1: API Migration
1. Update all query keys to remove `/api/` prefix
2. Convert useSlotsRange hook to use api.getSlotsRange()
3. Standardize query keys with [resource, tenantId, ...params]

### Priority 2: Data Integrity
1. Verify empty state rendering
2. Remove keepPreviousData unless with loading states
3. Add proper error boundaries

### Priority 3: Cleanup
1. Remove -old.tsx files
2. Update imports and references

### Priority 4: Testing
1. Add concurrency tests for booking
2. Verify domain events emission
3. Test empty state scenarios

## Files Requiring Changes
1. `client/src/hooks/useSlotsRange.ts` - Convert to use apiRequest
2. `client/src/components/booking-modal.tsx` - Update query keys
3. `client/src/pages/grower-dashboard.tsx` - Update query keys
4. `client/src/pages/admin-dashboard.tsx` - Update query keys
5. `client/src/pages/admin-slots.tsx` - Update query keys
6. Remove: `client/src/pages/*-old.tsx` files