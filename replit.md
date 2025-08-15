# Grower Slot SaaS Platform

## Overview

A multi-tenant agricultural delivery slot booking platform designed for packhouses to manage inbound grower deliveries. The system provides a mobile-first web application that eliminates manual coordination chaos by offering structured time slot booking with capacity controls, real-time availability, and comprehensive admin management tools.

The platform serves two primary user types: packhouse administrators who create and manage delivery slots, and growers who book available time slots for their deliveries. Built with extensibility in mind, the architecture supports future expansion into logistics tracking, quality management, and compliance workflows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React + TypeScript SPA** with mobile-first PWA design using Vite as the build tool
- **UI Components** built on shadcn/ui with Radix UI primitives for accessibility
- **State Management** via TanStack Query for server state and React hooks for local state
- **Routing** handled by Wouter for lightweight client-side navigation
- **Styling** using Tailwind CSS with CSS custom properties for theming
- **Authentication** JWT-based with role-based access control (Admin/Grower)

### Backend Architecture
- **Node.js/Express** primary backend with TypeScript
- **FastAPI Python** secondary backend for advanced features (templates, exports, logistics)
- **RESTful API** design with structured JSON responses
- **Domain Events + Outbox Pattern** for reliable event delivery and audit trails
- **Transactional Safety** using database-level locking for capacity management
- **Multi-tenant** architecture with tenant isolation at the database level

### Database Design
- **PostgreSQL** as primary database with Drizzle ORM for type-safe queries
- **Core Tables**: tenants, users, growers, cultivars, slots, bookings, slot_restrictions
- **Extensibility Tables**: parties, products, consignments, checkpoints for future logistics
- **Event Sourcing**: domain_events, outbox, audit_log tables for comprehensive tracking
- **Indexing Strategy** optimized for tenant_id + date queries on time-sensitive data

### Authentication & Authorization
- **JWT Tokens** with 24-hour expiration and automatic refresh
- **Role-Based Access Control** with admin and grower permissions
- **Tenant Scoping** ensures data isolation between packhouses
- **Password Security** using bcrypt hashing with salt rounds

### Data Flow Patterns
- **Slot Management**: Admin creates slots → Growers view availability → Transactional booking with capacity checks
- **Event Driven**: Domain events capture all admin actions for audit trails and webhook delivery
- **Optimistic UI**: Frontend shows immediate feedback while backend processes requests
- **Error Handling**: Structured logging with request correlation IDs for debugging

### Mobile-First Design
- **Responsive Breakpoints** with mobile (390px), tablet (768px), and desktop (1024px+) optimizations
- **Touch-Friendly Interactions** with 44px minimum touch targets
- **Progressive Enhancement** supporting offline capability and app-like experience
- **Performance Optimized** with code splitting and lazy loading for mobile networks

## External Dependencies

### Core Infrastructure
- **Supabase/Neon Database** - PostgreSQL hosting with connection pooling
- **Vercel/Replit** - Application hosting and deployment platform
- **SendGrid** - Email service for notifications and confirmations

### Frontend Libraries
- **React 18** with concurrent features and suspense
- **TanStack Query v5** for server state management and caching
- **shadcn/ui + Radix UI** for accessible component primitives
- **Tailwind CSS** for utility-first styling
- **date-fns** with timezone support for date/time handling
- **React Hook Form + Zod** for form validation

### Backend Dependencies
- **Express.js** with TypeScript for Node.js runtime
- **FastAPI** with Pydantic for Python microservices
- **Drizzle ORM** for type-safe database operations
- **bcrypt** for password hashing
- **jsonwebtoken** for JWT token generation and validation

### Development & Testing
- **Vite** for fast development server and building
- **Vitest** for unit and integration testing
- **Playwright** for end-to-end testing across browsers
- **TypeScript** for static type checking across the entire stack

### Feature Flags & Configuration
- **Environment Variables** for feature toggling (VITE_FEATURE_* prefix)
- **Runtime Configuration** for tenant-specific settings and customization
- **Debug Tools** including structured logging and debug overlay for development