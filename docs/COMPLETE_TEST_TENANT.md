# 🧪 Complete Test Tenant - دليل شامل

## المشكلة
- ❌ لا يوجد tenants في النظام
- ❌ المدير الذي كان موجوداً لم يعد موجوداً
- ❌ البيانات اختفت

## الحل: إنشاء Tenant كامل مع بيانات واقعية

### ما يتم إنشاؤه تلقائياً:

#### 1. ✅ Tenant + Branch
- Tenant document
- Branch: `branch-main`
- License: Active لمدة سنة

#### 2. ✅ Manager User
- User في `users`
- Employee في `tenants/{tenantId}/employees`
- Code: `9999`

#### 3. ✅ Test Employees (4 موظفين)
- موظف النظافة (Code: 1001)
- موظف الصيانة (Code: 1002)
- موظف الاستقبال (Code: 1003)
- موظف البيلمان (Code: 1004)

#### 4. ✅ Test Rooms (5 غرف)
- 101 (dirty)
- 102 (clean)
- 201 (dirty, suite)
- 202 (clean)
- 301 (maintenance, deluxe)

#### 5. ✅ Test Requests (4 طلبات)
- Cleaning (CONFIRMED) - Room 101
- Cleaning (IN_PROGRESS) - Room 102
- Maintenance (CONFIRMED) - Room 201
- Bellman (IN_PROGRESS) - Room 202

#### 6. ✅ Seeded Data
- Settings
- Room Statuses
- Departments
- Roles
- Maintenance Templates
- Ranks

#### 7. ✅ Feature Flags
- Universal Action Card: Enabled
- Unified State Machine: Enabled
- Housekeeping: Enabled

---

## كيفية الاستخدام

### من Owner Dashboard:
1. اذهب إلى `/owner-dashboard?tab=tenants`
2. اضغط على زر "🧪 تجريبي"
3. انتظر رسالة النجاح

### تسجيل الدخول:
- **Manager**: Code `9999`
- **Employee**: Code `1001` (Housekeeping), `1002` (Maintenance), etc.

---

## الاختبار

### 1. Housekeeping Dashboard
- اذهب إلى `/housekeeping`
- يجب أن ترى 2 طلبات (101 CONFIRMED, 102 IN_PROGRESS)
- الكارت الجديد يظهر (Feature Flag enabled)

### 2. Maintenance Dashboard
- اذهب إلى `/maintenance`
- يجب أن ترى طلب واحد (201 CONFIRMED)

### 3. Bellman Dashboard
- اذهب إلى `/bellman`
- يجب أن ترى طلب واحد (202 IN_PROGRESS)

---

## ملاحظات

- ✅ **Realistic Data**: بيانات واقعية للاختبار
- ✅ **Multiple States**: طلبات في حالات مختلفة
- ✅ **Feature Flags**: مفعّلة تلقائياً
- ✅ **Test Markers**: كل البيانات مُعلّمة بـ `isTest: true`
