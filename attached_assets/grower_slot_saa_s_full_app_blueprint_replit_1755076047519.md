# Grower Slot SaaS – Full App Blueprint (Replit)

This blueprint specifies a production-ready path for a multi-tenant delivery slot booking platform for packhouses (initially macadamias), designed to be built and iterated in Replit. It includes architecture, schema, API contracts, security, deployment, and an execution plan.

---

## 1) Product Scope

### 1.1 Problem
Packhouses need to coordinate inbound deliveries from many growers, ensuring throughput and avoiding congestion. Current processes (calls, spreadsheets, WhatsApp) are error-prone.

### 1.2 Target Users & Roles
- **Grower (external)**: Views availability, books slot with quantity (resource unit), sees history, cancels.
- **Admin / Grower Liaison (packhouse)**: Creates slots, sets blackout windows, capacity, rules (per grower/cultivar), overrides.
- **Ops (optional)**: Read-only dashboards, export, notifications.

### 1.3 Core MVP Features
- Mobile-first web app (PWA-ready).
- Day/Week views with status (available/limited/full/blackout).
- Booking with transactional capacity check.
- Admin slot generation, blackout, restrictions (grower/cultivar), notes.
- Notifications: email (v1), SMS/WhatsApp later.
- Multi-tenant foundation.

### 1.4 Non-Goals (MVP)
- Weighbridge/ANPR integrations (phase 2+).
- Complex routing/optimization.
- Payments.

---

## 2) Architecture Overview

**Frontend**: React (Vite) + lightweight state (TanStack Query) + Tailwind.

**Backend**: FastAPI (Python) (or Node/Express alternative—see Appendix B).

**Database**: Postgres (Supabase). Use Row Level Security if needed later. Migrations via SQL files.

**Auth**: Supabase Auth (email magic link/OTP). JWT validated in backend.

**Hosting (dev)**: Both FE & BE on Replit. **Prod**: FE on Vercel, BE on Replit/Render/Fly, DB on Supabase.

**Observability**: JSON logging + UptimeRobot, Sentry (optional).

Diagram (logical):
```
React (PWA) ⇄ FastAPI (REST) ⇄ Supabase Postgres/Auth
                     ↳ Email (Resend/SendGrid)
```

---

## 3) Monorepo Layout (Replit)
```
/app
  /frontend        # React (Vite)
    index.html
    src/
      main.tsx
      App.tsx
      api/client.ts           # Axios + interceptors
      api/endpoints.ts        # Typed API calls
      components/
      pages/
        Login.tsx
        Dashboard.tsx
        AdminSlots.tsx
        Book.tsx
      store/                  # query keys, hooks
      styles/
      utils/
  /backend         # FastAPI
    main.py
    routers/
      auth.py
      slots.py
      bookings.py
      restrictions.py
      admin.py
    models/
    db.py
    security.py
    schemas.py
  /infra           # migrations & seeds
    001_init.sql
    002_seed.sql
  .env             # local dev env (don’t commit secrets)
  README.md
```

---

## 4) Data Model (SQL)

```sql
-- Tenants (packhouses)
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  timezone text DEFAULT 'Africa/Johannesburg',
  created_at timestamptz DEFAULT now()
);

-- Growers
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
CREATE INDEX IF NOT EXISTS idx_slots_tenant_date ON slots(tenant_id, date);

-- Restrictions (optional)
CREATE TABLE IF NOT EXISTS slot_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  allowed_grower_id uuid REFERENCES growers(id),
  allowed_cultivar_id uuid REFERENCES cultivars(id)
);
CREATE INDEX IF NOT EXISTS idx_restr_slot ON slot_restrictions(slot_id);

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
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);

-- Usage view
CREATE OR REPLACE VIEW slot_usage AS
SELECT s.id AS slot_id,
       s.capacity,
       COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.quantity END),0) AS booked,
       s.capacity - COALESCE(SUM(CASE WHEN b.status='confirmed' THEN b.quantity END),0) AS remaining
FROM slots s
LEFT JOIN bookings b ON b.slot_id = s.id
GROUP BY s.id, s.capacity;
```

### Seed (dev)
```sql
INSERT INTO tenants (name) VALUES ('Demo Packhouse') RETURNING id; -- copy UUID
-- Use returned tenant_id below
INSERT INTO growers (tenant_id, name) VALUES
  ('<tenant_id>', 'Lowveld Farms'),
  ('<tenant_id>', 'Riverside Orchards'),
  ('<tenant_id>', 'Kopje Mac Nuts');

INSERT INTO cultivars (tenant_id, name) VALUES
  ('<tenant_id>', 'Beaumont'),
  ('<tenant_id>', 'A4'),
  ('<tenant_id>', 'A16'),
  ('<tenant_id>', '816');
```

---

## 5) API Contract (FastAPI)

### Auth
```
POST /auth/login                -> { token }
GET  /auth/me                   -> user, roles, tenant_id
```
(Backed by Supabase JWT or app-managed JWT.)

