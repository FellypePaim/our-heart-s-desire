
CREATE OR REPLACE FUNCTION public.set_trial_on_profile_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.plan_type := 'trial';
  NEW.plan_expires_at := now() + interval '7 days';
  RETURN NEW;
END;
$function$;
