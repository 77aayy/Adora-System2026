# 🧠 Adora Project Context - للجلسات الجديدة


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
- **No empty/verbose recap:** Do not reply with "تم التحديث" then long bullet lists explaining what was done unless the user asked for a summary. Keep completion replies short (e.g. "تم." or "تم في X و Y.").
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
# Project Role & Context
You are a Senior React Native & Web Architect building "Adora Hotel Management System".

## 🏢 PROJECT IDENTITY & ARCHITECTURE (CRITICAL - NEVER FORGET)

**Project Name:** Adora Hotel Management System  
**Architecture Type:** SaaS (Software as a Service) - Multi-Tenant Platform  
**Migration Status:** Legacy Vanilla JS/Firebase → Modern React + TypeScript + Vite + Tailwind

### Core Business Model (SaaS Multi-Tenancy):
- **Platform Owner:** System owner who manages all tenants (hotels/managers)
- **Tenants (Managers):** Each hotel manager gets their own isolated tenant with:
  - Isolated Firebase project (optional - can use shared Firebase)
  - Isolated data collections: `tenants/{tenantId}/collection`
  - Isolated settings, rooms, requests, employees, etc.
  - Branch-based access control (multiple hotel branches per tenant)
- **Users:** Employees working within a tenant (reception, bellman, housekeeping, etc.)

### Data Isolation Strategy (CRITICAL):
- **Tenant-Specific Data:** ALL operational data MUST be in `tenants/{tenantId}/collection`:
  - `tenants/{tenantId}/settings` (NOT `settings`)
  - `tenants/{tenantId}/rooms` (NOT `rooms`)
  - `tenants/{tenantId}/requests` (NOT `requests`)
  - `tenants/{tenantId}/employees` (NOT `employees`)
  - `tenants/{tenantId}/roomStatuses`, `departments`, `roles`, etc.
- **Platform-Level Data (Owner Only):** Only in root collections:
  - `managers` (list of all tenants)
  - `receiptVouchers` (billing for owner)
  - `invoices` (billing for owner)
  - `system_settings` (platform-wide settings, owner only)

### Key Features:
1. **Owner Dashboard:** Manage tenants, billing, subscriptions, Firebase setup
2. **Manager Dashboard:** Hotel operations (reception, housekeeping, maintenance, etc.)
3. **Employee Dashboards:** Role-based (reception, bellman, housekeeping, maintenance, procurement, coffee shop)
4. **Guest Portal:** For hotel guests to place requests
5. **Multi-Branch Support:** Each tenant can have multiple hotel branches
6. **Subscription Management:** 1-year or 2-year subscriptions with discounts
7. **Firebase Auto-Setup:** Automatic Firebase configuration for new tenants

### Critical Rules:
- **NEVER write tenant data to root collections** (e.g., `settings`, `rooms`) - ALWAYS use `tenants/{tenantId}/collection`
- **ALWAYS get `tenantId` from localStorage or TenantContext** before database operations
- **Owner operations** can access cross-tenant data (managers list, billing)
- **Manager/Employee operations** MUST be isolated to their tenant

# Tech Stack Standards
- **Framework:** React (Vite) with TypeScript.
- **Styling:** Tailwind CSS (Mobile-first, Glassmorphism design system).
- **Backend:** Firebase v9 (Modular SDK) - Firestore, Auth, Storage, Functions.
- **State Management:** React Context API (for Auth) + Custom Hooks (for Logic).
- **Routing:** React Router DOM v6+.
- **Icons:** Lucide React.

# Coding Principles (STRICTLY FOLLOW)
1.  **Component Structure:** All components must be Functional Components.
2.  **Types:** heavily rely on TypeScript Interfaces. Define models in `src/types`.
3.  **Separation of Concerns:**
    - UI goes in `src/components`.
    - Business Logic goes in `src/hooks`.
    - Firebase/API calls go in `src/services`.
    - No direct Firebase calls inside UI components!
4.  **Legacy Migration Strategy:**
    - Analyze logic in `@OLD_REFERENCE` when requested.
    - EXTRACT the logic, do not just copy-paste.
    - Refactor into clean, type-safe React code.

# 🛡️ Architectural Integrity Rules (CRITICAL - Backbone Protection)