### Slots
```
GET    /slots?date=YYYY-MM-DD               -> list[Slot]
POST   /slots/bulk                          -> generate slots over date/time window
PATCH  /slots/{id}                          -> update (blackout, capacity, notes)
GET    /slots/{id}/usage                    -> { capacity, booked, remaining }
```
**Slot schema (response):**
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "date": "2025-08-13",
  "start_time": "08:00:00",
  "end_time": "09:00:00",
  "capacity": 20.0,
  "resource_unit": "tons",
  "blackout": false,
  "notes": "Maintenance at 12:00",
  "restrictions": {
    "growers": ["uuid", "uuid"],
    "cultivars": ["uuid"]
  }
}
```

### Bookings
```
POST   /bookings                           -> create (transactional)
DELETE /bookings/{id}                      -> cancel (status='cancelled')
GET    /bookings?date=&grower_id=          -> list for day or grower
```
**Create booking (request):**
```json
{
  "slot_id": "uuid",
  "grower_id": "uuid",
  "cultivar_id": "uuid",
  "quantity": 5.0
}
```
**Create booking (responses):**
- 200: `{ ok: true, booking_id }`
- 409: `{ error: "Exceeds remaining capacity" }`
- 403: `{ error: "Slot restricted" }`

### Restrictions
```
POST  /restrictions/apply                  -> apply to a slot or all slots on a date
```
**Request:**
```json
{
  "date": "2025-08-13",
  "slot_id": "uuid or null",
  "grower_ids": ["uuid"],
  "cultivar_ids": ["uuid"],
  "note": "A4 only in afternoon"
}
```

### Admin Utilities
```
GET  /export/bookings.csv?start=&end=
GET  /health
```

---

## 6) Transactional Booking (concurrency-safe)

```sql
BEGIN;
SELECT capacity,
       COALESCE((SELECT SUM(quantity) FROM bookings WHERE slot_id=$1 AND status='confirmed'),0) AS booked
FROM slots
WHERE id=$1
FOR UPDATE;  -- lock slot row

-- server-side check
-- if $qty <= (capacity - booked) INSERT, else ROLLBACK

COMMIT;
```

FastAPI pseudo:
```python
async with conn.transaction():
  row = await conn.fetchrow("""
    SELECT capacity,
           COALESCE((SELECT SUM(quantity) FROM bookings WHERE slot_id=$1 AND status='confirmed'),0) AS booked
    FROM slots WHERE id=$1 FOR UPDATE
  """, slot_id)
  remaining = row["capacity"] - row["booked"]
  if qty > remaining:
      raise HTTPException(409, "Exceeds remaining capacity")
  await conn.execute("""
    INSERT INTO bookings (slot_id, tenant_id, grower_id, cultivar_id, quantity, status)
    VALUES ($1, (SELECT tenant_id FROM slots WHERE id=$1), $2, $3, $4, 'confirmed')
  """, slot_id, grower_id, cultivar_id, qty)
```

---

## 7) Frontend Integration Plan

- Replace wireframe’s local state with API calls using Axios.
- Use **TanStack Query** for data fetching and cache invalidation.
- On booking confirm: `POST /bookings` → refetch `GET /slots`.
- Admin page: forms for bulk generation, blackout toggle, restrictions.
- Role-based UI guards: show Admin tools only if `role==='admin'`.

**`/frontend/src/api/client.ts`**
```ts
import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**`/frontend/src/api/endpoints.ts`**
```ts
import { api } from './client';
export const getSlots = (date: string) => api.get(`/slots`, { params: { date } });
export const createBooking = (payload: any) => api.post(`/bookings`, payload);
export const bulkSlots = (payload: any) => api.post(`/slots/bulk`, payload);
export const patchSlot = (id: string, patch: any) => api.patch(`/slots/${id}`, patch);
export const applyRestrictions = (payload: any) => api.post(`/restrictions/apply`, payload);
```

---

## 8) Security & Multi-Tenancy

- All tables include `tenant_id`.
- Middleware resolves `tenant_id` from user or subdomain/header.
- Every query filters by `tenant_id`.
- Roles: `admin`, `grower` (JWT claim `role`).
- Input validation with Pydantic; output shaping to avoid overexposure.
- Rate limiting (simple middleware), CORS allowlist.

---

## 9) Notifications (v1 Email)

- Use Resend or SendGrid.
- Templates: booking confirmation, cancellation, admin broadcast.
- Send on server after successful transaction.

---

## 10) DevOps & Environments

**Replit**
- Two repls or one monorepo; expose backend on `/` port, FE via `vite` dev.
- Secrets: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.

**Migrations**
```bash
psql "$DATABASE_URL" -f infra/001_init.sql
psql "$DATABASE_URL" -f infra/002_seed.sql
```

**Health Checks**
- `/health` returns `{ status: 'ok' }`.
- UptimeRobot ping every 5 min.

**Backups**
- Supabase daily snapshots + point-in-time recovery (if enabled).

---

## 11) Testing Strategy

- **Unit**: schema validators, booking logic.
- **Integration**: booking transaction under concurrency (simulate race).
- **E2E**: Cypress/Playwright: login → book → cancel → admin edits.
- Seed script resets DB for CI runs.

