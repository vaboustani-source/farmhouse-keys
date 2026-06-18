CREATE POLICY "Allow anon read additional charges"
ON public.lb_additional_charges
FOR SELECT TO anon USING (true);

GRANT SELECT ON public.lb_additional_charges TO anon;