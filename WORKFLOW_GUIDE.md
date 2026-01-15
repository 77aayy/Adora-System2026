# 🎯 دليل طريقة العمل - Adora Project Workflow Guide
## How I Work - Developer Workflow Documentation

**للمطورين الجدد والـ AI Assistants**

---

## 📌 المبادئ الأساسية (Core Principles)

### 1. **Zero Guessing Policy (سياسة عدم التخمين)**
```
❌ ممنوع: "أعتقد أن الكود يعمل"
✅ مطلوب: "اختبرت في المتصفح وأرفق Screenshot"
```

**قبل أن تقول "تم" أو "Fixed":**
- ✅ اختبر في المتصفح فعلياً
- ✅ التقط Screenshot كدليل
- ✅ تحقق من Console للأخطاء
- ✅ تأكد من أن التغيير ظاهر في UI

---

### 2. **Architecture First (البنية أولاً)**
```
❌ ممنوع: Firebase calls داخل Components
✅ مطلوب: جميع DB operations في @services/
```

**قواعد الفصل:**
- **UI Components** → `src/components/` أو `src/features/`
- **Business Logic** → `src/hooks/`
- **Firebase/API Calls** → `src/services/`
- **Types** → `src/types/`

---

### 3. **Security First (الأمان أولاً)**
```
❌ ممنوع: hardcode API Keys
✅ مطلوب: استخدام @.env أو systemConfigsService
```

**قواعد الأمان:**
- ✅ جميع API Keys من `systemConfigsService.ts`
- ✅ `tenantId` و `branchId` في كل Query
- ✅ Atomic Transactions للعمليات الحرجة
- ✅ Null checks قبل Firebase operations

---

### 4. **Update, Don't Recreate (حدث، لا تعيد الإنشاء)**
```
❌ ممنوع: إنشاء ميزة جديدة إذا كانت موجودة
✅ مطلوب: قراءة الكود الموجود وتحديثه
```

**قبل إضافة ميزة:**
1. ✅ اقرأ `PROJECT_CONTEXT.md` أولاً
2. ✅ ابحث في الكود عن الميزة
3. ✅ إذا موجودة → حدثها
4. ✅ إذا غير موجودة → أضفها

---

## 🔄 سير العمل (Workflow Steps)

### الخطوة 1: فهم المطلوب
```
المستخدم: "أضف ميزة X"
```

**ما يجب فعله:**
1. ✅ اقرأ `PROJECT_CONTEXT.md` للتحقق من وجود الميزة
2. ✅ ابحث في الكود عن أي إشارة لـ X
3. ✅ اسأل المستخدم إذا كان المطلوب غير واضح

---

### الخطوة 2: التخطيط
```
قبل كتابة أي كود:
```

**الخطة:**
1. ✅ حدد الملفات التي تحتاج تعديل
2. ✅ حدد Services التي تحتاج إضافة/تعديل
3. ✅ حدد Types التي تحتاج تعريف
4. ✅ فكر في Security implications

---

### الخطوة 3: التنفيذ
```
أثناء كتابة الكود:
```

**القواعد:**
1. ✅ اتبع Architecture (Services → Hooks → Components)
2. ✅ استخدم TypeScript Interfaces (لا `any`)
3. ✅ أضف Null checks للـ Firebase
4. ✅ استخدم `runTransaction` للعمليات الحرجة
5. ✅ أضف `tenantId` و `branchId` في Queries

---

### الخطوة 4: الاختبار
```
بعد كتابة الكود:
```

**التحقق:**
1. ✅ اختبر في المتصفح فعلياً
2. ✅ التقط Screenshot
3. ✅ تحقق من Console
4. ✅ اختبر في Dark Mode و Light Mode
5. ✅ اختبر على Mobile

---

### الخطوة 5: التوثيق
```
بعد التأكد من العمل:
```

**التوثيق:**
1. ✅ حدث `PROJECT_CONTEXT.md` إذا كانت ميزة جديدة
2. ✅ حدث `README.md` إذا لزم الأمر
3. ✅ أضف تعليقات في الكود إذا كان معقداً

---

## 🛠️ أدوات العمل (Development Tools)

### 1. Codebase Search
```typescript
// ابحث عن: "كيف يعمل X؟"
codebase_search({
  query: "How does X work?",
  target_directories: []
})
```

### 2. Grep للبحث السريع
```typescript
// ابحث عن: "tenantId" في جميع الملفات
grep({
  pattern: "tenantId",
  path: "src/services"
})
```

### 3. Read Files
```typescript
// اقرأ ملف مهم
read_file({
  target_file: "src/services/firebase.ts"
})
```

---

## 📋 Checklist قبل الإرسال

### ✅ Code Quality
- [ ] لا يوجد `any` types
- [ ] جميع Firebase operations في Services
- [ ] Null checks موجودة
- [ ] `tenantId` و `branchId` في Queries

