/**
 * ApproveRoomTypes Page
 * 🛡️ LOCKED: SaaS Onboarding - Room Types Approval
 * 
 * Features:
 * - No Side Menu (locked navigation)
 * - No Header (no escape route)
 * - Displays predefined room types (King, Twin, Suite, Single)
 * - Manager can select predefined + add custom types manually
 * - Saves approvedRoomTypes to branch document
 * - Auto-redirects when approved
 * 
 * Workflow:
 * CreateFirstBranch → ApproveRoomTypes → Dashboard
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { useThrottledNavigate } from '../../hooks/useThrottledNavigate';
import { useTranslation } from 'react-i18next';
import { Bed, CheckCircle, Lock, Loader2, AlertTriangle, Sparkles, Plus, X } from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { haptic, playSound } from '../../utils/uxEffects';
import { logger } from '../../services/loggerService';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';

// ✅ Predefined room types
const PREDEFINED_TYPES = [
    { id: 'king', name: 'King', icon: '👑' },
    { id: 'twin', name: 'Twin', icon: '🛏️' },
    { id: 'suite', name: 'Suite', icon: '🏨' },
    { id: 'single', name: 'Single', icon: '🛌' }
];

export const ApproveRoomTypes: React.FC = () => {
    const { t } = useTranslation();
    const { tenantId } = useTenant();
    const { user } = useAuth();
    const { branches, loading: branchesLoading } = useTenantBranches();
    const navigate = useThrottledNavigate();

    // ✅ State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [customTypes, setCustomTypes] = useState<string[]>([]);
    const [newCustomType, setNewCustomType] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [branchId, setBranchId] = useState<string | null>(null);

    // ✅ Get first active branch
    useEffect(() => {
        if (!branchesLoading && branches.length > 0) {
            const activeBranch = branches.find(b => {
                const status = (b as any).status;
                return status !== 'deleted' && status !== 'inactive' && status !== 'scheduled_for_deletion';
            });

            if (activeBranch) {
                setBranchId(activeBranch.id);
                // ✅ Load existing approvedRoomTypes if any
                loadApprovedTypes(activeBranch.id);
            } else {
                setLoading(false);
            }
        } else if (!branchesLoading && branches.length === 0) {
            // No branches → redirect to create first branch
            navigate('/onboarding/create-first-branch', { replace: true });
        }
    }, [branches, branchesLoading, navigate]);

    // ✅ Load existing approvedRoomTypes from branch
    const loadApprovedTypes = async (branchId: string) => {
        if (!tenantId || !branchId) {
            setLoading(false);
            return;
        }

        try {
            const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
            const branchSnap = await getDoc(branchRef);

            if (branchSnap.exists()) {
                const branchData = branchSnap.data();
                const approved = (branchData.approvedRoomTypes as string[]) || [];

                // ✅ Separate predefined and custom
                const predefinedSelected = new Set<string>();
                const customList: string[] = [];

                approved.forEach(typeName => {
                    const predefined = PREDEFINED_TYPES.find(p => p.name.toLowerCase() === typeName.toLowerCase());
                    if (predefined) {
                        predefinedSelected.add(predefined.id);
                    } else {
                        customList.push(typeName);
                    }
                });

                setSelectedTypes(predefinedSelected);
                setCustomTypes(customList);
            }
        } catch (err: any) {
            logger.error('Error loading approved room types', err, 'ApproveRoomTypes');
        } finally {
            setLoading(false);
        }
    };

    // ✅ Check if already approved → redirect
    useEffect(() => {
        if (!loading && branchId && selectedTypes.size > 0) {
            // Already has approved types → check if we should redirect
            const activeBranch = branches.find(b => b.id === branchId);
            if (activeBranch && (activeBranch as any).approvedRoomTypes?.length > 0) {
                // User already approved → redirect to dashboard (unless forced here)
                // We'll allow re-approval for flexibility
            }
        }
    }, [loading, branchId, selectedTypes, branches]);

    // ✅ Toggle predefined type
    const togglePredefinedType = (typeId: string) => {
        setError(null);
        const newSelected = new Set(selectedTypes);
        if (newSelected.has(typeId)) {
            newSelected.delete(typeId);
        } else {
            newSelected.add(typeId);
        }
        setSelectedTypes(newSelected);
        haptic('light');
    };

    // ✅ Add custom type
    const handleAddCustomType = () => {
        const trimmed = newCustomType.trim();
        if (!trimmed) return;

        // ✅ Check duplicates
        if (customTypes.includes(trimmed)) {
            setError(t('onboarding.approveRoomTypes.errors.typeExists', { type: trimmed }));
            haptic('error');
            return;
        }

        // ✅ Check if matches predefined
        const matchesPredefined = PREDEFINED_TYPES.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
        if (matchesPredefined) {
            setError(t('onboarding.approveRoomTypes.errors.typeInPredefined', { type: trimmed }));
            haptic('error');
            return;
        }

        setCustomTypes(prev => [...prev, trimmed]);
        setNewCustomType('');
        setError(null);
        haptic('success');
    };

    // ✅ Remove custom type
    const handleRemoveCustomType = (typeName: string) => {
        setCustomTypes(prev => prev.filter(t => t !== typeName));
        haptic('light');
    };

    // ✅ Save approved room types
    const handleApprove = async () => {
        // ✅ Build final list: predefined selected + custom
        const predefinedNames = Array.from(selectedTypes).map(id => {
            const predefined = PREDEFINED_TYPES.find(p => p.id === id);
            return predefined?.name || '';
        }).filter(Boolean);

        const approvedTypes = [...predefinedNames, ...customTypes];

        if (approvedTypes.length === 0) {
            setError(t('onboarding.approveRoomTypes.errors.selectAtLeastOne'));
            haptic('error');
            return;
        }

        if (!tenantId || !branchId) {
            setError(t('onboarding.approveRoomTypes.errors.tenantOrBranchNotSpecified'));
            haptic('error');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // ✅ Update branch document with approvedRoomTypes
            const branchRef = doc(db, `tenants/${tenantId}/branches`, branchId);
            await updateDoc(branchRef, {
                approvedRoomTypes: approvedTypes
            });

            logger.info('Room types approved', { tenantId, branchId, types: approvedTypes }, 'ApproveRoomTypes');

            // ✅ Success feedback
            haptic('success');
            playSound('success');

            // ✅ Auto-redirect after 1 second
            setTimeout(() => {
                navigate('/admin/dashboard', { replace: true });
            }, 1000);
        } catch (err: any) {
            logger.error('Error approving room types', err, 'ApproveRoomTypes');
            setError(err.message || t('onboarding.approveRoomTypes.errors.saveError'));
            haptic('error');
        } finally {
            setSaving(false);
        }
    };

    // ✅ Loading state
    if (branchesLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--theme-gradient-page)' }}>
                <AdoraLoader size="lg" message={t('onboarding.approveRoomTypes.loadingData')} />
            </div>
        );
    }

    // ✅ Locked SaaS Onboarding UI: Room Types Approval
    const approvedCount = selectedTypes.size + customTypes.length;

    return (
        <div 
            className="min-h-screen w-full flex flex-col items-center justify-center p-4"
            style={{ 
                background: 'var(--theme-gradient-page)',
                overflow: 'hidden'
            }}
        >
            {/* Locked Notice */}
            <div className="absolute top-4 right-4 flex items-center gap-2 text-sm opacity-60">
                <Lock className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                <span style={{ color: 'var(--theme-text-tertiary)' }}>{t('onboarding.approveRoomTypes.mustCompleteFirst')}</span>
            </div>

            {/* Welcome Header */}
            <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(64, 224, 208, 0.2)', border: '1px solid rgba(64, 224, 208, 0.3)' }}>
                        <Bed className="w-8 h-8" style={{ color: '#40E0D0' }} />
                    </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    {t('onboarding.approveRoomTypes.title')}
                </h1>
                <p className="text-base sm:text-lg mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    {t('onboarding.approveRoomTypes.subtitle')}
                </p>
                <p className="text-sm opacity-75" style={{ color: 'var(--theme-text-tertiary)' }}>
                    {t('onboarding.approveRoomTypes.description')}
                </p>
            </div>

            {/* ✅ Predefined Types Cards */}
            <div className="w-full max-w-2xl mb-6">
                <label className="block text-sm font-medium mb-3 text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                    {t('onboarding.approveRoomTypes.predefinedTypesLabel')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PREDEFINED_TYPES.map((type) => {
                        const isSelected = selectedTypes.has(type.id);
                        return (
                            <button
                                key={type.id}
                                type="button"
                                onClick={() => togglePredefinedType(type.id)}
                                disabled={saving}
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
                                    <div className="text-3xl mb-1">{type.icon}</div>
                                    <div className="text-lg font-mono font-bold" style={{ color: isSelected ? '#40E0D0' : 'var(--theme-text-primary)' }}>
                                        {type.name}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ✅ Custom Types Input */}
            <div className="w-full max-w-md mb-6">
                <label className="block text-sm font-medium mb-2 text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                    {t('onboarding.approveRoomTypes.customTypeLabel')}
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newCustomType}
                        onChange={(e) => {
                            setNewCustomType(e.target.value);
                            setError(null);
                        }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleAddCustomType();
                            }
                        }}
                        placeholder={t('onboarding.approveRoomTypes.customTypePlaceholder')}
                        className="flex-1 px-4 py-3 rounded-xl text-center text-base font-medium"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '2px solid var(--theme-border-primary)',
                            color: 'var(--theme-text-primary)',
                            outline: 'none'
                        }}
                        disabled={saving}
                    />
                    <button
                        onClick={handleAddCustomType}
                        disabled={!newCustomType.trim() || saving}
                        className="px-4 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ✅ Custom Types List */}
            {customTypes.length > 0 && (
                <div className="w-full max-w-md mb-6">
                    <label className="block text-sm font-medium mb-2 text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                        {t('onboarding.approveRoomTypes.customTypesLabel', { count: customTypes.length })}
                    </label>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {customTypes.map((typeName) => (
                            <div
                                key={typeName}
                                className="px-4 py-2 rounded-lg flex items-center gap-2"
                                style={{
                                    background: 'rgba(64, 224, 208, 0.2)',
                                    border: '1px solid rgba(64, 224, 208, 0.3)',
                                    color: '#40E0D0'
                                }}
                            >
                                <span className="font-medium">{typeName}</span>
                                <button
                                    onClick={() => handleRemoveCustomType(typeName)}
                                    disabled={saving}
                                    className="p-1 hover:bg-white/10 rounded transition-all disabled:opacity-50"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
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

            {/* ✅ Summary */}
            {approvedCount > 0 && (
                <div className="w-full max-w-md mb-4 p-3 rounded-xl" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <p className="text-sm text-center" style={{ color: 'var(--theme-text-secondary)' }}>
                        {t('onboarding.approveRoomTypes.summary', { count: approvedCount })}
                    </p>
                </div>
            )}

            {/* ✅ Approve Button */}
            <button
                onClick={handleApprove}
                disabled={approvedCount === 0 || saving}
                className={`
                    w-full max-w-md px-6 py-4 rounded-xl font-bold text-lg
                    flex items-center justify-center gap-2
                    transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    ${approvedCount > 0 
                        ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-lg hover:scale-105' 
                        : 'bg-white/10 text-white/50 border border-white/20'
                    }
                `}
            >
                {saving ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('onboarding.approveRoomTypes.saving')}</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" />
                        <span>{t('onboarding.approveRoomTypes.saveAndApprove')}</span>
                    </>
                )}
            </button>

            {/* Footer Note */}
            <div className="mt-6 text-center">
                <p className="text-xs opacity-50" style={{ color: 'var(--theme-text-tertiary)' }}>
                    {t('onboarding.approveRoomTypes.footerNote')}
                </p>
            </div>
        </div>
    );
};