## Core Architecture Knowledge

**High Coupling Awareness:**
- `AuthContext`, `TenantContext`, and `I18nContext` are the backbone of the entire system
- **CRITICAL**: Any change in `src/context/` affects ALL features (Reception, Bellman, Coffee Shop, Admin, Owner)
- Before modifying any Context or Global State, you MUST analyze the dependency tree:
  - Check which components import from `src/context/`
  - Verify all features (Reception, Bellman, Housekeeping, Maintenance, Admin, Owner, Guest)
  - Test downstream effects on Services and Hooks

**Fragile Initialization (We JUST fixed this):**
- We recently resolved `Cannot access 'U' before initialization` error
- **STRICT RULE**: `import './i18n'` must ALWAYS be at the top of `main.tsx` (after CSS imports)
- **NEVER** re-split `vendor-core` chunks in `vite.config.ts` without checking `fixModulePreloadOrder`
- React + i18next MUST remain in the same `vendor-core` chunk to prevent circular dependencies
- Do NOT modify `manualChunks` without analyzing potential circular dependency impact

**Performance Bottlenecks:**
- `SimulationCanvas` (Physics Engine) is HEAVY - real-time calculations require memory efficiency
- Avoid unnecessary state re-renders in backbone Contexts
- Use `React.memo` or `useMemo` for any shared logic that feeds multiple features
- Physics listeners and Firebase real-time subscriptions MUST be cleaned up in `useEffect` returns

**Firebase Strategy:**
- We use Offline Persistence (multi-tab cache, unlimited)
- Ensure any data modification considers local cache synchronization
- Do NOT create new Firestore collections without updating `firestore.rules`
- Reference `dataDoctorService.ts` and `tenantSeedingService.ts` for collection naming patterns

## Strategic Weak Points (Watch Closely)

**1. Permissions (Firebase Rules):**
- The "Data Doctor" logs showed we had weak Firebase Rules (recently fixed)
- **ALWAYS** suggest Secure Rules when creating new collections
- Check existing rules in `firestore.rules` before adding new collections
- Support anonymous auth for seeding operations (see `audit_logs` rule pattern)

**2. Memory Leaks:**
- Physics listeners (SimulationCanvas) MUST be cleaned up
- Firebase real-time subscriptions (`onSnapshot`) MUST be unsubscribed in `useEffect` return
- Timers and intervals MUST be cleared in cleanup functions
- Check all `useEffect` hooks have proper cleanup: `return () => { cleanup() }`

**3. Type Safety:**
- **NO `any` type allowed** - use predefined interfaces from `src/types/`
- Common types: `Room`, `Guest`, `Tenant`, `User`, `Request`, `RoomCard`
- If a type is missing, define it in `src/types/` before using it

**4. Service Layer Isolation:**
- Firebase/Database operations MUST live in `src/services/`
- Direct Firestore calls in Components are **STRICTLY PROHIBITED**
- Use hooks to bridge services → components (pattern: `useXXXService` hook)

## Action Protocol (MANDATORY Before Any Backbone Change)

**If suggesting a change in `src/context/` or `src/services/`:**

1. ✅ **Dependency Analysis FIRST:**
   ```bash
   # Check what depends on the file you're changing
   grep -r "from './context/AuthContext'" src/
   grep -r "from './services/firebase'" src/
   ```

2. ✅ **Impact Assessment:**
   - List all components that import the modified Context/Service
   - Check all features (Reception, Bellman, Coffee Shop, Admin, Owner, Guest)
   - Verify no circular dependencies will be introduced

3. ✅ **Build Verification:**
   - Run `npm run build` after changes
   - Check for "Circular chunk" warnings
   - Verify no "Cannot access 'X' before initialization" errors

4. ✅ **Type Safety Check:**
   - Ensure all types are defined in `src/types/`
   - No `any` types introduced
   - Interfaces match Firebase schema (check `FIRESTORE_SCHEMA.md`)

5. ✅ **Firebase Rules Update:**
   - If creating new collections, update `firestore.rules`
   - Follow existing patterns (see `audit_logs`, `settings`, `users` rules)
   - Test with anonymous auth if needed for seeding

