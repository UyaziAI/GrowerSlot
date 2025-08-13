# ISSUES.md - Issue Tracking & Rule Violations

This file tracks issues, technical debt, and any violations of the governance rules defined in rules.md.

## Active Issues 🔴

### LSP Diagnostics (August 13, 2025) - Updated
- **Severity**: Medium
- **Description**: Multiple TypeScript/Python LSP errors in backend and new calendar features
- **Files Affected**: 
  - `app/backend/schemas.py` (3 diagnostics) - schema validation issues
  - `app/frontend/src/features/booking/hooks/useSlotsRange.ts` (1 diagnostic) - import issue
  - `app/frontend/src/features/booking/components/CalendarGrid.tsx` (13 diagnostics) - type/import issues
  - `app/frontend/src/features/booking/CalendarPage.tsx` (4 diagnostics) - import issues
  - `app/backend/tests/test_slots_range.py` (1 diagnostic) - import/mock issues
  - `app/frontend/src/features/booking/__tests__/CalendarGrid.test.tsx` (44 diagnostics) - testing imports
  - `app/frontend/src/features/booking/__tests__/useSlotsRange.test.ts` (51 diagnostics) - testing imports
- **Impact**: Development experience, testing setup needs refinement
- **Action Required**: Fix shadcn/ui imports, testing library setup, Python test structure
- **Note**: Calendar functionality implemented but needs import fixes for clean builds

### Frontend Routing Integration
- **Severity**: Low
- **Description**: New CalendarPage component needs to be integrated with app routing
- **Details**: Calendar grid components created but not yet added to main navigation
- **Impact**: Calendar features accessible via direct component import but not via app navigation
- **Solution Required**: Add /calendar route and navigation links

## Resolved Issues ✅

### Authentication Flow (August 13, 2025)
- **Issue**: JWT authentication headers not properly included in API requests
- **Resolution**: Fixed in `/client/src/lib/queryClient.ts` with proper token inclusion
- **Verification**: Login working for both admin and grower users

### Database Schema Consistency (August 13, 2025)  
- **Issue**: TypeScript type errors due to timestamptz vs timestamp inconsistency
- **Resolution**: Updated schema definitions to use consistent timestamp types
- **Verification**: No more TypeScript compilation errors in core schema

### Booking Concurrency (August 13, 2025)
- **Issue**: Risk of overbooking without proper concurrency controls
- **Resolution**: Implemented SELECT FOR UPDATE pattern in booking endpoint
- **Verification**: Tested with concurrent requests, proper 409 responses

## Technical Debt 📋

### Dual Backend Architecture
- **Description**: Running both Node.js (legacy) and FastAPI (blueprint) backends
- **Impact**: Increased complexity, potential confusion
- **Priority**: Medium
- **Solution**: Gradual migration or clear separation of responsibilities
- **Timeline**: Evaluate after Phase 1 completion

### Migration Strategy  
- **Description**: Manual migration files need integration with development workflow
- **Impact**: Risk of inconsistent database states across environments
- **Priority**: Medium
- **Solution**: Automated migration runner integration with CI/CD

### Frontend Module Structure
- **Description**: New feature modules not fully integrated with existing app structure
- **Impact**: Some blueprint features not accessible via navigation
- **Priority**: Medium
- **Solution**: Update routing and navigation to include logistics/quality modules

## Rule Violations 🚨

### Documentation Lag (Resolved - August 13, 2025)
- **Rule**: Section 2 - Always update BLUEPRINT.md when adding features
- **Violation**: Initial FastAPI implementation done without immediate doc updates
- **Resolution**: BLUEPRINT.md confirmed current, FEATURES.md created
- **Prevention**: This tracking system now in place

### Testing Coverage Gap
- **Rule**: Section 6 - Implement tests for new functionality  
- **Violation**: New FastAPI endpoints lack comprehensive test coverage
- **Status**: Acknowledged technical debt
- **Action**: Add integration tests for booking concurrency and domain events

## Monitoring & Alerts 📊

### Performance Issues
- **Current**: No active performance issues
- **Monitoring**: Workflow console shows reasonable response times (<3000ms)
- **Baseline**: Admin stats: ~700ms, Slot queries: ~1200ms, Bookings: ~2200ms

### Error Patterns
- **Current**: No recurring errors in production logs
- **Last Issues**: Resolved authentication and schema errors from August 13

## Next Review Actions 📅

1. **Fix LSP diagnostics** - Address all TypeScript/Python type and import errors
2. **Complete frontend integration** - Wire new logistics UI to FastAPI endpoints  
3. **Add integration tests** - Implement concurrent booking and domain event tests
4. **Evaluate backend strategy** - Decision on dual architecture moving forward
5. **Update CI/CD** - Integrate migration runner with deployment process

---
**Issue Tracking Guidelines**:
- Mark issues with severity: Critical 🔥, High 🔴, Medium 🟡, Low 🟢  
- Include date, description, impact, and required actions
- Move resolved issues to "Resolved" section with resolution details
- Review monthly or after major changes

**Last Updated**: August 13, 2025  
**Next Review**: After LSP issues resolved and frontend integration complete