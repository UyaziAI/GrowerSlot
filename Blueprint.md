Unified App Blueprint – Grower & Agri Supply Chain (Replit)

Single, consolidated blueprint that merges the original slot‑booking MVP with the extensible addendum. Designed for Replit, Supabase (Postgres + Auth), and FastAPI (or Node as an alt). This file is the source of truth for how the app should work and evolve.

**See also**: [Admin_Addendum.md](./Admin_Addendum.md)

## 1) Product Overview

### 1.1 Problem

Packhouses must coordinate inbound deliveries from many growers without congestion or manual chaos (calls, WhatsApp, spreadsheets). They also need the option to expand into logistics, quality, compliance, and integrations.

### 1.2 Users & Roles

Admin / Grower Liaison (packhouse) – Creates/edits slots, sets rules, blackouts, overrides; monitors schedule and inbound loads.

Grower (external) – Views availability, books a time slot with quantity (resource unit), manages own bookings.

Ops (read‑only) – Views upcoming schedule, exports data.

Future roles – Transporter, Buyer, Warehouse via generic Party model.

### 1.3 MVP Scope (must‑have)

Mobile‑first web app (PWA‑friendly) with Day/Week availability.

Continuous day timeline with dynamic range expansion (±30 days optimized, ±2 years max).

Transactional booking with capacity controls and restrictions (by grower/cultivar/variant).

Admin: bulk slot generation, blackouts, notes, per‑slot restrictions.

Notifications v1: email confirmations; SMS/WhatsApp later.

Multi‑tenant and RBAC foundation.

### 1.4 Near‑term Extensions (nice‑to‑have)

Consignments & Checkpoints (turn bookings into tracked loads; gate/weigh/QC events).

Quality Inspections, Compliance docs (GLOBALG.A.P, organic, phytosanitary).

Events & Outbox for audit + integrations (ERP/WMS/weighbridge/ANPR). ✅ IMPLEMENTED (B17)

Rules & Workflows (quotas, state machines) as JSON configs.

## 2) Architecture

Frontend: React (Vite) + TanStack Query + Tailwind. Feature flags for modules.

Timeline Layout: Horizontal scroll with overflow-y-visible for focus rings/shadows visibility.

Backend: FastAPI (Python) with asyncpg. (Node/Express alt OK; keep REST contracts.)

DB: Supabase Postgres. Migrations in /infra. Optionally enable RLS later.

Auth: Supabase Auth (magic link/OTP). JWT carries tenant_id & roles.

Dev Hosting: Replit (FE+BE). Prod: FE on Vercel, BE on Replit/Render/Fly, DB on Supabase.

Observability: JSON logs, /health, UptimeRobot; Sentry optional.

Diagram:

React (PWA) ⇄ FastAPI (REST) ⇄ Supabase (Postgres + Auth)
                              ↳ Email (Resend/SendGrid)
                              ↳ Webhooks (ERP/WMS)

## 3) Monorepo Layout (Replit)

```
/app
  /frontend
    index.html
    src/
      main.tsx
      App.tsx
      api/client.ts      # axios client w/ auth header
      api/endpoints.ts   # typed API calls
      features/
        booking/
        logistics/
        quality/
        compliance/
        reports/
        core/            # auth, rbac, flags
      styles/
  /backend
    main.py
    db.py
    security.py
    schemas.py
    routers/
      auth.py
      slots.py
      bookings.py
      restrictions.py
      logistics.py       # consignments + checkpoints
      quality.py         # inspections
      compliance.py      # docs + alerts
      reports.py         # analytics, exports
  /infra
    001_init.sql         # MVP tables
    002_seed.sql         # dev data
    101_parties_products.sql
    102_logistics.sql
    103_events_rules.sql
    run_migrations.sh
  /.env.example
  /README.md
```

## 4) Data Model (SQL)

### 4.1 Core (MVP)

```sql
-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text DEFAULT 'Africa/Johannesburg',
  created_at timestamptz DEFAULT now()
);

-- Growers (kept for MVP simplicity; can be replaced by parties view later)
CREATE TABLE IF NOT EXISTS growers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact text,
  UNIQUE(tenant_id, name)
);

-- Cultivars
CREATE TABLE IF NOT EXISTS cultivars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL
);

-- Slots (capacity per window)
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity numeric(10,2) NOT NULL,
  resource_unit text DEFAULT 'tons',
  blackout boolean DEFAULT false,
  notes text,
  created_by uuid,
  CONSTRAINT slots_time_chk CHECK (end_time > start_time)
);

-- Restrictions (optional)
CREATE TABLE IF NOT EXISTS slot_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  allowed_grower_id uuid REFERENCES growers(id),
  allowed_cultivar_id uuid REFERENCES cultivars(id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grower_id uuid NOT NULL REFERENCES growers(id),
  cultivar_id uuid REFERENCES cultivars(id),
  quantity numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'confirmed', -- confirmed/cancelled
  created_at timestamptz DEFAULT now()
);

-- Users for authentication
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  grower_id uuid REFERENCES growers(id),
  tenant_id uuid REFERENCES tenants(id),
  role text NOT NULL DEFAULT 'grower' -- grower, admin, ops
);
```

### 4.2 Extensibility (add‑on tables)

```sql
-- Parties (generic stakeholders)
CREATE TABLE parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,                   -- 'grower','transporter','buyer','warehouse'
  contact jsonb DEFAULT '{}'
);

-- Products and variants (map cultivars later)
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  variant text,
  category text
);

-- Consignments (logistics)
CREATE TABLE consignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consignment_number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES parties(id),
  transporter_id uuid REFERENCES parties(id),
  expected_quantity numeric(10,2),
  actual_quantity numeric(10,2),
  status text DEFAULT 'pending',        -- pending, in_transit, delivered, rejected
  created_at timestamptz DEFAULT now()
);

-- Checkpoints (tracking events)
CREATE TABLE checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id uuid NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  type text NOT NULL,                   -- gate_in, weigh, quality_check, gate_out, delivered
  timestamp timestamptz DEFAULT now(),
  payload jsonb DEFAULT '{}',           -- flexible event data
  created_by uuid REFERENCES users(id)
);

-- Domain events (audit + webhook source)
CREATE TABLE domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,             -- BOOKING_CREATED, CONSIGNMENT_UPDATED, etc.
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  created_at timestamptz DEFAULT now()
);

-- Outbox (reliable webhook delivery)
CREATE TABLE outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES domain_events(id),
  webhook_url text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending',        -- pending, sent, failed
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Audit log (human-readable admin actions)
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  payload_summary jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

Compatibility: you may create a view growers_v from parties where type='grower' later to unify UI without breaking MVP code.

## 5) Booking Concurrency (Required)

SQL pattern:

```sql
BEGIN;
SELECT capacity,
       COALESCE((SELECT SUM(quantity) FROM bookings WHERE slot_id=$1 AND status='confirmed'),0) AS booked
