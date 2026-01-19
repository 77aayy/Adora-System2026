# 🎯 CURSOR COMPOSER - خطة بناء ADORA خطوة بخطوة

## 📋 ملاحظات مهمة قبل البدء

1. **اقرأ هذا الملف بالكامل أولاً** قبل البدء
2. **اتبع الترتيب بدقة** - لا تقفز لمرحلة قبل إكمال السابقة
3. **راجع كل ملف** بعد كتابته مقابل الوثيقة التقنية
4. **اختبر كل مرحلة** قبل الانتقال للتالية

---

## 🏗️ المرحلة 1: FOUNDATION (الأساسيات)

### ⏱️ الوقت المتوقع: 3-5 أيام

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 1.1: Tenant Isolation Strategy
- Section 1.2: Database Protection Layer
- Section 1.3: Global State Management
- Section 9.1: Environment Variables

### 📝 الملفات المطلوبة:

#### 1. `src/services/firebase.ts`
**المرجع:** Section 1.2 + Section 9.1

**التعليمات:**
```
بناءً على Section 1.2 (Database Protection Layer) و Section 9.1 (Environment Variables):

1. أنشئ ملف firebase.ts مع:
   - Dynamic Firebase initialization
   - isFirestoreReady flag
   - getSafeFirestore() function
   - Null safety checks

2. استخدم environment variables من .env:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID

3. تطبيق Database Protection Layer:
   - isFirestoreReady: boolean flag
   - getSafeFirestore(): returns db only if ready
   - Error handling for initialization failures

4. اتبع النمط الموجود في Section 1.2 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] `isFirestoreReady` flag موجود
- [ ] `getSafeFirestore()` function موجودة
- [ ] Null checks قبل كل database operation
- [ ] Environment variables محملة من .env
- [ ] Error handling موجود

---

#### 2. `src/context/AuthContext.tsx`
**المرجع:** Section 1.3 (Global State Management)

**التعليمات:**
```
بناءً على Section 1.3 (Global State Management):

1. أنشئ AuthContext مع:
   - User state management
   - Login/logout functions
   - Custom Claims validation
   - Tenant ID extraction from token

2. State يجب أن يحتوي على:
   - user: User | null
   - loading: boolean
   - error: string | null

3. Functions مطلوبة:
   - login(email, password): Promise<void>
   - logout(): Promise<void>
   - refreshUser(): Promise<void>
   - validateTenantAccess(tenantId): boolean

4. اتبع النمط الموجود في Section 1.3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] User state management موجود
- [ ] Login/logout functions موجودة
- [ ] Custom Claims validation موجود
- [ ] Tenant ID extraction من token موجود
- [ ] Error handling موجود

---

#### 3. `src/context/TenantContext.tsx`
**المرجع:** Section 1.3 (Global State Management)

**التعليمات:**
```
بناءً على Section 1.3 (Global State Management):

1. أنشئ TenantContext مع:
   - Tenant ID state
   - Branch ID state
   - Organization name state
   - Branch switching logic

2. State يجب أن يحتوي على:
   - tenantId: string | null
   - branchId: string | null
   - orgName: string | null
   - branches: Branch[]

3. Functions مطلوبة:
   - setTenant(tenantId): void
   - setBranch(branchId): void
   - switchBranch(branchId): Promise<void>
   - getCurrentBranch(): Branch | null

4. اتبع النمط الموجود في Section 1.3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Tenant ID state موجود
- [ ] Branch ID state موجود
- [ ] Branch switching logic موجود
- [ ] Error handling موجود

---

#### 4. `src/services/tenantSecurityService.ts`
**المرجع:** Section 1.1 (Tenant Isolation Strategy)

**التعليمات:**
```
بناءً على Section 1.1 (Tenant Isolation Strategy):

1. أنشئ tenantSecurityService مع:
   - validateTenantAccess(tenantId, userId): boolean
   - getTenantScopedPath(tenantId, collection): string
   - validateTenantData(data, tenantId): boolean

2. Functions مطلوبة:
   - validateTenantAccess(): يتحقق من Custom Claims
   - getTenantScopedPath(): يرجع path بصيغة tenants/${tenantId}/...
   - validateTenantData(): يتحقق من تطابق tenantId في البيانات

3. اتبع Pattern 1 (Tenant-Scoped Collections) من Section 1.1

