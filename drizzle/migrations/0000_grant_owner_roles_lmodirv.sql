INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (VALUES ('admin'::app_role), ('developer'::app_role), ('viewer'::app_role)) AS r(role)
WHERE lower(u.email) = 'lmodirv@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.profiles (id, email, display_name)
SELECT u.id, u.email, split_part(u.email, '@', 1)
FROM auth.users u
WHERE lower(u.email) = 'lmodirv@gmail.com'
ON CONFLICT (id) DO NOTHING;