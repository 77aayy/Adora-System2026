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

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { AdoraLoader } from '../common/AdoraLoader';

interface OnboardingGuardProps {
    children: React.ReactNode;
}

export const OnboardingGuard: React.FC<OnboardingGuardProps> = ({ children }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { branches, loading } = useTenantBranches();
    const location = useLocation();

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

    // 🛡️ SECURITY: If manager has 0 branches → force onboarding
    const hasNoBranches = activeBranches.length === 0;
    const isOnboardingRoute = location.pathname.startsWith('/onboarding');
    const isBranchManagementRoute = location.pathname.startsWith('/admin/branches');

    // ✅ Allow access to branch management even with 0 branches (manager can create first branch there)
    if (hasNoBranches && !isOnboardingRoute && !isBranchManagementRoute) {
        // ✅ Redirect to onboarding (block access to all other routes except branch management)
        return <Navigate to="/onboarding/create-first-branch" replace />;
    }

    // ✅ Check if manager has branches but no approved room types
    if (activeBranches.length > 0 && !isOnboardingRoute) {
        const firstBranch = activeBranches[0];
        const approvedRoomTypes = (firstBranch as any).approvedRoomTypes;
        const hasApprovedTypes = approvedRoomTypes && Array.isArray(approvedRoomTypes) && approvedRoomTypes.length > 0;

        // ✅ If branch exists but no approved room types → force approval
        if (!hasApprovedTypes) {
            return <Navigate to="/onboarding/approve-room-types" replace />;
        }
    }

    // ✅ If manager has branches but is on onboarding route → allow (they can complete setup or cancel)
    // ✅ If manager has >= 1 branch + approved types → allow access to normal routes
    return <>{children}</>;
};
