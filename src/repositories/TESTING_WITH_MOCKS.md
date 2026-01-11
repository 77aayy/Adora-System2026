# 🧪 كيفية اختبار التطبيق باستخدام Mock Repositories

## المقدمة

هذا الدليل يشرح كيفية إنشاء نسخ "وهمية" (Mock) من الـ Repositories لاختبار التطبيق بدون الحاجة لـ Firebase حقيقي.

---

## لماذا نحتاج Mock Repositories؟

1. **اختبار بدون إنترنت**: تشغيل التطبيق محلياً
2. **اختبار سيناريوهات محددة**: محاكاة أخطاء أو بيانات معينة
3. **تسريع التطوير**: لا انتظار لاستجابة الخادم
4. **Unit Testing**: اختبار منطق الأعمال معزولاً

---

## مثال: Mock Room Repository

```typescript
// src/repositories/mock/MockRoomRepository.ts

import { IRoomRepository } from '../interfaces/IRoomRepository';
import { Room, RoomStatus, RoomType } from '../../types';

// بيانات وهمية للاختبار
const mockRooms: Room[] = [
  {
    id: 'room-101',
    number: '101',
    floor: 1,
    type: 'single',
    status: 'available',
    currentGuestId: null,
    branchId: 'branch-1',
    tenantId: 'tenant-1'
  },
  {
    id: 'room-102',
    number: '102',
    floor: 1,
    type: 'double',
    status: 'occupied',
    currentGuestId: 'guest-1',
    branchId: 'branch-1',
    tenantId: 'tenant-1'
  },
  {
    id: 'room-201',
    number: '201',
    floor: 2,
    type: 'suite',
    status: 'cleaning',
    currentGuestId: null,
    branchId: 'branch-1',
    tenantId: 'tenant-1'
  }
];

export class MockRoomRepository implements IRoomRepository {
  private rooms: Room[] = [...mockRooms];
  private listeners: Map<string, (rooms: Room[]) => void> = new Map();

  subscribeToRooms(branchId: string, callback: (rooms: Room[]) => void, tenantId?: string) {
    const listenerId = `${branchId}-${Date.now()}`;
    this.listeners.set(listenerId, callback);
    
    // إرسال البيانات فوراً
    const filteredRooms = this.rooms.filter(r => r.branchId === branchId);
    callback(filteredRooms);
    
    // إرجاع دالة إلغاء الاشتراك
    return () => {
      this.listeners.delete(listenerId);
    };
  }

  async addRoom(room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void> {
    const newRoom: Room = {
      ...room,
      id: `room-${Date.now()}`,
      currentGuestId: null
    };
    this.rooms.push(newRoom);
    this.notifyListeners(room.branchId);
  }

  async updateRoom(tenantId: string, branchId: string, roomNumber: string, updates: Partial<Room>): Promise<void> {
    const index = this.rooms.findIndex(r => r.number === roomNumber && r.branchId === branchId);
    if (index !== -1) {
      this.rooms[index] = { ...this.rooms[index], ...updates };
      this.notifyListeners(branchId);
    }
  }

  async deleteRoom(tenantId: string, branchId: string, roomNumber: string): Promise<void> {
    this.rooms = this.rooms.filter(r => !(r.number === roomNumber && r.branchId === branchId));
    this.notifyListeners(branchId);
  }

  async createRoomBatch(floor: number, startNumber: number, endNumber: number, type: RoomType, branchId: string, tenantId: string): Promise<number> {
    let count = 0;
    for (let num = startNumber; num <= endNumber; num++) {
      await this.addRoom({
        number: num.toString(),
        floor,
        type,
        status: 'available',
        branchId,
        tenantId
      });
      count++;
    }
    return count;
  }

  async getRoomStats(branchId: string, tenantId: string) {
    const branchRooms = this.rooms.filter(r => r.branchId === branchId);
    return {
      total: branchRooms.length,
      available: branchRooms.filter(r => r.status === 'available').length,
      occupied: branchRooms.filter(r => r.status === 'occupied').length,
      cleaning: branchRooms.filter(r => r.status === 'cleaning').length,
      maintenance: branchRooms.filter(r => r.status === 'maintenance').length
    };
  }

  async getRoomStatsByType(branchId: string, tenantId: string) {
    const branchRooms = this.rooms.filter(r => r.branchId === branchId);
    const stats: Record<string, { total: number; occupied: number }> = {};
    
    branchRooms.forEach(room => {
      if (!stats[room.type]) {
        stats[room.type] = { total: 0, occupied: 0 };
      }
      stats[room.type].total++;
      if (room.status === 'occupied') {
        stats[room.type].occupied++;
      }
    });
    
    return stats;
  }

  async updateRoomStatus(tenantId: string, branchId: string, roomNumber: string, status: RoomStatus): Promise<void> {
    await this.updateRoom(tenantId, branchId, roomNumber, { status });
  }

  async getRoomStatus(tenantId: string, branchId: string, roomNumber: string): Promise<RoomStatus | null> {
    const room = this.rooms.find(r => r.number === roomNumber && r.branchId === branchId);
    return room?.status || null;
  }

  async migrateLegacyRoom(legacyDocId: string, roomData: Room, branchId: string, tenantId: string): Promise<void> {
    // Mock implementation - just add the room
    this.rooms.push({ ...roomData, branchId, tenantId });
    this.notifyListeners(branchId);
  }

  async transferGuest(tenantId: string, branchId: string, oldRoomNumber: string, newRoomNumber: string, guestId: string, guestName: string): Promise<void> {
    // تحديث الغرفة القديمة
    await this.updateRoom(tenantId, branchId, oldRoomNumber, { status: 'cleaning', currentGuestId: null });
    // تحديث الغرفة الجديدة
    await this.updateRoom(tenantId, branchId, newRoomNumber, { status: 'occupied', currentGuestId: guestId });
  }

  // دالة مساعدة لإشعار المستمعين
  private notifyListeners(branchId: string) {
    const filteredRooms = this.rooms.filter(r => r.branchId === branchId);
    this.listeners.forEach((callback, key) => {
      if (key.startsWith(branchId)) {
        callback(filteredRooms);
      }
    });
  }

  // دوال إضافية للاختبار
  reset() {
    this.rooms = [...mockRooms];
    this.listeners.clear();
  }

  setRooms(rooms: Room[]) {
    this.rooms = rooms;
  }

  getRooms() {
    return this.rooms;
  }
}
```

