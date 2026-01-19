# Adora Hotel Management System - Technical Review Documentation

## Executive Summary

**Adora** is a modern, production-ready SaaS (Software as a Service) hotel management platform built with React, TypeScript, and Firebase. The system provides comprehensive hotel operations management with multi-tenant architecture, role-based access control, and real-time data synchronization.

**Version:** 3.5.0  
**Status:** Production Ready ✅  
**Last Updated:** January 2026

---

## 1. Tech Stack

### Frontend
- **Framework:** React 18.2 with TypeScript 5.3
- **Build Tool:** Vite 5.0 (Fast HMR, optimized builds)
- **Styling:** Tailwind CSS 3.4 (Mobile-first, Glassmorphism design)
- **Routing:** React Router DOM 6.20
- **State Management:** React Context API + Custom Hooks
- **Icons:** Lucide React
- **Charts:** Chart.js 4.5 + React-Chartjs-2
- **Internationalization:** i18next (4 languages: Arabic, English, Hindi, Bengali)

### Backend
- **Database:** Firebase Firestore v10 (NoSQL, real-time)
- **Authentication:** Firebase Auth (Anonymous + Email/Password + Custom PIN)
- **Storage:** Firebase Storage (with ImgBB fallback)
- **Functions:** Firebase Cloud Functions (Node.js 20)
- **Hosting:** Firebase Hosting (PWA-ready)

### Architecture
- **Type:** SaaS Multi-Tenant Platform
- **Data Isolation:** Tenant-scoped collections (`tenants/{tenantId}/collection`)
- **Security:** Cloud Functions Gateway Pattern (Master Key Architecture)
- **Offline Support:** Firestore Offline Persistence enabled

---

## 2. Core Features

### 2.1 Owner Dashboard
- **Tenant Management:** Create, manage, and monitor hotel tenants
- **Subscription Management:** 1-year/2-year subscriptions with automatic billing
- **Analytics:** Revenue tracking (MRR, ARR), tenant statistics
- **System Configuration:** API keys, Firebase settings, feature toggles
- **Billing:** Invoice generation, payment tracking, license management

### 2.2 Manager Dashboard
- **Hotel Operations:** Complete hotel management interface
- **Multi-Branch Support:** Manage multiple hotel branches per tenant
- **Employee Management:** Role-based access, performance tracking
- **Room Management:** Room status, check-in/check-out, availability
- **Reports:** Analytics, KPIs, data health reports

### 2.3 Employee Dashboards (Role-Based)
- **Reception:** Guest check-in/out, request management, room assignments
- **Bellman:** Luggage handling, guest assistance, cart management
- **Housekeeping:** Room cleaning, inspection, status updates
- **Maintenance:** Repair requests, equipment management, work orders
- **Procurement:** Purchase requests, inventory management
- **Coffee Shop:** Order management, menu items, billing

### 2.4 Guest Portal
- **QR Code Access:** Secure token-based room access
- **Service Requests:** Maintenance, housekeeping, late checkout, coffee shop orders
- **Smart Chat:** Real-time communication with hotel staff
- **Order Tracking:** Real-time status updates for requests

---

## 3. Business Logic & Data Flow

### 3.1 Authentication Flow
```
User Input (PIN) 
  → PIN Validation (Hash comparison)
  → Firebase Auth (Custom Claims)
  → Tenant Context Initialization
  → Role-Based Dashboard Routing
```

### 3.2 Request Lifecycle (Guest → Employee)
```
1. Guest scans QR code
   ↓
2. Token validation (secureAccessService)
   ↓
3. Anonymous authentication
   ↓
4. Location verification (Haversine distance)
   ↓
5. Guest creates request
   ↓
6. Request saved to Firestore (tenants/{tenantId}/requests)
   ↓
7. Real-time listener updates employee dashboard
   ↓
8. Employee accepts/completes request
   ↓
9. Guest receives notification (real-time update)
```

