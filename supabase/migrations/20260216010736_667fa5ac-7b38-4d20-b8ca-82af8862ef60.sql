-- Drop old check constraint and add updated one with captacao
ALTER TABLE public.service_options DROP CONSTRAINT IF EXISTS service_options_category_check;
ALTER TABLE public.service_options ADD CONSTRAINT service_options_category_check CHECK (category IN ('plan', 'server', 'app', 'device', 'captacao'));