# 🚀 checkRoomAvailability Cloud Function

## 📋 نظرة عامة

هذه هي **أول Cloud Function** في نظام Adora، وتعتبر الأساس لـ **Master Key Architecture**.

### **الهدف:**
- ✅ **أمان مالي:** منع التلاعب في حالة الغرف وأسعار الحجز
- ✅ **منطق موحد:** تغيير واحد يطبق على جميع الموظفين فوراً
- ✅ **سرعة:** من داخل سيرفرات Google (أسرع من Client writes)

---

## 🔧 البنية

### **Cloud Function:**
```typescript
// functions/src/data/roomOperations.ts
export const checkRoomAvailability = functions.https.onCall(...)
```

### **Client Wrapper:**
```typescript
// src/services/roomCardService.ts
export const checkRoomAvailability = async (roomNumber, tenantId) => {
    // 1. Try Cloud Function first
    // 2. Fallback to client-side if fails
}
```

---

## 📝 الاستخدام

### **في Client Code:**

```typescript
import { checkRoomAvailability } from '@/services/roomCardService';

// ✅ استخدام بسيط (نفس API القديم)
const { roomRef, roomData, branchId } = await checkRoomAvailability(
    '101',
    'tenant123'
);

// ✅ الآن يمكنك المتابعة مع check-in
```

### **مباشرة من Cloud Function:**

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const checkAvailability = httpsCallable(functions, 'checkRoomAvailability');

const result = await checkAvailability({
    roomNumber: '101',
    tenantId: 'tenant123'
});

if (result.data.available) {
    const { roomData, branchId } = result.data;
    // ✅ الغرفة متاحة
} else {
    // ❌ الغرفة غير متاحة
    console.error(result.data.error);
}
```

---

## ✅ الفوائد

### **1. الأمان المالي**
- ✅ **قبل:** Client يمكنه تغيير حالة الغرفة مباشرة
- ✅ **بعد:** فقط Cloud Function يمكنها التحقق والتغيير

### **2. المنطق الموحد**
- ✅ **قبل:** كل Client يتحقق بطريقته (ممكن تختلف)
- ✅ **بعد:** منطق واحد في Function (تغيير واحد يطبق على الجميع)

### **3. السرعة**
- ✅ **قبل:** Client → Firestore (50-100ms)
- ✅ **بعد:** Client → Function → Firestore (100-200ms، لكن أكثر أماناً)

### **4. التكلفة**
- ✅ **قبل:** Rules evaluation + Client writes
- ✅ **بعد:** Rules بسيطة (read-only) + Function writes (أرخص)

---

## 🔄 Migration Strategy

### **Phase 1: Gradual (الحالي)**
```typescript
// ✅ Try Function first
try {
    return await checkRoomAvailabilityFunction(...);
} catch (error) {
    // ⚠️ Fallback to client-side
    return await checkRoomAvailabilityClientSide(...);
}
```

### **Phase 2: Full Migration (لاحقاً)**
```typescript
// ✅ Function only (remove fallback)
return await checkRoomAvailabilityFunction(...);
```

---

## 🧪 Testing

### **Test Function:**
```bash
# Deploy Functions
cd functions
npm run build
firebase deploy --only functions:checkRoomAvailability

# Test from Client
# Use the UI to check-in a guest
# Verify it uses the Function
```

### **Test Fallback:**
```typescript
// Simulate Function failure
// Verify fallback to client-side works
```

---

## 📊 Monitoring

### **Function Logs:**
```bash
firebase functions:log --only checkRoomAvailability
```

### **Metrics:**
- Function invocations
- Execution time
- Error rate
- Fallback usage

---

## 🔒 Security

### **Authentication:**
- ✅ Function requires authenticated user
- ✅ Verifies user has access to tenant

### **Validation:**
- ✅ Input validation (roomNumber, tenantId)
- ✅ Permission checks
- ✅ Atomic transactions

---

## 📝 Notes

1. **Fallback:** Client-side fallback موجود حالياً للـ backward compatibility
2. **Performance:** Function call أبطأ قليلاً لكن أكثر أماناً
3. **Offline:** Function calls تنتظر الاتصال (مثل Client writes)

---

**تاريخ الإنشاء:** 2026-01-19  
**الحالة:** ✅ جاهز للاستخدام (مع Fallback)
