CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  instance_key VARCHAR NOT NULL,
  api_token VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp instances" ON public.whatsapp_instances
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own whatsapp instances" ON public.whatsapp_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own whatsapp instances" ON public.whatsapp_instances
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp instances" ON public.whatsapp_instances
  FOR DELETE USING (auth.uid() = user_id);

-- Also allow super_admin to view
CREATE POLICY "Super admins can view whatsapp instances" ON public.whatsapp_instances
  FOR SELECT USING (public.is_super_admin(auth.uid()));
