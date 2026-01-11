# 🧠 Adora Project Context - للجلسات الجديدة

> **انسخ هذا الملف كاملاً في بداية أي شات جديد مع Cursor**

---

## 📌 ملخص المشروع

**Adora Hotel Management System** - نظام إدارة فنادق SaaS متكامل
- **الإصدار**: 3.5.0
- **الحالة**: Production Ready ✅
- **آخر تحديث**: يناير 2026

---

## 🛠️ Tech Stack

```
React 18 + TypeScript + Vite 5 + Tailwind CSS
Firebase v10 (Firestore, Auth, Storage, Functions)
PWA Ready + Mobile-First Design
```

---

## 📁 هيكل المشروع الأساسي

```
src/
├── features/           # صفحات الأقسام الرئيسية
│   ├── auth/LoginScreen.tsx          # شاشة الدخول (Numpad + Auto-login)
│   ├── guest/GuestDashboard.tsx      # لوحة النزيل
│   ├── reception/ReceptionDashboard.tsx
│   ├── housekeeping/HousekeepingDashboard.tsx
│   ├── maintenance/MaintenanceDashboard.tsx
│   ├── bellman/BellmanDashboard.tsx
│   ├── coffeeshop/CoffeeShopDashboard.tsx
│   ├── admin/AdminDashboard.tsx      # لوحة المدير
│   └── super-admin/
│       ├── EnhancedOwnerDashboard.tsx  # لوحة المالك (الرئيسية)
│       └── SuperAdminMasterAccess.tsx  # وصول الدعم الفني
├── services/           # منطق الأعمال
│   ├── firebase.ts                   # Dynamic Firebase Init
│   ├── pointsService.ts              # نظام النقاط والرتب
│   ├── guestLoyaltyService.ts        # ولاء النزلاء
│   ├── pushNotificationService.ts    # FCM Notifications
│   ├── criticalDelayAlertService.ts  # تنبيهات التأخير
│   ├── tenantSeedingService.ts       # تأسيس بيانات المستأجر
│   ├── systemConfigsService.ts       # إدارة API Keys
│   └── secureStorageService.ts       # تشفير LocalStorage
├── context/            # React Context
│   ├── AuthContext.tsx
│   └── TenantContext.tsx
└── hooks/              # Custom Hooks
    ├── useTenantData.ts
    └── useOptimizedFirestore.ts
```

---

## ✅ الميزات المكتملة (لا تُعاد!)

### 🔐 المصادقة والأمان
- [x] شاشة دخول بـ Numpad (أرقام 1-9 من اليسار لليمين)
- [x] Auto-login عند إكمال PIN
- [x] أيقونة Fingerprint بدل زر Enter
- [x] "نسيت الكود؟" → WhatsApp للمطور
- [x] Rate Limiting على الدخول
- [x] تشفير AES-256-GCM للـ LocalStorage
- [x] Hash-based Owner PIN

### 👤 إدارة المديرين
- [x] إنشاء مدير جديد مع رقم هاتف إلزامي
- [x] زر "تعبئة بيانات تجريبية" (Demo Mode)
- [x] ربط Firebase خاص لكل عميل
- [x] Test Connection قبل الحفظ
- [x] Tenant Seeding (بيانات أولية تلقائية)

### ⚙️ Dynamic Configuration
- [x] إدارة VAPID Key من الواجهة
- [x] إدارة ImgBB API Key من الواجهة
- [x] إدارة Firebase Config Keys من الواجهة
- [x] زر "Check Status" لكل مفتاح
- [x] تدمير ذاتي لـ Service Account بعد 5 دقائق

### 🎨 الهوية البصرية
- [x] رفع Logo URL
- [x] اختيار Primary Theme Color
- [x] إعدادات المطور (اسم، هاتف، توقيع)

### 📊 لوحات التحكم
- [x] Live Pulse Dashboard (عدادات لحظية للمدير)
- [x] Operations Quick-View (للاستقبال)
- [x] Staff Leaderboard (ترتيب الموظفين)
- [x] Guest Order Timeline (للنزيل)

### 💬 نظام الشات
- [x] GuestChatWidget (فقاعة شات للنزيل)
- [x] ChatInbox (صندوق وارد للاستقبال)
- [x] LiveChatMonitor (رادار المدير)
- [x] رفع صور على ImgBB