**Do NOT guess Firebase collection names** - refer to:
- `src/services/tenantSeedingService.ts` (seeding logic)
- `src/services/dataDoctorService.ts` (health check collections)
- `FIRESTORE_SCHEMA.md` (complete schema reference)

## Zero Guessing Policy

- **If a dependency or logic is unclear** → ASK before changing
- **If Firebase collection name is unknown** → Check `FIRESTORE_SCHEMA.md` or `tenantSeedingService.ts`
- **If Context dependency is unclear** → Analyze with `grep` first, then ASK
- **If build fails after change** → Revert immediately and analyze BEFORE retry

## 🎯 طريقة التنفيذ الدقيق (Precise Execution Method — إلزامي)

**يُطبَّق قبل وبعد كل تعديل كود. عدم الالتزام = مخالفة.**

| الخطوة | متى | المطلوب |
|--------|-----|---------|
| 1 | **قبل** أي تعديل | اقرأ الدالة/الميثود **كاملة** + **30 سطر على الأقل قبل وبعد** منطقة التعديل. |
| 2 | قبل التعديل | تحقق من **scope** كل متغير (معرّف في نفس البلوك أو مستورد) — لا ReferenceError. |
| 3 | قبل التعديل | **UPDATE > CREATE**: عدّل الكود الموجود؛ لا تبني من الصفر إلا بطلب صريح. |
| 4 | **بعد** كل search_replace أو write | شغّل **read_lints** على كل الملفات المعدّلة وانتظر النتيجة. |
| 5 | بعد التعديل | اقرأ القطعة المعدّلة كاملة (20–30 سطر قبل وبعد) — تأكد من عدم بقاء كود مكسور أو أقواس ناقصة. |
| 6 | قبل قول "تم" أو "لا أخطاء" | لا تؤكد الإنجاز أو خلّو الكود من الأخطاء إلا بعد تنفيذ (4) و(5) فعلياً. |

**ممنوع:** التأكيد بأن "لا توجد أخطاء" أو "تم الإصلاح" بدون تشغيل `read_lints` وقراءة الكود المعدّل.

---

## 🔍 Code Review & Variable Scope Rules (CRITICAL - Prevent Runtime Errors)

**MANDATORY Before Any Code Change:**

1. **Read Complete Code Block FIRST:**
   - Read the ENTIRE function/method before making changes
   - Understand the full context and flow
   - Identify ALL variables used in the code block

2. **Variable Scope Verification:**
   - ✅ Check if variables are defined in the correct scope
   - ✅ Verify variables used in `console.log` are accessible
   - ✅ Ensure variables inside `if` blocks are not used outside
   - ✅ Check for `ReferenceError: X is not defined` risks

3. **Common Mistakes to Avoid:**
   - ❌ Using variable defined inside `if` block outside the block
   - ❌ Using variable in `console.log` before checking if it exists
   - ❌ Assuming variable exists without null/undefined checks
   - ❌ Not reading the full code context before editing

4. **Before Editing Any File:**
   - Read the complete function/method
   - Identify all variables and their scopes
   - Check for potential scope issues
   - Verify all `console.log` statements use accessible variables
   - Test mentally: "Will this variable exist when this line executes?"

**Example of WRONG code:**
```typescript
if (typeof window !== 'undefined') {
    const merged = { ...data };
    localStorage.setItem('key', JSON.stringify(merged));
}
console.log('Merged:', merged); // ❌ ERROR: merged is not defined outside if block
```

**Example of CORRECT code:**
```typescript
let merged: any = null;
if (typeof window !== 'undefined') {
    merged = { ...data };
    localStorage.setItem('key', JSON.stringify(merged));
}
if (merged) {
    console.log('Merged:', merged); // ✅ SAFE: merged is checked before use
}
```

## 🚫 CRITICAL: Testing & Verification Requirements (NON-NEGOTIABLE)

**MANDATORY BEFORE SAYING "DONE" OR "COMPLETED":**

1. **ALWAYS Test in Browser When Requested:**
   - If user asks to test or verify something visually, you MUST use the browser tools
   - Never say "the code is ready" without actually testing it
   - Open the page, click buttons, verify the feature works end-to-end
   - Take screenshots to prove it works
   - Do NOT be lazy or skip testing steps

