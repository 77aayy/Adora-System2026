# 🎯 تعليمات للشات الجديد - New Chat Instructions

> **انسخ هذا الملف كاملاً في بداية أي شات جديد**

---

## 📌 رسالة سريعة للمطور/AI

```
أنا أيمن، وأنا بشتغل على مشروع "Adora Hotel Management System" - نظام إدارة فنادق SaaS متكامل.

المشروع Production Ready وكل المهام الرئيسية مكتملة. أنا محتاجك تكون:
1. دقيق (Zero Guessing) - اختبر في المتصفح قبل ما تقول "تم"
2. مهندس (Architecture First) - Services للـ Firebase، Components للـ UI
3. آمن (Security First) - tenantId في كل Query، Atomic Transactions للعمليات الحرجة
4. ذكي (Update, Don't Recreate) - اقرأ PROJECT_CONTEXT.md قبل ما تضيف ميزة جديدة

اقرأ الملفات التالية بالترتيب:
1. PROJECT_SUMMARY.md - الوضع الحالي
2. WORKFLOW_GUIDE.md - طريقة العمل
3. PROJECT_CONTEXT.md - الميزات المكتملة
4. README.md - الوثائق التقنية (إذا احتجت تفاصيل)

مهم جداً: لو طلبت منك ميزة، تأكد إنها مش موجودة في PROJECT_CONTEXT.md أولاً.
```

---

## 📚 الملفات المهمة (اقرأها بالترتيب)

### 1. **`PROJECT_SUMMARY.md`** ⭐ ابدأ من هنا
- ملخص الوضع الحالي
- المهام المكتملة
- إحصائيات المشروع
- الملفات المهمة

### 2. **`WORKFLOW_GUIDE.md`** ⭐ مهم جداً
- طريقة العمل خطوة بخطوة
- المبادئ الأساسية (Zero Guessing, Architecture First, Security First)
- Checklist قبل الإرسال
- أخطاء شائعة وكيفية تجنبها
- أمثلة عملية

### 3. **`PROJECT_CONTEXT.md`** ⭐ للميزات
- قائمة الميزات المكتملة (لا تُعاد!)
- هيكل المشروع
- الملفات المهمة
- تحذيرات مهمة

### 4. **`README.md`** (اختياري - للتفاصيل التقنية)
- الوثائق التقنية الكاملة
- دورة حياة الطلب
- منطق الحماية
- مصفوفة الصلاحيات

---

## 🎯 المبادئ الأساسية (Core Principles)

### 1. Zero Guessing Policy
```
❌ ممنوع: "أعتقد أن الكود يعمل"
✅ مطلوب: "اختبرت في المتصفح وأرفق Screenshot"
```

### 2. Architecture First
```
❌ ممنوع: Firebase calls داخل Components
✅ مطلوب: جميع DB operations في @services/
```

### 3. Security First
```
❌ ممنوع: hardcode API Keys
✅ مطلوب: tenantId في كل Query، Atomic Transactions
```

### 4. Update, Don't Recreate
```
❌ ممنوع: إنشاء ميزة جديدة إذا كانت موجودة
✅ مطلوب: اقرأ PROJECT_CONTEXT.md أولاً
```

---

## ⚠️ تحذيرات مهمة

1. **Firebase قد يكون غير مهيأ**: أضف `if (!db) return defaultValue;`
2. **الـ Build يتخطى TypeScript check**: هذا متعمد
3. **Console Warnings طبيعية**: "Firebase not initialized" متوقع حتى يتم الإعداد

---

## 🚀 سير العمل (Workflow)

### عند طلب ميزة جديدة:
1. ✅ اقرأ `PROJECT_CONTEXT.md` - هل الميزة موجودة؟
2. ✅ ابحث في الكود عن أي إشارة
3. ✅ إذا موجودة → حدثها فقط
4. ✅ إذا غير موجودة → أضفها بنفس الأسلوب

### عند إصلاح Bug:
1. ✅ ابحث عن المشكلة في الكود
2. ✅ افحص Query في Service
3. ✅ تحقق من `tenantId` و `branchId` filters
4. ✅ اختبر في المتصفح + Screenshot

### عند إضافة ترجمة:
1. ✅ ابحث عن النص في الكود
2. ✅ أضف المفتاح في `src/locales/*.json` (4 ملفات)
3. ✅ استبدل النص بـ `t('key')` في Component
4. ✅ اختبر تغيير اللغة + Screenshot

