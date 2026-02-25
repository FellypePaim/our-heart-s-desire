-- Update trial duration from 15 minutes to 25 minutes
CREATE OR REPLACE FUNCTION public.set_trial_on_profile_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.plan_type := 'trial';
  NEW.plan_expires_at := now() + interval '25 minutes';
  RETURN NEW;
END;
$function$;

-- Also update the default on the column
ALTER TABLE public.profiles ALTER COLUMN plan_expires_at SET DEFAULT (now() + interval '25 minutes');