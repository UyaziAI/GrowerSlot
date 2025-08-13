# ISSUES.md - Issue Tracking & Rule Violations

This file tracks issues, technical debt, and any violations of the governance rules defined in rules.md.

## Active Issues 🔴

### LSP Diagnostics (August 13, 2025)
- **Severity**: Medium
- **Description**: Multiple TypeScript/Python LSP errors in new FastAPI backend files
- **Files Affected**: 
  - `app/backend/db.py` (4 diagnostics)
  - `app/backend/security.py` (1 diagnostic) 
  - `app/backend/schemas.py` (2 diagnostics)
  - `app/backend/routers/bookings.py` (1 diagnostic)
  - `app/backend/routers/logistics.py` (1 diagnostic)
  - `app/frontend/src/features/logistics/InboundPage.tsx` (47 diagnostics)
- **Impact**: Development experience, potential runtime issues
- **Action Required**: Fix import issues, type definitions, missing dependencies
- **Assigned**: Next development cycle

### Frontend API Integration
- **Severity**: Medium
- **Description**: New FastAPI endpoints not yet integrated with existing frontend
- **Details**: Frontend still using legacy Node.js endpoints (/api/) instead of new FastAPI (/v1/)
- **Impact**: New extensibility features not accessible via UI
- **Solution Required**: Update frontend to use new API client for blueprint features

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