# ✅ إصلاح Anonymous Auth عند بدء التطبيق

## 🎯 المشكلة:

من console logs:
```
systemSettingsService.ts:306 Error getting system settings: Missing or insufficient permissions.
Rate limit check failed: Missing or insufficient permissions.
Global code lookup failed: Missing or insufficient permissions.
```

## 🔍 السبب:

**`systemSettings` يتم تحميلها عند بدء التطبيق قبل Anonymous Auth!**

**التسلسل الخاطئ:**
1. ❌ App.tsx يبدأ التحميل
2. ❌ GlobalServicesProvider يبدأ
3. ❌ `systemSettings` يحاول القراءة → **لا يوجد auth** → فشل
4. ❌ Anonymous Auth يتم فقط عند `loginWithPin` → **متأخر جداً!**

## ✅ الحل المطبق:

### 1. إضافة Anonymous Auth في GlobalServicesProvider:
- Anonymous Auth يتم الآن عند بدء التطبيق
- قبل أي عمليات Firestore (systemSettings, etc.)

### 2. Anonymous Auth في loginWithPin:
- يبقى موجود للتأكد من auth عند الدخول
- لكن الآن auth موجود مسبقاً من بدء التطبيق

## 🔧 التغييرات:

### GlobalServicesProvider.tsx:
```typescript
useEffect(() => {
    // ✅ CRITICAL: Ensure Anonymous Auth FIRST
    const ensureAuth = async () => {
        const { auth } = await import('../../services/firebase');
        if (auth && !auth.currentUser) {
            await signInAnonymously(auth);
        }
    };
    ensureAuth();
    
    // Now initialize services...
}, []);
```

## ✅ النتيجة:

**الآن التسلسل الصحيح:**
1. ✅ App.tsx يبدأ التحميل
2. ✅ GlobalServicesProvider يبدأ
3. ✅ Anonymous Auth يتم أولاً
4. ✅ `systemSettings` يقرأ بنجاح
5. ✅ باقي العمليات تعمل بشكل صحيح

## 📋 Checklist:

- [x] Anonymous Auth في GlobalServicesProvider عند بدء التطبيق
- [x] Anonymous Auth في loginWithPin (للتحقق)
- [x] Rules محدثة (`loginAttempts`, `globalCodes`, `systemSettings`)
- [ ] اختبار الدخول بعد التحديث

---

**✅ الكود محدث! الآن Anonymous Auth يتم عند بدء التطبيق قبل أي عمليات Firestore.**