4. NO ROOT COLLECTIONS - كل شيء تحت tenants/${tenantId}/
```

**Checklist بعد الكتابة:**
- [ ] validateTenantAccess function موجود
- [ ] getTenantScopedPath function موجود
- [ ] validateTenantData function موجود
- [ ] كل Paths تستخدم tenants/${tenantId}/...
- [ ] NO root collections

---

### ✅ مراجعة المرحلة 1:

قبل الانتقال للمرحلة 2، تأكد من:
- [ ] جميع الملفات الأربعة موجودة
- [ ] كل ملف يتبع المواصفات من الوثيقة
- [ ] Tenant Isolation مطبق في tenantSecurityService
- [ ] Database Protection Layer مطبق في firebase.ts
- [ ] Contexts تعمل بشكل صحيح
- [ ] لا توجد أخطاء TypeScript

---

## 🏗️ المرحلة 2: SERVICE LAYER (طبقة الخدمات)

### ⏱️ الوقت المتوقع: 5-7 أيام

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 7: Service Layer Deep-Dive
- Section 3: Reception & Room Logic
- Section 4: Data Flow Circles
- Section 1.1: Tenant Isolation (مراجعة)

### 📝 الملفات المطلوبة:

#### 1. `src/services/roomService.ts`
**المرجع:** Section 3 (Reception & Room Logic)

**التعليمات:**
```
بناءً على Section 3 (Reception & Room Logic):

1. أنشئ roomService مع:
   - subscribeToRooms(branchId, callback, tenantId): Unsubscribe
   - getRoom(tenantId, branchId, roomNumber): Promise<Room>
   - updateRoomStatus(tenantId, branchId, roomNumber, status): Promise<void>
   - getRoomsByStatus(tenantId, branchId, status): Promise<Room[]>

2. CRITICAL: Tenant Isolation
   - كل query يستخدم: tenants/${tenantId}/rooms
   - validateTenantAccess قبل كل operation
   - Null checks: if (!db || !tenantId) return

3. Real-time Subscription:
   - استخدم onSnapshot من Firestore
   - Cleanup function في return
   - Error handling في callback

4. Room Status Cycle:
   - available → occupied → dirty → cleaning → ready → available
   - اتبع State Machine من Section 3.2

5. اتبع النمط الموجود في Section 3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] subscribeToRooms function موجود
- [ ] Tenant isolation مطبق (tenants/${tenantId}/rooms)
- [ ] Null checks موجودة (if (!db || !tenantId))
- [ ] Real-time subscription مع cleanup
- [ ] Room status cycle مطبق
- [ ] Error handling موجود

---

#### 2. `src/services/requestService.ts`
**المرجع:** Section 4 (Data Flow Circles) + Section 7.1

**التعليمات:**
```
بناءً على Section 4 (Data Flow Circles) و Section 7.1:

1. أنشئ requestService مع:
   - createRequest(input, branchId, userId, userName): Promise<string>
   - confirmRequest(requestId, tenantId, userId, userName): Promise<void>
   - startRequest(requestId, tenantId, userId, userName): Promise<void>
   - completeRequest(requestId, tenantId, userId, userName): Promise<void>
   - subscribeToRequests(branchId, callback, tenantId): Unsubscribe

2. Request Lifecycle (State Machine):
   - PENDING_RECEPTION → CONFIRMED → IN_PROGRESS → COMPLETED → ARCHIVED
   - اتبع State Machine من Section 4.1 بالضبط

3. CRITICAL: Tenant Isolation
   - كل query يستخدم: tenants/${tenantId}/requests
   - validateTenantAccess قبل كل operation
   - Null checks: if (!db || !tenantId) return

4. Request Types:
   - cleaning, maintenance, bellman, amenities, vip_service, procurement
   - اتبع من Section 4.1

5. اتبع النمط الموجود في Section 4 و Section 7 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] createRequest function موجود
- [ ] Request lifecycle مطبق (State Machine)
- [ ] Tenant isolation مطبق (tenants/${tenantId}/requests)
- [ ] Null checks موجودة
- [ ] Real-time subscription مع cleanup
- [ ] Error handling موجود
- [ ] Request types محددة

---

#### 3. `src/services/staffService.ts`
**المرجع:** Section 7.1 (Staff Management & Privileges)

**التعليمات:**
```
بناءً على Section 7.1 (Staff Management & Privileges):

