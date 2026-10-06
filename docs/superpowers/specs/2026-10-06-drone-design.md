# רחפנים (Drones) — Design

**Date:** 2026-10-06
**Branch:** `evo_avatar`
**Status:** awaiting review

## Purpose

Track the battalion's two drone models — **EVO** (Autel EVO Max) and **AVATA** (DJI Avata) —
as signable kits. A drone is signed out to one soldier, carries a list of equipment items at
specific quantities, and every movement of those items is documented.

A גדוד-level pool holds the real stock. Signing a drone draws its items out of that pool;
deleting a drone returns them. The pool can never go negative.

### Success criteria

- A drone handler can see, per company, which drones of each model that company holds, who
  holds each one (name + personal number), and the quantity of every item on it.
- Signing, deleting, reassigning, and quantity edits all move גדוד stock correctly and
  leave an audit row behind.
- The גדוד tab shows the live stock per model and can be restocked a kit at a time.
- Nothing can drive a גדוד item quantity below zero.

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Item storage | `items` JSONB column on the `drone` row. **No** `drone_items` table. |
| Table count | Two: `drone` and `drone_document`. |
| Stock semantics | גדוד is real base stock. Signing draws down, deleting returns, never below zero. |
| Stock scoping | Separate pool per drone model, keyed by `drone_type`. |
| Drone identity | Serial number (`מספר סידורי`) **required** on every signed drone. |
| Tabs | 7 companies + גדוד + סיכום + תיעוד (no שצל). |
| Charger kits | Merged into each model's default JSON. |
| Quantity edits | Move stock to/from גדוד; rejected when גדוד is short. |
| Reassignment | Allowed in place, restricted to people in the same `sheet_range`. |
| Restocking | Kit-based form on the גדוד tab, defaults from JSON, each quantity editable. |
| Permission key | `permissions['רחפנים']` — the Hebrew name, as stored. |
| Admin | Sees the section, **read-only** — every write requires `permissions['רחפנים']`. |
| Type chooser | Company tabs only; גדוד and סיכום show both models at once. |

### Assumptions flagged for review

1. **One גדוד row per model.** Stock lives as exactly two rows in `drone` with
   `location = 'גדוד'` (one EVO, one AVATA), whose `items` JSONB holds the per-item total.
   Not one row per item.
2. **`ברגים` quantity is 4**, read off the four screws in `avata.png`.
3. **`(זוג)` dropped from item names.** `מסגרות למשקפיים (זוג)` becomes
   `מסגרות למשקפיים` at quantity 2 — keeping both would read as "2 pairs".

### Tradeoff accepted

With quantities inside JSONB, the never-negative rule cannot be a `CHECK` constraint. It is
enforced inside `_drone_jsonb_merge_add`, which raises when a subtraction would go below zero.
Every write path goes through that helper, and the stock row is taken `FOR UPDATE` first, so
concurrent signings serialize rather than oversell. The guarantee lives in the function layer
rather than the schema.

## Data model

Two kinds of row share the `drone` table, distinguished by `location`:

| | `location` | `items` means | `serial` / `sheet_range` / `holder_name` |
|---|---|---|---|
| stock (exactly 2 rows) | `'גדוד'` | total on hand per item | `NULL` |
| signed drone (many) | `people.id` as text | that drone's quantities | required |

