# 🚀 Quick Start - Testing Guide

## المشكلة
- ❌ لا يوجد tenants في النظام
- ❌ المدير الذي كان موجوداً لم يعد موجوداً
- ❌ البيانات اختفت

## الحل السريع

### الخطوة 1: إنشاء Tenant تجريبي كامل
1. افتح Owner Dashboard: `/owner-dashboard?tab=tenants`
2. اضغط على زر **"🧪 تجريبي"**
3. انتظر رسالة النجاح (قد يستغرق 10-30 ثانية)

### الخطوة 2: تسجيل الدخول
- **Manager**: Code `9999`
- **Employee Housekeeping**: Code `1001`
- **Employee Maintenance**: Code `1002`
- **Employee Reception**: Code `1003`
- **Employee Bellman**: Code `1004`

### الخطوة 3: اختبار Dashboards

#### Housekeeping Dashboard:
- اذهب إلى `/housekeeping`
- يجب أن ترى:
  - ✅ 2 طلبات (101 CONFIRMED, 102 IN_PROGRESS)
  - ✅ الكارت الجديد يظهر (Feature Flag enabled)
  - ✅ Progress Bar يعمل

#### Maintenance Dashboard:
- اذهب إلى `/maintenance`
- يجب أن ترى:
  - ✅ 1 طلب (201 CONFIRMED)

#### Bellman Dashboard:
- اذهب إلى `/bellman`
- يجب أن ترى:
  - ✅ 1 طلب (202 IN_PROGRESS)

---

## ما يتم إنشاؤه تلقائياً

### ✅ Tenant + Branch
- Tenant document
- Branch: `branch-main`
- License: Active

### ✅ Manager + 4 Employees
- Manager (Code: 9999)
- Housekeeping Employee (Code: 1001)
- Maintenance Employee (Code: 1002)
- Reception Employee (Code: 1003)
- Bellman Employee (Code: 1004)

### ✅ 5 Rooms
- 101 (dirty)
- 102 (clean)
- 201 (dirty, suite)
- 202 (clean)
- 301 (maintenance, deluxe)

### ✅ 4 Test Requests
- Cleaning (CONFIRMED) - Room 101
- Cleaning (IN_PROGRESS) - Room 102
- Maintenance (CONFIRMED) - Room 201
- Bellman (IN_PROGRESS) - Room 202

### ✅ Seeded Data
- Settings, Room Statuses, Departments, Roles
- Maintenance Templates, Ranks
- Feature Flags (Universal Card enabled)

---

## ملاحظات

- ✅ **Realistic Data**: بيانات واقعية للاختبار
- ✅ **Multiple States**: طلبات في حالات مختلفة
- ✅ **Feature Flags**: مفعّلة تلقائياً
- ✅ **Test Markers**: كل البيانات مُعلّمة بـ `isTest: true`

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
2. تحقق من أن Code صحيح
3. تحقق من Firestore Rules
