
-- Remove panel admin access to all tenant clients
DROP POLICY IF EXISTS "Panel admin can view tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can create tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can update tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can delete tenant clients" ON public.clients;