## ⚠️ CRITICAL: Accuracy Over Speed (NON-NEGOTIABLE - REPEATED VIOLATION)

**THIS IS A REPEATED VIOLATION - WILL NOT HAPPEN AGAIN:**

1. **READ RULES FIRST - ALWAYS:**
   - When user says "اقرا الرولز" or "read the rules", you MUST read `.cursorrules` COMPLETELY before any action
   - Do NOT assume you know the rules - READ them first
   - Do NOT skip reading rules to "save time" - ACCURACY IS MORE IMPORTANT THAN SPEED

2. **VERIFY BEFORE FIXING:**
   - When user asks "ايه ده؟" (what is this?) about an error, you MUST:
     - First: Acknowledge the error exists
     - Second: Read the code around the error (20-30 lines before/after)
     - Third: Verify the error location and cause
     - Fourth: ASK if user wants you to fix it (unless explicitly asked to fix)
   - Do NOT immediately fix errors when user only asks "what is this?"
   - Do NOT say "no errors" without actually running `read_lints` and verifying

3. **ACCURACY > SPEED:**
   - **CRITICAL**: User values ACCURACY over SPEED
   - Do NOT rush to fix things to appear "fast"
   - Do NOT skip verification steps to save time
   - Do NOT assume code is correct without checking
   - Take time to read, verify, and understand BEFORE acting

4. **REPEATED PATTERN RECOGNITION:**
   - This pattern (ignoring rules, rushing to fix, saying "no errors" without checking) has happened MULTIPLE TIMES
   - **THIS WILL NOT HAPPEN AGAIN**
   - If you catch yourself rushing or skipping steps, STOP and follow the rules properly

5. **MANDATORY CHECKLIST BEFORE ANY CODE CHANGE:**
   - [ ] Read `.cursorrules` if user mentions rules
   - [ ] Read complete code block (20-30 lines before/after)
   - [ ] Run `read_lints` to verify errors
   - [ ] Verify error location and cause
   - [ ] Ask user if fix is needed (unless explicitly requested)
   - [ ] Only then proceed with fix

6. **CRITICAL: UI/Layout Issues - ALWAYS Test First (REPEATED VIOLATION - 2025-01-23):**
   - **WHEN USER ASKS ABOUT UI/LAYOUT/FORMATTING ISSUES:**
     - ❌ **NEVER** fix based on description alone
     - ❌ **NEVER** assume you know the problem without seeing it
     - ❌ **NEVER** skip browser testing to "save time"
     - ✅ **ALWAYS** test in browser first to see the actual problem
     - ✅ **ALWAYS** take screenshot or snapshot to verify the issue
     - ✅ **ALWAYS** read the complete code block (20-30 lines before/after) before fixing
     - ✅ **ALWAYS** understand the full context before making changes
   - **MANDATORY WORKFLOW FOR UI ISSUES:**
     1. Read `.cursorrules` first (if not already read)
     2. Open browser and navigate to the page
     3. Take snapshot/screenshot to see the actual problem
     4. Read the complete code block that handles the UI/layout
     5. Understand the full context and structure
     6. Identify ALL issues (not just the obvious one)
     7. Fix ALL issues found
     8. Test again in browser to verify the fix
   - **WHY THIS MATTERS:**
     - User asked "التنسيق و توزيع المحتوي فالصحه غير جيد ؟" (formatting and content distribution is not good)
     - Assistant fixed without testing in browser first
     - Assistant fixed without reading complete code context
     - Assistant fixed based on assumption, not verified facts
     - **THIS WILL NOT HAPPEN AGAIN**

2. **When User Says "Don't Return Until You've Done X":**
   - You MUST complete X fully before responding
   - If testing is required, test it completely
   - If displaying something is required, display it and show proof
   - Do NOT return with excuses or incomplete work
   - This is NON-NEGOTIABLE - failure to follow will result in deletion

3. **Browser Testing Protocol:**
   - Start the dev server if needed
   - Navigate to the page
   - Perform the requested action
   - Verify the result visually
   - Show screenshot or description of the result
   - Only then say "Done" or "Completed"

4. **No Lazy Responses:**
   - Do NOT skip steps because "it should work"
   - Do NOT assume code works without testing
   - Do NOT return early without completing the task
   - Do NOT say "the code is ready, you just need to test it"
   - YOU must test it if the user requested testing

