# 📋 تقرير TODO / FIXME / Placeholder في المشروع
**تاريخ الإنشاء:** $(date)
**الغرض:** جمع جميع التعليقات التي تشير إلى كود غير مكتمل أو يحتاج إلى إصلاح

---

## 🔴 **حرج - يجب إصلاحه الآن (CRITICAL)**

### 1. **minibarRestockService.ts:246** ⚠️ **RACE CONDITION**
```typescript
// TODO: Migrate all callers to use consumeMinibarItems instead
// ⚠️ WARNING: This is NOT atomic - may cause Race Conditions
```
**المشكلة:** 
- الكود الحالي غير atomical ويسبب Race Conditions في تحديث المخزون
- هناك دالة `consumeMinibarItems` جاهزة ولكن لم يتم الترحيل إليها
- **الأولوية:** 🔴 **عالية جداً** - يؤثر على البيانات المالية (Minibar consumption)

**الحل المطلوب:**
- البحث عن جميع استدعاءات `recordConsumption` والترحيل إلى `consumeMinibarItems`
- إزالة `recordConsumption` بعد الترحيل الكامل

---

### 2. **employeeService.ts:26** ⚠️ **MIGRATION INCOMPLETE**
```typescript
// TODO: Migrate to hotels/{hotelId}/branches/{branchId}/employees structure
const USERS_COLLECTION = 'users';
```
**المشكلة:**
- لا يزال يستخدم collection قديم `users` بدلاً من `tenants/{tenantId}/employees`
- يسبب مشاكل في الـ Tenant Isolation (SaaS)
- **الأولوية:** 🔴 **عالية** - يؤثر على أمان البيانات

**الحل المطلوب:**
- التحقق من جميع استخدامات `USERS_COLLECTION` في الملف
- الترحيل إلى `tenants/{tenantId}/employees`
- التأكد من أن جميع الدوال تستخدم tenantId

---

### 3. **encryption.ts:33** ⚠️ **SECURITY RISK**
```typescript
// TODO: Upgrade to AES-256 for production
return btoa(encodeURIComponent(text));
```
**المشكلة:**
- يستخدم Base64 encoding فقط (ليس encryption حقيقي)
- Base64 يمكن فكها بسهولة - لا يصلح للبيانات الحساسة
- **الأولوية:** 🔴 **عالية** - يؤثر على أمان البيانات

**الحل المطلوب:**
- تنفيذ AES-256 encryption
- استخدام مكتبة مثل `crypto-js` أو Web Crypto API
- إضافة key management آمن

---

## 🟡 **متوسط - يُفضل إصلاحه قريباً (MEDIUM)**

### 4. **LiveChatMonitor.tsx:311, 393** 📊 **TRACKING INCOMPLETE**
```typescript
// TODO: Get all branches if not specified
const branchIds = branchId ? [branchId] : ['main'];

// TODO: Track from separate collection
const resolvedToday = 0;
```
**المشكلة:**
- لا يعرض جميع الفروع إذا لم يتم تحديد branchId
- لا يتم تتبع resolvedToday بشكل فعلي
- **الأولوية:** 🟡 **متوسطة** - يؤثر على دقة الإحصائيات

**الحل المطلوب:**
- استخدام `useTenantBranches` hook للحصول على جميع الفروع
- إنشاء collection لتتبع resolved chats
- تحديث الإحصائيات لتعكس البيانات الفعلية

---

### 5. **smartAlertService.ts:317** 🔔 **INTEGRATION MISSING**
```typescript
// TODO: Integrate with pushNotificationService, smsService, etc.
```
**المشكلة:**
- Smart Alerts لا يتم إرسالها فعلياً عبر Push/SMS
- **الأولوية:** 🟡 **متوسطة** - يؤثر على وظيفة الـ Smart Alerts

**الحل المطلوب:**
- دمج `smartAlertService` مع `pushNotificationService`
- إضافة SMS integration (اختياري)
- اختبار إرسال التنبيهات

---

### 6. **smartAlertsService.ts:217** 🔔 **PLACEHOLDER LOGIC**
```typescript
// Placeholder logic
return alerts;
```
**المشكلة:**
- الدالة لا تحتوي على logic فعلي
- **الأولوية:** 🟡 **متوسطة** - قد يكون غير مستخدم

**الحل المطلوب:**
- فحص إذا كانت هذه الدالة مستخدمة
- إذا كانت مستخدمة: تنفيذ Logic الفعلي
- إذا كانت غير مستخدمة: حذفها أو توثيق أنها placeholder

---

