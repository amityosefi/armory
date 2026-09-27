-- =====================================================================
-- 2026-09-27: cancel_request — requester can cancel their own pending
-- שצל request before an ammo user handles it.
-- Run in Supabase SQL editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_request(
  p_request_id     BIGINT,
  p_requester_email TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM requests
   WHERE id = p_request_id
     AND status = 'ממתין'
     AND requester_email = p_requester_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found, already handled, or not yours';
  END IF;
END;
$$;
