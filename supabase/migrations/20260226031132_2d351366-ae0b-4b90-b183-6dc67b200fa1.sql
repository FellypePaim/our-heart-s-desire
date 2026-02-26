-- Remove limits column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS limits;

-- Remove limits column from resellers table
ALTER TABLE public.resellers DROP COLUMN IF EXISTS limits;