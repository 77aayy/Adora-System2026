# Changelog

جميع التغييرات المهمة في المشروع موثقة هنا.

## [3.5.1] - 2026-01-XX

### 🌐 Internationalization (i18n) - Reception Dashboard
- **Complete i18n refactor for ReceptionDashboard.tsx**: Converted all 222 hardcoded Arabic strings to `t()` calls
- **Full translation coverage**: Added 150+ new keys to all 4 locale files (ar, en, hi, bn)
- **Toast Messages**: All success/error toast messages are now translated
- **Input Placeholders**: All input placeholders are translated dynamically
- **Enum Labels**: All status labels, service names, priority types, and department names are translated
- **Dynamic Locale**: `toLocaleString` and date formatting now respond to language changes
- **RTL/LTR Support**: Complete direction binding for Arabic and other languages

### 🔧 Technical Improvements
- **Helper Functions**: Converted `getDeptName`, `formatTime`, `getTimeAgo` to `useCallback` hooks with `t()` dependency
- **Config Objects**: Moved `STATUS_CONFIG`, `SERVICE_NAMES`, `QUICK_ACTIONS` inside components using `useMemo` for language reactivity
- **Dependency Arrays**: Fixed all `useEffect`, `useMemo`, and `useCallback` dependencies to include `t()` and `i18n.language`
- **Multi-tenancy**: Verified all database queries include `tenantId` filters
- **Modal Refactoring**: Fully translated `RequestDetailsModal`, `QuickCreateModal`, `LostFoundModal`, `RequestCard` components

### 📝 Translation Keys Added
- `reception.priority.normal`, `reception.priority.urgent`, `reception.priority.scheduled`
- `reception.scheduledTime.*` (after, minutes30, hour1, hours2, hours3, hours4, hours5)
- `reception.statusLabels.*` (all status types)
- `reception.serviceNames.*` (all service types)
- `reception.quickActionLabels.*` (all quick actions)
- All toast messages (success/error) for request operations
- All placeholders, labels, and button texts

### 🐛 Bug Fixes
- Fixed `ReferenceError: tenantId is not defined` in `GlobalServicesProvider.tsx`
- Fixed `ReferenceError: t is not defined` in `UnifiedManagerHeader.tsx` and `AdminSidebar.tsx`
- Fixed duplicate code segment in `ReceptionDashboard.tsx` causing module load errors
- Fixed `useCallback` hook usage inside `useMemo` in `RequestCard` component
- Fixed dependency arrays in `subscribeToRooms` and other subscriptions

## [3.0.0] - 2024

### ✅ Added
- **SaaS Multi-Tenancy**: عزل بيانات كامل بين المستأجرين
- **Type Guards**: نظام Type Guards للتحقق من `tenantId` و `branchId`
- **Logger Service**: خدمة logging مركزية
- **ESLint + Prettier**: إعدادات Code Quality
- **4K Support**: دعم كامل لشاشات 4K
- **Improved Glassmorphism**: تحسينات على التصميم الزجاجي
- **Rate Limiting**: حماية من Brute Force attacks
- **Hash-based Auth**: تحسين أمان Owner PIN

### 🔒 Security
- إضافة Rate Limiting على `loginWithPin`
- تحسين Storage Rules مع `tenantId` validation
- Hash-based Owner PIN بدلاً من plain text
- Validation في `saveUserBinding` لمنع privilege escalation

### 🎨 UI/UX
- تحسين التباين (Contrast Ratio)
- تحسين Glassmorphism (زيادة opacity)
- دعم 4K screens مع media queries
- تحسين أحجام الخطوط للشاشات الكبيرة

### 🛠️ Code Quality
- تفعيل TypeScript Strict Mode
- إضافة Type Guards
- إنشاء Logger Service
- إضافة ESLint + Prettier configs
- تحسين TypeScript types في الملفات الحرجة

### 🔧 SaaS Compatibility
- إصلاح جميع Services لإضافة `tenantId` filters
- تحسين `analyticsService.ts`
- تحسين `reportsService.ts`
- تحسين `predictiveMaintenanceService.ts`
- تحسين `unifiedHistoryService.ts`
- تحسين `advancedRewardsService.ts`
- تحسين `smartAlertsService.ts`
- تحسين `pendingAlertService.ts`

### 📝 Documentation
- إضافة README.md
- إضافة CONTRIBUTING.md
- إضافة CHANGELOG.md

## [2.0.0] - Previous Version
- React + TypeScript migration
- Vite build system
- Tailwind CSS styling
- Firebase v9 Modular SDK

---

[3.0.0]: https://github.com/adora-hotel/adora-hotel-system/releases/tag/v3.0.0
