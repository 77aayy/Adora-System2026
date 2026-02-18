# 🎯 Universal Action Card - The Hero Card

## الميزات الكاملة

### 1. Dynamic Progress Bar (The Pulse)
- **Green (0-60%)**: Safe zone - يعرض نقاط المكافأة (+2)
- **Yellow (60-90%)**: Warning zone - تحذير
- **Red (>90% أو متأخر)**: Critical zone - Pulse animation + نقاط سالبة

### 2. QR Data Fields
- **ID Number**: للتحقق من هوية النزيل
- **Mobile Number**: للتواصل
- يظهر فقط للطلبات من QR

### 3. Journey History
- **Previous Action**: من أين استلم الكارت
- **Next Step**: الخطوة التالية
- **Journey Summary**: عدد الأقسام المشاركة

### 4. Points Integration
- **Real-time Calculation**: يحسب النقاط بناءً على الوقت الحالي
- **Positive Points**: يعرض في Safe zone
- **Negative Points**: يحسب عند التأخير (كل 5 دقائق)

### 5. Reception Alert
- **Turquoise Border**: عندما `isActionRequiredByReception = true`
- **Pulse Animation**: للتنبيه
- يظهر في تبويب "تم" عند الاستقبال

## كيفية الاستخدام

### في Dashboard:
```typescript
import { UniversalActionCard } from '@/components/cards/UniversalActionCard';

<UniversalActionCard
    request={request}
    viewMode="housekeeping"
    onAction={(action) => {
        if (action === 'start') {
            // Start work
        } else if (action === 'complete') {
            // Complete work
        }
    }}
    onView={() => {
        // Show details modal
    }}
/>
```

### Integration مع State Machine:
الكارت يستخدم `extractUnifiedStatus` تلقائياً من `stateTransitionService`.

## الخطوات التالية للاختبار

1. ✅ الكارت جاهز
2. ⏳ استبدال الكروت القديمة في Dashboards
3. ⏳ اختبار في المتصفح