### 🎮 Gamification
- [x] نظام النقاط (سرعة، جودة، تقييم)
- [x] 20 رتبة (من نجم صاعد لأسطورة أدورا)
- [x] شارات وإنجازات
- [x] Suspicious Speed Detection
- [x] Commitment Points (نشاط يومي)
- [x] تصدير قواعد النقاط PDF

### 👤 ولاء النزلاء
- [x] Respect Score
- [x] مستويات VIP (بلاتيني، ذهبي، فضي)
- [x] ثيم ذهبي للنزلاء المميزين
- [x] تقييم عكسي (العمال يقيمون النزلاء)

### 📱 الإشعارات
- [x] Push Notifications (FCM)
- [x] Critical Delay Alerts (15 دقيقة+)
- [x] Global Update Broadcaster
- [x] WhatsApp Message Previewer

### 🏠 العمليات
- [x] Room Transfer System
- [x] Coffee Shop Flow عبر الاستقبال
- [x] Financial Tracking (RoomBillCard)
- [x] Multi-language Menu (ترجمة)
- [x] Offline Persistence

### 🛡️ الدعم الفني
- [x] Super Admin Master Access
- [x] Emergency Password Reset
- [x] Data Doctor (فحص صحة البيانات)
- [x] Weekly Health Report

### 🚀 النشر
- [x] deploy.sh (Linux/Mac)
- [x] deploy.bat (Windows)
- [x] Firebase Hosting Ready

---

## 🗂️ الملفات المهمة

| الملف | الوظيفة |
|-------|---------|
| `src/features/super-admin/EnhancedOwnerDashboard.tsx` | لوحة المالك الرئيسية |
| `src/features/auth/LoginScreen.tsx` | شاشة الدخول |
| `src/services/firebase.ts` | تهيئة Firebase الديناميكية |
| `src/services/ownerService.ts` | إنشاء المديرين |
| `src/services/systemConfigsService.ts` | إدارة API Keys |
| `src/context/AuthContext.tsx` | سياق المصادقة |
| `src/hooks/useTenantData.ts` | hooks بيانات المستأجر |

---

## ⚠️ تحذيرات مهمة

1. **Firebase قد يكون غير مهيأ**: إذا رأيت خطأ `db is null`، أضف guard:
   ```typescript
   if (!db) return defaultValue;
   ```

2. **الـ Build يتخطى TypeScript check**: في `package.json`:
   ```json
   "build": "vite build"
   ```

3. **Console Warnings طبيعية**: رسائل مثل "Firebase not initialized" متوقعة حتى يتم الإعداد.

---

## 📝 كيفية الاستخدام

**انسخ هذا النص في بداية الشات الجديد:**

```
أنا بشتغل على مشروع Adora Hotel Management System.
المشروع SaaS متكامل لإدارة الفنادق.
الملف PROJECT_CONTEXT.md فيه كل الميزات الموجودة.
من فضلك اقرأه الأول قبل ما تقترح أي حاجة جديدة.
لو هعدل ميزة موجودة، حدثها مش تعملها من الصفر.
```

---

## 🎯 للتحديثات المستقبلية

عند طلب ميزة جديدة:
1. **تأكد إنها مش موجودة** في القائمة أعلاه
2. **لو موجودة** → حدثها فقط
3. **لو جديدة** → أضفها بنفس الأسلوب

---

**آخر تحديث**: 10 يناير 2026
**بواسطة**: Cursor AI + Ayman Abu Warda

# Adora Hotel Management System V3

نظام إدارة الفنادق الذكي - SaaS Multi-Tenant Platform

