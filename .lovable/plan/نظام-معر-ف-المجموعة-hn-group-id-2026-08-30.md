# نظام معرّف المجموعة (HN Group ID)

هدف: إعطاء كل موقع/خدمة داخل مجموعة HN رقم هوية فريد بصيغة حرف + ستة أرقام (مثل `H000001`)، يُسجَّل في قاعدة البيانات مع اسم الخدمة ورقمها والموقع، ويمكن وضعه في أي موقع مع زر "اتصال" يرسل إشارة إلى TVCC باعتبارها مركز المجموعة ومالكة اللائحة.

## ما سيراه المستخدم

1. صفحة جديدة **الهويات (Group IDs)** داخل لوحة التحكم:
   - جدول بكل الهويات: الرمز، اسم الخدمة، رقم الخدمة، الموقع، الرابط، الحالة، آخر إشارة.
   - زر "إصدار هوية جديدة" يختار موقعاً/خدمة ويولّد رمزاً فريداً.
   - لكل صف: نسخ الرمز، ونسخ **كود التضمين** (سطر HTML/JS صغير) يمكن لصقه في أي موقع.
2. كود التضمين يعرض شارة صغيرة فيها الرمز وزر **اتصال**؛ عند الضغط ترسل إشارة إلى الـ Hub الذي يمرّرها إلى TVCC، ثم تتحول الشارة إلى "متصل".
3. في لوحة التحكم تظهر آخر إشارة ونتيجة إبلاغ TVCC لكل هوية.

## التفاصيل التقنية

### قاعدة البيانات (migration جديدة)
- جدول `group_identifiers`:
  `id`, `code` (unique, نمط `^[A-Z][0-9]{6}$`), `service_number` (int متسلسل), `service_name`,
  `site_id` (FK → sites, nullable), `service_id` (FK → services, nullable), `site_url`,
  `status` (`issued|connected|revoked`), `last_signal_at`, `last_tvcc_status`, `last_tvcc_response` jsonb,
  `created_by`, `created_at`, `updated_at`.
- جدول `group_identifier_signals`: `id`, `identifier_id` FK, `origin`, `ip_hash`, `user_agent`,
  `forwarded_to_tvcc` bool, `tvcc_status`, `payload` jsonb, `created_at`.
- GRANT لكل جدول: `authenticated` (SELECT) و`service_role` (ALL)؛ لا صلاحيات لـ `anon`.
- RLS: القراءة للمستخدمين المسجّلين، الكتابة/التعديل للأدمن فقط عبر `has_role(auth.uid(),'admin')`.
- دالة `next_group_identifier()` (security definer) تولّد الرمز التالي بالتسلسل مع قفل لتفادي التكرار.

### الخادم
- `src/lib/group-identity.functions.ts` (server functions محمية):
  `listIdentifiers`, `issueIdentifier`, `revokeIdentifier`, `listSignals`.
- `src/routes/api/public/v1/identity.$code.ts` — `GET` عام: يعيد الرمز واسم الخدمة والموقع والحالة فقط (بدون بيانات حساسة) للتحقق من الملكية. CORS مفتوح.
- `src/routes/api/public/v1/identity.announce.ts` — `POST` عام + `OPTIONS`:
  يستقبل `{ code, origin }`، يتحقق من وجود الرمز وأنه غير ملغى، يسجّل الإشارة،
  ثم يرسل إشعاراً إلى TVCC على `${TVCC_API_URL}/api/public/hn/announce` بترويسة توقيع
  (HMAC بمفتاح موجود أو `HN_HUB_VERIFICATION_SALT`)، ويحدّث `status` إلى `connected`.
  فشل TVCC لا يُفشل الطلب؛ يُسجَّل في `last_tvcc_status`.
  حماية: تحقق من صيغة الرمز، حد معدل بسيط لكل رمز (إشارة كل 10 ثوانٍ).
- `src/routes/api/public/v1/identity.embed[.]js.ts` — يقدّم سكربت التضمين الصغير الذي يرسم الشارة والزر.

### الواجهة
- `src/routes/_authenticated.identities.tsx` — الجدول والإصدار والنسخ وسجل الإشارات.
- إضافة الرابط في القائمة الجانبية في `src/components/app-shell.tsx`.
- استخدام مكوّنات shadcn الموجودة وتوكنات التصميم الحالية، بدون ألوان مباشرة.

### ملاحظات
- `TVCC_API_URL` من الأسرار؛ إن لم يكن مضبوطاً تُسجَّل الإشارة محلياً فقط مع حالة `tvcc_unconfigured`.
- الرابط العام يعمل بعد نشر التطبيق على `hnsrv1.lovable.app`.
