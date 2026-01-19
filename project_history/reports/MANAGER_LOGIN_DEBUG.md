# 🔍 Debug: مشكلة دخول المدير الجديد (PIN: 1111)

## 📋 المشكلة المبلغ عنها:
المستخدم أنشأ مدير جديد بكود `1111` ولكن لا يستطيع الدخول به.

## 🔎 التحليل:

### 1. تدفق الدخول (`loginWithPin`):
```
1. Owner PIN Check (hashed)
2. globalCodes Lookup (PIN as document ID)
   ├─ Found → Manager Login ✅
   └─ Not Found → users Collection Lookup (Employee)
```

### 2. إنشاء المدير (`createManager`):
- ✅ ينشئ سجل في `users` collection
- ✅ ينشئ سجل في `globalCodes` collection بالـ PIN كـ ID
- ✅ ينشئ سجل في `tenants` collection

### 3. المشاكل المحتملة:

#### أ) PIN غير موجود في `globalCodes`
- **السبب**: `batch.commit()` فشل أو لم يتم تنفيذه
- **الحل**: التحقق من Firestore Console

#### ب) Firebase Rules تمنع القراءة
- **السبب**: Rules لم يتم نشرها بشكل صحيح
- **الحل**: التحقق من `firestore.rules` (line 74-77)
  ```javascript
  match /globalCodes/{codeId} {
    allow read: if true;  // ✅ يجب أن يسمح بالقراءة
  }
  ```

#### ج) تعارض PIN مع موظف
- **السبب**: كود `1111` موجود كموظف في `SetupWizard.tsx`
- **الحل**: `globalCodes` له أولوية، لكن يجب التأكد

#### د) Tenant Firebase Config مشكلة
- **السبب**: إذا كان المدير له Firebase منفصل، قد يكون هناك reload
- **الحل**: التحقق من console logs

## 🔧 خطوات التشخيص:

### 1. التحقق من `globalCodes` في Firestore Console:
```
Collection: globalCodes
Document ID: 1111
Fields:
  - tenantId (string)
  - managerId (string)
  - type: 'manager'
  - status: 'active'
  - licenseStatus: 'active'
```

### 2. التحقق من Console Logs:
- فتح Developer Console
- محاولة الدخول بالكود `1111`
- البحث عن:
  - `Global code lookup failed`
  - `Using globalCodes data for login`
  - أي أخطاء permission-denied

### 3. التحقق من Rate Limiting:
- إذا فشلت محاولات كثيرة، قد يكون الحساب مقفل
- التحقق من `login_attempts` collection

### 4. التحقق من Manager Status:
```javascript
// في Firestore Console
users/{managerId}
  - status: 'active'
  - licenseStatus: 'active'
  - licenseExpiry: (تاريخ مستقبلي)
```

## 💡 الحلول المقترحة:

### الحل 1: إعادة إنشاء PIN في `globalCodes`
```javascript
// في Firebase Console → Firestore
// إنشاء/تحديث document يدوياً:
Collection: globalCodes
Document ID: 1111
{
  tenantId: "{tenantId}",
  managerId: "{managerId}",
  type: "manager",
  status: "active",
  licenseStatus: "active",
  role: "manager",
  department: "admin",
  name: "{managerName}",
  createdAt: Timestamp.now()
}
```

### الحل 2: التحقق من Firebase Rules
```bash
firebase deploy --only firestore:rules
```

### الحل 3: مسح Rate Limiting
```javascript
// في Firestore Console
// حذف documents من login_attempts collection للـ PIN 1111
```

## ✅ Checklist قبل الاختبار:
- [ ] `globalCodes/1111` موجود في Firestore
- [ ] Firebase Rules منشورة وتسمح بالقراءة
- [ ] Manager status = 'active'
- [ ] License status = 'active'
- [ ] License expiry تاريخ مستقبلي
- [ ] لا يوجد rate limiting نشط
- [ ] Console logs خالية من أخطاء

## 🚀 الاختبار:
1. فتح صفحة الدخول
2. اختيار "Manager" tab
3. إدخال الكود: `1111`
4. مراقبة Console للأخطاء
5. التحقق من Network tab لـ Firestore requests