FROM slots
WHERE id=$1
FOR UPDATE; -- lock row

-- if $qty <= (capacity - booked) INSERT booking; else ROLLBACK
COMMIT;
```

Event emission (after commit): insert into domain_events (BOOKING_CREATED) and one outbox row for later webhook delivery.

## 6) API Contracts (v1)

### 6.1 Auth

```
POST /v1/auth/login               -> { token }
GET  /v1/auth/me                  -> { user, roles, tenant_id }
```

### 6.2 Slots

```
GET   /v1/slots?date=YYYY-MM-DD
GET   /v1/slots/range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD  # range query (max 14 days)
POST  /v1/slots/bulk                 # create slots for date/time window
PATCH /v1/slots/{id}                 # blackout/capacity/notes
PATCH /v1/slots/{id}/blackout        # set blackout=true with optional note
POST  /v1/slots/blackout             # bulk blackout by day/week scope
POST  /v1/slots/apply-template       # apply template (publish mode)
GET   /v1/slots/{id}/usage           # { capacity, booked, remaining }
```

**Range Endpoint Details:**
- Returns slots for multiple days (max 14-day span)
- Includes same slot data as single-day endpoint plus restrictions
- Validates start_date <= end_date
- Maintains backward compatibility with existing day endpoint

Slot (response)

```json
{
  "id":"uuid","tenant_id":"uuid","date":"2025-08-13",
  "start_time":"08:00:00","end_time":"09:00:00",
  "capacity":20.0,"resource_unit":"tons","blackout":false,
  "notes":"Maintenance at 12:00",
  "restrictions":{"growers":["uuid"],"cultivars":["uuid"]}
}
```

### 6.3 Bookings

```
POST   /v1/bookings
PATCH  /v1/bookings/{id}             # update booking details
DELETE /v1/bookings/{id}
GET    /v1/bookings?date=&grower_id=
```

Create request

```json
{ "slot_id":"uuid", "grower_id":"uuid", "cultivar_id":"uuid", "quantity":5.0 }
```

Errors: 409 (capacity exceeded), 403 (slot restricted), 404 (slot not found).

**Blackout Operations**

```
PATCH /v1/slots/{id}/blackout
```

```json
{ "start_date":"2025-08-20", "end_date":"2025-08-20", "scope":"slot", "note":"Emergency maintenance" }
```

```
POST /v1/slots/blackout
```

```json
{ "start_date":"2025-08-20", "end_date":"2025-08-22", "scope":"day", "note":"Scheduled downtime" }
{ "start_date":"2025-08-18", "end_date":"2025-08-24", "scope":"week", "note":"Holiday period" }
```

Scope options:
- `"slot"` - Single slot blackout (used with PATCH /{id}/blackout)
- `"day"` - All slots for each date in range
- `"week"` - All slots for entire calendar weeks (Monday-Sunday) in range

Both endpoints are idempotent - re-applying same blackout doesn't duplicate effects.

### 6.4 Restrictions

```
POST /v1/restrictions/apply
```

```json
{ "date":"2025-08-13", "slot_id":null, "grower_ids":["uuid"], "cultivar_ids":["uuid"], "note":"A4 only PM" }
```

### 6.5 Logistics (extensible)

```
POST /v1/logistics/consignments                 # create from booking_id
GET  /v1/logistics/consignments?date=YYYY-MM-DD # list + last checkpoint
POST /v1/logistics/consignments/{id}/checkpoints
```

Checkpoint payload

```json
{ "type":"gate_in", "payload":{ "plate":"ABC123" } }
```

### 6.6 Exports (Admin)

```
GET   /v1/exports/bookings.csv?start=YYYY-MM-DD&end=YYYY-MM-DD&grower_id=&cultivar_id=&status=
```

**CSV Export Endpoint:**
- **Authentication**: Admin role required
- **Content-Type**: `text/csv; charset=utf-8`
- **Content-Disposition**: `attachment; filename="bookings_<start>_<end>.csv"`
- **Streaming Response**: Uses FastAPI StreamingResponse for memory efficiency
- **Column Order (exact)**: `booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes`

**Parameters:**
- `start` (required): Start date in YYYY-MM-DD format (inclusive)
- `end` (required): End date in YYYY-MM-DD format (inclusive)
- `grower_id` (optional): Filter by specific grower UUID
- `cultivar_id` (optional): Filter by specific cultivar UUID
- `status` (optional): Filter by booking status (confirmed, pending, cancelled)

**Features:**
- Tenant-scoped data access (only authenticated user's tenant)
- UTF-8 encoding for international characters in names and notes
- Date range validation (start <= end)
- Streaming response for large datasets without pagination
- Proper CSV escaping for special characters and commas in data

**Audit Trail**: The following admin endpoints emit domain events and audit log entries for compliance tracking:
- `POST /v1/slots/bulk` - SLOTS_BULK_CREATED events
- `PATCH /v1/slots/{id}` - SLOT_UPDATED/SLOTS_BLACKED_OUT events  
- `POST /v1/slots/blackout` - SLOTS_BLACKED_OUT events
- `POST /v1/slots/apply-template` - TEMPLATE_APPLIED events (publish mode)
- `PATCH /v1/bookings/{id}` - BOOKING_UPDATED events

## 7) Frontend Plan

Replace wireframe's local state with API calls (TanStack Query cache + invalidation).

Pages:

Dashboard (Day/Week) – availability grid with status dots/badges.

Book – modal flow; quantity + cultivar/variant.

Admin Slots – bulk generation, blackout, restrictions, notes.

Inbound (feature‑flagged) – read‑only consignments list with latest checkpoint.

Continuous DayTimeline – horizontally scrollable day strip with focused/selected state separation. Initial load selects today; explicit clicks open Day Detail; smooth centering on Today/Jump-to-date actions.

**Inspector Panel** – right-hand panel shows selected slot details (capacity, usage, notes, blackout status). Quick actions: blackout toggle calls PATCH /v1/slots/{id}/blackout, restrict button opens restrictions dialog calling POST /v1/restrictions/apply. Cache invalidation after operations ensures UI consistency.

RBAC guards: show Admin tools only if role==='admin'.

Feature flags via import.meta.env.VITE_FEATURE_* (LOGISTICS, WEEKVIEW, QUALITY, etc.).

## 8) Security & Tenancy

All queries filter by tenant_id.

JWT claims: sub, tenant_id, roles[], optional party_id.

Growers only see bookings/consignments where they are the supplier.

Input validation: Pydantic (FastAPI) or Zod (Node).

Rate limiting, CORS allowlist.

Future: enable RLS; map UI growers to parties(type='grower').

## 9) Notifications

Start with email (Resend/SendGrid) on booking create/cancel.

Template variables: tenant, slot time, quantity, unit, notes.

Later: WhatsApp/SMS, push (PWA), webhook to ERP.

## 10) DevOps

Env/Secrets: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.

Migrations:

001_init.sql, 002_seed.sql (core MVP tables & dev data)

101_parties_products.sql, 102_logistics.sql, 103_events_rules.sql (extensibility)

Health: /health returns { status: 'ok' }.

Backups: Supabase PITR if available.

## 11) Testing

Unit: validators, capacity math.

Integration: two concurrent booking requests on same slot → one must fail with 409.

E2E: login → view day → book → cancel → admin blackout → verify UI.

## Section 11 Testing Extensions

### E2E Testing Implementation (B14)
Comprehensive Playwright-based end-to-end testing suite covering critical admin calendar flows:

**Core Scenarios:**
- Bulk Create → slots appear in calendar grid
- Blackout Day → all slots show blackout state  
- Drag-drop booking moves: success path & 409 revert handling
- Apply Template: preview shows delta; publish + re-publish shows idempotency (0/0)
- Next Available (flag ON): returns list + jump focuses calendar
- Restrictions UI: scope selection, multi-select, POST /v1/restrictions/apply

**Additional Coverage:**
- Inspector Panel integration and slot details display
- View mode toggles (Month/Week/Day) and date navigation
- Error handling for network failures and empty states
- Responsive design validation (mobile/tablet viewports)
- Feature flag gating verification

**CI Integration:**
- GitHub Actions workflow (.github/workflows/e2e.yml)
- Cross-browser testing (Chromium, Firefox, WebKit, Mobile)
- Artifact collection for test reports and screenshots
- Environment variable configuration for feature flags

**Location:** `/e2e/admin_core.spec.ts` with Playwright configuration at `/playwright.config.ts`

**Drag-Drop Testing**: Booking chips can be dragged between slots, calling PATCH /v1/bookings/{id} with {slot_id:newSlotId}. On 403/409 errors, toast shows server message and data refetch ensures chip returns to original position (revert effect).

## 12) Rollout

Phase 0 – Core up & running (slots, bookings, admin, email).
Phase 1 – Restrictions, week view, CSV export, quotas.
Phase 2 – Logistics: consignments + checkpoints (read‑only UI), domain events/outbox.
Phase 3 – Quality & compliance; integrations; analytics dashboards.

Acceptance (MVP):

Atomic booking (no overbooking), admin slot tools, grower self‑service, email confirmations, tenant scoping.

## 13) Replit Assistant Prompt (use this exact block)

Goal: Implement this unified blueprint in a Replit monorepo with React (Vite) frontend and FastAPI backend wired to Supabase. Keep v1 slot‑booking MVP intact, and add the extensibility tables + minimal logistics endpoints and event emission.

Tasks:

Create folders exactly as specified in Section 3.

Initialize Vite React + Tailwind in /frontend.

Initialize FastAPI in /backend with routers: auth.py, slots.py, bookings.py, restrictions.py, logistics.py.

Connect to Supabase Postgres via asyncpg (DATABASE_URL env).

Implement endpoints per Section 6, ensuring booking uses SELECT ... FOR UPDATE and returns 409 on capacity exceeded.

After /v1/bookings success, emit a BOOKING_CREATED row into domain_events and one into outbox.

Add migrations in /infra using the SQL in Section 4 (both MVP and extensibility files). Provide a script/README snippet to run them.

Frontend: replace local state with real API calls; build Inbound page (read‑only list of consignments + last checkpoint) behind VITE_FEATURE_LOGISTICS=true.

Provide .env.example with all required env vars.

Add run scripts: npm run dev for FE; uvicorn backend.main:app --reload --port 8000 for BE.

## 14) Node/Express Alternative (optional)

Use pg, express, zod, express-rate-limit.

Keep identical REST shape and SQL concurrency pattern.

## 15) Future Modules (non‑blocking)

Quality Inspections: templates + pass/fail gates before receiving.

Compliance Docs: expiry alerts & booking/receiving checks.

Inventory/Traceability: link consignments → lots/batches → SKUs.

Optimization: suggest slots based on throughput & historical data.

Internationalization: en/af; time‑zone aware scheduling.

This file replaces separate blueprints and should be saved at repo root as "Blueprint.md"

---

## Admin Addendum (15 Aug 2025) — Delta

**Reference**: [Admin_Addendum.md](./Admin_Addendum.md)

This addendum introduces enhancements to the Admin experience with templates, preview/publish workflows, and enhanced calendar management. **Status as of 2025-08-15**: Core UI architecture implemented, API compliance needs correction (`/v1/slots` endpoint), feature flags require integration. The following additions extend (do not replace) existing blueprint sections:

### Frontend Plan (§7) Additions:
- **Admin Calendar Month/Week/Day views** with right-hand Inspector panel for slot details and quick actions
- **Preview & Publish workflow** for template applications and bulk operations with change preview before commit
- **No client-side fabrication rule** - all UI renders only backend-provided data, no placeholder or phantom slots
- **Next Available finder** - server-side search across future slots respecting restrictions and capacity

### Implementation Details (moved from changelog):
- **admin calendar:** Full Month/Week/Day calendar views for admin slot and booking management
- **view modes:** Three calendar views (Month/Week/Day) with proper timezone handling (Africa/Johannesburg)
- **data integrity:** All views render only backend-provided data, no client-side fabrication or phantom slots
- **crud operations:** Comprehensive interface for slot editing, booking creation, blackout management, restrictions
- **empty states:** Proper "No slots defined by admin" messages when backend returns empty arrays
- **routing:** /admin/calendar route with RBAC guard, integrated into admin navigation
- **query optimization:** Strict query keys with tenantId + date range, no placeholderData for admin views
- **performance:** Loading skeletons instead of stale data, virtualized month grids, debounced navigation
- **components:** AdminMonthView, AdminWeekView, AdminDayView with consistent slot status indicators
- **dialogs:** BulkCreateSlotsDialog, FilterDialog for comprehensive admin workflow
- **accessibility:** Full keyboard navigation, ARIA labels, screen reader support for all calendar interactions
- **regression fix:** Fixed phantom availability data in DayTimeline and WeekOverviewGrid components
- **grower timeline:** Enhanced data integrity - pills show "-" for dates without backend slots (totalSlots === 0)
- **aggregation:** Modified getAggregatesForDate() to return proper empty state for undefined dates
- **timeline design:** Maintained 84px pills, sticky month header, clean UI without placeholder data
- **testing ready:** Structure prepared for comprehensive admin calendar testing and phantom slot regression tests

**Day Editor Sheet**: Full-height right drawer for comprehensive day editing. Launched via "Edit Day" from DayPeekSheet. Sections: Overview (date, blackout toggle, stats, restriction chips), Quick Create (slot_length_min, capacity, notes), Restrictions Editor (day scope posting to /v1/restrictions/apply), and Utilities (Duplicate from, Delete empty slots, Blackout Day). Provides in-place editing without navigation away from calendar.

**Day View FAB + Slot Sheet**: Mobile-first day management with floating action button for quick slot creation. FAB opens time picker dialog (start_time, duration, capacity, notes) posting to /v1/slots/bulk for single slot creation. Tapping existing slots opens bottom SlotSheet with overview stats (capacity/remaining/booked), settings (capacity/notes editing), blackout toggle (PATCH /v1/slots/{id}/blackout), restrictions button, and delete for empty slots. Provides complete mobile slot management workflow.

**Copy & Safeguards (Client Validation)**: Enforces usability rules across all admin interfaces. Past dates (determined by Africa/Johannesburg timezone) automatically disable form actions with warning messages. All destructive operations (blackout, restrictions) show scoped confirmation dialogs ("Blackout Fri 2025-08-15?" or "Blackout 3 selected days?"). HTTP errors (422/403/409) display server json.error messages verbatim, never generic fallbacks. Date inputs have min attributes set to today, preventing past date selection entirely.

### §11 Mobile Parity & Testing Strategy

**Mobile Viewport Testing**: Complete mobile test coverage at iPhone 12 mini (390×844) and Galaxy S20 (412×915) viewports. Tests cover DayPeekSheet swipe dismissal, DayEditorSheet full-height display, BulkBar bottom positioning, FAB thumb-zone accessibility, and cross-viewport layout adaptation. Playwright E2E tests validate real mobile interactions including touch targets, sheet animations, and responsive breakpoints.

**Accessibility Compliance**: ARIA labels for day cells include slot counts and status ("Thursday 15, Slots: 3, Remaining: 12, Blackout"). Form elements have proper label associations, confirmation dialogs follow accessibility best practices with role="dialog" and descriptive headings. Touch targets meet 44px minimum size requirements with adequate spacing for mobile interactions.

### API (§6) Additions:
- **Template CRUD**: `GET/POST/PATCH/DELETE /v1/admin/templates` (stub endpoints implemented)
- **Template Application**: `POST /v1/slots/apply-template` with preview/publish modes and idempotency
- **Booking Updates**: `PATCH /v1/bookings/{id}` for admin booking moves with 409/403 validation (stub implemented)

### API (§6) Calendar Export & Sync Roadmap:
- **P1 ICS Feeds**: `GET /v1/exports/calendar.ics` with tenant-scoped signed URLs, optional booking feeds
- **P2 External Publishing**: Service integration with Google Calendar API and Microsoft Graph for one-way slot publishing  
- **P3 Two-way Sync**: Inbound edit processing with field validation, ETag-based conflict resolution, audit logging

### API Stubs (§6.7 Templates - Admin Only):

```
GET    /v1/admin/templates                 -> [] (empty list)
POST   /v1/admin/templates                 -> { id, tenant_id, name, config, ... }
PATCH  /v1/admin/templates/{id}            -> { id, tenant_id, name, config, ... } 
DELETE /v1/admin/templates/{id}            -> { ok: true }
POST   /v1/slots/apply-template            -> { created: 0, updated: 0, skipped: 0, samples: {...} }
POST   /v1/slots/next-available            -> { slots: [{slot_id,date,start_time,end_time,remaining,notes}], total:int }

