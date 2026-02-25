-- Fix: resellers with no master (self-registered) should check their own plan
CREATE OR REPLACE FUNCTION public.is_master_plan_active(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    CASE
      WHEN is_super_admin(_user_id) THEN true
      WHEN has_role(_user_id, 'panel_admin') THEN is_plan_active(_user_id)
      WHEN has_role(_user_id, 'reseller') THEN 
        COALESCE(
          (SELECT 
            CASE 
              WHEN r.created_by IS NULL THEN is_plan_active(_user_id)
              ELSE is_plan_active(r.created_by)
            END
           FROM public.resellers r WHERE r.owner_user_id = _user_id LIMIT 1),
          is_plan_active(_user_id)
        )
      ELSE true
    END
$$;