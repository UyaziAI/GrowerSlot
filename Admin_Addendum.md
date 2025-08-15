# Admin Calendar & Management Dashboard — Addendum to Unified App Blueprint

**Version:** 1.0  
**Date:** 15 Aug 2025  
**Status:** Approved (Docs) → To be implemented behind feature flags  
**Scope:** Rework the Admin experience into a best-practice, intuitive calendar dashboard with full CRUD over slots, bookings, restrictions, blackouts, and reusable availability **templates**. This addendum extends (does not replace) the existing `Blueprint.md`.

---

## 1) Purpose

Provide an admin-first scheduling experience for packhouses to define operating hours, enforce rules (cultivar windows, grower restrictions), quickly create/black out capacity, and manage bookings with confidence and speed. The grower view becomes a faithful reflection of these admin-defined rules.

---

## 2) Design Principles & Inspiration (patterns only)

- **Calendly** — reusable schedules, weekday hours, exceptions, buffers, advance notice.  
- **Microsoft Bookings** — business closures/blackouts, time-off, pre/post buffers.  
- **Acuity (Squarespace Scheduling)** — quick block time, per-calendar availability & limits.  
- **Skedda** — quotas and conditional rules (who can book what/when).  
- **Calendar UI** — FullCalendar (Month/Week/Day + drag/resize), React Big Calendar (OSS).

> We copy interaction patterns (templates, date-specific exceptions, blackout ranges, drag-to-create/move, preview/publish), not code.

---

## 3) Admin UX Overview

### 3.1 Global Controls (Top Bar)
- **View:** Month • Week • Day
- **Navigate:** Today • ◀︎ ▶︎ • Date picker
- **Filters:** Grower, Cultivar, Status
- **Actions:** Apply Template • Bulk Create • Blackout • Restrictions • **Preview & Publish**

### 3.2 Calendar Canvas
- **Month:** per-day badges — Capacity • Booked • Remaining • Blackout flag
- **Week/Day:** time grid; **slots** are blocks; **bookings** render as chips within slots
- **Drag & drop:** move bookings between slots; UI reverts on 403/409 from server

### 3.3 Inspector (Right Panel)
- Slot details (capacity, remaining, unit, notes, blackout toggle)
- Quick actions: Edit • Duplicate • Blackout • Restrict • Delete (if empty)
- Bookings list for that slot with inline edit/cancel

### 3.4 Empty & Loading States
- Empty range → neutral message + CTAs (Bulk Create / Apply Template)
- **No client-side fabrication** of slots/cells

### 3.5 Accessibility & Productivity
- Keyboard shortcuts (Today, Next/Prev, Create)
- High contrast for blackouts and low remaining capacity
- Africa/Johannesburg time-zone awareness

---

## 4) Core Admin Workflows

### 4.1 Templates (Reusable Availability)
**Goal:** “Set & apply” hours/rules across a season or date range.

**Fields**
- Name, Description  
- Weekday availability blocks (e.g., Mon–Fri 06:00–18:00)  
- **Slot length** (minutes), **default capacity**, resource unit  
- **Cultivar windows** (e.g., Tue/Thu PM: Citrus only)  
- **Buffers** (pre/post in minutes) & **Advance notice** (minutes)  
- **Exceptions**: specific dates with overrides (holidays, partial hours)

**Behavior**
- **Apply Template to Range**: simulate → preview diff (create/update/skip) → publish  
- **Idempotent:** re-running the same template for the same range must not duplicate slots

### 4.2 Create Slots
- **Bulk Create** dialog: date range, weekdays, slot length, capacity, notes; preview → create
- **Draw-to-create** on Week/Day → quick create dialog → create

### 4.3 Edit Slot
- Capacity, notes, blackout toggle, resource unit
- Duplicate to another day/time
- Delete if **no confirmed bookings**

### 4.4 Blackouts
- Slot-level toggle  
- Day/Week blackout bulk op with note (e.g., maintenance)

### 4.5 Restrictions
- Apply on **slot/day/week**: allowed growers and/or cultivars; optional note
- Visual chips/badges show restriction scope

### 4.6 Bookings (Admin Overrides)
- **Create:** grower, optional cultivar, quantity → POST; shows 403/409 on violations
- **Move/Update:** drag to another slot or edit dialog → PATCH; revert on 403/409
- **Cancel:** confirm; optional reason

### 4.7 Find Next Available
- Server-side search across future slots that respect restrictions, capacity, and advance notice
- One-click “Book next available” for a chosen grower/cultivar

### 4.8 Preview & Publish
- For template applications and large bulk ops, show change list (create/update/skip) before committing

---

## 5) Data Model (Additions; no breaking changes)

> Existing: tenants, growers, cultivars, slots, slot_restrictions, bookings, domain_events, outbox.

### 5.1 `templates` (new)
- `id uuid PK`, `tenant_id uuid FK`, `name text`, `description text`
- `config jsonb` — weekday blocks, slot_length_min, default_capacity, resource_unit, cultivar_windows, buffers, advance_notice_min, exceptions[]
- `active_from date` (nullable), `active_to date` (nullable)  
- `created_by uuid`, `updated_at timestamptz`

**Minimal migration sketch**
```sql
-- 104_templates.sql
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  config jsonb NOT NULL,
  active_from date,
  active_to date,
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON templates(tenant_id);
```

