# 🗄️ هيكل قاعدة البيانات - Firestore Schema

> **مهم جداً:** هذا الملف يوثق هيكل البيانات في Firestore. اقرأه قبل أي تعديل!

---

## 📊 نظرة عامة على الهيكل

```
firestore/
├── 🏢 tenants/                    # المستأجرين (الفنادق)
│   └── {tenantId}/
│       ├── 📋 info                # معلومات المستأجر
│       ├── 🏨 branches/           # الفروع
│       │   └── {branchId}/
│       ├── 🚪 rooms/              # الغرف
│       │   └── {branchId}_{roomNumber}
│       ├── 📝 requests/           # الطلبات
│       │   └── {requestId}
│       ├── 👥 employees/          # الموظفين
│       │   └── {employeeId}
│       └── 💬 chatRooms/          # غرف الدردشة
│           └── {chatRoomId}
│
├── 🔑 globalCodes/                # أكواد الدخول العالمية
│   └── {code}
│
├── 👤 userBindings/               # ربط المستخدمين
│   └── {uid}
│
├── 🛡️ superAdmins/                # المالكين
│   └── {uid}
│
└── ⚙️ systemConfigs/              # إعدادات النظام
    └── {configKey}
```

---

## 📋 تفاصيل كل Collection

### 1️⃣ tenants (المستأجرين)

```typescript
// المسار: tenants/{tenantId}
interface Tenant {
  id: string;                    // معرف فريد
  info: {
    name: string;                // اسم الفندق
    ownerId: string;             // معرف المالك
    ownerName: string;           // اسم المالك
    plan: 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'suspended' | 'expired';
    createdAt: Timestamp;
    createdBy: string;
    logoUrl?: string;            // شعار الفندق
    primaryColor?: string;       // اللون الأساسي
  };
  settings?: {
    language: 'ar' | 'en';
    timezone: string;
    currency: string;
  };
  subscription?: {
    planId: string;
    startDate: Timestamp;
    endDate: Timestamp;
    autoRenew: boolean;
  };
}
```

**مثال:**
```json
{
  "id": "tenant_abc123",
  "info": {
    "name": "فندق أدورا",
    "ownerId": "owner_xyz",
    "ownerName": "أحمد محمد",
    "plan": "pro",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 2️⃣ branches (الفروع)

```typescript
// المسار: tenants/{tenantId}/branches/{branchId}
interface Branch {
  id: string;
  tenantId: string;
  code: string;                  // كود الفرع (1-4 أرقام)
  name: string;                  // اسم الفرع
  address?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'scheduled_for_deletion';
  location?: {
    latitude: number;
    longitude: number;
    radius: number;              // نطاق الموقع بالمتر
  };
  createdAt: Timestamp;
  settings?: {
    allowGuestRequests: boolean;
    requireLocationVerification: boolean;
    maxRoomsPerFloor: number;
  };
}
```

**مثال:**
```json
{
  "id": "branch_001",
  "tenantId": "tenant_abc123",
  "code": "01",
  "name": "الفرع الرئيسي",
  "status": "active",
  "location": {
    "latitude": 24.7136,
    "longitude": 46.6753,
    "radius": 100
  }
}
```

---

### 3️⃣ rooms (الغرف)

```typescript
// المسار: tenants/{tenantId}/rooms/{branchId}_{roomNumber}
// ⚠️ معرف الغرفة = branchId + "_" + roomNumber

interface Room {
  id: string;                    // branchId_roomNumber
  number: string;                // رقم الغرفة
  floor: number;                 // الطابق
  type: 'single' | 'double' | 'suite' | 'presidential';
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'blocked';
  currentGuestId: string | null;
  branchId: string;
  tenantId: string;
  amenities?: string[];          // المرافق
  notes?: string;
  lastCleaned?: Timestamp;
  lastMaintenance?: Timestamp;
}
```

**⚠️ قاعدة مهمة:**
```typescript
// ✅ صحيح: معرف الغرفة يجمع الفرع + الرقم
const roomId = `${branchId}_${roomNumber}`; // "branch_001_101"

// ❌ خطأ: استخدام رقم الغرفة فقط
const roomId = roomNumber; // "101" - قد يتكرر بين الفروع!
```

---

### 4️⃣ requests (الطلبات)

```typescript
// المسار: tenants/{tenantId}/requests/{requestId}
// أو: requests/{requestId} (في بعض الحالات القديمة)

interface Request {
  id: string;
  type: 'cleaning' | 'maintenance' | 'bellman' | 'amenities' | 
        'coffee' | 'minibar' | 'inspection' | 'procurement' | 'vip_service';
  status: 'PENDING_RECEPTION' | 'CONFIRMED' | 'IN_PROGRESS' | 
          'COMPLETED' | 'CANCELLED' | 'PENDING_HOUSEKEEPING' | 
          'PENDING_MAINTENANCE' | 'WAITING_PARTS';
  priority: 'low' | 'normal' | 'high' | 'urgent' | 'emergency';
  source: 'guest' | 'reception' | 'housekeeping' | 'maintenance' | 'auto';
  
  // معلومات الغرفة
  roomNumber: string;
  guestName: string;
  branch: string;                // branchId
  tenantId: string;
  
  // التوقيتات
  createdAt: Timestamp;
  createdBy: { id: string; name: string; department: string };
  confirmedAt?: Timestamp;
  confirmedBy?: { id: string; name: string };
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  completedBy?: { id: string; name: string };
  
  // التفاصيل
  details?: {
    items?: Array<{ name: string; quantity: number }>;
    description?: string;
  };
  notes?: string;
  photos?: string[];
  
  // التتبع
  currentDepartment?: string;
  departmentHistory?: Array<{
    department: string;
    status: string;
    enteredAt: Timestamp;
    exitedAt?: Timestamp;
    handledBy: { id: string; name: string };
  }>;
  
