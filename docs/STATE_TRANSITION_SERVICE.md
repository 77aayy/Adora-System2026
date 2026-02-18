# 🎯 Unified State Transition Service

## المرحلة الأولى: State Machine الموحد

### الهدف
توحيد نظام الحالات من **15+ حالة** إلى **3 حالات فقط**: `NEW` → `IN_PROGRESS` → `COMPLETED`

### البنية الجديدة

#### الحقول الجديدة في Request:
```typescript
{
  // Core unified fields
  currentDepartment: "housekeeping", // القسم الحالي
  originDepartment: "reception", // القسم الأصلي
  involvedDepartments: ["reception", "housekeeping", "maintenance"], // كل الأقسام المشاركة
  isActionRequiredByReception: false, // هل يحتاج الاستقبال للعمل؟
  stateHistory: [...] // سجل التنقلات
}
```

### كيفية الاستخدام

#### 1. تهيئة طلب جديد (عند الإنشاء):
```typescript
import { initializeRequest } from '@/services/stateTransitionService';

await initializeRequest(
  tenantId,
  requestId,
  'cleaning', // type
  'reception', // originDepartment
  'housekeeping', // targetDepartment
  userId,
  userName,
  'طلب تنظيف من QR'
);
```

#### 2. نقل الطلب بين الحالات:
```typescript
import { moveRequest } from '@/services/stateTransitionService';

// مثال: النظافة تستلم الطلب
await moveRequest(
  tenantId,
  requestId,
  'NEW', // newStatus
  'housekeeping', // targetDepartment
  userId,
  userName,
  'تم استلام الطلب'
);

// مثال: النظافة تبدأ العمل
await moveRequest(
  tenantId,
  requestId,
  'IN_PROGRESS', // newStatus
  'housekeeping', // targetDepartment (يظل نفسه)
  userId,
  userName,
  'بدأ التنظيف'
);

// مثال: النظافة تحتاج صيانة
await moveRequest(
  tenantId,
  requestId,
  'NEW', // يرجع NEW عند الصيانة
  'maintenance', // targetDepartment يتغير
  userId,
  userName,
  'يحتاج صيانة - حنفية مكسورة'
);

// مثال: النظافة تنهي العمل
await moveRequest(
  tenantId,
  requestId,
  'COMPLETED', // newStatus
  'reception', // يرجع للاستقبال
  userId,
  userName,
  'تم التنظيف'
);
// ⚠️ ملاحظة: عند COMPLETED + reception، isActionRequiredByReception = true تلقائياً
```

### نظام التبويبات (Tabs Logic)

#### تبويب "جديد":
```typescript
where('currentDepartment', '==', 'housekeeping')
&& where('status', '==', 'NEW')
```

#### تبويب "جاري":
```typescript
where('currentDepartment', '==', 'housekeeping')
&& where('status', '==', 'IN_PROGRESS')
```

#### تبويب "تم":
```typescript
where('status', '==', 'COMPLETED')
&& where('involvedDepartments', 'array-contains', 'housekeeping')
```

### التنبيه في الاستقبال

عندما `isActionRequiredByReception = true`:
- الكارت يظهر في تبويب "تم" عند الاستقبال
- يظهر بحدود تيركواز 🔵 للتنبيه
- الاستقبال يعرف إن الكارت خلص ويحتاج إقفال

### Backward Compatibility

الخدمة تدعم التوافق مع النظام القديم:
- الحالات القديمة (PENDING_RECEPTION, etc.) تُحول تلقائياً
- النظام القديم (`workflowService`) لا يزال يعمل
- يمكن الانتقال التدريجي

### الخطوات التالية

1. ✅ **المرحلة 1**: State Machine (مكتمل)
2. ⏳ **المرحلة 2**: Pulse Card + Progress Bar
3. ⏳ **المرحلة 3**: Points Integration
