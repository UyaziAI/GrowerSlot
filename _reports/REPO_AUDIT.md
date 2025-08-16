# Repository Audit Report
**Generated**: August 16, 2025  
**Audit Scope**: Grower Slot SaaS - Multi-tenant delivery slot booking platform  
**Total Codebase**: 235 TypeScript/JavaScript files (excluding node_modules)

## Executive Summary

### Architecture Overview
This is a sophisticated multi-tenant PWA built with modern web technologies:

- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Wouter routing
- **Backend**: Express.js + Node.js, Drizzle ORM, PostgreSQL
- **UI Framework**: Tailwind CSS + shadcn/ui component library  
- **Authentication**: JWT-based with role-based access control (Admin/Grower)
- **Build System**: Vite with HMR, TypeScript compilation, Playwright testing

### Critical Entry Points

#### Frontend Entry Points
1. **`app/frontend/src/App.tsx`** - Main application entry with routing logic
2. **`app/frontend/src/pages/AdminPage.tsx`** - Admin dashboard (calendar management)
3. **`app/frontend/src/pages/grower-dashboard.tsx`** - Grower booking interface
4. **`app/frontend/src/pages/login.tsx`** - Authentication gateway

#### Backend Entry Points  
1. **`server/index.ts`** - Express server initialization
2. **`server/routes.ts`** - API route definitions (/v1/* endpoints)
3. **`server/storage.ts`** - Database abstraction layer
4. **`shared/schema.ts`** - Database schema definitions (Drizzle ORM)

### Authentication & Authorization Flow

**Critical Path**: `app/frontend/src/lib/auth.ts` → `app/frontend/src/lib/http.ts` → `server/routes.ts`

1. **Authentication Service** (`app/frontend/src/lib/auth.ts`)
   - JWT token management via localStorage
   - Role-based access control (admin vs grower)
   - Automatic token refresh and validation

2. **HTTP Client** (`app/frontend/src/lib/http.ts`)  
   - Global authentication enforcement via `fetchJson()`
   - Request ID correlation for logging
   - Centralized error handling

3. **Server Middleware** (`server/routes.ts`)
   - JWT verification middleware
   - Tenant isolation enforcement
   - Role-based endpoint protection

### Booking & Slot Management Flow

**Critical Path**: Calendar UI → API Client → Database Layer

1. **Admin Calendar** (`app/frontend/src/pages/AdminPage.tsx`)
   - Month/Week/Day views with real-time updates
   - Bulk operations (create, blackout, restrictions)
   - Drag-and-drop slot management

2. **Grower Booking** (`app/frontend/src/pages/grower-dashboard.tsx`)
   - Available slot discovery
   - Quantity-based booking requests
   - Real-time availability updates

3. **API Layer** (`app/frontend/src/api/`)
   - `client.ts` - Unified API client with auth headers
   - `endpoints.ts` - Typed endpoint definitions
   - Automatic request/response logging

4. **Database Layer** (`server/storage.ts` + `shared/schema.ts`)
   - Multi-tenant data isolation
   - Atomic booking operations with `SELECT FOR UPDATE`
   - Extensible schema for logistics tracking

## Route Inventory

### Frontend Routes (Wouter)
```typescript
/ → AdminPage (admin) | GrowerDashboard (grower)  
/dashboard → AdminPage (admin) | GrowerDashboard (grower)
/admin → AdminPage (admin-only)
* → NotFound
```

### API Routes (/v1/*)
- **Auth**: `/v1/auth/login`, `/v1/auth/me`
- **Slots**: `/v1/slots`, `/v1/slots/bulk`, `/v1/slots/blackout`
- **Bookings**: `/v1/bookings`, `/v1/bookings/:id`
- **Restrictions**: `/v1/restrictions/apply`
- **Admin**: `/v1/admin/day-overview`, `/v1/admin/templates`

## Database Schema

### Core Entities (Multi-tenant)
- **tenants** - Organization isolation
- **users** - Authentication & roles  
- **growers** - Producer profiles & cultivars
- **slots** - Time-based capacity blocks
- **bookings** - Delivery reservations
- **restrictions** - Access control rules

### Extensibility Entities  
- **parties** - Supplier/transporter network
- **products** - Cultivar variants & specifications
- **consignments** - Shipment tracking
- **checkpoints** - Logistics events
- **domain_events** - Audit trail & webhooks

## Third-Party Services

### Infrastructure
- **Neon Database** - Serverless PostgreSQL hosting
- **Replit** - Development environment & deployment
- **SendGrid** - Transactional email delivery

### Frontend Libraries
- **Radix UI** - Accessible headless components
- **Framer Motion** - Advanced animations
- **date-fns** - Date manipulation utilities
- **Recharts** - Data visualization

## Configuration & Feature Flags

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...
PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

# Authentication  
JWT_SECRET=...

# Email
SENDGRID_API_KEY=...

# Feature Flags (Frontend)
VITE_FEATURE_WEEKVIEW=false
VITE_FEATURE_ADMIN_TEMPLATES=false  
VITE_FEATURE_NEXT_AVAILABLE=false
VITE_DEBUG_OVERLAY=false
```

### Build Configuration
- **Vite** (`vite.config.ts`) - Dev server, HMR, alias resolution
- **Tailwind** (`tailwind.config.ts`) - CSS framework with custom themes
- **Drizzle** (`drizzle.config.ts`) - Database migrations & introspection
- **Playwright** (`playwright.config.ts`) - E2E testing configuration

## Mobile & Responsiveness

### Progressive Web App Features
- **Viewport Meta** - Mobile-first responsive design
- **Touch Optimized** - 44px minimum touch targets
- **Offline Ready** - Service worker capabilities (partially implemented)

### Mobile-Specific Components
- **Day Timeline** (`app/frontend/src/features/booking/components/DayTimeline.tsx`)
  - Horizontal scrolling with virtualization
  - Touch-friendly slot selection
  - Responsive pill design

- **Floating Action Button** - Mobile slot creation
- **Responsive Modals** - Full-screen on mobile
- **Gesture Support** - Swipe navigation

## Risk Areas & Technical Debt

### High Risk (Tight Coupling)
1. **Authentication Scattering** - Multiple auth clients (lib/api.ts, api/client.ts)
2. **State Management** - Mixed localStorage + React state + TanStack Query
3. **Route Protection** - Logic duplicated across components
4. **Error Handling** - Inconsistent patterns across API calls

### Medium Risk (Performance)
1. **Bundle Size** - Large dependency footprint (React Query, Framer Motion, shadcn/ui)
2. **Database Queries** - N+1 potential in slot/booking joins
3. **Real-time Updates** - Polling-based (30s intervals) vs WebSocket
4. **Asset Loading** - No code splitting or lazy loading

### Low Risk (Technical Debt)
1. **TypeScript Coverage** - Some `any` types in API responses
2. **Test Coverage** - Limited unit tests, focus on E2E
3. **Documentation** - Code comments sparse in critical paths
4. **Legacy Code** - Quarantined components in `legacy/` directory

## Optimization Candidates

### Keep (Core Infrastructure)
- Authentication service (`lib/auth.ts`) - Well-designed, centralized
- HTTP client (`lib/http.ts`) - Robust error handling & logging
- Database schema (`shared/schema.ts`) - Extensible, well-normalized
- Component library foundation (shadcn/ui) - Consistent, accessible

### Refactor (Modernization Opportunities)
- Route protection - Extract to HOC or middleware
- API client consolidation - Unify lib/api.ts and api/client.ts  
- State management - Consider Zustand for complex state
- Real-time updates - Implement WebSocket for live data

### Remove (Dead Code & Redundancy)
- `legacy/quarantined/` - Deprecated components
- Duplicate API clients - Consolidate authentication paths
- Unused feature flags - Remove disabled experimental features
- Orphaned test files - Remove tests for deleted components

## Greenfield Architecture Recommendation

If building alongside v1, focus on:

### Core Services (Microservice Ready)
```
auth-service/     - JWT + RBAC + tenant isolation
booking-service/  - Slot management + atomic reservations  
logistics-service/ - Consignment tracking + webhooks
notification-service/ - Email + SMS + push notifications
```

### Shared Infrastructure
```
shared/types/     - TypeScript definitions
shared/database/  - Schema migrations + seeders
shared/utils/     - Date, validation, formatting utilities
shared/components/ - Design system components
```

### Modern Frontend Stack
```
Next.js 14       - App router + Server Components
Tailwind CSS     - Utility-first styling
Shadcn/UI        - Component primitives
React Query      - Server state management
React Hook Form  - Form handling + validation
```

## Summary Metrics

| Category | Count | Notes |
|----------|-------|-------|
| Total Files | 235 | TypeScript/JavaScript only |
| Frontend Routes | 4 | Simple Wouter-based routing |
| API Endpoints | 15+ | RESTful /v1/* structure |
| Database Tables | 12 | Multi-tenant with extensibility |
| Feature Flags | 4 | Environment-based configuration |
| Test Files | 25+ | Mix of unit, integration, E2E |
| Configuration Files | 10 | Build, database, testing, linting |

## Keep / Refactor / Remove Analysis

### KEEP (Core Infrastructure) - High Priority

| Component | Location | Reason | Risk if Removed |
|-----------|----------|--------|-----------------|
| Authentication Service | `app/frontend/src/lib/auth.ts` | Well-designed, centralized auth logic | Complete security breakdown |
| HTTP Client | `app/frontend/src/lib/http.ts` | Robust error handling, request correlation | All API communication fails |
| Database Schema | `shared/schema.ts` | Extensible, well-normalized design | Data layer collapse |
| Admin Calendar Core | `app/frontend/src/pages/AdminPage.tsx` | Critical business functionality | Admin workflow unusable |
| Express Router | `server/routes.ts` | All API endpoints, authentication middleware | Backend API non-functional |

### REFACTOR (Modernization Opportunities) - Medium Priority

| Component | Location | Current Issue | Proposed Solution | Effort |
|-----------|----------|---------------|-------------------|---------|
| API Client Duplication | `lib/api.ts` + `api/client.ts` | Two auth implementations | Consolidate to single client | Medium |
| Route Protection Logic | Multiple components | Scattered auth checks | Extract to HOC/middleware | Medium |
| Admin State Management | `AdminPage.tsx` | Monolithic component | Extract state hooks | High |
| Error Handling Patterns | Multiple files | Inconsistent approaches | Standardize error boundaries | Medium |
| Real-time Updates | Polling-based | Performance impact | Implement WebSocket | High |

### REMOVE (Dead Code & Redundancy) - Immediate Action

| Target | Location | Size | Removal Impact | Verification Required |
|--------|----------|------|----------------|----------------------|
| Legacy Components | `legacy/quarantined/` | 12KB | None - explicitly deprecated | None |
| Next Available Dialog | `NextAvailableDialog.tsx` | 2.1KB | Remove disabled feature | Check imports |
| Admin Templates (Flag) | `VITE_FEATURE_ADMIN_TEMPLATES` | UI sections | Simplify admin interface | Admin regression test |
| Duplicate Auth Logic | `AdminPage.tsx:checkAuth()` | Code cleanup | Use centralized service | Auth flow testing |
| Orphaned Test Files | `admin_route_wire.spec.tsx` | Test cleanup | Remove obsolete tests | None |
| Unused Exports | `useSlotsRange.ts` helpers | Bundle size | Tree shaking improvement | Build verification |
| Development Assets | `attached_assets/` | 2MB | Repository cleanup | Archive externally |

### PROTECT (Critical Dependencies) - Required Tests

| Component | Test Coverage Gap | Required Protection | Impact if Broken |
|-----------|-------------------|-------------------|------------------|
| JWT Authentication | Missing unit tests | Auth service test suite | Security vulnerability |
| Booking Operations | Missing edge cases | Atomic transaction tests | Data corruption |
| Tenant Isolation | Partial coverage | Multi-tenant boundary tests | Data leakage |
| Calendar State | E2E only | Unit test state management | Admin workflow failure |
| Database Migrations | Manual testing | Automated migration tests | Schema corruption |

**Next Actions**: Reference companion JSON files for detailed dependency analysis, unused code detection, and removal impact assessment.