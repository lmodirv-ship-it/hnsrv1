CREATE TABLE IF NOT EXISTS public.protected_admins (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.protected_admins TO authenticated;
GRANT ALL ON public.protected_admins TO service_role;

ALTER TABLE public.protected_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read protected admins"
ON public.protected_admins FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.protected_admins (email, note) VALUES
  ('info@hnchat.net', 'owner'),
  ('lmodirv@gmail.com', 'owner')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_protected_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.protected_admins p ON lower(u.email) = lower(p.email)
    WHERE u.id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.is_protected_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_protected_admin(uuid) TO authenticated, service_role;

-- grant admin (and viewer/developer full set) to existing protected users
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
JOIN public.protected_admins p ON lower(u.email) = lower(p.email)
CROSS JOIN (VALUES ('admin'::public.app_role), ('developer'::public.app_role), ('viewer'::public.app_role)) AS r(role)
ON CONFLICT (user_id, role) DO NOTHING;

-- block removing/altering protected admin roles
CREATE OR REPLACE FUNCTION public.protect_admin_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_protected_admin(OLD.user_id) THEN
    RAISE EXCEPTION 'Protected owner account: role cannot be changed or removed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_admin_roles() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_protect_admin_roles ON public.user_roles;
CREATE TRIGGER trg_protect_admin_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_admin_roles();

-- auto-grant on future signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  IF EXISTS (SELECT 1 FROM public.protected_admins p WHERE lower(p.email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'), (NEW.id, 'developer'), (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'developer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;