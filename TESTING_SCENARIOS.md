# 🧪 سيناريوهات اختبار State Machine - أدورا

## السيناريو الأول: "الدائرة الذهبية" (The Happy Path)

### الخطوات:
1. **الاستقبال ينشئ طلب تنظيف لغرفة 101**
   - انتقل إلى صفحة الاستقبال
   - أنشئ طلب تنظيف لغرفة 101
   - **التحقق**: الكارت يظهر في تبويب "جديد" عند النظافة
   - **التحقق**: الكارت يختفي من تبويب "جديد" عند الاستقبال

2. **عامل النظافة يدوس "استلام"**
   - انتقل إلى صفحة النظافة
   - اضغط "استلام" على الكارت
   - **التحقق**: الحالة تتغير لـ `IN_PROGRESS` فوراً
   - **التحقق**: الكارت ينتقل من تبويب "جديد" إلى "جاري التنفيذ"

3. **العامل يدوس "تم"**
   - اضغط "تم" على الكارت
   - **التحقق**: الكارت يرجع للاستقبال
   - **التحقق**: البرواز ينور تيركواز (`border-teal-500 ring-2 ring-teal-500/30 reception-alert-pulse`)
   - **التحقق**: الـ `status` يكون `COMPLETED`
   - **التحقق**: الـ `currentDepartment` يكون `reception`
   - **التحقق**: الـ `isActionRequiredByReception` يكون `true`

### البيانات المتوقعة في Firebase:
```json
{
  "status": "COMPLETED",
  "currentDepartment": "reception",
  "isActionRequiredByReception": true,
  "involvedDepartments": ["reception", "housekeeping"],
  "stateHistory": [
    {
      "fromStatus": "NEW",
      "toStatus": "NEW",
      "fromDepartment": "reception",
      "toDepartment": "housekeeping"
    },
    {
      "fromStatus": "NEW",
      "toStatus": "IN_PROGRESS",
      "fromDepartment": "housekeeping",
      "toDepartment": "housekeeping"
    },
    {
      "fromStatus": "IN_PROGRESS",
      "toStatus": "COMPLETED",
      "fromDepartment": "housekeeping",
      "toDepartment": "reception"
    }
  ]
}
```

---

## السيناريو الثاني: "لعبة الكراسي الموسيقية" (Department Transfer)

### الخطوات:
1. **طلب صيانة من الاستقبال**
   - أنشئ طلب صيانة لغرفة 102
   - **التحقق**: الكارت يظهر عند الصيانة في تبويب "جديد"

2. **فني الصيانة يبدأ العمل**
   - اضغط "استلام" في صفحة الصيانة
   - **التحقق**: الحالة تصبح `IN_PROGRESS`

3. **فني الصيانة يحول الطلب للنظافة**
   - بعد إكمال الصيانة، حول الطلب للنظافة (مثلاً: "يحتاج تنظيف")
   - **التحقق**: الكارت يختفي من عند الصيانة
   - **التحقق**: الكارت يظهر عند النظافة كـ `NEW`

4. **الفحص التقني في Firebase Console**
   - افتح Firebase Console
   - ابحث عن الطلب
   - **التحقق**: `involvedDepartments` يحتوي على `['reception', 'maintenance', 'housekeeping']`
   - **التحقق**: `currentDepartment` يكون `housekeeping`
   - **التحقق**: `stateHistory` يحتوي على 3+ transitions

### البيانات المتوقعة:
```json
{
  "currentDepartment": "housekeeping",
  "involvedDepartments": ["reception", "maintenance", "housekeeping"],
  "stateHistory": [
    {
      "fromDepartment": "reception",
      "toDepartment": "maintenance"
    },
    {
      "fromDepartment": "maintenance",
      "toDepartment": "maintenance",
      "toStatus": "IN_PROGRESS"
    },
    {
      "fromDepartment": "maintenance",
      "toDepartment": "housekeeping",
      "toStatus": "NEW"
    }
  ]
}
```

---

## السيناريو الثالث: "اختبار اليقظة" (Reception Alert Test)

### الخطوات:
1. **فتح صفحتين جنب بعض**
   - افتح صفحة الاستقبال في تبويب
   - افتح صفحة النظافة في تبويب آخر

2. **إكمال طلب من النظافة**
   - في صفحة النظافة، اضغط "تم" على أي طلب
   - **التحقق**: الكارت يظهر عند الاستقبال **لحظياً** (Real-time) بدون Refresh
   - **التحقق**: الكارت له border تيركواز (`border-teal-500`)
   - **التحقق**: الكارت له animation pulse (`reception-alert-pulse`)

3. **الاستقبال يؤكد الإغلاق**
   - في صفحة الاستقبال، اضغط على الكارت
   - اضغط "تأكيد" أو "إغلاق"
   - **التحقق**: الـ `isActionRequiredByReception` يتحول لـ `false`
   - **التحقق**: النور التيركواز يطفى (border يعود للعادي)

