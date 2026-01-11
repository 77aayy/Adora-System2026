# 🎨 دليل الهوية البصرية - Adora Hotel Management System
## 📌 الإصدار: 2.0 | آخر تحديث: يناير 2026

---

## 📋 ملخص المشروع
تحويل واجهة نظام إدارة الفنادق إلى تصميم راقي واحترافي مستوحى من أفضل تطبيقات الـ Fintech و SaaS العالمية، مع دعم الوضع الفاتح والداكن.

---

## 🎯 الهدف
- تصميم نظيف (Clean & Minimal)
- ألوان متناسقة موحدة في كل الصفحات
- كروت أنيقة بظلال خفيفة
- أيقونات ملونة متنوعة
- تجربة مستخدم سلسة

---

## 🌈 الباليتة الرسمية النهائية (Unified Color Palette)

### 🏷️ اللون الرئيسي - Teal (الفيروزي) - علامة Adora المميزة
```css
--adora-50:  #f0fdfa;   /* خلفية فاتحة جداً */
--adora-100: #ccfbf1;   /* خلفية فاتحة */
--adora-200: #99f6e4;
--adora-300: #5eead4;
--adora-400: #2dd4bf;
--adora-500: #14b8a6;   /* ✅ اللون الأساسي للأزرار والروابط */
--adora-600: #0d9488;   /* hover state */
--adora-700: #0f766e;
```

### 🎨 ألوان الأيقونات المتنوعة (Icon Color Palette)
```
┌─────────┬───────────────────────┬───────────┬─────────────────┐
│ الاسم   │ الخلفية (gradient)    │ الأيقونة  │ الاستخدام       │
├─────────┼───────────────────────┼───────────┼─────────────────┤
│ teal    │ #f0fdfa → #ccfbf1     │ #14b8a6   │ الافتراضي      │
│ blue    │ #eff6ff → #dbeafe     │ #3b82f6   │ كريديت/معلومات │
│ green   │ #f0fdf4 → #dcfce7     │ #22c55e   │ كاش/نجاح       │
│ orange  │ #fff7ed → #ffedd5     │ #f97316   │ تحذير/انتظار   │
│ red     │ #fef2f2 → #fee2e2     │ #ef4444   │ خطأ/إلغاء      │
│ purple  │ #faf5ff → #f3e8ff     │ #8b5cf6   │ تحويل/خاص      │
│ yellow  │ #fefce8 → #fef9c3     │ #eab308   │ ضريبة/تنبيه    │
│ pink    │ #fdf2f8 → #fce7f3     │ #ec4899   │ مميز           │
└─────────┴───────────────────────┴───────────┴─────────────────┘
```

### ☀️ Light Mode (الوضع الفاتح) - الافتراضي
```css
/* الخلفيات */
--theme-bg-page: #f8fafc;        /* خلفية الصفحة */
--theme-bg-primary: #ffffff;      /* خلفية الكروت */
--theme-bg-secondary: #f8fafc;    /* خلفية ثانوية */
--theme-bg-tertiary: #f1f5f9;     /* خلفية التبويبات */

/* النصوص */
--theme-text-primary: #1e293b;    /* العناوين الرئيسية */
--theme-text-secondary: #475569;  /* النصوص الثانوية */
--theme-text-tertiary: #94a3b8;   /* النصوص الخافتة */

/* الحدود */
--theme-border-primary: #e2e8f0;  /* حدود الكروت */
--theme-border-secondary: #cbd5e1;

/* الظلال - خفيفة جداً كما في الصور المرجعية */
--theme-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.03);
--theme-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.04);
--theme-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.06);
--theme-shadow-card: 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.08);
```

### 🌙 Dark Mode (الوضع الداكن)
```css
/* الخلفيات */
--theme-bg-page: #0f172a;
--theme-bg-primary: #1e293b;
--theme-bg-secondary: #1e293b;
--theme-bg-tertiary: #334155;

/* النصوص */
--theme-text-primary: #f1f5f9;
--theme-text-secondary: #cbd5e1;
--theme-text-tertiary: #94a3b8;

/* الحدود */
--theme-border-primary: #334155;
--theme-border-secondary: #475569;

/* الظلال */
--theme-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
--theme-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
--theme-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
```

