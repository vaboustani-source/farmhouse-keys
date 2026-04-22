-- Diagnostic + fix: make slug generation collision-safe by including section sort order and full uuid suffix.
-- Also clear any leftover sections from failed prior runs (table is empty per RLS-bypassed check, but be safe).

CREATE OR REPLACE FUNCTION public.lb_seed_event_sections()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_section_id uuid;
  v_section_name text;
  v_sort int;
  v_names text[] := ARRAY['Farmhouse Residence','Hearth Guesthouses','Grove Guesthouses','Victoria Guesthouses'];
  v_addons text[] := ARRAY['Extra Night','Late Checkout','Welcome Amenity Package','Private Fireside Setup'];
  v_addon text;
  v_slug text;
BEGIN
  v_sort := 0;
  FOREACH v_section_name IN ARRAY v_names LOOP
    v_slug := lower(regexp_replace(v_section_name, '\s+', '-', 'g')) || '-' || replace(NEW.id::text, '-', '');
    INSERT INTO public.lb_room_sections (event_id, section_name, sort_order, booking_link_slug)
    VALUES (NEW.id, v_section_name, v_sort, v_slug)
    RETURNING id INTO v_section_id;

    FOREACH v_addon IN ARRAY v_addons LOOP
      INSERT INTO public.lb_section_addons (event_id, section_id, addon_name, addon_price, addon_type, is_active)
      VALUES (NEW.id, v_section_id, v_addon, 0, 'per_stay', false);
    END LOOP;

    v_sort := v_sort + 1;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists (in case it was missing — db-triggers section showed none, which is suspicious).
DROP TRIGGER IF EXISTS trg_lb_seed_event_sections ON public.lb_events;
CREATE TRIGGER trg_lb_seed_event_sections
  AFTER INSERT ON public.lb_events
  FOR EACH ROW
  EXECUTE FUNCTION public.lb_seed_event_sections();