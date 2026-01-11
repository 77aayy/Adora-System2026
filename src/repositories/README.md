# Repository Pattern - دليل الاستخدام

## 🏗️ البنية المعمارية

```
src/repositories/
├── interfaces/                 # العقود (Contracts)
│   ├── IAuthRepository.ts      # واجهة المصادقة
│   ├── IRoomRepository.ts      # واجهة الغرف
│   ├── IRequestRepository.ts   # واجهة الطلبات
│   ├── IUserRepository.ts      # واجهة المستخدمين
│   ├── ITenantRepository.ts    # واجهة المنشآت
│   └── index.ts                # تصدير الواجهات
├── firebase/                   # تنفيذ Firebase
│   ├── FirebaseAuthRepository.ts
│   ├── FirebaseRoomRepository.ts
│   ├── FirebaseRequestRepository.ts
│   ├── FirebaseUserRepository.ts
│   ├── FirebaseTenantRepository.ts
│   └── index.ts
├── RepositoryProvider.tsx      # React Context Provider
├── index.ts                    # الملف الرئيسي للتصدير
└── README.md                   # هذا الملف
```

## 🎯 لماذا Repository Pattern؟

### 1. **العزل التام**
```
UI Components → Repository Interfaces → Firebase/Backend
```
الـ UI لا يعرف شيء عن Firebase. يتحدث فقط مع الـ Repository.

### 2. **تبديل Backend بسهولة**
```typescript
// اليوم: Firebase
export { FirebaseAuthRepository as AuthRepository } from './firebase';

// غداً: Supabase
export { SupabaseAuthRepository as AuthRepository } from './supabase';
```

### 3. **اختبارات سهلة**
```typescript
// في الاختبارات
const mockAuthRepo: IAuthRepository = {
  loginWithGlobalCode: jest.fn().mockResolvedValue({ success: true }),
  // ...
};

<RepositoryProvider customAuthRepository={mockAuthRepo}>
  <ComponentUnderTest />
</RepositoryProvider>
```

## 🚀 كيفية الاستخدام

### الطريقة 1: استخدام Hooks (موصى به للـ Components)

```tsx
import { useRoomRepository, useRequestRepository } from '@/repositories';

const RoomList: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const roomRepo = useRoomRepository();

  useEffect(() => {
    const unsubscribe = roomRepo.subscribeToRooms(
      branchId,
      (updatedRooms) => setRooms(updatedRooms),
      tenantId
    );
    return () => unsubscribe();
  }, [branchId, tenantId]);

  return (
    <div>
      {rooms.map(room => <RoomCard key={room.id} room={room} />)}
    </div>
  );
};
```

### الطريقة 2: استخدام Singleton (للـ Services)

```typescript
import { repositories } from '@/repositories';

// في service آخر
async function handleRoomUpdate(roomId: string) {
  await repositories.room.updateRoomStatus(tenantId, branchId, roomId, 'cleaning');
}
```

### الطريقة 3: استخدام كل الـ Repositories معاً

```tsx
import { useRepositories } from '@/repositories';

const AdminPanel: React.FC = () => {
  const { authRepository, roomRepository, userRepository } = useRepositories();
  
  // استخدم كل الـ repositories
};
```

## 📋 ملخص الـ Repositories

### IAuthRepository - المصادقة
```typescript
loginWithGlobalCode(code: string): Promise<LoginResult>
loadSession(): Promise<LoginResult>
logout(): void
```

### IRoomRepository - الغرف
```typescript
subscribeToRooms(branchId, callback, tenantId?): Unsubscribe
addRoom(room): Promise<void>
updateRoom(tenantId, branchId, roomNumber, updates): Promise<void>
deleteRoom(tenantId, branchId, roomNumber): Promise<void>
createRoomBatch(floor, startNumber, endNumber, type, branchId, tenantId): Promise<number>
getRoomStats(branchId, tenantId): Promise<Stats>
updateRoomStatus(tenantId, branchId, roomNumber, status): Promise<void>
transferGuest(...): Promise<void>
```

