# دليل المساهمة - Contributing Guide

## 🚀 البدء السريع

### متطلبات التطوير
- Node.js 18+
- npm أو yarn
- Git

### إعداد المشروع

```bash
# استنساخ المشروع
git clone <repository-url>
cd adora-hotel-system

# تثبيت المتطلبات
npm install

# تشغيل المشروع
npm run dev
```

## 📝 معايير الكود

### TypeScript
- استخدم TypeScript Strict Mode
- تجنب استخدام `any` - استخدم types محددة
- استخدم interfaces للـ types المعقدة

### React Components
- استخدم Functional Components فقط
- استخدم TypeScript interfaces للـ props
- فصل الـ UI عن الـ Business Logic

### Styling
- استخدم Tailwind CSS
- اتبع نظام Glassmorphism Design
- تأكد من Responsive Design

### Firebase
- استخدم Firebase v9 Modular SDK
- أضف `tenantId` filter في جميع الاستعلامات
- استخدم Error Handling مناسب

## 🔒 SaaS Multi-Tenancy

### قواعد مهمة:
1. **جميع الاستعلامات يجب أن تتضمن `tenantId`**
2. **لا تشارك البيانات بين المستأجرين**
3. **استخدم Type Guards للتحقق من `tenantId`**

### مثال:
```typescript
// ✅ صحيح
const q = query(
    collection(db, 'requests'),
    where('tenantId', '==', tenantId),
    where('branch', '==', branchId)
);

// ❌ خطأ
const q = query(
    collection(db, 'requests'),
    where('branch', '==', branchId)
);
```

## 🧪 Testing

```bash
# تشغيل الاختبارات
npm test

# تشغيل الاختبارات مع coverage
npm test -- --coverage
```

## 📦 Building

```bash
# بناء المشروع
npm run build

# معاينة البناء
npm run preview
```

## 🔍 Code Quality

### Linting
```bash
# فحص الأخطاء
npm run lint

# إصلاح الأخطاء تلقائياً
npm run lint:fix
```

### Formatting
```bash
# تنسيق الكود
npm run format

# فحص التنسيق
npm run format:check
```

## 📝 Commit Messages

استخدم صيغة واضحة للـ commit messages:

```
feat: إضافة ميزة جديدة
fix: إصلاح خطأ
docs: تحديث التوثيق
style: تحسين التنسيق
refactor: إعادة هيكلة الكود
test: إضافة اختبارات
chore: تحديث الأدوات
```

## 🐛 Reporting Bugs

عند الإبلاغ عن خطأ، يرجى تضمين:
- وصف واضح للمشكلة
- خطوات إعادة إنتاج المشكلة
- المتوقع مقابل ما يحدث فعلياً
- معلومات البيئة (OS, Browser, Node version)

## 💡 Suggesting Features

عند اقتراح ميزة جديدة:
- وصف واضح للميزة
- شرح الفائدة
- أمثلة على الاستخدام إن أمكن

## ✅ Checklist قبل الـ Pull Request

- [ ] الكود يتبع معايير المشروع
- [ ] جميع الاختبارات تمر بنجاح
- [ ] لا توجد أخطاء linting
- [ ] الكود منسق بشكل صحيح
- [ ] تم تحديث التوثيق إن لزم
- [ ] تم اختبار الميزة/الإصلاح

## 📄 License

© 2024 Adora Hotel Management System. All rights reserved.