### ✅ Security
- [ ] لا يوجد hardcoded secrets
- [ ] Atomic Transactions للعمليات الحرجة
- [ ] Security Rules محدثة

### ✅ Testing
- [ ] اختبرت في المتصفح
- [ ] Screenshot متوفر
- [ ] Console نظيف من الأخطاء
- [ ] Dark Mode و Light Mode يعملان

### ✅ Documentation
- [ ] حدثت `PROJECT_CONTEXT.md` إذا لزم
- [ ] الكود واضح ومعلق

---

## 🚨 أخطاء شائعة يجب تجنبها

### ❌ Error 1: Firebase بدون Null Check
```typescript
// ❌ خطأ
const docRef = doc(db, 'collection/id');
await getDoc(docRef); // سيتحطم إذا db is null

// ✅ صحيح
if (!db) return null;
const docRef = doc(db, 'collection/id');
await getDoc(docRef);
```

### ❌ Error 2: Query بدون tenantId
```typescript
// ❌ خطأ
const q = query(
  collection(db, 'requests'),
  where('status', '==', 'pending')
);

// ✅ صحيح
const q = query(
  collection(db, 'requests'),
  where('tenantId', '==', tenantId), // 🔐 CRITICAL
  where('status', '==', 'pending')
);
```

### ❌ Error 3: Non-Atomic Operations
```typescript
// ❌ خطأ
await updateDoc(orderRef, { status: 'DELIVERED' });
await addDoc(backorderRef, backorderData); // إذا فشل، الطلب أصبح DELIVERED لكن Backorder لم يُنشأ!

// ✅ صحيح
await runTransaction(db, async (transaction) => {
  transaction.update(orderRef, { status: 'DELIVERED' });
  transaction.set(backorderRef, backorderData);
});
```

### ❌ Error 4: Hardcoded Colors
```typescript
// ❌ خطأ
<div className="text-white">Title</div> // لا يعمل في Light Mode

// ✅ صحيح
<div className="text-slate-800 dark:text-white">Title</div>
```

---

## 📚 الملفات المرجعية

### للفهم السريع:
1. **`PROJECT_SUMMARY.md`** - ملخص الوضع الحالي
2. **`PROJECT_CONTEXT.md`** - الميزات المكتملة
3. **`README.md`** - الوثائق التقنية الكاملة

### للتفاصيل:
1. **`FINAL_REVIEW_REPORT.md`** - تقرير المراجعة النهائية
2. **`AUDIT_REPORT.md`** - تقرير مراجعة البنية الأساسية
3. **`WORKFLOW_GUIDE.md`** - هذا الملف

---

## 🎯 أمثلة عملية

### مثال 1: إضافة ميزة جديدة
```
المستخدم: "أضف زر X في صفحة Y"
```

**الخطوات:**
1. ✅ اقرأ `PROJECT_CONTEXT.md` - هل الميزة موجودة؟
2. ✅ ابحث عن `Y.tsx` في `src/features/`
3. ✅ أضف الزر في المكان المناسب
4. ✅ إذا احتاج Service → أضفه في `src/services/`
5. ✅ اختبر في المتصفح + Screenshot
6. ✅ حدث `PROJECT_CONTEXT.md` إذا كانت ميزة جديدة

---

### مثال 2: إصلاح Bug
```
المستخدم: "الطلبات لا تظهر في Tab X"
```

**الخطوات:**
1. ✅ ابحث عن `Tab X` في الكود
2. ✅ افحص Query في Service
3. ✅ تحقق من `tenantId` و `branchId` filters
4. ✅ اختبر في المتصفح + Screenshot
5. ✅ تأكد من أن الحل لا يكسر ميزات أخرى

---

### مثال 3: إضافة ترجمة
```
المستخدم: "أضف ترجمة للنص X"
```

**الخطوات:**
1. ✅ ابحث عن النص في الكود
2. ✅ أضف المفتاح في `src/locales/*.json` (4 ملفات)
3. ✅ استبدل النص بـ `t('key')` في Component
4. ✅ اختبر تغيير اللغة + Screenshot

---

## 💡 نصائح للنجاح

1. **اقرأ أولاً، اكتب ثانياً**
   - اقرأ `PROJECT_CONTEXT.md` قبل أي شيء
   - ابحث في الكود قبل إضافة ميزة جديدة

2. **اختبر دائماً**
   - لا تقل "تم" بدون Screenshot
   - اختبر في Dark Mode و Light Mode
   - اختبر على Mobile

3. **اتبع Architecture**
   - Services للـ Firebase
   - Hooks للـ Logic
   - Components للـ UI

4. **فكر في Security**
   - `tenantId` في كل Query
   - Atomic Transactions للعمليات الحرجة
   - لا hardcode secrets

---

**آخر تحديث:** يناير 2026  
**بواسطة:** Senior Software Engineer (Adora Team)
