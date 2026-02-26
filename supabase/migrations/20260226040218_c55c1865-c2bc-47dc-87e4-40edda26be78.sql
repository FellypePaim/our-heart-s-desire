
-- Create billing_rule_logs table for execution history
CREATE TABLE public.billing_rule_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID NOT NULL REFERENCES public.billing_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clients_matched INTEGER NOT NULL DEFAULT 0,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  messages_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed'
);

-- Enable RLS
ALTER TABLE public.billing_rule_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_logs_select" ON public.billing_rule_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sa_billing_logs" ON public.billing_rule_logs FOR ALL USING (is_super_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_billing_rule_logs_rule_id ON public.billing_rule_logs(rule_id);
CREATE INDEX idx_billing_rule_logs_executed_at ON public.billing_rule_logs(executed_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.billing_rule_logs;
