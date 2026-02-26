
ALTER TABLE public.billing_rules
ADD COLUMN batch_size integer NOT NULL DEFAULT 10,
ADD COLUMN batch_pause integer NOT NULL DEFAULT 120;
