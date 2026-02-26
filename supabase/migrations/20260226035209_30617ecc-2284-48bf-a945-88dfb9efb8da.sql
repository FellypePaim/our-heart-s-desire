
-- Create notifications table for WhatsApp disconnect alerts etc.
CREATE TABLE public.whatsapp_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'disconnect',
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.whatsapp_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.whatsapp_notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.whatsapp_notifications FOR DELETE
USING (auth.uid() = user_id);

-- Service role inserts via edge function, so no INSERT policy needed for users
-- But we need SuperAdmin access
CREATE POLICY "sa_whatsapp_notifications"
ON public.whatsapp_notifications FOR ALL
USING (is_super_admin(auth.uid()));

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_notifications;

-- Add webhook_set column to track if webhook was configured
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS webhook_set BOOLEAN DEFAULT false;
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'unknown';