---

## كيفية استخدام Mock Repository

### الطريقة 1: في RepositoryProvider

```typescript
// src/App.tsx أو src/main.tsx

import { RepositoryProvider } from './repositories/RepositoryProvider';
import { MockRoomRepository } from './repositories/mock/MockRoomRepository';

const isDevelopment = import.meta.env.DEV;
const useMocks = isDevelopment && !import.meta.env.VITE_FIREBASE_API_KEY;

const App = () => {
  return (
    <RepositoryProvider
      roomRepo={useMocks ? new MockRoomRepository() : undefined}
    >
      <Router>
        {/* ... */}
      </Router>
    </RepositoryProvider>
  );
};
```

### الطريقة 2: في Unit Tests

```typescript
// tests/RoomList.test.tsx

import { render, screen } from '@testing-library/react';
import { RepositoryProvider } from '../repositories/RepositoryProvider';
import { MockRoomRepository } from '../repositories/mock/MockRoomRepository';
import { RoomList } from '../features/reception/RoomList';

describe('RoomList', () => {
  it('should display rooms', async () => {
    const mockRepo = new MockRoomRepository();
    
    render(
      <RepositoryProvider roomRepo={mockRepo}>
        <RoomList branchId="branch-1" />
      </RepositoryProvider>
    );

    // الانتظار حتى تظهر الغرف
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(await screen.findByText('102')).toBeInTheDocument();
  });

  it('should update room status', async () => {
    const mockRepo = new MockRoomRepository();
    
    render(
      <RepositoryProvider roomRepo={mockRepo}>
        <RoomList branchId="branch-1" />
      </RepositoryProvider>
    );

    // تحديث حالة الغرفة
    await mockRepo.updateRoomStatus('tenant-1', 'branch-1', '101', 'occupied');
    
    // التحقق من التحديث
    const room = mockRepo.getRooms().find(r => r.number === '101');
    expect(room?.status).toBe('occupied');
  });
});
```