### 3.3 Check-In Flow (Master Key Pattern)
```
1. Employee initiates check-in
   ↓
2. Client calls Cloud Function: processCheckIn
   ↓
3. Function validates:
   - Employee identity (verifyEmployeeIdentity)
   - Room availability (checkRoomAvailability)
   ↓
4. Atomic Transaction:
   - Create room card
   - Update room status to 'occupied'
   - Generate QR token
   - Audit log
   ↓
5. Return success to client
```

### 3.4 Data Isolation (SaaS Multi-Tenancy)
```
Platform Level (Root Collections):
  - managers (tenant list)
  - invoices (billing)
  - system_settings (platform config)

Tenant Level (Isolated Collections):
  - tenants/{tenantId}/rooms
  - tenants/{tenantId}/requests
  - tenants/{tenantId}/employees
  - tenants/{tenantId}/roomCards
  - tenants/{tenantId}/settings
```

---

## 4. Security Architecture

### 4.1 Master Key Pattern
- **Client:** Read-only access to Firestore
- **Cloud Functions:** Write access via Admin SDK (bypasses Rules)
- **Security Rules:** Simple `allow write: if false` (all writes via Functions)

### 4.2 Authentication
- **PIN-based Login:** Hash comparison (no plain text storage)
- **Custom Claims:** Role-based permissions (owner, manager, employee)
- **Anonymous Auth:** For guest portal (temporary identity)
- **Rate Limiting:** Prevents brute-force attacks

### 4.3 Data Security
- **Encryption:** AES-256-GCM for sensitive localStorage data
- **Token Management:** Secure access tokens with expiration
- **Tenant Isolation:** Strict data separation per tenant
- **Audit Logs:** All critical operations logged

---

## 5. Project Structure

```
adora-hotel-system/
├── src/
│   ├── features/              # Page-level components (screens)
│   │   ├── auth/              # Authentication screens
│   │   ├── admin/             # Admin dashboard
│   │   ├── super-admin/       # Owner dashboard
│   │   ├── reception/         # Reception dashboard
│   │   ├── bellman/           # Bellman dashboard
│   │   ├── housekeeping/      # Housekeeping dashboard
│   │   ├── maintenance/       # Maintenance dashboard
│   │   ├── procurement/       # Procurement dashboard
│   │   ├── coffeeshop/        # Coffee shop dashboard
│   │   ├── guest/             # Guest portal
│   │   └── onboarding/        # Onboarding flow
│   ├── components/            # Reusable UI components
│   │   ├── admin/             # Admin-specific components
│   │   ├── auth/              # Authentication components
│   │   ├── common/            # Shared components
│   │   ├── layout/            # Layout components
│   │   └── shared/            # Cross-feature components
│   ├── services/              # Business logic & Firebase calls
│   │   ├── firebase.ts        # Firebase initialization
│   │   ├── roomCardService.ts # Check-in/out operations
│   │   ├── requestService.ts  # Request management
│   │   ├── ownerService.ts    # Owner operations
│   │   ├── systemConfigsService.ts # API keys management
│   │   └── ...                # Other services
│   ├── context/               # React Context providers
│   │   ├── AuthContext.tsx    # Authentication state
│   │   ├── TenantContext.tsx  # Tenant isolation
│   │   └── I18nContext.tsx    # Internationalization
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript interfaces
│   ├── utils/                 # Utility functions
│   └── locales/               # Translation files (ar, en, hi, bn)
├── functions/                 # Cloud Functions (Backend)
│   ├── src/
│   │   ├── data/              # Data operations
│   │   │   └── roomOperations.ts # processCheckIn, checkRoomAvailability
│   │   ├── auth/              # Authentication functions
│   │   ├── admin/             # Admin functions
│   │   └── security/         # Security & rate limiting
│   └── lib/                   # Compiled JavaScript
├── docs/                      # Documentation
│   ├── guides/                # Developer guides
│   ├── schemas/               # Database schemas
│   └── roadmaps/              # Future plans
├── public/                    # Static assets
├── firestore.rules            # Firestore security rules
├── storage.rules              # Storage security rules
└── .env.example               # Environment variables template
```

---

## 6. Key Services & Their Responsibilities

