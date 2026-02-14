
-- Panel admin can view clients in their tenant (to see aggregate data)
-- But the frontend will restrict what they can see vs resellers' clients
CREATE POLICY "Panel admin can view tenant clients"
ON public.clients
FOR SELECT
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
);

-- Panel admin can create clients in their tenant
CREATE POLICY "Panel admin can create tenant clients"
ON public.clients
FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
);

-- Panel admin can update clients in their tenant
CREATE POLICY "Panel admin can update tenant clients"
ON public.clients
FOR UPDATE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
);

-- Panel admin can delete clients in their tenant
CREATE POLICY "Panel admin can delete tenant clients"
ON public.clients
FOR DELETE
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND is_panel_admin(auth.uid(), tenant_id)
);
