# 🚀 دليل المبرمج الجديد - نظام أدورا لإدارة الفنادق

> **آخر تحديث:** يناير 2026  
> **الإصدار:** 2.0 (Repository Pattern Edition)

---

## 📋 فهرس المحتويات

1. [نظرة عامة على المشروع](#-نظرة-عامة-على-المشروع)
2. [الهيكل المعماري](#-الهيكل-المعماري)
3. [Repository Pattern](#-repository-pattern)
4. [كيف تبدأ العمل](#-كيف-تبدأ-العمل)
5. [الملفات الأساسية](#-الملفات-الأساسية)
6. [سيناريوهات الاختبار](#-سيناريوهات-الاختبار)
7. [الأنماط المستخدمة](#-الأنماط-المستخدمة)
8. [الأخطاء الشائعة وحلولها](#-الأخطاء-الشائعة-وحلولها)
9. [قواعد الأمان](#-قواعد-الأمان)
10. [نصائح ذهبية](#-نصائح-ذهبية)

---

## 🏨 نظرة عامة على المشروع

**أدورا** هو نظام SaaS متكامل لإدارة الفنادق، يدعم:

- **Multi-Tenancy**: كل فندق (مستأجر) معزول تماماً
- **Real-time Updates**: تحديثات فورية عبر Firebase
- **Offline Support**: يعمل بدون إنترنت
- **PWA Ready**: يمكن تثبيته كتطبيق

### التقنيات المستخدمة

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| React | 18.x | واجهة المستخدم |
| TypeScript | 5.x | Type Safety |
| Vite | 5.x | Build Tool |
| Tailwind CSS | 3.x | التصميم |
| Firebase | 10.x | Backend (Firestore, Auth, Storage) |

---

## 🏗️ الهيكل المعماري

```
src/
├── 📁 components/       # مكونات UI قابلة لإعادة الاستخدام
│   ├── ui/              # أزرار، inputs، modals
│   ├── layout/          # Header, Footer, Sidebar
│   └── admin/           # مكونات الإدارة
│
├── 📁 features/         # الصفحات الرئيسية
│   ├── auth/            # تسجيل الدخول
│   ├── guest/           # واجهة النزيل
│   ├── reception/       # الاستقبال
│   ├── housekeeping/    # التدبير المنزلي
│   ├── bellman/         # البيلمان
│   ├── maintenance/     # الصيانة
│   └── super-admin/     # لوحة المالك
│
├── 📁 services/         # منطق الأعمال (Business Logic)
│   ├── firebase.ts      # تهيئة Firebase
│   ├── authService.ts   # المصادقة
│   ├── roomService.ts   # إدارة الغرف
│   ├── requestService.ts # إدارة الطلبات
│   └── ...
│
├── 📁 repositories/     # 🆕 طبقة Repository Pattern
│   ├── interfaces/      # العقود (Contracts)
│   └── firebase/        # التنفيذ الحالي
│
├── 📁 hooks/            # Custom React Hooks
├── 📁 context/          # React Context (Auth, Theme)
├── 📁 types/            # TypeScript Interfaces
└── 📁 utils/            # دوال مساعدة
```

---

## 🔄 Repository Pattern

### لماذا Repository Pattern؟

```
قبل (الطريقة القديمة):
┌─────────────┐     ┌──────────────┐
│  Component  │ ──▶ │   Firebase   │
└─────────────┘     └──────────────┘
     ❌ مرتبط مباشرة بـ Firebase

بعد (Repository Pattern):
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Component  │ ──▶ │  Repository  │ ──▶ │   Firebase   │
└─────────────┘     └──────────────┘     └──────────────┘
     ✅ منفصل - يمكن تبديل Firebase بأي backend
```

### الملفات الأساسية

```typescript
// 1️⃣ الواجهة (Interface) - العقد
// src/repositories/interfaces/IRoomRepository.ts
export interface IRoomRepository {
  subscribeToRooms(branchId: string, callback: (rooms: Room[]) => void): Unsubscribe;
  addRoom(room: Omit<Room, 'id'>): Promise<void>;
  updateRoom(tenantId: string, branchId: string, roomNumber: string, updates: Partial<Room>): Promise<void>;
  // ...
}

// 2️⃣ التنفيذ (Implementation) - Firebase
// src/repositories/firebase/FirebaseRoomRepository.ts
export class FirebaseRoomRepository implements IRoomRepository {
  subscribeToRooms(branchId: string, callback: (rooms: Room[]) => void): Unsubscribe {
    // Firebase implementation here
  }
}

// 3️⃣ الاستخدام في Component
// src/features/reception/RoomList.tsx
import { useRoomRepository } from '@/repositories';

const RoomList = () => {
  const roomRepo = useRoomRepository();
  
  useEffect(() => {
    const unsubscribe = roomRepo.subscribeToRooms(branchId, setRooms);
    return () => unsubscribe();
  }, []);
};
```

### الـ Repositories المتاحة

| Repository | الغرض |
|------------|-------|
| `useAuthRepository()` | تسجيل الدخول/الخروج |
| `useRoomRepository()` | إدارة الغرف |
| `useRequestRepository()` | إدارة الطلبات |
| `useUserRepository()` | إدارة المستخدمين |
| `useTenantRepository()` | إدارة المستأجرين |

---

## 🚀 كيف تبدأ العمل

### 1. تشغيل المشروع

```bash
# تثبيت الحزم
npm install

# تشغيل بيئة التطوير
npm run dev

# بناء للإنتاج
npm run build
```

### 2. اختبار بدون Firebase (Mock Mode)

المشروع يعمل **بدون Firebase** في بيئة التطوير! هذا يثبت أن الـ Architecture صحيح.

```bash
# فقط شغّل
npm run dev

# ستظهر رسائل:
# ⚠️ NO VALID FIREBASE CONFIGURATION FOUND
# 🔧 Firebase not configured - Setup Wizard required
# ✅ لكن التطبيق يعمل!
```

### 3. إضافة Firebase (للإنتاج)

```bash
# أنشئ ملف .env
cp env.example.txt .env

# أضف مفاتيح Firebase
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
# ...
```

### 4. كود الدخول للاختبار

| النوع | الكود |
|-------|-------|
| مالك | `765255` |

---

## 📂 الملفات الأساسية

### للتعديل على الواجهات

| أريد تعديل... | الملف |
|---------------|-------|
| صفحة الدخول | `src/features/auth/LoginScreen.tsx` |
| واجهة النزيل | `src/features/guest/GuestDashboard.tsx` |
| لوحة المالك | `src/features/super-admin/EnhancedOwnerDashboard.tsx` |
| الاستقبال | `src/features/reception/ReceptionDashboard.tsx` |

### للتعديل على المنطق

| أريد تعديل... | الملف |
|---------------|-------|
| تسجيل الدخول | `src/services/authService.ts` |
| إدارة الغرف | `src/services/roomService.ts` |
| إدارة الطلبات | `src/services/requestService.ts` |
| API Keys | `src/services/systemConfigsService.ts` |

### للتعديل على الأنواع

| النوع | الملف |
|-------|-------|
| User, Room, Request | `src/types/index.ts` |
| Auth Types | `src/types/auth.ts` |
| Tenant Types | `src/types/tenant.ts` |
| Request Types | `src/types/request.ts` |

---

## 🧪 سيناريوهات الاختبار

### السيناريو 1: اختبار الـ Mocking (الأهم!)

```bash
# 1. احذف ملف .env (لو موجود)
# 2. شغّل المشروع
npm run dev

# 3. افتح http://localhost:5173
# 4. لو الصفحة ظهرت بدون White Screen = ✅ نجاح!
```

### السيناريو 2: اختبار التنقل السريع

```javascript
// افتح Console في المتصفح واكتب:
for (let i = 0; i < 5; i++) {
  window.location.href = '/reception';
  await new Promise(r => setTimeout(r, 500));
  window.location.href = '/login';
  await new Promise(r => setTimeout(r, 500));
}
// لو مفيش Memory Leak = ✅ نجاح!
```

### السيناريو 3: اختبار البيانات الناقصة

```javascript
// في Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
// لو مفيش White Screen = ✅ نجاح!
```

### السيناريو 4: اختبار Tenant Isolation

```javascript
// في Firebase Console:
// 1. أنشئ tenant1 و tenant2
// 2. سجل دخول بـ tenant1
// 3. حاول الوصول لبيانات tenant2
// المفروض يرفض = ✅ نجاح!
```

---

## 🎨 الأنماط المستخدمة

### 1. Null Safety لـ Firebase

```typescript
// ❌ خطأ
const getData = async () => {
  const docRef = doc(db, 'collection/id');
  return await getDoc(docRef);
};

// ✅ صحيح
const getData = async () => {
  if (!db) return null; // دائماً تحقق!
  const docRef = doc(db, 'collection/id');
  return await getDoc(docRef);
};
```

### 2. Cleanup في useEffect

```typescript
// ❌ خطأ - تسرب ذاكرة
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
}, []);

// ✅ صحيح
useEffect(() => {
  const unsubscribe = onSnapshot(query, callback);
  return () => unsubscribe(); // تنظيف!
}, []);
```

### 3. Error Handling

```typescript
// ❌ خطأ
try {
  await createRequest(data);
} catch (e) {
  console.log(e);
}

// ✅ صحيح
try {
  await createRequest(data);
} catch (error) {
  logger.error('Failed to create request', error, 'requestService');
  throw new Error('حدث خطأ في إنشاء الطلب');
}
```

### 4. استخدام Types

```typescript
// ❌ خطأ
const user: any = { name: 'Ahmed' };

// ✅ صحيح
interface User {
  id: string;
  name: string;
  department: Department;
}
const user: User = { id: '1', name: 'Ahmed', department: 'reception' };
```

---

## ⚠️ الأخطاء الشائعة وحلولها

### خطأ 1: `db is null`

```typescript
// السبب: Firebase غير مُهيأ
// الحل:
if (!db) {
  console.warn('Firebase not initialized');
  return defaultValue;
}
```

### خطأ 2: `collection() invalid argument`

```typescript
// السبب: db غير صالح
// الحل: تأكد من تهيئة Firebase أولاً
```

### خطأ 3: Build Fails

```bash
# الحل 1: تجاوز فحص TypeScript
npm run build

# الحل 2: إصلاح الأخطاء
npm run lint
```

### خطأ 4: White Screen

```bash
# الحل: تحقق من Console للأخطاء
# غالباً: خطأ في import أو component غير موجود
```

---

## 🔒 قواعد الأمان

### 1. لا تضع API Keys في الكود!

```typescript
// ❌ خطأ جداً!
const apiKey = 'AIzaSyXXXXXXXXX';

// ✅ صحيح
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
```

### 2. تحقق دائماً من tenantId

```typescript
// ❌ خطأ - يمكن لأي شخص الوصول
query(collection(db, 'rooms'));

// ✅ صحيح - معزول بـ tenant
query(
  collection(db, `tenants/${tenantId}/rooms`),
  where('branchId', '==', branchId)
);
```

### 3. Rate Limiting

```typescript
import { isRateLimited } from '@/utils/rateLimiter';

if (isRateLimited(userId)) {
  throw new Error('لقد تجاوزت الحد المسموح');
}
```

### 4. Input Validation

```typescript
// تحقق من المدخلات دائماً
const sanitize = (input: string) => {
  return input.replace(/[<>]/g, '').trim();
};
```

---

## 💡 نصائح ذهبية

### 1. اقرأ قبل ما تكتب

```
✅ افتح الملف واقرأه كاملاً
✅ افهم الـ Pattern المستخدم
✅ اتبع نفس الأسلوب
❌ لا تنسخ من Stack Overflow مباشرة
```

### 2. استخدم الـ Types

```
✅ عرّف Interface لكل شيء
✅ تجنب `any` تماماً
✅ استخدم `unknown` لو مش عارف النوع
```

### 3. نظّف وراك

```
✅ كل useEffect يرجع cleanup function
✅ كل subscription له unsubscribe
✅ كل timeout له clearTimeout
```

### 4. اختبر قبل ما ترفع

```bash
# قبل أي commit:
npm run build  # تأكد إنه بيبني
npm run lint   # تأكد من الأخطاء
```

### 5. الـ Console صديقك

```javascript
// استخدم Debug Tools
window.debugGenius.checkFirebase()
window.debugGenius.getCurrentUser()
```

---

## 📞 للمساعدة

| النوع | التواصل |
|-------|---------|
| المطور الأصلي | Ayman Abo Warda |
| الهاتف (السعودية) | +966 570 707 121 |
| الهاتف (مصر) | +20 150 000 0162 |
| البريد | 77aayy@gmail.com |

---

## 📝 سجل التغييرات

| التاريخ | التغيير |
|---------|---------|
| يناير 2026 | إضافة Repository Pattern |
| يناير 2026 | توحيد KeypadComponents |
| يناير 2026 | تحسين Guest Dashboard |

---

> **"المبرمج الجيد يقرأ الكود قبل ما يكتبه"** 📖