---

## 📋 Checklist قبل الإرسال

### ✅ Code Quality
- [ ] لا يوجد `any` types
- [ ] جميع Firebase operations في Services
- [ ] Null checks موجودة
- [ ] `tenantId` و `branchId` في Queries

### ✅ Security
- [ ] لا يوجد hardcoded secrets
- [ ] Atomic Transactions للعمليات الحرجة
- [ ] Security Rules محدثة

### ✅ Testing
- [ ] اختبرت في المتصفح
- [ ] Screenshot متوفر
- [ ] Console نظيف من الأخطاء
- [ ] Dark Mode و Light Mode يعملان

---

## 💡 نصائح للنجاح

1. **اقرأ أولاً، اكتب ثانياً**
   - اقرأ `PROJECT_SUMMARY.md` قبل أي شيء
   - ابحث في الكود قبل إضافة ميزة جديدة

2. **اختبر دائماً**
   - لا تقل "تم" بدون Screenshot
   - اختبر في Dark Mode و Light Mode
   - اختبر على Mobile

3. **اتبع Architecture**
   - Services للـ Firebase
   - Hooks للـ Logic
   - Components للـ UI

4. **فكر في Security**
   - `tenantId` في كل Query
   - Atomic Transactions للعمليات الحرجة
   - لا hardcode secrets

---

## 🗂️ الملفات المهمة في الكود

### i18n System
- `src/i18n.ts` - إعداد i18n
- `src/components/common/LanguageSwitcher.tsx` - مكون اختيار اللغة
- `src/locales/*.json` - ملفات الترجمة (4 لغات)

### Security
- `src/services/secureAccessService.ts` - Token management
- `src/features/guest/GuestDashboard.tsx` - Token-only routing
- `firestore.rules` - Security rules

### Atomic Transactions
- `src/services/roomCardService.ts` - Check-in/Check-out
- `src/services/procurementService.ts` - Procurement workflow
- `src/services/laundryInventoryService.ts` - Laundry operations
- `src/services/lostFoundService.ts` - Lost & Found operations

### Multi-tenancy
- جميع Services في `src/services/` تحتوي على `tenantId` filters

---

## 📊 إحصائيات المشروع

| المقياس | القيمة |
|---------|--------|
| **Services مع Multi-tenancy** | 97 ملف |
| **Services مع Atomic Transactions** | 10 ملفات |
| **اللغات المدعومة** | 4 لغات (ar, en, hi, bn) |
| **Memory Leaks** | 0 |
| **Mobile Responsiveness** | 100% |
| **Scalability** | 500+ concurrent ops |

---

## 🎯 أمثلة عملية

### مثال 1: إضافة ميزة جديدة
```
المستخدم: "أضف زر X في صفحة Y"
```

**الخطوات:**
1. ✅ اقرأ `PROJECT_CONTEXT.md` - هل الميزة موجودة؟
2. ✅ ابحث عن `Y.tsx` في `src/features/`
3. ✅ أضف الزر في المكان المناسب
4. ✅ إذا احتاج Service → أضفه في `src/services/`
5. ✅ اختبر في المتصفح + Screenshot
6. ✅ حدث `PROJECT_CONTEXT.md` إذا كانت ميزة جديدة

---

### مثال 2: إصلاح Bug
```
المستخدم: "الطلبات لا تظهر في Tab X"
```

**الخطوات:**
1. ✅ ابحث عن `Tab X` في الكود
2. ✅ افحص Query في Service
3. ✅ تحقق من `tenantId` و `branchId` filters
4. ✅ اختبر في المتصفح + Screenshot
5. ✅ تأكد من أن الحل لا يكسر ميزات أخرى

---

## ✅ الخلاصة

**كن:**
- ✅ دقيق (Zero Guessing)
- ✅ مهندس (Architecture First)
- ✅ آمن (Security First)
- ✅ ذكي (Update, Don't Recreate)

**اقرأ:**
1. `PROJECT_SUMMARY.md`
2. `WORKFLOW_GUIDE.md`
3. `PROJECT_CONTEXT.md`

**اختبر:**
- دائماً في المتصفح
- دائماً Screenshot
- دائماً Dark/Light Mode

---

**آخر تحديث:** يناير 2026  
**بواسطة:** Ayman Abu Warda
