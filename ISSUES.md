# ISSUES.md - Issue Tracking & Rule Violations

This file tracks issues, technical debt, and any violations of the governance rules defined in rules.md.

## Active Issues 🔴

### Adopt Admin Addendum (docs phase) (August 15, 2025) - COMPLETED
- **Severity**: Medium
- **Description**: Incorporate Admin_Addendum.md into canonical blueprint documentation
- **Acceptance Criteria**:
  - ✅ Blueprint.md Delta section added with cross-links
  - ✅ FEATURES.md updated with new In-Progress items  
  - ✅ ISSUES.md updated with follow-up implementation issues
  - ✅ Changelog entry appended to Blueprint.md
- **Status**: COMPLETED - All documentation updates applied
- **Follow-up**: Implementation issues created below

### Implement Templates & Apply-Template endpoints + UI (feature-flagged) (August 15, 2025) - OPEN
- **Severity**: Medium
- **Description**: Implement the templates system as specified in Admin_Addendum.md
- **Scope**: 
  - Database: Add templates table migration (104_templates.sql)
  - API: Template CRUD endpoints (/v1/admin/templates, /v1/slots/apply-template)
  - Frontend: Template management UI with preview/publish workflow
  - Feature flag: VITE_FEATURE_ADMIN_TEMPLATES
- **Requirements**: 
  - Idempotent template application (no duplication on re-runs)
  - Preview mode shows change diff before publish
  - Proper tenant scoping and RBAC enforcement
- **Status**: OPEN - Ready for implementation

### Feature-flagged Admin implementation (Templates, Apply-Template, Inspector, Next Available) (August 15, 2025) - OPEN
- **Severity**: Medium  
- **Description**: Implement comprehensive Admin features per Admin_Addendum.md Delta section
- **Reference**: Blueprint.md Admin Addendum (15 Aug 2025) — Delta section
- **Scope**:
  - Add right-hand Inspector panel for slot details and quick actions
  - Implement drag-drop booking management with 403/409 error handling
  - Add Next Available finder (feature flag: VITE_FEATURE_NEXT_AVAILABLE)
  - Verify no client-side fabrication rule compliance (no UI fabrication)
  - Add comprehensive tests for admin calendar functionality
- **Acceptance Criteria**:
  - All UI renders only backend-provided data (no phantom slots)
  - Drag-drop booking moves handle 403/409 with proper UI revert behavior
  - Inspector panel shows slot details with inline edit capabilities
  - Template apply operations are idempotent (no duplication on re-runs)
  - Preview mode shows change diff before publish commit
- **Status**: OPEN - Ready for implementation behind feature flags

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





### Export endpoint design
- **Severity**: Medium  
- **Description**: Blueprint specifies CSV export endpoint but not implemented
- **Details**: GET /v1/exports/bookings.csv endpoint missing from FastAPI backend
- **Path**: `/app/backend/routers/exports.py`
- **Route**: GET /v1/exports/bookings.csv
- **Status**: Open (Backlog)
- **Impact**: Admin data export functionality unavailable

### Timeline Navigation and Clean Pill Design (August 14, 2025) - RESOLVED
- **Issue**: Pills cluttered with info icons, lack of month context during horizontal scrolling, suboptimal sizing
- **Root Cause**: Info icons (Ban, AlertCircle, FileText) cluttering pill display, no sticky month reference
- **Resolution**: 
  - Removed all info icons from pills for clean day/date/availability-only display
  - Implemented sticky month header (32px height) with dynamic month updates during scroll
  - Increased pill size to w-[84px] h-[84px] flex-shrink-0 to accommodate longer labels like "155.5"
  - Expanded badge sizes from max-w-[40px] to max-w-[56px] for better label display
  - Reduced rail padding to 8px for snug fit while accommodating sticky header
  - Added accessibility support: aria-live="polite" for month header, screen reader announcements
  - Maintained content overflow protection and visual-only selection highlighting
  - Enhanced centering with scrollIntoView({ inline: 'center' }) and focus() for accessibility
  - Final container dimensions: ITEM_TRACK (98px), RAIL_MIN_HEIGHT (114px), total height (146px)
- **Status**: Clean pill design with sticky month header navigation context achieved

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

### Repository Audit & API Migration (August 14, 2025) - RESOLVED
- **Issue**: Frontend query keys using `/api/` prefix, legacy files present, TypeScript errors
- **Resolution**:
  - Updated all query keys to use resource names: `["slots"]`, `["bookings"]`, etc.
  - Added tenantId scoping to query keys for proper multi-tenant caching  
  - Fixed useSlotsRange hook to use `/v1/slots/range` endpoint
  - Removed legacy files (admin-dashboard-old.tsx, grower-dashboard-old.tsx)
  - Fixed TypeScript type conversion issues
- **Verification**: All LSP diagnostics cleared, API contracts match Blueprint.md
- **Documentation**: Created SCAN_REPORT.md and VERIFICATION_REPORT.md

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

**Last Updated**: August 15, 2025  
**Next Review**: After Admin Addendum implementation tasks completed