# 📋 خطة المرحلة الأولى: Auth & Onboarding i18n

**التاريخ:** 2026-01-16  
**المرحلة:** Phase 1 - Auth & Onboarding  
**الحالة:** 🔄 قيد التنفيذ

---

## 📁 الملفات المستهدفة

### 1. `src/features/auth/LoginScreen.tsx`
- **النصوص:** نصوص مع fallback (تحتاج إضافة keys)
- **النصوص الثابتة:** رسائل أخطاء، labels

### 2. `src/features/onboarding/CreateFirstBranch.tsx`
- **النصوص الثابتة:** ~15 نص (أخطاء، labels، messages)

### 3. `src/features/onboarding/ApproveRoomTypes.tsx`
- **النصوص الثابتة:** ~12 نص (أخطاء، labels)

### 4. `src/components/auth/BiometricSetupModal.tsx`
- **النصوص الثابتة:** ~20 نص (labels، messages)

### 5. `src/components/auth/BranchLocationWarning.tsx`
- **النصوص الثابتة:** ~5 نصوص

### 6. `src/components/auth/OnboardingGuard.tsx`
- **النصوص الثابتة:** 1 نص

---

## 🗂️ Structure المفاتيح المطلوبة

```json
{
  "auth": {
    "login": {...},
    "greetings": {
      "morning": "صباح الخير",
      "afternoon": "مساء الخير",
      "evening": "مساء الخير",
      "night": "مساء الخير"
    },
    "messages": {
      "morningMessage": "ابدأ يومك بإنتاجية عالية",
      "afternoonMessage": "استمر في تحقيق النجاح",
      "eveningMessage": "نهاية يوم مميز",
      "nightMessage": "وقت للراحة أو إنهاء المهام"
    },
    "pinLabels": {
      "ownerPinLabel": "كود المالك",
      "managerPinLabel": "كود المدير",
      "employeePinLabel": "كود الموظف"
    },
    "errors": {
      "wrongCode": "كود خاطئ",
      "biometricFailed": "فشل التحقق من البصمة",
      "branchNotSpecified": "غير محدد"
    },
    "labels": {
      "branchCodeLabel": "كود الفرع",
      "activeLabel": "نشط",
      "dayMode": "الوضع النهاري",
      "nightMode": "الوضع الليلي",
      "afterBranchEnterPin": "بعد إدخال كود الفرع، اضغط على \"كود الموظف\" للمتابعة"
    },
    "biometric": {...},
    "branchLocation": {...}
  },
  "onboarding": {
    "createFirstBranch": {...},
    "approveRoomTypes": {...},
    "guards": {...}
  }
}
```

---

## ✅ خطة التنفيذ

1. ✅ مسح الملفات وتحديد النصوص الثابتة
2. ⏳ استبدال النصوص بـ t() في الملفات
3. ⏳ إضافة المفاتيح في ar.json
4. ⏳ إضافة المفاتيح في en.json
5. ⏳ إضافة المفاتيح في hi.json
6. ⏳ إضافة المفاتيح في bn.json
7. ⏳ إعداد التقرير النهائي

---

**البدء الآن...**
