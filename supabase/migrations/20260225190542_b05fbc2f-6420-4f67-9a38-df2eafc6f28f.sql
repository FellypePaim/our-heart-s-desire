
-- Allow masters to update profiles of their resellers (for plan renewal)
CREATE OR REPLACE FUNCTION public.is_reseller_of_master(_reseller_user_id uuid, _master_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resellers
    WHERE owner_user_id = _reseller_user_id
      AND created_by = _master_user_id
  )
$$;

CREATE POLICY "Masters can update reseller profiles for plan renewal"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'panel_admin') 
  AND is_reseller_of_master(user_id, auth.uid())
);
