-- Re-attach the trigger that seeds the 4 room sections + addons when a block is created
DROP TRIGGER IF EXISTS trg_lb_seed_event_sections ON public.lb_events;
CREATE TRIGGER trg_lb_seed_event_sections
  AFTER INSERT ON public.lb_events
  FOR EACH ROW
  EXECUTE FUNCTION public.lb_seed_event_sections();