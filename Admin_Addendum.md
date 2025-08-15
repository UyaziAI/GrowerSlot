# Admin Addendum — Calendar Management Blueprint (v1.1)
_Last updated: 2025-08-15 • Owner: Admin Platform_

> This addendum defines the **authoritative blueprint** for the Admin calendar experience. It augments the project’s original **BLUEPRINT.md** and governs design, behavior, API contracts, validation, and rollout for the Admin page. Where conflicts exist, **this addendum wins** and a Delta entry must be added to BLUEPRINT.md.

---

## 1) Purpose & scope
- Deliver a single, intuitive **Admin calendar** used by packhouses to manage delivery slots.
- Views: **Month (default)**, **Week**, **Day** — all days visible, even when empty (no fabricated slots).
- Core actions: **Create slots (day/range)**, **Blackout (day/selected)**, **Apply Restrictions (day/selected/slot)**, **Edit slot**, **Delete empty slots**, **Duplicate from day/template**, **Export**.
- Mobile parity: bottom sheets and selection mode.

## 2) Personas & permissions
- **Admin** (packhouse staff): full CRUD on slots, blackout, restrictions, templates, exports.
- **Grower**: read-only calendar (availability), create/manage **their** bookings only; cannot modify slots/blackouts/restrictions.
- **Auditor**: read-only plus access to audit logs.

## 3) UX principles
1. **Calendar-first**: show all days; never fabricate data in the grid.  
2. **Do-in-place**: act from the day itself (peek → editor).  
3. **Scoped labels**: always name the scope (e.g., “Blackout — Day”, “Create Slots — Range”).  
4. **Predictable errors**: server returns clear 4xx; UI shows that string verbatim.  
5. **Performance**: windowed month/week; stable caching; no redundant POSTs on scroll.

## 4) UI architecture
### 4.1 Global toolbar (always visible)
- **Left**: view switch `Month | Week | Day`
- **Center**: date nav `‹ › | Today | Date picker`
- **Right**: **Create ▾** (Create Slots — Day, Bulk Create Slots, Apply Template), **More ▾** (Export CSV, Filters…, Help)

### 4.2 Calendar canvas
- **Month**: 6×7 = **42 cells**; badges for Booked/Remaining; icons: ⛔ Blackout, 🔒 Restricted.  
- **Week**: 7 columns; thin time ribbons for existing slots (no placeholders).  
- **Day**: vertical timeline; **draw-to-create** (desktop) or **FAB + time picker** (mobile).

### 4.3 Day Peek (popover / bottom sheet)
- Shows summary + actions: **Create Slots — Day**, **Blackout Day**, **Restrict Day**
- Links: **Open Day view**, **Edit Day →**

### 4.4 Day Editor (right drawer / full-height on mobile)
- **Overview**: date, blackout toggle, restriction chips, remaining/booked  
- **Quick create**: `slot_length_min`, `capacity`, `notes` → **Create slot**  
- **Restrictions**: add/remove growers/cultivars (day scope)  
- **Utilities**: Duplicate from…, Delete empty slots, Blackout Day

### 4.5 Selection mode + Bulk bar (Month/Week)
- Toggle **Select days** → tap to select (checkmarks).  
- **Bulk actions**: Create Slots — Range • Blackout — Selected • Apply Restrictions — Selected • Duplicate From… • Done

### 4.6 Slot sheet (Day view)
- Shows capacity, remaining, notes, blackout toggle, restrict, delete (if empty).

### 4.7 Empty state & metrics
- Empty state: “No slots in this period” with CTAs **Create Slots — Day** / **Create Slots — Range**, plus **Apply Template**.  
- Replace large stat cards with compact **chips** (Total, Available, Booked, Blackout) — collapsible.

## 5) Interaction rules
- **Click/tap day** → Day Peek; **double-click/Enter** (desktop) or **Edit Day** (mobile) → Day Editor.  
- **Long-press (350ms) mobile** → open Day Editor (optional; button remains primary).  
- **Keyboard**: arrows move focus; `Enter` opens editor; `Space` jumps to Day view.  
- **Selection mode** only in Month/Week; Day view is single-day.

## 6) Validation & business rules
- **No past dates**: UI `min=today` (Africa/Johannesburg); server rejects with **422** `{ "error": "start_date cannot be in the past" }`.  
- **Range**: `end_date >= start_date`; else **422** `{ "error": "end_date must be on or after start_date" }`.  
- **Weekdays**: ISO weekdays `1..7`; cannot be empty.  
- **Capacity**: integer `> 0`; **slot_length_min** `1..1440`.  
- **Blackout**: a blacked-out day/slot cannot accept bookings (409 if attempted).  
- **Restrictions**: allow lists by grower/cultivar; enforced at booking create/update.  
- **Idempotency**: bulk create idempotent for same parameters.

## 7) API contracts (all under `/v1`)
All error responses:
```json
{ "error": "human readable reason" }
```

### 7.1 Slots
- **GET** `/v1/slots?start=YYYY-MM-DD&end=YYYY-MM-DD` — list slots in range (tenant-scoped)  
- **POST** `/v1/slots/bulk`
```json
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "weekdays": [1,2,3],
  "slot_length_min": 60,
  "capacity": 20,
  "notes": "optional"
}
```
- **PATCH** `/v1/slots/<built-in function id>` (capacity, notes)  
- **PATCH** `/v1/slots/<built-in function id>/blackout`  `{ "blackout": true|false }`  
- **POST** `/v1/slots/blackout`  `{ "dates": ["YYYY-MM-DD", ...] }` (bulk by day)

