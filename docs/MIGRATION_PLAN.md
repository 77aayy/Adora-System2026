# 🚀 Migration Plan: Old System → Universal Action Card

## المرحلة 1: Feature Flag System ✅

### ما تم إنجازه:
1. ✅ `featureFlagsService.ts` - نظام الأعلام
2. ✅ Feature flags في Housekeeping Dashboard
3. ✅ Conditional rendering (القديم أو الجديد)

### كيفية التفعيل:
```typescript
// في Firestore: tenants/{tenantId}/settings/featureFlags
{
  useUniversalActionCard: true,
  useUniversalCardInHousekeeping: true
}
```

---

## المرحلة 2: Housekeeping Dashboard (Testing Phase) ⏳

### الخطوات:
1. ✅ Feature flag check
2. ✅ Conditional rendering
3. ⏳ **اختبار في المتصفح**
4. ⏳ ربط Actions مع State Machine
5. ⏳ اختبار انتقال الكارت بين التبويبات

### الاختبارات المطلوبة:
- [ ] الكارت يظهر بشكل صحيح
- [ ] Progress Bar يعمل
- [ ] Actions (Start/Complete) تعمل
- [ ] انتقال الكارت بين التبويبات
- [ ] Reception Alert يظهر عند الإكمال

---

## المرحلة 3: باقي Dashboards

### الترتيب:
1. Housekeeping ✅ (في الاختبار)
2. Maintenance
3. Bellman
4. Reception

---

## ملاحظات مهمة:

- **Safe Default**: النظام القديم هو الافتراضي (آمن)
- **Gradual Rollout**: يمكن تفعيل الميزة تدريجياً
- **Backward Compatible**: النظام القديم لا يزال يعمل
