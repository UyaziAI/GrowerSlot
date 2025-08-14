# ISSUES.md - Issue Tracking & Rule Violations

This file tracks issues, technical debt, and any violations of the governance rules defined in rules.md.

## Active Issues 🔴

### Timeline Accessibility Testing (August 14, 2025) - UPDATED
- **Severity**: Low
- **Description**: Comprehensive accessibility testing needed for timeline pill interactions
- **Details**: 
  - Restored transform scaling with computed rail heights for proper clearance
  - Pills properly centered with symmetric padding (RAIL_PAD_Y = 16px)
  - Focus rings and hover shadows fully visible with overflow-y-visible chain
  - Keyboard navigation working (arrow keys, Enter/Space)
  - Visual clipping tests added for 90%-125% zoom levels
- **Impact**: Screen reader users and keyboard-only navigation
- **Testing Required**: 
  - Test with screen readers (NVDA, JAWS, VoiceOver)
  - Verify ARIA labels and roles are properly announced
  - Confirm tab order and focus management
  - Test high contrast mode compatibility

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

### Timeline Pill Sizing for Long Labels and Compact Layout (August 14, 2025) - RESOLVED
- **Issue**: Pills too small for longer labels like "155.5" causing overflow, and timeline taking excessive vertical space
- **Root Cause**: 72px pills insufficient for longer availability numbers, and excessive padding creating large timeline
- **Resolution**: 
  - Increased pill size to w-[84px] h-[84px] flex-shrink-0 to accommodate longer labels
  - Expanded badge sizes from max-w-[40px] to max-w-[56px] for better label display
  - Reduced rail padding from 14px to 10px for more compact timeline appearance
  - Maintained content overflow protection: truncation, absolute positioned flags
  - Removed all transform scaling (whileHover, whileTap, animate scale) to prevent clipping
  - Selection indicated via visual highlight only (border-blue-500, bg-blue-50, ring-2)
  - Enhanced centering with scrollIntoView({ inline: 'center' }) and focus() for accessibility
  - Balanced container dimensions: ITEM_TRACK (98px), RAIL_MIN_HEIGHT (118px) with compact 10px padding
- **Status**: Optimized pill size for long labels with compact timeline layout achieved

### DayTimeline Initial Load & Interaction (August 14, 2025) - RESOLVED  
- **Issue**: Timeline centering failed for initial load, Today button, and Jump-to-date functionality
- **Root Cause**: Virtualizer scroll element binding mismatch causing getOffsetForIndex tuple handling issues
- **Resolution**: 
  - Fixed virtualizer.scrollToIndex implementation with proper scroll element binding
  - Resolved getOffsetForIndex tuple return value extraction
  - Eliminated nested scroll containers interfering with calculations
  - Added comprehensive debugging for scroll positioning verification
- **Status**: Timeline now centers reliably on all centering operations

### Week Overview UX (August 14, 2025) - RESOLVED
- **Issue**: Week view used hourly time grid instead of day card overview per Blueprint Section 7
- **Resolution**: Implemented WeekOverviewGrid and DayCard components replacing time grid layout
- **Features**: 7 day cards with availability summaries, click-to-navigate, responsive design
- **Compliance**: Blueprint Section 7 UX plan fully implemented with proper navigation flow

## Resolved Issues ✅

### Timeline Pill Vertical Clipping (August 14, 2025) - RESOLVED
- **Issue**: Selected day pills were being cut off at top/bottom due to CSS transform scaling
- **Root Cause**: Using transform: scale() caused pills to extend beyond container bounds
- **Resolution**: 
  - Removed transform scale animations from DayPill component
  - Implemented layout-based sizing using larger padding for selected pills (p-5 vs p-4)
  - Increased font sizes for selected pills (text-2xl vs text-xl)
  - Optimized container height to 120px with symmetric 16px vertical padding
  - Maintained overflow-y-visible throughout container hierarchy
- **Compliance**: Followed strict requirements for clean layout without transform overflow artifacts
- **Status**: Pills now properly centered and never clipped, maintaining professional appearance

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