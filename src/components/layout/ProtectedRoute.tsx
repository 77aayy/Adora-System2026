/**
 * Protected Route Component
 * Guards routes based on authentication and department
 * Adora Hotel Management System V2
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AdoraLoader } from '../../components/common/AdoraLoader';
import { useAuth } from '../../context/AuthContext';
import { BranchStatusGuard } from '../auth/BranchStatusGuard';
import { HierarchyGuard } from '../auth/HierarchyGuard';
import { isFirebaseConfigured } from '../../services/firebase';

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

    // ✅ Show loading only if auth is not ready yet
    // Once authReady is true, we can proceed immediately
    if (!authReady || isLoading) {
        // ✅ Minimal loading - return null to let Suspense handle it
        // This prevents multiple loading screens from appearing
        return null;
    }

    // 🔐 Firebase not configured -> redirect to setup
    if (!isFirebaseConfigured()) {
        return <Navigate to="/firebase-setup" replace />;
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
        <HierarchyGuard>
            <BranchStatusGuard>
                {children}
            </BranchStatusGuard>
        </HierarchyGuard>
    );
};

export default ProtectedRoute;