1. أنشئ staffService مع:
   - getStaff(tenantId, branchId): Promise<Staff[]>
   - getStaffByRole(tenantId, branchId, role): Promise<Staff[]>
   - assignRequest(requestId, tenantId, staffId): Promise<void>
   - getStaffWorkload(tenantId, branchId, staffId): Promise<number>

2. RBAC (Role-Based Access Control):
   - owner: Full access
   - manager: Branch management
   - reception: Request confirmation
   - staff: Request execution
   - اتبع RBAC Table من Section 7.1

3. CRITICAL: Tenant Isolation
   - كل query يستخدم: tenants/${tenantId}/employees
   - validateTenantAccess قبل كل operation

4. اتبع النمط الموجود في Section 7.1 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] getStaff function موجود
- [ ] RBAC مطبق (Role-Based Access Control)
- [ ] Tenant isolation مطبق
- [ ] Null checks موجودة
- [ ] Error handling موجود

---

### ✅ مراجعة المرحلة 2:

قبل الانتقال للمرحلة 3، تأكد من:
- [ ] جميع Services موجودة
- [ ] Tenant Isolation مطبق في كل service
- [ ] Null checks موجودة في كل function
- [ ] Real-time subscriptions مع cleanup
- [ ] State Machines مطبقة (Room Status, Request Lifecycle)
- [ ] لا توجد أخطاء TypeScript
- [ ] كل service مختبر بشكل أساسي

---

## 🏗️ المرحلة 3: UI FOUNDATION (أساسيات الواجهة)

### ⏱️ الوقت المتوقع: 4-6 أيام

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 2.1: Turquoise DNA Design System
- Section 2.2: StatCard Logic
- Section 2.3: Sidebar Engineering

### 📝 الملفات المطلوبة:

#### 1. `src/styles/design-system.css`
**المرجع:** Section 2.1 (Turquoise DNA Design System)

**التعليمات:**
```
بناءً على Section 2.1 (Turquoise DNA Design System):

1. أنشئ design-system.css مع:
   - ADORA_THEME colors (Turquoise #20B2AA)
   - Spacing variables
   - Typography variables
   - Shadow variables
   - Z-index variables

2. CSS Variables:
   - --theme-primary: #20B2AA (Turquoise)
   - --theme-bg-primary: #ffffff
   - --theme-bg-secondary: #f8fafc
   - --theme-text-primary: #1e293b
   - --theme-text-secondary: #64748b
   - --theme-border: #e2e8f0

3. اتبع Design Tokens من Section 2.1 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Turquoise color (#20B2AA) موجود
- [ ] جميع CSS variables موجودة
- [ ] Spacing variables موجودة
- [ ] Typography variables موجودة
- [ ] Shadow variables موجودة
- [ ] Z-index variables موجودة

---

#### 2. `src/components/common/StatCard.tsx`
**المرجع:** Section 2.2 (StatCard Logic)

**التعليمات:**
```
بناءً على Section 2.2 (StatCard Logic):

1. أنشئ StatCard component مع:
   - Props: label, value, icon, trend?
   - Fixed height: 100px
   - Gap: 16px
   - Turquoise DNA hover effect
   - Text truncation for long labels (max-width: 150px)

2. Styling:
   - Background: white
   - Border: 1px solid #f1f5f9
   - Border-radius: 16px
   - Padding: 16px
   - Hover: border-color: #20B2AA

3. Icon Styling:
   - Duo-tone icons (stroke-width, opacity)
   - Background: rgba(32, 178, 170, 0.1)
   - Size: 48px x 48px

4. اتبع النمط الموجود في Section 2.2 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Fixed height: 100px
- [ ] Gap: 16px
- [ ] Turquoise hover effect
- [ ] Text truncation للـ labels
- [ ] Duo-tone icons
- [ ] Responsive design

---

#### 3. `src/components/admin/AdminSidebar.tsx`
**المرجع:** Section 2.3 (Sidebar Engineering)