### الكود المطلوب في Reception:
```typescript
// عند تأكيد الإغلاق
await moveRequest(
  tenantId,
  requestId,
  'COMPLETED', // أو يمكن إضافة status جديد مثل 'CLOSED'
  'reception',
  userId,
  userName,
  'تم إغلاق الطلب'
);
// أو ببساطة:
await updateDoc(requestRef, {
  isActionRequiredByReception: false
});
```

---

## السيناريو الرابع: "تداخل الـ QR" (Guest Interaction)

### الخطوات:
1. **طلب من QR كأنك نزيل**
   - افتح صفحة النزيل (Guest Dashboard)
   - اعمل طلب "مشروبات" عن طريق QR
   - **التحقق**: الكارت يروح للاستقبال أولاً
   - **التحقق**: الحالة `NEW`
   - **التحقق**: المالك `reception`

2. **الاستقبال يوافق ويبعته للـ Coffee Shop**
   - في صفحة الاستقبال، اضغط "تأكيد"
   - حول الطلب للـ Coffee Shop
   - **التحقق**: `currentDepartment` بقى `coffeeShop` (أو `coffee_shop`)
   - **التحقق**: `involvedDepartments` سجلت `['reception', 'coffeeShop']` (أو `['guest', 'reception', 'coffeeShop']`)

### البيانات المتوقعة:
```json
{
  "source": "QR",
  "currentDepartment": "coffeeShop",
  "involvedDepartments": ["reception", "coffeeShop"],
  "stateHistory": [
    {
      "fromDepartment": "reception",
      "toDepartment": "reception",
      "notes": "طلب من QR"
    },
    {
      "fromDepartment": "reception",
      "toDepartment": "coffeeShop",
      "notes": "تم التحويل للـ Coffee Shop"
    }
  ]
}
```

---

## 📋 جدول استلام النتائج

| الفحص | المتوقع | النتيجة | الملاحظات |
|------|---------|---------|-----------|
| **تعدد الأماكن** | الكارت يظهر عند "مالك واحد" فقط في نفس الوقت | ⬜ | يجب أن يختفي من القسم القديم ويظهر في الجديد فوراً |
| **الألوان** | التيركواز يظهر فقط لما الحالة `COMPLETED` وعند الاستقبال | ⬜ | يجب أن يكون `isActionRequiredByReception === true` |
| **الأرشيف** | القسم يشوف الكروت اللي شارك فيها بس | ⬜ | بناءً على `involvedDepartments` |
| **السرعة** | الانتقال بين الحالات يتم في أقل من ثانية | ⬜ | Real-time updates بدون Refresh |
| **الذاكرة** | `involvedDepartments` يسجل كل الأقسام اللي لمست الكارت | ⬜ | يجب أن يكون Array شامل |
| **التاريخ** | `stateHistory` يسجل كل transition بالتفصيل | ⬜ | userId, userName, timestamp, notes |

---

## 🔍 نقاط الفحص التقنية

### 1. Firebase Console Checks:
```javascript
// في Firebase Console، ابحث عن request document
// تحقق من:
- currentDepartment: يجب أن يكون واحد فقط في كل وقت
- involvedDepartments: Array يحتوي على جميع الأقسام
- isActionRequiredByReception: boolean (true فقط عند COMPLETED)
- stateHistory: Array من StateTransition objects
```

### 2. Browser Console Checks:
```javascript
// افتح Console في المتصفح
// تحقق من:
- console.log messages من stateTransitionService
- Real-time updates (onSnapshot callbacks)
- No errors في Network tab
```

### 3. UI Checks:
- Border color: `border-teal-500` عند `isActionRequiredByReception === true`
- Animation: `reception-alert-pulse` class موجودة
- Real-time: التحديثات بدون Refresh

---

## ✅ Checklist قبل الاختبار:

- [ ] السيرفر يعمل (`npm run dev`)
- [ ] Firebase متصل
- [ ] User مسجل دخول
- [ ] Tenant ID موجود
- [ ] Feature Flags مفعلة (Universal Card + State Machine)
- [ ] Console مفتوح للـ debugging

---

## 🐛 مشاكل محتملة وحلولها:

### المشكلة: الكارت لا ينتقل بين الأقسام
**الحل**: تحقق من أن `moveRequest` يتم استدعاؤه بشكل صحيح

### المشكلة: التيركواز لا يظهر
**الحل**: تحقق من أن `isActionRequiredByReception === true` في Firebase

### المشكلة: Real-time updates لا تعمل
**الحل**: تحقق من أن `onSnapshot` يعمل بشكل صحيح في Dashboards

### المشكلة: `involvedDepartments` لا يسجل الأقسام
**الحل**: تحقق من أن `moveRequest` يضيف الأقسام للـ Set بشكل صحيح
