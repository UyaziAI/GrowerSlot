# Changelog

All notable changes to the Grower Slot SaaS platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **2025-08-15**: Test coverage P3.1 — Comprehensive test pack: admin_api_compliance.spec.tsx (/v1/ endpoints), admin_error_handling.spec.tsx (verbatim 4xx messages), admin_accessibility.spec.tsx (ARIA, 44px targets), admin_feature_flags.spec.tsx (template gating). Complete Quality Assurance coverage.
- **2025-08-15**: UI completeness P2.4 — Implemented day view timeline and mobile FAB in AdminPage:295-480. Desktop timeline supports drag-to-create (6AM-8PM), mobile FAB with form inputs. Added admin_day_view.spec.tsx test coverage.
- **2025-08-15**: UI completeness P2.3 — Implemented week view slot ribbons in AdminPage:165-243. Color-coded ribbons show capacity/time data, ⛔ blackout, 🔒 restriction indicators. Added admin_week_view.spec.tsx test coverage.
- **2025-08-15**: UI completeness P2.2 — Wired toolbar dropdown menus in AdminPage:278-345. Create ▾ menu with day slots, bulk create, apply template (flag-gated). More ▾ menu with CSV export, filters, help. Added admin_toolbar_menus.spec.tsx test coverage.
- **2025-08-15**: UI completeness P2.1 — Added month view indicators: slot count badges, ⛔ blackout icons, 🔒 restriction icons in AdminPage:134-147. Guaranteed 42-cell calendar grid. Added admin_month_view.spec.tsx test coverage.
- **2025-08-15**: API compliance P1.3 — Implemented feature flag gates for VITE_FEATURE_ADMIN_TEMPLATES in DayEditorSheet:419, BulkBar:421. Template features now conditionally rendered. Added admin_feature_flags.spec.tsx test coverage.
- **2025-08-15**: API compliance P1.2 — Implemented verbatim 4xx error handling via lib/http.ts utility. AdminPage, BulkBar now display exact server error messages. Added admin_error_handling.spec.tsx test coverage.
- **2025-08-15**: API compliance P1.1 — Fixed /v1/slots endpoint usage across AdminPage:47, client.ts:70, useSlotsRange.ts:22. Now uses spec-compliant `/v1/slots?start&end` format. Added admin_api_compliance.spec.tsx test coverage.

### Documentation
- **2025-08-15**: Admin audit + synchronization pass — updated Blueprint Delta, FEATURES status, ISSUES, and CHANGELOG. Generated comprehensive ADMIN_STATUS_REPORT.md identifying API compliance gaps, feature flag integration needs, and missing visual indicators.

### Added
- M4 Day view FAB + Slot sheet for mobile-first slot management
- SlotSheet bottom drawer with overview stats, capacity/notes editing, blackout toggle
- FAB dialog in Day view for quick slot creation (time, duration, capacity, notes)
- Complete mobile UX with touch-friendly interactions and proper query invalidation
- M5 Copy & safeguards with comprehensive client-side validation and error handling
- Past date blocking using Africa/Johannesburg timezone across all admin interfaces
- Scoped confirmation dialogs showing specific dates or selection counts
- Verbatim HTTP error display (422/403/409) with server json.error messages
- Date input validation with min attributes preventing past date selection
- M6 Mobile viewport tests & accessibility for 390×844 and 412×915 screen sizes
- Calendar export & sync roadmap (P1–P3) with ICS feeds, API publishing, and two-way sync phases
- C1 Create Slots split into single-day vs range creation with past date UI blocking
- C2 Backend validation for /v1/slots/bulk with 422/400 error codes and comprehensive testing
- C3 Surface backend error messages verbatim in create dialogs, eliminating generic error toasts
- C4 Renamed buttons and dialog titles for clarity: "Create Slots (Day)" button, "Create Slots — Day" and "Bulk Create Slots" dialog titles
- UI-ROUTE-FIX — /admin now renders AdminPage.tsx; legacy header removed
- UI-M1 applied — header simplified with Create ▾ and More ▾ dropdowns; Day Peek added for contextual day interactions
- B21 Feature flag rollout checklist and deployment strategy
- Comprehensive release procedures with staging and production phases
- Risk assessment and monitoring guidelines for feature rollouts

### Changed
- AdminPage Day view now shows slot list with click-to-manage functionality
- Enhanced mobile responsiveness across all admin calendar components
- All destructive actions (blackout, restrictions) now require explicit confirmation
- Form submissions disabled for past dates with clear warning messages
- Day cells enhanced with ARIA labels including slot counts and status information
- Mobile viewport testing implemented for iPhone and Galaxy S20 screen sizes