**Publish idempotency guaranteed**: Template publishing uses update-then-insert pattern within single transaction to ensure atomicity and prevent partial writes.
PATCH  /v1/bookings/{id}                -> { id, updated: true }
```

### Data Model (§4) Additions:
- **templates table**: tenant-scoped reusable availability patterns with JSON config (weekday blocks, cultivar windows, buffers)
- **template_runs table** (optional): audit trail for template applications and idempotency tracking

### Testing (§11) Additions:
- **Template apply tests**: preview vs publish idempotency, no duplication on re-runs
- **No-fabrication guarantees**: UI renders only authentic backend data, no client-side slot generation
- **Admin drag-drop tests**: booking moves with proper 403/409 error handling and UI revert behavior

### Testing (§11) Calendar Export & Sync:
- **P1 ICS Tests**: Feed validation with major calendar clients, tenant isolation, subscription workflows
- **P2 Publishing Tests**: API rate limiting, idempotent operations, external service resilience
- **P3 Sync Tests**: Conflict resolution, audit logging, field validation, ETags integrity

### Security/Tenancy (§8) Clarifications:
- **RBAC for admin routes**: templates, bulk operations, and calendar management admin-only
- **Template operations**: all scoped by tenant_id with proper access controls

### Security/Tenancy (§8) Calendar Export & Sync:
- **P1 Signed URLs**: Tenant-scoped ICS feeds with expiring signatures, no cross-tenant data leakage
- **P2 API Credentials**: Secure OAuth2 flows for external calendar services, admin-controlled integrations
- **P3 Sync Security**: Field-level permissions, audit trails, ETags for concurrency control

---

## Changelog

### August 14, 2025 - Repository Audit & Fix Pass: Complete Blueprint Compliance
- **audit:** Performed comprehensive repository scan for Blueprint.md compliance and issue resolution
- **api migration:** Updated all frontend query keys from `/api/` to proper resource names for v1 endpoints
- **query structure:** Standardized query keys to include tenantId for proper multi-tenant caching
- **typescript:** Fixed all TypeScript errors including type conversion issues in admin-dashboard.tsx
- **cleanup:** Removed legacy files (admin-dashboard-old.tsx, grower-dashboard-old.tsx)
- **verification:** Confirmed SELECT FOR UPDATE pattern for booking concurrency (line 63-64 bookings.py)
- **data integrity:** Verified no phantom slot generation - UI renders only backend-provided data
- **rbac:** Confirmed admin-only routes protected with require_role decorator
- **documentation:** Created SCAN_REPORT.md and VERIFICATION_REPORT.md for audit tracking
- **testing ready:** All LSP diagnostics cleared, ready for concurrency and E2E testing

### August 15, 2025 - UI-ROUTE-FIX — /admin now renders AdminPage.tsx; legacy header removed
- **routing:** Updated App.tsx to render AdminPage component for /admin route instead of AdminDashboard
- **legacy removal:** Renamed admin-dashboard.tsx to .bak to prevent accidental re-import
- **header validation:** Added admin_route_wires_new_ui.spec.tsx test ensuring Create ▾ and More ▾ buttons exist with no legacy header buttons
- **testids:** Updated AdminPage header buttons to use admin-header-create and admin-header-more data-testids

### August 15, 2025 - Verbatim 4xx error handling — Created lib/http.ts utility, updated AdminPage, BulkBar for exact server error display.

### August 15, 2025 - Fixed /v1/slots endpoint usage — AdminPage, client.ts, useSlotsRange.ts now use spec-compliant /v1/slots?start&end format.

### August 15, 2025 - Admin audit + doc sync — Status report generated, API compliance gaps identified, feature flag integration needed.

### August 15, 2025 - UI reconcile — Admin uses existing app shell, theme, and mobile layout (no new files).

### August 15, 2025 - FE reconcile — Admin wired in /src, routes unified to component prop, calendar views and day sheets integrated.

### August 15, 2025 - Admin Calendar — Reconcile & Wire V1 (no-new-files).

### August 15, 2025 - Admin runtime probe generated.

### August 15, 2025 - Legacy admin components quarantined.

### August 15, 2025 - Admin UI: DayPeek + DayEditor wired.

### August 15, 2025 - Router: fix /admin (wouter component prop).

### August 15, 2025 - Admin cleanup pass #001 — routes consolidated, legacy quarantined, FE endpoints moved to /v1; status report generated.

### August 15, 2025 - Fix: /admin renders AdminPage (not Grower).

### August 15, 2025 - FE endpoints migrated to /v1.

### August 15, 2025 - Re-enable Admin day interactions (peek/editor/bulk).

### August 15, 2025 - Route consolidation for Admin.

### August 15, 2025 - Diagnostics scan generated.

### August 15, 2025 - Admin UI Audit & Verification Report Generated
- **audit:** generated Admin UI verification & legacy scan — no product code changes.
- **reports:** Created reports/admin_ui_audit.md and reports/admin_ui_audit.json with comprehensive UI compliance analysis
- **test:** Added admin_route_wire.spec.tsx test confirming AdminPage renders with Create ▾ and More ▾ dropdowns (PASS)
- **verification:** Confirmed /admin route uses AdminPage.tsx, legacy admin-dashboard.tsx renamed to .bak
- **documentation:** Verified header implementation, day interactions, create flows, and legacy cleanup status

### August 15, 2025 - UI-M1 Admin Calendar Toolbar Cleanup + Day Peek
- **header simplified:** Replaced legacy buttons (Blackout, Apply Restrictions, etc.) with streamlined Create ▾ and More ▾ dropdowns
- **create menu:** "Create Slots (Day)", "Bulk Create Slots", and "Apply Template" consolidated under Create ▾
- **more menu:** Export CSV, Open Filters, and Help moved to More ▾ dropdown for cleaner interface
- **day peek:** Added DayPeekSheet component opening on day cell tap with contextual actions (Create, Blackout, Restrict, Edit, Day View)
- **filter drawer:** Skeleton FilterDrawer component accessible from More ▾ → Open Filters menu item
- **testing:** Comprehensive M1 UI tests covering header simplification, day peek functionality, and action consolidation

### August 15, 2025 - C4 Rename Buttons/Titles for Clarity
- **ui:** Updated labels for unambiguous slot creation flow identification
- **buttons:** Top-bar button remains "Create Slots (Day)" for single-day creation context
- **dialogs:** Day dialog title updated to "Create Slots — Day", range dialog title simplified to "Bulk Create Slots"
- **consistency:** Maintained clear distinction between single-day vs range creation workflows
- **documentation:** Updated changelog to reflect label improvements for user clarity

### August 15, 2025 - C3 Surface Backend Error Messages in Dialogs
- **frontend:** Display backend json.error messages verbatim in CreateSlotsDialog and BulkCreateDialog
- **error handling:** Inline error display replacing generic toast notifications for better UX
- **validation:** Show exact backend messages like "start_date cannot be in the past" at top of dialogs
- **state management:** Error message state cleared on successful retry or new submissions
- **testing:** Comprehensive error message surfacing tests for 422/400 responses with exact text matching

### August 15, 2025 - C2 Backend Validation for /v1/slots/bulk
- **backend:** Strict validation for bulk slot creation with proper error codes (422/400, never 500)
- **schema:** BulkCreateSlotsRequest with Pydantic validators for end_date and weekdays constraints
- **validation:** Africa/Johannesburg timezone checks, weekdays range 1-7 (Mon-Sun), capacity > 0
- **error handling:** 422 for "start_date cannot be in the past", "end_date must be on or after start_date"
- **api:** Converts ValueError to 400, prevents 500 errors with comprehensive exception handling
- **testing:** Complete test suite covering past dates, invalid ranges, empty weekdays, malformed data

### August 15, 2025 - C1 Create Slots Split + Past Date Blocking
- **ui:** Split "Create Slots" into single-day vs range creation with distinct dialogs
- **create slots:** CreateSlotsDialog for focused date (start=end=selectedDate), hides weekdays UI
- **bulk create:** BulkCreateDialog with date range inputs, weekday checkboxes, defaults today+7
- **validation:** Africa/Johannesburg timezone past date blocking with inline errors
- **api:** Both dialogs POST to /v1/slots/bulk with appropriate date ranges and weekday masks
- **testing:** Comprehensive test coverage for dialog behaviors, validation, API calls

### August 15, 2025 - Calendar Export & Sync Roadmap Added
- **roadmap:** Added comprehensive calendar export & sync roadmap with 3-phase implementation plan
- **P1 planning:** ICS read-only feeds for external calendar subscription (Q1 2026)
- **P2 planning:** One-way API publishing to Google Calendar and Microsoft Graph (Q2 2026)
- **P3 planning:** Two-way sync with conflict resolution and audit trails (Q3 2026)
- **documentation:** Updated FEATURES.md epic, Blueprint.md API roadmap, ISSUES.md acceptance criteria
- **security:** Defined tenant-scoped signing, OAuth2 flows, field-level permissions for each phase

### August 14, 2025 - Admin Addendum adopted (docs); feature-flagged implementation planned
- **docs:** Admin Addendum specifications adopted in Blueprint Delta section
- **planning:** Templates, Inspector panel, drag-drop management planned for feature-flagged implementation
- **architecture:** Data model additions (templates table) and API contracts (template CRUD, apply-template) specified

### August 14, 2025 - Week Overview UX Implementation Complete
- **feat:** Replaced hourly time grid with Week Overview day cards per Blueprint Section 7 UX plan
- **components:** Created WeekOverviewGrid and DayCard components with responsive layouts
- **navigation:** Implemented click-to-navigate from week day cards to detailed Day view
- **design:** Color-coded availability badges (Green ≥50%, Amber 20-49%, Red <20%, Grey no capacity)
- **responsive:** Desktop 7-col, tablet 3-4 col, mobile 2-col layouts with proper accessibility
- **integration:** Updated all calendar pages (calendar-page, admin-dashboard, admin-slots) with new onDateSelect
- **compliance:** Fulfilled Blueprint Section 7 requirement for improved Week Overview UX
- **quality:** Maintained backward compatibility, proper navigation flow, comprehensive tooltips

### August 14, 2025 - Blueprint Verification & Implementation Review  
- **verification:** Completed comprehensive repository verification against blueprint specifications
- **findings:** Core MVP functionality fully implemented and working correctly
- **architecture:** Database schema exactly matches blueprint Section 4 requirements
- **api:** All endpoints implemented with proper authentication and RBAC enforcement
- **frontend:** Calendar interface successfully replaced all vertical slot lists
- **admin:** Full slot management controls implemented (/admin/slots page)
- **gaps:** Minor API versioning discrepancy (/api/ vs /v1/) and missing CSV export endpoint
- **quality:** Application stable, transactional booking safe, multi-tenancy enforced
- **compliance:** RBAC working, Day/Week toggle functional, MVP requirements met

### August 15, 2025 - Frontend Feature Flags & Endpoint Constants
- **flags:** Add VITE_FEATURE_ADMIN_TEMPLATES and VITE_FEATURE_NEXT_AVAILABLE to .env.example
- **endpoints:** Add ADMIN_TEMPLATES, APPLY_TEMPLATE, PATCH_BOOKING constants to endpoints.ts

### August 15, 2025 - PATCH Bookings Endpoint Stub
- **endpoint:** Add PATCH /v1/bookings/{id} returning success placeholder

### August 15, 2025 - Apply-Template Endpoint Stub
- **endpoint:** Add POST /v1/slots/apply-template returning zero counts

### August 15, 2025 - Templates Router CRUD Stubs  
- **router:** Add /v1/admin/templates CRUD endpoints returning placeholder data

### August 15, 2025 - Backend "Next Available" Finder (B11 Complete)
- **endpoint:** POST /v1/slots/next-available with deterministic logic for eligible slots after from_datetime
- **filtering:** Respects capacity (remaining > 0), blackout exclusion, grower/cultivar restrictions, tenant isolation
- **ordering:** Proper chronological sorting by date/time with configurable limit parameter
- **timezone:** Handles Africa/Johannesburg timezone with ISO datetime parsing (2025-08-15T08:00:00+02:00)
- **restrictions:** Implements grower_allowlist and cultivar_allowlist via slot_restrictions table
- **testing:** Comprehensive test suite covering all filtering, ordering, capacity, and restriction scenarios
- **advance notice:** TODO placeholder for per-slot advance_notice_min enforcement when implemented

### August 15, 2025 - Backend Apply-Template Publish Transaction (B10 Complete)
- **transaction:** Wrapped publish_plan in single DB transaction with proper update-then-insert pattern
- **idempotency:** UPDATE slots WHERE tenant_id AND date AND start_time AND end_time; if rowcount==0 then INSERT
- **atomicity:** All slot operations succeed or fail together, prevents partial writes on errors
- **testing:** Comprehensive test suite covering first publish, idempotent republish, updates, rollback scenarios
- **counts:** Returns {created, updated, skipped} counts for publish operation tracking
- **docs:** Added "Publish idempotency guaranteed" note to Blueprint.md Section 6

### August 15, 2025 - Frontend Drag-Drop Booking Move Implementation (B9 Complete)
- **drag-drop:** Implemented real DnD using @dnd-kit/core with BookingChip and DroppableSlot components
- **api:** Calls PATCH /v1/bookings/{id} with {slot_id:newSlotId} on drop, no optimistic updates
- **error handling:** 403/409 errors surface server message in toast, refetch ensures revert effect
- **ui:** Booking chips show grower name + quantity, draggable with move cursor and visual feedback
- **integration:** DndContext wraps AdminCalendarView, DragOverlay shows chip during drag
- **tests:** Comprehensive test suite in /client/src/__tests__/admin_dnd.spec.tsx covering happy path and error scenarios
- **docs:** Added drag-drop testing note to Blueprint.md Section 11, updated FEATURES.md progress

### August 15, 2025 - Frontend Inspector Panel Implementation (B8 Complete)
- **inspector:** Created InspectorPanel.tsx with slot details display (capacity, remaining, notes, blackout status)
- **actions:** Blackout toggle calls PATCH /v1/slots/{id}/blackout with proper request format
- **restrictions:** Restrict button opens dialog, applies POST /v1/restrictions/apply with slot/day scope
- **error handling:** 403/409 errors show toast without UI write, preventing phantom updates
- **cache:** Proper invalidation of ['slots', tenantId, startISO, endISO] after all operations
- **ui integration:** Inspector opens on slot selection, right-hand panel layout in admin dashboard
- **tests:** Comprehensive test suite in /client/src/__tests__/admin_inspector.spec.tsx with 15+ scenarios
- **docs:** Added Inspector Panel to Blueprint.md Section 7 Frontend Plan

### August 15, 2025 - Backend Blackout Operations Implementation (B7 Complete)
- **schema:** Added BlackoutRequest model with start_date, end_date, scope (slot/day/week), optional note
- **endpoints:** Implemented PATCH /v1/slots/{id}/blackout for single slot blackout with notes
- **bulk:** Implemented POST /v1/slots/blackout for day/week bulk operations with date range validation
- **scope:** Day scope blackouts all slots per date, week scope blackouts entire Monday-Sunday weeks
- **idempotent:** Both endpoints use WHERE blackout = false to prevent duplicate updates on re-runs
- **validation:** Date format validation, range limits (365 days max), scope validation, admin-only access
- **tests:** Comprehensive test suite in /app/backend/tests/test_blackout.py covering all scenarios
- **docs:** Added blackout endpoints to Blueprint.md Section 6.2 with examples and scope explanations

### August 15, 2025 - Grower View Alignment with Admin Restrictions (B18 Complete)
- **restrictions:** Grower view accurately reflects admin-set restrictions with 🔒 icons for restricted slots
- **tooltips:** Unavailability explanations via tooltips (blackout, no capacity, grower/cultivar restrictions)
- **next available:** Integration with Next Available dialog when VITE_FEATURE_NEXT_AVAILABLE enabled
- **data integrity:** No phantom slots - grower view mirrors backend slot availability with truthful indicators
- **testing:** Comprehensive test suite with 21 test cases covering restriction scenarios, booking behavior, accessibility
- **ui:** Slot badges show capacity remaining, proper blackout indicators, restriction lock icons with proper aria-labels
- **compliance:** Fulfills Blueprint Section 7 requirement for grower view to mirror admin rules with transparent unavailability

### August 15, 2025 - CSV Export Backend Implementation (B15 Complete)
- **endpoint:** Implemented GET /v1/exports/bookings.csv with streaming response for memory efficiency
- **filtering:** Date range (required), optional grower_id, cultivar_id, status filtering with tenant scoping
- **format:** Exact header order: booking_id,slot_date,start_time,end_time,grower_name,cultivar_name,quantity,status,notes
- **encoding:** UTF-8 support for international characters in names and notes fields
- **headers:** Content-Type: text/csv; charset=utf-8, Content-Disposition with dynamic filename
- **validation:** Admin role required, date range validation (start <= end), proper parameter handling
- **tests:** Comprehensive test suite covering headers, filtering, Unicode, access control, tenant isolation
- **docs:** Added Section 6.6 Exports to Blueprint.md with complete endpoint specification

### August 15, 2025 - Docs consistency pass #3 (removed legacy client paths; set export to /v1/)
- **cleanup:** Updated FEATURES.md and ISSUES.md to remove legacy /client/ path references
- **export:** Changed CSV export endpoint from /api/export/bookings.csv to GET /v1/exports/bookings.csv
- **paths:** Updated backend location from server/routes.ts to /app/backend/routers/exports.py
- **status:** Marked export endpoint as Backlog priority in ISSUES.md

### August 15, 2025 - No-Fabrication Guard & Month Boundary Test (B6 Complete)
- **testing:** Created comprehensive regression test suite in /client/src/__tests__/admin_nofab_boundary.spec.tsx
- **guard:** Verifies UI never invents slots when API returns empty responses for future date ranges
- **boundary:** Tests month navigation (Aug 27 → Sep 7) confirms no phantom availability appears
- **integrity:** Ensures no unauthorized POST requests fire during navigation or view mode changes
- **cases:** Covers empty API responses, null/undefined data, navigation, view mode switching
- **fetch-spy:** Uses fetch spy to verify only authorized GET requests during normal operation
- **prevention:** Prevents regression by locking in rule that UI only renders backend-provided data
- **validation:** Tests neutral empty states, disabled interactions, and consistent behavior across view modes

### August 15, 2025 - Admin UI Apply Template Dialog Implementation (B5 Complete)
- **dialog:** Enhanced Apply Template dialog with real preview/publish flow behind VITE_FEATURE_ADMIN_TEMPLATES flag
- **flow:** Template selection → Preview generation → Publish with real backend integration
- **preview:** Shows created/updated/skipped counts and sample slot lists from actual API responses
- **publish:** Real publish mode with cache invalidation and grid refresh on completion
- **ux:** Proper state management with dialog reset, change template option, disabled publish when no changes
- **api:** Calls POST /v1/slots/apply-template with template_id, date range, and mode (preview/publish)
- **tests:** Created comprehensive test suite in /client/src/__tests__/admin_apply_template.spec.tsx
- **scenarios:** Tests template selection, preview generation, publish flow, re-publish zero counts
- **validation:** Verifies non-zero preview counts, grid updates, proper API calls, state management

### August 15, 2025 - PATCH Booking Update Implementation (B4 Complete)
- **endpoint:** Implemented PATCH /v1/bookings/{id} with transactional capacity and restriction checks
- **capacity:** Enforces slot capacity limits with 409 error when target slot full or quantity exceeds available space
- **restrictions:** Validates slot restrictions with 403 error when moving to blacked out slots  
- **authorization:** RBAC enforcement - growers can only update their own bookings, admins can update any
- **transactions:** Uses SELECT FOR UPDATE to lock current and target slots during move operations
- **events:** Emits BOOKING_UPDATED domain events with comprehensive payload including move details
- **outbox:** Adds events to outbox table for reliable webhook delivery
- **tests:** Created comprehensive test suite in /app/backend/tests/test_booking_patch.py with 15 test cases
- **scenarios:** Covers 403 (blackout/auth), 409 (capacity), 200 (success), move/update/cultivar change
- **validation:** Tests atomic transactions, SELECT FOR UPDATE behavior, event emission integrity

### August 15, 2025 - Wire Create Slots & Bulk Create Implementation (B3 Complete)
- **frontend:** Enhanced admin dashboard with proper BulkCreateForm component using react-hook-form and Zod validation
- **forms:** Created structured form with start_date, end_date, weekdays[], slot_length_min, capacity, notes fields
- **buttons:** Both "Create Slots" and "Bulk Create" buttons use same bulkCreateSlotsMutation with POST /v1/slots/bulk
- **cache:** Updated invalidation to use specific ['slots', 'range', tenantId, startISO, endISO] query keys for immediate refresh
- **errors:** Proper error handling with server message display and form validation feedback
- **tests:** Created comprehensive test suite in /client/src/__tests__/admin_bulk_create.spec.tsx
- **verification:** Form submission, API integration, cache invalidation, and error handling all working correctly

### August 15, 2025 - Apply-Template Publish Implementation (B2 Complete)
- **publish:** Added publish_plan function with idempotent update-then-insert pattern
- **transaction:** Single transaction wraps all slot operations with automatic rollback on failure  
- **upsert:** UPDATE first by (tenant_id, date, start_time, end_time), INSERT if no rows affected
- **counts:** Returns accurate created/updated/skipped counts based on actual database operations
- **endpoint:** Enhanced POST /v1/slots/apply-template with publish mode using publish_plan
- **idempotent:** Second publish of same template/range updates existing slots without duplication
- **tests:** Created comprehensive test suite in /app/backend/tests/test_apply_template_publish.py
- **verification:** Update-then-insert pattern working, transaction safety, count accuracy validated

### August 15, 2025 - Apply-Template Preview Implementation (B1 Complete)  
- **services:** Created /app/backend/services/templates.py with plan_slots and diff_against_db functions
- **planner:** Implements weekday schedules, slot_length_min, blackout/override exceptions, timezone support
- **differ:** Classifies desired slots as create/update/skip by comparing against database slots
- **endpoint:** Updated POST /v1/slots/apply-template to call planner and return deterministic counts
- **preview:** Returns counts (created/updated/skipped) and first 10 samples per bucket, no database writes
- **tests:** Created comprehensive test suite in /app/backend/tests/test_apply_template_preview.py
- **verification:** Plan_slots generates expected slots, diff_against_db classifies correctly, preview mode works

### August 15, 2025 - Docs consistency pass #2 (FEATURES/ISSUES cleaned; legacy Node paths removed)
- **docs:** Admin Calendar System moved from Fully Implemented to In-Progress with AdminPage.tsx path
- **docs:** Export endpoint renamed with FastAPI path /app/backend/routers/exports.py and /v1/ route
- **docs:** Legacy Node paths removed, all references updated to FastAPI/React structure

### August 15, 2025 - Templates System Testing Infrastructure Complete
- **testing:** Implemented comprehensive smoke test suite with React Testing Library and vitest
- **frontend:** 4/5 frontend tests passing for Templates drawer, Apply Template dialog, empty state
- **backend:** 5/5 Python structure validation tests passing for template CRUD endpoints
- **integration:** Templates drawer feature-flagged (VITE_FEATURE_ADMIN_TEMPLATES='true')
- **compliance:** All endpoints use /v1/ API prefix with proper response shapes
- **quality:** Data integrity maintained - no client-side phantom data, backend-only rendering

### August 15, 2025 - Templates Backend Schemas
- **schemas:** Add Pydantic models for templates and apply-template operations

### August 15, 2025 - Templates Migration Scaffold
- **migration:** Add 104_templates.sql (docs-only scaffold)

### August 15, 2025 - Documentation Consistency Pass
- **docs:** Admin Addendum docs consistency pass after adoption
- **endpoints:** Updated remaining /api/ references to /v1/ per Section 6
- **paths:** Corrected file paths from Node (/server, /client) to FastAPI/React structure (/app/backend, /app/frontend)
- **features:** Kept Week view calendar in In-Progress status per task requirements
- **issues:** Added comprehensive feature-flagged Admin implementation tracking issue

### August 15, 2025 - Admin Addendum Adoption
- **docs:** Admin Addendum adopted (docs-only); code rollout in next PR behind flags

### August 15, 2025 — Docs consistency pass #4: replaced legacy paths, documented audit_log, confirmed /v1 standard.
- **docs:** Updated B16/B17 location paths to FastAPI/React structure (/app/frontend/src/pages/AdminPage.tsx, /app/backend/services/audit.py)
- **docs:** Resolved API versioning strategy gap - standardized on /v1 per Blueprint §6
- **schema:** Added audit_log table documentation in §4 Data Model (id, tenant_id, actor_id, action, payload_summary jsonb, created_at)
- **api:** Documented audit trail endpoints in §6 API contracts with event emission details
- **compliance:** All documentation now reflects proper FastAPI/React monorepo structure

### August 13, 2025 - Calendar Grid Implementation
- **feat:** Added GET /v1/slots/range endpoint for multi-day slot fetching (max 14 days)
- **feat:** Implemented CalendarGrid component with Day/Week views and time-axis layout
- **feat:** Added feature-rich slot cards showing capacity bars, restrictions, blackout status
- **feat:** Created CalendarPage with view mode toggle and date navigation
- **feat:** Added VITE_FEATURE_WEEKVIEW feature flag for progressive rollout
- **docs:** Updated API contracts in §6.2 and frontend plan in §7
- **compat:** Maintained full backward compatibility with existing GET /v1/slots?date= endpoint