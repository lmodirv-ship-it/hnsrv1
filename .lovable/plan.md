
# جعل هذا الموقع "قلب المنظومة" الخفي

الهدف: كل موقع في المجموعة يرسل طلبه إلى هذا الموقع فقط، ونحن نختار الخدمة المناسبة، ننفّذها على موقع الخدمة، ونعيد النتيجة كاملة للمرسِل — دون أن يعرف المستخدم النهائي مَن نفّذ الطلب.

## الوضع الحالي
- يوجد فعلاً `POST /api/public/v1/orchestrate` يتحقق من مفتاح API ويختار الخدمة، **لكنه يُرجع فقط عنوان الوجهة ولا ينفّذ الطلب** ("Proxy execution arrives in v2").
- جداول `api_clients` / `api_keys` / `service_requests` جاهزة، وسجّلنا سابقاً كل المواقع كـ Mesh.
- `sites.metadata` يحوي `keyEnv` / `urlEnv` لخدمات HN.

## ما سنبنيه

### 1) بوابة تنفيذ حقيقية `POST /api/public/v1/execute`
مسار جديد أنظف من `orchestrate` (نُبقي `orchestrate` كـ dry-run للاستكشاف).

المدخلات:
```json
{
  "intent": "ولّد شعار لمتجري",   // أو
  "service_id": "uuid",
  "method": "POST",                 // اختياري، الافتراضي من تعريف الخدمة
  "path": "/generate",              // اختياري لإلحاقه بمسار الخدمة
  "payload": { ... },               // جسم الطلب للخدمة النهائية
  "query": { "lang": "ar" },        // اختياري
  "timeout_ms": 20000               // اختياري (سقف 30s)
}
```

سلوك المعالج:
1. تحقق من `Authorization: Bearer hn_xxx.secret` (كما هو اليوم) + Rate limit.
2. تحديد الخدمة: `service_id` أو أفضل تطابق من `intent`.
3. تحديد الوجهة: `service.endpoint_url` أو `sites.base_url + endpoint_path (+ path)`، حسب `routing_mode` (`direct` / `via_tvcc` / `auto/gateway`).
4. **حقن اعتماد HN إن وُجد**: قراءة `sites.metadata.keyEnv` والبحث في `process.env` — إن وُجد يُضاف `Authorization: Bearer <value>` أو `x-api-key` للطلب الخارج (يبقى مخفياً عن المُنادي).
5. تنفيذ `fetch` بـ `AbortController` (الافتراضي 15s):
   - Forward: method, query, JSON body، إضافة `X-HN-Request-Id`, `X-Forwarded-For`, `User-Agent: HN-Hub/1.0`.
   - **Strip**: كل رؤوس المُنادي (خصوصاً `authorization`، ملفات الكوكيز) قبل التمرير — الموقع يعمل باسمه هو، لا باسم المُنادي.
6. قراءة الاستجابة (JSON أو text)، حساب `latency_ms`, `status_code`.
7. سجل صف في `service_requests` (نجاح/فشل، bytes، خطأ).
8. الرد للمُنادي:
```json
{
  "ok": true,
  "request_id": "uuid",
  "service": { "id": "...", "name": "..." },
  "status": 200,
  "latency_ms": 812,
  "data": { ... }        // ناتج الخدمة كما هو
}
```
لا نُرجع `url` الحقيقي ولا مفاتيح HN — الموقع خفي.

### 2) مسار مساعد ذكي `POST /api/public/v1/ask`
واجهة مبسّطة موحّدة لمواقع HN:
```json
{ "prompt": "حوّل هذا النص إلى صوت عربي: مرحبا" }
```
يبني internally: `findServiceByIntent(prompt)` → `execute` → يعيد النتيجة. مفيد كي لا يحتاج أي موقع HN لمعرفة كتالوج الخدمات.

### 3) إصدار مفاتيح تلقائية لمواقع HN (Auto-provisioning)
سكربت/زر في لوحة API Console: "أصدر مفاتيح لكل مواقع Mesh":
- لكل موقع في `sites` بحالة Mesh ينشئ `api_clients` (إن لم يوجد) و `api_keys` بصلاحيات `allowed_services = null` (الكل) وحدّ 120 req/min.
- يُخزّن المفتاح مرة واحدة في `sites.metadata.hn_hub_key` للعرض في اللوحة (النص الخام يظهر مرة واحدة فقط).

### 4) واجهة "سجل الطلبات المباشر" في `/orchestrator`
لوحة صغيرة تعرض آخر 50 صفاً من `service_requests` (client → service → status → latency) لمراقبة عمل القلب الخفي.

### 5) توثيق قصير في `/api-console`
Snippet جاهز يوضح لأي موقع HN كيف يستدعي البوابة:
```bash
curl -X POST https://<hub>/api/public/v1/ask \
  -H "Authorization: Bearer hn_xxx.yyy" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"ولّد شعار متجري"}'
```

## ملاحظات تقنية

- **Runtime**: كل شيء داخل `createFileRoute('/api/public/v1/*')` — يعمل على Cloudflare Worker، `fetch` مدعوم أصلاً، لا حاجة لأي مكتبة إضافية.
- **الأمان**:
  - رفض تحويل الطلب إن كانت الخدمة غير معتمدة (`approval_status='approved'` و `is_active=true`).
  - رفض إن كان `sites.base_url` غير https (خيار قابل للتعطيل).
  - Timeout إجباري لتفادي تعليق العامل.
- **السرية**: لا نُرجع للمُنادي `endpoint_url` أو `base_url` أو أي رأس أعلى. حتى رسائل الخطأ من الخدمة النهائية تُلَفّ:
  `{ ok:false, status:502, error:"Upstream service failed" }` مع تفاصيل حقيقية فقط في `service_requests` (للوحة الإدارة).
- **بدون تغيير UI ظاهر للمستخدم النهائي** — البوابة تعمل خلف الكواليس.

## الملفات المتأثرة

- إنشاء: `src/routes/api/public/v1/execute.ts`, `src/routes/api/public/v1/ask.ts`
- تعديل: `src/lib/apiClients.functions.ts` (إضافة `provisionMeshKeys`)
- تعديل: `src/routes/_authenticated.api-console.tsx` (زر إصدار مفاتيح Mesh + Snippet)
- تعديل: `src/routes/_authenticated.orchestrator.tsx` (سجل الطلبات الحيّ)

لا تغييرات على مخطط قاعدة البيانات — كل الجداول موجودة.
