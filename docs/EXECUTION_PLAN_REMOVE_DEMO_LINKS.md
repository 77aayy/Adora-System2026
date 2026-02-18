# خطة تنفيذية: حذف تبويب روابط الديمو وكل الكود المرتبط

## الهدف
تخفيف المشروع وتسريع استجابته بإزالة ميزة "روابط الديمو" (إنشاء/إدارة روابط الديمو من لوحة المالك) وكل الكود والمراجع المرتبطة بها.

## ملاحظة
- **لا يُحذف:** صفحة `/demo` و `/demo-access` و `DemoEntry` و `demoFactory` — تبقى للدخول التجريبي المباشر (مفتاح/tenantId).
- **يُحذف:** التبويب، واجهة إدارة الروابط، خدمة روابط الديمو، ومراجع مجموعة `demoLinks`.

---

## المراحل

### 1. لوحة المالك (EnhancedOwnerDashboard)
- حذف `TabType`: إزالة `'demo'` من النوع.
- حذف القيمة الافتراضية `demo: true` من `visibleTabs`.
- حذف عنصر التبويب `{ id: 'demo', ... }` من مصفوفات التبويبات (الموبايل والديسكتوب).
- حذف استيراد `DemoLinkManager`.
- حذف البلوك `{activeTab === 'demo' && <DemoLinkManager ... />}`.
- حذف التعليق المرتبط بـ demoLinkService إن وُجد.

### 2. الشريط الجانبي (AdminSidebar)
- حذف عنصر القائمة `{ to: '/owner-dashboard?tab=demo', icon: Share2, label: t('admin.demoLinks') }` من مصفوفة عناصر المالك.

### 3. حذف الملفات
- حذف `src/components/owner/DemoLinkManager.tsx`
- حذف `src/services/demoLinkService.ts`

### 4. قواعد Firestore ومراجع الخدمات
- **firestore.rules:** إزالة أو تعليق بلوك `match /demoLinks/{linkId}` (أو ترك `allow read, write: if false` لتأمين المجموعة).
- **deepAuditService.ts:** إزالة `'demoLinks'` من قائمة المجموعات في الفحص.
- **systemSettingsService.ts:** إزالة `demo?: boolean` من نوع `visibleTabs` إن وُجد.

### 5. عينات قواعد Firestore في الواجهة
- **CoreConfigTemplate.tsx:** إزالة السطر `match /demoLinks/{linkId}` من النص النموذجي.
- **FirebaseSetupWizard.tsx:** نفس الشيء.
- **FirebaseSettingsPage.tsx:** نفس الشيء.

### 6. (اختياري) الترجمات
- إزالة أو ترك مفاتيح `admin.demoLinks` و `demoLink.*` في `ar.json` و `en.json` — تركها لا يسبب أخطاء.

### 7. التحقق
- تشغيل `read_lints` على الملفات المعدّلة.
- التأكد من عدم وجود استيراد متبقي لـ `DemoLinkManager` أو `demoLinkService`.

---

## ما يبقى دون تغيير
- **DemoEntry** ومسارات `/demo`, `/demo-access` (دخول تجريبي بمفتاح أو tenantId).
- **demoFactory** (إنشاء نسخة تجريبية وتسجيل دخول مدير الديمو).
- **firebaseMulti** — تم حذف الملف بالكامل (كان dead code بعد حذف demoLinkService).
