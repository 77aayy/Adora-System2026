# 🚨 دليل رموز الأخطاء - Error Codes Guide

> **للمبرمج المتوسط:** هذا الملف يساعدك على فهم وحل الأخطاء بسرعة

---

## 📋 فهرس الأخطاء

| الفئة | الرمز | الوصف |
|-------|-------|-------|
| 🔥 Firebase | FB-xxx | أخطاء Firebase |
| 🔐 Auth | AUTH-xxx | أخطاء المصادقة |
| 🚪 Room | ROOM-xxx | أخطاء الغرف |
| 📝 Request | REQ-xxx | أخطاء الطلبات |
| 👤 User | USER-xxx | أخطاء المستخدمين |
| 🌐 Network | NET-xxx | أخطاء الشبكة |

---

## 🔥 أخطاء Firebase

### FB-001: Firebase Not Initialized
```
الرسالة: "⚠️ NO VALID FIREBASE CONFIGURATION FOUND"
```

**السبب:**
- ملف `.env` غير موجود أو فارغ
- مفاتيح Firebase غير صحيحة

**الحل:**
```bash
# 1. أنشئ ملف .env
cp env.example.txt .env

# 2. أضف المفاتيح
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
# ...
```

---

### FB-002: Collection Invalid Argument
```
الرسالة: "Expected first argument to collection() to be a CollectionReference"
```

**السبب:**
- `db` قيمته `null`
- Firebase لم يتم تهيئته

**الحل:**
```typescript
// أضف هذا الفحص قبل أي عملية
if (!db) {
  console.warn('Firebase not initialized');
  return defaultValue;
}
```

---

### FB-003: Permission Denied
```
الرسالة: "FirebaseError: Missing or insufficient permissions"
```

**السبب:**
- قواعد Firestore ترفض العملية
- المستخدم يحاول الوصول لبيانات tenant آخر

**الحل:**
```typescript
// تأكد من أنك تستخدم tenantId الصحيح
const tenantId = user.tenantId; // من الجلسة
query(collection(db, `tenants/${tenantId}/rooms`));
```

---

### FB-004: Document Not Found
```
الرسالة: "Document does not exist"
```

**السبب:**
- المعرف خاطئ
- الوثيقة محذوفة

**الحل:**
```typescript
const docSnap = await getDoc(docRef);
if (!docSnap.exists()) {
  // تعامل مع الحالة
  return null;
}
```

---

## 🔐 أخطاء المصادقة

### AUTH-001: Invalid Code
```
الرسالة: "رمز الدخول غير صحيح"
```

**السبب:**
- الكود غير موجود في `globalCodes`

**الحل:**
```typescript
// تأكد من صيغة الكود
// للموظف: branchCode (1-4) + employeeCode (4) = "011234"
// للمالك: ownerCode (6) = "765255"
```

---

### AUTH-002: Account Suspended
```
الرسالة: "الحساب موقوف. تواصل مع المدير"
```

**السبب:**
- `employee.status !== 'active'`

**الحل:**
```typescript
// في لوحة الإدارة:
await updateDoc(employeeRef, { status: 'active' });
```

---

### AUTH-003: Rate Limited
```
الرسالة: "تم تجاوز حد المحاولات. يرجى الانتظار X دقيقة"
```

**السبب:**
- أكثر من 5 محاولات فاشلة

**الحل:**
```typescript
// انتظر 15 دقيقة
// أو امسح localStorage:
localStorage.removeItem('login_attempts');
```

---

### AUTH-004: Session Expired
```
الرسالة: "انتهت الجلسة"
```

**السبب:**
- مضى وقت طويل على آخر نشاط

**الحل:**
```typescript
// أعد تسجيل الدخول
// أو استخدم refreshToken
```

---

## 🚪 أخطاء الغرف

### ROOM-001: Room Not Found
```
الرسالة: "الغرفة غير موجودة"
```

**السبب:**
- رقم الغرفة خاطئ
- معرف الغرفة غير صحيح

**الحل:**
```typescript
// تأكد من صيغة المعرف
const roomId = `${branchId}_${roomNumber}`; // "branch_001_101"
```

---

### ROOM-002: Room Not Available
```
الرسالة: "ROOM_NOT_AVAILABLE"
```

