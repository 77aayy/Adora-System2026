/**
 * CreateFirstBranch Page
 * 🛡️ LOCKED: SaaS Onboarding - License Activation
 * 
 * Features:
 * - No Side Menu (locked navigation)
 * - No Header (no escape route)
 * - Displays licensed branch codes as cards (from getAvailableBranchCodes)
 * - Manager MUST select code from licensed list (no manual input)
 * - Branch name is required
 * - Direct createBranch call (no complex wizard)
 * - Auto-redirects when branch is created
 * 
 * Workflow:
 * Manager created → Financial docs created → License check enforced → 
 * OnboardingGuard redirects here → Select licensed code + name → Activate → Access granted
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, CheckCircle, Lock, Loader2, AlertTriangle, Sparkles, MapPin } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { getAvailableBranchCodes, createBranch } from '../../services/branchService';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';

export const CreateFirstBranch: React.FC = () => {
    const { t } = useTranslation();
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const { branches, loading: branchesLoading } = useTenantBranches();
    const navigate = useNavigate();

    // ✅ SaaS License Selection State
    const [availableCodes, setAvailableCodes] = useState<Array<{ code: string; name?: string; used: boolean }>>([]);
    const [loadingCodes, setLoadingCodes] = useState(true);
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [branchName, setBranchName] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ✅ Load available licensed codes
    useEffect(() => {
        const loadLicensedCodes = async () => {
            if (!tenantId) {
                setLoadingCodes(false);
                return;
            }

            try {
                setLoadingCodes(true);
                const codes = await getAvailableBranchCodes(tenantId);
                // ✅ Filter only unused codes (available for activation)
                const unusedCodes = codes.filter(c => !c.used);
                setAvailableCodes(unusedCodes);
                
                // ✅ Auto-select first available code (UX improvement)
                if (unusedCodes.length > 0 && !selectedCode) {
                    setSelectedCode(unusedCodes[0].code);
                    // ✅ Pre-fill name if suggested by owner
                    if (unusedCodes[0].name) {
                        setBranchName(unusedCodes[0].name);
                    }
                }
            } catch (err: any) {
                logger.error('Error loading licensed codes', err, 'CreateFirstBranch');
                setError(t('onboarding.createFirstBranch.errors.loadLicensesError'));
            } finally {
                setLoadingCodes(false);
            }
        };

        if (!branchesLoading && branches.length === 0) {
            loadLicensedCodes();
        }
    }, [tenantId, branchesLoading, branches.length, selectedCode]);

    // ✅ Wait for branches data and check if already created
    useEffect(() => {
        if (!branchesLoading) {
            const activeBranches = branches.filter(branch => {
                const status = (branch as any).status;
                return status !== 'deleted' && status !== 'inactive' && status !== 'scheduled_for_deletion';
            });

            // ✅ If branch already created → redirect to dashboard
            if (activeBranches.length > 0) {
                navigate('/admin/dashboard', { replace: true });
                return;
            }
        }
    }, [branches, branchesLoading, navigate]);

    // ✅ Handle branch activation (direct createBranch call)
    const handleActivate = async () => {
        if (!selectedCode || !branchName.trim()) {
            setError('يرجى اختيار كود الفرع وإدخال اسم الفرع');
            haptic('error');
            return;
        }

        if (!tenantId) {
            setError('لم يتم تحديد المؤسسة');
            haptic('error');
            return;
        }

        setIsActivating(true);
        setError(null);

        try {
            // ✅ Direct createBranch call (RED LINE security enforced in service)
            const result = await createBranch(tenantId, {
                name: branchName.trim(),
                code: selectedCode,
                location: '', // Optional
                status: 'active', // ✅ Active immediately (first branch)
                createdBy: user?.id || 'system',
                settings: {
                    workingHours: '24/7',
                    allowNegativeInventory: false,
                    requireManagerApproval: true
                }
            } as any);

            if (!result.success || !result.branchId) {
                throw new Error(result.error || 'فشل في إنشاء الفرع');
            }

            // ✅ Success feedback
            haptic('success');
            playSound('success');
            logger.info('First branch activated', { tenantId, branchId: result.branchId, code: selectedCode }, 'CreateFirstBranch');

            // ✅ Auto-redirect to approve room types (next onboarding step)
            setTimeout(() => {
                navigate('/onboarding/approve-room-types', { replace: true });
            }, 1000);
        } catch (err: any) {
            logger.error('Error activating branch', err, 'CreateFirstBranch');
            setError(err.message || t('onboarding.createFirstBranch.errors.activationError'));
            haptic('error');
        } finally {
            setIsActivating(false);
        }
    };

    // ✅ Loading state
    if (branchesLoading || loadingCodes) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-gradient-page)' }}>
                <AdoraLoader size="lg" message={t('onboarding.createFirstBranch.loadingLicenses')} />
            </div>
        );
    }

    // ✅ No licenses available
    if (availableCodes.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--theme-gradient-page)' }}>
                <div className="text-center max-w-md">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                        {t('onboarding.createFirstBranch.noLicensesTitle')}
                    </h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--theme-text-secondary)' }}>
                        {t('onboarding.createFirstBranch.noLicensesMessage')}
                    </p>
                </div>
            </div>
        );
    }

    // ✅ Locked SaaS Onboarding UI: License Selection + Activation
    const selectedCodeData = availableCodes.find(c => c.code === selectedCode);

    return (
        <div 
            className="min-h-screen w-full flex flex-col items-center justify-center p-4"
            style={{ 
                background: 'var(--theme-gradient-page)',
                // 🛡️ Prevent scrolling (locked)
                overflow: 'hidden'
            }}
        >
            {/* Locked Notice (subtle) */}
            <div className="absolute top-4 right-4 flex items-center gap-2 text-sm opacity-60">
                <Lock className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                <span style={{ color: 'var(--theme-text-tertiary)' }}>{t('onboarding.createFirstBranch.mustCompleteFirst')}</span>
            </div>

            {/* Welcome Header */}
            <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(64, 224, 208, 0.2)', border: '1px solid rgba(64, 224, 208, 0.3)' }}>
                        <Building2 className="w-8 h-8" style={{ color: '#40E0D0' }} />
                    </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    {t('onboarding.createFirstBranch.title')}
                </h1>
                <p className="text-base sm:text-lg mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    {user?.name ? `${user.name}، ` : ''}{t('onboarding.createFirstBranch.subtitle')}
                </p>
                <p className="text-sm opacity-75" style={{ color: 'var(--theme-text-tertiary)' }}>
                    {t('onboarding.createFirstBranch.description')}
                </p>
            </div>

            {/* ✅ SaaS License Cards - Available Codes */}
            <div className="w-full max-w-2xl mb-6">
                <label className="block text-sm font-medium mb-3 text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                    {t('onboarding.createFirstBranch.availableLicenses', { count: availableCodes.length })}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {availableCodes.map((codeData) => {
                        const isSelected = selectedCode === codeData.code;
                        return (
                            <button
                                key={codeData.code}
                                type="button"
                                onClick={() => {
                                    setSelectedCode(codeData.code);
                                    // ✅ Pre-fill name if suggested
                                    if (codeData.name && !branchName) {
                                        setBranchName(codeData.name);
                                    }
                                    setError(null);
                                    haptic('light');
                                }}
                                disabled={isActivating}
                                className={`
                                    relative p-4 rounded-xl border-2 transition-all
                                    ${isSelected 
                                        ? 'border-teal-500 bg-teal-500/20 scale-105 shadow-lg' 
                                        : 'border-white/10 bg-white/5 hover:border-teal-400/50 hover:bg-white/10'
                                    }
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                            >
                                {isSelected && (
                                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-white" />
                                    </div>
                                )}
                                <div className="text-center">
                                    <div className="text-2xl font-mono font-bold mb-1" style={{ color: isSelected ? '#40E0D0' : 'var(--theme-text-primary)' }}>
                                        {codeData.code}
                                    </div>
                                    {codeData.name && (
                                        <div className="text-xs opacity-75 truncate" style={{ color: 'var(--theme-text-secondary)' }}>
                                            {codeData.name}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ✅ Branch Name Input (Required) */}
            {selectedCode && (
                <div className="w-full max-w-md mb-6">
                    <label className="block text-sm font-medium mb-2 text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                        اسم الفرع <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={branchName}
                        onChange={(e) => {
                            setBranchName(e.target.value);
                            setError(null);
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && branchName.trim() && selectedCode) {
                                handleActivate();
                            }
                        }}
                        placeholder="أدخل اسم الفرع (مطلوب)"
                        className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: `2px solid ${selectedCode ? 'rgba(64, 224, 208, 0.3)' : 'var(--theme-border-primary)'}`,
                            color: 'var(--theme-text-primary)',
                            outline: 'none'
                        }}
                        disabled={isActivating}
                        autoFocus
                    />
                </div>
            )}

            {/* ✅ Error Message */}
            {error && (
                <div className="w-full max-w-md mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <p className="text-sm flex items-center gap-2 text-red-400 text-center justify-center">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </p>
                </div>
            )}

            {/* ✅ Activate Button */}
            <button
                onClick={handleActivate}
                disabled={!selectedCode || !branchName.trim() || isActivating}
                className={`
                    w-full max-w-md px-6 py-4 rounded-xl font-bold text-lg
                    flex items-center justify-center gap-2
                    transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${selectedCode && branchName.trim() 
                        ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg hover:scale-105' 
                        : 'bg-white/10 text-white/50 border border-white/20'
                    }
                `}
            >
                {isActivating ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('onboarding.createFirstBranch.activating')}</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        <span>{t('onboarding.createFirstBranch.activateButton')}</span>
                    </>
                )}
            </button>

            {/* Footer Note (minimal) */}
            <div className="mt-6 text-center">
                <p className="text-xs opacity-50" style={{ color: 'var(--theme-text-tertiary)' }}>
                    {t('onboarding.createFirstBranch.footerNote')}
                </p>
            </div>
        </div>
    );
};