**التعليمات:**
```
بناءً على Section 2.3 (Sidebar Engineering):

1. أنشئ AdminSidebar component مع:
   - Fixed position
   - Width: 280px
   - No internal scroll (overflow: hidden)
   - Active state: solid turquoise background (#20B2AA), white text
   - Inactive state: light gray background (#f8fafc), dark gray text (#64748b)

2. Navigation Items:
   - Reception, Housekeeping, Bellman, Maintenance, etc.
   - Icons: Duo-tone (solid when active, gray when inactive)
   - Hover effect: subtle background change

3. Styling:
   - Active: background: #20B2AA, color: white
   - Inactive: background: #f8fafc, color: #64748b
   - No side indicator bar
   - Smooth transitions

4. اتبع النمط الموجود في Section 2.3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Fixed position
- [ ] Width: 280px
- [ ] No internal scroll
- [ ] Active/inactive states صحيحة
- [ ] Icons styling صحيح
- [ ] Smooth transitions

---

#### 4. `src/components/layout/PremiumHeader.tsx`
**المرجع:** Section 2.3 (Sidebar Engineering - Header)

**التعليمات:**
```
بناءً على Section 2.3 (Premium Header):

1. أنشئ PremiumHeader component مع:
   - Two-tier layout (Identity Tier + Navigation Tier)
   - Sticky position
   - Z-index: 100
   - Overflow: visible (for dropdowns)

2. Identity Tier:
   - Logo + Greeting + Branch selector + Actions menu
   - Height: 64px
   - Padding: 0 24px

3. Navigation Tier:
   - Department tabs (Reception, Housekeeping, etc.)
   - Active indicator: 4px turquoise bar
   - Flex-wrap: wrap (for small screens)

4. Dropdown Menu:
   - Position: absolute
   - Top: calc(100% + 5px)
   - Z-index: 1000
   - Border-radius: 16px

5. اتبع النمط الموجود في Section 2.3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Two-tier layout
- [ ] Sticky position
- [ ] Overflow: visible
- [ ] Dropdown positioning صحيح
- [ ] Active indicator موجود
- [ ] Responsive design

---

### ✅ مراجعة المرحلة 3:

قبل الانتقال للمرحلة 4، تأكد من:
- [ ] Design System موجود
- [ ] StatCard component يعمل
- [ ] AdminSidebar component يعمل
- [ ] PremiumHeader component يعمل
- [ ] Turquoise DNA مطبق في كل component
- [ ] Responsive design يعمل
- [ ] لا توجد أخطاء TypeScript

---

## 🏗️ المرحلة 4: CORE FEATURES (الميزات الأساسية)

### ⏱️ الوقت المتوقع: 7-10 أيام

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 3: Reception & Room Logic
- Section 4: Data Flow Circles
- Section 7.1: RBAC

### 📝 الملفات المطلوبة:

#### 1. `src/features/reception/ReceptionDashboard.tsx`
**المرجع:** Section 3 (Reception & Room Logic)

**التعليمات:**
```
بناءً على Section 3 (Reception & Room Logic):

1. أنشئ ReceptionDashboard component مع:
   - Room grid (استخدم roomService.subscribeToRooms)
   - Room status filter (available, occupied, dirty, cleaning)
   - Check-in/Check-out functionality
   - Real-time room updates

2. StatCards:
   - Total Rooms
   - Occupied Rooms
   - Available Rooms
   - Cleaning Rooms
   - استخدم StatCard component من المرحلة 3

3. Room Card Component:
   - Room number
   - Status badge (color-coded)
   - Guest name (if occupied)
   - Action buttons (Check-in, Check-out, Cleaning)

4. CRITICAL:
   - استخدم useTenant() للحصول على tenantId
   - استخدم roomService.subscribeToRooms
   - Null checks: if (!tenantId || !branchId) return null

5. اتبع النمط الموجود في Section 3 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Room grid موجود
- [ ] Real-time updates تعمل
- [ ] StatCards موجودة
- [ ] Check-in/Check-out functions موجودة
- [ ] Tenant isolation مطبق
- [ ] Null checks موجودة
- [ ] Error handling موجود

---

#### 2. `src/features/housekeeping/HousekeepingDashboard.tsx`
**المرجع:** Section 4 (Data Flow Circles - Request System)

**التعليمات:**
```
بناءً على Section 4 (Data Flow Circles):

1. أنشئ HousekeepingDashboard component مع:
   - Request list (استخدم requestService.subscribeToRequests)
   - Request status filter (PENDING, CONFIRMED, IN_PROGRESS, COMPLETED)
   - Request assignment
   - Request completion

2. StatCards:
   - Pending Requests
   - In Progress
   - Completed Today
   - استخدم StatCard component

3. Request Card Component:
   - Request type (cleaning, maintenance, etc.)
   - Room number
   - Guest name
   - Status badge
   - Priority indicator
   - Action buttons (Start, Complete)