## [1.2.0] - 2025-08-15

### Added
- B19 Month view virtualization with TanStack Virtual for performance optimization
- Query tuning with staleTime (15s) and gcTime (5min) for improved caching
- Admin calendar view toggle between list and month modes
- B20 CI/CD pipeline with GitHub Actions for automated E2E testing
- PostgreSQL service integration in CI with health checks
- Database migration system with 5 sequential migration files
- Test data seeding script for realistic E2E testing scenarios
- Multi-browser testing support (Chromium, Firefox, WebKit)
- Artifact collection: screenshots, videos, test reports with retention policies

### Changed
- Complete API migration from `/api/` to `/v1/` prefix for version consistency
- Frontend query keys updated across all components for new API endpoints
- Enhanced admin dashboard with improved navigation and view controls
- Optimized calendar rendering for large date ranges without performance degradation

### Fixed
- LSP diagnostics resolution for import path consistency
- Test suite stabilization with 11/11 performance tests passing
- Calendar virtualization ensuring no phantom slots rendered

## [1.1.0] - 2025-08-14

### Added
- B17 Comprehensive audit trail system with domain events and outbox pattern
- Event emission for all admin actions: SLOTS_BULK_CREATED, SLOT_UPDATED, TEMPLATE_APPLIED, BOOKING_UPDATED
- B18 Grower view alignment with proper restriction indicators and availability explanations
- Audit logging tables with full compliance tracking for administrative actions
- Domain events infrastructure for future event-driven architecture

### Changed
- Database schema extended with audit_log, domain_events, and outbox_events tables
- Admin mutation endpoints enhanced with audit event emission
- Grower interface updated to show truthful availability with restriction context

### Testing
- 16/16 audit event tests passing for comprehensive coverage
- 21 grower view test cases covering restriction scenarios and accessibility

## [1.0.0] - 2025-08-13

### Added
- Core MVP slot booking system with multi-tenant architecture
- JWT-based authentication with role-based access control (Admin/Grower)
- Transactional booking system with SELECT FOR UPDATE concurrency protection
- Admin slot management: bulk creation, blackout operations, capacity controls
- Grower self-service booking with availability viewing and booking management
- PostgreSQL database with extensibility architecture
- FastAPI backend with versioned API endpoints
- React TypeScript frontend with Tailwind CSS and shadcn/ui components
- Comprehensive E2E test coverage with Playwright

### Features
- **Multi-tenant slot booking**: Isolated tenant data with proper access controls
- **Capacity management**: Real-time capacity tracking with atomic booking operations
- **Calendar interface**: Day/Week timeline views with virtualized scrolling
- **Restriction system**: Grower and cultivar-based slot restrictions
- **Audit trail**: Complete logging of administrative actions for compliance
- **CSV export**: Booking data export with filtering capabilities
- **Mobile-first PWA**: Responsive design optimized for field use

### Technical Highlights
- Express.js backend with Drizzle ORM for database operations
- TanStack Query for optimized server state management
- Wouter for lightweight client-side routing
- Extensible database schema supporting future logistics expansion
- Domain events and outbox pattern for reliable event delivery
- Comprehensive testing with unit, integration, and E2E coverage

## Feature Flag Status

### Production Ready (Default: true)
- `VITE_FEATURE_ADMIN_CALENDAR` - Core admin calendar functionality
- `VITE_FEATURE_CSV_EXPORT` - Booking data export capabilities  
- `VITE_FEATURE_AUDIT_TRAIL` - Administrative action logging

### Staged Rollout (Default: false)
- `VITE_FEATURE_ADMIN_TEMPLATES` - Template system for reusable slot patterns
- `VITE_FEATURE_NEXT_AVAILABLE` - Advanced slot search and discovery

### Deprecated/Removed
- None currently

## Migration Notes

### Database Schema
- All migrations are additive-only to ensure rollback safety
- Schema supports both current MVP and future extensibility features
- Audit trail maintains complete compliance history

### API Versioning
- All endpoints use `/v1/` prefix for consistent versioning
- Legacy `/api/` routes have been migrated to new format
- Backward compatibility maintained during transition period

### Feature Flag Management
- Environment-based configuration for staged rollouts
- Immediate rollback capability through flag toggles
- Monitoring and alerting for feature-specific metrics