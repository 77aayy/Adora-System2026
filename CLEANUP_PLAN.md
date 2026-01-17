# 🧹 خطة تنظيف البيانات التجريبية - CLEANUP PLAN

**تاريخ الإنشاء:** 2026-01-16  
**الغرض:** توثيق خطة تنظيف البيانات التجريبية قبل UAT  
**الحالة:** ⚠️ **في انتظار المراجعة والموافقة**

---

## 📋 **المسارات التي سيتم تنظيفها**

### ✅ **Main Collections (Business Data):**
1. `tenants/${tenantId}/branches` - الفروع التجريبية
2. `tenants/${tenantId}/rooms` - الغرف التجريبية
3. `tenants/${tenantId}/roomCards` - Room Cards التجريبية
4. `tenants/${tenantId}/employees` - الموظفين التجريبين (سيتم تصفير نقاطهم فقط، لن نحذف الموظفين)
5. `tenants/${tenantId}/requests` - الطلبات التجريبية
6. `tenants/${tenantId}/procurementRequests` - المشتريات التجريبية
7. `tenants/${tenantId}/lost_found` - المفقودات التجريبية
8. `tenants/${tenantId}/activityLogs` - Activity Logs
9. `tenants/${tenantId}/data_doctor_logs` - Data Doctor logs
10. `tenants/${tenantId}/notifications` - Notifications
11. `tenants/${tenantId}/secureAccessTokens` - QR tokens
12. `tenants/${tenantId}/minibar_consumption` - Minibar consumption records

### ✅ **Sub-collections (Recursive Deletion):**

#### **Under Employees:**
- `tenants/${tenantId}/employees/${employeeId}/wallet_transactions` - محافظ الموظفين
- `tenants/${tenantId}/employees/${employeeId}/pointsHistory` - تاريخ النقاط

#### **Under Branches:**
- `tenants/${tenantId}/branches/${branchId}/coffee_orders` - طلبات الكوفي شوب
- `tenants/${tenantId}/branches/${branchId}/financial_transactions` - المعاملات المالية

### ⚠️ **Points Reset (Not Deletion):**
- **NOT deleting employees** - فقط تصفير:
  - `points: 0`
  - `currentPoints: 0`
  - `personalPoints: 0`
  - `version: version + 1` (for optimistic locking)

---

## 🛡️ **المسارات المحمية (لن يتم حذفها)**

### ✅ **System Configurations:**
- `tenants/${tenantId}/settings` - إعدادات المستأجر
- `tenants/${tenantId}/systemConfigs` - System configurations
- Root collections: `users`, `globalCodes`, `systemConfigs`, `tenants`

### ✅ **Protected Tenants:**
- Tenants in `excludeTenants` array (Admin/Super tenants)

---

## 🔒 **الحماية والأمان**

### ✅ **RBAC Protection:**
- ✅ **Owner-only access:** `validateRoleAccess('owner')` required
- ✅ **Tenant exclusion:** Admin tenants protected via `excludeTenants`
- ✅ **Dry-run mode:** Analyze first, execute second

### ✅ **Safety Checks:**
1. ✅ Tenant ID validation
2. ✅ Exclude tenant check (admin tenants)
3. ✅ Firebase initialization check
4. ✅ Dry-run analysis before actual cleanup
5. ✅ Batch operations (max 500 per batch) for efficiency
6. ✅ Error handling with detailed report

---

## 📊 **كيفية الاستخدام**

### **Step 1: تحليل (Dry-run)**
```typescript
import { analyzeCleanup } from './services/dataCleanupService';

const analysis = await analyzeCleanup({
    tenantId: 'test-tenant-id',
    excludeTenants: ['admin-tenant-id'], // Admin tenants to protect
    dryRun: true
});

console.log('📊 Analysis Report:', analysis);
// Review: collectionsCleaned, subCollectionsCleaned, totalRecordsDeleted
```

### **Step 2: التنفيذ (مع التأكيد)**
```typescript
import { safeCleanupTenantData } from './services/dataCleanupService';

// First call: Analysis only (confirm=false)
const analysis = await safeCleanupTenantData(
    'test-tenant-id',
    ['admin-tenant-id'], // Exclude admin tenants
    false // confirm=false = analysis only
);

// Review analysis...

// Second call: Execute cleanup (confirm=true)
const result = await safeCleanupTenantData(
    'test-tenant-id',
    ['admin-tenant-id'],
    true // confirm=true = execute cleanup
);

console.log('✅ Cleanup complete:', result);
```

---

## 📄 **Cleanup Report Structure**

```typescript
interface CleanupReport {
    tenantId: string;
    dryRun: boolean;
    collectionsCleaned: {
        name: string;
        path: string;
        count: number;
    }[];
    subCollectionsCleaned: {
        parentPath: string;
        subCollection: string;
        count: number;
    }[];
    totalRecordsDeleted: number;
    errors: string[];
    timestamp: Date;
}
```

---

## ⚠️ **تحذيرات هامة**

1. ⚠️ **لا رجعة:** الحذف نهائي - لا يمكن استرجاع البيانات
2. ⚠️ **تأكيد مطلوب:** يجب استدعاء `safeCleanupTenantData` مرتين (analysis ثم execution)
3. ⚠️ **حماية Admin Tenants:** تأكد من إضافة Admin tenant IDs في `excludeTenants`
4. ⚠️ **Backup قبل الحذف:** يُنصح بعمل backup قبل التنظيف (غير مُضمن في الكود)

---

## 🧪 **خطوات الاختبار (قبل الإنتاج)**

1. ✅ **Test Dry-run:** `analyzeCleanup({ tenantId: 'test-id', dryRun: true })`
2. ✅ **Review Report:** تأكد من أن المسارات صحيحة والـ counts منطقية
3. ✅ **Test on Test Tenant:** اختبار على tenant تجريبي أولاً
4. ✅ **Verify Exclusions:** تأكد من أن Admin tenants محمية
5. ✅ **Check Preserved Data:** تأكد من أن Settings/Configs لم تُمس

---

## 📝 **ملاحظات**

- ✅ **Batch Operations:** استخدام `writeBatch` لعمليات حذف فعالة (max 500 per batch)
- ✅ **Error Handling:** جميع الأخطاء تُسجل في `report.errors` ولا توقف العملية
- ✅ **Logging:** جميع العمليات تُسجل في `loggerService`
- ✅ **Atomic Operations:** كل batch هو atomic (all-or-nothing)

---

**تاريخ آخر تحديث:** 2026-01-16  
**الحالة:** ⚠️ **في انتظار المراجعة قبل التنفيذ**
