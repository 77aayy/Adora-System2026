/**
 * Feature Cleanup Service
 * ✅ CRITICAL: Cleanup feature data when feature is disabled
 * 
 * This service is called automatically when a feature is disabled
 * to prevent orphaned data and maintain data integrity.
 */

import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

interface CleanupResult {
    deleted: number;
    errors: string[];
}

/**
 * ✅ Cleanup Feature Data
 * يتم استدعاؤها عند تعطيل الميزة
 */
export const cleanupFeatureData = async (
    featureKey: string,
    tenantId: string
): Promise<CleanupResult> => {
    const errors: string[] = [];
    let deleted = 0;

    try {
        // ✅ مثال: حذف بيانات الميزة من Firestore
        switch (featureKey) {
            case 'auditLogs':
                // حذف سجلات المراجعة
                const auditRef = collection(db, `tenants/${tenantId}/auditLogs`);
                const auditSnap = await getDocs(auditRef);
                const auditBatch = writeBatch(db);
                
                auditSnap.docs.forEach((docSnap) => {
                    auditBatch.delete(docSnap.ref);
                    deleted++;
                });
                
                if (deleted > 0) {
                    await auditBatch.commit();
                }
                break;

            case 'backupRestore':
                // حذف النسخ الاحتياطية القديمة (احتفظ بالأحدث فقط)
                const backupRef = collection(db, `tenants/${tenantId}/backups`);
                const backupSnap = await getDocs(backupRef);
                const backupBatch = writeBatch(db);
                
                // Sort by date, keep only the latest
                const backups = backupSnap.docs
                    .map(d => ({ id: d.id, data: d.data(), ref: d.ref }))
                    .sort((a, b) => {
                        const aDate = a.data.createdAt?.toDate() || new Date(0);
                        const bDate = b.data.createdAt?.toDate() || new Date(0);
                        return bDate.getTime() - aDate.getTime();
                    });
                
                // Delete all except the latest
                backups.slice(1).forEach((backup) => {
                    backupBatch.delete(backup.ref);
                    deleted++;
                });
                
                if (deleted > 0) {
                    await backupBatch.commit();
                }
                break;

            case 'aiAssistant':
                // ✅ Hide VoiceInputButton - handled by component's useFeatureGate
                // No data cleanup needed, component will hide automatically
                console.log('✅ AI Assistant disabled - VoiceInputButton will hide automatically');
                break;

            case 'pointsSystem':
                // ✅ Points system cleanup (optional - can keep historical data)
                // Points history is usually kept for reporting
                console.log('✅ Points system disabled - historical data preserved');
                break;

            case 'inventoryManagement':
                // ✅ Inventory cleanup (optional - can keep historical data)
                console.log('✅ Inventory management disabled - historical data preserved');
                break;

            case 'procurementSystem':
                // ✅ Procurement cleanup (optional - can keep historical data)
                console.log('✅ Procurement system disabled - historical data preserved');
                break;

            case 'laundryManagement':
                // ✅ Laundry cleanup (optional - can keep historical data)
                console.log('✅ Laundry management disabled - historical data preserved');
                break;

            // ✅ إضافة حالات أخرى للميزات الجديدة هنا
            // case 'newFeatureName':
            //     // Cleanup logic here
            //     break;

            default:
                console.warn(`⚠️ No cleanup defined for feature: ${featureKey}`);
        }
    } catch (error: any) {
        errors.push(`Error cleaning up ${featureKey}: ${error.message}`);
        console.error(`Cleanup error for ${featureKey}:`, error);
    }

    return { deleted, errors };
};

/**
 * Cleanup feature data for all tenants
 * Used when a feature is globally disabled
 */
export const cleanupFeatureForAllTenants = async (
    featureKey: string
): Promise<{ totalDeleted: number; errors: string[] }> => {
    const errors: string[] = [];
    let totalDeleted = 0;

    try {
        // Get all tenants
        const tenantsRef = collection(db, 'tenants');
        const tenantsSnap = await getDocs(tenantsRef);

        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            const result = await cleanupFeatureData(featureKey, tenantId);
            totalDeleted += result.deleted;
            errors.push(...result.errors);
        }
    } catch (error: any) {
        errors.push(`Error cleaning up for all tenants: ${error.message}`);
    }

    return { totalDeleted, errors };
};
