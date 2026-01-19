# Developer Guide - Adora Hotel Management System

**Quick Navigation Map for Code Reviewers**

---

## 🚀 Entry Point

**Application Flow:**
```
src/main.tsx → src/App.tsx → src/AppRoutes.tsx → [Feature Components]
```

1. **`src/main.tsx`** - Application bootstrap
   - Loads CSS, i18n configuration
   - Initializes React root
   - Wraps app with I18nProvider

2. **`src/App.tsx`** - Main application component
   - Provider composition (Auth, Tenant, Theme, etc.)
   - Global error handling
   - Route wrapper

3. **`src/AppRoutes.tsx`** - Route definitions
   - Maps URLs to feature components
   - Protected routes (authentication required)

---

## 💼 Main Business Logic Locations

### Subscription & Billing
**Location:** `src/services/billingService.ts`

**Key Functions:**
- `createReceiptVoucher()` - Creates payment receipt for subscription
- `createInvoice()` - Generates invoice from receipt voucher
- `renewSubscription()` - Calculates expiry date and updates subscription
- `calculateMonthlyRecurringRevenue()` - Computes MRR from active subscriptions
- `calculateAnnualRecurringRevenue()` - Computes ARR from active subscriptions

### Hotel Management (Tenant Operations)
**Location:** `src/services/ownerService.ts`

**Key Functions:**
- `createManager()` - Creates new hotel tenant with isolated data
- `renewLicense()` - Extends subscription expiry date
- `toggleLicenseStatus()` - Suspends/activates tenant account
- `getAllManagers()` - Lists all hotel tenants

### Room Operations
**Location:** `src/services/roomCardService.ts`

**Key Functions:**
- `checkIn()` - Guest check-in (uses Cloud Function `processCheckIn`)
- `checkOut()` - Guest check-out with room status update
- `checkRoomAvailability()` - Validates room availability (uses Cloud Function)

### Request Management
**Location:** `src/services/requestService.ts`

**Key Functions:**
- `createRequest()` - Creates guest service request
- `updateRequestStatus()` - Updates request lifecycle (PENDING → CONFIRMED → IN_PROGRESS → COMPLETED)
- `assignRequest()` - Assigns request to employee

---

## 📁 Core Folder Structure

### `/src/features/` - Page-Level Components
- **`super-admin/`** - Owner dashboard (tenant management, billing)
- **`admin/`** - Manager dashboard (hotel operations)
- **`reception/`** - Reception staff dashboard
- **`housekeeping/`** - Housekeeping dashboard
- **`maintenance/`** - Maintenance dashboard
- **`bellman/`** - Bellman dashboard
- **`guest/`** - Guest portal (QR code access)

### `/src/services/` - Business Logic Layer
**All Firebase operations happen here. No direct DB calls in components.**

- **`billingService.ts`** - Subscription, invoices, payments
- **`ownerService.ts`** - Tenant creation, license management
- **`roomCardService.ts`** - Check-in/out operations
- **`requestService.ts`** - Request lifecycle management
- **`firebase.ts`** - Firebase initialization & configuration

### `/src/components/` - Reusable UI Components
- **`admin/`** - Admin-specific components
- **`common/`** - Shared components (modals, toasts, loaders)
- **`layout/`** - Layout components (headers, routes)

### `/src/context/` - Global State Management
- **`AuthContext.tsx`** - User authentication state
- **`TenantContext.tsx`** - Tenant isolation (SaaS)
- **`I18nContext.tsx`** - Internationalization

### `/src/hooks/` - Custom React Hooks
- **`useTenantData.ts`** - Tenant data fetching
- **`useRequests.ts`** - Request management hooks

### `/functions/src/` - Cloud Functions (Backend)
- **`data/roomOperations.ts`** - `processCheckIn`, `checkRoomAvailability` (Master Key pattern)
- **`admin/managerCreation.ts`** - Tenant creation via Admin SDK

---

## 🔑 Key Architectural Patterns

### Master Key Pattern
- **Client:** Read-only Firestore access
- **Cloud Functions:** Write access via Admin SDK (bypasses Rules)
- **Security Rules:** Simple `allow write: if false`

### SaaS Multi-Tenancy
- **Platform Level:** `managers`, `invoices` (root collections)
- **Tenant Level:** `tenants/{tenantId}/rooms`, `tenants/{tenantId}/requests` (isolated)

### Service Layer Isolation
- **Rule:** No Firebase calls in components
- **Pattern:** Component → Service → Firebase
- **Example:** `ReceptionDashboard.tsx` calls `requestService.createRequest()`, not `addDoc()` directly

---

## 📊 Data Flow Example: Owner Dashboard

```
User clicks "Create Manager"
  ↓
EnhancedOwnerDashboard.tsx (UI)
  ↓
ownerService.createManager() (Service)
  ↓
Cloud Function: managerCreation (Backend)
  ↓
Firestore: managers collection (Database)
```

---

## 🛠️ How to Run Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Fill Firebase configuration

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

---

**Last Updated:** January 2026