4. CRITICAL:
   - استخدم useTenant() للحصول على tenantId
   - استخدم requestService.subscribeToRequests
   - Request lifecycle: PENDING → CONFIRMED → IN_PROGRESS → COMPLETED

5. اتبع النمط الموجود في Section 4 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Request list موجود
- [ ] Real-time updates تعمل
- [ ] StatCards موجودة
- [ ] Request assignment موجود
- [ ] Request lifecycle مطبق
- [ ] Tenant isolation مطبق
- [ ] Error handling موجود

---

#### 3. `src/features/bellman/BellmanDashboard.tsx`
**المرجع:** Section 3 + Section 4

**التعليمات:**
```
بناءً على Section 3 و Section 4:

1. أنشئ BellmanDashboard component مع:
   - Active room cards (occupied rooms)
   - Request list (bellman requests)
   - Luggage handling
   - Check-in/Check-out assistance

2. StatCards:
   - Active Rooms
   - Pending Requests
   - Completed Today
   - استخدم StatCard component

3. Room Card Component:
   - Room number
   - Guest name
   - Check-in time
   - Requests count
   - Action buttons

4. CRITICAL:
   - استخدم useTenant() للحصول على tenantId
   - استخدم roomService.subscribeToRooms (filter: status === 'occupied')
   - استخدم requestService.subscribeToRequests (filter: type === 'bellman')

5. اتبع النمط الموجود في Section 3 و Section 4
```

**Checklist بعد الكتابة:**
- [ ] Active rooms list موجود
- [ ] Request list موجود
- [ ] Real-time updates تعمل
- [ ] StatCards موجودة
- [ ] Tenant isolation مطبق
- [ ] Error handling موجود

---

#### 4. `src/features/maintenance/MaintenanceDashboard.tsx`
**المرجع:** Section 11.4 (Maintenance Ticketing)

**التعليمات:**
```
بناءً على Section 11.4 (Maintenance Ticketing):

1. أنشئ MaintenanceDashboard component مع:
   - Maintenance requests list
   - Room status (Out-of-Order)
   - Maintenance workflow
   - Return to available

2. StatCards:
   - Pending Maintenance
   - In Progress
   - Out-of-Order Rooms
   - استخدم StatCard component

3. Request Card Component:
   - Request type (maintenance)
   - Room number
   - Issue description
   - Status
   - Action buttons

4. CRITICAL:
   - Room status: available → maintenance → out-of-order → available
   - استخدم useTenant() للحصول على tenantId
   - استخدم requestService.subscribeToRequests (filter: type === 'maintenance')

5. اتبع النمط الموجود في Section 11.4 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] Maintenance requests list موجود
- [ ] Room status workflow مطبق
- [ ] Real-time updates تعمل
- [ ] StatCards موجودة
- [ ] Tenant isolation مطبق
- [ ] Error handling موجود

---

### ✅ مراجعة المرحلة 4:

قبل الانتقال للمرحلة 5، تأكد من:
- [ ] جميع Dashboards موجودة
- [ ] Real-time subscriptions تعمل
- [ ] StatCards موجودة في كل dashboard
- [ ] Tenant isolation مطبق
- [ ] Request lifecycle مطبق
- [ ] Room status cycle مطبق
- [ ] لا توجد أخطاء TypeScript
- [ ] كل dashboard يعمل بشكل أساسي

---

## 🏗️ المرحلة 5: ADVANCED FEATURES (الميزات المتقدمة)

### ⏱️ الوقت المتوقع: 10-14 يوم

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 6: Analytics Engine
- Section 11: Logistics Modules
- Section 12: Staff & Guest Management

### 📝 الملفات المطلوبة:

#### 1. `src/features/admin/AdminDashboard.tsx`
**المرجع:** Section 6 (Analytics Engine)

**التعليمات:**
```
بناءً على Section 6 (Analytics Engine):

1. أنشئ AdminDashboard component مع:
   - KPI Cards (Occupancy Rate, ADR, RevPAR)
   - Revenue charts
   - Request statistics
   - Staff performance

2. KPI Calculations:
   - Occupancy Rate: (Occupied Rooms / Total Rooms) × 100
   - ADR: Total Revenue / Number of Rooms Sold
   - RevPAR: ADR × Occupancy Rate
   - اتبع Formulas من Section 6.1 بالضبط

