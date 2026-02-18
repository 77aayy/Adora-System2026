/**
 * Protected Route Component
 * Guards routes based on authentication and department
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppInitLoader } from '../common/AdoraLoader';
import { useAuth } from '../../context/AuthContext';
import { BranchStatusGuard } from '../auth/BranchStatusGuard';
import { HierarchyGuard } from '../auth/HierarchyGuard';
import { OnboardingGuard } from '../auth/OnboardingGuard';
import { isFirebaseConfigured, hasFirebaseConfigAvailable } from '../../services/firebase';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedDepartments?: string[];
    allowedRoles?: string[]; // ✅ Added to interface
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedDepartments,
    allowedRoles // ✅ Added to destructuring
}) => {
    const { user, isAuthenticated, isLoading, authReady } = useAuth();
    const location = useLocation();
    const [, forceUpdate] = useState(0);

    // ✅ Re-render when Firebase init completes (config exists but init was async)
    useEffect(() => {
        if (!hasFirebaseConfigAvailable() || isFirebaseConfigured()) return;
        const id = setInterval(() => {
            if (isFirebaseConfigured()) {
                forceUpdate(n => n + 1);
            }
        }, 150);
        return () => clearInterval(id);
    }, []);

    // ✅ Show consistent init loader (no flash) when auth is not ready yet
    if (!authReady || isLoading) {
        return <AppInitLoader />;
    }

    // 🔐 Firebase: only redirect to setup when NO config. If config exists (init in progress), show loading
    // ✅ Prevents wizard flash on refresh (hasFirebaseConfigAvailable is sync)
    if (!isFirebaseConfigured()) {
        if (!hasFirebaseConfigAvailable()) {
            return <Navigate to="/firebase-setup" replace />;
        }
        // Config exists, init in progress - show loader until Firebase is ready
        return <AppInitLoader />;
    }

    // ✅ FIX: Handle session expiry gracefully
    // Not authenticated -> redirect to login with error message
    if (!isAuthenticated) {
        // Clear any stale session data
        try {
            localStorage.removeItem('adora_session');
            localStorage.removeItem('adora_employee_id');
            localStorage.removeItem('adora_tenant_id');
        } catch (e) {
            console.warn('Error clearing session:', e);
        }
        return <Navigate to="/login" state={{ from: location, error: 'session_expired' }} replace />;
    }

    // Check department access if specified
    if (allowedDepartments && user) {
        // ✅ OWNER: Should NOT access operational departments (reception, housekeeping, etc.)
        // Owner only accesses management/admin routes, not operational tools
        const isOperationalDepartment = ['reception', 'housekeeping', 'bellman', 'maintenance', 'procurement', 'coffee_shop'].includes(location.pathname.split('/')[1] || '');
        
        if (user.role === 'owner' && isOperationalDepartment) {
            // Owner trying to access operational department - redirect to owner dashboard
            return <Navigate to="/owner-dashboard" replace />;
        }

        // ✅ FIX: Manager with admin department should have access to all operational departments
        // Manager acts like an employee with full permissions when branchId is selected
        const hasAccess =
            allowedDepartments.includes(user.department) ||
            user.department === 'admin' ||
            (user.role === 'manager' && user.department === 'admin'); // Manager with admin department has access to all

        if (!hasAccess) {
            // Redirect to user's own department
            return <Navigate to={`/${user.department}`} replace />;
        }
    }

    // ✅ Enforce Role Access
    if (allowedRoles && user) {
        // Owner always passes
        if (user.role === 'owner') {
            // pass
        } else if (!allowedRoles.includes(user.role)) {
            console.error(`⛔ Access Denied: User role ${user.role} not in allowedRoles [${allowedRoles.join(', ')}]`);
            return <Navigate to="/dashboard" replace />;
        }
    }

    return (
        <OnboardingGuard>
            <HierarchyGuard>
                <BranchStatusGuard>
                    {children}
                </BranchStatusGuard>
            </HierarchyGuard>
        </OnboardingGuard>
    );
};

export default ProtectedRoute;
