
-- Drop existing panel_admin policies on resellers
DROP POLICY IF EXISTS "Panel admin can view tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can create tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can update tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can delete tenant resellers" ON public.resellers;

-- Masters can only see resellers THEY created
CREATE POLICY "Panel admin can view tenant resellers"
ON public.resellers FOR SELECT
USING (
  is_panel_admin(auth.uid(), tenant_id)
  AND owner_user_id = auth.uid()
);

CREATE POLICY "Panel admin can create tenant resellers"
ON public.resellers FOR INSERT
WITH CHECK (
  is_panel_admin(auth.uid(), tenant_id)
);

CREATE POLICY "Panel admin can update tenant resellers"
ON public.resellers FOR UPDATE
USING (
  is_panel_admin(auth.uid(), tenant_id)
  AND owner_user_id = auth.uid()
);

CREATE POLICY "Panel admin can delete tenant resellers"
ON public.resellers FOR DELETE
USING (
  is_panel_admin(auth.uid(), tenant_id)
  AND owner_user_id = auth.uid()
);