`location` is `TEXT` because it holds either a numeric `people.id` or the literal `'גדוד'`.
`people.id` is `BIGINT` (the soldier's personal number); `permissions['id']` is used
stringified elsewhere in the app, so actor columns are `TEXT`.

`drone_document` carries **no foreign key** to `drone` — the history of a deleted drone must
outlive the row.

## Default item lists

Read off the four committed images: `evo.png`, `avata.png`, `evo_charger.png`,
`avata_charger.png`. These are defaults only — every quantity is editable in both the signing
form and the restock form.

### `src/assets/avata.json` — 22 items

```json
{
  "רחפן DJI Avata": 1,
  "סוללה חכמה לרחפן": 1,
  "משקפי DJI Goggles 2": 1,
  "ספק כוח": 1,
  "כבל Type-C ל-Type-C": 1,
  "בקר שליטה DJI RC Motion 2": 1,
  "מגן גימבל": 1,
  "פרופלורים": 2,
  "מסגרות למשקפיים": 2,
  "אנטנות למשקפיים": 2,
  "סרט ראש למשקפיים": 1,
  "כבל חשמל למשקפיים": 1,
  "סוללה למשקפי Goggles 2": 1,
  "כבל OTG": 1,
  "עדשות מגן": 2,
  "מגן מסך משקפיים": 1,
  "רצועת נשיאה לשלט": 1,
  "מברג": 1,
  "ברגים": 4,
  "מטען טורי מרובע": 1,
  "סוללות AVATA": 2,
  "כבל USB TYPE-C ל TYPE-A": 1
}
```

### `src/assets/evo.json` — 19 items

```json
{
  "רחפן": 1,
  "שלט": 1,
  "אנטנות לשלט": 2,
  "סוללה לרחפן": 1,
  "רתמה לשלט": 1,
  "כבל TYPE-C ל TYPE-C": 1,
  "מגן גימבל": 1,
  "סטיקים לשלט": 2,
  "מגן לשלט": 1,
  "כבל TYPE-C ל USB-A": 1,
  "מזוודה קשיחה": 1,
  "כרטיס זיכרון": 1,
  "שנאי לטעינת סוללה": 1,
  "מטען לשלט": 1,
  "כבל חשמל לשנאי": 1,
  "מברג": 1,
  "פרופלורים": 2,
  "מטען משולש": 1,
  "כבל חשמל דו פיני": 1
}
```

Note that `מגן גימבל`, `פרופלורים` and `מברג` appear in **both** lists. Because stock is keyed
`(drone_type, item_name)`, an EVO gimbal guard is counted separately from an AVATA one.

## Operations

All writes are SQL RPCs. Each moves stock and writes its audit rows in one transaction,
following the existing `sign_to_group` / `transfer_inventory` pattern in
`supabase/migrations/2026-07-16-gadud-batch.sql`.

| RPC | Effect on גדוד | Audit action |
|---|---|---|
| `drone_stock_change(type, items, +1)` | adds a kit | `stock_add` (row per item) |
| `drone_stock_change(type, items, -1)` | removes | `stock_remove` (row per item) |
| `sign_drone(...)` | draws down; raises if short | `drone_signed` (one row, items snapshot) |
| `delete_drone(id)` | returns all its items | `drone_deleted` (one row, items snapshot) |
| `set_drone_item_qty(id, item, qty)` | moves only the difference | `item_qty_changed` |
| `change_drone_holder(id, holder)` | no change | `holder_changed` |

Read RPCs, each returning JSONB: `get_drone_sheet_data(sheet)`, `get_drone_gadud_data()`,
`get_drone_sum_data()`, `get_drone_document(limit)`.

`get_drone_sheet_data` also returns the `people` list for that company and both גדוד stock
rows, so the signing and reassignment dropdowns need no second round trip and the signing
form can show what is available in גדוד beside each quantity input.

### Items at quantity zero

`sign_drone` strips zero-quantity entries before storing, so a drone signed without, say, a
`מזוודה קשיחה` has no such key in its `items` JSONB at all. The UI must therefore render the
**union of the model's JSON keys and the row's `items` keys**, showing a missing or zero key
as a `0` input rather than hiding the row. Without this, an item signed at 0 would vanish
from the card and could never be raised later. `set_drone_item_qty` already handles the
absent-key case — `jsonb_set(..., create_if_missing => true)` with a `v_old` of 0 — so no SQL
change is needed, only the rendering rule.

The same union rule applies to the גדוד and סיכום tables, so the full catalogue of a model is
always visible even when an item's stock is 0.

## UI

New package `src/components/drone/`, mirroring the layout of `src/components/ammo/`.

```
src/components/drone/
  types/index.ts              DroneType, DroneRow, DroneDocumentRow, tab payloads
  hooks/useDroneData.ts       react-query reads (4 query hooks + key factories)
  hooks/useDroneActions.ts    mutations, each invalidating the affected keys
  hooks/useDronePermissions.ts the only place the two permission keys are read
  DroneTypeCards.tsx          the two square selection cards
  DroneCard.tsx               one signed drone: holder, serial, editable item list
  tabs/DroneSheetTab.tsx      a company tab
  tabs/DroneGadudTab.tsx      גדוד stock, one table per model
  tabs/DroneSumTab.tsx        סיכום, one table per model
  DroneDocumentation.tsx      תיעוד log
  forms/SignDroneForm.tsx     החתמת רחפן
  forms/StockKitForm.tsx      הוספת / הוצאת מלאי, kit-based
  forms/ChangeHolderForm.tsx  העברת חתימה
```

### Company tab

Opens on two square cards built from `evo.png` / `avata.png`, each badged with how many of
that model the company holds. Selecting one reveals that model's drones plus a
`החתמת רחפן` button and a back link to the cards.

Each `DroneCard` shows the serial, the holder's name and personal number, and a compact
item list of number inputs. Changing an input commits via `set_drone_item_qty` on blur, and
rolls back with an error message if גדוד is short. Card actions: `העברת חתימה`,
`מחיקת רחפן` (confirm dialog naming the serial and warning that items return to גדוד).

### גדוד tab

One table per model — `שם פריט | כמות` — with `+ הוספת מלאי` and `- הוצאת מלאי`. Both open
`StockKitForm`, pre-filled from that model's JSON with every quantity editable, so a whole
kit is added or removed in one action. No type chooser.

### סיכום tab

One table per model: `שם פריט | בחתימה | גדוד | סה"כ`, where `בחתימה` sums the item across
every signed drone of that model. Below each table, the list of that model's signed drones
with serial, holder and company.

### תיעוד tab

`drone_document` newest first, rendered with ag-grid as the other documentation tabs are.

## Wiring into the existing app

### `src/constants/index.tsx`

Insert after `ammo`:

```ts
{
  pathName: 'drone',
  name: 'רחפנים',
  permissionKey: 'רחפנים',
  sheets: [
    { name: 'פלוגה א', range: 'א', id: 0 },
    { name: 'פלוגה ב', range: 'ב', id: 1 },
    { name: 'פלוגה ג', range: 'ג', id: 2 },
    { name: 'פלוגת מסייעת', range: 'מסייעת', id: 3 },
    { name: 'פלוגת אלון', range: 'אלון', id: 4 },
    { name: 'פלוגת מכלול', range: 'מכלול', id: 5 },
    { name: 'פלוגת פלסם', range: 'פלסם', id: 6 },
    { name: 'גדוד', range: 'גדוד', id: 7 },
    { name: 'סיכום', range: 'סיכום', id: 8 },
    { name: 'תיעוד', range: 'תיעוד', id: 9 }
  ]
}
```

### `src/types/index.ts`

Add `permissionKey?: string` to `SheetGroup`. Existing groups keep using `pathName` as the
key, so nothing else changes; `drone` is the first group whose URL path and permission key
differ.

### `src/components/route/DivideComponentSections.tsx`

The route path the drone section needs is the existing `/:groupName/:tabIndex` — no new
`App.tsx` route. Add a `groupIndex === 3` branch:

```tsx
{groupIndex === 3 && (
    selectedSheet.range === 'גדוד' ? <DroneGadudTab />
  : selectedSheet.range === 'סיכום' ? <DroneSumTab />
  : selectedSheet.range === 'תיעוד' ? <DroneDocumentation />
  : <DroneSheetTab sheetRange={selectedSheet.range} />
)}
```

**Two consequences that must be handled in the same change:**

1. **Renumber the groups below.** Inserting `drone` at index 3 shifts `hr` to 4 and `15a` to
   5. The existing `groupIndex === 3` (HrPermission) and `groupIndex === 4` (A15) branches
   must become 4 and 5.
2. **`whichSection()` needs a `'רחפנים'` case.** It switches on `currentGroup.name` and ends
   in `default: return 'ammo'`, so the drone group would otherwise be gated on the *ammo*
   permission. Add `case 'רחפנים': return 'רחפנים'`.

### Permissions — the existing gates leak

Both navigation gates are generic and would expose רחפנים to users who only hold a company
permission:

- `GroupNavigation.hasGroupAccess` returns `true` when the user holds **any** company
  permission (`hasCompanyPermission`), for **every** group.
- `TabsNavigation` shows a tab whenever `permissions[sheet.range]` matches, so a פלוגה א user
  would get the א tab inside רחפנים.

Required changes:

- `GroupNavigation.hasGroupAccess`: resolve the key as
  `permissions[group.permissionKey ?? group.pathName]`, and exempt groups that declare a
  `permissionKey` from the `hasCompanyPermission` fallback — so רחפנים appears only for
  `permissions['רחפנים']` or `permissions['admin']`.
- `TabsNavigation`: when `section === 'רחפנים'`, require `permissions['רחפנים'] ||
  permissions['admin']` rather than per-sheet keys.
- Each drone tab renders `אין לך הרשאה לצפות בנתונים אלה` unless
  `permissions['רחפנים'] || permissions['admin']`, so a hand-typed URL is blocked too.

#### Read vs. write

Viewing requires `permissions['רחפנים'] || permissions['admin']`. **Every write requires
`permissions['רחפנים']` alone — `admin` is read-only here.**

A single `useDronePermissions()` hook in `hooks/` returns `{ canView, canEdit }` and is the
only place the two keys are read, so the rule is stated once:

```ts
const canView = !!(permissions['רחפנים'] || permissions['admin']);
const canEdit = !!permissions['רחפנים'];
```

`canEdit === false` must hide — not merely disable — `החתמת רחפן`, `העברת חתימה`,
`מחיקת רחפן`, and both גדוד stock buttons, and must render every item quantity as static
text instead of a number input. An admin viewing the section sees the same data with no
affordance to change it.

This is UI-level only. The RPCs are reachable by any authenticated client, so the
restriction is not a security boundary — consistent with how the rest of this app gates by
permission in the client.

### `AdminPage.tsx`

`'רחפנים'` must join the `otherPermissions` arrays at lines 230, 333 and 766 so the
permission is grantable from the admin screen.

## SQL migration

To be saved as `supabase/migrations/2026-10-06-drone.sql` and run in the Supabase SQL editor.
Safe to re-run.

```sql
-- =====================================================================
-- 2026-10-06: רחפנים (drones) — stock, signed drones, audit trail
-- Run in the Supabase SQL editor. Safe to re-run.
-- =====================================================================

-- 1. Enums ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE drone_type_enum AS ENUM ('EVO', 'AVATA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE drone_action_enum AS ENUM (
    'stock_add', 'stock_remove', 'drone_signed', 'drone_deleted',
    'item_qty_changed', 'holder_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. drone — stock rows (location='גדוד') and signed drones ----------
CREATE TABLE IF NOT EXISTS drone (
  id             BIGSERIAL PRIMARY KEY,
  drone_type     drone_type_enum NOT NULL,
  location       TEXT NOT NULL,                    -- people.id::text | 'גדוד'
  items          JSONB NOT NULL DEFAULT '{}'::jsonb,
  serial         TEXT,
  sheet_range    TEXT,
  holder_name    TEXT,
  signed_by_id   TEXT,
  signed_by_name TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drone_signed_fields CHECK (
    location = 'גדוד'
    OR (serial IS NOT NULL AND sheet_range IS NOT NULL AND holder_name IS NOT NULL)
  )
);

-- exactly one stock row per model
CREATE UNIQUE INDEX IF NOT EXISTS drone_gadud_one_per_type
  ON drone(drone_type) WHERE location = 'גדוד';
-- serial unique among signed drones of a model
CREATE UNIQUE INDEX IF NOT EXISTS drone_serial_unique
  ON drone(drone_type, serial) WHERE location <> 'גדוד';
CREATE INDEX IF NOT EXISTS idx_drone_sheet
  ON drone(sheet_range, drone_type) WHERE location <> 'גדוד';

-- 3. drone_document — audit trail (no FK: history outlives the drone)
CREATE TABLE IF NOT EXISTS drone_document (
  id               BIGSERIAL PRIMARY KEY,
  action_type      drone_action_enum NOT NULL,
  drone_id         BIGINT,
  drone_type       drone_type_enum NOT NULL,
  serial           TEXT,
  sheet_range      TEXT,
  item_name        TEXT,
  delta            INT,
  quantity_before  INT,
  quantity_after   INT,
  items            JSONB,
  holder_id        TEXT,
  holder_name      TEXT,
  prev_holder_id   TEXT,
  prev_holder_name TEXT,
  actor_id         TEXT,
  actor_name       TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drone_document_created
  ON drone_document(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drone_document_drone
  ON drone_document(drone_id);

-- 4. Seed the two גדוד stock rows ------------------------------------
INSERT INTO drone (drone_type, location, items)
SELECT v.t, 'גדוד', '{}'::jsonb
  FROM (VALUES ('EVO'::drone_type_enum), ('AVATA'::drone_type_enum)) v(t)
 WHERE NOT EXISTS (
   SELECT 1 FROM drone d WHERE d.location = 'גדוד' AND d.drone_type = v.t
 );

-- 5. Helper: add/subtract an item map, refusing to go below zero -----
CREATE OR REPLACE FUNCTION _drone_jsonb_merge_add(
  a JSONB, b JSONB, p_sign INT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE k TEXT; v INT; res JSONB := COALESCE(a, '{}'::jsonb); cur INT; nv INT;
BEGIN
  FOR k, v IN SELECT key, (value #>> '{}')::int FROM jsonb_each(COALESCE(b, '{}'::jsonb)) LOOP
    cur := COALESCE((res #>> ARRAY[k])::int, 0);
    nv  := cur + (p_sign * v);
    IF nv < 0 THEN
      RAISE EXCEPTION 'אין מספיק מלאי בגדוד עבור "%": קיים %, נדרש %', k, cur, v;
    END IF;
    res := jsonb_set(res, ARRAY[k], to_jsonb(nv), true);
  END LOOP;
  RETURN res;
END; $$;

-- 6. Stock add / remove (kit-based) ----------------------------------
CREATE OR REPLACE FUNCTION drone_stock_change(
  p_drone_type drone_type_enum,
  p_items      JSONB,
  p_sign       INT,                    -- +1 add, -1 remove
  p_actor_id   TEXT,
  p_actor_name TEXT,
  p_note       TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_before JSONB; v_after JSONB; k TEXT; v INT;
BEGIN
  IF p_sign NOT IN (1, -1) THEN RAISE EXCEPTION 'p_sign must be 1 or -1'; END IF;

  SELECT id, items INTO v_id, v_before
    FROM drone WHERE location = 'גדוד' AND drone_type = p_drone_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'שורת מלאי גדוד חסרה עבור %', p_drone_type; END IF;

  v_after := _drone_jsonb_merge_add(v_before, p_items, p_sign);
  UPDATE drone SET items = v_after, updated_at = now() WHERE id = v_id;

  FOR k, v IN SELECT key, (value #>> '{}')::int FROM jsonb_each(COALESCE(p_items, '{}'::jsonb)) LOOP
    IF v <> 0 THEN
      INSERT INTO drone_document (
        action_type, drone_id, drone_type, item_name,
        delta, quantity_before, quantity_after, actor_id, actor_name, note
      ) VALUES (
        CASE WHEN p_sign > 0 THEN 'stock_add' ELSE 'stock_remove' END,
        v_id, p_drone_type, k, p_sign * v,
        COALESCE((v_before #>> ARRAY[k])::int, 0), (v_after #>> ARRAY[k])::int,
        p_actor_id, p_actor_name, p_note
      );
    END IF;
  END LOOP;
END; $$;

-- 7. Sign a drone -----------------------------------------------------
CREATE OR REPLACE FUNCTION sign_drone(
  p_drone_type  drone_type_enum,
  p_serial      TEXT,
  p_sheet_range TEXT,
  p_holder_id   TEXT,
  p_holder_name TEXT,
  p_items       JSONB,
  p_actor_id    TEXT,
  p_actor_name  TEXT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_stock_id BIGINT; v_before JSONB; v_after JSONB;
        v_new_id BIGINT; v_clean JSONB;
BEGIN
  IF p_serial IS NULL OR btrim(p_serial) = '' THEN
    RAISE EXCEPTION 'חובה להזין מספר סידורי';
  END IF;
  IF p_holder_id IS NULL OR btrim(p_holder_id) = '' THEN
    RAISE EXCEPTION 'חובה לבחור מחזיק';
  END IF;
  IF p_holder_id = 'גדוד' THEN
    RAISE EXCEPTION 'לא ניתן להחתים רחפן על גדוד';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM people WHERE id::text = p_holder_id AND location = p_sheet_range
  ) THEN
    RAISE EXCEPTION 'המחזיק חייב להיות מפלוגה %', p_sheet_range;
  END IF;

  -- drop zero / negative entries
  SELECT COALESCE(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_clean
    FROM jsonb_each(COALESCE(p_items, '{}'::jsonb))
   WHERE (value #>> '{}')::int > 0;

  SELECT id, items INTO v_stock_id, v_before
    FROM drone WHERE location = 'גדוד' AND drone_type = p_drone_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'שורת מלאי גדוד חסרה עבור %', p_drone_type; END IF;

  v_after := _drone_jsonb_merge_add(v_before, v_clean, -1);
  UPDATE drone SET items = v_after, updated_at = now() WHERE id = v_stock_id;

  INSERT INTO drone (
    drone_type, location, items, serial, sheet_range,
    holder_name, signed_by_id, signed_by_name
  ) VALUES (
    p_drone_type, p_holder_id, v_clean, btrim(p_serial), p_sheet_range,
    p_holder_name, p_actor_id, p_actor_name
  ) RETURNING id INTO v_new_id;

  INSERT INTO drone_document (
    action_type, drone_id, drone_type, serial, sheet_range,
    items, holder_id, holder_name, actor_id, actor_name
  ) VALUES (
    'drone_signed', v_new_id, p_drone_type, btrim(p_serial), p_sheet_range,
    v_clean, p_holder_id, p_holder_name, p_actor_id, p_actor_name
  );

  RETURN v_new_id;
END; $$;

-- 8. Delete a drone — items return to גדוד ---------------------------
CREATE OR REPLACE FUNCTION delete_drone(
  p_drone_id   BIGINT,
  p_actor_id   TEXT,
  p_actor_name TEXT,
  p_note       TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d drone; v_stock_id BIGINT; v_before JSONB; v_after JSONB;
BEGIN
  SELECT * INTO d FROM drone WHERE id = p_drone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'רחפן לא נמצא'; END IF;
  IF d.location = 'גדוד' THEN
    RAISE EXCEPTION 'לא ניתן למחוק את שורת מלאי הגדוד';
  END IF;

  SELECT id, items INTO v_stock_id, v_before
    FROM drone WHERE location = 'גדוד' AND drone_type = d.drone_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'שורת מלאי גדוד חסרה עבור %', d.drone_type; END IF;

  v_after := _drone_jsonb_merge_add(v_before, d.items, 1);
  UPDATE drone SET items = v_after, updated_at = now() WHERE id = v_stock_id;

  INSERT INTO drone_document (
    action_type, drone_id, drone_type, serial, sheet_range,
    items, holder_id, holder_name, actor_id, actor_name, note
  ) VALUES (
    'drone_deleted', d.id, d.drone_type, d.serial, d.sheet_range,
    d.items, d.location, d.holder_name, p_actor_id, p_actor_name, p_note
  );

  DELETE FROM drone WHERE id = p_drone_id;
END; $$;

-- 9. Change one item's quantity on a drone ---------------------------
CREATE OR REPLACE FUNCTION set_drone_item_qty(
  p_drone_id   BIGINT,
  p_item_name  TEXT,
  p_new_qty    INT,
  p_actor_id   TEXT,
  p_actor_name TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d drone; v_old INT; v_diff INT;
        v_stock_id BIGINT; v_sb JSONB; v_sa JSONB;
BEGIN
  IF p_new_qty IS NULL OR p_new_qty < 0 THEN
    RAISE EXCEPTION 'כמות לא יכולה להיות שלילית';
  END IF;

  SELECT * INTO d FROM drone WHERE id = p_drone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'רחפן לא נמצא'; END IF;
  IF d.location = 'גדוד' THEN
    RAISE EXCEPTION 'עדכון מלאי גדוד נעשה דרך drone_stock_change';
  END IF;

  v_old  := COALESCE((d.items #>> ARRAY[p_item_name])::int, 0);
  v_diff := p_new_qty - v_old;
  IF v_diff = 0 THEN RETURN; END IF;

  SELECT id, items INTO v_stock_id, v_sb
    FROM drone WHERE location = 'גדוד' AND drone_type = d.drone_type FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'שורת מלאי גדוד חסרה עבור %', d.drone_type; END IF;

  -- raising the drone's quantity draws the difference out of גדוד, and vice versa
  v_sa := _drone_jsonb_merge_add(
            v_sb,
            jsonb_build_object(p_item_name, abs(v_diff)),
            CASE WHEN v_diff > 0 THEN -1 ELSE 1 END
          );
  UPDATE drone SET items = v_sa, updated_at = now() WHERE id = v_stock_id;

  UPDATE drone
     SET items = jsonb_set(items, ARRAY[p_item_name], to_jsonb(p_new_qty), true),
         updated_at = now()
   WHERE id = p_drone_id;

  INSERT INTO drone_document (
    action_type, drone_id, drone_type, serial, sheet_range,
    item_name, delta, quantity_before, quantity_after,
    holder_id, holder_name, actor_id, actor_name
  ) VALUES (
    'item_qty_changed', d.id, d.drone_type, d.serial, d.sheet_range,
    p_item_name, v_diff, v_old, p_new_qty,
    d.location, d.holder_name, p_actor_id, p_actor_name
  );
END; $$;

-- 10. Reassign a drone within the same company -----------------------
CREATE OR REPLACE FUNCTION change_drone_holder(
  p_drone_id    BIGINT,
  p_holder_id   TEXT,
  p_holder_name TEXT,
  p_actor_id    TEXT,
  p_actor_name  TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE d drone;
BEGIN
  SELECT * INTO d FROM drone WHERE id = p_drone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'רחפן לא נמצא'; END IF;
  IF d.location = 'גדוד' THEN
    RAISE EXCEPTION 'שורת מלאי גדוד אינה ניתנת להעברה';
  END IF;
  IF p_holder_id = d.location THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM people WHERE id::text = p_holder_id AND location = d.sheet_range
  ) THEN
    RAISE EXCEPTION 'המחזיק החדש חייב להיות מאותה פלוגה (%)', d.sheet_range;
  END IF;

  UPDATE drone
     SET location = p_holder_id, holder_name = p_holder_name, updated_at = now()
   WHERE id = p_drone_id;

  INSERT INTO drone_document (
    action_type, drone_id, drone_type, serial, sheet_range,
    holder_id, holder_name, prev_holder_id, prev_holder_name,
    actor_id, actor_name
  ) VALUES (
    'holder_changed', d.id, d.drone_type, d.serial, d.sheet_range,
    p_holder_id, p_holder_name, d.location, d.holder_name,
    p_actor_id, p_actor_name
  );
END; $$;

-- 11. Reads -----------------------------------------------------------
CREATE OR REPLACE FUNCTION get_drone_sheet_data(p_sheet_range TEXT)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'drones', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.drone_type, d.serial)
        FROM drone d
       WHERE d.location <> 'גדוד' AND d.sheet_range = p_sheet_range
    ), '[]'::jsonb),
    'stock', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.drone_type)
        FROM drone d WHERE d.location = 'גדוד'
    ), '[]'::jsonb),
    'people', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) ORDER BY p.name)
        FROM people p WHERE p.location = p_sheet_range
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_drone_gadud_data()
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'stock', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.drone_type)
        FROM drone d WHERE d.location = 'גדוד'
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_drone_sum_data()
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'totals', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.drone_type, t.item_name) FROM (
        SELECT x.drone_type,
               x.item_name,
               SUM(x.signed)::int               AS signed,
               SUM(x.gadud)::int                AS gadud,
               (SUM(x.signed) + SUM(x.gadud))::int AS total
          FROM (
            SELECT d.drone_type,
                   e.key AS item_name,
                   CASE WHEN d.location = 'גדוד' THEN 0
                        ELSE (e.value #>> '{}')::int END AS signed,
                   CASE WHEN d.location = 'גדוד' THEN (e.value #>> '{}')::int
                        ELSE 0 END AS gadud
              FROM drone d, jsonb_each(d.items) e
          ) x
         GROUP BY x.drone_type, x.item_name
      ) t
    ), '[]'::jsonb),
    'drones', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.drone_type, d.sheet_range, d.serial)
        FROM drone d WHERE d.location <> 'גדוד'
    ), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION get_drone_document(p_limit INT DEFAULT 300)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
      FROM (
        SELECT * FROM drone_document ORDER BY created_at DESC LIMIT p_limit
      ) c
  ), '[]'::jsonb);
END; $$;

-- Done.
```

### RLS — deliberately untouched

No row-level security policies or grants are added, by decision: the new tables inherit
whatever the project already does, exactly as the `inventory` / `changes_log` tables do.
Earlier migrations in `supabase/migrations/` set none either. Do not add policies here.

The `users."רחפנים"` column was added by hand on the live project; section 5 of the migration
restates it with `ADD COLUMN IF NOT EXISTS` so a fresh environment is self-contained, and is
a no-op where it already exists.

## Error handling

- Every RPC raises a Hebrew `EXCEPTION` on invalid input; the hooks surface `error.message`
  through the existing `StatusMessage` component used by the ammo forms.
- Overdrawing גדוד is the main expected failure. `_drone_jsonb_merge_add` names the item, the
  amount on hand, and the amount required.
- Inline quantity inputs are optimistic: on rejection the value reverts to the server's and
  the message appears above the card.
- The stock row is locked `FOR UPDATE` before any arithmetic, so two concurrent signings of
  the last item serialize and the second one fails cleanly.

## Testing

The project has no test runner configured, so verification is `npx tsc --noEmit`,
`npx eslint`, a production build, and manual exercise of each path against Supabase:

1. Run the migration; confirm the two גדוד rows exist with `items = {}`.
2. Sign a drone with an empty pool — expect the Hebrew shortage error.
3. Add an EVO kit on the גדוד tab; confirm quantities and `stock_add` audit rows.
4. Sign an EVO drone to a פלוגה א soldier; confirm גדוד dropped by exactly the signed
   quantities and one `drone_signed` row was written.
5. Raise an item's quantity beyond what גדוד holds — expect rejection and no change.
6. Lower an item's quantity; confirm the difference returned to גדוד.
7. Reassign the drone within פלוגה א; confirm `holder_changed` and untouched stock.
8. Attempt to reassign to a soldier in פלוגה ב — expect rejection.
9. Delete the drone; confirm every item returned to גדוד and the audit row survives.
10. Confirm סיכום's `בחתימה / גדוד / סה"כ` columns reconcile, and that a user holding only
    `permissions['א']` sees no רחפנים section and is blocked on a hand-typed URL.
11. Sign in as a user holding `admin` but not `רחפנים`: confirm every tab renders its data,
    no action button is present, and quantities show as text rather than inputs.
12. Grant `רחפנים` from the admin screen; confirm it is checkable on the add-user form and
    that the users grid's הרשאות column lists it for that user.

## Out of scope

- A שצל-style requisition flow for drone parts.
- Printing or exporting a signed-drone form.
- Per-item serial tracking (only the drone itself carries a serial).
- Backfilling drones that are already signed out on paper.