---

## 📦 المكونات الموحدة (Unified Components)

### 1. StatCard (كروت الإحصائيات)
```tsx
<StatCard
    icon={<DollarSign />}
    iconColor="green"           // ✅ لون الأيقونة (teal|blue|green|orange|red|purple|yellow|pink)
    count={1500}                // الرقم الكبير
    label="💵 كاش"              // النص مع إيموجي
    lastUpdate="تم التحديث الآن"
    trend="+12%"                // اختياري
/>
```

**الأحجام:**
- الأيقونة: `w-11 h-11 sm:w-12 sm:h-12` (44px → 48px)
- الرقم: `text-2xl sm:text-3xl font-extrabold`
- النص: `text-xs sm:text-sm font-medium`

### 2. FlexibleHeader (الترويسة المرنة)
```tsx
<FlexibleHeader
    icon={<Building2 />}
    title="عنوان الصفحة"
    subtitle="وصف اختياري"
    actions={[
        { icon: <RefreshCw />, label: 'تحديث', onClick: loadData, variant: 'primary' }
    ]}
/>
```

### 3. NavigationBar (شريط التنقل)
**الترتيب (RTL):**
- يمين: الشعار + معلومات المستخدم
- وسط: التبويبات
- يسار: أزرار الإجراءات (الفرع، المساعد الصوتي، الثيم، الخروج)

---

## 📐 المقاسات والتباعد

### Border Radius
```css
rounded-lg:   8px    /* أزرار صغيرة */
rounded-xl:   12px   /* كروت، inputs */
rounded-2xl:  16px   /* كروت كبيرة */
rounded-3xl:  24px   /* أقسام رئيسية */
```

### Spacing
```css
gap-1.5:  6px   /* بين أزرار صغيرة */
gap-2:    8px   /* بين عناصر */
gap-3:    12px  /* بين أقسام صغيرة */
gap-4:    16px  /* بين أقسام */
gap-6:    24px  /* بين أقسام كبيرة */
```

### أحجام الأزرار
```css
/* أزرار الترويسة */
w-8 h-8 sm:w-9 sm:h-9 rounded-lg

/* أزرار عادية */
px-4 py-2 rounded-xl

/* أزرار كبيرة */
px-6 py-3 rounded-xl
```

---

## 🔧 الملفات الأساسية

### ملفات CSS
1. `src/styles/design-system.css` - النظام الأساسي
2. `src/styles/theme-system.css` - متغيرات الثيم (Light/Dark)
3. `src/index.css` - الاستيرادات والـ overrides

### ملفات Context
1. `src/context/ThemeContext.tsx` - إدارة الثيم

### المكونات المشتركة
1. `src/components/common/StatCard.tsx` - كروت الإحصائيات
2. `src/components/common/ThemeToggle.tsx` - زر تبديل الثيم
3. `src/components/common/FlexibleHeader.tsx` - الترويسة المرنة

---

## ✅ الصفحات المحدثة

- [x] LoginScreen - صفحة تسجيل الدخول
- [x] EnhancedOwnerDashboard - لوحة المالك الرئيسية
- [x] BillingDashboard - الإدارة المالية
- [x] NavigationBar - شريط التنقل
- [ ] ReceptionDashboard - الاستقبال
- [ ] HousekeepingDashboard - الهاوس كيبنج
- [ ] BellmanDashboard - البيلمان
- [ ] MaintenanceDashboard - الصيانة
- [ ] ProcurementDashboard - المشتريات

---

## 🎭 الإيموجيز المستخدمة

```
💵 كاش          💳 كريديت       🏦 تحويل بنكي
⏰ مؤجل الدفع   📊 إجمالي       ⚠️ ضريبة
✅ تم           ❌ ملغي         🔄 قيد التنفيذ
📋 طلب         🛏️ غرفة         👤 مستخدم
🏢 فرع          🔧 صيانة        🧹 تنظيف
```

---

## 📱 التجاوب (Responsive)

