/**
 * Demo Entry Component
 * Handles auto-login for demo instances via URL parameters
 * Adora Hotel Management System
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { LoadingSkeleton } from '../../components/reception/LoadingSkeleton';
import { 
    createDemoInstance, 
    autoLoginDemoManager, 
    checkDemoInstance, 
    validateDemoKey,
    DEMO_CONSTANTS 
} from '../../services/demoFactory';
import { 
    validateDemoKey as validateDemoKeyParam,
    validateDocumentID,
    detectSuspiciousURLActivity 
} from '../../services/urlValidationService';
import { useTranslation } from 'react-i18next';

export const DemoEntry: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuth();
    const { t } = useTranslation();
    const [status, setStatus] = useState<'loading' | 'creating' | 'logging' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeDemo = async () => {
            try {
                // 🛡️ SECURITY: Detect suspicious URL activity first
                if (detectSuspiciousURLActivity(searchParams)) {
                    console.warn('🚨 [DemoEntry] Suspicious URL activity detected - blocking');
                    setError(t('demo.securityError') || 'Invalid request detected');
                    setStatus('error');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // 🔐 SECURITY: Validate and sanitize all URL parameters
                const validatedKey = validateDemoKeyParam(searchParams.get('key'));
                const validatedTenantId = validateDocumentID(searchParams.get('tenantId'), 'Tenant ID');
                const validatedBranchId = validateDocumentID(searchParams.get('branchId'), 'Branch ID');

                // 1. Get validated parameters from URL
                const key = validatedKey.isValid ? validatedKey.value : null;
                const tenantId = validatedTenantId.isValid ? validatedTenantId.value : null;
                const branchId = validatedBranchId.isValid ? validatedBranchId.value : null;

                // 2. Validate demo key (if provided)
                if (key && !validateDemoKey(key)) {
                    setError(t('demo.invalidKey') || 'Invalid demo key');
                    setStatus('error');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // 3. Report validation errors if any
                if (!validatedKey.isValid && searchParams.get('key')) {
                    setError(validatedKey.error || t('demo.invalidKey') || 'Invalid demo key');
                    setStatus('error');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                if (!validatedTenantId.isValid && searchParams.get('tenantId')) {
                    setError(validatedTenantId.error || 'Invalid tenant ID');
                    setStatus('error');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                if (!validatedBranchId.isValid && searchParams.get('branchId')) {
                    setError(validatedBranchId.error || 'Invalid branch ID');
                    setStatus('error');
                    setTimeout(() => navigate('/login'), 3000);
                    return;
                }

                // 3. Check if demo instance exists (for provided tenantId or any demo)
                setStatus('loading');
                const exists = tenantId ? await checkDemoInstance(tenantId) : await checkDemoInstance();

                let demoInstance: any;
                if (!exists) {
                    // 4. Create demo instance if it doesn't exist
                    setStatus('creating');
                    demoInstance = await createDemoInstance({
                        branchName: 'Demo Hotel Branch',
                        tenantName: 'Demo Hotel',
                        populateData: true,
                        tenantId: tenantId || undefined // Use provided tenantId or generate new one
                    });
                }

                // 5. Auto-login as demo manager
                setStatus('logging');
                const demoUser = await autoLoginDemoManager(
                    tenantId || demoInstance?.tenantId,
                    branchId || demoInstance?.branchId
                );

                // 6. Login using AuthContext with demo manager PIN
                await login(DEMO_CONSTANTS.MANAGER_PIN, demoUser.branchId);

                // 7. Navigate to reception dashboard
                navigate('/reception', { replace: true });
            } catch (err: any) {
                console.error('Demo initialization error:', err);
                setError(err.message || t('demo.initFailed') || 'Failed to initialize demo');
                setStatus('error');
                setTimeout(() => navigate('/login'), 3000);
            }
        };

        initializeDemo();
    }, [searchParams, navigate, login, t]);

    if (status === 'error') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">{t('demo.error') || 'Error'}</h1>
                    <p className="text-red-400 mb-4">{error}</p>
                    <p className="text-white/60 text-sm">{t('demo.redirecting') || 'Redirecting to login...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
            <div className="text-center">
                <img
                    src="/adora-logo.png"
                    alt="Adora"
                    className="w-24 h-24 object-contain mx-auto mb-6 animate-pulse"
                    style={{ filter: 'drop-shadow(0 0 15px rgba(45, 212, 191, 0.4))' }}
                />
                <h1 className="text-2xl font-bold text-white mb-4">
                    {status === 'creating' 
                        ? (t('demo.creating') || 'Creating Demo Instance...')
                        : status === 'logging'
                        ? (t('demo.logging') || 'Logging in...')
                        : (t('demo.loading') || 'Loading Demo...')
                    }
                </h1>
                <AdoraLoader />
                <p className="text-white/60 text-sm mt-4">
                    {status === 'creating' 
                        ? (t('demo.settingUp') || 'Setting up your demo environment...')
                        : (t('demo.pleaseWait') || 'Please wait...')
                    }
                </p>
            </div>
        </div>
    );
};
