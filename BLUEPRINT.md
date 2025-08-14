# Grower Slot SaaS - Unified App Blueprint

## 1. Overview
A sophisticated multi-tenant delivery slot booking platform designed for packhouses to coordinate inbound deliveries from growers. Built as a mobile-first PWA with advanced calendar interfaces and logistics tracking capabilities.

## 2. Architecture

### Frontend
- React + TypeScript with Vite build system
- TanStack Query for server state management
- Tailwind CSS with shadcn/ui components
- Wouter for client-side routing
- JWT authentication with role-based access

### Backend
- FastAPI (Python) primary backend
- Node.js/Express legacy support
- PostgreSQL with asyncpg for performance
- JWT middleware and role-based authorization
- Domain events and outbox pattern

### Database Schema
- Multi-tenant architecture with foreign key isolation
- Core entities: tenants, growers, cultivars, slots, bookings
- Extensibility: parties, products, consignments, checkpoints, domain_events

## 3. UI Components Structure

### Calendar Interface
- **DayTimeline**: Virtualized horizontal scrollable timeline with 72px touch-friendly pills
- **DayPill**: Interactive date pills with availability indicators and selection states
- **CalendarGrid**: Time-axis layout with capacity visualization
- **WeekOverview**: 7-day card layout with responsive breakpoints

### Component Hierarchy
```
CalendarPage
├── DayTimeline (horizontal scroll)
│   └── DayPill[] (virtualized items)
├── DayView (detailed slot grid)
└── MiniMonthPopover (date picker)
```

## 4. API Endpoints

### Slot Management
- `GET /api/slots/range` - Fetch slots for date range (14-day limit)
- `POST /api/bookings` - Create new booking with capacity validation
- `PUT /api/slots/{id}` - Update slot configuration
- `DELETE /api/bookings/{id}` - Cancel booking

### Authentication
- `POST /api/auth/login` - JWT authentication
- `GET /api/auth/profile` - User profile with tenant context

## 5. Feature Status

### Implemented
- ✅ Multi-tenant slot booking system
- ✅ Calendar-style interface with day/week views
- ✅ Virtualized timeline with snap-to-center behavior
- ✅ Touch-friendly mobile interface
- ✅ Real-time capacity tracking
- ✅ Role-based access control

### In Progress
- 🔄 DayPill layout sizing optimization (no transform scaling)
- 🔄 Vertical overflow container fixes

## 6. Changelog

### 2025-08-14 - DayPill Layout Refinements ✅ COMPLETED
- **Problem**: Selected pills being clipped due to transform scaling and insufficient container padding
- **Solution**: Converted to layout-based sizing without transform overflow
- **Implementation**:
  - ✅ Removed transform: scale() animations from DayPill selected state
  - ✅ Implemented layout-based sizing: selected pills use larger padding (p-5 vs p-4), thicker borders (border-4 vs border-2), and larger fonts (text-2xl vs text-xl)
  - ✅ Updated all containers to use overflow-y-visible consistently
  - ✅ Set symmetric vertical padding (20px top/bottom) with flex items-center centering
  - ✅ Optimized container heights: CardContent 140px, DayTimeline 120px, virtualizer items 80px
- **Result**: Selected pills now display fully without clipping, maintaining clean uniform layout across browsers

### 2025-08-14 - Timeline Interaction Model
- Enhanced initial load behavior with today selection
- Split focused vs selected states for precise control
- Added centerOnDate() method for programmatic positioning
- Improved keyboard navigation and accessibility

### 2025-08-13 - Calendar Interface Implementation
- Replaced vertical slot lists with interactive calendar grid
- Added GET /api/slots/range endpoint with date validation
- Implemented day/week view toggle with feature flags
- Added comprehensive tooltips and status indicators