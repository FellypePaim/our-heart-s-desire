
-- Drop existing reseller and master service_options policies to recreate them
DROP POLICY IF EXISTS "master_service" ON public.service_options;
DROP POLICY IF EXISTS "reseller_service_view" ON public.service_options;

-- Master: full CRUD on their own records (created_by = their user_id)
CREATE POLICY "master_service_own" ON public.service_options
  FOR ALL USING (
    created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'::app_role)
  )
  WITH CHECK (
    created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'::app_role)
  );

-- Reseller: full CRUD on their own records (created_by = their user_id)
CREATE POLICY "reseller_service_own" ON public.service_options
  FOR ALL USING (
    created_by = auth.uid() AND has_role(auth.uid(), 'reseller'::app_role)
  )
  WITH CHECK (
    created_by = auth.uid() AND has_role(auth.uid(), 'reseller'::app_role)
  );

-- All authenticated users can read global options (kept as-is but re-verify)
-- global_service_view already exists, no change needed