### Breakpoints
```css
sm: 640px   /* موبايل كبير */
md: 768px   /* تابلت */
lg: 1024px  /* لابتوب */
xl: 1280px  /* ديسكتوب */
```

### Mobile First
- الكروت: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- النصوص: تختفي على الجوال، تظهر على الشاشات الكبيرة
- الأزرار: أيقونات فقط على الجوال

---

## 🔄 كيفية التطبيق على صفحة جديدة

1. **استيراد المكونات:**
```tsx
import { StatCard } from '@/components/common/StatCard';
import { FlexibleHeader } from '@/components/common/FlexibleHeader';
```

2. **تطبيق الخلفية:**
```tsx
<div style={{ background: 'var(--theme-gradient-page)', minHeight: '100vh' }}>
```

3. **استخدام StatCard مع ألوان متنوعة:**
```tsx
<StatCard icon={<Icon />} iconColor="green" count={10} label="عنوان" />
<StatCard icon={<Icon />} iconColor="blue" count={20} label="عنوان" />
<StatCard icon={<Icon />} iconColor="orange" count={5} label="عنوان" />
```

4. **تطبيق ألوان النصوص:**
```tsx
<h1 style={{ color: 'var(--theme-text-primary)' }}>عنوان</h1>
<p style={{ color: 'var(--theme-text-secondary)' }}>وصف</p>
```

---

## 🚀 المهام المتبقية

1. [ ] إصلاح زر التحديث في الترويسة
2. [ ] تصغير حجم الكروت بناءً على الصور المرجعية
3. [ ] توحيد باقي الصفحات (Reception, Housekeeping, etc.)
4. [ ] توحيد الأزرار في كل الصفحات
5. [ ] تحسين عرض الجوال
6. [ ] إضافة المزيد من الإيموجيز والتأثيرات

---

## 📸 الصور المرجعية
الصور المرفقة هي للأفكار والإلهام فقط (Fintech Apps, SaaS Dashboards).
**الباليتة الحالية مثبتة** ولن تتغير - فقط نستفيد من:
- الظلال الخفيفة
- الكروت النظيفة
- التباعد المريح
- الأيقونات الملونة المتنوعة

---

## ✅ الباليتة المثبتة النهائية

```
┌────────────────────────────────────────────────────────────┐
│  🎨 ADORA UNIFIED COLOR PALETTE (مثبتة - لا تتغير)        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  اللون الأساسي: Teal (الفيروزي) #14b8a6                   │
│                                                            │
│  الأيقونات:                                                │
│  ├─ 💚 green   #22c55e  (كاش/نجاح)                        │
│  ├─ 💙 blue    #3b82f6  (كريديت/معلومات)                  │
│  ├─ 🧡 orange  #f97316  (انتظار/تحذير)                    │
│  ├─ ❤️ red     #ef4444  (خطأ/إلغاء)                       │
│  ├─ 💜 purple  #8b5cf6  (تحويل/خاص)                       │
│  ├─ 💛 yellow  #eab308  (ضريبة/تنبيه)                     │
│  └─ 💗 pink    #ec4899  (مميز)                            │
│                                                            │
│  الخلفيات (Light):                                         │
│  ├─ الصفحة:  #f8fafc                                      │
│  ├─ الكروت: #ffffff                                       │
│  └─ الثانوي: #f1f5f9                                      │
│                                                            │
│  النصوص (Light):                                           │
│  ├─ أساسي:  #1e293b                                       │
│  ├─ ثانوي:  #475569                                       │
│  └─ خافت:   #94a3b8                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔑 كيفية فتح شات جديد والاستمرار

إذا انقطع الشات، افتح شات جديد وأرسل:

```
أنا أعمل على تحويل واجهة مشروع Adora Hotel Management System.
الباليتة مثبتة (Teal أساسي + ألوان متنوعة للأيقونات).
راجع ملف VISUAL_IDENTITY_GUIDE.md للتفاصيل.

المهام المتبقية:
1. توحيد StatCards في باقي الصفحات (Reception, Housekeeping, Bellman, Maintenance, Procurement)
2. توحيد الأزرار
3. تحسين عرض الجوال
```

---

*آخر تحديث: يناير 2026 - الباليتة مثبتة ✅*