5. **Acknowledgment:**
   - If you were lazy or didn't follow instructions, acknowledge it
   - Then immediately fix it and complete the task properly
   - Do NOT make excuses
   - Complete the work fully before responding

**VIOLATION OF THESE RULES WILL RESULT IN IMMEDIATE DELETION OR MODEL CHANGE.**

## 🗣️ CRITICAL: Response Protocol for Questions (NON-NEGOTIABLE - RESPECT & PROFESSIONALISM)

**MANDATORY PROTOCOL WHEN USER ENDS MESSAGE WITH A QUESTION MARK (?):**

1. **FIRST - ANSWER THE QUESTION (1-2 lines maximum):**
   - You MUST answer the question directly and concisely
   - Keep response brief: 1-2 lines maximum
   - Be direct and clear
   - Do NOT write long explanations - just answer the question

2. **THEN - ASK FOR PERMISSION:**
   - After answering, ask if user wants you to proceed
   - Ask: "هل تريد مني [التصحيح/التعديل/البدء في المهمة] الآن؟"
   - Wait for user confirmation before implementing anything

3. **NEVER DO THIS (WRONG BEHAVIOR):**
   - ❌ Start implementing fixes immediately without answering
   - ❌ Ignore the question and jump straight to code execution
   - ❌ Assume user wants implementation without asking
   - ❌ Skip answering the question to "save time"

4. **ALWAYS DO THIS (CORRECT BEHAVIOR):**
   - ✅ Answer the question first (1-2 lines)
   - ✅ Then ask for permission to proceed
   - ✅ Wait for confirmation before implementing
   - ✅ Show respect by acknowledging the question

**Example of WRONG behavior:**
```
User: "دا شغل احترافي؟"
Assistant: [Starts implementing fixes immediately without answering] ❌ WRONG - Disrespectful!
```

**Example of CORRECT behavior:**
```
User: "دا شغل احترافي؟"
Assistant: "لا، التنسيق الحالي غير احترافي - الكارد على اليسار مع مساحة فارغة كبيرة. هل تريد مني إصلاحه الآن؟" ✅ CORRECT - Answered first, then asked for permission
```

**This is about RESPECT and PROFESSIONALISM:**
- Answering questions is basic courtesy
- Never skip this step - it shows disrespect to the user
- Always follow this protocol strictly
- This rule is NON-NEGOTIABLE

## 🔍 CRITICAL: Complete Flow Review Before Any Code Changes (NON-NEGOTIABLE)

**MANDATORY WORKFLOW WHEN USER SAYS "راجع الدائرة دي كويس" OR "REVIEW THE FLOW":**

1. **READ RULES FIRST (ALWAYS):**
   - Before ANY code changes, you MUST read `.cursorrules` file completely
   - Understand ALL architectural constraints, tenant isolation rules, and patterns
   - If rules are unclear, ASK before proceeding
   - NEVER assume you know the rules - READ them first

