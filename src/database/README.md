# 🗄️ قاعدة البيانات الموحدة

## 🎯 التبديل بين المزودين (سطر واحد!)

افتح `src/database/index.ts` وغيّر السطر:

```typescript
// Firebase (الحالي)
export { firebaseProvider as database } from './providers/firebase/FirebaseProvider';

// للتبديل إلى Supabase:
// export { supabaseProvider as database } from './providers/supabase/SupabaseProvider';
```

---

## 📁 هيكل المجلد

```
src/database/
├── index.ts                    ← 👈 غيّر المزود هنا
├── types.ts                    ← أنواع البيانات الموحدة
├── DatabaseProvider.ts         ← الواجهة (Interface)
├── useDatabase.ts              ← React Hooks جاهزة
├── README.md                   ← أنت هنا
└── providers/
    ├── firebase/
    │   └── FirebaseProvider.ts ← ✅ التنفيذ الحالي
    └── supabase/
        └── SupabaseProvider.ts ← 📝 جاهز للتعبئة
```

---

## 🔧 إضافة مزود جديد (3 خطوات)

### 1️⃣ أنشئ مجلد للمزود
```bash
mkdir src/database/providers/mongodb
```

### 2️⃣ انسخ من Supabase وعدّل
```bash
cp src/database/providers/supabase/SupabaseProvider.ts src/database/providers/mongodb/MongoDBProvider.ts
```
ثم افتح الملف واستبدل Supabase بـ MongoDB

### 3️⃣ أضف التصدير في index.ts
```typescript
export { mongodbProvider as database } from './providers/mongodb/MongoDBProvider';
```

---

## 🪝 استخدام الـ Hooks في React

```tsx
import { useCollection, useDocument, useDatabaseOperations } from '@/database';

// قراءة مجموعة (Real-time)
const { data: rooms, loading } = useCollection('rooms', {
    filters: [{ field: 'status', operator: '==', value: 'available' }]
}, true);

// قراءة مستند واحد
const { data: user } = useDocument('users', userId);

// عمليات الكتابة
const { add, update, remove } = useDatabaseOperations();
await add('rooms', { number: '101', status: 'available' });
```

---

## ✅ للمبرمج الجديد: Supabase جاهز!

1. `npm install @supabase/supabase-js`
2. أنشئ `.env.local`:
   ```
   VITE_SUPABASE_URL=your-url
   VITE_SUPABASE_ANON_KEY=your-key
   ```
3. افتح `src/database/providers/supabase/SupabaseProvider.ts`
4. فك التعليق عن الكود واحفظ
5. غيّر سطر واحد في `src/database/index.ts`
6. ✨ انتهى!
