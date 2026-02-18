# فحص مفاتيح الميزات (Feature Flags) — تبويب الإعدادات

**تاريخ الفحص:** 2026-02-15  
**المصدر:** SettingsTab في EnhancedOwnerDashboard (إعدادات المالك)

---

## مسار التنفيذ (مُتحقق منه)

1. **الحفظ:** زر التبديل → `onToggleFeature(key, enabled)` → `handleToggleFeature` → `toggleFeature()` في systemSettingsService → `updateSystemSettings({ features: { ...current.features, [featureKey]: enabled } })` → Firestore `system/settings`.
2. **القراءة:** `getSystemSettings()` (مع cache) ← يُستدعى من `isFeatureEnabled(featureKey, plan, forceRefresh)`.
3. **الواجهة:** المكوّنات تستخدم `useFeatureGate(featureKey)` ← يستدعي `isFeatureEnabled` ويستمع لحدث `adora_feature_toggled`.

---

## نتيجة الفحص لكل ميزة

| الميزة | مفتاح النظام | مرتبطة؟ | أين تُقرأ / تُستخدم |
|--------|--------------|---------|----------------------|
| بوابة النزيل (QR) | `qrCodeGuestPortal` | **لا** | لا يوجد `useFeatureGate('qrCodeGuestPortal')` ولا حماية لمسار `/guest`. التبديل يُحفظ فقط. |
| نظام النقاط | `pointsSystem` | **نعم** | AdminSidebar، PointsTracker. |
| الشارات والرتب | `gamification` | **نعم** | GamificationPage، ProtectedFeatureRoute. |
| ملاحظات الشيفت | `shiftNotes` | **نعم** | ShiftNotes. |
| المهام المجدولة | `scheduledTasks` | **نعم** | AdminSidebar، ScheduledTasksManager. |
| المساعد الذكي | `aiAssistant` | **نعم** | App، VoiceInputButton. |
| مزامنة التقويم | `calendarSync` | **لا** | لا يوجد `useFeatureGate('calendarSync')`. calendarSyncService يُستدعى من SettingsManager و PricingSettings بدون التحقق من العلم. |
| إدارة المخزون | `inventoryManagement` | **نعم** | AdminSidebar. |
| المشتريات | `procurementSystem` | **نعم** | App، AdminSidebar، ProcurementCart، ProcurementDashboard، UnifiedManagerHeader، PremiumHeader. |
| المغسلة | `laundryManagement` | **نعم** | AdminSidebar، LaundryInventory. |
| واتساب | `whatsappIntegration` | **نعم** | AdminSidebar، NotificationSettingsManager، communicationService. |
| إيميل | `emailNotifications` | **نعم** | NotificationSettingsManager، communicationService. |
| SMS | `smsNotifications` | **نعم** | NotificationSettingsManager، communicationService. |

---

## خلاصة

- **تعمل 100% (مرتبطة بالواجهة والخدمات):** 11 ميزة.
- **غير مرتبطة (التبديل يُحفظ ولا يُطبَّق):**
  1. **qrCodeGuestPortal** — مسار `/guest` مفتوح دائماً.
  2. **calendarSync** — واجهة/خدمة التقويم تعمل دون التحقق من العلم.

---

## التوصيات (تم تنفيذها)

1. **qrCodeGuestPortal:** تم إضافة `GuestPortalGate` في `AppRoutes`: مسار `/guest` يمر عبر المكوّن الذي يتحقق من `getSystemSettings().features.qrCodeGuestPortal`؛ عند التعطيل يُعرض "البوابة غير متاحة حالياً".
2. **calendarSync:** تم استخدام `useFeatureGate('calendarSync')` في `BranchSettings` (SettingsManager): قسم "مركز التكاملات الخارجية" و `CalendarSourcesManager` يُعرضان فقط عندما الميزة مفعّلة.