3. StatCards:
   - Occupancy Rate
   - Total Revenue
   - Average Daily Rate
   - Revenue Per Available Room
   - استخدم StatCard component

4. Charts:
   - Revenue over time
   - Occupancy trends
   - Request completion rates

5. CRITICAL:
   - استخدم useTenant() للحصول على tenantId
   - Data aggregation (Section 6.2)
   - Caching strategy (30s-5min TTL)

6. اتبع النمط الموجود في Section 6 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] KPI calculations صحيحة
- [ ] Charts موجودة
- [ ] StatCards موجودة
- [ ] Data aggregation مطبق
- [ ] Caching strategy مطبق
- [ ] Tenant isolation مطبق
- [ ] Error handling موجود

---

#### 2. `src/services/laundryService.ts` + `src/features/laundry/LaundryDashboard.tsx`
**المرجع:** Section 11.1 (Laundry & Linen Management)

**التعليمات:**
```
بناءً على Section 11.1 (Laundry & Linen Management):

1. أنشئ laundryService مع:
   - getInventory(tenantId, branchId): Promise<Inventory>
   - updateInventory(tenantId, branchId, item, quantity): Promise<void>
   - createLaundryRequest(tenantId, branchId, roomNumber, items): Promise<string>

2. أنشئ LaundryDashboard component مع:
   - Inventory list (clean/dirty counts)
   - Room linkage
   - Deficit tracking
   - Laundry requests

3. CRITICAL:
   - Atomic transactions (writeBatch)
   - Room linkage logic
   - Deficit calculation

4. اتبع النمط الموجود في Section 11.1 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] laundryService موجود
- [ ] LaundryDashboard موجود
- [ ] Atomic transactions مطبقة
- [ ] Room linkage موجود
- [ ] Deficit tracking موجود
- [ ] Tenant isolation مطبق

---

#### 3. `src/services/lostFoundService.ts` + `src/features/lostfound/LostFoundDashboard.tsx`
**المرجع:** Section 11.2 (Lost & Found Management)

**التعليمات:**
```
بناءً على Section 11.2 (Lost & Found Management):

1. أنشئ lostFoundService مع:
   - createItem(tenantId, branchId, item): Promise<string>
   - updateStatus(itemId, tenantId, status): Promise<void>
   - linkToRoom(itemId, tenantId, roomNumber): Promise<void>

2. أنشئ LostFoundDashboard component مع:
   - Items list (discovered, claimed, delivered, archived)
   - Status transitions
   - Identity verification
   - Auto-linking to rooms

3. CRITICAL:
   - Status lifecycle: discovered → claimed → delivered → archived
   - Identity verification logic
   - Retention period (30 days default)

4. اتبع النمط الموجود في Section 11.2 بالضبط
```

**Checklist بعد الكتابة:**
- [ ] lostFoundService موجود
- [ ] LostFoundDashboard موجود
- [ ] Status lifecycle مطبق
- [ ] Identity verification موجود
- [ ] Auto-linking موجود
- [ ] Tenant isolation مطبق

---

### ✅ مراجعة المرحلة 5:

قبل الانتقال للمرحلة 6، تأكد من:
- [ ] AdminDashboard موجود
- [ ] Analytics calculations صحيحة
- [ ] Logistics modules موجودة
- [ ] Atomic transactions مطبقة
- [ ] Tenant isolation مطبق
- [ ] لا توجد أخطاء TypeScript

---

## 🏗️ المرحلة 6: INTEGRATION & POLISH (التكامل واللمسات الأخيرة)

### ⏱️ الوقت المتوقع: 5-7 أيام

### 📚 الأقسام المطلوبة من الوثيقة:
- Section 9: Development Setup
- Section 18: Operational Excellence
- Section 19: Development Workflow

### 📝 المهام المطلوبة:

#### 1. Routing Setup
**المرجع:** Section 9 (Development Setup)

**التعليمات:**
```
1. أنشئ AppRoutes.tsx مع:
   - Protected routes (require authentication)
   - Role-based routes (RBAC)
   - Tenant-based routes

2. Routes:
   - /login → LoginScreen
   - /reception → ReceptionDashboard
   - /housekeeping → HousekeepingDashboard
   - /bellman → BellmanDashboard
   - /maintenance → MaintenanceDashboard
   - /admin → AdminDashboard
   - /laundry → LaundryDashboard
   - /lostfound → LostFoundDashboard

