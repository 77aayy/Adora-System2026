# Adora Hotel Management System V3

نظام إدارة الفنادق الذكي - SaaS Multi-Tenant Platform


[![Version](https://img.shields.io/badge/version-3.5.0-blue.svg)](https://github.com/adora-hotel/adora-hotel-system)
[![Status](https://img.shields.io/badge/status-Production%20Ready-green.svg)](https://github.com/adora-hotel/adora-hotel-system)
[![i18n](https://img.shields.io/badge/i18n-4%20Languages-blue.svg)](https://github.com/adora-hotel/adora-hotel-system)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.7-orange.svg)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)

---

# 📚 الوثائق التقنية (Technical Documentation)

## 📋 جدول المحتويات

1. [دورة حياة الطلب (Request Flow)](#1-دورة-حياة-الطلب-request-flow--closed-loops)
2. [منطق الحماية الثلاثي (Triple-Lock Logic)](#2-منطق-الحماية-الثلاثي-triple-lock-logic)
3. [مصفوفة الصلاحيات (RBAC)](#3-مصفوفة-الصلاحيات-rbac---role-based-access-control)
4. [الربط بين الفروع والغرف (Multi-Branch Logic)](#4-الربط-بين-الفروع-والغرف-multi-branch-logic)
5. [حدود الأمان والميزانية (Security & Quota)](#5-حدود-الأمان-والميزانية-security--quota-limits)

---

## 1. دورة حياة الطلب (Request Flow & Closed Loops)

### 🔄 الدورة الكاملة من مسح QR حتى شاشة الموظف

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         📱 مسح QR Code بواسطة النزيل                         │
│                                                                             │
│   URL: /guest?token=abc123xyz                                               │
│   ⚠️ لم يعد يُرسل roomNumber مباشرة (تم إصلاح ثغرة IDOR)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🔐 التحقق من Token (secureAccessService.ts)               │
│                                                                             │
│   1. validateSecureAccessToken(token)                                       │
│      ├─ هل Token موجود في Firestore؟                                        │
│      ├─ هل Token نشط (isActive: true)؟                                      │
│      ├─ هل Token غير منتهي الصلاحية (expiresAt > now)؟                       │
│      ├─ هل عدد الأجهزة لم يتجاوز الحد (maxDevices: 3)؟                       │
│      └─ إذا فشل أي شرط → تسجيل Security Alert + رفض الوصول                  │
│                                                                             │
│   2. isLegacyInsecureAccess(url)                                            │
│      └─ رفض الروابط القديمة التي تحتوي على roomNumber مباشرة                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🔑 المصادقة المجهولة (anonymousAuthService.ts)            │
│                                                                             │
│   await ensureAnonymousAuth()                                               │
│   ├─ إذا المستخدم غير مصادق → signInAnonymously()                           │
│   ├─ حفظ UID في الجلسة                                                      │
│   └─ ربط UID بـ tenantId تلقائياً                                           │
│                                                                             │
│   ⚡ لماذا Anonymous Auth؟                                                   │
│   - يمنح هوية مؤقتة للنزيل                                                   │
│   - يمكّن Security Rules من التحقق                                          │
│   - يمكّن Rate Limiting على مستوى UID                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    📍 التحقق من الموقع (locationService.ts)                  │
│                                                                             │
│   await verifyGuestLocation(branchCoords, maxDistance)                      │
│   └─ حساب المسافة باستخدام Haversine Formula (انظر القسم 2)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ✅ عرض صفحة الخدمات للنزيل                                │
│                                                                             │
│   GuestDashboard.tsx                                                        │
│   ├─ خدمات متاحة: صيانة، نظافة، خروج متأخر، كوفي شوب                        │
│   ├─ Smart Chat للتواصل المباشر                                             │
│   └─ Emergency Alerts للطوارئ                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              🚀 لحظة الضغط على "إرسال" - ماذا يحدث في الخلفية؟               │
│                                                                             │
│   // guestAdvancedFeatures.ts - submitRequest()                             │
│                                                                             │
│   async function submitRequest(requestData) {                               │
│                                                                             │
│     // 1️⃣ Rate Limit Check (أول شيء!)                                       │
│     const canProceed = await ensureGuestCanAct(tenantId, guestUID);         │
│     if (!canProceed) {                                                      │
│       throw new Error('RATE_LIMIT_EXCEEDED');                               │
│       // → 10 طلبات/ساعة كحد أقصى                                           │
│     }                                                                       │
│                                                                             │
│     // 2️⃣ Data Validation                                                   │
│     validateRequestData(requestData);                                       │
│     // → التأكد من وجود: type, roomNumber, description                      │
│     // → ⚠️ لا يُقبل price أو total من العميل (Price Shield)                 │
│                                                                             │
│     // 3️⃣ Enrich with Security Data                                         │
│     const enrichedRequest = {                                               │
│       ...requestData,                                                       │
│       tenantId: session.tenantId,      // ✅ إجباري للـ SaaS                 │
│       branchId: session.branchId,      // ✅ تحديد الفرع                     │
│       source: 'guest',                 // ✅ تمييز مصدر الطلب                │
│       createdAt: serverTimestamp(),                                         │
│       status: 'pending',                                                    │
│       guestUID: auth.currentUser.uid   // ✅ للتتبع                          │
│     };                                                                      │
│                                                                             │
│     // 4️⃣ Write to Firestore                                                │
│     await addDoc(collection(db, 'requests'), enrichedRequest);              │
│                                                                             │
│     // 5️⃣ Record Rate Limit Usage                                           │
│     await recordGuestAction(tenantId, guestUID);                            │
│                                                                             │
│     // 6️⃣ Trigger Notifications (Background)                                │
│     sendPushNotification(targetDepartment, 'طلب جديد من غرفة ' + room);     │
│   }                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🔔 وصول الطلب لشاشة الموظف                                │
│                                                                             │
│   // Real-time Listener في Dashboard الموظف                                 │
│   onSnapshot(                                                               │
│     query(                                                                  │
│       collection(db, 'requests'),                                           │
│       where('tenantId', '==', currentTenantId),  // 🔐 عزل المستأجر          │
│       where('branchId', '==', currentBranchId),  // 🔐 عزل الفرع             │
│       where('status', '==', 'pending'),                                     │
│       orderBy('createdAt', 'desc')                                          │
│     ),                                                                      │
│     (snapshot) => {                                                         │
│       // ✨ تحديث فوري على الشاشة                                           │
│       setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));│
│       // 🔊 صوت تنبيه + Haptic Feedback                                     │
│       playSound('notification');                                            │
│       haptic('heavy');                                                      │
│     }                                                                       │
│   );                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 مخطط حالات الطلب (Request State Machine)

```
                    ┌─────────────┐
                    │   pending   │ ← الحالة الابتدائية
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ accepted │ │ rejected │ │ cancelled│
        └────┬─────┘ └──────────┘ └──────────┘
             │
             ▼
        ┌──────────┐
        │in_progress│
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │ completed │ ← نهاية الدورة + حساب النقاط
        └──────────┘
```

---

## 2. منطق الحماية الثلاثي (Triple-Lock Logic)

### 🔒 القفل الأول: قفل المسافة (Distance Lock)

#### المعادلة المستخدمة: Haversine Formula

```typescript
// src/services/locationService.ts

/**
 * Haversine Formula - لحساب المسافة بين نقطتين على سطح الكرة الأرضية
 * 
 * المعادلة الرياضية:
 * a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
 * c = 2 ⋅ atan2( √a, √(1−a) )
 * d = R ⋅ c
 * 
 * حيث:
 * - φ = خط العرض (latitude) بالراديان
 * - λ = خط الطول (longitude) بالراديان
 * - R = نصف قطر الأرض (6371 كم)
 */

export function calculateDistance(
  lat1: number, lon1: number,  // موقع النزيل
  lat2: number, lon2: number   // موقع الفندق
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومتر
  
  // تحويل الدرجات إلى راديان
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  // تطبيق معادلة Haversine
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c * 1000; // النتيجة بالمتر
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
```

#### متى يتم التحقق من المسافة؟

```
┌─────────────────────────────────────────────────────────────┐
│                    سيناريوهات التحقق                         │
├─────────────────────────────────────────────────────────────┤
│ ✅ عند فتح صفحة الخدمات (أول مرة)                            │
│ ✅ عند إرسال أي طلب (كل مرة)                                 │
│ ✅ عند فتح Chat مع الاستقبال                                 │
│ ❌ لا يُفحص أثناء التصفح داخل الصفحة                         │
└─────────────────────────────────────────────────────────────┘

// الإعدادات الافتراضية
const DEFAULT_MAX_DISTANCE = 100; // متر (قابل للتعديل من المدير)

// التحقق في كل طلب
async function verifyAndSubmit(request) {
  const branchSettings = await getBranchSettings(branchId);
  const maxDistance = branchSettings.maxQRDistance || DEFAULT_MAX_DISTANCE;
  
  const guestPosition = await getCurrentPosition();
  const distance = calculateDistance(
    guestPosition.lat, guestPosition.lng,
    branchSettings.location.lat, branchSettings.location.lng
  );
  
  if (distance > maxDistance) {
    logSecurityAlert('DISTANCE_VIOLATION', {
      guestUID, distance, maxAllowed: maxDistance
    });
    throw new Error('OUTSIDE_ALLOWED_AREA');
  }
  
  // ✅ المسافة مقبولة - تابع
  return submitRequest(request);
}
```

---

### 🔒 القفل الثاني: قفل الحالة (Status Lock)

#### كيف يعرف النظام أن الكارت Active؟

```typescript
// src/services/roomCardService.ts

interface RoomCard {
  id: string;
  roomNumber: string;
  branchId: string;
  tenantId: string;
  status: 'active' | 'inactive' | 'checked_out';
  qrActive: boolean;        // ✅ هل QR مفعّل؟
  checkInTime: Timestamp;
  expectedCheckOut: Timestamp;
  guestInfo: {
    name: string;
    phone: string;
    idNumber?: string;
  };
}

// التحقق من حالة الكارت
async function verifyRoomCardStatus(roomNumber: string, branchId: string): Promise<boolean> {
  const roomCardsRef = collection(db, 'roomCards');
  const q = query(
    roomCardsRef,
    where('roomNumber', '==', roomNumber),
    where('branchId', '==', branchId),
    where('status', '==', 'active'),      // ✅ الحالة نشطة
    where('qrActive', '==', true),        // ✅ QR مفعّل
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}
```

#### هل يوجد Sync لحظي؟

```
┌─────────────────────────────────────────────────────────────┐
│                    🔄 Real-time Sync                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   الموظف يقفل الـ QR من شاشته                               │
│              │                                              │
│              ▼                                              │
│   updateDoc(roomCardRef, {                                  │
│     qrActive: false,          // ← تحديث فوري              │
│     deactivatedAt: now(),                                   │
│     deactivatedBy: employeeId                               │
│   });                                                       │
│              │                                              │
│              ▼                                              │
│   ┌─────────────────────────────────────┐                   │
│   │ Firestore Real-time Trigger         │                   │
│   │ (يحدث في < 1 ثانية)                │                   │
│   └─────────────────────────────────────┘                   │
│              │                                              │
│              ▼                                              │
│   النزيل يحاول إرسال طلب جديد                               │
│              │                                              │
│              ▼                                              │
│   verifyRoomCardStatus() → returns false                    │
│              │                                              │
│              ▼                                              │
│   ❌ "عذراً، تم إيقاف خدمات الغرفة"                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

// ⚡ ملاحظة: لا يوجد Polling - فقط Server-side Check عند كل طلب
```

---

### 🔒 القفل الثالث: قفل الهوية (Identity Lock)

#### كيف يرتبط Anonymous Auth بـ tenantId؟

```typescript
// src/services/anonymousAuthService.ts

/**
 * الربط التلقائي بين Anonymous UID و TenantId
 * 
 * المنطق:
 * 1. النزيل يمسح QR → يحصل على token
 * 2. Token يحتوي على tenantId مشفر
 * 3. عند signInAnonymously → نحفظ الربط في guestRateLimits
 */

async function ensureAnonymousAuth(tenantId: string): Promise<string> {
  let user = auth.currentUser;
  
  if (!user) {
    // 🔐 تسجيل دخول مجهول
    const credential = await signInAnonymously(auth);
    user = credential.user;
  }
  
  // 📝 حفظ الربط: UID ↔ TenantId
  const rateLimitRef = doc(db, 'guestRateLimits', `${tenantId}_${user.uid}`);
  await setDoc(rateLimitRef, {
    tenantId,           // ✅ ربط بالفندق
    uid: user.uid,
    createdAt: serverTimestamp(),
    requestCount: 0,
    lastRequestAt: null
  }, { merge: true });
  
  return user.uid;
}
```

#### لماذا هذا مهم للـ Security Rules؟

```javascript
// firestore.rules

// ✅ قاعدة تسمح للنزيل المجهول بإنشاء طلب فقط لفندقه
match /requests/{requestId} {
  allow create: if 
    // 1️⃣ يجب أن يكون مصادق (حتى لو مجهول)
    request.auth != null &&
    
    // 2️⃣ يجب أن يأتي من مصدر "guest"
    request.resource.data.source == 'guest' &&
    
    // 3️⃣ يجب أن يحتوي على tenantId
    request.resource.data.tenantId != null &&
    
    // 4️⃣ يجب أن يكون له Rate Limit Record مسجل
    exists(/databases/$(database)/documents/guestRateLimits/$(request.resource.data.tenantId + '_' + request.auth.uid)) &&
    
    // 5️⃣ 🛡️ Price Shield - ممنوع إرسال أسعار
    !('price' in request.resource.data) &&
    !('total' in request.resource.data) &&
    !('amount' in request.resource.data);
}
```

---

## 3. مصفوفة الصلاحيات (RBAC - Role-Based Access Control)

### 📊 جدول الصلاحيات الكامل

```
┌──────────────────┬────────────────────┬────────────────────┬────────────────────┐
│                  │      Employee      │      Manager       │    Super Admin     │
│     الميزة       │      (موظف)        │      (مدير)        │    (المالك)        │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ رؤية الطلبات     │ ✅ قسمه فقط        │ ✅ كل الأقسام      │ ✅ كل الفنادق      │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ قبول/رفض طلب    │ ✅ من قسمه         │ ✅ كل الأقسام      │ ❌ لا يتدخل       │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ إضافة موظفين    │ ❌                  │ ✅ لفرعه فقط       │ ❌ (يضيف مديرين)  │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ حذف موظفين      │ ❌                  │ ✅ Soft Delete     │ ❌                 │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ إدارة الغرف     │ ❌                  │ ✅                  │ ❌                 │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ تعميد مشتريات   │ ❌                  │ ✅ (ليس لطلبه)     │ ❌                 │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ تعديل الأسعار   │ ❌                  │ ✅                  │ ✅ سعر الاشتراك   │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ تقارير مالية    │ ❌                  │ ✅ فرعه فقط        │ ✅ كل الفنادق      │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Feature Gates   │ ❌                  │ ❌                  │ ✅ تفعيل/إيقاف    │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ إضافة فنادق    │ ❌                  │ ❌                  │ ✅                  │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ إيقاف فنادق    │ ❌                  │ ❌                  │ ✅                  │
├──────────────────┼────────────────────┼────────────────────┼────────────────────┤
│ Security Logs   │ ❌                  │ ✅ فرعه            │ ✅ كل الفنادق      │
└──────────────────┴────────────────────┴────────────────────┴────────────────────┘
```

### 🔘 الأزرار المختلفة حسب الدور

```typescript
// مثال: RequestCard.tsx

const RequestCard = ({ request, userRole }) => {
  return (
    <div className="request-card">
      <h3>{request.title}</h3>
      
      {/* ✅ يظهر لكل الموظفين */}
      <Button onClick={viewDetails}>عرض التفاصيل</Button>
      
      {/* ✅ يظهر فقط لموظف القسم المعني */}
      {userRole === 'employee' && request.department === user.department && (
        <>
          <Button onClick={acceptRequest}>قبول</Button>
          <Button onClick={rejectRequest}>رفض</Button>
        </>
      )}
      
      {/* ✅ يظهر فقط للمدير */}
      {userRole === 'manager' && (
        <>
          <Button onClick={reassignRequest}>إعادة توجيه</Button>
          <Button onClick={escalateRequest}>تصعيد</Button>
          <Button onClick={viewEmployeePerformance}>أداء الموظف</Button>
        </>
      )}
      
      {/* ❌ المالك لا يرى هذه الصفحة أصلاً */}
    </div>
  );
};
```

### 🛡️ الحماية على مستوى الـ Routes

```typescript
// src/AppRoutes.tsx

// ✅ صفحات الموظفين
<Route path="/housekeeping" element={
  <ProtectedRoute allowedDepartments={['housekeeping']}>
    <HousekeepingDashboard />
  </ProtectedRoute>
} />

// ✅ صفحات المدير
<Route path="/admin" element={
  <ProtectedRoute allowedDepartments={['admin']}>
    <AdminDashboard />
  </ProtectedRoute>
} />

// ✅ صفحات المالك فقط
<Route path="/owner-dashboard" element={
  <ProtectedRoute allowedRoles={['owner']}>
    <OwnerDashboard />
  </ProtectedRoute>
} />
```

---

## 4. الربط بين الفروع والغرف (Multi-Branch Logic)

### 🏨 مشكلة التكرار في أرقام الغرف

```
┌─────────────────────────────────────────────────────────────┐
│                    المشكلة:                                  │
│                                                             │
│   فندق النخيل - فرع القاهرة    →    غرفة 101                │
│   فندق النخيل - فرع الإسكندرية →    غرفة 101                │
│                                                             │
│   كيف نميز بينهما في قاعدة البيانات؟                         │
└─────────────────────────────────────────────────────────────┘
```

### ✅ الحل: Composite Room Identifier

```typescript
// src/services/roomService.ts

/**
 * Room Identifier Structure
 * 
 * Format: {tenantId}_{branchId}_{roomNumber}
 * Example: "tenant-abc123_branch-cairo_101"
 * 
 * أو بشكل مبسط للـ QR:
 * Format: {branchId}_{roomNumber}
 * Example: "cairo_101"
 */

interface Room {
  id: string;                    // Auto-generated Firestore ID
  roomNumber: string;            // "101" - الرقم المعروض
  branchId: string;              // "branch-cairo"
  tenantId: string;              // "tenant-abc123"
  compositeId: string;           // "branch-cairo_101" - للبحث السريع
  
  // ... باقي البيانات
}

// عند إنشاء غرفة جديدة
async function createRoom(roomNumber: string, branchId: string, tenantId: string) {
  const compositeId = `${branchId}_${roomNumber}`;
  
  // ✅ التحقق من عدم التكرار داخل نفس الفرع
  const existingRoom = await getDoc(doc(db, 'rooms', compositeId));
  if (existingRoom.exists()) {
    throw new Error('ROOM_ALREADY_EXISTS_IN_BRANCH');
  }
  
  await setDoc(doc(db, 'rooms', compositeId), {
    roomNumber,
    branchId,
    tenantId,
    compositeId,
    createdAt: serverTimestamp()
  });
}
```

### 🔗 كيف يعمل الـ QR Code؟

```typescript
// src/services/qrCodeService.ts

/**
 * QR Code Generation with Secure Token
 * 
 * الخطوات:
 * 1. توليد Token فريد
 * 2. ربط Token بـ (tenantId, branchId, roomNumber)
 * 3. حفظ في Firestore مع تاريخ انتهاء
 * 4. توليد URL آمن
 */

async function generateSecureQRCode(
  tenantId: string,
  branchId: string,
  roomNumber: string
): Promise<string> {
  // 1️⃣ توليد Token عشوائي آمن
  const token = generateSecureRandomToken(32);
  
  // 2️⃣ حفظ الربط في Firestore
  await setDoc(doc(db, 'secureAccessTokens', token), {
    tenantId,
    branchId,
    roomNumber,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 يوم
    isActive: true,
    maxDevices: 3,
    usedDevices: []
  });
  
  // 3️⃣ توليد URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/guest?token=${token}`;
  
  // ⚠️ لاحظ: لا يوجد roomNumber أو branchId في الـ URL
  // كل المعلومات مشفرة في الـ Token
}
```

### 📊 مخطط العلاقات

```
┌─────────────────────────────────────────────────────────────┐
│                     Tenant (فندق/مستأجر)                     │
│                     tenantId: "tenant-abc123"                │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Branch: Cairo  │     │ Branch: Alex    │
│  branchId:      │     │ branchId:       │
│  "branch-cairo" │     │ "branch-alex"   │
└────────┬────────┘     └────────┬────────┘
         │                       │
    ┌────┴────┐             ┌────┴────┐
    ▼         ▼             ▼         ▼
┌───────┐ ┌───────┐     ┌───────┐ ┌───────┐
│Room101│ │Room102│     │Room101│ │Room102│
│cairo_ │ │cairo_ │     │alex_  │ │alex_  │
│ 101   │ │ 102   │     │ 101   │ │ 102   │
└───────┘ └───────┘     └───────┘ └───────┘

كل Query يجب أن يتضمن:
- where('tenantId', '==', currentTenantId)
- where('branchId', '==', currentBranchId)  // إذا كان الدور موظف
```

---

## 5. حدود الأمان والميزانية (Security & Quota Limits)

### ⚡ Rate Limiting - أين مبرمج بالظبط؟

```typescript
// src/services/anonymousAuthService.ts

/**
 * Rate Limiting System للنزلاء المجهولين
 * 
 * الموقع: guestRateLimits/{tenantId}_{guestUID}
 * 
 * الحدود الافتراضية:
 * - 10 طلبات في الساعة
 * - 50 طلب في اليوم
 * - 200 طلب في الأسبوع
 */

interface GuestRateLimit {
  tenantId: string;
  uid: string;
  requestCount: number;           // العداد الحالي
  lastRequestAt: Timestamp | null;
  hourlyCount: number;
  dailyCount: number;
  weeklyCount: number;
  lastHourReset: Timestamp;
  lastDayReset: Timestamp;
  lastWeekReset: Timestamp;
  blocked: boolean;               // هل محظور؟
  blockedUntil?: Timestamp;       // متى ينتهي الحظر؟
  blockedReason?: string;
}

// ✅ الدالة الرئيسية للتحقق
async function ensureGuestCanAct(
  tenantId: string,
  guestUID: string
): Promise<boolean> {
  const rateLimitRef = doc(db, 'guestRateLimits', `${tenantId}_${guestUID}`);
  const rateLimitSnap = await getDoc(rateLimitRef);
  
  if (!rateLimitSnap.exists()) {
    // أول طلب - أنشئ Record جديد
    await initializeRateLimit(rateLimitRef, tenantId, guestUID);
    return true;
  }
  
  const data = rateLimitSnap.data() as GuestRateLimit;
  
  // 1️⃣ هل محظور؟
  if (data.blocked) {
    if (data.blockedUntil && data.blockedUntil.toDate() > new Date()) {
      throw new Error('GUEST_BLOCKED');
    }
    // انتهى الحظر - أعد التفعيل
    await updateDoc(rateLimitRef, { blocked: false, blockedUntil: null });
  }
  
  // 2️⃣ Reset العدادات إذا انتهت الفترة
  const now = new Date();
  const updates: any = {};
  
  if (isHourPassed(data.lastHourReset)) {
    updates.hourlyCount = 0;
    updates.lastHourReset = Timestamp.now();
  }
  
  if (isDayPassed(data.lastDayReset)) {
    updates.dailyCount = 0;
    updates.lastDayReset = Timestamp.now();
  }
  
  // 3️⃣ التحقق من الحدود
  const hourlyCount = (updates.hourlyCount ?? data.hourlyCount) + 1;
  const dailyCount = (updates.dailyCount ?? data.dailyCount) + 1;
  
  const HOURLY_LIMIT = 10;
  const DAILY_LIMIT = 50;
  
  if (hourlyCount > HOURLY_LIMIT) {
    // 🚫 تجاوز الحد - حظر مؤقت
    await updateDoc(rateLimitRef, {
      blocked: true,
      blockedUntil: Timestamp.fromDate(new Date(now.getTime() + 60 * 60 * 1000)), // ساعة
      blockedReason: 'HOURLY_LIMIT_EXCEEDED'
    });
    
    // 🔔 تنبيه أمني للمدير
    await sendSecurityAlert(tenantId, {
      type: 'RATE_LIMIT_EXCEEDED',
      guestUID,
      message: `نزيل تجاوز الحد (${hourlyCount} طلب/ساعة)`
    });
    
    return false;
  }
  
  // ✅ سجل الطلب
  await updateDoc(rateLimitRef, {
    ...updates,
    hourlyCount,
    dailyCount,
    requestCount: (data.requestCount || 0) + 1,
    lastRequestAt: Timestamp.now()
  });
  
  return true;
}
```

### 🔄 سيناريو: عميل "رذل" يبعث طلبات كثيرة

```
┌─────────────────────────────────────────────────────────────┐
│                    Timeline                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   09:00  طلب #1  ✅ مقبول (hourlyCount: 1)                  │
│   09:02  طلب #2  ✅ مقبول (hourlyCount: 2)                  │
│   09:05  طلب #3  ✅ مقبول (hourlyCount: 3)                  │
│   ...                                                       │
│   09:30  طلب #10 ✅ مقبول (hourlyCount: 10) - آخر طلب       │
│   09:31  طلب #11 ❌ مرفوض + حظر ساعة                        │
│                     ↓                                       │
│                  ┌──────────────────────────────────────┐   │
│                  │ 🚨 Security Alert للمدير:            │   │
│                  │ "نزيل تجاوز الحد - 11 طلب/ساعة"     │   │
│                  │ Room: 101                            │   │
│                  │ Action: Blocked until 10:31          │   │
│                  └──────────────────────────────────────┘   │
│                                                             │
│   09:35  طلب #12 ❌ "أنت محظور حتى 10:31"                   │
│   10:31  انتهاء الحظر                                       │
│   10:32  طلب #13 ✅ مقبول (hourlyCount: 1 - reset)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 🛡️ Firebase App Check - كيف يحمي API Keys؟

```typescript
// src/services/firebase.ts

/**
 * App Check - طبقة حماية إضافية
 * 
 * المشكلة:
 * - أي شخص يمكنه رؤية API Key في الـ Source Code
 * - يمكنه استخدامها في تطبيق خبيث
 * - استنزاف الـ Quota
 * 
 * الحل:
 * - App Check يتحقق أن الطلب يأتي من التطبيق الأصلي
 * - يستخدم reCAPTCHA v3 في الخلفية
 * - كل طلب يحمل Token مشفر
 */

// تفعيل App Check
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

function initializeAppCheckProtection(recaptchaSiteKey: string) {
  if (!recaptchaSiteKey) {
    console.warn('⚠️ App Check not configured - API Keys unprotected');
    return;
  }
  
  // 🔐 تفعيل الحماية
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true
  });
  
  console.log('✅ App Check enabled - API Keys protected');
}
```

### 📊 مخطط الحماية الكامل

```
┌─────────────────────────────────────────────────────────────┐
│                  طلب من العميل (Client Request)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              🛡️ Layer 1: App Check                          │
│                                                             │
│   ❓ هل الطلب يحمل App Check Token صالح؟                    │
│      ├─ ✅ نعم → تابع                                       │
│      └─ ❌ لا  → رفض (403 Forbidden)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              🔐 Layer 2: Firebase Auth                       │
│                                                             │
│   ❓ هل المستخدم مصادق (حتى لو Anonymous)؟                  │
│      ├─ ✅ نعم → تابع                                       │
│      └─ ❌ لا  → رفض (401 Unauthorized)                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ⏱️ Layer 3: Rate Limiting                       │
│                                                             │
│   ❓ هل تجاوز الحد المسموح؟                                  │
│      ├─ ✅ لا  → تابع                                       │
│      └─ ❌ نعم → حظر مؤقت + تنبيه أمني                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              📜 Layer 4: Security Rules                      │
│                                                             │
│   ❓ هل يحق للمستخدم هذا الإجراء؟                            │
│      ├─ tenantId matches?                                   │
│      ├─ branchId matches? (if applicable)                   │
│      ├─ role has permission?                                │
│      ├─ data validation passed?                             │
│      └─ ❌ أي فشل → رفض (Permission Denied)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ✅ Firestore - العملية مقبولة                   │
└─────────────────────────────────────────────────────────────┘
```

---

# 🌟 أحدث الإضافات (V3.5)

### ✅ Dynamic Configuration (بدون كود!)
- **Zero-Code Firebase Setup**: ربط أي مشروع Firebase من واجهة المالك مباشرة
- **Test Connection**: اختبار الاتصال قبل الحفظ مع رسائل توضيحية
- **Dynamic API Keys**: إدارة VAPID, ImgBB, Firebase Keys من لوحة التحكم
- **Auto-Destruct Security**: تدمير ذاتي للمفاتيح الحساسة (Service Account) بعد الاستخدام

### ✅ Zero-Touch Deploy
- **Automated Scripts**: سكريبتات `deploy.sh` (Linux) و `deploy.bat` (Windows)
- **One-Click Build**: بناء ورفع المشروع بأمر واحد
- **Firebase Hosting**: رفع تلقائي على Firebase Hosting

### ✅ Support Tools
- **Master Access**: صفحة وصول شامل للمشرف العام (للدعم الفني)
- **Emergency Reset**: إعادة تعيين كلمات المرور في حالات الطوارئ
- **Tenant Monitoring**: مراقبة جميع الفنادق من لوحة واحدة

### ✅ Smart Features (الدوائر الذكية)
1. **One-Click Demo Mode** 🎭
   - تعبئة بيانات تجريبية بضغطة واحدة
   - عرض قدرات السيستم للمشترين المحتملين

2. **WhatsApp Message Previewer** 📱
   - معاينة الرسائل قبل الإرسال
   - استبدال تلقائي للمتغيرات ({guestName}, {roomNumber})

3. **Dynamic Branding** 🎨
   - تغيير اللوجو والألوان من واجهة المالك
   - ثيمات جاهزة (تركوازي، أزرق، بنفسجي، ذهبي)
   - معاينة فورية للتغييرات

4. **Critical Delay Alerts** ⏰
   - تنبيهات فورية للمهام المتأخرة
   - Push Notifications للمدير
   - عتبات قابلة للتخصيص لكل قسم

5. **Global Update Manager** 📢
   - بث التحديثات لجميع المستخدمين بضغطة واحدة
   - إشعارات لحظية للمديرين والموظفين
   - سجل كامل للتحديثات

---

## 🚀 المميزات الرئيسية

### ✅ SaaS Multi-Tenancy
- عزل بيانات كامل بين المستأجرين
- إدارة متعددة الفروع
- نظام اشتراكات ودفع متكامل
- لوحة تحكم للمالك (Owner Dashboard)
- **Isolated Firebase Projects**: كل عميل يمكنه استخدام مشروع Firebase خاص

### 🏨 الأقسام الرئيسية
- **الاستقبال (Reception)**: إدارة الطلبات والضيوف + Operations Quick-View
- **البيلمان (Bellman)**: إدارة نقل الأمتعة + نقل الغرف
- **النظافة (Housekeeping)**: إدارة التنظيف والفحص
- **الصيانة (Maintenance)**: إدارة طلبات الصيانة
- **المشتريات (Procurement)**: إدارة المشتريات والمخزون
- **الكوفي شوب (Coffee Shop)**: إدارة الطلبات عبر الاستقبال
- **لوحة الإدارة (Admin)**: إدارة شاملة للنظام + Live Pulse

### 🎮 نظام النقاط والمكافآت (Gamification)
- نقاط للموظفين عند إتمام المهام
- 20 رتبة (من "نجم صاعد" إلى "أسطورة أدورا")
- شارات وإنجازات
- كشف السرعة المشبوهة (Suspicious Speed Detection)
- تتبع النشاط اليومي (Commitment Points)
- تصدير قواعد النقاط كـ PDF

### 👤 نظام ولاء النزلاء (Guest Loyalty)
- Respect Score للنزلاء
- مستويات VIP (بلاتيني، ذهبي، فضي)
- ثيم ذهبي للنزلاء المميزين
- تقييم عكسي (العمال يقيمون النزلاء)

### 💬 Smart Chat System
- شات مباشر بين النزيل والاستقبال
- ChatInbox للاستقبال
- Live Chat Monitor للمدير
- رفع صور عبر ImgBB

### 🎨 التصميم
- **Glassmorphism Design**: تصميم زجاجي عصري
- **4K Support**: دعم كامل لشاشات 4K
- **Mobile-First**: تصميم متجاوب بالكامل
- **Dark Theme**: واجهة داكنة احترافية
- **Dynamic Theming**: ألوان قابلة للتخصيص

### 🔒 الأمان
- Rate Limiting على تسجيل الدخول
- Hash-based Owner PIN
- Firebase Security Rules محسّنة
- Validation شامل للبيانات
- **AES-256-GCM Encryption**: تشفير LocalStorage
- **Auto-Clear Service Accounts**: حذف تلقائي بعد 5 دقائق

### 📊 Analytics & Reports
- تحليلات شاملة للمستأجرين
- تقارير مالية متقدمة
- KPIs Dashboard
- Smart Alerts
- **Data Health Report**: تقرير صحة البيانات الأسبوعي
- **Live Pulse Dashboard**: مراقبة لحظية للعمليات

### 📱 Push Notifications
- تنبيهات FCM للموبايل
- Critical Delay Alerts
- Update Broadcasts
- Guest Request Notifications

---

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5 + PWA
- **Styling**: Tailwind CSS
- **Backend**: Firebase v10 (Firestore, Auth, Storage, Functions)
- **State Management**: React Context API + Custom Hooks
- **Routing**: React Router DOM v6+
- **Icons**: Lucide React
- **Charts**: Chart.js + Recharts
- **PDF**: jsPDF + jspdf-autotable
- **Image Upload**: ImgBB API + Firebase Storage

---

## 📦 التثبيت

```bash
# تثبيت المتطلبات
npm install

# تشغيل المشروع في وضع التطوير
npm run dev

# بناء المشروع للإنتاج
npm run build

# معاينة البناء
npm run preview
```

---

## 🚀 Deployment (النشر)

### Linux/macOS:
```bash
chmod +x deploy.sh
./deploy.sh
```

### Windows:
```batch
deploy.bat
```

### Manual:
```bash
npm run build
firebase deploy --only hosting
```

---

## 📁 هيكل المشروع

```
src/
├── components/           # المكونات المشتركة
│   ├── admin/            # مكونات الإدارة
│   ├── auth/             # مكونات المصادقة
│   ├── common/           # المكونات العامة
│   ├── guest/            # مكونات النزيل
│   ├── reception/        # مكونات الاستقبال
│   ├── shared/           # المكونات المشتركة
│   └── system/           # مكونات النظام
├── features/             # ميزات الأقسام
│   ├── admin/            # لوحة الإدارة
│   ├── auth/             # المصادقة
│   ├── bellman/          # البيلمان
│   ├── coffeeshop/       # الكوفي شوب
│   ├── guest/            # النزيل
│   ├── housekeeping/     # النظافة
│   ├── maintenance/      # الصيانة
│   ├── owner/            # المالك
│   ├── reception/        # الاستقبال
│   └── super-admin/      # السوبر أدمن
├── services/             # الخدمات
│   ├── firebase.ts               # Dynamic Firebase Init
│   ├── secureAccessService.ts    # Secure Token Management
│   ├── anonymousAuthService.ts   # Anonymous Auth + Rate Limiting
│   ├── locationService.ts        # Haversine Distance Calculation
│   ├── procurementService.ts     # Procurement Workflow
│   └── ...
├── hooks/                # Custom Hooks
├── context/              # React Context Providers
├── types/                # TypeScript Types
└── utils/                # Utilities
```

---

## 🔐 الإعداد الأولي (First-Time Setup)

### 1. Firebase Setup
عند تشغيل المشروع لأول مرة، سيظهر **Setup Wizard** لإدخال مفاتيح Firebase:
- API Key
- Project ID
- App ID
- Auth Domain (اختياري)
- Storage Bucket (اختياري)

### 2. Owner Dashboard
بعد الإعداد، ادخل كـ **Owner** باستخدام الكود المكون من 6 أرقام.

### 3. إضافة مدير جديد
1. اضغط "إضافة مدير جديد"
2. استخدم زر **🎭 Demo Mode** لتعبئة بيانات تجريبية (اختياري)
3. أدخل بيانات Firebase الخاصة بالعميل (اختياري - للعزل الكامل)
4. اضغط "حفظ"

---

## 📚 الوثائق الإضافية

### للمطورين الجدد:
- **`PROJECT_SUMMARY.md`** - ملخص الوضع الحالي والمهام المكتملة
- **`WORKFLOW_GUIDE.md`** - دليل طريقة العمل والـ Best Practices
- **`PROJECT_CONTEXT.md`** - سياق المشروع والميزات المكتملة

### التقارير:
- **`FINAL_REVIEW_REPORT.md`** - تقرير المراجعة النهائية الشامل
- **`AUDIT_REPORT.md`** - تقرير مراجعة البنية الأساسية

---

## 📝 ملاحظات التطوير

### TypeScript Strict Mode
المشروع يستخدم TypeScript مع إعدادات مرنة للسماح بالبناء السريع.

### ESLint + Prettier
تم إعداد ESLint و Prettier لضمان تنسيق موحد للكود.

### Logger Service
استخدم `logger` من `src/services/loggerService.ts` بدلاً من `console.log`.

### SaaS Multi-Tenancy
جميع الاستعلامات يجب أن تتضمن `tenantId` filter لضمان عزل البيانات.

### Firebase Optimization
- Smart Caching (24 ساعة للإعدادات)
- Batch Writes
- Smart Listeners مع Debouncing
- Image Compression (max 300KB, WebP)

---

## 📄 الترخيص

© 2024-2026 Adora Hotel Management System. All rights reserved.

---

## 🙏 شكر وتقدير

Crafted with ❤️ by **Ayman Abu Warda**

📞 +966 570 707 121
