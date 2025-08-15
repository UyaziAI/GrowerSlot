# Grower Slot SaaS

## Overview

A multi-tenant delivery slot booking platform designed for packhouses (initially targeting macadamia farms) to coordinate inbound deliveries from growers. The system enables growers to view availability and book delivery slots with specific quantities, while providing packhouse administrators with tools to manage slot capacity, set restrictions, and handle blackout periods. The application is built as a mobile-first Progressive Web App (PWA) to ensure accessibility for growers in the field.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **August 15, 2025**: Templates Backend Schemas Complete - Pydantic Models Added
  - **Schemas**: Added TemplateIn, TemplateOut, ApplyTemplateRequest, ApplyTemplateResult to schemas.py
  - **Validation**: Pydantic models for request/response validation with proper typing
  - **Import Success**: All template schemas import successfully, no mypy/TS conflicts
  - **API Ready**: Backend schemas prepared for template CRUD and apply-template endpoints

- **August 15, 2025**: Templates Migration Scaffold Added - Database Schema Preparation Complete
  - **Migration**: Created 104_templates.sql with tenant-scoped templates table structure
  - **Schema**: Added templates table with JSONB config, date ranges, tenant isolation, proper indexing
  - **Runner**: Updated run_migrations.sh to include new 104_templates.sql in migration order
  - **Compliance**: Deterministic migration, no existing table alterations, follows Admin Addendum specs
  - **Ready**: Database schema prepared for Templates feature implementation

- **August 15, 2025**: Documentation Consistency Pass Complete - Admin Addendum Integration Finalized
  - **Consistency Updates**: Made docs truthful and consistent after Admin Addendum adoption
  - **Blueprint.md**: Moved implementation details to Delta section, updated changelog to reflect docs-only status
  - **API Endpoints**: Updated remaining /api/ references to /v1/ per Section 6 compliance
  - **File Paths**: Corrected all paths from Node structure (/server, /client) to FastAPI/React (/app/backend, /app/frontend)
  - **FEATURES.md**: Updated file locations, kept Week view in In-Progress per task requirements
  - **ISSUES.md**: Added comprehensive feature-flagged Admin implementation issue with acceptance criteria
  - **Truthful Documentation**: All docs now accurately reflect current state vs. planned features
  - **Implementation Ready**: Clear separation between completed work and planned feature-flagged rollout

- **August 14, 2025**: Admin Calendar System Implementation Complete - Comprehensive CRUD Interface
  - **Full Calendar Views**: Implemented Month/Week/Day admin calendar views for complete slot and booking management
  - **RBAC Integration**: Added /admin/calendar route with admin-only access guard integrated into navigation
  - **Data Integrity**: All views render only backend-provided data - fixed phantom slot regression from grower timeline
  - **CRUD Interface**: Comprehensive slot editing, booking creation, blackout management, and restrictions
  - **Components**: AdminCalendarPage, AdminMonthView, AdminWeekView, AdminDayView with BulkCreateSlotsDialog
  - **Performance**: Loading skeletons instead of stale data, strict query keys with tenantId + date range
  - **Empty States**: Proper "No slots defined by admin" messages when backend returns empty arrays
  - **Timezone Support**: Full Africa/Johannesburg timezone handling across all calendar views
  - **Accessibility**: Complete keyboard navigation, ARIA labels, screen reader support
  - **Testing Ready**: Structure prepared for comprehensive admin calendar testing and phantom slot regression tests

- **August 14, 2025**: Sticky Month Header Implementation with Clean Pill Design Complete
  - **Sticky Navigation**: Implemented 32px sticky month header with dynamic updates (e.g., "AUGUST 2025") during scroll
  - **Clean Pills**: Removed all info icons from pills - now display only day/date/availability with existing color coding
  - **Optimized Dimensions**: All day pills use exact w-[84px] h-[84px] flex-shrink-0 sizing to accommodate longer labels
  - **Content Accommodation**: Expanded badge sizes (max-w-[56px]) to properly display labels like "155.5" without truncation
  - **Selection Highlight**: Selected pills distinguished by visual highlight only (border-blue-500, bg-blue-50, ring-2) without size changes
  - **No Transform Scaling**: Removed all whileHover, whileTap, and animate scale transforms to prevent vertical clipping
  - **Today Indicator**: Today marker maintained as subtle dot overlay without affecting pill dimensions
  - **Enhanced Centering**: Improved centerOnDate() with scrollIntoView({ inline: 'center' }) for precise centering
  - **Accessibility**: Screen reader support for month changes (aria-live="polite"), focus management for pills
  - **Snug Layout**: Reduced rail padding to 8px for snug fit while accommodating sticky header
  - **Final Design**: Total height 146px (ITEM_TRACK 98px + RAIL_PAD 16px + MONTH_HEADER 32px)
  - **Professional Navigation**: Clean timeline with contextual month header for improved user orientation

- **August 14, 2025**: Continuous Day Timeline Implementation Complete - Blueprint Specification Fulfilled
  - **DayTimeline Component**: Replaced WeekScroller with virtualized horizontal scrollable timeline using @tanstack/react-virtual
  - **Large Touch Pills**: 72px touch-friendly DayPill components with chip styling and snap-to-center behavior
  - **Simplified Navigation**: Removed Prev/Next week buttons, kept only Today and "Jump to date" mini-month popover
  - **Performance**: 360-day virtualization window with efficient rendering and smooth scroll behavior
  - **API Compliance**: Adapted to 14-day API range limits with windowed data fetching (±7 days from selected)
  - **Mobile-First**: Inertial scroll with scroll-snap-type: x mandatory and overscroll-behavior-x: contain
  - **Accessibility**: Full keyboard navigation (←/→ arrows), ARIA labels, and focus management
  - **URL State**: Maintains ?date=YYYY-MM-DD parameter for deep linking and navigation
  - **Animation**: Enhanced Day Detail transitions with framer-motion when date selection changes

