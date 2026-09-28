# Ammo / Non-Ammo Inventory & Request Flow — Design

**Date:** 2026-07-15
**Author:** Amit Yosefi
**Status:** Approved (design), pending implementation plan

---

## 1. Motivation

The current single `ammo` table is being outgrown. We need a clear separation between:

- Global stock (`מחסן`),
- Per-group inventories (7 non-ammo groups),
- Decrease requests raised by non-ammo users,
- An immutable audit log of every inventory movement.

We also need role-based UI: ammo users administer everything; non-ammo users see only their own group and can only submit decrease requests (which ammo users approve).

## 2. Roles

Roles are read from `PermissionsContext` and are **mutually exclusive** — a user has exactly one of:

- `ammo` — full admin (all 9 tabs)
- one of `א`, `ב`, `ג`, `מסייעת`, `אלון`, `מכלול`, `פלסם` — single-tab non-ammo user

Signature and display name are already cached in `permissions['signature']` and `permissions['name']` respectively; both are attached automatically to any submitted form.

A helper hook `useUserRole()` returns `{ kind: 'ammo' } | { kind: 'group', location }` derived from permissions. All tabs and forms use this rather than raw permission lookups.

## 3. Database Schema

### 3.1 Enums

```sql
CREATE TYPE location_enum AS ENUM (
  'א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם',  -- 7 non-ammo groups
  'מחסן'                                              -- global stock
);

CREATE TYPE צורך_enum AS ENUM ('ניפוק', 'בלאי', 'זיכוי', 'שצל');
CREATE TYPE נקרא_enum AS ENUM ('לא', 'כן');
CREATE TYPE request_status_enum AS ENUM ('ממתין', 'אושר', 'נדחה');

CREATE TYPE action_type_enum AS ENUM (
  'stock_add',
  'stock_remove',
  'sign_to_group',
  'decrease_from_group',
  'request_approved',
  'request_rejected'
);
```

### 3.2 Tables

**`items`** — canonical item catalog

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `name` | text UNIQUE NOT NULL | e.g. "Amit" |
| `is_explosion` | boolean NOT NULL | ball vs explosive; fixed per item |
| `created_at` | timestamptz DEFAULT now() | |

**`inventory`** — current state, one row per (item, location)

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `item_id` | bigint FK → items(id) | |
| `location` | location_enum NOT NULL | |
| `quantity` | int NOT NULL DEFAULT 0, CHECK (quantity >= 0) | DB-enforced non-negative |
| `updated_at` | timestamptz DEFAULT now() | |
| — | — | UNIQUE(item_id, location) |

**`requests`** — decrease requests from non-ammo users

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `requester_email` | text NOT NULL | |
| `requester_name` | text NOT NULL | from `permissions['name']` at submit |
| `requester_location` | location_enum NOT NULL | requester's group |
| `requester_signature` | text NOT NULL | data URL from `permissions['signature']` |
| `item_id` | bigint FK → items(id) NOT NULL | what the user asked for |
| `requested_quantity` | int NOT NULL, CHECK > 0 | |
| `approved_item_id` | bigint FK → items(id) NULLABLE | ammo user may swap item |
| `approved_quantity` | int NULLABLE, CHECK >= 0 | ammo user may adjust |
| `צורך` | צורך_enum NULLABLE | optional reason (ניפוק/בלאי/…) |
| `status` | request_status_enum NOT NULL DEFAULT 'ממתין' | |
| `נקרא` | נקרא_enum NOT NULL DEFAULT 'לא' | ammo user marks read |
| `handled_by` | text NULLABLE | approver email |
| `handled_at` | timestamptz NULLABLE | |
| `approver_name` | text NULLABLE | |
| `approver_signature` | text NULLABLE | |
| `notes` | text NULLABLE | |
| `created_at` | timestamptz DEFAULT now() | request time |

**`changes_log`** — immutable audit trail

