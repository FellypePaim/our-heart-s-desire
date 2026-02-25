
-- Add plan tracking columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN plan_type text NOT NULL DEFAULT 'trial',
ADD COLUMN plan_expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '15 minutes');

-- Create function to auto-set trial plan on profile creation
CREATE OR REPLACE FUNCTION public.set_trial_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Always set trial with 15 min expiry for new profiles
  NEW.plan_type := 'trial';
  NEW.plan_expires_at := now() + interval '15 minutes';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_trial_on_profile_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_trial_on_profile_insert();

-- Function to check if a user's plan is active (used in guards)
-- SuperAdmins are always active
CREATE OR REPLACE FUNCTION public.is_plan_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN is_super_admin(_user_id) THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE user_id = _user_id
          AND plan_expires_at > now()
      )
    END
$$;

-- Function to check if master's plan is active (for reseller cascade)
-- Resellers are blocked if their master's plan is expired
CREATE OR REPLACE FUNCTION public.is_master_plan_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE
      WHEN is_super_admin(_user_id) THEN true
      WHEN has_role(_user_id, 'panel_admin') THEN is_plan_active(_user_id)
      WHEN has_role(_user_id, 'reseller') THEN 
        COALESCE(
          is_plan_active((SELECT created_by FROM public.resellers WHERE owner_user_id = _user_id LIMIT 1)),
          false
        )
      ELSE true
    END
$$;

-- Set existing profiles to 'monthly' with 30 days from now (so current users aren't locked out)
UPDATE public.profiles SET plan_type = 'monthly', plan_expires_at = now() + interval '30 days';
