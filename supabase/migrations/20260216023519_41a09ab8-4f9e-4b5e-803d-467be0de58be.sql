
-- Add created_by column to track which master created the reseller
ALTER TABLE public.resellers ADD COLUMN created_by uuid;

-- Backfill: set created_by to null for existing records (will need manual fix if needed)
-- For now, any panel admin in the tenant can manage existing resellers

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Panel admin can view tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can update tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can delete tenant resellers" ON public.resellers;

-- Panel admin can VIEW all resellers in their tenant
CREATE POLICY "Panel admin can view tenant resellers"
  ON public.resellers FOR SELECT
  USING (
    is_panel_admin(auth.uid(), tenant_id)
  );

-- Panel admin can UPDATE resellers they created (or any if created_by is null for legacy)
CREATE POLICY "Panel admin can update tenant resellers"
  ON public.resellers FOR UPDATE
  USING (
    is_panel_admin(auth.uid(), tenant_id)
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- Panel admin can DELETE resellers they created (or any if created_by is null for legacy)
CREATE POLICY "Panel admin can delete tenant resellers"
  ON public.resellers FOR DELETE
  USING (
    is_panel_admin(auth.uid(), tenant_id)
    AND (created_by = auth.uid() OR created_by IS NULL)
  );