| column | type | notes |
|---|---|---|
| `id` | bigint PK | |
| `action_type` | action_type_enum NOT NULL | |
| `item_id` | bigint FK → items(id) NOT NULL | |
| `from_location` | location_enum NULLABLE | e.g. `מחסן` for sign_to_group; group for a decrease |
| `to_location` | location_enum NULLABLE | e.g. group for sign_to_group; NULL for decreases |
| `delta` | int NOT NULL | signed |
| `quantity_after_from` | int NULLABLE | balance at from_location after op |
| `quantity_after_to` | int NULLABLE | balance at to_location after op |
| `actor_email` | text NOT NULL | |
| `actor_name` | text NOT NULL | |
| `actor_signature` | text NULLABLE | attached where available (sign_to_group, request approvals) |
| `related_request_id` | bigint FK → requests(id) NULLABLE | for request_approved / request_rejected |
| `note` | text NULLABLE | |
| `created_at` | timestamptz DEFAULT now() | |

### 3.3 RPC functions (Postgres, called from client via `supabase.rpc(...)`)

Every state-changing action is one RPC so inventory update + log insert happen in a single transaction.

- `stock_add(p_item_name, p_is_explosion, p_qty, p_actor_email, p_actor_name, p_actor_signature)`
  - Upsert `items` (insert if missing; validate `is_explosion` matches on hit).
  - `INSERT ... ON CONFLICT` on `inventory` to add qty at `('מחסן')`.
  - Insert `changes_log` row (`action_type='stock_add'`, `to_location='מחסן'`, `delta=+qty`).

- `stock_remove(p_item_id, p_qty, p_actor_email, p_actor_name, p_actor_signature, p_note)`
  - Decrement `inventory(item, 'מחסן')` by qty. CHECK blocks negatives.
  - Insert `changes_log` (`action_type='stock_remove'`, `from_location='מחסן'`, `delta=-qty`).

- `sign_to_group(p_item_id, p_location, p_qty, p_actor_email, p_actor_name, p_actor_signature)`
  - Decrement `inventory(item, 'מחסן')` by qty.
  - Upsert `inventory(item, p_location)` +qty.
  - Insert one `changes_log` row (`action_type='sign_to_group'`, `from_location='מחסן'`, `to_location=p_location`, `delta=+qty`, both `quantity_after_*` populated).

- `decrease_from_group(p_item_id, p_location, p_qty, p_actor_email, p_actor_name, p_actor_signature, p_note)`
  - Decrement `inventory(item, p_location)`. CHECK guards.
  - Log `action_type='decrease_from_group'`, `related_request_id=NULL`.

- `approve_request(p_request_id, p_approved_item_id, p_approved_quantity, p_actor_email, p_actor_name, p_actor_signature)`
  - **Concurrency guard:** `UPDATE requests SET status='אושר', נקרא='כן', ... WHERE id=p_request_id AND status='ממתין' RETURNING ...`. If no row updated → raise (another approver got there first).
  - Verify `inventory.quantity >= p_approved_quantity` at `(approved_item_id, requester_location)`, else raise.
  - Decrement inventory; insert `changes_log` (`action_type='request_approved'`, `from_location=requester_location`, `delta=-p_approved_quantity`, `related_request_id=p_request_id`).

- `reject_request(p_request_id, p_actor_email, p_actor_name, p_actor_signature, p_note)`
  - Same concurrency guard on `WHERE status='ממתין'`.
  - Mark rejected; log-only row (`delta=0`, `action_type='request_rejected'`).

- `mark_read(p_request_id)` — flips `נקרא='כן'`; no other effect.

### 3.4 Constraints summary

- `inventory.quantity >= 0` — CHECK constraint is the ultimate guard.
- `inventory` unique on `(item_id, location)`.
- `items.name` unique.
- `requests.requested_quantity > 0`; `approved_quantity >= 0` when set.
- Approve/reject RPCs use `WHERE status='ממתין'` for concurrency safety.

## 4. UI Structure

Uses the existing button-based tab pattern from `Ammo.tsx` (button per tab, `activeTab` state).

### 4.1 Ammo user — 9 tabs

Order (RTL right-to-left): `בקשות היום | מחסן | א | ב | ג | מסייעת | אלון | מכלול | פלסם`
Default active tab: **בקשות היום**.

**Group tabs** (one per group, same component `<GroupTab location=... />`):

