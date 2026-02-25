
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  instance_key text NOT NULL DEFAULT '',
  api_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instance"
ON public.whatsapp_instances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own instance"
ON public.whatsapp_instances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own instance"
ON public.whatsapp_instances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "SuperAdmin full access"
ON public.whatsapp_instances FOR ALL
USING (is_super_admin(auth.uid()));
