# ISSUES.md - Issue Tracking & Rule Violations

This file tracks issues, technical debt, and any violations of the governance rules defined in rules.md.

## Active Issues 🔴

### Blueprint Implementation Verification (August 14, 2025) - NEW
- **Severity**: Medium
- **Description**: Repository verification sweep identified minor discrepancies with blueprint specifications
- **Found Issues**:
  - API endpoints use `/api/` prefix instead of blueprint-specified `/v1/` prefix
  - Missing `/api/export/bookings.csv` endpoint implementation
  - FastAPI backend structure exists in `/app/backend/` but current implementation uses Node.js/Express
  - Migration files exist but dual backend creates confusion
- **Impact**: Blueprint contract alignment, future development clarity
- **Action Required**: 
  - Decide on single backend architecture (Node.js or FastAPI)
  - Implement missing CSV export endpoint
  - Consider API versioning strategy
- **Priority**: Medium - functionality works but architecture drift present

### API Contract Discrepancy (August 14, 2025) - NEW
- **Severity**: Low
- **Description**: Current API uses `/api/` prefix instead of blueprint-specified `/v1/` prefix
- **Files Affected**: `server/routes.ts`, `client/src/lib/api.ts`
- **Impact**: Future versioning strategy, blueprint compliance
- **Solution Options**: 
  1. Update all endpoints to use `/v1/` prefix
  2. Add `/v1/` alias routes for backward compatibility
  3. Update blueprint to reflect current `/api/` convention
- **Recommendation**: Option 2 - maintain compatibility while adding v1 routes

### Missing CSV Export Endpoint
- **Severity**: Medium  
- **Description**: Blueprint specifies CSV export endpoint but not implemented
- **Details**: GET /api/export/bookings.csv endpoint missing from server routes
- **Impact**: Admin data export functionality unavailable
- **Solution Required**: Implement CSV endpoint in server/routes.ts

## Resolved Issues ✅

### LSP Diagnostics (August 14, 2025) - RESOLVED
- **Issue**: Multiple TypeScript/Python LSP errors in backend and calendar features
- **Resolution**: All TypeScript imports and calendar implementation working correctly
- **Verification**: LSP diagnostics show no current errors, Day/Week toggle functional

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

### Calendar Day/Week Toggle (August 14, 2025) - RESOLVED
- **Issue**: Week view button missing, only Day button visible in calendar interface
- **Resolution**: Enabled Week view by setting isWeekViewEnabled = true across all calendar pages
- **Implementation**: Week view displays 7-day grid with time-axis layout, proper date navigation
- **Verification**: Both Day and Week buttons visible and functional, grid switches correctly
- **Compliance**: Blueprint MVP requirement (Sections 1.3, 7, 12) for Day/Week views fulfilled

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