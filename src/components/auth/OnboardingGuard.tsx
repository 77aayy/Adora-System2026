/**
 * OnboardingGuard Component
 * 🛡️ SECURITY: Enforces manager onboarding workflow
 * 
 * Logic:
 * - If manager has 0 branches → redirect to /onboarding/create-first-branch
 * - If manager has >= 1 branch → allow access to normal routes
 * - Owner bypasses this guard (system-owner has unlimited branches)
 * 
 * Performance:
 * - Uses useTenantBranches hook (already subscribed, no extra Firebase reads)
 * - Real-time updates via Firestore onSnapshot
 * 
 * Adora Hotel Management System V3
 */

import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { useThrottledNavigate } from '../../hooks/useThrottledNavigate';
import { AdoraLoader } from '../common/AdoraLoader';

const REDIRECT_SETTLE_MS = 350; // تأخير قبل التوجيه لتفادي الرعشة وتعدد الـ redirects

interface OnboardingGuardProps {
    children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { branches, loading } = useTenantBranches();
    const location = useLocation();
    const navigate = useThrottledNavigate();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ✅ Bypass for Owner (system-owner has unlimited branches)
    if (user?.role === 'owner') {
        return <>{children}</>;
    }

    // ✅ Loading state: Wait for branches data
    if (loading) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center">
                <AdoraLoader size="lg" message={t('onboarding.guards.loadingMessage')} />
            </div>
        );
    }

    // ✅ Count active branches (exclude deleted/inactive)
    const activeBranches = branches.filter(branch => {
        const status = (branch as any).status;
        return status !== 'deleted' && status !== 'inactive' && status !== 'scheduled_for_deletion';
    });

    const hasNoBranches = activeBranches.length === 0;
    const isOnboardingRoute = location.pathname.startsWith('/onboarding');
    const isBranchManagementRoute = location.pathname.startsWith('/admin/branches');

    const needRedirectToOnboarding = hasNoBranches && !isOnboardingRoute && !isBranchManagementRoute;
    const needRedirectToApprove = activeBranches.length > 0 && !isOnboardingRoute && (() => {
        const firstBranch = activeBranches[0];
        const approvedRoomTypes = (firstBranch as any).approvedRoomTypes;
        return !(approvedRoomTypes && Array.isArray(approvedRoomTypes) && approvedRoomTypes.length > 0);
    })();

    const redirectTarget = needRedirectToOnboarding
        ? '/onboarding/create-first-branch'
        : needRedirectToApprove
            ? '/onboarding/approve-room-types'
            : null;

    // ✅ تأخير التوجيه حتى لا يحدث redirect متتابع (رعشة) عند تحديث branches
    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (!redirectTarget) return;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            navigate(redirectTarget, { replace: true });
        }, REDIRECT_SETTLE_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [redirectTarget, navigate]);

    if (redirectTarget) {
        return (
            <div className="min-h-screen theme-page flex items-center justify-center">
                <AdoraLoader size="lg" message={t('onboarding.guards.loadingMessage')} />
            </div>
        );
    }

    return <>{children}</>;
};