### 7. **analyticsService.ts:586, 596, 615** 📊 **FEATURES INCOMPLETE**
```typescript
// TODO: Implement usage reporting
// TODO: Implement top tenants ranking
// TODO: Send to analytics service (e.g., Firebase Analytics, Mixpanel, etc.)
```
**المشكلة:**
- عدة features غير مكتملة في Analytics
- **الأولوية:** 🟡 **متوسطة** - يؤثر على Analytics features

**الحل المطلوب:**
- تنفيذ usage reporting
- تنفيذ top tenants ranking
- إضافة Firebase Analytics integration (اختياري)

---

### 8. **loggerService.ts:81** 🐛 **ERROR TRACKING MISSING**
```typescript
// TODO: In production, send errors to error tracking service (e.g., Sentry)
```
**المشكلة:**
- لا يتم إرسال الأخطاء إلى Error Tracking Service في Production
- **الأولوية:** 🟡 **متوسطة** - يؤثر على مراقبة الأخطاء

**الحل المطلوب:**
- إضافة Sentry أو خدمة مشابهة
- تكوين Error Tracking في Production
- اختبار الإرسال

---

### 9. **dataDoctorService.ts:388** 📊 **TREND CALCULATION MISSING**
```typescript
// TODO: Calculate trend from previous week (would need historical data)
const maintenanceTimeTrend = 0;
```
**المشكلة:**
- لا يتم حساب Trends من البيانات التاريخية
- **الأولوية:** 🟡 **متوسطة** - يؤثر على دقة التقارير

**الحل المطلوب:**
- تخزين البيانات التاريخية
- حساب Trends من البيانات السابقة
- تحديث `maintenanceTimeTrend` ليعكس القيمة الفعلية

---

### 10. **useGlobalKeyboardShortcuts.ts:48** ⌨️ **FEATURE MISSING**
```typescript
// TODO: Open command palette
console.log('🔍 Quick search (Ctrl+K)');
```
**المشكلة:**
- Command Palette غير مُنفذ
- **الأولوية:** 🟡 **متوسطة** - feature غير أساسي

**الحل المطلوب:**
- تنفيذ Command Palette component
- إضافة Keyboard shortcut handling
- ربطه بالـ Quick Search

---

### 11. **useUX.ts:68** 🔊 **SOUND LOGIC PLACEHOLDER**
```typescript
// Placeholder for sound logic
```
**المشكلة:**
- Sound logic غير مُنفذ
- **الأولوية:** 🟡 **متوسطة** - feature غير أساسي

**الحل المطلوب:**
- فحص إذا كان مستخدم
- تنفيذ Sound logic إذا لزم الأمر

---

## 🟢 **منخفض - يمكن تأجيله (LOW)**

### 12. **database/providers/supabase/SupabaseProvider.ts** 🗄️ **UNUSED PROVIDER**
**المشكلة:**
- SupabaseProvider غير مُنفذ بالكامل (جميع الدوال throw errors)
- لكن المشروع يستخدم Firebase فقط - هذا Provider غير مستخدم

**الأولوية:** 🟢 **منخفضة** - غير مستخدم في المشروع

**الحل المطلوب:**
- إما إكمال التطوير إذا كان سيُستخدم مستقبلاً
- أو حذفه إذا كان غير مطلوب
- أو توثيق أنه placeholder للمستقبل

---

## 📊 **ملخص الأولويات**

| الأولوية | العدد | الملفات |
|---------|-------|---------|
| 🔴 **حرج** | 3 | minibarRestockService, employeeService, encryption |
| 🟡 **متوسط** | 8 | LiveChatMonitor, smartAlertService, analyticsService, loggerService, dataDoctorService, useGlobalKeyboardShortcuts, useUX, smartAlertsService |
| 🟢 **منخفض** | 1 | SupabaseProvider |

**الإجمالي:** 12 TODO/FIXME/Placeholder

---

## ✅ **التوصيات**

1. **ابدأ بالحرج (3):**
   - إصلاح Race Condition في Minibar (أولوية قصوى)
   - ترحيل employeeService إلى tenant-scoped paths
   - ترقية Encryption إلى AES-256

2. **ثم المتوسط (8):**
   - إكمال Tracking في LiveChatMonitor
   - دمج Smart Alerts مع Push Notifications
   - إكمال Analytics features

3. **أخيراً المنخفض (1):**
   - تقرير ما إذا كان SupabaseProvider مطلوباً أم لا

---

## 📝 **ملاحظات**

- معظم كلمة "placeholder" في النتائج كانت في HTML attributes (`placeholder="..."`) وليست تعليقات كود
- تم استبعادها من التقرير
- هذا التقرير يركز على TODO/FIXME/Placeholder في التعليقات فقط
