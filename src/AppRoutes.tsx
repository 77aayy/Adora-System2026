/**
 * Application Routes
 * Adora Hotel Management System (SaaS)
 * 
 * ✅ Lazy Loading enabled for better performance (Verified)
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PageTransition } from './components/common/PageTransition';

// Lazy-loaded Dashboards for better performance
// ✅ OPTIMIZED: Named chunks for better caching and debugging
import { lazyLoad } from './utils/lazyLoad';

// ✅ Staff Dashboards (Most frequently accessed - priority loading)
const ReceptionDashboard = lazyLoad(() => import(/* webpackChunkName: "reception" */ './features/reception/ReceptionDashboard'));
const HousekeepingDashboard = lazyLoad(() => import(/* webpackChunkName: "housekeeping" */ './features/housekeeping/HousekeepingDashboard'));
const BellmanDashboard = lazyLoad(() => import(/* webpackChunkName: "bellman" */ './features/bellman/BellmanDashboard'));
const MaintenanceDashboard = lazyLoad(() => import(/* webpackChunkName: "maintenance" */ './features/maintenance/MaintenanceDashboard'));
const ProcurementDashboard = lazyLoad(() => import(/* webpackChunkName: "procurement" */ './features/procurement/ProcurementDashboard'));
const CoffeeShopDashboard = lazyLoad(() => import(/* webpackChunkName: "coffeeshop" */ './features/coffeeshop/CoffeeShopDashboard'));

// ✅ Admin Dashboards (Manager access - medium priority)
const AdminDashboard = lazyLoad(() => import(/* webpackChunkName: "admin" */ './features/admin/AdminDashboard'));
const AdvancedRewardsDashboard = lazyLoad(() => import(/* webpackChunkName: "rewards" */ './features/admin/AdvancedRewardsDashboard'));
const OwnerPanel = lazyLoad(() => import(/* webpackChunkName: "owner-panel" */ './features/admin/OwnerPanel'));

// ✅ Owner Dashboards (Infrequent access - lowest priority)
const SuperAdminPanel = lazyLoad(() => import(/* webpackChunkName: "super-admin" */ './features/super-admin/SuperAdminPanel'));
const EnhancedOwnerDashboard = lazyLoad(() => import(/* webpackChunkName: "owner-dashboard" */ './features/super-admin/EnhancedOwnerDashboard'));
const BillingDashboard = lazyLoad(() => import(/* webpackChunkName: "billing" */ './features/super-admin/BillingDashboard'));
const AnalyticsDashboard = lazyLoad(() => import(/* webpackChunkName: "analytics" */ './features/super-admin/AnalyticsDashboard'));
const SuperAdminMasterAccess = lazyLoad(() => import(/* webpackChunkName: "master-access" */ './features/super-admin/SuperAdminMasterAccess'));

// ✅ Guest Portal (Public access - separate chunk)
const GuestDashboard = lazyLoad(() => import(/* webpackChunkName: "guest" */ './features/guest/GuestDashboard'));
const GuestLayout = lazyLoad(() => import(/* webpackChunkName: "guest-layout" */ './components/layout/GuestLayout'));

// ✅ Demo Portal (Public access for potential buyers)
const DemoEntry = lazyLoad(() => import(/* webpackChunkName: "demo" */ './features/demo/DemoEntry').then(m => ({ default: m.DemoEntry })));

// ✅ About Us Page (Public access)
const AboutUs = lazyLoad(() => import(/* webpackChunkName: "about" */ './pages/AboutUs'));

// Auth / Setup (keep eager for fast login)
import LoginScreen from './features/auth/LoginScreen';
import { SetupWizard } from './features/setup/SetupWizard';
import { FirebaseSetupWizard } from './features/setup/FirebaseSetupWizard';

// ✅ Onboarding (locked for managers with 0 branches)
const CreateFirstBranch = lazyLoad(() => import(/* webpackChunkName: "onboarding" */ './features/onboarding/CreateFirstBranch').then(m => ({ default: m.CreateFirstBranch })));
const ApproveRoomTypes = lazyLoad(() => import(/* webpackChunkName: "onboarding" */ './features/onboarding/ApproveRoomTypes').then(m => ({ default: m.ApproveRoomTypes })));

// Core
import { AppInitLoader } from './components/common/AdoraLoader';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { GuestPortalGate } from './components/layout/GuestPortalGate';
import { useAuth } from './context/AuthContext';
import { getDepartmentPath } from './services/userService';
import { ReceptionProvider } from './context/ReceptionContext';
import { isFirebaseConfigured, hasFirebaseConfigAvailable } from './services/firebase';

// ======================================================
// Firebase Setup Guard — لا نُ mount المعالج إن كان Firebase مُعداً أو config متوفر (منع صفحة شبح عند الـ refresh)
// ✅ If config exists (env/localStorage) → redirect to login, avoid wizard flash during async init
// ======================================================
const FirebaseSetupGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (isFirebaseConfigured()) {
        return <Navigate to="/login" replace />;
    }
    // ✅ Config available but init not done yet → redirect to login (no wizard flash on refresh)
    if (hasFirebaseConfigAvailable()) {
        return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
};

