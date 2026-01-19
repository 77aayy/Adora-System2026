# 🔧 إصلاح Rules الحرج - loginAttempts collection

## 🎯 المشكلة:

من console logs:
```
❌ Global code lookup failed for PIN 1111: Missing or insufficient permissions.
Rate limit check failed: Missing or insufficient permissions.
```

## 🔍 السبب:

1. **`loginAttempts` collection غير موجود في Rules!**
   - الكود يحاول قراءة/كتابة `loginAttempts` collection
   - Rules لا تحتوي على rule لهذا collection
   - النتيجة: `Missing or insufficient permissions`

2. **`globalCodes` rule موجودة لكن:**
   - Rule يقول `allow read: if true;` (public read)
   - لكن المشكلة قد تكون في Anonymous Auth غير مفعل

## ✅ الإصلاح:

### 1. إضافة `loginAttempts` Rule:
```javascript
// ✅ Login attempts (for rate limiting) - CRITICAL for PIN login
match /loginAttempts/{attemptId} {
  // ✅ Allow read/write for authenticated users (includes anonymous auth)
  allow read, write: if request.auth != null;
}
```

### 2. تأكيد `globalCodes` Rule:
```javascript
// Global codes - readable by all (for PIN login)
match /globalCodes/{codeId} {
  allow read: if true; // Public read for PIN lookup
  allow write: if request.auth != null;
}
```

### 3. تأكيد `systemSettings` Rule:
```javascript
match /systemSettings/{docId} {
  allow read: if true; // Public read (non-sensitive config)
  allow write: if request.auth != null && isOwner();
}
```

## 📋 الخطوة التالية:

```bash
firebase deploy --only firestore:rules
```

## ⚠️ ملاحظة مهمة:

إذا استمرت مشكلة `globalCodes` بعد نشر Rules:
- تأكد من تفعيل **Anonymous Authentication** في Firebase Console
- بدون Anonymous Auth، حتى `allow read: if true;` قد لا يعمل للقراءة من client

---

**✅ Rules محدثة وجاهزة للنشر!**