**السبب:**
- `roomCard.qrActive === false`
- النزيل سجل خروج

**الحل:**
```typescript
// تحقق من حالة البطاقة
const roomCard = await getActiveRoomCard(roomNumber, branchId);
if (!roomCard || !roomCard.qrActive) {
  throw new Error('ROOM_NOT_AVAILABLE');
}
```

---

### ROOM-003: Room Already Occupied
```
الرسالة: "الغرفة مشغولة بالفعل"
```

**السبب:**
- `room.status === 'occupied'`

**الحل:**
```typescript
// تحقق من الحالة قبل التسكين
if (room.status !== 'available') {
  throw new Error('Room not available');
}
```

---

## 📝 أخطاء الطلبات

### REQ-001: Request Not Found
```
الرسالة: "الطلب غير موجود"
```

**السبب:**
- معرف الطلب خاطئ
- الطلب محذوف

**الحل:**
```typescript
const request = await getRequest(requestId);
if (!request) {
  // redirect to requests list
}
```

---

### REQ-002: Invalid Status Transition
```
الرسالة: "لا يمكن تغيير الحالة من X إلى Y"
```

**السبب:**
- محاولة تغيير حالة غير منطقية

**مخطط التحويلات المسموحة:**
```
PENDING_RECEPTION → CONFIRMED → IN_PROGRESS → COMPLETED
                 ↘           ↘             ↘
                   CANCELLED   WAITING_PARTS  CANCELLED
```

---

### REQ-003: Rate Limited
```
الرسالة: "لقد تجاوزت الحد المسموح من الطلبات"
```

**السبب:**
- أكثر من 5 طلبات في الدقيقة

**الحل:**
```typescript
// انتظر دقيقة واحدة
// أو راجع utils/rateLimiter.ts
```

---

## 👤 أخطاء المستخدمين

### USER-001: User Not Found
```
الرسالة: "المستخدم غير موجود"
```

**الحل:**
```typescript
const user = await getUserById(userId);
if (!user) {
  // redirect to login
}
```

---

### USER-002: Pin Already Used
```
الرسالة: "هذا الكود مستخدم بالفعل"
```

**السبب:**
- محاولة إنشاء موظف بكود موجود

**الحل:**
```typescript
const isAvailable = await isPinAvailable(pin);
if (!isAvailable) {
  const suggested = await suggestUniquePin();
  // اقترح الكود الجديد للمستخدم
}
```

---

### USER-003: Device Blocked
```
الرسالة: "تم حظر هذا الجهاز مؤقتاً"
```

**السبب:**
- أكثر من 3 محاولات فاشلة للتحقق

**الحل:**
```typescript
// انتظر 30 دقيقة
// أو امسح بيانات المتصفح
```

---

## 🌐 أخطاء الشبكة

### NET-001: Offline
```
الرسالة: "أنت غير متصل بالإنترنت"
```

**السبب:**
- لا يوجد اتصال بالإنترنت

**الحل:**
```typescript
// النظام يدعم Offline Mode
// البيانات ستُزامن عند عودة الاتصال
```

---

### NET-002: Timeout
```
الرسالة: "انتهت مهلة الطلب"
```

**السبب:**
- الخادم بطيء
- الاتصال ضعيف

**الحل:**
```typescript
// أعد المحاولة
// أو تحقق من الاتصال
```

---

## 🔧 Debug Commands

```javascript
// في Console المتصفح:

// فحص Firebase
window.debugGenius.checkFirebase()

// فحص المستخدم الحالي
window.debugGenius.getCurrentUser()

// مسح الكاش
window.debugGenius.clearCache()

// فحص الجلسة
localStorage.getItem('adora_session')

// مسح محاولات الدخول
localStorage.removeItem('login_attempts')
```

---

## 📞 للمساعدة

إذا واجهت خطأ غير موثق:

1. **انسخ الرسالة كاملة**
2. **انسخ Stack Trace**
3. **سجل الخطوات التي أدت للخطأ**
4. **تواصل مع:**
   - 📱 +966 570 707 121
   - 📧 77aayy@gmail.com

---

> **نصيحة:** معظم الأخطاء سببها `null` أو `undefined`. دائماً تحقق!

