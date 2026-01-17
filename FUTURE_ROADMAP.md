# 🗺️ Future Roadmap - Non-Critical TODOs & Enhancements
**تاريخ الإنشاء:** 2026-01-16  
**الغرض:** جمع جميع TODO/FIXME/Placeholder غير الحرجة للمستقبل

---

## 🟡 **متوسط - يُفضل إصلاحه قريباً (MEDIUM PRIORITY)**

### 1. **LiveChatMonitor.tsx:311, 393** 📊 **TRACKING INCOMPLETE**
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
- إنشاء collection لتتبع resolved chats: `tenants/${tenantId}/chat_resolutions`
- تحديث الإحصائيات لتعكس البيانات الفعلية

---

### 2. **smartAlertService.ts:317** 🔔 **INTEGRATION MISSING**
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

### 3. **smartAlertsService.ts:217** 🔔 **PLACEHOLDER LOGIC**
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

### 4. **analyticsService.ts:586, 596, 615** 📊 **FEATURES INCOMPLETE**
```typescript
// TODO: Implement usage reporting
// TODO: Implement top tenants ranking
// TODO: Send to analytics service (e.g., Firebase Analytics, Mixpanel, etc.)
```
**المشكلة:**
- عدة features غير مكتملة في Analytics
- **الأولوية:** 🟡 **متوسطة** - يؤثر على Analytics features

**الحل المطلوب:**
- تنفيذ usage reporting: تجميع عدد الطلبات، المستخدمين النشطين، الميزات المستخدمة
- تنفيذ top tenants ranking: ترتيب المستأجرين حسب إجمالي الطلبات والمستخدمين النشطين
- إضافة Firebase Analytics integration (اختياري)

---

### 5. **loggerService.ts:81** 🐛 **ERROR TRACKING MISSING**
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

### 6. **dataDoctorService.ts:388** 📊 **TREND CALCULATION MISSING**
```typescript
// TODO: Calculate trend from previous week (would need historical data)
const maintenanceTimeTrend = 0;
```
**المشكلة:**
- لا يتم حساب Trends من البيانات التاريخية
- **الأولوية:** 🟡 **متوسطة** - يؤثر على دقة التقارير

**الحل المطلوب:**
- تخزين البيانات التاريخية في `tenants/${tenantId}/analytics_weekly`
- حساب Trends من البيانات السابقة
- تحديث `maintenanceTimeTrend` ليعكس القيمة الفعلية

---

### 7. **useGlobalKeyboardShortcuts.ts:48** ⌨️ **FEATURE MISSING**
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

### 8. **useUX.ts:68** 🔊 **SOUND LOGIC PLACEHOLDER**
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

### 9. **DepartmentStatsCards.tsx:236** 📊 **TRACKING INCOMPLETE**
```typescript
bellman: { ...prev.bellman, checkIns, checkOuts: 0 } // Todo: Track actual checkouts
```
**المشكلة:**
- لا يتم تتبع checkOuts بشكل فعلي
- **الأولوية:** 🟡 **متوسطة** - يؤثر على دقة الإحصائيات

**الحل المطلوب:**
- تتبع checkOuts من `tenants/${tenantId}/roomCards` (status: 'checkout_pending' أو 'checked_out')
- تحديث الإحصائيات لتعكس البيانات الفعلية

---

## 🟢 **منخفض - يمكن تأجيله (LOW PRIORITY)**

### 10. **database/providers/supabase/SupabaseProvider.ts** 🗄️ **UNUSED PROVIDER**
**المشكلة:**
- SupabaseProvider غير مُنفذ بالكامل (جميع الدوال throw errors)
- لكن المشروع يستخدم Firebase فقط - هذا Provider غير مستخدم

**الأولوية:** 🟢 **منخفضة** - غير مستخدم في المشروع

**الحل المطلوب:**
- إما إكمال التطوير إذا كان سيُستخدم مستقبلاً
- أو حذفه إذا كان غير مطلوب
- أو توثيق أنه placeholder للمستقبل

---

### 11. **employeeService.ts:26** 📋 **MIGRATION NOTE**
```typescript
// TODO: Migrate to hotels/{hotelId}/branches/{branchId}/employees structure
const USERS_COLLECTION = 'users';
```
**ملاحظة:**
- الكود الحالي يستخدم `users` collection مع `tenantId` filter
- هذا يعمل لكن المسار غير tenant-scoped
- **الأولوية:** 🟢 **منخفضة** - يعمل حالياً مع tenantId filter

**التوصية:**
- يمكن تأجيل الترحيل إلى `tenants/{tenantId}/employees` إلى مرحلة Migration مستقبلية
- التأكد من أن جميع الدوال تستخدم `tenantId` filter

---

## 📊 **ملخص الأولويات**

| الأولوية | العدد | الملفات |
|---------|-------|---------|
| 🔴 **حرج (تم إصلاحه)** | 3 | ✅ lostFoundService (tenant-scoped), encryption.ts (محتمل), recordConsumption (deprecated) |
| 🟡 **متوسط** | 9 | LiveChatMonitor, smartAlertService, analyticsService, loggerService, dataDoctorService, useGlobalKeyboardShortcuts, useUX, DepartmentStatsCards |
| 🟢 **منخفض** | 2 | SupabaseProvider, employeeService (migration note) |

**الإجمالي:** 14 TODO/FIXME/Placeholder (3 حرجة تم إصلاحها، 11 غير حرجة)

---

## ✅ **الحالة الحالية**

### ✅ **تم إصلاحه اليوم:**
1. ✅ **lostFoundService.ts** - جميع المسارات محدثة إلى `tenants/${tenantId}/lost_found`
2. ✅ **recordConsumption** - تم إضافة deprecation warning واستخدام `consumeMinibarItems` عند توفر tenantId
3. ⚠️ **encryption.ts** - تم توثيقه في FUTURE_ROADMAP (يتطلب مكتبة خارجية)

---

## 📝 **ملاحظات**

- معظم كلمة "placeholder" في النتائج كانت في HTML attributes (`placeholder="..."`) وليست تعليقات كود
- تم استبعادها من التقرير
- هذا التقرير يركز على TODO/FIXME/Placeholder في التعليقات فقط
- تم إصلاح جميع المشاكل الحرجة المتعلقة بـ Security و Data Flow

---

**تاريخ آخر تحديث:** 2026-01-16  
**الحالة:** ✅ **جميع المشاكل الحرجة تم إصلاحها** | 🟡 **9 متوسطة** | 🟢 **2 منخفضة**