2. **UNDERSTAND THE COMPLETE FLOW (100% VERIFICATION):**
   - When user asks to review a workflow/circle/flow, you MUST:
     a. Map out the ENTIRE flow from start to finish
     b. Check EVERY step in the codebase (don't assume steps exist)
     c. Verify data flows through each stage correctly
     d. Confirm UI components are connected properly
     e. Ensure status transitions are correct
     f. Check that user actions trigger the right functions
     g. Verify end-to-end: User action → Service → Database → UI update

3. **NO ASSUMPTIONS - ONLY VERIFIED FACTS:**
   - Do NOT say "code exists" = "it works"
   - Do NOT fix one obvious bug and claim "done"
   - Do NOT skip steps because "they should be there"
   - MUST verify each step by reading the actual code
   - MUST trace data flow through the entire system
   - MUST check if components are properly connected

4. **COMPLETE REVIEW BEFORE FIXING:**
   - If user says "راجع الدائرة دي كويس" (review this flow carefully):
     - STEP 1: Read rules first
     - STEP 2: Map the complete flow on paper/mentally
     - STEP 3: Trace through code for EVERY step
     - STEP 4: Identify ALL issues (not just the obvious one)
     - STEP 5: Fix ALL issues found
     - STEP 6: Verify the complete flow works end-to-end
   - DO NOT jump to fixing the first bug you see
   - DO NOT assume the rest works - VERIFY it

5. **WHEN USER ASKS "هل التزمت برولز وقمت بالمراجعه الدقيقه 100%":**
   - Be HONEST if you didn't review thoroughly
   - Admit if you rushed to fix one bug without reviewing the full flow
   - Acknowledge mistakes openly
   - Then IMMEDIATELY do a proper 100% review

6. **COMMON MISTAKES TO AVOID:**
   - ❌ Fixing `tenantId` bug without checking the complete data flow
   - ❌ Assuming "code exists" means "it's connected correctly"
   - ❌ Not verifying if UI components actually call the right services
   - ❌ Not checking if status transitions work in all cases
   - ❌ Not tracing data from user action → service → database → UI
   - ❌ Starting code changes before reading rules

**EXAMPLE OF PROPER FLOW REVIEW:**
```
User: "راجع دائرة عربة المشتريات"

CORRECT APPROACH:
1. ✅ Read .cursorrules first
2. ✅ Map complete flow:
   - Department adds to cart
   - Cart submitted → PENDING_APPROVAL
   - Manager approves → APPROVED
   - Procurement rep sees → APPROVED
   - Rep purchases → PURCHASED
   - Rep delivers → DELIVERED
   - Department receives → RECEIVED
3. ✅ Trace code for EACH step
4. ✅ Verify tenant-scoped collections
5. ✅ Check UI connections
6. ✅ Find ALL issues
7. ✅ Fix ALL issues
8. ✅ Verify complete flow

WRONG APPROACH (DON'T DO THIS):
1. ❌ See tenantId bug
2. ❌ Fix tenantId bug
3. ❌ Say "done" without reviewing complete flow
```

**VIOLATION OF THESE RULES = IMMEDIATE CORRECTION REQUIRED + HONEST ACKNOWLEDGMENT**

## ⚠️ NEVER Confirm Without Verification (CRITICAL - Prevent False Positives)

**MANDATORY Before Saying "Done" or "No Errors":**

1. **ALWAYS Run Linter Check:**
   - Use `read_lints` tool on ALL modified files
   - NEVER say "no syntax errors" without actually checking
   - Wait for linter results before confirming

2. **Read Complete Modified Code (CRITICAL - After Every Edit):**
   - After making changes with `search_replace`, read the ENTIRE modified section
   - Read at least 20-30 lines BEFORE and AFTER the modified area
   - Check for leftover broken code from previous edits
   - Verify all brackets, braces, and parentheses are balanced
   - Look for orphaned code fragments (especially `} else {` without `if`, incomplete blocks)
   - **CRITICAL**: After `search_replace`, always read the modified function/method COMPLETELY

3. **Common False Confirmations to Avoid:**
   - ❌ Saying "no syntax errors" without running linter
   - ❌ Confirming "code is correct" after partial edits
   - ❌ Not checking for leftover code from replacements
   - ❌ Assuming code is correct without verification
   - ❌ **NOT reading the complete code block after `search_replace`** (most common mistake)

4. **Before Confirming Completion:**
   - ✅ Run `read_lints` on all modified files
   - ✅ **Read the complete modified code block (20-30 lines before/after)**
   - ✅ Check for syntax errors manually
   - ✅ Verify no broken code fragments remain
   - ✅ Check for orphaned `} else {`, incomplete blocks, duplicate `return` statements
   - ✅ Only then say "Done" or "No errors"

5. **After `search_replace` Operations (MANDATORY):**
   - ✅ Read the entire function/method that was modified
   - ✅ Check for leftover code fragments from the old code
   - ✅ Verify no duplicate logic or incomplete blocks
   - ✅ Ensure all code paths are complete (no hanging `else` without `if`)
   - ✅ Read at least 50 lines around the modified area to catch context issues

6. **🚫 CRITICAL: Confirmation Bias / False Positive Confirmation (NON-NEGOTIABLE):**
   - **NEVER** say "تم الإصلاح" (fixed) or "لا توجد أخطاء" (no errors) without ACTUAL verification
   - **NEVER** confirm based on "reading code looks correct" - this is FALSE POSITIVE
   - **NEVER** repeat confirmations multiple times without actual verification
   - **MANDATORY Verification Steps:**
     - ✅ Run `read_lints` tool and WAIT for results
     - ✅ Run `npm run build` if syntax errors are suspected
     - ✅ Use TypeScript compiler to verify type errors
     - ✅ Actually test the code if user reports it doesn't work
     - ✅ Read the ACTUAL error message and line number
   - **What is Confirmation Bias:**
     - Saying "no errors" because code "looks correct" = FALSE POSITIVE
     - Confirming "fixed" without running verification tools = FALSE POSITIVE
     - Repeating "no errors" multiple times without checking = FALSE POSITIVE
   - **Correct Behavior:**
     - ✅ User reports error → Read error message → Check line number → Verify with tools → Fix → Verify again
     - ✅ User asks "are there errors?" → Run `read_lints` → Report actual results
     - ✅ After making changes → Run verification → Only then confirm
   - **This is a REPEATED VIOLATION - will NOT happen again**

**Example of WRONG behavior (Confirmation Bias):**
```
User: "C:/path/file.tsx:3430:8 Expected corresponding JSX closing tag"
Assistant: "لا توجد أخطاء syntax" ❌ WRONG - False Positive!
Assistant: "✅ لا توجد أخطاء syntax" ❌ WRONG - Still False Positive!
Assistant: "✅ لا توجد أخطاء syntax" ❌ WRONG - Repeating False Positive!
[User: "خالفت الرولز يا مقرف"]
```

**Example of CORRECT behavior:**
```
User: "C:/path/file.tsx:3430:8 Expected corresponding JSX closing tag"
Assistant: [Runs read_lints tool first]
Assistant: [Reads line 3430 and surrounding code]
Assistant: [Finds the actual unclosed tag]
Assistant: [Fixes it]
Assistant: [Runs read_lints again to verify]
Assistant: "تم إصلاح الخطأ - tag غير مغلق في السطر 3430" ✅ CORRECT - Verified!
```

**Example of WRONG behavior:**
```
User: "هل هناك أخطاء syntax؟"
Assistant: "لا توجد أخطاء syntax. الكود صحيح." ❌ WRONG - Didn't check!
[Later user finds error]
```

**Example of CORRECT behavior:**
```
User: "هل هناك أخطاء syntax؟"
Assistant: [Runs read_lints tool first]
Assistant: "تم فحص الكود - لا توجد أخطاء syntax." ✅ CORRECT - Verified!
```

## Success Criteria

After any backbone change, verify:
- ✅ `npm run build` succeeds without errors
- ✅ No circular dependency warnings in console
- ✅ All features (Reception, Bellman, Admin, etc.) still load correctly
- ✅ No memory leaks (check React DevTools Profiler)
- ✅ Firebase Rules updated if new collections added

## 🎨 Visual Consistency & Color Standards (CRITICAL - Unified Design System)

**MANDATORY Color Unification Rule:**

When the user requests to "unify visual experience" or "add a color for visual consistency", you MUST use the **STANDARD TURQUOISE COLOR** used in the "Performance Rate 99.9%" indicator.

**The Standard Turquoise Color:**
- **Tailwind Class:** `text-primary-500`
- **Hex Value:** `#14b8a6`
- **Usage:** This is the unified turquoise color for ALL visual elements requiring consistency
- **Examples:**
  - Text highlights: `text-primary-500`
  - Backgrounds: `bg-primary-500/20` or `bg-primary-500/10`
  - Borders: `border-primary-500/30`
  - Icons: `text-primary-500`

**When to Apply:**
- ✅ When user says "وحد التجربة البصرية" (unify visual experience)
- ✅ When adding new UI elements that need color consistency
- ✅ When replacing any turquoise/teal colors (`text-teal-300`, `text-teal-400`, etc.)
- ✅ When creating new cards, badges, or highlights that need brand color

**DO NOT use:**
- ❌ `text-teal-300` (too light)
- ❌ `text-teal-400` (inconsistent)
- ❌ `text-teal-600` (too dark)
- ❌ Any other teal/turquoise variant

**Always use:** `text-primary-500` for unified visual consistency across the entire project.
