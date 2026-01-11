# ⚡ مرجع سريع - نظام أدورا

> **اطبع هذه الصفحة وضعها بجانبك!**

---

## 🔑 أكواد الدخول للاختبار

```
مالك:   765255
```

---

## 📁 أين أجد...؟

| أريد | المسار |
|------|--------|
| صفحة الدخول | `src/features/auth/LoginScreen.tsx` |
| واجهة النزيل | `src/features/guest/GuestDashboard.tsx` |
| لوحة المالك | `src/features/super-admin/EnhancedOwnerDashboard.tsx` |
| منطق المصادقة | `src/services/authService.ts` |
| إدارة الغرف | `src/services/roomService.ts` |
| إدارة الطلبات | `src/services/requestService.ts` |
| الأنواع (Types) | `src/types/` |
| Repository Pattern | `src/repositories/` |

---

## 🚀 الأوامر الأساسية

```bash
npm install          # تثبيت الحزم
npm run dev          # تشغيل التطوير
npm run build        # بناء للإنتاج
npm run lint         # فحص الأخطاء
firebase deploy      # رفع للاستضافة
```

---

## ✅ قبل كل Commit

```bash
npm run build        # ✅ يجب أن ينجح
npm run lint         # ✅ بدون أخطاء
```

---

## ⚠️ أخطاء شائعة

| الخطأ | الحل |
|-------|------|
| `db is null` | أضف `if (!db) return;` |
| `collection() invalid` | تحقق من تهيئة Firebase |
| White Screen | افتح Console وابحث عن الخطأ |
| Build fails | شغّل `npm run lint` |

---

## 🔒 قواعد ذهبية

```typescript
// 1️⃣ دائماً تحقق من db
if (!db) return defaultValue;

// 2️⃣ دائماً نظّف useEffect
useEffect(() => {
  const unsub = subscribe();
  return () => unsub(); // ← مهم!
}, []);

// 3️⃣ لا تستخدم any
const user: User = { ... }; // ✅
const user: any = { ... };  // ❌

// 4️⃣ لا تضع API Keys في الكود
const key = import.meta.env.VITE_API_KEY; // ✅
const key = 'hardcoded-key';              // ❌
```

---

## 🎨 نمط Repository

```typescript
// استخدم Hooks الجاهزة:
const authRepo = useAuthRepository();
const roomRepo = useRoomRepository();
const requestRepo = useRequestRepository();
const userRepo = useUserRepository();
const tenantRepo = useTenantRepository();
```

---

## 🔧 Debug Tools

```javascript
// في Console المتصفح:
window.debugGenius.checkFirebase()
window.debugGenius.getCurrentUser()
window.debugGenius.clearCache()
```

---

## 📞 للمساعدة

```
Ayman Abo Warda
📱 +966 570 707 121
📱 +20 150 000 0162
📧 77aayy@gmail.com
```

---

## 🎯 اختبار سريع (5 دقائق)

```bash
# 1. احذف .env (لو موجود)
rm .env

# 2. شغّل المشروع
npm run dev

# 3. افتح http://localhost:5173

# 4. لو الصفحة ظهرت = ✅ الـ Architecture صحيح!
```

---

> **تذكر: اقرأ أولاً، اكتب ثانياً!** 📖

