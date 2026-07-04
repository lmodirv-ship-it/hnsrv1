
## الرؤية

`الموقع → التحليل → الخدمات → الشبكة`

الخدمة لا توجد إلا داخل موقع. التحليل يبدأ من صفحة تفاصيل الموقع. الاكتشاف يصبح **سجلًا** فقط. تُضاف صفحة **شبكة الخدمات** لعرض من يقدّم، من يستهلك، ومن يعتمد.

---

## المرحلة 1 — صفحة تفاصيل الموقع (المحور)

توسيع `/sites/$slug` لتصبح لوحة تحكم كاملة للموقع بتبويبات:

- **نظرة عامة** — Logo، URL، الحالة، التصنيف، الوصف، آخر فحص، درجة الصحة.
- **الخدمات** — جدول الخدمات المرتبطة بهذا الموقع (approved / pending / rejected) مع أزرار موافقة/رفض/تعديل.
- **API** — endpoints، المفاتيح، سجل الطلبات الأخير.
- **قاعدة المعرفة** — ملخص محتوى الموقع، الكلمات المفتاحية، الروابط المهمة.
- **الصحة** — history للفحوصات، uptime، آخر خطأ.
- **الملفات / قواعد البيانات / Dependencies** — كل ما اكتشفه المحلل.
- **زر "تحليل هذا الموقع الآن"** بارز في الأعلى — يشغّل المحلل ويحفظ تقريرًا جديدًا.

## المرحلة 2 — محرّك التحليل التلقائي المتقدم

توسيع `discoverSite` ليصبح محللًا شاملًا يجمع في تقرير واحد:

1. الصفحة الرئيسية (title, meta, description, og).
2. صفحات مهمة: `/about`, `/services`, `/products`, `/docs`, `/features`, `/pricing`.
3. APIs: `/api`, `/api/docs`, `/openapi.json`, `/swagger.json`.
4. تحليل JavaScript المستخرَج (كشف Framework: React/Vue/Next/…).
5. `robots.txt` و `sitemap.xml`.
6. روابط الخدمات الداخلية.
7. استنتاج نوع الموقع + قائمة الخدمات + التصنيف + Endpoints المحتملة + درجة الثقة.
8. **استنتاج التبعيات تلقائيًا**: البحث في المحتوى/JS/الروابط عن إشارات لـ HN-DB، HN-Cloud، TVCC، HN-Core، HN-AI وتخزينها كعلاقات.

نتيجة التحليل تُحفَظ في `discovery_jobs.result` وتظهر مباشرة داخل تبويب "تحليل الموقع" في صفحة الموقع، مع إمكانية "قبول كل الخدمات" أو انتقاء ما يُقبَل.

## المرحلة 3 — جدول الخدمات المُحسَّن

تعديل `/services` ليصبح جدولًا موحّدًا بالأعمدة:

`الموقع | الخدمة | التصنيف | Endpoint | API | الحالة | يستخدمها (عدد) | يعتمد على`

- عمود "يستخدمها" = عدد المواقع المستهلِكة.
- عمود "يعتمد على" = شارات للأنظمة/الخدمات المُعتمَد عليها (HN Cloud، HN DB…).
- كل صف قابل للتوسع لعرض تفاصيل العلاقة.

## المرحلة 4 — صفحة شبكة الخدمات `/network`

صفحة مستقلة جديدة في القائمة الجانبية:

```text
HN Builder
   ├── Logo Generator ──▶ HN AI
   ├── APK Builder ─────▶ HN Cloud, HN DB
   └── Website Builder ─▶ TVCC, HN Core, HN Cloud
```

- عرض شجري تفاعلي (قابل للطي) لكل موقع → خدماته → تبعياته.
- بحث/تصفية حسب الموقع أو التصنيف.
- عند الضغط على خدمة: يظهر panel جانبي بـ (من يقدمها، من يستهلكها، من يعتمد عليها، تأثير التوقف).
- الشبكة **تلقائية بالكامل** من مخرجات المحلل — لا تحرير يدوي.

## التفاصيل التقنية

### قاعدة البيانات

جدول جديد `service_dependencies`:

```
id, service_id (FK), depends_on_service_id (FK nullable),
depends_on_system text nullable,     -- 'hn-cloud' | 'hn-db' | 'tvcc' | 'hn-core' | 'hn-ai'
consumer_site_id (FK nullable),      -- لتسجيل الاستهلاك
relation_type text,                  -- 'depends_on' | 'consumes'
confidence int, source text, created_at
```

- GRANT لـ authenticated + service_role.
- RLS: قراءة للمصادَقين، كتابة لـ developer/admin.
- Unique(service_id, depends_on_service_id, depends_on_system, consumer_site_id).

### التعديلات على الملفات

- `src/lib/discovery.functions.ts` — إضافة كاشف framework وكاشف تبعيات + كتابة `service_dependencies` تلقائيًا.
- `src/lib/services.functions.ts` — `listServicesWithRelations` يجمع counts و dependencies.
- `src/lib/network.functions.ts` (جديد) — `getServiceNetwork()` يعيد بنية شجرية sites→services→deps.
- `src/routes/_authenticated.sites.$slug.tsx` — إعادة تصميم بتبويبات + زر التحليل + عرض التقرير داخل الصفحة.
- `src/routes/_authenticated.services.tsx` — أعمدة "يستخدمها" و"يعتمد على".
- `src/routes/_authenticated.network.tsx` (جديد) — الشجرة التفاعلية.
- `src/routes/_authenticated.discovery.tsx` — تبقى **سجلًا** للعمليات السابقة فقط (بدون زر تحليل جديد؛ التحليل ينتقل داخل الموقع).
- `src/components/app-shell.tsx` — إضافة "شبكة الخدمات" للقائمة، تعديل تسمية "الاكتشاف" إلى "سجل التحليل".
- `src/i18n/translations.ts` — مفاتيح جديدة (navNetwork, analyzeSite, dependencies, consumers, …).

### ملاحظات

- التبعيات تُستنتَج بقواعد نصية أولًا (regex + دلائل مثل ذكر `hn-db.fun`, `hn-cloud`, `tvcc`)؛ يمكن توسيعها لاحقًا بـ AI.
- كل تحليل يعيد كتابة تبعيات الموقع (upsert + soft delete للقديمة) لتبقى الشبكة محدَّثة.
