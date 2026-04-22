
-- Allow lb_events to share the planning-hub event id (so they're 1:1 linked).
-- The id column already accepts any uuid; we just add a helper RPC that
-- creates an lb_events row + sections for a given planning event if missing.

CREATE OR REPLACE FUNCTION public.lb_ensure_block_for_event(_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_event record;
  v_nights int;
BEGIN
  -- Already exists? return it.
  SELECT id INTO v_existing FROM public.lb_events WHERE id = _event_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Pull source event.
  SELECT id, title, partner1_name, partner2_name, wedding_date, arrival_date, departure_date
  INTO v_event
  FROM public.events
  WHERE id = _event_id;

  IF v_event.id IS NULL THEN
    RAISE EXCEPTION 'Event % not found in planning hub', _event_id;
  END IF;

  v_nights := GREATEST(
    COALESCE((v_event.departure_date - v_event.arrival_date), 2),
    1
  );

  -- Insert mirrors planning-hub event; trigger auto-seeds the 4 sections + addons.
  INSERT INTO public.lb_events (
    id, wedding_name, couple_names, wedding_date,
    check_in_date, check_out_date, nights, status
  ) VALUES (
    v_event.id,
    COALESCE(v_event.title, 'Untitled Wedding'),
    TRIM(BOTH ' &' FROM CONCAT_WS(' & ',
      NULLIF(v_event.partner1_name, ''),
      NULLIF(v_event.partner2_name, ''))),
    v_event.wedding_date,
    v_event.arrival_date,
    v_event.departure_date,
    v_nights,
    'draft'
  );

  RETURN _event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lb_ensure_block_for_event(uuid) TO authenticated;