---

## 12) Rollout Plan

**Phase 0 (1 week)**: Stand up DB, auth, basic `/slots` & `/bookings`. Wire FE day view & booking.

**Phase 1 (1–2 weeks)**: Admin tools (bulk gen, blackout, restrictions), email confirmations.

**Pilot (1 week)**: Onboard 5–10 growers at the packhouse. Collect feedback.

**Phase 2**: Week view, CSV export, per-grower quotas/week, audit log, WhatsApp.

**Phase 3**: Weighbridge integration (AutoWeigh analog), ANPR, analytics.

---

## 13) Acceptance Criteria (MVP)

- Booking is **atomic**: two users cannot overbook the same slot.
- Admin can generate slots for a date range with capacity and notes.
- Admin can apply blackout and restrictions (per slot or full day).
- Grower can view, book, and cancel; UI reflects remaining capacity.
- Email confirmation after booking.
- Multi-tenant ready (data scoped by tenant_id).

---

## 14) Replit Assistant Prompt (copy/paste)

> **Goal:** Convert the attached blueprint into a working monorepo with React (Vite) frontend and FastAPI backend, wired to Supabase. Implement `/slots` (GET, bulk POST, PATCH) and `/bookings` (POST, DELETE) with transactional capacity checks. Add TanStack Query on FE and simple login mock.
>
> **Tasks:**
> 1. Create folder layout under `/app` as specified.
> 2. Initialize Vite React + Tailwind in `/frontend`.
> 3. Initialize FastAPI in `/backend`; add routers: `slots.py`, `bookings.py`, `auth.py`.
> 4. Implement DB connector using `asyncpg`; load `DATABASE_URL` from env.
> 5. Add endpoints per API Contract; ensure booking transaction uses `FOR UPDATE` row lock.
> 6. Create `.env` placeholders and read secrets from Replit Secrets.
> 7. Build FE pages: `Login`, `Dashboard` (day view), `AdminSlots` (bulk gen, blackout, restrictions). Replace local state with API calls in `endpoints.ts`.
> 8. Add email stub function (no-op) to call after successful booking (replace later with Resend).
> 9. Provide a seed script and instructions to run migrations in `/infra`.
> 10. Provide run scripts: `npm run dev` for FE; `uvicorn backend.main:app --reload` for BE.

---

## 15) Future Enhancements

- **Quota engine**: limits per grower/day/week; soft vs hard caps.
- **Analytics**: slot utilization, average dwell, cancellations, cultivar mix.
- **Templates by sector**: macadamias, citrus, avo, table grapes; rentals/events.
- **PWA**: offline read-only schedules, installable app feel.
- **RBAC**: granular roles (ops, supervisor). Audit trails.
- **Internationalization**: en/af; time zone-aware scheduling.

---

## Appendix A – Example FastAPI Skeleton

```python
# backend/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import asyncpg, os

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    app.state.pool = await asyncpg.create_pool(dsn=os.getenv("DATABASE_URL"))

@app.get("/health")
async def health():
    return {"status": "ok"}
```

```python
# backend/routers/bookings.py (snippet)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, condecimal
from ..db import get_conn

router = APIRouter(prefix="/bookings")

class BookingIn(BaseModel):
    slot_id: str
    grower_id: str
    cultivar_id: str | None = None
    quantity: condecimal(gt=0)

@router.post("")
async def create_booking(payload: BookingIn):
    async with get_conn() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
              SELECT capacity,
                     COALESCE((SELECT SUM(quantity) FROM bookings WHERE slot_id=$1 AND status='confirmed'),0) AS booked
              FROM slots WHERE id=$1 FOR UPDATE
            """, payload.slot_id)
            if not row:
                raise HTTPException(404, "Slot not found")
            remaining = row["capacity"] - row["booked"]
            if payload.quantity > remaining:
                raise HTTPException(409, "Exceeds remaining capacity")
            await conn.execute("""
              INSERT INTO bookings (slot_id, tenant_id, grower_id, cultivar_id, quantity, status)
              VALUES ($1, (SELECT tenant_id FROM slots WHERE id=$1), $2, $3, $4, 'confirmed')
            """, payload.slot_id, payload.grower_id, payload.cultivar_id, payload.quantity)
    return {"ok": True}
```

## Appendix B – Node/Express Alternative (outline)
- Use `pg` for Postgres, `express-rate-limit`, `zod` for validation.
- Transaction with `BEGIN; ... SELECT ... FOR UPDATE; INSERT ...; COMMIT;`.

## Appendix C – Env Examples
```
# .env (dev)
VITE_API_URL=http://localhost:8000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
JWT_SECRET=change-me
RESEND_API_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## Appendix D – Run Commands
```
# backend
pip install fastapi uvicorn asyncpg pydantic python-dotenv
uvicorn backend.main:app --reload --port 8000

# frontend
npm create vite@latest frontend -- --template react-ts
cd frontend && npm i axios @tanstack/react-query && npm run dev
```

