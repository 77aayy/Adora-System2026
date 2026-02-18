# 🎯 Universal Action Card - Usage Example

## مثال بسيط للاستخدام

```typescript
import { UniversalActionCard } from '@/components/cards/UniversalActionCard';
import { moveRequest } from '@/services/stateTransitionService';

// في Housekeeping Dashboard
<UniversalActionCard
    request={task} // يمكن أن يكون Request أو CleaningRequest
    viewMode="housekeeping"
    onAction={async (action) => {
        if (action === 'start') {
            // استخدام State Machine
            await moveRequest(
                tenantId,
                task.id,
                'IN_PROGRESS',
                'housekeeping',
                userId,
                userName,
                'بدأ التنظيف'
            );
        } else if (action === 'complete') {
            await moveRequest(
                tenantId,
                task.id,
                'COMPLETED',
                'reception', // يرجع للاستقبال
                userId,
                userName,
                'تم التنظيف'
            );
        }
    }}
    onView={() => {
        // عرض التفاصيل
    }}
/>
```

## الميزات التلقائية

1. **Progress Bar**: يحسب تلقائياً من `pointsConfig`
2. **Points Display**: يعرض النقاط بناءً على الوقت
3. **Journey History**: يعرض من `stateHistory` أو `workflow.journey`
4. **QR Fields**: يظهر تلقائياً للطلبات من QR
5. **Reception Alert**: يظهر تلقائياً عندما `isActionRequiredByReception = true`
