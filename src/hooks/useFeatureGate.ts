/**
 * Feature Gate Hook
 * ✅ CRITICAL: Every new feature MUST use this hook
 * 
 * Checks:
 * 1. Feature is globally enabled
 * 2. Feature is available in tenant's plan
 * 3. Tenant license is active
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { isFeatureEnabled } from '../services/systemSettingsService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface UseFeatureGateResult {
    isEnabled: boolean;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

/**
 * ✅ Feature Gate Hook
 * يتحقق من:
 * 1. الميزة مفعلة عالمياً
 * 2. الميزة متاحة في خطة المستأجر
 * 3. الترخيص نشط
 */
export function useFeatureGate(featureKey: string): UseFeatureGateResult {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkFeature = async () => {
        try {
            setLoading(true);
            setError(null);

            // ✅ 1. Owner always has access
            if (!tenantId || tenantId === 'system-owner' || user?.role === 'owner') {
                setIsEnabled(true);
                setLoading(false);
                return;
            }

            // ✅ 2. Check License Status (CRITICAL)
            if (!tenantId) {
                setError('المستأجر غير محدد');
                setIsEnabled(false);
                setLoading(false);
                return;
            }

            const tenantRef = doc(db, 'tenants', tenantId);
            const tenantDoc = await getDoc(tenantRef);
            
            if (!tenantDoc.exists()) {
                setError('المستأجر غير موجود');
                setIsEnabled(false);
                setLoading(false);
                return;
            }

            const tenantData = tenantDoc.data();
            const licenseStatus = tenantData.info?.licenseStatus;
            const plan = tenantData.info?.plan;

            // ✅ 3. Check License is Active
            if (licenseStatus !== 'active') {
                setError('الترخيص غير نشط. يرجى تجديد الترخيص');
                setIsEnabled(false);
                setLoading(false);
                return;
            }

            // ✅ 4. Check Feature is Enabled for Plan
            const featureEnabled = await isFeatureEnabled(featureKey as any, plan);
            
            if (!featureEnabled) {
                setError('هذه الميزة غير متاحة في خطتك الحالية. يرجى الترقية');
                setIsEnabled(false);
                setLoading(false);
                return;
            }

            setIsEnabled(true);
        } catch (err: any) {
            console.error('Feature gate error:', err);
            setError(err.message || 'خطأ في التحقق من الميزة');
            setIsEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkFeature();
    }, [featureKey, tenantId, user?.role]);

    return { isEnabled, loading, error, refetch: checkFeature };
}
