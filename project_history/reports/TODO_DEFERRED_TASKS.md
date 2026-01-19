# 📋 المهام المؤجلة للتنفيذ - TODO DEFERRED TASKS

**تاريخ الإنشاء:** 2026-01-16  
**المشروع:** Adora Hotel Management System  
**الإصدار:** 3.5.0 → 3.6.0  
**الحالة:** ⏸️ **مؤجلة للصباح إن شاء الله**

---

## 🎯 المهام المؤجلة (2 مهام)

### 📊 جدول المهام

| # | المهمة | الأولوية | التقدير | الحالة |
|---|--------|----------|----------|--------|
| **1️⃣** | **Hardcoded Strings Audit** | 🟢 منخفضة | 2-3 ساعات | ⏸️ في الانتظار |
| **2️⃣** | **Console Cleanup** | 🟢 منخفضة | 4-6 ساعات | ⏸️ في الانتظار |

**المجموع:** 6-9 ساعات

---

## 1️⃣ Hardcoded Strings Audit

**الهدف:** فحص واستبدال النصوص الثابتة (hardcoded Arabic/English strings) بـ i18n keys

**الخطوات:**
1. ✅ **الفحص الأولي** - البحث عن النصوص الثابتة في `src/` (30 ملف)
2. ✅ **التصنيف** - تصنيف النصوص حسب الأولوية (حرجة/متوسطة/منخفضة)
3. ✅ **الإضافة** - إضافة مفاتيح i18n في `src/locales/ar.json` و `en.json`
4. ✅ **الاستبدال** - استبدال النصوص الثابتة بـ `t('key')` في الملفات
5. ✅ **الاختبار** - التأكد من عمل الترجمة بشكل صحيح

**الملفات المستهدفة:**
- `src/components/`
- `src/features/`
- `src/pages/`
- `src/services/` (رسائل الأخطاء فقط)

**الاستراتيجية:**
- التركيز على **User-Facing Strings** فقط (رسائل للمستخدم)
- تجاهل **Development Strings** (تعليقات، console messages)
- تجاهل **Technical Strings** (أسماء متغيرات، keys)

**التأثير:** تحسين i18n coverage

---

## 2️⃣ Console Cleanup

**الهدف:** استبدال 1476 استخدام لـ `console.*` بـ `loggerService`

**الخطوات:**
1. ✅ **التحليل** - تحليل أنواع `console.*` (log/warn/error/debug/info)
2. ✅ **التصنيف** - تصنيف حسب الأولوية (أخطاء حرجة → معلومات تطوير)
3. ✅ **الاستبدال التلقائي** - استبدال `console.error` → `logger.error`
4. ✅ **المراجعة** - مراجعة يدوية للأخطاء الحرجة
5. ✅ **الاختبار** - التأكد من عمل `loggerService` في Production

**الملفات المستهدفة:**
- `src/**/*.ts` (258 ملف)
- `src/**/*.tsx`

**الاستراتيجية:**
- **console.error** → `logger.error` (أولوية عالية)
- **console.warn** → `logger.warn` (أولوية متوسطة)
- **console.log** → `logger.info` (أولوية منخفضة)
- **console.debug** → `logger.debug` (تطوير فقط - يمكن حذفها)

**التأثير:** تحسين تجربة التطوير (DX)

---

## 🎯 الترتيب الموصى به

### **1️⃣ Hardcoded Strings Audit أولاً**
- ✅ أسهل وأسرع (2-3 ساعات)
- ✅ تأثير مباشر على UX
- ✅ أقل خطورة

### **2️⃣ Console Cleanup ثانياً**
- ⏸️ أكبر وأطول (4-6 ساعات)
- ⏸️ يحتاج مراجعة دقيقة
- ⏸️ `loggerService` يعمل بالفعل في Production

---

## 📝 ملاحظات

- ✅ **خطة التنفيذ:** جاهزة في `DEFERRED_TASKS_EXECUTION_PLAN.md`
- ✅ **loggerService:** موجود وجاهز في `src/services/loggerService.ts`
- ✅ **i18n System:** موجود وجاهز (`src/locales/ar.json`, `en.json`)

---

## ✅ معايير الإنجاز

### **Hardcoded Strings Audit:**
- ✅ فحص شامل لـ `src/` (30 ملف)
- ✅ إضافة جميع المفاتيح المفقودة في `ar.json` و `en.json`
- ✅ استبدال النصوص الثابتة بـ `t()`
- ✅ اختبار الترجمة (AR/EN)

### **Console Cleanup:**
- ✅ استبدال `console.error` → `logger.error`
- ✅ استبدال `console.warn` → `logger.warn`
- ✅ استبدال `console.log` → `logger.info`
- ✅ اختبار `loggerService` في Production

---

**آخر تحديث:** 2026-01-16  
**الحالة:** ⏸️ **مؤجلة للصباح إن شاء الله** 🌅  

---

*تم إعداد هذه القائمة بواسطة Auto - AI Assistant*  
*"مهام منظمة - جاهزة للتنفيذ!" 📋*
