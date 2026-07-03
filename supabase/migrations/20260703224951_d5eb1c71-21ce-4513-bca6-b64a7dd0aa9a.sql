
-- Switch has_role to SECURITY INVOKER; user_roles RLS allows self-read so RLS calls still work
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Restrict hub_integrations UPDATE to admins
DROP POLICY IF EXISTS "Authenticated can update hub integrations" ON public.hub_integrations;
CREATE POLICY "Admins can update hub integrations"
ON public.hub_integrations
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
