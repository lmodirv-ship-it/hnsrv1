# تثبيت تدفق المنظومة الرسمي

الهدف: جعل HN Service Hub يعمل بدقة وفق التدفق:
`User → أي موقع HN → TVCC → Hub → مزود الخدمة → Hub → TVCC → الموقع الطالب`

بحيث يكون TVCC هو البوابة (Gateway) و Hub هو العقل (Router/Orchestrator).

## المرحلة 1 — تعريف الأدوار في قاعدة البيانات

إضافة أعمدة على `sites`:
- `layer` (enum): `gateway` | `orchestrator` | `app` | `provider` | `infrastructure`
- `role` (نص): وصف الدور (مثال: "System Gateway", "Execution Brain")

تحديث بيانات المواقع:
- **TVCC** → `layer=gateway`, دور: بوابة الدخول والهوية والنشر
- **HN Service Hub** → `layer=orchestrator`, دور: العقل التنفيذي
- **HN Build / HN Apps / HN Chat** → `layer=app`
- **HN Video / HN Image / HN AI / HN Voice** → `layer=provider`
- **HN Core / HN DB / HN Cloud** → `layer=infrastructure`

## المرحلة 2 — فرض تدفق TVCC كبوابة

على مسارات `/api/public/v1/execute` و `/pipeline` و `/orchestrate`:
- إضافة تحقق من هوية المُرسل: يجب أن يكون الطلب صادرًا من TVCC أو موقع HN معتمد.
- استخراج ترويسة `x-hn-requester-site` (الموقع الأصلي الذي طلب) و `x-hn-gateway` (TVCC).
- تخزين الحقلين في `service_requests.requester_site` و `pipelines.requester_site`.
- رفض الطلبات التي لا تمر عبر TVCC (اختياري: عبر flag على api_client).

## المرحلة 3 — تدفق الإرجاع عبر TVCC

في response من Hub:
- إضافة `return_via: "tvcc"` وحقل `deliver_to: <requester_site>` في المخرجات.
- تسجيل خطوات الرحلة كاملة في `routing_decision`:
  ```
  { path: [
    { step: "received_from", site: "hn-build", via: "tvcc" },
    { step: "hub_routed_to", service: "hn-video" },
    { step: "returned_to", site: "tvcc" },
    { step: "delivered_to", site: "hn-build" }
  ]}
  ```

## المرحلة 4 — صفحة "System Flow" مرئية

صفحة جديدة `/system-flow` تعرض المخطط المرسوم من المستخدم:
- رسم بياني عمودي: User → Site → TVCC → Hub → Providers → Hub → TVCC → Site.
- إحصائيات حية على كل حافة: عدد الطلبات، متوسط الاستجابة، نسبة النجاح.
- ألوان حسب حالة كل طبقة (gateway / orchestrator / providers).

## المرحلة 5 — تحديث Capability Map و Network

- صفحة `network` تُعرض بحسب الطبقات (gateway/orchestrator/app/provider/infrastructure) بدل ترتيب مسطح.
- سهم كل طلب يمر بالضرورة عبر TVCC ثم Hub.

## تفاصيل تقنية

- Migration جديد (سيُقدم للموافقة): إضافة `layer` كـ enum + `role` text على `sites`، مع GRANT/RLS كما هي.
- Seed data: تحديث المواقع الحالية بالطبقات الصحيحة عبر `supabase--insert` بعد الترحيل.
- تعديل `hub-executor.server.ts` و `pipeline.server.ts` لقراءة `x-hn-requester-site` و `x-hn-gateway`.
- إضافة helper `verifyGateway(request)` يتحقق من مرور الطلب عبر TVCC.
- إضافة route `_authenticated.system-flow.tsx` مع مخطط SVG وإحصائيات من `service_requests`.

## ما لن يتغير

- منطق تقسيم المهام في `planSubtasks` يبقى كما هو.
- شكل المفاتيح والصلاحيات في `api_clients` / `api_keys` بدون تعديل.
- واجهات Pipelines/Subtasks/Providers تبقى كما هي مع إضافة عمود "via gateway".
