# Grower Slot SaaS

## Overview
Grower Slot SaaS is a multi-tenant delivery slot booking platform for agricultural packhouses, specifically macadamia farms, to manage inbound deliveries from growers. It allows growers to book delivery slots with specified quantities, while packhouse administrators can manage capacity, set restrictions, and define blackout periods. The application is designed as a mobile-first Progressive Web App (PWA) to ensure accessibility for growers in the field. The business vision is to streamline the logistics of produce delivery, reducing administrative overhead and improving coordination between growers and packhouses.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite for development.
- **State Management**: TanStack Query for server state.
- **UI Framework**: Tailwind CSS with shadcn/ui component library.
- **Routing**: Wouter for client-side routing.
- **Authentication**: JWT-based with localStorage persistence.

### Backend Architecture
- **Primary**: FastAPI (Python) with asyncpg for PostgreSQL.
- **API Design**: RESTful API with versioned endpoints (`/v1/`) and JWT middleware.
- **Database Interaction**: Raw SQL with `asyncpg` for performance and transactional safety.
- **Validation**: Pydantic schemas for request/response validation.
- **Concurrency**: `SELECT FOR UPDATE` for atomic booking operations.
- **Events**: Domain events and outbox pattern for reliable webhook delivery.

### Database Design
- **Database**: PostgreSQL with an extensible architecture.
- **Core Entities**: Tenants, Growers (with roles), Cultivars, Slots (with capacity/blackout), Bookings (with atomic checks), Slot Restrictions.
- **Extensibility Entities**: Parties, Products and variants, Consignments (linked to bookings), Checkpoints (tracking events), Domain Events, Outbox, Rules (JSON-based workflow).
- **Multi-tenancy**: Single database with tenant isolation via foreign keys; all data operations are scoped to the authenticated user's tenant.

### Authentication & Authorization
- **Strategy**: JWT tokens with role-based access control.
- **Roles**: Admin users (packhouse staff) and Grower users.
- **Security**: Password hashing with bcrypt, token-based session management.

### Development Environment
- **Build System**: Vite with hot module replacement.
- **Type Safety**: Full TypeScript coverage.
- **Code Quality**: Consistent linting and formatting.

### UI/UX Decisions
- Mobile-first Progressive Web App (PWA) for field accessibility.
- Calendar-style booking interface (Playtomic-inspired Day/Week views).
- Responsive layouts for week overview (desktop, tablet, mobile).
- Color-coded availability badges for slots (Green, Amber, Red, Grey).
- Sticky month header and clean pill design for navigation.
- Continuous day timeline with virtualized horizontal scrolling for performance.

### Feature Specifications
- **Slot Management**: Admins can manage slot capacity, set restrictions, and define blackout periods.
- **Booking Management**: Growers can view availability and book delivery slots with quantities.
- **Admin Calendar**: Comprehensive CRUD interface for slots and bookings (Month/Week/Day views).
- **Role-Based Access Control (RBAC)**: Differentiates between admin and grower functionalities.
- **Logistics Tracking**: Support for consignments and checkpoints for delivery tracking.

## External Dependencies

### Database & Hosting
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit**: Development and potential production hosting.

### UI & Component Libraries
- **Radix UI**: Accessible headless UI components.
- **shadcn/ui**: Component library built on Radix UI and Tailwind CSS.
- **Lucide React**: Icon library.

### Email Services
- **SendGrid**: Email delivery for notifications and authentication.

### Development Tools
- **Drizzle Kit**: Database migration and schema management.