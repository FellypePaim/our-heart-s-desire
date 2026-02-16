
-- Migration: Remove tenant system - drop policies first, then columns

-- 1. Add created_by to service_options
ALTER TABLE public.service_options ADD COLUMN IF NOT EXISTS created_by uuid;

-- 2. Migrate existing service_options data
UPDATE public.service_options so
SET created_by = (
  SELECT ur.user_id FROM public.user_roles ur 
  WHERE ur.tenant_id = so.tenant_id AND ur.role = 'panel_admin' AND ur.is_active = true
  LIMIT 1
)
WHERE so.tenant_id IS NOT NULL AND so.created_by IS NULL;

-- 3. DROP ALL POLICIES FIRST (before dropping columns they depend on)

-- CLIENTS policies
DROP POLICY IF EXISTS "Panel admin can create tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can delete tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can update tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Panel admin can view tenant clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can create own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can delete own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can view own clients" ON public.clients;
DROP POLICY IF EXISTS "SuperAdmin full access on clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;

-- RESELLERS policies
DROP POLICY IF EXISTS "Panel admin can create tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can delete tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can update tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Panel admin can view tenant resellers" ON public.resellers;
DROP POLICY IF EXISTS "Reseller can view own record" ON public.resellers;
DROP POLICY IF EXISTS "SuperAdmin full access on resellers" ON public.resellers;

-- SERVICE_OPTIONS policies
DROP POLICY IF EXISTS "Panel admin can delete service_options" ON public.service_options;
DROP POLICY IF EXISTS "Panel admin can insert service_options" ON public.service_options;
DROP POLICY IF EXISTS "Panel admin can update service_options" ON public.service_options;
DROP POLICY IF EXISTS "Panel admin can view service_options" ON public.service_options;
DROP POLICY IF EXISTS "Reseller can view service_options" ON public.service_options;
DROP POLICY IF EXISTS "SuperAdmin full access on service_options" ON public.service_options;
DROP POLICY IF EXISTS "Users can view global service_options" ON public.service_options;

-- USER_ROLES policies
DROP POLICY IF EXISTS "SuperAdmin can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

-- AUDIT_LOGS policies
DROP POLICY IF EXISTS "Panel admins can view own tenant logs" ON public.audit_logs;
DROP POLICY IF EXISTS "SuperAdmin can view all audit logs" ON public.audit_logs;

-- 4. Drop foreign key constraints
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_tenant_id_fkey;
ALTER TABLE public.resellers DROP CONSTRAINT IF EXISTS resellers_tenant_id_fkey;
ALTER TABLE public.service_options DROP CONSTRAINT IF EXISTS service_options_tenant_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_tenant_id_fkey;
ALTER TABLE public.impersonate_sessions DROP CONSTRAINT IF EXISTS impersonate_sessions_target_tenant_id_fkey;

-- 5. Drop tenant_id columns
ALTER TABLE public.clients DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.service_options DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE public.resellers DROP COLUMN IF EXISTS tenant_id;

-- 6. Drop tenant-related tables
DROP TABLE IF EXISTS public.impersonate_sessions;
DROP TABLE IF EXISTS public.tenants;

-- 7. Drop old functions
DROP FUNCTION IF EXISTS public.get_user_tenant_id(uuid);
DROP FUNCTION IF EXISTS public.is_panel_admin(uuid, uuid);

-- 8. Create new functions
CREATE OR REPLACE FUNCTION public.is_panel_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'panel_admin' AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_reseller_master_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT created_by FROM public.resellers
  WHERE owner_user_id = _user_id
  LIMIT 1
$$;

-- 9. Recreate all policies

-- CLIENTS
CREATE POLICY "sa_clients" ON public.clients FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "master_clients_select" ON public.clients FOR SELECT USING (user_id = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_clients_insert" ON public.clients FOR INSERT WITH CHECK (user_id = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_clients_update" ON public.clients FOR UPDATE USING (user_id = auth.uid() AND reseller_id IS NULL AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_clients_delete" ON public.clients FOR DELETE USING (user_id = auth.uid() AND reseller_id IS NULL AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "reseller_clients_select" ON public.clients FOR SELECT USING (reseller_id = get_user_reseller_id(auth.uid()) AND has_role(auth.uid(), 'reseller'));
CREATE POLICY "reseller_clients_insert" ON public.clients FOR INSERT WITH CHECK (reseller_id = get_user_reseller_id(auth.uid()) AND has_role(auth.uid(), 'reseller'));
CREATE POLICY "reseller_clients_update" ON public.clients FOR UPDATE USING (reseller_id = get_user_reseller_id(auth.uid()) AND has_role(auth.uid(), 'reseller'));
CREATE POLICY "reseller_clients_delete" ON public.clients FOR DELETE USING (reseller_id = get_user_reseller_id(auth.uid()) AND has_role(auth.uid(), 'reseller'));

-- RESELLERS
CREATE POLICY "sa_resellers" ON public.resellers FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "master_resellers_select" ON public.resellers FOR SELECT USING (created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_resellers_insert" ON public.resellers FOR INSERT WITH CHECK (created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_resellers_update" ON public.resellers FOR UPDATE USING (created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "master_resellers_delete" ON public.resellers FOR DELETE USING (created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "reseller_own_record" ON public.resellers FOR SELECT USING (owner_user_id = auth.uid());

-- SERVICE_OPTIONS
CREATE POLICY "sa_service" ON public.service_options FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "master_service" ON public.service_options FOR ALL USING (created_by = auth.uid() AND has_role(auth.uid(), 'panel_admin'));
CREATE POLICY "reseller_service_view" ON public.service_options FOR SELECT USING (is_global = true OR created_by = get_reseller_master_id(auth.uid()));
CREATE POLICY "global_service_view" ON public.service_options FOR SELECT USING (is_global = true AND auth.uid() IS NOT NULL);

-- USER_ROLES
CREATE POLICY "sa_roles" ON public.user_roles FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "own_role_view" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- AUDIT_LOGS
CREATE POLICY "sa_audit" ON public.audit_logs FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "own_audit_view" ON public.audit_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_audit_insert" ON public.audit_logs FOR INSERT WITH CHECK (user_id = auth.uid());
