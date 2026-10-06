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

-- 5. Permission column -----------------------------------------------
-- Permissions are boolean columns on `users`, read wholesale at login.
ALTER TABLE users ADD COLUMN IF NOT EXISTS "רחפנים" BOOLEAN NOT NULL DEFAULT false;

-- 6. Helper: add/subtract an item map, refusing to go below zero -----
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

-- 7. Stock add / remove (kit-based) ----------------------------------
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

-- 8. Sign a drone -----------------------------------------------------
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

-- 9. Delete a drone — items return to גדוד ---------------------------
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

-- 10. Change one item's quantity on a drone ---------------------------
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

-- 11. Reassign a drone within the same company -----------------------
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

-- 12. Reads -----------------------------------------------------------
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