### 5.2 (Optional) `template_runs` (audit/idempotency)
- Track preview/publish executions and deduplicate by `(tenant_id, template_id, start_date, end_date)`

---

## 6) API (Additions & Clarifications)

### 6.1 Templates
```
GET    /v1/admin/templates
POST   /v1/admin/templates
PATCH  /v1/admin/templates/{id}
DELETE /v1/admin/templates/{id}
POST   /v1/slots/apply-template   # { template_id, start_date, end_date, mode:'preview'|'publish' }
```
- **Preview** returns the delta (create/update/skip counts + sample items)
- **Publish** performs mutations; must be **idempotent**

### 6.2 Bookings (clarification)
```
PATCH /v1/bookings/{id}   # { slot_id?, quantity?, cultivar_id? }
```
- Enforce capacity (409) and restrictions (403); emits `BOOKING_UPDATED`

### 6.3 Existing (admin relies on these; unchanged)
```
GET   /v1/slots?start=YYYY-MM-DD&end=YYYY-MM-DD
POST  /v1/slots/bulk
PATCH /v1/slots/{id}
GET   /v1/slots/{id}/usage
GET   /v1/bookings?start=&end=&grower_id=
POST  /v1/bookings
DELETE /v1/bookings/{id}
POST  /v1/restrictions/apply
```

**Rules**
- **GETs are side-effect free** (no seeding on read)
- Booking create/move uses concurrency pattern; one success, second returns **409**
- Emit domain events (`BOOKING_CREATED/UPDATED/CANCELLED`) and outbox item on each mutation

---

## 7) Frontend Behavior (Contract)

- **Render only backend data**; never fabricate slots/cells client-side
- React Query keys include `tenantId + startISO + endISO (+filters)`
- Admin route is RBAC-guarded: `role === 'admin'`
- Time zone: **Africa/Johannesburg** for all range math & display
- Empty range → neutral empty state with CTAs (Bulk Create / Apply Template)
- Feature flags for rollout:
  - `VITE_FEATURE_ADMIN_TEMPLATES`
  - `VITE_FEATURE_NEXT_AVAILABLE`

---

## 8) Testing Requirements

### 8.1 Unit & Integration
- Booking concurrency: two parallel creates on same slot → one **201**, one **409**
- GET `/v1/slots` empty range → returns `[]`, does not write
- `PATCH /v1/bookings/{id}` enforces capacity & restrictions; emits event
- `apply-template` preview vs publish is **idempotent**; re-runs do not duplicate

### 8.2 E2E (Admin)
- Login (admin) → Month/Week/Day load without console errors
- Bulk Create → slots render; Edit capacity/blackout → reflected in usage
- Apply Restrictions → grower view respects rules
- Drag booking to full/restricted slot → UI reverts; toast shows 409/403
- Navigate month boundary (Aug↔Sep) → no phantom slots appear

### 8.3 E2E (Grower)
- Availability reflects admin rules; “next available” surfaces correct slot

---

## 9) Operational Notes

- **Performance:** debounce range fetches; virtualize large month views
- **Observability:** log template/apply operations with tenant, actor, counts (created/updated/skipped)
- **Idempotency:** `apply-template` must be safe to retry
- **Migrations:** sequential SQL in `/app/infra`, documented in `Blueprint.md` changelog

---

## 10) Security & Tenancy

- All operations scoped by `tenant_id` (backend enforcement)
- RBAC: only admins can create/edit slots, apply templates, manage restrictions
- Rate limiting & audit logs for bulk/template ops

---

## 11) Backward Compatibility & Rollout

- Keep v1 REST contracts; **add** endpoints where indicated
- Ship behind feature flags; default off for production until tests pass
- No changes required to grower APIs; grower UI behavior improves automatically once admin rules are applied

---

## 12) Delta vs Original `Blueprint.md` (Changes Only)

1. **Frontend Plan (§7)** — Add full **Admin Calendar** (Month/Week/Day), right-hand Inspector, **Preview & Publish** for bulk/template ops, **no client-side fabrication**, and **Next Available** finder.  
2. **API (§6)** — Add template CRUD and `POST /v1/slots/apply-template`; formalize `PATCH /v1/bookings/{id}` for move/update (keep 409/403 semantics).  
3. **Data Model (§4)** — Add `templates` (optional `template_runs`). No breaking changes.  
4. **Testing (§11)** — Add apply-template idempotency, admin preview/publish flows, and no-fabrication guarantees.  
5. **Security/Tenancy (§8)** — Clarify RBAC for admin routes and template operations.  
6. **DevEx** — React Query keys must include tenant + range (+filters); remove placeholder/keepPreviousData for Admin views.

_All other sections of `Blueprint.md` remain valid._

---

## 13) Acceptance Criteria (Admin Addendum)

- Admin can define templates, preview, and publish to a date range **without duplication**  
- Admin can create/edit/blackout/restrict slots; move/cancel bookings with correct 403/409 handling  
- Calendar renders **only backend data**; empty ranges show neutral CTAs  
- Tests pass for concurrency, template idempotency, and no-fabrication; grower view reflects rules

---

## 14) Changelog (for `Blueprint.md` reference)

- **2025-08-15** — Admin Addendum adopted (docs only). Code rollout to follow behind flags.

--- 

**End of Admin_Addendum.md**
