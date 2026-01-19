# Adora Project Structure - Tree View

```
adora-hotel-system/
│
├── 📁 src/                          # Source code
│   ├── 📁 features/                 # Page-level components (screens)
│   │   ├── 📁 admin/                # Admin dashboard (33 files)
│   │   ├── 📁 auth/                 # Authentication (2 files)
│   │   ├── 📁 bellman/              # Bellman dashboard (3 files)
│   │   ├── 📁 coffeeshop/           # Coffee shop dashboard (1 file)
│   │   ├── 📁 guest/                # Guest portal (4 files)
│   │   ├── 📁 housekeeping/         # Housekeeping dashboard (6 files)
│   │   ├── 📁 maintenance/          # Maintenance dashboard (4 files)
│   │   ├── 📁 onboarding/           # Onboarding flow (2 files)
│   │   ├── 📁 owner/                # Owner features (1 file)
│   │   ├── 📁 procurement/          # Procurement dashboard (3 files)
│   │   ├── 📁 reception/            # Reception dashboard (3 files)
│   │   ├── 📁 setup/                # Setup wizards (3 files)
│   │   └── 📁 super-admin/          # Owner dashboard (5 files)
│   │       ├── EnhancedOwnerDashboard.tsx
│   │       ├── BillingDashboard.tsx
│   │       └── AnalyticsDashboard.tsx
│   │
│   ├── 📁 components/               # Reusable UI components (170 files)
│   │   ├── 📁 admin/                # Admin-specific components
│   │   ├── 📁 auth/                 # Authentication components
│   │   ├── 📁 common/               # Shared components (modals, toasts, etc.)
│   │   ├── 📁 layout/               # Layout components (headers, routes)
│   │   ├── 📁 owner/                # Owner-specific components
│   │   └── 📁 shared/               # Cross-feature components
│   │
│   ├── 📁 services/                 # Business logic & Firebase calls (131 files)
│   │   ├── firebase.ts              # Firebase initialization
│   │   ├── roomCardService.ts       # Check-in/out operations
│   │   ├── requestService.ts        # Request management
│   │   ├── ownerService.ts          # Owner operations
│   │   ├── systemConfigsService.ts  # API keys management
│   │   ├── imageUploadService.ts    # Image upload (ImgBB/Firebase)
│   │   └── ...                      # Other services
│   │
│   ├── 📁 context/                  # React Context providers (9 files)
│   │   ├── AuthContext.tsx          # Authentication state
│   │   ├── TenantContext.tsx         # Tenant isolation
│   │   └── I18nContext.tsx          # Internationalization
│   │
│   ├── 📁 hooks/                     # Custom React hooks (28 files)
│   │   ├── useTenantData.ts
│   │   ├── useRequests.ts
│   │   └── ...
│   │
│   ├── 📁 types/                     # TypeScript interfaces (11 files)
│   │   ├── index.ts
│   │   ├── room.ts
│   │   └── request.ts
│   │
│   ├── 📁 utils/                     # Utility functions (40+ files)
│   │   ├── encryption.ts
│   │   ├── exportUtils.ts
│   │   └── ...
│   │
│   ├── 📁 locales/                   # Translation files (4 files)
│   │   ├── ar.json                   # Arabic
│   │   ├── en.json                   # English
│   │   ├── hi.json                   # Hindi
│   │   └── bn.json                   # Bengali
│   │
│   ├── 📁 repositories/              # Data access layer (6 files)
│   │   └── 📁 firebase/              # Firebase repositories
│   │
│   ├── 📁 styles/                     # Global styles (5 files)
│   │   └── theme-system.css
│   │
│   ├── App.tsx                       # Main app component
│   ├── AppRoutes.tsx                 # Route definitions
│   ├── main.tsx                      # Entry point
│   └── i18n.ts                       # i18n configuration
│
├── 📁 functions/                      # Cloud Functions (Backend)
│   ├── 📁 src/
│   │   ├── 📁 data/
│   │   │   └── roomOperations.ts     # processCheckIn, checkRoomAvailability
│   │   ├── 📁 auth/
│   │   │   ├── customClaims.ts
│   │   │   └── loginHandler.ts
│   │   ├── 📁 admin/
│   │   │   └── managerCreation.ts
│   │   ├── 📁 security/
│   │   │   └── rateLimiter.ts
│   │   └── index.ts                  # Functions exports
│   └── 📁 lib/                       # Compiled JavaScript
│
├── 📁 docs/                          # Documentation
│   ├── 📁 guides/                    # Developer guides
│   │   ├── START_HERE.md
│   │   ├── DEVELOPER_ONBOARDING_GUIDE.md
│   │   └── ...
│   ├── 📁 schemas/                   # Database schemas
│   │   └── FIRESTORE_SCHEMA.md
│   └── 📁 roadmaps/                  # Future plans
│
├── 📁 project_history/               # Historical reports & archives
│   ├── 📁 reports/                   # Completed reports
│   ├── 📁 i18n/                      # i18n reports
│   └── 📁 phases/                     # Phase reports
│
├── 📁 public/                        # Static assets
│   ├── icons/
│   └── manifest.json
│
├── 📁 scripts/                        # Build & deployment scripts
│   ├── deploy.sh
│   └── deploy.bat
│
├── 📄 firestore.rules                 # Firestore security rules
├── 📄 storage.rules                   # Storage security rules
├── 📄 firestore.indexes.json          # Firestore indexes
├── 📄 firebase.json                   # Firebase configuration
├── 📄 package.json                    # Dependencies
├── 📄 tsconfig.json                   # TypeScript config
├── 📄 vite.config.ts                  # Vite configuration
├── 📄 tailwind.config.js              # Tailwind CSS config
├── 📄 .env.example                    # Environment variables template
├── 📄 README.md                       # Main README
└── 📄 README_REVIEW.md                # Technical review documentation
```

---

## Key Directories Explained

### `src/features/`
Page-level components organized by feature/role. Each dashboard is self-contained.

### `src/services/`
Business logic layer. All Firebase operations happen here. No direct DB calls in components.

### `src/components/`
Reusable UI components shared across features.

### `src/context/`
Global state management (Auth, Tenant, i18n).

### `functions/src/`
Cloud Functions backend. Implements Master Key pattern for security.

---

**Total Files:** ~540 TypeScript/TSX files  
**Lines of Code:** ~50,000+  
**Languages:** TypeScript, JavaScript, JSON, CSS