### IRequestRepository - الطلبات
```typescript
createRequest(input, branch, userId, userName): Promise<string>
getRequest(requestId): Promise<Request | null>
subscribeToRequests(branch, callback, status?, tenantId?): Unsubscribe
confirmRequest(requestId, userId, userName): Promise<void>
startRequest(requestId, userId, userName): Promise<void>
completeRequest(requestId, userId, userName, rating?, feedback?): Promise<void>
cancelRequest(requestId, userId, userName, reason): Promise<void>
// ... والمزيد
```

### IUserRepository - المستخدمين
```typescript
loadAvailableBranches(user): Promise<BranchOption[]>
isPinAvailable(pin, ctx?): Promise<boolean>
suggestUniquePin(): Promise<string>
createEmployee(data): Promise<string>
getUserById(userId): Promise<User | null>
getDepartmentPath(department, role?): string
// ... والمزيد
```

### ITenantRepository - المنشآت
```typescript
createTenant(data): Promise<string>
getTenantById(tenantId): Promise<Tenant | null>
updateTenant(tenantId, updates): Promise<void>
createBranch(tenantId, data): Promise<string>
getBranchesByTenant(tenantId): Promise<Branch[]>
createGlobalCode(...): Promise<void>
// ... والمزيد
```

## 🔄 خطة الترحيل التدريجي

### المرحلة 1: الـ Components الجديدة
كل component جديد يستخدم repositories من البداية.

### المرحلة 2: الـ Components الموجودة
ترحيل تدريجي:
```typescript
// قبل
import { subscribeToRooms } from '@/services/roomService';

// بعد
import { useRoomRepository } from '@/repositories';
const roomRepo = useRoomRepository();
```

### المرحلة 3: حذف الـ Services القديمة
بعد ترحيل كل الـ components، يمكن حذف الـ services القديمة.

## ⚠️ ملاحظات مهمة

1. **Real-time Updates**: الـ `onSnapshot` يعمل بشكل طبيعي عبر `subscribeToRooms/subscribeToRequests`.

2. **Offline Support**: الـ Firebase offline persistence يعمل تلقائياً.

3. **Tenant Isolation**: كل العمليات تتطلب `tenantId` لضمان فصل البيانات.

4. **لا تستخدم Firebase مباشرة**: استخدم repositories دائماً.

## 📚 مثال كامل

```tsx
// RoomManagement.tsx
import React, { useState, useEffect } from 'react';
import { useRoomRepository, useRequestRepository } from '@/repositories';
import { Room, RoomStatus } from '@/types';

interface Props {
  tenantId: string;
  branchId: string;
}

export const RoomManagement: React.FC<Props> = ({ tenantId, branchId }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  
  const roomRepo = useRoomRepository();
  const requestRepo = useRequestRepository();

  // Subscribe to real-time room updates
  useEffect(() => {
    const unsubscribe = roomRepo.subscribeToRooms(
      branchId,
      (updatedRooms) => {
        setRooms(updatedRooms);
        setLoading(false);
      },
      tenantId
    );
    
    return () => unsubscribe();
  }, [branchId, tenantId]);

  // Change room status
  const handleStatusChange = async (roomNumber: string, newStatus: RoomStatus) => {
    try {
      await roomRepo.updateRoomStatus(tenantId, branchId, roomNumber, newStatus);
      
      // Create cleaning request if needed
      if (newStatus === 'cleaning') {
        await requestRepo.createRequest(
          { type: 'cleaning', roomNumber, priority: 'normal', tenantId },
          branchId,
          'system',
          'System'
        );
      }
    } catch (error) {
      console.error('Failed to update room:', error);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="grid gap-4">
      {rooms.map(room => (
        <RoomCard
          key={room.id}
          room={room}
          onStatusChange={(status) => handleStatusChange(room.number, status)}
        />
      ))}
    </div>
  );
};
```

---

**تم إنشاء هذا الملف كجزء من إعادة الهيكلة المعمارية لنظام أدورا**
