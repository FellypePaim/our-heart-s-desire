
-- Service options table for plans, servers, apps, devices
CREATE TABLE public.service_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('plan', 'server', 'app', 'device')),
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_global boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_options ENABLE ROW LEVEL SECURITY;

-- SuperAdmin full access
CREATE POLICY "SuperAdmin full access on service_options"
ON public.service_options FOR ALL
USING (is_super_admin(auth.uid()));

-- Panel admin can view global + own tenant options
CREATE POLICY "Panel admin can view service_options"
ON public.service_options FOR SELECT
USING (
  is_global = true
  OR (tenant_id = get_user_tenant_id(auth.uid()) AND is_panel_admin(auth.uid(), tenant_id))
);

-- Panel admin can manage own tenant options
CREATE POLICY "Panel admin can insert service_options"
ON public.service_options FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid()) AND is_panel_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Panel admin can update service_options"
ON public.service_options FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND is_panel_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Panel admin can delete service_options"
ON public.service_options FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid()) AND is_panel_admin(auth.uid(), tenant_id)
);

-- Resellers can view global + own tenant options (read only)
CREATE POLICY "Reseller can view service_options"
ON public.service_options FOR SELECT
USING (
  is_global = true
  OR (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'reseller'))
);

-- Users can view global options
CREATE POLICY "Users can view global service_options"
ON public.service_options FOR SELECT
USING (is_global = true AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_service_options_updated_at
BEFORE UPDATE ON public.service_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some global defaults
INSERT INTO public.service_options (category, name, config, is_global) VALUES
  ('plan', 'Mensal', '{"price": 25, "credits": 1, "screens": 1, "duration_months": 1}', true),
  ('plan', 'DUO', '{"price": 40, "credits": 2, "screens": 2, "duration_months": 1}', true),
  ('plan', 'Bimestral', '{"price": 45, "credits": 2, "screens": 1, "duration_months": 2}', true),
  ('plan', 'Trimestral', '{"price": 60, "credits": 3, "screens": 1, "duration_months": 3}', true),
  ('plan', 'Semestral', '{"price": 100, "credits": 6, "screens": 1, "duration_months": 6}', true),
  ('plan', 'Anual', '{"price": 180, "credits": 12, "screens": 1, "duration_months": 12}', true),
  ('server', 'BRAVE', '{"cost_per_credit": 10}', true),
  ('server', 'ATLAS', '{"cost_per_credit": 12}', true),
  ('server', 'TITAN', '{"cost_per_credit": 8}', true),
  ('server', 'NEXUS', '{"cost_per_credit": 15}', true),
  ('server', 'OMEGA', '{"cost_per_credit": 11}', true),
  ('app', 'XCIPTV', '{}', true),
  ('app', 'Smarters Pro', '{}', true),
  ('app', 'TiviMate', '{}', true),
  ('app', 'IBO Player', '{}', true),
  ('app', 'DupleX IPTV', '{}', true),
  ('app', 'Smart IPTV', '{}', true),
  ('device', 'Smart TV', '{}', true),
  ('device', 'TV Box', '{}', true),
  ('device', 'Celular', '{}', true),
  ('device', 'Tablet', '{}', true),
  ('device', 'Computador', '{}', true),
  ('device', 'Fire Stick', '{}', true),
  ('device', 'Chromecast', '{}', true);
