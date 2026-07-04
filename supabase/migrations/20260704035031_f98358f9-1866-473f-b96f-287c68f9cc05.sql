
-- Create lmodirv@gmail.com user with password and assign admin/owner role to both accounts
DO $$
DECLARE
  v_lmodirv_id uuid;
  v_taltnamart_id uuid := 'fe2cd139-8e9c-4eb0-acaf-fc30c9ea8dae';
BEGIN
  SELECT id INTO v_lmodirv_id FROM auth.users WHERE email = 'lmodirv@gmail.com';

  IF v_lmodirv_id IS NULL THEN
    v_lmodirv_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_lmodirv_id, 'authenticated', 'authenticated',
      'lmodirv@gmail.com', crypt('Hiba@1982nn', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Owner"}'::jsonb,
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_lmodirv_id,
            jsonb_build_object('sub', v_lmodirv_id::text, 'email', 'lmodirv@gmail.com', 'email_verified', true),
            'email', v_lmodirv_id::text, now(), now(), now());
  ELSE
    UPDATE auth.users
    SET encrypted_password = crypt('Hiba@1982nn', gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = v_lmodirv_id;
  END IF;

  -- Ensure profile rows
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (v_lmodirv_id, 'lmodirv@gmail.com', 'Owner')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, display_name)
  VALUES (v_taltnamart_id, 'taltnamart@gmail.com', 'Owner')
  ON CONFLICT (id) DO NOTHING;

  -- Grant admin (highest) role to both. app_role enum: admin/developer/viewer
  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_lmodirv_id, 'admin'),
    (v_lmodirv_id, 'developer'),
    (v_lmodirv_id, 'viewer'),
    (v_taltnamart_id, 'admin'),
    (v_taltnamart_id, 'developer'),
    (v_taltnamart_id, 'viewer')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
