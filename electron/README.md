# HN Mind Hub — Desktop (Electron)

نسخة سطح مكتب تُحمّل التطبيق المنشور مباشرة (بما فيه الخادم/Backend الفعلي على Lovable Cloud).

## التطوير المحلي
```
npm install
npx electron electron/main.cjs
```

## تغيير عنوان التطبيق
عيّن متغير البيئة قبل التشغيل:
```
HN_APP_URL=https://project--892acedb-f163-43b3-a41c-ae19a7797c11-dev.lovable.app npx electron electron/main.cjs
```

## إعادة البناء لـ Windows
```
npx @electron/packager . "HN-Mind-Hub" --platform=win32 --arch=x64 \
  --out=electron-release --overwrite --ignore='node_modules' \
  --ignore='^/src' --ignore='^/public' --ignore='^/electron-release' \
  --ignore='^/supabase' --ignore='^/dist'
```