  // التقييم
  rating?: number;
  feedback?: string;
}
```

**مخطط حالات الطلب:**
```
                    ┌─────────────────┐
                    │ PENDING_RECEPTION│
                    └────────┬────────┘
                             │ تأكيد
                    ┌────────▼────────┐
                    │    CONFIRMED    │
                    └────────┬────────┘
                             │ بدء العمل
                    ┌────────▼────────┐
            ┌───────┤   IN_PROGRESS   ├───────┐
            │       └────────┬────────┘       │
            │ انتظار قطع     │ إكمال         │ إلغاء
    ┌───────▼───────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │ WAITING_PARTS │ │  COMPLETED  │ │  CANCELLED  │
    └───────────────┘ └─────────────┘ └─────────────┘
```

---

### 5️⃣ employees (الموظفين)

```typescript
// المسار: tenants/{tenantId}/employees/{employeeId}

interface Employee {
  id: string;
  name: string;
  code: string;                  // كود الدخول (4 أرقام)
  department: 'reception' | 'housekeeping' | 'bellman' | 
              'maintenance' | 'procurement' | 'admin';
  role: 'employee' | 'manager' | 'owner';
  status: 'active' | 'inactive' | 'suspended';
  branches: string[];            // الفروع المسموح بها
  tenantId: string;
  
  // الإحصائيات
  points?: number;
  tasksCompleted?: number;
  averageRating?: number;
  
  // المعلومات
  phone?: string;
  email?: string;
  photoUrl?: string;
  
  // التوقيتات
  createdAt: Timestamp;
  createdBy: string;
  lastLogin?: Timestamp;
}
```

---

### 6️⃣ globalCodes (أكواد الدخول العالمية)

```typescript
// المسار: globalCodes/{code}
// ⚠️ الكود نفسه هو معرف الوثيقة!

interface GlobalCode {
  code: string;                  // نفس الـ document ID
  tenantId: string;
  employeeId: string;
  role: 'employee' | 'manager' | 'owner';
  department?: string;
  createdAt: Timestamp;
}
```

**كيف يعمل تسجيل الدخول:**
```
1. المستخدم يدخل: "01" + "1234"
2. النظام يبحث في globalCodes عن "011234"
3. إذا وجده ← يحصل على tenantId + employeeId
4. يحمّل بيانات الموظف من tenants/{tenantId}/employees/{employeeId}
```

---

### 7️⃣ roomCards (بطاقات الغرف - للنزلاء)

```typescript
// المسار: tenants/{tenantId}/roomCards/{cardId}

interface RoomCard {
  id: string;
  roomNumber: string;
  branchId: string;
  tenantId: string;
  
  // معلومات النزيل
  guestName: string;
  guestPhone?: string;
  guestIdLast4?: string;         // آخر 4 أرقام من الهوية
  
  // الحالة
  status: 'active' | 'checked_out' | 'expired';
  qrActive: boolean;             // هل QR مفعل؟
  
  // التوقيتات
  checkInAt: Timestamp;
  checkOutAt?: Timestamp;
  expectedCheckOut: Timestamp;
  
  // الجهاز
  deviceFingerprint?: string;
  lastAccessAt?: Timestamp;
}
```

**⚠️ قاعدة أمان مهمة:**
```typescript
// قبل السماح بأي طلب من النزيل:
if (!roomCard.qrActive || roomCard.status !== 'active') {
  throw new Error('ROOM_NOT_AVAILABLE');
}
```

---

## 🔒 قواعد Firestore Security

```javascript
// firestore.rules

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ⚠️ القاعدة الذهبية: كل tenant يرى بياناته فقط
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null 
        && request.auth.token.tenantId == tenantId;
    }
    
    // الأكواد العالمية - قراءة فقط للتحقق
    match /globalCodes/{code} {
      allow read: if true;  // للتحقق من الدخول
      allow write: if false; // فقط من Cloud Functions
    }
    
  }
}
```

---

## 📊 Indexes المطلوبة

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "branch", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "rooms",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "branchId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "employees",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "department", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 🔄 علاقات البيانات

```
┌─────────────┐
│   Tenant    │
└──────┬──────┘
       │ 1:N
       ├──────────────┬──────────────┬──────────────┐
       │              │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│   Branch    │ │  Employee │ │   Room    │ │  Request  │
└──────┬──────┘ └───────────┘ └─────┬─────┘ └───────────┘
       │                            │
       │ 1:N                        │ 1:1
       │                      ┌─────▼─────┐
┌──────▼──────┐               │ RoomCard  │
│    Room     │               └───────────┘
└─────────────┘
```

---

## ⚠️ أخطاء شائعة

### 1. نسيان tenantId
```typescript
// ❌ خطأ
query(collection(db, 'rooms'));

// ✅ صحيح
query(collection(db, `tenants/${tenantId}/rooms`));
```

### 2. معرف غرفة خاطئ
```typescript
// ❌ خطأ
const roomRef = doc(db, `tenants/${tenantId}/rooms`, roomNumber);

// ✅ صحيح
const roomId = `${branchId}_${roomNumber}`;
const roomRef = doc(db, `tenants/${tenantId}/rooms`, roomId);
```

### 3. عدم التحقق من null
```typescript
// ❌ خطأ
const tenant = await getTenantById(tenantId);
console.log(tenant.info.name); // قد يكون null!

// ✅ صحيح
const tenant = await getTenantById(tenantId);
if (!tenant) throw new Error('Tenant not found');
console.log(tenant.info.name);
```

---

> **تذكر:** البيانات في Firestore NoSQL، يعني:
> - لا Joins تلقائية
> - Denormalization مقبول
> - كل query يحتاج Index

