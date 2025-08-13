# Grower Slot SaaS

## Overview

A multi-tenant delivery slot booking platform designed for packhouses (initially targeting macadamia farms) to coordinate inbound deliveries from growers. The system enables growers to view availability and book delivery slots with specific quantities, while providing packhouse administrators with tools to manage slot capacity, set restrictions, and handle blackout periods. The application is built as a mobile-first Progressive Web App (PWA) to ensure accessibility for growers in the field.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite for fast development and building
- **State Management**: TanStack Query for server state management with minimal local state
- **UI Framework**: Tailwind CSS with shadcn/ui component library for consistent design
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: JWT-based authentication with localStorage persistence

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful API with JWT middleware for authentication
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas for runtime type validation

### Database Design
- **Database**: PostgreSQL with Neon serverless hosting
- **Schema**: Multi-tenant architecture with the following core entities:
  - Tenants (packhouses)
  - Growers with role-based access (grower/admin)
  - Cultivars for crop type management
  - Slots with capacity tracking and blackout functionality
  - Bookings with transactional capacity checks
  - Slot restrictions for grower/cultivar-specific rules

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