3. CRITICAL:
   - Route guards (check authentication)
   - Role guards (check permissions)
   - Tenant guards (check tenant access)
```

**Checklist:**
- [ ] All routes موجودة
- [ ] Route guards مطبقة
- [ ] RBAC مطبق
- [ ] Tenant guards مطبقة

---

#### 2. Error Handling
**المرجع:** Section 18.1 (Error Codes & Messages Catalog)

**التعليمات:**
```
1. أنشئ errorHandler.ts مع:
   - Error code mapping (Section 18.1)
   - User-friendly messages (Arabic/English)
   - Error logging

2. Error Codes:
   - ADORA_AUTH_TENANT_MISSING_001
   - ADORA_DB_CONNECTION_FAILED_001
   - ADORA_VALIDATION_REQUIRED_FIELD_001
   - اتبع من Section 18.1

3. Error Display:
   - Toast notifications
   - Error boundaries
   - User-friendly messages
```

**Checklist:**
- [ ] Error codes موجودة
- [ ] Error messages موجودة (AR/EN)
- [ ] Error logging موجود
- [ ] Toast notifications تعمل
- [ ] Error boundaries موجودة

---

#### 3. Testing
**المرجع:** Section 21 (Testing Strategy & Test Cases)

**التعليمات:**
```
1. Unit Tests:
   - Service layer tests (Section 21.1)
   - Component tests
   - Hook tests

2. Integration Tests:
   - Request lifecycle (Section 21.2)
   - Room status cycle
   - Check-in flow

3. Load Tests:
   - Concurrent requests (Section 21.3)
   - Performance benchmarks
```

**Checklist:**
- [ ] Unit tests موجودة
- [ ] Integration tests موجودة
- [ ] Load tests موجودة
- [ ] Test coverage > 70%

---

#### 4. Documentation
**التعليمات:**
```
1. README.md:
   - Project overview
   - Setup instructions
   - Development guide

2. API Documentation:
   - Service layer documentation
   - Component documentation

3. Deployment Guide:
   - Environment variables
   - Build process
   - Deployment steps
```

**Checklist:**
- [ ] README.md موجود
- [ ] API documentation موجود
- [ ] Deployment guide موجود

---

### ✅ مراجعة المرحلة 6 (FINAL):

قبل الإعلان عن الإكمال:
- [ ] جميع Routes موجودة وتعمل
- [ ] Error handling شامل
- [ ] Tests موجودة وتعمل
- [ ] Documentation كاملة
- [ ] لا توجد أخطاء TypeScript
- [ ] لا توجد console.log في production code
- [ ] Performance benchmarks محققة
- [ ] Security audit مكتمل

---

## 📋 FINAL CHECKLIST (قائمة المراجعة النهائية)

### ✅ Architecture
- [ ] Tenant Isolation مطبق في كل service
- [ ] Database Protection Layer مطبق
- [ ] Global State Management يعمل
- [ ] Error Handling شامل

### ✅ Services
- [ ] roomService موجود ويعمل
- [ ] requestService موجود ويعمل
- [ ] staffService موجود ويعمل
- [ ] جميع Services تتبع Tenant Isolation

### ✅ UI Components
- [ ] Design System موجود
- [ ] StatCard component موجود
- [ ] AdminSidebar موجود
- [ ] PremiumHeader موجود

### ✅ Features
- [ ] ReceptionDashboard موجود
- [ ] HousekeepingDashboard موجود
- [ ] BellmanDashboard موجود
- [ ] MaintenanceDashboard موجود
- [ ] AdminDashboard موجود
- [ ] Logistics modules موجودة

### ✅ Quality
- [ ] No TypeScript errors
- [ ] No console.log in production
- [ ] Tests موجودة
- [ ] Documentation كاملة
- [ ] Performance benchmarks محققة

---

## 🎯 ملاحظات نهائية

1. **لا تقفز للمرحلة التالية** قبل إكمال المرحلة الحالية
2. **راجع كل ملف** مقابل الوثيقة التقنية
3. **اختبر كل feature** قبل الانتقال للتالية
4. **استخدم Checklist** بعد كل ملف/مرحلة
5. **إذا كان شيء غير واضح** - راجع الوثيقة التقنية أولاً

---

**✅ عند إكمال جميع المراحل - النظام جاهز 100%**
