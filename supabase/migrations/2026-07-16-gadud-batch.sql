-- =====================================================================
-- 2026-07-16: גדוד level storage + batch requests + inventory transfer
-- Run in Supabase SQL editor (each ALTER TYPE must run outside a txn block).
-- Safe to re-run: OR REPLACE / IF NOT EXISTS / IF EXISTS guards.
-- =====================================================================

-- 1. Enum additions
ALTER TYPE location_enum ADD VALUE IF NOT EXISTS 'גדוד';
ALTER TYPE action_type_enum ADD VALUE IF NOT EXISTS 'transfer';

-- 2. Structural changes
ALTER TABLE requests ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_requests_batch_id ON requests(batch_id);

-- 3. stock_add — now accepts p_location (default 'מחסן')
CREATE OR REPLACE FUNCTION stock_add(
  p_item_name       TEXT,
  p_is_explosion    BOOLEAN,
  p_qty             INT,
  p_actor_email     TEXT,
  p_actor_name      TEXT,
  p_actor_signature TEXT DEFAULT NULL,
  p_location        location_enum DEFAULT 'מחסן'
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_after INT;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  PERFORM _validate_item_type(p_item_name, p_is_explosion);

  INSERT INTO inventory (item_name, is_explosion, location, quantity)
  VALUES (p_item_name, p_is_explosion, p_location, p_qty)
  ON CONFLICT (item_name, location) DO UPDATE SET quantity = inventory.quantity + p_qty
  RETURNING quantity INTO v_after;

  INSERT INTO changes_log (
    action_type, item_name, is_explosion, to_location, delta, quantity_after_to,
    actor_email, actor_name, actor_signature
  ) VALUES (
    'stock_add', p_item_name, p_is_explosion, p_location, p_qty, v_after,
    p_actor_email, p_actor_name, p_actor_signature
  );
END;
$$;

-- 4. stock_remove — now accepts p_location (default 'מחסן')
CREATE OR REPLACE FUNCTION stock_remove(
  p_item_name       TEXT,
  p_qty             INT,
  p_actor_email     TEXT,
  p_actor_name      TEXT,
  p_actor_signature TEXT DEFAULT NULL,
  p_note            TEXT DEFAULT NULL,
  p_location        location_enum DEFAULT 'מחסן'
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_after INT; v_is_explosion BOOLEAN;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;

  UPDATE inventory SET quantity = quantity - p_qty
   WHERE item_name = p_item_name AND location = p_location
   RETURNING quantity, is_explosion INTO v_after, v_is_explosion;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found at location'; END IF;

  INSERT INTO changes_log (
    action_type, item_name, is_explosion, from_location, delta, quantity_after_from,
    actor_email, actor_name, actor_signature, note
  ) VALUES (
    'stock_remove', p_item_name, v_is_explosion, p_location, -p_qty, v_after,
    p_actor_email, p_actor_name, p_actor_signature, p_note
  );
END;
$$;

-- 5. sign_to_group — now pulls from 'גדוד' (not 'מחסן')
CREATE OR REPLACE FUNCTION sign_to_group(
  p_item_name       TEXT,
  p_location        location_enum,
  p_qty             INT,
  p_actor_email     TEXT,
  p_actor_name      TEXT,
  p_actor_signature TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_after_from INT; v_after_to INT; v_is_explosion BOOLEAN;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF p_location IN ('מחסן', 'גדוד') THEN RAISE EXCEPTION 'Cannot sign to מחסן or גדוד'; END IF;

  UPDATE inventory SET quantity = quantity - p_qty
   WHERE item_name = p_item_name AND location = 'גדוד'
   RETURNING quantity, is_explosion INTO v_after_from, v_is_explosion;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not in גדוד stock'; END IF;

  INSERT INTO inventory (item_name, is_explosion, location, quantity)
  VALUES (p_item_name, v_is_explosion, p_location, p_qty)
  ON CONFLICT (item_name, location) DO UPDATE SET quantity = inventory.quantity + p_qty
  RETURNING quantity INTO v_after_to;

  INSERT INTO changes_log (
    action_type, item_name, is_explosion, from_location, to_location,
    delta, quantity_after_from, quantity_after_to,
    actor_email, actor_name, actor_signature
  ) VALUES (
    'sign_to_group', p_item_name, v_is_explosion, 'גדוד', p_location,
    p_qty, v_after_from, v_after_to,
    p_actor_email, p_actor_name, p_actor_signature
  );
END;
$$;

-- 6. transfer_inventory — moves between גדוד ↔ מחסן (or any two locations)
CREATE OR REPLACE FUNCTION transfer_inventory(
  p_item_name       TEXT,
  p_qty             INT,
  p_from_location   location_enum,
  p_to_location     location_enum,
  p_actor_email     TEXT,
  p_actor_name      TEXT,
  p_actor_signature TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_after_from INT; v_after_to INT; v_is_explosion BOOLEAN;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  IF p_from_location = p_to_location THEN RAISE EXCEPTION 'Source and destination must differ'; END IF;

  UPDATE inventory SET quantity = quantity - p_qty
   WHERE item_name = p_item_name AND location = p_from_location
   RETURNING quantity, is_explosion INTO v_after_from, v_is_explosion;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found at source'; END IF;

  INSERT INTO inventory (item_name, is_explosion, location, quantity)
  VALUES (p_item_name, v_is_explosion, p_to_location, p_qty)
  ON CONFLICT (item_name, location) DO UPDATE SET quantity = inventory.quantity + p_qty
  RETURNING quantity INTO v_after_to;

  INSERT INTO changes_log (
    action_type, item_name, is_explosion, from_location, to_location,
    delta, quantity_after_from, quantity_after_to,
    actor_email, actor_name, actor_signature
  ) VALUES (
    'transfer', p_item_name, v_is_explosion, p_from_location, p_to_location,
    p_qty, v_after_from, v_after_to,
    p_actor_email, p_actor_name, p_actor_signature
  );
END;
$$;

-- 7. create_request — now accepts optional p_batch_id
CREATE OR REPLACE FUNCTION create_request(
  p_requester_email     TEXT,
  p_requester_name      TEXT,
  p_requester_location  location_enum,
  p_requester_signature TEXT,
  p_item_name           TEXT,
  p_requested_quantity  INT,
  p_notes               TEXT DEFAULT NULL,
  p_batch_id            UUID DEFAULT NULL
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT; v_is_explosion BOOLEAN; v_available INT;
BEGIN
  IF p_requested_quantity IS NULL OR p_requested_quantity <= 0 THEN
    RAISE EXCEPTION 'Requested quantity must be positive';
  END IF;

  SELECT is_explosion, quantity INTO v_is_explosion, v_available
    FROM inventory WHERE item_name = p_item_name AND location = p_requester_location;

  IF v_available IS NULL THEN RAISE EXCEPTION 'Item not available at your location'; END IF;
  IF p_requested_quantity > v_available THEN
    RAISE EXCEPTION 'Requested quantity % exceeds available %', p_requested_quantity, v_available;
  END IF;

  INSERT INTO requests (
    requester_email, requester_name, requester_location, requester_signature,
    item_name, is_explosion, requested_quantity, notes, status, "נקרא", batch_id
  ) VALUES (
    p_requester_email, p_requester_name, p_requester_location, p_requester_signature,
    p_item_name, v_is_explosion, p_requested_quantity, p_notes, 'ממתין', 'לא', p_batch_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 8. mark_batch_read — marks multiple requests read in one call
CREATE OR REPLACE FUNCTION mark_batch_read(p_request_ids BIGINT[])
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE requests SET "נקרא" = 'כן' WHERE id = ANY(p_request_ids);
END;
$$;

-- 9. get_stock_tab_data — now returns gadud_inventory + mahsan_inventory separately
CREATE OR REPLACE FUNCTION get_stock_tab_data(p_log_limit INT DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'gadud_inventory', COALESCE((
      SELECT jsonb_agg(row_to_json(i) ORDER BY i.item_name)
        FROM inventory i WHERE i.location = 'גדוד'
    ), '[]'::jsonb),
    'mahsan_inventory', COALESCE((
      SELECT jsonb_agg(row_to_json(i) ORDER BY i.item_name)
        FROM inventory i WHERE i.location = 'מחסן'
    ), '[]'::jsonb),
    'catalog', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('item_name', item_name, 'is_explosion', is_explosion) ORDER BY item_name)
        FROM (SELECT DISTINCT item_name, is_explosion FROM inventory) c
    ), '[]'::jsonb),
    'change_log', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
        FROM (
          SELECT * FROM changes_log
           WHERE from_location IN ('מחסן','גדוד') OR to_location IN ('מחסן','גדוד')
           ORDER BY created_at DESC LIMIT p_log_limit
        ) c
    ), '[]'::jsonb)
  );
END;
$$;

-- 10. get_group_tab_data — returns all_requests (not split pending/handled)
CREATE OR REPLACE FUNCTION get_group_tab_data(p_location location_enum, p_log_limit INT DEFAULT 200)
RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
  RETURN jsonb_build_object(
    'inventory', COALESCE((
      SELECT jsonb_agg(row_to_json(i) ORDER BY i.item_name)
        FROM inventory i WHERE i.location = p_location AND i.quantity > 0
    ), '[]'::jsonb),
    'all_requests', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
        FROM requests r WHERE r.requester_location = p_location
    ), '[]'::jsonb),
    'change_log', COALESCE((
      SELECT jsonb_agg(row_to_json(c) ORDER BY c.created_at DESC)
        FROM (
          SELECT * FROM changes_log
           WHERE from_location = p_location OR to_location = p_location
           ORDER BY created_at DESC LIMIT p_log_limit
        ) c
    ), '[]'::jsonb)
  );
END;
$$;

-- Done.