---

## مثال: Mock Auth Repository

```typescript
// src/repositories/mock/MockAuthRepository.ts

import { IAuthRepository } from '../interfaces/IAuthRepository';
import { LoginResult } from '../../types/auth';
import { Employee } from '../../types/tenant';

const mockEmployees: Record<string, { employee: Employee; tenantId: string }> = {
  '765255': {
    employee: {
      id: 'owner-1',
      name: 'مالك النظام',
      code: '765255',
      department: 'admin',
      role: 'owner',
      status: 'active',
      branches: ['branch-1'],
      tenantId: 'tenant-1'
    },
    tenantId: 'tenant-1'
  },
  '1234': {
    employee: {
      id: 'emp-1',
      name: 'أحمد محمد',
      code: '1234',
      department: 'reception',
      role: 'employee',
      status: 'active',
      branches: ['branch-1'],
      tenantId: 'tenant-1'
    },
    tenantId: 'tenant-1'
  }
};

export class MockAuthRepository implements IAuthRepository {
  private currentSession: { employeeId: string; tenantId: string } | null = null;

  async loginWithGlobalCode(code: string): Promise<LoginResult> {
    // محاكاة تأخير الشبكة
    await new Promise(resolve => setTimeout(resolve, 500));

    const data = mockEmployees[code];
    
    if (!data) {
      return {
        success: false,
        error: 'رمز الدخول غير صحيح'
      };
    }

    if (data.employee.status !== 'active') {
      return {
        success: false,
        error: 'الحساب موقوف'
      };
    }

    this.currentSession = {
      employeeId: data.employee.id,
      tenantId: data.tenantId
    };

    return {
      success: true,
      employee: data.employee,
      tenantId: data.tenantId
    };
  }

  async loadSession(): Promise<LoginResult> {
    if (!this.currentSession) {
      return { success: false, error: 'No session' };
    }

    const entry = Object.values(mockEmployees).find(
      e => e.employee.id === this.currentSession?.employeeId
    );

    if (!entry) {
      return { success: false, error: 'Employee not found' };
    }

    return {
      success: true,
      employee: entry.employee,
      tenantId: entry.tenantId
    };
  }

  logout(): void {
    this.currentSession = null;
  }

  // دوال إضافية للاختبار
  addMockEmployee(code: string, employee: Employee, tenantId: string) {
    mockEmployees[code] = { employee, tenantId };
  }

  getCurrentSession() {
    return this.currentSession;
  }
}
```

---

## سيناريوهات اختبار متقدمة

### اختبار حالة الخطأ

```typescript
class MockErrorRoomRepository implements IRoomRepository {
  async addRoom(room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void> {
    throw new Error('فشل الاتصال بالخادم');
  }
  // ...
}
```

### اختبار التأخير (Latency)

```typescript
class MockSlowRoomRepository implements IRoomRepository {
  async addRoom(room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 3000)); // 3 ثواني
    // ...
  }
}
```

### اختبار Tenant Isolation

```typescript
class MockIsolatedRoomRepository implements IRoomRepository {
  subscribeToRooms(branchId: string, callback: (rooms: Room[]) => void, tenantId?: string) {
    if (!tenantId) {
      throw new Error('tenantId is required');
    }
    // فقط إرجاع غرف هذا المستأجر
    const rooms = mockRooms.filter(r => r.tenantId === tenantId);
    callback(rooms);
    return () => {};
  }
}
```

---

## الخلاصة

Repository Pattern يجعل الاختبار سهلاً جداً:

1. ✅ **عزل الـ UI عن الـ Backend**
2. ✅ **سهولة إنشاء Mock implementations**
3. ✅ **اختبار سيناريوهات مختلفة بسهولة**
4. ✅ **تشغيل التطبيق بدون Firebase**

> **"لو قدرت تشغل التطبيق بـ Mock Repository في 5 دقائق، يبقى الـ Architecture صحيح!"**