- **August 14, 2025**: Week Overview UX Implementation Complete - Enhanced Blueprint Compliance
  - **Week Overview Active**: Replaced hourly time grid with 7 day cards per Blueprint Section 7 UX plan
  - **Components**: WeekOverviewGrid and DayCard with responsive layouts (7-col desktop, 3-4 col tablet, 2-col mobile)
  - **Navigation**: Click-to-navigate from week day cards to detailed Day view with proper date/mode switching
  - **Design**: Color-coded availability badges (Green ≥50%, Amber 20-49%, Red <20%, Grey no capacity/blackout)
  - **Integration**: Updated calendar-page, admin-dashboard, admin-slots with onDateSelect navigation
  - **API Support**: GET /api/slots/range endpoint handles multi-day fetching with 14-day limits
  - **Accessibility**: Proper ARIA labels, keyboard navigation, and tooltip support for day cards
  - **Quality**: Maintained backward compatibility, comprehensive testing, responsive design verified
  - **Minor Gaps**: API versioning (/api/ vs /v1/) and missing CSV export noted for future resolution

- **August 13, 2025**: Calendar Implementation Complete - Legacy UI Removed
  - **Calendar-Style Booking**: Implemented Playtomic-inspired Day/Week calendar layout
    - Replaced ALL vertical slot lists with interactive CalendarGrid component  
    - Added GET /api/slots/range endpoint with date validation and 14-day limits
    - Created time-axis layout with capacity bars, status indicators, and tooltips
    - Added Day/Week view toggle with VITE_FEATURE_WEEKVIEW feature flag
    - Integrated summary stats, navigation controls, and responsive design
    - **FIXED**: Runtime error from number formatting with safe toNum() helper
    - **MIGRATION**: Both Admin and Grower now use calendar as primary interface
  - **Backend Architecture**: Complete FastAPI backend structure at /app/backend
    - Added extensibility database tables: parties, products, consignments, checkpoints, domain_events, outbox
    - Implemented transactional booking with SELECT FOR UPDATE for atomic capacity checking
    - Added domain event emission and outbox pattern for webhook integrations
    - Created logistics tracking API endpoints for consignments and checkpoints
    - Set up proper migrations structure in /app/infra with automated runner script
  - **Frontend Integration**: Maintained backward compatibility while adding new features
    - Feature-flagged logistics UI components (InboundPage)
    - Restructured frontend API client to support blueprint endpoint contracts
    - Added comprehensive README.md and .env.example following blueprint specifications

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for fast development and building
- **State Management**: TanStack Query for server state management with minimal local state
- **UI Framework**: Tailwind CSS with shadcn/ui component library for consistent design
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: JWT-based authentication with localStorage persistence

### Backend Architecture
- **Primary**: FastAPI (Python) with asyncpg for PostgreSQL (Blueprint Implementation)
- **Legacy**: Node.js with Express.js framework (Original MVP)
- **API Design**: RESTful API with versioned endpoints (/v1/) and JWT middleware
- **Database**: Raw SQL with asyncpg for optimal performance and transactional safety
- **Validation**: Pydantic schemas for request/response validation
- **Concurrency**: SELECT FOR UPDATE for atomic booking operations
- **Events**: Domain events and outbox pattern for reliable webhook delivery

### Database Design
- **Database**: PostgreSQL with comprehensive extensibility architecture
- **Core Entities** (MVP):
  - Tenants (packhouses)
  - Growers with role-based access (grower/admin)
  - Cultivars for crop type management
  - Slots with capacity tracking and blackout functionality
  - Bookings with atomic transactional capacity checks
  - Slot restrictions for grower/cultivar-specific rules
- **Extensibility Entities** (Blueprint):
  - Parties (generic stakeholders: growers, transporters, buyers, warehouses)
  - Products and variants (future cultivar mapping)
  - Consignments (logistics tracking linked to bookings)
  - Checkpoints (tracking events: gate_in, weigh, quality_check, delivered)
  - Domain Events (audit trail and webhook source)
  - Outbox (reliable webhook delivery pattern)
  - Rules (JSON-based workflow configurations)

### Authentication & Authorization
- **Strategy**: JWT tokens with role-based access control
- **Roles**: Admin users (packhouse staff) and Grower users
- **Security**: Password hashing with bcrypt, token-based session management

### Development Environment
- **Build System**: Vite with hot module replacement for development
- **Type Safety**: Full TypeScript coverage across frontend, backend, and shared schemas
- **Code Quality**: Consistent linting and formatting with shared configurations

### Multi-tenancy
- **Design**: Single database with tenant isolation through foreign keys
- **Scope**: All data operations are scoped to the authenticated user's tenant
- **Scalability**: Prepared for horizontal scaling with tenant-based data partitioning

## External Dependencies

### Database & Hosting
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit**: Development and potential production hosting environment

### UI & Component Libraries
- **Radix UI**: Accessible headless UI components for complex interactions
- **shadcn/ui**: Pre-built component library based on Radix UI and Tailwind CSS
- **Lucide React**: Icon library for consistent iconography

### Email Services
- **SendGrid**: Email delivery service for notifications and authentication

### Development Tools
- **Drizzle Kit**: Database migration and schema management tools
- **Vite Plugins**: Runtime error handling and development environment enhancements