# Issues Tracking

## Current Issues (B15 Implementation)

### CSV Export Implementation (August 15, 2025) - ✅ RESOLVED
- **Status**: Complete
- **Tests**: `/app/backend/tests/test_exports_bookings_csv.py` - comprehensive test coverage including:
  - 200 response with correct headers and CSV format
  - Date range filtering validation 
  - Unicode encoding (UTF-8) for international characters
  - Optional filtering by grower_id, cultivar_id, status
  - Admin-only access control (403 for non-admin users)
  - Tenant scoping verification
  - Invalid parameter validation (400 for start > end)
  - Empty result handling (header-only CSV)

### Acceptance Criteria
- ✅ **Header Order Fixed**: Exact column order `booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes`
- ✅ **UTF-8 Encoding**: Proper handling of international characters in names and notes
- ✅ **Filterable**: Date range (required), grower_id, cultivar_id, status (all optional)
- ✅ **Streaming Response**: Memory-efficient for large datasets
- ✅ **Admin Access**: Role-based access control enforced
- ✅ **Tenant Scoped**: Data isolation per tenant
- ✅ **Proper Headers**: Content-Type and Content-Disposition set correctly

### Technical Implementation
- **Router**: `/app/backend/routers/exports.py`
- **Schema**: `BookingsExportRequest` in `/app/backend/schemas.py`
- **Endpoint**: `GET /v1/exports/bookings.csv`
- **Authentication**: Uses `require_role("admin")` dependency
- **Response**: FastAPI StreamingResponse with CSV generator
- **Database**: Joins bookings, slots, growers, cultivars with tenant filtering

### Test Coverage Status
- ✅ Basic CSV format and headers validation
- ✅ Date range filtering functionality  
- ✅ Unicode character encoding preservation
- ✅ Parameter validation (required/optional)
- ✅ Access control (admin vs grower roles)
- ✅ Tenant isolation verification
- ✅ Error handling for invalid inputs
- ✅ Empty dataset handling

### Documentation Updates
- ✅ Blueprint.md Section 6.6: Complete endpoint specification added

## UI Updates (August 15, 2025)
- ✅ **RESOLVED**: /admin route now renders AdminPage.tsx instead of legacy AdminDashboard
- ✅ **RESOLVED**: Legacy header replaced on AdminPage; Day Peek wired
- ✅ **RESOLVED**: Old scattered action buttons (Blackout, Apply Restrictions) removed from global header  
- ✅ **RESOLVED**: Day Peek sheet provides contextual actions when day cells are tapped
- ✅ **RESOLVED**: FilterDrawer component created as skeleton for future filter functionality
- ✅ **RESOLVED**: Legacy Admin header no longer visible - replaced with Create ▾ and More ▾ dropdowns

## Calendar Export & Sync (Future Features)

### Issue: P1 - ICS Feed Implementation
- **Priority**: Medium
- **Status**: Planned (Q1 2026)
- **Description**: Implement read-only ICS calendar feeds for external calendar subscription
- **Acceptance Criteria**:
  - `/v1/exports/calendar.ics` serves signed, tenant-scoped ICS feeds
  - Works seamlessly in Google Calendar, Outlook, Apple Calendar without auth prompts
  - No inbound write capabilities, read-only access only
  - Updates propagate within 15 minutes of slot changes
  - Tenant isolation maintained through signed URLs
- **Technical Requirements**: ICS format compliance, URL signing, tenant scoping

### Issue: P2 - External Calendar API Publishing
- **Priority**: Medium  
- **Status**: Planned (Q2 2026)
- **Description**: One-way publishing of slot data to external calendar services
- **Acceptance Criteria**:
  - Service can publish a month of slots to a selected external calendar
  - Idempotent operations handle create, update, and delete events correctly

## Admin Calendar V1 Follow-ups (August 15, 2025)

### Implementation Checklist
- [x] Month view with 42 cells (always full calendar grid)
- [x] Week view (7 columns) 
- [x] Day view (vertical list)
- [x] DayPeekSheet integration (day click opens sheet)
- [x] DayEditorSheet integration (Edit Day button)
- [x] BulkBar for multi-day selection
- [x] SlotSheet for individual slot management
- [x] Select mode toggle for bulk operations
- [x] Past date validation

### Admin V1 Compliance Issues (August 15, 2025)

#### API Endpoint Violations
- [x] **Fix slot fetching endpoint**: Changed `/v1/slots/range?start&end` to `/v1/slots?start&end` in AdminPage:47, client.ts:70, useSlotsRange.ts:22
- [ ] **Standardize blackout endpoints**: Ensure all blackout operations use spec-compliant format
- [x] **Error message passthrough**: Created lib/http.ts utility, updated AdminPage:52, BulkBar for verbatim `json.error` display

#### Feature Flag Integration Required  
- [ ] **Template functionality gating**: Implement `VITE_FEATURE_ADMIN_TEMPLATES=false` checks
- [ ] **Next Available integration**: Add `VITE_FEATURE_NEXT_AVAILABLE=false` conditional rendering
- [ ] **Environment file compliance**: Ensure .env.example includes required admin feature flags

#### Visual Indicator Gaps
- [ ] **Month view badges**: Add slot count/remaining capacity indicators per cell
- [ ] **Blackout icons**: Implement ⛔ visual indicator for blackout days/slots  
- [ ] **Restriction icons**: Add 🔒 indicator for restricted access periods
- [ ] **42-cell guarantee**: Add test coverage ensuring month always shows full 6×7 grid

#### Validation & Safety
- [ ] **Past date prevention**: Add `min=today` (Africa/Johannesburg) to all admin date inputs
- [ ] **Blackout booking prevention**: Implement 409 error handling for blackout slot booking attempts
- [ ] **Audit event emission**: Add event logging for admin CRUD operations

### V2 Enhancements (Future)
- [ ] Week ribbon with slot count badges
- [ ] Inspector panel with detailed slot info  
- [ ] Template preview and application drawer
- [ ] E2E CI tests for admin calendar flows
- [ ] Advanced filtering and search
- [ ] Drag-and-drop slot rearrangement
- [ ] Calendar virtualization for performance
  - Rate-limit safe with graceful handling of API throttling
  - Resilient to external API outages without data loss
  - Updates and deletions sync correctly to external calendar
- **Technical Requirements**: Google Calendar API, Microsoft Graph API integration, rate limiting

### Issue: P3 - Two-way Calendar Synchronization
- **Priority**: Low
- **Status**: Planned (Q3 2026) 
- **Description**: Bidirectional sync with limited field editing and conflict resolution
- **Acceptance Criteria**:
  - Inbound edits limited to time adjustments and notes only
  - Field violations are rejected with clear error messaging  
  - All changes maintain comprehensive audit trail
  - Conflict-free round-trip synchronization with ETags/deltas
  - Administrative override capabilities for conflict resolution
- **Technical Requirements**: ETag support, conflict resolution, audit logging, field validation
- ✅ FEATURES.md: Moved to "In-Progress" status with implementation details
- ✅ Router integration in main.py with /v1/exports prefix

## Resolved Issues

### B11-B14 Implementation Series (August 15, 2025)
- **B11**: Backend Next Available endpoint - ✅ Complete
- **B12**: Frontend Next Available dialog - ✅ Complete  
- **B13**: Frontend Restrictions UI - ✅ Complete
- **B14**: E2E smoke testing with Playwright - ✅ Complete

All previous implementation tasks have been successfully completed with comprehensive testing and documentation.