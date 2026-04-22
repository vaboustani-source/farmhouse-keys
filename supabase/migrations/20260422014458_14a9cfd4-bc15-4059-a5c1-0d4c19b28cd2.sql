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

    SELECT s.id
    INTO v_section_id
    FROM public.lb_room_sections s
    WHERE s.event_id = NEW.id
      AND (s.section_name = v_section_name OR s.booking_link_slug = v_slug)
    LIMIT 1;

    IF v_section_id IS NULL THEN
      INSERT INTO public.lb_room_sections (
        event_id,
        section_name,
        sort_order,
        booking_link_slug
      )
      VALUES (
        NEW.id,
        v_section_name,
        v_sort,
        v_slug
      )
      RETURNING id INTO v_section_id;
    END IF;

    FOREACH v_addon IN ARRAY v_addons LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.lb_section_addons a
        WHERE a.event_id = NEW.id
          AND a.section_id = v_section_id
          AND a.addon_name = v_addon
      ) THEN
        INSERT INTO public.lb_section_addons (
          event_id,
          section_id,
          addon_name,
          addon_price,
          addon_type,
          is_active
        )
        VALUES (
          NEW.id,
          v_section_id,
          v_addon,
          0,
          'per_stay',
          false
        );
      END IF;
    END LOOP;

    v_sort := v_sort + 1;
  END LOOP;

  RETURN NEW;
END;
$function$;