### `firebase.ts`
- Dynamic Firebase initialization
- Tenant-specific Firebase config support
- Service exports (db, auth, storage)

### `roomCardService.ts`
- Guest check-in/check-out operations
- Room availability checks
- QR token generation

### `requestService.ts`
- Request creation and management
- Status updates
- Real-time subscriptions

### `ownerService.ts`
- Tenant (manager) creation
- License management
- Billing operations

### `systemConfigsService.ts`
- Dynamic API key management
- Configuration caching
- Key validation

---

## 7. Database Schema Overview

### Root Collections (Platform Level)
- `managers` - Tenant list
- `invoices` - Billing records
- `system_settings` - Platform configuration
- `globalCodes` - PIN codes for login

### Tenant Collections (Isolated)
- `tenants/{tenantId}/rooms` - Hotel rooms
- `tenants/{tenantId}/requests` - Service requests
- `tenants/{tenantId}/employees` - Staff members
- `tenants/{tenantId}/roomCards` - Active check-ins
- `tenants/{tenantId}/settings` - Tenant configuration

---

## 8. Security Rules Summary

### Firestore Rules
- **Read:** Authenticated users can read their tenant's data
- **Write:** All writes via Cloud Functions only (`allow write: if false`)
- **Exceptions:** Audit logs (client can create, not update/delete)

### Storage Rules
- **Tenant Isolation:** Files organized by `tenantId` in path
- **Metadata Validation:** Tenant ID must match in metadata
- **File Size Limits:** 5MB for images, 10MB for documents
- **Type Validation:** Only allowed MIME types

---

## 9. Cloud Functions

### Room Operations
- `processCheckIn` - Unified check-in (3 steps in 1 transaction)
- `checkRoomAvailability` - Room availability validation
- `checkInGuest` - Legacy check-in function
- `checkOutGuest` - Check-out operation

### Authentication
- `loginWithPin` - PIN-based authentication
- `setUserCustomClaims` - Role management

### Admin
- `createManager` - Tenant creation
- `deployTenantFirebase` - Firebase setup for tenants

---

## 10. Performance Optimizations

- **Offline Persistence:** Firestore cache enabled (unlimited)
- **Code Splitting:** Vite automatic chunking
- **Image Compression:** WebP conversion, 300KB max
- **Lazy Loading:** Route-based code splitting
- **Caching:** Service-level caching (5-minute TTL)

---

## 11. Internationalization

- **Languages:** Arabic (RTL), English, Hindi, Bengali (LTR)
- **Framework:** react-i18next
- **Auto-detection:** Browser language detection
- **Fallback:** English (default)

---

## 12. Development Workflow

### Setup
1. Clone repository
2. Copy `.env.example` to `.env`
3. Fill Firebase configuration
4. Run `npm install`
5. Run `npm run dev`

### Build
```bash
npm run build        # Production build
npm run typecheck    # TypeScript validation
npm run lint         # ESLint check
```

### Deploy
```bash
firebase deploy --only hosting      # Frontend
firebase deploy --only functions    # Cloud Functions
firebase deploy --only firestore:rules  # Security Rules
```

---

## 13. Testing

- **Framework:** Vitest
- **Coverage:** Unit tests for critical services
- **E2E:** Manual testing via UI
- **Browser Testing:** Chrome, Firefox, Safari, Edge

---

## 14. Known Issues & Limitations

### Resolved
- ✅ MutationObserver error (fixed with null checks)
- ✅ Syntax errors in owner-dashboard (fixed)
- ✅ Hardcoded API keys (moved to .env/system_configs)

### Current Limitations
- Cloud Functions require Blaze Plan (Firebase)
- Image uploads require ImgBB API key (or Firebase Storage)
- Some features require specific Firebase project configuration

---

## 15. Future Roadmap

- Enhanced analytics dashboard
- Mobile app (React Native)
- Advanced reporting
- Integration with payment gateways
- Multi-language expansion

---

**Document Version:** 1.0  
**Prepared For:** External Technical Review  
**Date:** January 2026
