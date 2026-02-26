
-- Add login, senha, pix fields to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS login text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS senha text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pix text DEFAULT '';

-- Add pix_key to profiles for global PIX configuration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pix_key text DEFAULT '';