- Header buttons: "החתמה ממחסן" (SignToGroupForm) and "הורדה ישירה" (DirectDecreaseForm).
- Current inventory — two side-by-side ag-grid tables (`is_explosion=false` and `is_explosion=true`). Columns: פריט, כמות.
- Pending requests grid (`status='ממתין'`, `location`). Row click → ApproveRequestModal. Tab badge shows pending count.
- Handled requests grid (collapsible; `status IN ('אושר','נדחה')`).
- Change log grid for this location.

**בקשות היום** tab:
- Aggregate ag-grid of all requests where `created_at::date = <selected>` (date picker, default today).
- Columns: time, group chip, requester name, item, requested qty, status, נקרא.
- Filters: group multi-select, status (default `ממתין`), נקרא (default `לא`).
- Row click → ApproveRequestModal.
- Bulk-select + "סמן כנקרא" bulk action.

**מחסן** tab:
- Header buttons: "הוספה למחסן" (StockAddForm), "הוצאה מהמחסן" (StockRemoveForm).
- Two ag-grid tables of stock (ball / explosive), rows where `location='מחסן'` and `quantity > 0`.
- Stock change log (rows with `from_location='מחסן'` OR `to_location='מחסן'`).

### 4.2 Non-ammo user — single tab

Their group tab, restricted:
- Inventory (read-only, two mini-tables).
- Primary CTA "בקשה להורדה" → RequestDecreaseForm.
- My requests panel (their own submissions, most recent first, status + נקרא badges).
- Group change log (same view as ammo).

### 4.3 Component / file layout

```
src/components/ammo/
  Ammo.tsx                       -- tab shell + role gating (kept, content replaced)
  tabs/
    GroupTab.tsx                 -- parameterized by location + mode ('ammo' | 'user')
    TodayRequestsTab.tsx
    StockTab.tsx
  panels/
    InventoryTables.tsx          -- shared ball + explosive mini-tables
    PendingRequestsGrid.tsx
    HandledRequestsGrid.tsx
    ChangeLogGrid.tsx
    MyRequestsGrid.tsx
  forms/
    RequestDecreaseForm.tsx
    ApproveRequestModal.tsx
    SignToGroupForm.tsx
    DirectDecreaseForm.tsx
    StockAddForm.tsx
    StockRemoveForm.tsx
  hooks/
    useUserRole.ts
    useInventory.ts
    useStockCatalog.ts
    useRequests.ts
    useMyRequests.ts
    useChangesLog.ts
    useInventoryActions.ts       -- wraps all RPCs as React Query mutations
```

Files deleted after cutover: `AmmoOrders.tsx`, `AmmoSum.tsx`, `AmmoDocumentation.tsx`, `AmmoFormModal.tsx`, `AmmoStock.tsx` and their imports.

## 5. Forms

All forms: react-hook-form + zod, Radix Dialog for modals. Every mutation invalidates the relevant React Query keys (see §6).

### 5.1 RequestDecreaseForm (non-ammo user)

- Item — Radix Select from `inventory` where `location=<my group>` AND `quantity > 0`. Option label: `<name> (זמין: <qty>)`.
- Quantity — number, `min=1`, `max=<selected item's current qty>` (zod refine).
- Notes — optional.
- On submit: plain `insert` into `requests` with `requester_email/name/location/signature` from context and `status='ממתין'`, `נקרא='לא'`. No inventory change.

### 5.2 ApproveRequestModal (ammo user)

**Read-only top panel:** requester name+email, requested item + qty, `created_at`, requester signature image.

**Editable:**
- Item — Radix Select from `inventory` where `location=requester_location` AND `quantity > 0` (default = originally requested item).
- Quantity — number, `min=1`, `max=<current qty at that location for selected item>` (recomputed when item changes).
- Notes — optional.

**Actions:**
- אישור → `approve_request(...)`. On success: request becomes `אושר` + `נקרא=כן`, inventory decrements, log row inserted with `related_request_id`.
- דחייה → `reject_request(...)`. Marks `נדחה` + `נקרא=כן`; log-only row; no inventory change.
- סגירה — close modal without changes.

Approver name and signature are attached from `permissions['name']` / `permissions['signature']` at submit time.

An external "סמן כנקרא" button on each row calls `mark_read` — flips `נקרא='כן'` without approving.

### 5.3 SignToGroupForm (ammo user, on group tab)