// ======================================================
// Root Redirect (Smart SaaS Redirect)
// ======================================================
const RootRedirect: React.FC = () => {
    const { user, isAuthenticated, isLoading, authReady } = useAuth();

    // ✅ Show consistent init loader (no flash) when auth is not ready yet
    if (!authReady || isLoading) {
        return <AppInitLoader />;
    }

    if (isAuthenticated && user) {
        const path = getDepartmentPath(user.department, user.role);
        return <Navigate to={path} replace />;
    }

    return <Navigate to="/login" replace />;
};

// ======================================================
// Routes
// ======================================================
export const AppRoutes: React.FC = () => {
    const location = useLocation();
    
    return (
        <Suspense fallback={<AppInitLoader />}>
            <PageTransition>
                <Routes location={location}>

                {/* ================= Public ================= */}
                <Route path="/login" element={<LoginScreen />} />
                <Route path="/setup" element={<SetupWizard />} />
                <Route path="/firebase-setup" element={<FirebaseSetupGuard><FirebaseSetupWizard /></FirebaseSetupGuard>} />

                {/* ================= Onboarding (Locked for Managers) ================= */}
                <Route
                    path="/onboarding/create-first-branch"
                    element={
                        <ProtectedRoute>
                            <CreateFirstBranch />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/onboarding/approve-room-types"
                    element={
                        <ProtectedRoute>
                            <ApproveRoomTypes />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Super Admin (Secured) ================= */}
                <Route
                    path="/super-admin"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <SuperAdminPanel />
                        </ProtectedRoute>
                    }
                />
                
                {/* ================= Enhanced Owner Dashboard ================= */}
                <Route
                    path="/owner-dashboard"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <EnhancedOwnerDashboard />
                        </ProtectedRoute>
                    }
                />
                
                {/* ================= Billing Dashboard ================= */}
                <Route
                    path="/owner-dashboard/billing"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <BillingDashboard />
                        </ProtectedRoute>
                    }
                />
                
                {/* ================= Analytics Dashboard ================= */}
                <Route
                    path="/owner-dashboard/analytics"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <AnalyticsDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Master Access (Super Admin Only) ================= */}
                <Route
                    path="/owner-dashboard/master-access"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner', 'super_admin']}>
                            <SuperAdminMasterAccess />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Owner ================= */}
                {/* ✅ Owner Panel - Manager Management */}
                <Route
                    path="/owner-panel"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <OwnerPanel />
                        </ProtectedRoute>
                    }
                />
                
                {/* ✅ FIX: Redirect /owner to /owner-dashboard for the complete experience */}
                <Route
                    path="/owner"
                    element={<Navigate to="/owner-dashboard" replace />}
                />
                <Route
                    path="/owner/*"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']} allowedRoles={['owner']}>
                            <EnhancedOwnerDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Demo (Public - For Potential Buyers) ================= */}
                <Route path="/demo" element={<DemoEntry />} />
                <Route path="/demo-access" element={<DemoEntry />} />

                {/* ================= About Us (Public) ================= */}
                <Route path="/about" element={<AboutUs />} />

                {/* ================= Guest (Public - Gated by qrCodeGuestPortal) ================= */}
                <Route
                    path="/guest"
                    element={
                        <GuestPortalGate>
                            <GuestLayout>
                                <GuestDashboard />
                            </GuestLayout>
                        </GuestPortalGate>
                    }
                />

                {/* ================= Staff ================= */}
                <Route
                    path="/reception"
                    element={
                        <ProtectedRoute allowedDepartments={['reception', 'admin']}>
                            <ReceptionProvider>
                                <ReceptionDashboard />
                            </ReceptionProvider>
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/housekeeping"
                    element={
                        <ProtectedRoute allowedDepartments={['housekeeping', 'admin']}>
                            <HousekeepingDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/bellman"
                    element={
                        <ProtectedRoute allowedDepartments={['bellman', 'admin']}>
                            <BellmanDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/maintenance"
                    element={
                        <ProtectedRoute allowedDepartments={['maintenance', 'admin']}>
                            <MaintenanceDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/procurement"
                    element={
                        <ProtectedRoute allowedDepartments={['procurement', 'reception', 'admin']}>
                            <ProcurementDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/coffeeshop"
                    element={
                        <ProtectedRoute allowedDepartments={['coffee_shop', 'reception', 'admin']}>
                            <CoffeeShopDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Admin (Manager) ================= */}
                <Route
                    path="/admin/*"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']}>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Rewards ================= */}
                <Route
                    path="/rewards"
                    element={
                        <ProtectedRoute allowedDepartments={['admin']}>
                            <AdvancedRewardsDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* ================= Convenience ================= */}
                <Route path="/dashboard" element={<Navigate to="/admin" replace />} />

                {/* ================= Root & Fallback ================= */}
                <Route path="/" element={<RootRedirect />} />
                <Route path="*" element={<RootRedirect />} />
                
            </Routes>
            </PageTransition>
        </Suspense>
    );
};

export default AppRoutes;