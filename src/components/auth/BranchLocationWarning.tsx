/**
 * Branch Location Warning Component
 * Warns user if they're opening a branch different from their current location
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, AlertTriangle, X, RefreshCw, CheckCircle } from 'lucide-react';
import { checkBranchLocation } from '../../services/branchLocationService';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { useNavigate } from 'react-router-dom';

interface BranchLocationWarningProps {
    branchId: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const BranchLocationWarning: React.FC<BranchLocationWarningProps> = ({
    branchId,
    onConfirm,
    onCancel
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);
    const [checkResult, setCheckResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        performCheck();
    }, [branchId]);

    const performCheck = async () => {
        if (!user?.tenantId || !user.branches) {
            setChecking(false);
            return;
        }

        setChecking(true);
        try {
            const result = await checkBranchLocation(
                user.tenantId,
                branchId,
                user.branches
            );
            setCheckResult(result);
        } catch (error) {
            console.error('Location check error:', error);
            // Fail open - allow access
            setCheckResult({ isAtBranch: true });
        } finally {
            setChecking(false);
        }
    };

    const handleSwitchBranch = async () => {
        if (!checkResult?.suggestedBranch) return;
        
        setLoading(true);
        try {
            // Navigate to the correct branch
            window.location.href = `/?branch=${checkResult.suggestedBranch}`;
        } catch (error) {
            console.error('Branch switch error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
                <div className="glass rounded-2xl p-6 max-w-md w-full">
                    <div className="text-center">
                        <AdoraLoader size="md" message={t('branchLocation.checkingLocation')} />
                        <p className="text-white/60">{t('branchLocation.checkingLocation')}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!checkResult || checkResult.isAtBranch) {
        return null; // No warning needed
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass rounded-2xl p-6 max-w-md w-full border-2 border-yellow-500/50">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{t('branchLocation.warningTitle')}</h3>
                        <p className="text-white/80 mb-2">{checkResult.warning}</p>
                        {checkResult.distance && (
                            <p className="text-sm text-white/60">
                                {t('branchLocation.distanceLabel', { distance: checkResult.distance })}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-white/40 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    {checkResult.suggestedBranch && (
                        <button
                            onClick={handleSwitchBranch}
                            disabled={loading}
                            className="w-full px-4 py-3 bg-teal-500/20 border border-teal-500/30 rounded-xl text-teal-400 hover:bg-teal-500/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <MapPin className="w-4 h-4" />
                            {loading ? t('branchLocation.switching') : t('branchLocation.switchToCorrectBranch')}
                        </button>
                    )}
                    
                    <button
                        onClick={onConfirm}
                        className="w-full px-4 py-3 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                    >
                        {t('branchLocation.continueAnyway')}
                    </button>
                    
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl text-white/60 hover:bg-white/10 transition-colors"
                    >
                        {t('branchLocation.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};
