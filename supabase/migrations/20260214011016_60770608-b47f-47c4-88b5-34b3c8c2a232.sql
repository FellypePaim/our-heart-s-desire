
-- Create resellers table
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  limits JSONB NOT NULL DEFAULT '{"max_clients": 50, "max_messages_month": 500}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add reseller_id to clients (nullable for backward compat, but enforced for new inserts via app logic)
ALTER TABLE public.clients ADD COLUMN reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_clients_reseller_id ON public.clients(reseller_id);
CREATE INDEX idx_resellers_tenant_id ON public.resellers(tenant_id);
CREATE INDEX idx_resellers_owner_user_id ON public.resellers(owner_user_id);

-- Enable RLS on resellers
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

-- Helper function: get reseller id for a user
CREATE OR REPLACE FUNCTION public.get_user_reseller_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.resellers
  WHERE owner_user_id = _user_id
  LIMIT 1
$$;

-- Helper function: check if user is panel admin of a tenant
CREATE OR REPLACE FUNCTION public.is_panel_admin(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'panel_admin'
      AND tenant_id = _tenant_id
      AND is_active = true
  )
$$;

-- RLS for resellers: SuperAdmin can do everything
CREATE POLICY "SuperAdmin full access on resellers"
ON public.resellers FOR ALL
USING (public.is_super_admin(auth.uid()));

-- RLS for resellers: Panel admin can manage resellers in their tenant
CREATE POLICY "Panel admin can view tenant resellers"
ON public.resellers FOR SELECT
USING (public.is_panel_admin(auth.uid(), tenant_id));

CREATE POLICY "Panel admin can create tenant resellers"
ON public.resellers FOR INSERT
WITH CHECK (public.is_panel_admin(auth.uid(), tenant_id));

CREATE POLICY "Panel admin can update tenant resellers"
ON public.resellers FOR UPDATE
USING (public.is_panel_admin(auth.uid(), tenant_id));

CREATE POLICY "Panel admin can delete tenant resellers"
ON public.resellers FOR DELETE
USING (public.is_panel_admin(auth.uid(), tenant_id));

-- RLS for resellers: Reseller can view own record
CREATE POLICY "Reseller can view own record"
ON public.resellers FOR SELECT
USING (owner_user_id = auth.uid());

-- Update clients RLS to support reseller scope
-- Drop existing client policies and recreate with reseller awareness
DROP POLICY IF EXISTS "Users can view clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete clients" ON public.clients;

-- SuperAdmin: full access
CREATE POLICY "SuperAdmin full access on clients"
ON public.clients FOR ALL
USING (public.is_super_admin(auth.uid()));

-- Panel admin: access all clients in their tenant
CREATE POLICY "Panel admin can view tenant clients"
ON public.clients FOR SELECT
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'panel_admin'));

CREATE POLICY "Panel admin can create tenant clients"
ON public.clients FOR INSERT
WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'panel_admin'));

CREATE POLICY "Panel admin can update tenant clients"
ON public.clients FOR UPDATE
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'panel_admin'));

CREATE POLICY "Panel admin can delete tenant clients"
ON public.clients FOR DELETE
USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'panel_admin'));

-- Reseller: access only their own clients
CREATE POLICY "Reseller can view own clients"
ON public.clients FOR SELECT
USING (
  reseller_id = public.get_user_reseller_id(auth.uid())
  AND public.has_role(auth.uid(), 'reseller')
);

CREATE POLICY "Reseller can create own clients"
ON public.clients FOR INSERT
WITH CHECK (
  reseller_id = public.get_user_reseller_id(auth.uid())
  AND tenant_id = public.get_user_tenant_id(auth.uid())
  AND public.has_role(auth.uid(), 'reseller')
);

CREATE POLICY "Reseller can update own clients"
ON public.clients FOR UPDATE
USING (
  reseller_id = public.get_user_reseller_id(auth.uid())
  AND public.has_role(auth.uid(), 'reseller')
);

CREATE POLICY "Reseller can delete own clients"
ON public.clients FOR DELETE
USING (
  reseller_id = public.get_user_reseller_id(auth.uid())
  AND public.has_role(auth.uid(), 'reseller')
);

-- Regular users: access own clients (backward compat for users without tenant/reseller)
CREATE POLICY "Users can view own clients"
ON public.clients FOR SELECT
USING (auth.uid() = user_id AND reseller_id IS NULL AND tenant_id IS NULL);

CREATE POLICY "Users can create own clients"
ON public.clients FOR INSERT
WITH CHECK (auth.uid() = user_id AND tenant_id IS NULL);

CREATE POLICY "Users can update own clients"
ON public.clients FOR UPDATE
USING (auth.uid() = user_id AND reseller_id IS NULL AND tenant_id IS NULL);

CREATE POLICY "Users can delete own clients"
ON public.clients FOR DELETE
USING (auth.uid() = user_id AND reseller_id IS NULL AND tenant_id IS NULL);

-- Trigger for updated_at on resellers
CREATE TRIGGER update_resellers_updated_at
BEFORE UPDATE ON public.resellers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
