# Build & Release — HN Mind Hub

كل الإعدادات (اسم التطبيق، النطاقات، الإصدار، أبعاد النافذة، الحزم الممنوعة قبل النشر) في **`build.config.json`**.
أي تعديل هنا ينعكس تلقائياً على: نشر الويب، بناء ديسكتوب (Electron)، وبناء أندرويد (Capacitor).

## 1. فحص ما قبل النشر (Preflight)

قبل أي نشر أو بناء تُشغَّل خطوة تحقق أوتوماتيكية:

```bash
node scripts/preflight.mjs            # نشر الويب
node scripts/preflight.mjs --desktop  # بناء .exe
node scripts/preflight.mjs --android  # بناء .apk
```

يفحص:
- وجود الملفات المطلوبة (`package.json`, `bun.lock`, root routes…)
- تزامن `bun.lock` مع `package.json`
- عدم تسرّب حزم البناء (`electron`, `@capacitor/*`) إلى `package.json` عند نشر الويب
- صحة `bun install --frozen-lockfile` (نفس الخطأ الذي كان يوقف Publishing)
- (وضعَي ديسكتوب/أندرويد) الوصول إلى النطاقات

عند وجود خطأ يُنهي بالكود `1` ويطبع السبب.

## 2. نشر الويب

يكفي زر Publish؛ لتشغيل الفحص يدوياً:
```bash
node scripts/preflight.mjs && bun run build
```

## 3. بناء ديسكتوب (.exe / linux)

```bash
node scripts/build-desktop.mjs win32   # افتراضي
node scripts/build-desktop.mjs linux
```

يقوم بـ:
1. preflight ديسكتوب
2. تجهيز مجلد بناء معزول في `/tmp/electron-build` (لا يلوّث تبعيات الويب)
3. تثبيت `electron` + `@electron/packager` هناك فقط
4. **Smoke test**: تشغيل Electron 6 ثوانٍ بشكل مؤقت للتأكد من عدم وجود أخطاء فادحة
5. تحزيم وضغط الناتج إلى `/mnt/documents/HN-Mind-Hub-<platform>-x64.zip`

الملفات المرافقة:
- `electron/main.cjs` — العملية الرئيسية، تقرأ `build.config.json` وتدعم تبديل النطاق
- `electron/index.html` — صفحة fallback عند فشل الاتصال

## 4. بناء أندرويد (.apk)

يستخدم Capacitor. يتطلّب JDK + Android SDK على جهازك (غير متوفر في هذه البيئة).

```bash
node scripts/build-android.mjs
cd android && ./gradlew assembleDebug
# ⇒ android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. التوسّع (Extensibility)

- **تغيير نطاق أو إضافة نطاق ثالث**: عدّل `build.config.json` → ينعكس على الديسكتوب والأندرويد والفحوصات معاً.
- **حظر تبعية جديدة قبل النشر**: أضفها إلى `publish.forbiddenDeps`.
- **إضافة منصة/معمارية ديسكتوب**: مرّر الاسم لـ `build-desktop.mjs` (`darwin`, `linux`…).
- **قواعد تحقق جديدة**: أضفها إلى `scripts/preflight.mjs` — كلها في مكان واحد.