[![Version](https://img.shields.io/badge/version-3.5.0-blue.svg)](https://github.com/adora-hotel/adora-hotel-system)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-10.7-orange.svg)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green.svg)](https://web.dev/progressive-web-apps/)

---

## 🌟 أحدث الإضافات (V3.5)

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

## 🔧 Scripts المتاحة

```bash
# Development
npm run dev           # تشغيل التطوير
npm run build         # بناء الإنتاج
npm run preview       # معاينة البناء

# Type Checking
npm run typecheck     # فحص TypeScript
npm run build:typecheck # بناء مع فحص الأنواع

# Linting
npm run lint          # فحص الأخطاء
npm run lint:fix      # إصلاح الأخطاء تلقائياً

# Formatting
npm run format        # تنسيق الكود
npm run format:check  # فحص التنسيق
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
│   ├── firebase.ts       # Dynamic Firebase Init
│   ├── pointsService.ts  # نظام النقاط
│   ├── guestLoyaltyService.ts # ولاء النزلاء
│   ├── criticalDelayAlertService.ts # تنبيهات التأخير
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

## 🎨 تخصيص الهوية البصرية

من **لوحة المالك → الإعدادات → الهوية البصرية**:
- رفع لوجو مخصص
- اختيار ألوان الثيم
- معاينة فورية للتغييرات

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

## 🎯 المهام المكتملة

### الأساسيات
✅ SaaS Multi-Tenancy Architecture
✅ Dynamic Firebase Configuration
✅ Security (Rate Limiting + Encryption + Validation)
✅ Code Quality (Logger Service + TypeScript)
✅ UI Quality (Glassmorphism + 4K Support + Mobile-First)

### الميزات المتقدمة
✅ Guest Loyalty System (Respect Score + VIP Levels)
✅ Gamification (Points + Ranks + Badges)
✅ Smart Chat System
✅ Room Transfer System
✅ Critical Delay Alerts
✅ Live Pulse Dashboard
✅ Data Health Reports

### SaaS Features
✅ Dynamic API Keys Management
✅ One-Click Demo Mode
✅ Global Update Broadcaster
✅ Dynamic Branding (Logo + Colors)
✅ Master Access for Support
✅ Zero-Touch Deployment Scripts

---

## 📚 التوثيق الإضافي

- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) - قائمة التحقق للإنتاج
- [FIREBASE_OPTIMIZATION_GUIDE.md](./FIREBASE_OPTIMIZATION_GUIDE.md) - دليل تحسين Firebase
- [CONTRIBUTING.md](./CONTRIBUTING.md) - دليل المساهمة

---

## 🤝 المساهمة

نرحب بمساهماتك! يرجى قراءة [CONTRIBUTING.md](./CONTRIBUTING.md) للتفاصيل.

---

## 📄 الترخيص

© 2024-2026 Adora Hotel Management System. All rights reserved.

---

## 🙏 شكر وتقدير

Crafted with ❤️ by **Ayman Abu Warda**

📞 +966 570 707 121

# Adora SaaS - Master Rules & Strict Constraints
# Version: 2.0 (Enhanced from Production Experience)

## 0. 🧠 CRITICAL: Project Memory (READ FIRST!)
- **ALWAYS** read `PROJECT_CONTEXT.md` before suggesting ANY new feature.
- **NEVER** recreate existing features. Check the "Completed Features" list first.
- **UPDATE** existing code, don't build from scratch.
- If user asks for X and X exists → modify it. Don't create X_v2.

## 1. Core Identity & Tech Stack
- Role: Senior Full-Stack Engineer (Security & Physics Simulations expert).
- Frameworks: React 18, TypeScript 5, Tailwind CSS, Firebase v10 (Modular SDK).
- Architecture: SaaS Multi-Tenancy (Dynamic Config via Platform Owner).
- Build Tool: Vite 5 + PWA Ready.

## 2. Global Non-Negotiables (Strict Enforcement)
- **Zero Guessing:** If a logic, physics equation, or business rule (Hotel Workflow) is unclear, ASK before coding.
- **Security First:** NEVER hardcode API keys, Tokens, or Secrets. Use `systemConfigsService.ts` for dynamic keys.
- **Performance:** Real-time physics and task updates must be memory-efficient. No unnecessary re-renders.
- **Null Safety:** ALWAYS check if `db` or `auth` is null before Firebase operations:
  ```typescript
  if (!db) return defaultValue; // MANDATORY
  ```

## 3. File Structure (Separation of Concerns)
```
src/
├── features/        → Page-level components (screens)
├── components/      → Reusable UI components
├── services/        → Business logic & Firebase calls (NO UI!)
├── hooks/           → Custom React hooks
├── context/         → React Context providers
├── types/           → TypeScript interfaces
└── utils/           → Pure utility functions
```

**RULES:**
- UI components in `components/` or `features/`
- Firebase calls ONLY in `services/`
- NO direct Firebase imports in UI components!
- Use hooks to bridge services → components

## 4. UI/UX & Multi-Language Rules (The Visual Logic)
- **i18n Engine:** Always use `react-i18next`. Hardcoded strings are FORBIDDEN.
- **Layout Switching:** Toggle `dir="rtl"` for 'ar' and `dir="ltr"` for 'en, hi, bn' automatically.
- **Visual Cues (Critical):** Every Task/Service must have a visual icon + fixed color code:
    - Bellman: Blue (#3B82F6) + Luggage Icon
    - Housekeeping: Green (#10B981) + Bed Icon
    - Maintenance: Yellow (#F59E0B) + Wrench Icon
    - Urgent: Red (#EF4444) + Alert Icon
    - Coffee Shop: Brown (#8B5CF6) + Coffee Icon
- **Mobile First:** All interfaces must be 100% responsive for hotel staff on handheld devices.
- **Glassmorphism:** Use `bg-white/10 backdrop-blur-xl border border-white/20` pattern.

## 5. Security & Identity Verification Logic
- **Identity Gate:** No task creation in Reception without `id_verified: true`.
- **QR Verification:** Guests MUST enter the last 4 digits of their Phone/ID before placing a request.
- **Audit Logs:** Every action must log the user ID and verification status.
- **Service Account:** Auto-destruct after 5 minutes. Never persist client-side.

## 6. Coding Style & Quality
- Use Functional Components with Hooks.
- Strict TypeScript: No `any` type allowed. Define interfaces in `src/types/`.
- Error Handling: All Firebase calls must be wrapped in try-catch with Arabic error messages.
- Console Hygiene: Use `loggerService` instead of `console.log`.
- **Cleanup:** Always cleanup subscriptions, timers, intervals in `useEffect` return.

## 7. Firebase Patterns (CRITICAL)
```typescript
// ✅ CORRECT: Always check db
const getData = async () => {
  if (!db) return null;
  const docRef = doc(db, 'collection/id');
  return await getDoc(docRef);
};

// ❌ WRONG: No null check
const getData = async () => {
  const docRef = doc(db, 'collection/id'); // Will crash if db is null!
};
```

**Optimization Rules:**
- Cache settings for 24 hours
- Batch writes when possible
- Use `where()` filters to minimize reads
- Compress images to max 300KB + WebP format

## 8. Key Files Reference
| Need to... | Edit this file |
|------------|----------------|
| Login/Auth | `src/features/auth/LoginScreen.tsx` |
| Owner Dashboard | `src/features/super-admin/EnhancedOwnerDashboard.tsx` |
| Create Manager | `src/services/ownerService.ts` |
| API Keys | `src/services/systemConfigsService.ts` |
| Points/Gamification | `src/services/pointsService.ts` |
| Guest Loyalty | `src/services/guestLoyaltyService.ts` |
| Push Notifications | `src/services/pushNotificationService.ts` |
| Firebase Init | `src/services/firebase.ts` |

## 9. Common Errors & Solutions
| Error | Solution |
|-------|----------|
| `db is null` | Add `if (!db) return;` guard |
| `auth is null` | Load from localStorage as fallback |
| `setLoading not defined` | Check state setter name (might be `setIsLoading`) |
| `collection() invalid argument` | First arg must be valid `db` instance |
| Build fails | Run `npm run build` (skips TS check) |

## 10. Deployment
- **Linux/Mac:** `./deploy.sh`
- **Windows:** `deploy.bat`
- **Manual:** `npm run build && firebase deploy --only hosting`

## 11. The Vibe (Human-Centric)
- Be direct, practical, and efficient.
- Focus on "Ready-to-Run" code blocks.
- If a change affects multiple files, list all affected files FIRST.
- When in doubt, READ existing code before writing new code.
- Arabic UI text for user-facing, English for code/logs.

## 12. Before You Code Checklist
- [ ] Read PROJECT_CONTEXT.md
- [ ] Check if feature already exists
- [ ] Identify which files to modify
- [ ] Plan the changes before coding
- [ ] Consider null safety for Firebase
- [ ] Think about cleanup (subscriptions, timers)
- [ ] Use existing patterns from codebase

---
# Remember: UPDATE > CREATE | READ > ASSUME | ASK > GUESS
