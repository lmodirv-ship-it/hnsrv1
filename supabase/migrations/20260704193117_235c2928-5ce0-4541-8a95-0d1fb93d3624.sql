
CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage platform settings" ON public.platform_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER platform_settings_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read actions" ON public.admin_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (key, value, description) VALUES
  ('payments_enabled',  '{"enabled": false}'::jsonb, 'تفعيل نظام المدفوعات (Paddle)'),
  ('discovery_auto',    '{"enabled": false, "interval_minutes": 60}'::jsonb, 'اكتشاف تلقائي دوري لخدمات المواقع'),
  ('mirror_auto',       '{"enabled": false, "interval_minutes": 30}'::jsonb, 'مزامنة تلقائية لمرايا قواعد البيانات'),
  ('agents_enabled',    '{"enabled": true}'::jsonb, 'تفعيل نظام الوكلاء (Agents)'),
  ('maintenance_mode',  '{"enabled": false, "message": ""}'::jsonb, 'وضع الصيانة — يُظهر شاشة "قيد الصيانة" للمستخدمين'),
  ('public_signup',     '{"enabled": true}'::jsonb, 'السماح بالتسجيل العام للمستخدمين الجدد')
ON CONFLICT (key) DO NOTHING;