### 7.2 Restrictions
- **POST** `/v1/restrictions/apply`
```json
{
  "scope": "day|slot|range",
  "dates": ["YYYY-MM-DD"],    // for day|range
  "slot_id": "UUID",          // for slot
  "allow_growers": ["id"...], // optional
  "allow_cultivars": ["id"...]// optional
}
```

### 7.3 Templates (feature-flagged)
- **GET** `/v1/templates`  
- **POST** `/v1/templates` (CRUD)  
- **POST** `/v1/slots/apply-template`  
  `{ "template_id": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "publish": true }`

### 7.4 Bookings (admin-relevant)
- **PATCH** `/v1/bookings/<built-in function id>` (status/cancel)  
- **DELETE** `/v1/bookings/<built-in function id>`

### 7.5 Exports
- **GET** `/v1/exports/bookings.csv` (streaming CSV; stable header order)  
- **GET** `/v1/exports/calendar.ics?token=SECRET&view=slots|bookings&start=YYYY-MM-DD&end=YYYY-MM-DD` (tenant read-only ICS feed)

## 8) Data model additions
- **`domain_events`** — `id, tenant_id, type, payload jsonb, occurred_at`  
- **`outbox`** — `id, tenant_id, event_id, status, attempt_count, next_attempt_at`  
- **`audit_log`** — `id, tenant_id, actor_id, action, payload_summary jsonb, created_at`  
- **(Future P2/P3)** calendar sync scaffolding:  
  - `calendar_integrations(id, tenant_id, provider, calendar_id, auth_blob, created_at)`  
  - `calendar_event_map(id, tenant_id, slot_id?, booking_id?, provider, provider_event_id, etag, last_synced_at)`

**Event types (must emit):**  
`SLOTS_BULK_CREATED`, `SLOT_UPDATED`, `SLOTS_BLACKED_OUT`, `TEMPLATE_APPLIED`, `BOOKING_UPDATED`

## 9) Feature flags (defaults)
- `VITE_FEATURE_ADMIN_TEMPLATES=false` — gates Templates drawer + Apply Template.  
- `VITE_FEATURE_NEXT_AVAILABLE=false` — gates “Next available” finder (Grower UI).

## 10) Performance & integrity
- **No fabrication**: only render what `GET /v1/slots` returns.  
- **Caching** (TanStack Query): keys `['slots', tenantId, startISO, endISO]`, `staleTime: 15_000`, `gcTime: 300_000`.  
- **Virtualization**: window Month/Week rows.  
- **Idempotent** POSTs: client dedupe; server upsert (date,time,resource).

## 11) Accessibility & mobile
- Day cells have accessible names: “Fri 15 Aug — Slots: X, Remaining: Y, Blackout/Restricted”.  
- Bottom sheets dismiss with swipe/close; keyboard reachable; hit targets ≥ 44×44pt.

## 12) Security & tenancy
- All endpoints tenant-scoped; enforce `tenant_id` on read/write.  
- ICS `token` is per-tenant secret; rotation: **POST** `/v1/admin/calendar-token/rotate`.  
- OAuth secrets encrypted at rest (future).  
- **Audit logging** for every admin mutation.

## 13) Rollout & flags
- **Stage → UAT → Prod** with flags default **off**.  
- Release checklist covers: Bulk create → Blackout → Restrictions → Day editor quick create → Slot blackout toggle → Export CSV.

## 14) Acceptance criteria (V1)
1. Month view renders **42** cells; Week/Day render with no placeholders.  
2. Day click opens **Day Peek**; “Edit Day” opens **Day Editor**.  
3. Selection mode shows **Bulk bar** and executes blackout/restrict/create range.  
4. Create dialogs block past dates and display **422** messages verbatim.  
5. All Admin actions emit domain events + audit logs.  
6. Frontend uses **/v1** only; no `/api`.  
7. No fabricated slots; only backend data is rendered.  
8. Export CSV returns expected headers and order.

## 15) Delta vs original BLUEPRINT.md (what changed)
- **UI consolidation**: removed legacy header buttons; added **Create ▾ / More ▾**; destructive actions live in **context (day/slot)**.  
- **Interaction model**: added **Day Peek**, **Day Editor**, **Selection mode + Bulk bar**, **Slot sheet**, mobile patterns.  
- **Validation**: codified 422 messages; client `min=today`.  
- **API**: standardized `/v1/*`; added `POST /v1/slots/blackout`, `PATCH /v1/slots/<built-in function id>/blackout`, ICS export.  
- **Data model**: documented `audit_log` with `domain_events` + `outbox`; listed sync scaffolding.  
- **Flags**: declared defaults for `VITE_FEATURE_ADMIN_TEMPLATES`, `VITE_FEATURE_NEXT_AVAILABLE`.  
- **Performance**: windowing + query caching requirements.  
- **Testing**: required behaviour tests for peek/editor/bulk + 422 surfacing.

## 16) Inspiration references
- **Google Calendar** (Month ↔ Week ↔ Day nav; peek/edit)  
- **Microsoft Outlook Calendar** (meeting peek, inline edits)  
- **FullCalendar** (time-grid interactions, selection model)  
- **Linear** (bulk selection & action bar pattern)  
- **Notion Calendar** (clean month cell design)

## 17) Changelog template
- `YYYY-MM-DD` — “Admin Addendum v1.1 adopted: toolbar consolidation, Day Peek/Editor, bulk actions, /v1 endpoints, audit trail requirements, ICS export defined.”

---

### Governance note
Every change that affects Admin UI must: reference `rules.md`, update **BLUEPRINT.md Delta** + **FEATURES.md** status + **ISSUES.md** tracking, and add a **changelog line**.
