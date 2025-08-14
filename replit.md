# Grower Slot SaaS

## Overview

A multi-tenant delivery slot booking platform designed for packhouses (initially targeting macadamia farms) to coordinate inbound deliveries from growers. The system enables growers to view availability and book delivery slots with specific quantities, while providing packhouse administrators with tools to manage slot capacity, set restrictions, and handle blackout periods. The application is built as a mobile-first Progressive Web App (PWA) to ensure accessibility for growers in the field.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **August 14, 2025**: DayTimeline Initial Load & Interaction Refinements Complete
  - **Initial Selection**: Page load now selects and opens today (tenant timezone) by default
  - **URL Behavior**: Only updates URL if no ?date= parameter was provided on initial load
  - **Explicit Day Opening**: Scrolling now only highlights days; clicking/tapping explicitly opens Day Detail below
  - **Focused vs Selected States**: Split visual highlighting (focused) from data selection (selected) for precise interaction control
  - **Enhanced Navigation**: Today and Jump-to-date buttons both open selected day and center timeline smoothly
  - **Date Mapping Fix**: Implemented precise day-level calculations with stable EPOCH for consistent date↔index mapping
  - **Centering Logic**: Added robust centerOnDate() method via forwardRef for programmatic timeline positioning
  - **Visual Distinction**: Focused pills show subtle highlight; selected pills show stronger accent with thicker rings
  - **Keyboard Support**: Arrow keys navigate through focused pills with explicit selection on Enter/Space

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