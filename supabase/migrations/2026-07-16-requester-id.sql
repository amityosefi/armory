-- Add requester_id (army personal number) to requests
ALTER TABLE requests ADD COLUMN IF NOT EXISTS requester_id TEXT;

-- Update create_request to accept requester_id
CREATE OR REPLACE FUNCTION create_request(
  p_requester_email     TEXT,
  p_requester_name      TEXT,
  p_requester_location  location_enum,
  p_requester_signature TEXT,
  p_item_name           TEXT,
  p_requested_quantity  INT,
  p_notes               TEXT DEFAULT NULL,
  p_batch_id            UUID DEFAULT NULL,
  p_requester_id        TEXT DEFAULT NULL
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
    item_name, is_explosion, requested_quantity, notes, status, "נקרא", batch_id, requester_id
  ) VALUES (
    p_requester_email, p_requester_name, p_requester_location, p_requester_signature,
    p_item_name, v_is_explosion, p_requested_quantity, p_notes, 'ממתין', 'לא', p_batch_id, p_requester_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
