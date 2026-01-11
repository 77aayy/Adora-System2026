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
