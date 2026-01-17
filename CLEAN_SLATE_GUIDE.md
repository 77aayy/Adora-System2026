# Clean Slate Guide 🧹

## نظرة عامة
سكربت "Clean Slate" للمسح الشامل لجميع البيانات التجريبية في Firestore، مع الاحتفاظ بـ Tenant ID المحدد والإعدادات الأساسية فقط.

## ⚠️ تحذير
**هذا السكربت يحذف البيانات بشكل دائم!** استخدم `dryRun: true` أولاً للتأكد من البيانات التي سيتم حذفها.

## الاستخدام

### 1. Dry Run (تحليل فقط - بدون حذف)
```typescript
import { analyzeCleanSlate } from './services/cleanSlateService';

const report = await analyzeCleanSlate('your-tenant-id');
console.log('Total records to delete:', report.totalRecordsDeleted);
console.log('Collections to clean:', report.collectionsCleaned);
```

### 2. Clean Slate (المسح الفعلي)
```typescript
import { performCleanSlate } from './services/cleanSlateService';

const report = await performCleanSlate({
    preservedTenantId: 'your-tenant-id', // Tenant ID للاحتفاظ به
    dryRun: false // false للحذف الفعلي
});

console.log('Clean Slate Complete!');
console.log('Total records deleted:', report.totalRecordsDeleted);
```

## البيانات المحذوفة

### Collections المحذوفة لكل Tenant:
- `branches`
- `rooms`
- `roomCards`
- `employees`
- `requests`
- `procurementRequests`
- `procurement_orders`
- `procurement_requests`
- `lost_found`
- `activityLogs`
- `adminActivityLogs`
- `data_doctor_logs`
- `notifications`
- `procurementNotifications`
- `procurementLogs`
- `procurementReceipts`
- `secureAccessTokens`
- `minibar_consumption`
- `coffee_orders`
- `financial_transactions`
- `chat_rooms`
- `wallet_transactions`
- `pointsHistory`
- `gamification_logs`
- `loyalty_program_logs`

### Sub-collections المحذوفة:
- `branches/{branchId}/coffee_orders`
- `branches/{branchId}/financial_transactions`
- `branches/{branchId}/chat_rooms`
- `employees/{employeeId}/wallet_transactions`
- `employees/{employeeId}/pointsHistory`
- `roomCards/{roomCardId}/transactions`
- `roomCards/{roomCardId}/services`

## البيانات المحفوظة

### Root Collections (لن تُحذف):
- `systemConfigs` - إعدادات النظام الأساسية
- `globalCodes` - الأكواد العامة
- `users` - حسابات المستخدمين

### Tenant Documents:
- جميع Tenant documents محفوظة (بما في ذلك `preservedTenantId`)
- فقط البيانات التجارية (Business Data) داخل Tenants يتم حذفها

## ملاحظات

1. **Owner Only**: السكربت محمي بـ RBAC - فقط Owner يمكنه التنفيذ
2. **Batch Operations**: جميع العمليات تستخدم Firestore Batches لتقليل التكلفة
3. **Recursive Deletion**: Sub-collections تُحذف تلقائياً
4. **Points Reset**: Employee points تُعاد إلى 0 (ليست حذف)
5. **Error Handling**: الأخطاء تُسجل في التقرير ولكن العملية تستمر

## مثال الاستخدام من Owner Dashboard

```typescript
// في Owner Dashboard أو Super Admin Panel
const handleCleanSlate = async () => {
    const confirmed = window.confirm(
        '⚠️ هل أنت متأكد من مسح جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه!'
    );
    
    if (!confirmed) return;

    try {
        // Dry run first
        const dryRunReport = await analyzeCleanSlate('your-tenant-id');
        console.log('Dry Run Report:', dryRunReport);

        const finalConfirm = window.confirm(
            `سيتم حذف ${dryRunReport.totalRecordsDeleted} سجل. هل تريد المتابعة؟`
        );

        if (!finalConfirm) return;

        // Actual cleanup
        const report = await performCleanSlate({
            preservedTenantId: 'your-tenant-id',
            dryRun: false
        });

        alert(`تم المسح بنجاح! تم حذف ${report.totalRecordsDeleted} سجل.`);
    } catch (error: any) {
        alert(`خطأ: ${error.message}`);
    }
};
```

## بعد التنفيذ

بعد تنفيذ Clean Slate، النظام سيكون:
- ✅ "White Page" - بدون بيانات تجارية
- ✅ Root Configs محفوظة
- ✅ Tenant Documents محفوظة
- ✅ User Accounts محفوظة
- ❌ جميع البيانات التجريبية محذوفة

جاهز لبدء UAT من جديد! 🎉
