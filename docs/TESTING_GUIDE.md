# 🧪 دليل الاختبار - Universal Action Card

## المشكلة الحالية
- لا يوجد tenants في النظام
- إدارة المشتركين فارغة
- لا يمكن اختبار الكارت الجديد بدون tenant

---

## الحل: إنشاء Tenant تجريبي

### الطريقة 1: من Owner Dashboard (الأسهل) ✅

1. **افتح Owner Dashboard**:
   - سجل دخول كـ Owner
   - اذهب إلى `/owner-dashboard?tab=tenants`

2. **اضغط على زر "🧪 تجريبي"**:
   - الزر موجود بجانب زر "إنشاء مدير جديد"
   - سيتم إنشاء tenant تجريبي تلقائياً

3. **النتيجة**:
   - Tenant ID: `test-tenant-{timestamp}`
   - Manager Code: `9999`
   - Manager ID: `test-manager-{timestamp}`

4. **الدخول**:
   - استخدم الكود: `9999`
   - Employee Code: `9999`

---

### الطريقة 2: من Console (للمطورين)

```typescript
// في Browser Console
import { createTestTenant } from './src/utils/createTestTenant';
const result = await createTestTenant();
console.log('Tenant ID:', result.tenantId);
console.log('Manager Code:', result.managerCode);
```

---

## ما يتم إنشاؤه تلقائياً

### 1. Tenant
- ✅ Tenant document في `tenants/{tenantId}`
- ✅ Branch: `branch-main`
- ✅ License: Active لمدة سنة

### 2. Manager User
- ✅ User في `users/{managerId}`
- ✅ Employee في `tenants/{tenantId}/employees/{managerId}`
- ✅ Code: `9999`

### 3. Seeded Data
- ✅ Settings
- ✅ Room Statuses
- ✅ Departments
- ✅ Demo Room (101)
- ✅ Feature Flags (Universal Card enabled)

### 4. Test Request
- ✅ Request في `tenants/{tenantId}/requests`
- ✅ Type: `cleaning`
- ✅ Status: `CONFIRMED`
- ✅ Room: `101`
- ✅ State Machine fields initialized

---

## خطوات الاختبار

### 1. إنشاء Tenant تجريبي
- [x] اضغط على زر "🧪 تجريبي"
- [x] تأكد من ظهور رسالة نجاح

### 2. تسجيل الدخول
- [ ] استخدم الكود: `9999`
- [ ] Employee Code: `9999`
- [ ] تأكد من الدخول بنجاح

### 3. اختبار Housekeeping Dashboard
- [ ] اذهب إلى `/housekeeping`
- [ ] تأكد من ظهور الكارت (القديم أو الجديد حسب Feature Flag)
- [ ] اختبر Actions (Start/Complete)
- [ ] اختبر انتقال الكارت بين التبويبات

### 4. تفعيل Universal Card
- [ ] اذهب إلى Firestore: `tenants/{tenantId}/settings/featureFlags`
- [ ] عدّل المستند:
```json
{
  "useUniversalActionCard": true,
  "useUniversalCardInHousekeeping": true
}
```
- [ ] أعد تحميل الصفحة
- [ ] تأكد من ظهور الكارت الجديد

---

## ملاحظات مهمة

- ✅ **Test Tenant**: Tenant التجريبي مُعلّم بـ `isTest: true`
- ✅ **Auto-Seeding**: البيانات تُنشأ تلقائياً
- ✅ **Feature Flags**: مفعّلة تلقائياً للاختبار
- ✅ **Demo Room**: غرفة 101 تُنشأ تلقائياً

---

## Troubleshooting

### المشكلة: الزر لا يظهر
**الحل**: تأكد من أنك مسجل دخول كـ Owner

### المشكلة: فشل إنشاء Tenant
**الحل**: 
1. تحقق من Console للأخطاء
2. تأكد من أن Firebase متصل
3. تحقق من Firestore Rules

### المشكلة: لا يمكن الدخول
**الحل**:
1. تحقق من أن Manager موجود في `users`
2. تحقق من أن Code صحيح (`9999`)
3. تحقق من Firestore Rules للـ Authentication
