# 🎯 خطة i18n المراحل الأربع - I18N MILESTONES PLAN

**التاريخ:** 2026-01-16  
**المشروع:** Adora Hotel Management System  
**الإصدار:** 3.5.0  
**الحالة:** 🔄 **المرحلة الأولى قيد التنفيذ**

---

## 📋 نظرة عامة

**الهدف:** تنظيف **1219 نص ثابت** في 4 مراحل منظمة

---

## 🎯 المراحل الأربع (4 Milestones)

### ✅ **Milestone 1: Auth & Onboarding** 🔄 **قيد التنفيذ**

**الملفات المستهدفة:**
1. `src/features/auth/LoginScreen.tsx` - نصوص fallback
2. `src/features/onboarding/CreateFirstBranch.tsx` - ~15 نص
3. `src/features/onboarding/ApproveRoomTypes.tsx` - ~12 نص
4. `src/components/auth/BiometricSetupModal.tsx` - ~20 نص
5. `src/components/auth/BranchLocationWarning.tsx` - ~5 نصوص
6. `src/components/auth/OnboardingGuard.tsx` - 1 نص

**المجموع:** ~70 نص

**الحالة:** 🔄 **قيد التنفيذ**

---

### ⏸️ **Milestone 2: Rooms & Bookings** (مؤجل)

**الملفات المستهدفة:**
- Room Management
- Booking System
- Reception Dashboard
- Room Cards

**الحالة:** ⏸️ **في الانتظار**

---

### ⏸️ **Milestone 3: Staff & Services** (مؤجل)

**الملفات المستهدفة:**
- Employees Management
- Maintenance Requests
- Laundry Services
- Minibar
- Points System

**الحالة:** ⏸️ **في الانتظار**

---

### ⏸️ **Milestone 4: Management & Settings** (مؤجل)

**الملفات المستهدفة:**
- Reports
- Statistics
- User Profile
- System Settings

**الحالة:** ⏸️ **في الانتظار**

---

## 📊 القواعد الذهبية

1. ✅ **استبدال النصوص** - استبدال جميع النصوص الثابتة بـ `t('module.page.element')`
2. ✅ **4 لغات** - تحديث `ar.json`, `en.json`, `hi.json`, `bn.json`
3. ✅ **Keys منظمة** - استخدام هيكل منطقي (`auth.login.title`, `onboarding.branch.create`)
4. ✅ **تقرير بعد كل مرحلة** - ملخص بالملفات المعدلة للفحص

---

## ✅ التقدم

- **Milestone 1:** 🔄 قيد التنفيذ (0/70 نص)
- **Milestone 2:** ⏸️ في الانتظار
- **Milestone 3:** ⏸️ في الانتظار
- **Milestone 4:** ⏸️ في الانتظار

---

**آخر تحديث:** 2026-01-16  
**الحالة:** 🔄 Milestone 1 قيد التنفيذ
