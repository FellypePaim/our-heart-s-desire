
-- Billing rules / Cobranças automáticas
CREATE TABLE public.billing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Message config
  message_template TEXT NOT NULL DEFAULT '',
  
  -- Filters
  status_filter TEXT[] DEFAULT '{}',
  
  -- Period filter (days before/after expiration)
  billing_type TEXT NOT NULL DEFAULT 'vencimento',
  period_type TEXT NOT NULL DEFAULT 'dias',
  period_value INTEGER NOT NULL DEFAULT 0,
  period_direction TEXT NOT NULL DEFAULT 'before',
  
  -- Delay between messages (random interval in seconds)
  delay_min INTEGER NOT NULL DEFAULT 1,
  delay_max INTEGER NOT NULL DEFAULT 3,
  
  -- Schedule
  send_hour INTEGER NOT NULL DEFAULT 9,
  send_minute INTEGER NOT NULL DEFAULT 0,
  
  -- Stats
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_count INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sa_billing_rules" ON public.billing_rules FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "own_billing_rules_select" ON public.billing_rules FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "own_billing_rules_insert" ON public.billing_rules FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_billing_rules_update" ON public.billing_rules FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "own_billing_rules_delete" ON public.billing_rules FOR DELETE
  USING (user_id = auth.uid());

CREATE TRIGGER update_billing_rules_updated_at
  BEFORE UPDATE ON public.billing_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
