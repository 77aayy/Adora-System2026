# 🔧 إصلاح Firestore Rules لمشكلة "Missing or insufficient permissions"

## 🎯 المشكلة المكتشفة:

من console logs:
```
FirebaseError: Missing or insufficient permissions.
```

الأخطاء تحدث في:
1. `systemSettingsService.ts` - قراءة system settings
2. `userService.ts` - حفظ user binding (`saveUserBinding`)
3. `TenantContext.tsx` - تحميل tenant
4. `tenantSeedingService.ts` - seeding للبيانات
5. `App.tsx` - تحميل branches

## 🔍 السبب الجذري:

### المشكلة 1: `userBindings` Rule
- **الحالي**: يسمح فقط لـ Owner بالكتابة
- **المشكلة**: المدير (Anonymous Auth) يحتاج لإنشاء `userBindings/{uid}` خاص به عند الدخول
- **الحل**: السماح للمستخدم بإنشاء/تحديث `userBindings/{uid}` الخاص به

### المشكلة 2: `getUserTenantId()` Function
- **الحالي**: يقرأ فقط من `request.auth.token.tenantId` (custom claims)
- **المشكلة**: Anonymous Auth لا تحتوي على custom claims!
- **الحل**: إضافة fallback للقراءة من `userBindings` collection

### المشكلة 3: `tenants/{tenantId}/settings` Rule
- **الحالي**: غير موجود في Rules
- **المشكلة**: `tenantSeedingService` يحاول إنشاء `tenants/{tenantId}/settings` لكن Rule غير موجود
- **الحل**: إضافة rule للسماح بالوصول للـ tenant-scoped settings

## ✅ الإصلاحات المطبقة:

### 1. تحديث `getUserTenantId()`:
```javascript
// قبل
function getUserTenantId() {
  return request.auth != null && request.auth.token.tenantId != null 
    ? request.auth.token.tenantId 
    : null;
}

// بعد
function getUserTenantId() {
  // First try custom claims (for admin SDK users)
  if (request.auth != null && request.auth.token.tenantId != null) {
    return request.auth.token.tenantId;
  }
  
  // Fallback: Read from userBindings collection (for Anonymous Auth users)
  if (request.auth != null && exists(/databases/$(database)/documents/userBindings/$(request.auth.uid))) {
    return get(/databases/$(database)/documents/userBindings/$(request.auth.uid)).data.tenantId;
  }
  
  return null;
}
```

### 2. تحديث `userBindings` Rule:
```javascript
// قبل
match /userBindings/{uid} {
  allow read, write: if request.auth != null && isOwner();
}

// بعد
match /userBindings/{uid} {
  // ✅ Read: Users can read their own binding, or Owner can read any
  allow read: if request.auth != null && (
    request.auth.uid == uid || 
    isOwner()
  );
  
  // ✅ Write: Users can create/update their OWN binding (for PIN login), or Owner can manage any
  allow create: if request.auth != null && (
    request.auth.uid == uid ||
    isOwner()
  );
  
  allow update: if request.auth != null && (
    request.auth.uid == uid ||
    isOwner()
  );
  
  // ✅ Delete: Only Owner can delete
  allow delete: if request.auth != null && isOwner();
}
```

### 3. إضافة `tenants/{tenantId}/settings` Rule:
```javascript
// ⚙️ Tenant-scoped settings (for seeding)
match /tenants/{tenantId}/settings/{settingId} {
  allow read, write: if request.auth != null && (
    getUserTenantId() == tenantId ||
    isOwner()
  );
}
```

## 📋 الخطوات التالية:

1. ✅ **نشر Rules المحدثة:**
   ```bash
   firebase deploy --only firestore:rules
   ```

2. ✅ **اختبار الدخول:**
   - دخول المدير بالكود 1111
   - التحقق من عدم وجود أخطاء "Missing or insufficient permissions"
   - التحقق من عمل `saveUserBinding` بنجاح
   - التحقق من تحميل tenant بنجاح

3. ✅ **التحقق من البيانات:**
   - `userBindings/{uid}` يجب أن يُنشأ عند الدخول
   - `tenants/{tenantId}/settings` يجب أن يُنشأ عند seeding

## ✅ Checklist:

- [x] تحديث `getUserTenantId()` للتحقق من `userBindings`
- [x] السماح للمستخدم بإنشاء/تحديث `userBindings/{uid}` الخاص به
- [x] إضافة rule لـ `tenants/{tenantId}/settings`
- [ ] نشر Rules المحدثة في Firebase
- [ ] اختبار الدخول والتحقق من عمل كل شيء

---

**ملاحظة:** بعد نشر Rules، يجب إعادة محاولة الدخول للتأكد من حل المشكلة.
