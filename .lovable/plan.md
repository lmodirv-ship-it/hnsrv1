# خطة بناء HN Service Hub — MVP

منصة مركزية لإدارة مواقع منظومة HN وخدماتها، مع لوحة تحكم ثنائية اللغة (عربي/إنجليزي) وAPI عام للمطورين الخارجيين.

## الحزمة التقنية
- TanStack Start + React + Tailwind + shadcn/ui
- Lovable Cloud (Postgres + Auth + Storage)
- Server Functions للـ API الداخلي، وServer Routes تحت `/api/public/v1/*` للـ API العام (مفاتيح API)
- i18n بسيط (context + JSON) مع دعم RTL/LTR ديناميكي

## الأدوار
- `admin`: إدارة كل شيء
- `developer`: يسجّل تطبيقاته، ينشئ مفاتيح API، يستهلك الخدمات
- `viewer`: قراءة فقط
(جدول `user_roles` منفصل مع enum + `has_role()` security definer)

## قاعدة البيانات (المخطط الأولي)

```text
sites              (id, name, slug, base_url, description, logo_url, owner_id, status, discovered_at)
services           (id, site_id, name, slug, category, endpoint_path, method, description, input_schema jsonb, output_schema jsonb, tags[], is_active)
api_clients        (id, owner_id, name, description, allowed_services[], rate_limit_per_min, created_at)
api_keys           (id, client_id, key_prefix, key_hash, secret_hash, scopes[], expires_at, revoked_at, last_used_at)
service_requests   (id, api_key_id, service_id, method, status_code, latency_ms, bytes_in, bytes_out, error, created_at)
service_health     (id, service_id, checked_at, status, latency_ms, error)
discovery_jobs     (id, url, status, result jsonb, error, requested_by, created_at)
knowledge_entries  (id, site_id, kind, content jsonb) -- قاعدة معرفة أولية
user_roles         (id, user_id, role app_role)
```
GRANTs + RLS لكل جدول (RLS: صاحب المورد + admin؛ قراءة عامة فقط للـ services المُعلنة).

## الشاشات (MVP)

1. **Auth** — `/auth` تسجيل/دخول (بريد + كلمة مرور + Google)
2. **Dashboard** `/` — عدّاد المواقع/الخدمات، حالة النظام، آخر الطلبات، الأخطاء
3. **Sites** `/sites` — قائمة + بطاقة تعريف لكل موقع + إضافة يدوية
4. **Site Detail** `/sites/$slug` — معلومات + شجرة الخدمات + إحصاءات
5. **Services** `/services` — بحث/فلترة عبر جميع الخدمات + تصنيفات
6. **Discovery** `/discovery` — إدخال URL → job → نتيجة (عنوان، وصف، APIs مكتشفة، اقتراح تسجيل)
7. **Orchestrator** `/orchestrator` — Playground: تصف ما تحتاجه → يقترح أفضل خدمة → ينفّذ عبر gateway
8. **API Console** `/api-console` — تطبيقات المطوّر، مفاتيح API/Secret، السكوبات، حدود الاستخدام، سجلات الطلبات
9. **Monitoring** `/monitoring` — حالة online/offline لكل خدمة، سرعة، أخطاء، رسوم بيانية
10. **Knowledge** `/knowledge` — استعراض ما تعرفه المنصة عن كل موقع/خدمة
11. **Settings** `/settings` — بروفايل، اللغة، الفريق

## خدمات النظام (Server)

- `sites.functions.ts`: CRUD للمواقع
- `services.functions.ts`: CRUD + بحث دلالي (نصي بدايةً)
- `discovery.functions.ts`: يجلب URL، يحلل HTML/robots.txt/openapi.json، يستخرج بطاقة تعريف
- `orchestrator.functions.ts`: يستقبل intent → يختار خدمة (rules + tags) → ينفّذ عبر HTTP proxy
- `apiKeys.functions.ts`: توليد مفاتيح (prefix + secret) وتخزين hash فقط
- `monitoring.functions.ts`: فحص دوري (server route + cron خارجي لاحقاً)
- `/api/public/v1/orchestrate` (server route): يوثّق بـ API key، يوجّه للخدمة، يسجّل الطلب

## الأمن
- تخزين مفاتيح كـ hash فقط، يُعرض السر مرة واحدة عند الإنشاء
- تحقق التوقيع للطلبات الواردة (HMAC اختياري)
- Rate limiting بسيط داخل التطبيق (عدّاد لكل مفتاح/دقيقة في جدول requests)
- RLS صارم + `has_role()` لكل عملية admin

## اللغة
- context `LanguageProvider` مع `ar`/`en`، يبدّل `dir` على `<html>`
- ملفات ترجمة `src/i18n/ar.json` و`en.json`
- خطوط: `@fontsource/cairo` (عربي) + `@fontsource/inter` (إنجليزي)

## التصميم
- Dark-first، لوحة زرقاء/سماوية توحي بـ"عقل مركزي"
- Sidebar ثابت + Topbar
- بطاقات إحصائية + مخططات (recharts)

## نطاق خارج MVP (مرحلة تالية)
Knowledge Base ذكية بالـ AI، Service Map تفاعلية، AI Coordinator، OAuth للمستخدمين النهائيين، تحليلات متقدمة، فحص دوري تلقائي عبر cron.

## مراحل التنفيذ
1. تفعيل Lovable Cloud + Auth + جداول + RLS + أدوار
2. Layout ثنائي اللغة + Sidebar + Auth flow
3. Sites + Services (CRUD + شاشات)
4. API Console (مفاتيح + سجل طلبات)
5. Discovery (تحليل URL أساسي)
6. Orchestrator + `/api/public/v1/orchestrate`
7. Monitoring (فحص عند الطلب + رسم بياني)
8. Dashboard + Knowledge (عرض تجميعي)

هل أبدأ التنفيذ بهذا المخطط؟
