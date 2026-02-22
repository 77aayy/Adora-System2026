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

## 🚀 Quick Start

- **New Developer?** Start with [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md)
- **Setup Instructions:** Follow [`docs/guides/STEP_BY_STEP_SETUP.md`](docs/guides/STEP_BY_STEP_SETUP.md)
- **Database Schema:** Review [`docs/schemas/FIRESTORE_SCHEMA.md`](docs/schemas/FIRESTORE_SCHEMA.md)

-----

## 📍 Project Navigation for Reviewers

### Entry Point
**Application Flow:** `src/main.tsx` → `src/App.tsx` → `src/AppRoutes.tsx` → Feature Components

### Owner Dashboard Flow (Main Focus)

**Component:** `src/features/super-admin/EnhancedOwnerDashboard.tsx`

**Key Operations:**

1. **Tenant Management Tab:**
   - Lists all hotel tenants (managers)
   - Creates new tenant via `ownerService.createManager()`
   - Suspends/activates via `ownerService.toggleLicenseStatus()`
   - Renews license via `ownerService.renewLicense()`

2. **Billing Tab:**
   - Displays revenue metrics (MRR, ARR)
   - Creates receipt vouchers via `billingService.createReceiptVoucher()`
   - Generates invoices via `billingService.createInvoice()`
   - Tracks subscription expiry dates

3. **Data Flow:**
   ```
   User Action (UI)
     ↓
   Service Layer (src/services/)
     ↓
   Cloud Function (functions/src/) [for writes]
     ↓
   Firestore Database
   ```

**Key Services:**
- `src/services/ownerService.ts` - Tenant creation, license management
- `src/services/billingService.ts` - Subscription, invoices, revenue calculation

**See:** [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) for complete navigation map.

---

## 🛠️ Tech Stack

- **Frontend:** React 18.2 + TypeScript 5.3 + Vite 5.0 + Tailwind CSS 3.4
- **Backend:** Firebase v10 (Firestore, Auth, Storage, Functions)
- **Architecture:** SaaS Multi-Tenant Platform
- **State Management:** React Context API + Custom Hooks
- **Routing:** React Router DOM 6.20
- **i18n:** react-i18next (4 languages: Arabic, English, Hindi, Bengali)

---

## 📁 Project Structure

```
src/
├── features/          # Page-level components (dashboards)
├── components/       # Reusable UI components
├── services/         # Business logic & Firebase calls
├── context/          # React Context providers
├── hooks/            # Custom React hooks
├── types/            # TypeScript interfaces
└── utils/            # Utility functions

functions/
└── src/              # Cloud Functions (backend)
```

**See:** [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) for detailed structure.

---

## 🚀 How to Run

### Prerequisites
- Node.js 18+
- Firebase account
- npm or yarn

### Setup
1. Clone repository
2. Copy `.env.example` to `.env`
3. Fill Firebase configuration
4. Install dependencies: `npm install`
5. Run dev server: `npm run dev`

### Build
```bash
npm run build
```

### Deploy
```bash
# Firebase
firebase deploy --only hosting

# Or use script
npm run deploy-fb
```

---

## 📚 Documentation

- **Developer Guide:** [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md)
- **Setup Guide:** [`docs/guides/STEP_BY_STEP_SETUP.md`](docs/guides/STEP_BY_STEP_SETUP.md)
- **Database Schema:** [`docs/schemas/FIRESTORE_SCHEMA.md`](docs/schemas/FIRESTORE_SCHEMA.md)
- **All Docs:** [`docs/README.md`](docs/README.md)

---

## 🔗 Links

- **GitHub:** https://github.com/77aayy/Adora-System2026
- **Live Site:** https://adora-platform2026.web.app
- **Firebase Console:** https://console.firebase.google.com/project/adora-platform2026

---

**Version:** 3.5.0  
**Status:** Production Ready ✅  
**Last Updated:** January 2026