- Item — Radix Select from `inventory` where `location='מחסן'` AND `quantity > 0`.
- Quantity — number, `min=1`, `max=<stock qty for selected item>`.
- On submit: `sign_to_group(item_id, location=<this group>, qty, actor_*)`.

### 5.4 DirectDecreaseForm (ammo user, on group tab)

- Item — Radix Select from group inventory (qty > 0).
- Quantity — `min=1`, `max=<group qty>`.
- Note — optional but recommended.
- On submit: `decrease_from_group(item_id, location, qty, actor_*, note)`.

### 5.5 StockAddForm (ammo user, stock tab)

- Mode toggle: "פריט קיים" | "פריט חדש".
- Existing mode: item Radix Select from full `items` catalog (option shows current stock qty).
- New mode: name (text, unique against catalog), `is_explosion` toggle.
- Quantity — positive int.
- On submit: `stock_add(...)`.

### 5.6 StockRemoveForm (ammo user, stock tab)

- Item — Radix Select from stock (qty > 0).
- Quantity — `min=1`, `max=<stock qty>`.
- Note — optional.
- On submit: `stock_remove(...)`.

## 6. Data flow — React Query keys & invalidation

| Hook | Query key |
|---|---|
| `useInventory(location)` | `['inventory', location]` |
| `useStockCatalog()` | `['items']` |
| `useRequests({ location?, statuses?, date?, נקרא? })` | `['requests', filters]` |
| `useMyRequests(email)` | `['my-requests', email]` |
| `useChangesLog({ location?, action_types? })` | `['changes-log', filters]` |

**Mutation → invalidation:**

| RPC | Invalidates |
|---|---|
| `stock_add` | `['inventory', 'מחסן']`, `['items']`, `['changes-log']` |
| `stock_remove` | `['inventory', 'מחסן']`, `['changes-log']` |
| `sign_to_group` | `['inventory', 'מחסן']`, `['inventory', <group>]`, `['changes-log']` |
| `decrease_from_group` | `['inventory', <group>]`, `['changes-log']` |
| `approve_request` | `['requests', ...]`, `['my-requests', ...]`, `['inventory', <group>]`, `['changes-log']` |
| `reject_request` | `['requests', ...]`, `['my-requests', ...]`, `['changes-log']` |
| `mark_read` | `['requests', ...]` |
| create-request (client-side insert) | `['requests', ...]`, `['my-requests', ...]` |

## 7. Migration & rollout

1. Create new tables, enums, and RPC functions in a fresh Supabase migration. Leave old `ammo` table untouched.
2. **No backfill** — start clean. The ammo team will re-add current stock via the new StockAddForm.
3. Build and ship the new components (§4.3). Delete the retired files (`AmmoOrders`, `AmmoSum`, `AmmoDocumentation`, `AmmoFormModal`, `AmmoStock`).
4. After a burn-in period during which no one needs legacy views, `DROP TABLE ammo` (or leave it read-only forever — cheap).

## 8. Verification

No unit-test setup exists in the repo. Bar for this feature:

**RPC-level (SQL test script):**
- `stock_remove` below zero → rollback, no log row.
- `sign_to_group` moves qty and produces exactly one log row with both `quantity_after_*` correct.
- `approve_request` on an already-approved request → raise (concurrency guard).
- `approve_request` where `approved_quantity > current inventory` → raise, no changes.

**Manual UI walkthrough per role (checklist run in dev server before merge):**
- **Ammo user:** add stock (new + existing item), sign to group, non-ammo submits request, ammo approves with quantity edit, verify inventory + log + `נקרא`. Reject a request. Direct-decrease. Stock-remove.
- **Non-ammo user:** sees only their group; cannot see other groups' tabs or requests; item dropdown excludes qty=0 items; qty field clamps to available.

**Concurrency spot-check:** two ammo user tabs approve the same pending request — second should fail with a clean error toast.

## 9. Out of scope

- Row-Level Security policies (client trust for now; can be added later without schema changes).
- Backfill from `ammo` table.
- Mobile-specific redesign (existing responsive patterns apply).
- Historical export of legacy `ammo` data.
- Bulk approve/reject.

## 10. Open follow-ups (post-implementation)

- Add RLS once we have Supabase auth linked to permissions.
- Consider a "Signed X to group" bulk operation if the ammo user routinely signs many items at once.
