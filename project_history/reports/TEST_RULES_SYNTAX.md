# ✅ تم إصلاح Firestore Rules Syntax

## 🔧 الإصلاحات:

### 1. ✅ `getUserTenantId()`:
- تم استبدال `if` statements بـ ternary operator مع `let` bindings
- يدعم Firestore Rules v2

### 2. ✅ `getUserBranchId()`:
- مبسط ويستخدم ternary فقط

### 3. ✅ `canAccessBranch()`:
- يستخدم logical OR بسيط

## 📋 الخطوة التالية:

```bash
firebase deploy --only firestore:rules
```

إذا استمرت الأخطاء، قد تكون المشكلة في:
1. إصدار Firebase CLI (يجب أن يكون محدث)
2. Cache (جرب `firebase deploy --only firestore:rules --force`)

---

**✅ Rules الآن تستخدم syntax صحيح لـ Firestore Rules v2!**
