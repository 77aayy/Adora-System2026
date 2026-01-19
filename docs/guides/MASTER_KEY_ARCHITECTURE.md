# 🔐 Master Key Architecture - Cloud Functions Gateway

## 📋 المفهوم

بدلاً من كتابة 1000 سطر في Firestore Rules، نستخدم **سطر واحد فقط**:
```
allow write: if false; // ✅ Only Cloud Functions (Admin SDK) can write
```

**جميع عمليات الكتابة** تتم عبر Cloud Functions باستخدام Admin SDK.

---

## ✅ الفوائد

### 1. **البساطة**
- ❌ **قبل:** 200+ سطر في Rules معقدة
- ✅ **بعد:** سطر واحد: `allow write: if false`

### 2. **الأمان**
- ✅ **Admin SDK** لا يخضع للـ Rules (bypass كامل)
- ✅ **التحقق** في JavaScript (أسهل من Rules language)
- ✅ **Rate Limiting** في Functions
- ✅ **Audit Logs** تلقائية

### 3. **التكلفة**
- ✅ **منع العمليات الغلط** من Client
- ✅ **تقليل القراءات** (Client يقرأ فقط ما يحتاجه)
- ✅ **Batch Operations** في Functions (أرخص)

### 4. **الأداء**
- ✅ **Offline Mode** يعمل (Client يقرأ من Cache)
- ✅ **Real-time Listeners** تعمل (للقراءة فقط)
- ✅ **سرعة** (لا توجد Rules معقدة للتحقق)

### 5. **الصيانة**
- ✅ **JavaScript** بدلاً من Rules language
- ✅ **Testing** أسهل (Unit tests للـ Functions)
- ✅ **Debugging** أسهل (Logs واضحة)

---

## 🏗️ البنية المقترحة

### **Firestore Rules (بسيطة جداً)**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ✅ READ-ONLY للجميع (Authenticated)
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // ✅ فقط Cloud Functions تكتب
    }
    
    // ✅ استثناءات (إذا لزم الأمر)
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null; // Client يمكنه إنشاء logs
      allow update, delete: if false;
    }
  }
}
```

### **Cloud Functions (Gateway)**

```typescript
// functions/src/data/roomOperations.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

/**
 * ✅ Master Key: Check-in Guest
 * Client calls this → Function validates → Writes with Admin SDK
 */
export const checkInGuest = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // 1. Security: Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول');
    }
    
    // 2. Validate input
    const { roomNumber, guestName, tenantId } = data;
    if (!roomNumber || !guestName || !tenantId) {
      throw new functions.https.HttpsError('invalid-argument', 'بيانات ناقصة');
    }
    
    // 3. Business Logic (JavaScript - أسهل من Rules!)
    const db = admin.firestore();
    const roomRef = db.doc(`tenants/${tenantId}/rooms/${roomNumber}`);
    const roomSnap = await roomRef.get();
    
    if (!roomSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'الغرفة غير موجودة');
    }
    
    const roomData = roomSnap.data();
    if (roomData.status === 'occupied') {
      throw new functions.https.HttpsError('failed-precondition', 'الغرفة مشغولة');
    }
    
    // 4. Write with Admin SDK (bypasses Rules)
    const batch = db.batch();
    
    // Create room card
    const roomCardRef = db.collection(`tenants/${tenantId}/roomCards`).doc();
    batch.set(roomCardRef, {
      roomNumber,
      guestName,
      status: 'active',
      checkInTime: admin.firestore.FieldValue.serverTimestamp(),
      tenantId,
      createdBy: context.auth.uid
    });
    
    // Update room status
    batch.update(roomRef, {
      status: 'occupied',
      currentGuestId: roomCardRef.id,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    await batch.commit();
    
    // 5. Return result
    return { success: true, roomCardId: roomCardRef.id };
  });
```

---

## 📊 المقارنة

### **قبل (Client-Side Writes)**

```typescript
// ❌ Client يكتب مباشرة
const roomRef = doc(db, `tenants/${tenantId}/rooms/${roomNumber}`);
await updateDoc(roomRef, { status: 'occupied' });
// ⚠️ Rules معقدة للتحقق
// ⚠️ يمكن تجاوزها
// ⚠️ تكلفة عالية
```

### **بعد (Cloud Functions Gateway)**

```typescript
// ✅ Client يستدعي Function
const checkIn = httpsCallable(functions, 'checkInGuest');
const result = await checkIn({ roomNumber, guestName, tenantId });
// ✅ Rules بسيطة (read-only)
// ✅ أمان 100%
// ✅ تكلفة أقل
```

---

## 🚀 خطة التنفيذ

### **Phase 1: Core Operations** (أولوية عالية)
- ✅ `checkInGuest` - تسكين نزيل
- ✅ `checkOutGuest` - تسجيل خروج
- ✅ `createRequest` - إنشاء طلب
- ✅ `updateRequestStatus` - تحديث حالة الطلب

### **Phase 2: Business Operations**
- ✅ `createProcurementRequest` - طلب شراء
- ✅ `addLostFoundItem` - إضافة مفقودات
- ✅ `createTransaction` - معاملة مالية

### **Phase 3: Admin Operations**
- ✅ `updateSystemSettings` - تحديث إعدادات
- ✅ `createManager` - إنشاء مدير (موجود بالفعل)
- ✅ `updateUserRole` - تحديث صلاحيات

---

## ⚡ الأداء

### **Offline Mode**
- ✅ **Client يقرأ** من Cache (يعمل Offline)
- ✅ **Writes** تنتظر الاتصال (Queue في Functions)
- ✅ **Real-time** يعمل (للقراءة فقط)

### **التكلفة**
- ✅ **Client Reads:** نفس التكلفة (لكن أقل لأننا نمنع القراءات الغلط)
- ✅ **Functions Writes:** أرخص من Client writes (Batch operations)
- ✅ **Rules Evaluation:** تكلفة = 0 (Rules بسيطة جداً)

---

## 🔒 الأمان

### **التحقق في Functions**
```typescript
// ✅ JavaScript - أسهل وأقوى من Rules
if (roomData.status === 'occupied') {
  throw new Error('الغرفة مشغولة');
}

// ✅ Rate Limiting
const rateLimit = await checkRateLimit(userId, 'checkIn');
if (!rateLimit.allowed) {
  throw new Error('طلبات كثيرة جداً');
}

// ✅ Audit Logs
await logAction({
  action: 'CHECK_IN',
  userId: context.auth.uid,
  details: { roomNumber, guestName }
});
```

---

## 📝 ملاحظات مهمة

1. **Offline Support:** Client يقرأ من Cache، Writes تنتظر الاتصال
2. **Real-time:** يعمل للقراءة فقط (أسرع وأرخص)
3. **Migration:** يمكن التطبيق تدريجياً (Function + Client write معاً)
4. **Testing:** Unit tests للـ Functions أسهل من Rules

---

**تاريخ الإنشاء:** 2026-01-19  
**الحالة:** مقترح للتنفيذ
