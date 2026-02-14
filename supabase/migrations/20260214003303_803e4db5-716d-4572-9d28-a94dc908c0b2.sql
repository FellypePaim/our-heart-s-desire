
-- 1. Create role enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'panel_admin', 'reseller', 'user');

-- 2. Tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  max_resellers INTEGER DEFAULT 10,
  max_clients INTEGER DEFAULT 100,
  max_messages_month INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 3. User roles table (separate from profiles per security guidelines)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, tenant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Global settings table
CREATE TABLE public.global_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- 6. Impersonate sessions table
CREATE TABLE public.impersonate_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  super_admin_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  target_tenant_id UUID REFERENCES public.tenants(id),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.impersonate_sessions ENABLE ROW LEVEL SECURITY;

-- 7. Add tenant_id to clients table
ALTER TABLE public.clients ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 8. Security definer functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin' AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.user_roles
  WHERE user_id = _user_id AND is_active = true AND tenant_id IS NOT NULL
  LIMIT 1
$$;

-- 9. RLS policies for tenants
CREATE POLICY "SuperAdmin can do everything on tenants" ON public.tenants
  FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Panel admins can view own tenant" ON public.tenants
  FOR SELECT USING (id = public.get_user_tenant_id(auth.uid()));

-- 10. RLS policies for user_roles
CREATE POLICY "SuperAdmin can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- 11. RLS policies for audit_logs
CREATE POLICY "SuperAdmin can view all audit logs" ON public.audit_logs
  FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Panel admins can view own tenant logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- 12. RLS policies for global_settings
CREATE POLICY "SuperAdmin can manage global settings" ON public.global_settings
  FOR ALL USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Anyone authenticated can read global settings" ON public.global_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 13. RLS policies for impersonate_sessions
CREATE POLICY "SuperAdmin can manage impersonate sessions" ON public.impersonate_sessions
  FOR ALL USING (public.is_super_admin(auth.uid()));

-- 14. Update clients RLS to support multi-tenant + super_admin
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;

CREATE POLICY "Users can view clients" ON public.clients
  FOR SELECT USING (
    public.is_super_admin(auth.uid()) OR auth.uid() = user_id
  );

CREATE POLICY "Users can create clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update clients" ON public.clients
  FOR UPDATE USING (
    public.is_super_admin(auth.uid()) OR auth.uid() = user_id
  );

CREATE POLICY "Users can delete clients" ON public.clients
  FOR DELETE USING (
    public.is_super_admin(auth.uid()) OR auth.uid() = user_id
  );

-- 15. Triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 16. Indexes
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX idx_impersonate_active ON public.impersonate_sessions(super_admin_id) WHERE is_active = true;
