Unified App Blueprint – Grower & Agri Supply Chain (Replit)

Single, consolidated blueprint that merges the original slot‑booking MVP with the extensible addendum. Designed for Replit, Supabase (Postgres + Auth), and FastAPI (or Node as an alt). This file is the source of truth for how the app should work and evolve.

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

Transactional booking with capacity controls and restrictions (by grower/cultivar/variant).

Admin: bulk slot generation, blackouts, notes, per‑slot restrictions.

Notifications v1: email confirmations; SMS/WhatsApp later.

Multi‑tenant and RBAC foundation.

### 1.4 Near‑term Extensions (nice‑to‑have)

Consignments & Checkpoints (turn bookings into tracked loads; gate/weigh/QC events).

Quality Inspections, Compliance docs (GLOBALG.A.P, organic, phytosanitary).

Events & Outbox for audit + integrations (ERP/WMS/weighbridge/ANPR).

Rules & Workflows (quotas, state machines) as JSON configs.

## 2) Architecture

Frontend: React (Vite) + TanStack Query + Tailwind. Feature flags for modules.

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
POST /auth/login               -> { token }
GET  /auth/me                  -> { user, roles, tenant_id }
```

### 6.2 Slots

```
GET   /v1/slots?date=YYYY-MM-DD
GET   /v1/slots/range?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD  # range query (max 14 days)
POST  /v1/slots/bulk                 # create slots for date/time window
PATCH /v1/slots/{id}                 # blackout/capacity/notes
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
DELETE /v1/bookings/{id}
GET    /v1/bookings?date=&grower_id=
```

Create request

```json
{ "slot_id":"uuid", "grower_id":"uuid", "cultivar_id":"uuid", "quantity":5.0 }
```

Errors: 409 (capacity exceeded), 403 (slot restricted), 404 (slot not found).

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

## 7) Frontend Plan

Replace wireframe's local state with API calls (TanStack Query cache + invalidation).

Pages:

Dashboard (Day/Week) – availability grid with status dots/badges.

Book – modal flow; quantity + cultivar/variant.

Admin Slots – bulk generation, blackout, restrictions, notes.

Inbound (feature‑flagged) – read‑only consignments list with latest checkpoint.

Continuous DayTimeline – horizontally scrollable day strip with focused/selected state separation. Initial load selects today; explicit clicks open Day Detail; smooth centering on Today/Jump-to-date actions.

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

## Changelog

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

### August 13, 2025 - Calendar Grid Implementation
- **feat:** Added GET /api/slots/range endpoint for multi-day slot fetching (max 14 days)
- **feat:** Implemented CalendarGrid component with Day/Week views and time-axis layout
- **feat:** Added feature-rich slot cards showing capacity bars, restrictions, blackout status
- **feat:** Created CalendarPage with view mode toggle and date navigation
- **feat:** Added VITE_FEATURE_WEEKVIEW feature flag for progressive rollout
- **docs:** Updated API contracts in §6.2 and frontend plan in §7
- **compat:** Maintained full backward compatibility with existing GET /api/slots?date= endpoint