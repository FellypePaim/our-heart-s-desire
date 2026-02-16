
-- Add limits column to profiles for Master limits (configurable by SuperAdmin)
ALTER TABLE public.profiles
ADD COLUMN limits jsonb NOT NULL DEFAULT '{"max_clients": 200, "max_resellers": 10}'::jsonb;
