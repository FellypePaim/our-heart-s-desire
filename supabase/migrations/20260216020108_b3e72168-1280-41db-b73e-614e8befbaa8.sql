-- Drop existing panel_admin policies on clients
DROP POLICY IF EXISTS "Panel admin can view tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can create tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can update tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can delete tenant clients" ON public.clients;

-- Recreate: Masters can only see clients NOT assigned to a reseller
CREATE POLICY "Panel admin can view tenant clients"
ON public.clients FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
  AND reseller_id IS NULL
);

CREATE POLICY "Panel admin can create tenant clients"
ON public.clients FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Panel admin can update tenant clients"
ON public.clients FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
  AND reseller_id IS NULL
);

CREATE POLICY "Panel admin can delete tenant clients"
ON public.clients FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
  AND reseller_id IS NULL
);