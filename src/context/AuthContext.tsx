/**
 * Authentication Context
 * Manages user authentication state with branch and biometric support
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import {
    loginWithPin,
    getDepartmentPath,
    getStoredBranchId,
    saveBranchId,
    getLastUsers,
    getUserById,
    isBiometricAvailable,
    verifyBiometric,
    saveUserBinding,
} from '../services/userService';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { logAudit } from '../utils/auditService';

// ============================================================
// TYPES
// ============================================================

interface LastUser {
    id: string;
    name: string;
    department: string;
}

interface AuthContextType {
    // ✅ Architecture Compliant Interface
    authReady: boolean;
    tenantId: string | null;
    role: string | null;

    // Legacy/Existing props
    user: User | null;
    branchId: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    lastUsers: LastUser[];
    biometricAvailable: boolean;
    login: (pin: string, branchId?: string) => Promise<any>;
    loginWithBiometric: () => Promise<string>;
    logout: () => void;
    setBranch: (branchId: string) => void;
}

// ============================================================
// CONTEXT
// ============================================================

const AuthContext = createContext<AuthContextType>({
    user: null,
    branchId: null,
    isAuthenticated: false,
    authReady: false, // Default
    isLoading: true,
    tenantId: null,
    role: null,
    error: null,
    lastUsers: [],
    biometricAvailable: false,
    login: async () => ({ path: '/' }),
    loginWithBiometric: async () => '/',
    logout: () => { },
    setBranch: () => { },
});

export const useAuth = () => useContext(AuthContext);

// ============================================================
// STORAGE
// ============================================================

const USER_STORAGE_KEY = 'adora_user';

// ============================================================
// PROVIDER
// ============================================================

interface AuthProviderProps {
    children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [branchId, setBranchIdState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUsers, setLastUsers] = useState<LastUser[]>([]);
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    // ✅ Strict Architecture: AuthReady State
    const [authReady, setAuthReady] = useState(false);

    // Load stored data on mount
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                // ✅ Guard: Check if Firebase Auth is initialized
                if (!auth) {
                    console.log('Firebase Auth not initialized, skipping auth sync');
                    // Load from localStorage only
                    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
                    if (storedUser) {
                        try {
                            const appUser = JSON.parse(storedUser);
                            setUser(appUser);
                        } catch {
                            localStorage.removeItem(USER_STORAGE_KEY);
                        }
                    }
                    if (mounted) {
                        setIsLoading(false);
                        setAuthReady(true);
                    }
                    return;
                }

                // 1. Wait for Firebase Auth to settle (Initial state) - FASTER timeout
                const firebaseUser = await new Promise<any>(resolve => {
                    const unsub = auth.onAuthStateChanged(user => {
                        unsub();
                        resolve(user);
                    });
                    // ⚡ Faster timeout - 500ms instead of 2000ms
                    setTimeout(() => resolve(auth.currentUser), 500);
                });

                // 2. Load Local Storage User (Immediate UI Update)
                const storedUser = localStorage.getItem(USER_STORAGE_KEY);
                let appUser: User | null = null;

                if (storedUser) {
                    try {
                        appUser = JSON.parse(storedUser);
                        setUser(appUser);
                        // If we have a local user, we can set loading false soon
                        // but we wait for Firebase sync to be safe
                    } catch {
                        localStorage.removeItem(USER_STORAGE_KEY);
                    }
                }

                // Load branch (but NOT for owner) - Do this immediately, no await
                const storedBranch = getStoredBranchId();
                if (storedBranch && appUser?.role !== 'owner') {
                    setBranchIdState(storedBranch);
                } else if (appUser?.role === 'owner') {
                    // ✅ CRITICAL: Clear branchId for owner
                    setBranchIdState(null);
                }

                // Load last users immediately (synchronous)
                setLastUsers(getLastUsers());

                // ⚡ OPTIMIZED: Run Firebase sync, security check, and biometric check in parallel
                const [_, securityCheckResult, bioAvailable] = await Promise.allSettled([
                    // 3. Sync Firebase Anonymously if needed (non-blocking)
                    (async () => {
                        if (appUser && !firebaseUser) {
                            try {
                                const userCredential = await signInAnonymously(auth);
                                // ✅ Re-bind UID to Tenant/Role for Security Rules
                                if (userCredential.user && appUser.tenantId) {
                                    await saveUserBinding(userCredential.user.uid, appUser.tenantId, appUser.role || 'employee');
                                }
                            } catch (e) {
                                console.error('Auto-login sync failed', e);
                            }
                        }
                    })(),
                    // 🛑 SECURITY CHECK (Kill Switch) - Run in parallel
                    (async () => {
                        if (appUser && appUser.tenantId && appUser.role !== 'owner' && appUser.tenantId !== 'system-owner') {
                            try {
                                const tenantRef = doc(db, 'tenants', appUser.tenantId);
                                const tenantSnap = await getDoc(tenantRef);
                                if (tenantSnap.exists()) {
                                    const tenantData = tenantSnap.data();
                                    if (tenantData.status === 'suspended') {
                                        throw new Error('ACCOUNT_SUSPENDED');
                                    }
                                }
                            } catch (securityError: any) {
                                if (securityError.message === 'ACCOUNT_SUSPENDED') {
                                    console.error('🚫 Account Suspended');
                                    localStorage.removeItem(USER_STORAGE_KEY);
                                    if (mounted) {
                                        setUser(null);
                                        setBranchIdState(null);
                                    }
                                    throw securityError; // Re-throw to stop execution
                                }
                                // Ignore permission errors or network errors during initial load
                                console.warn('Non-fatal security check warning:', securityError.message);
                            }
                        }
                    })(),
                    // Check biometric availability (non-blocking)
                    isBiometricAvailable().catch(() => false)
                ]);

                // Handle security check result
                if (securityCheckResult.status === 'rejected') {
                    const error = securityCheckResult.reason;
                    if (error && typeof error === 'object' && 'message' in error && error.message === 'ACCOUNT_SUSPENDED') {
                        return; // Stop execution if account is suspended
                    }
                }

                // Set biometric availability
                if (bioAvailable.status === 'fulfilled' && mounted) {
                    setBiometricAvailable(bioAvailable.value);
                }
            } catch (err) {
                console.error('Auth Init Error:', err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                    setAuthReady(true);
                }
            }
        };

        init();
        return () => { mounted = false; };
    }, []);

    // Login with PIN
    const login = useCallback(async (pin: string, branch?: string): Promise<any> => {
        setError(null);
        try {
            const userData = await loginWithPin(pin, branch);

            // Check if account is active (owner is always active)
            if (userData.role !== 'owner' && (userData as any).status !== 'active') {
                throw new Error('الحساب معطل - يرجى التواصل مع الإدارة');
            }

            // ✅ CRITICAL: Sign in anonymously to Firebase Auth for Firestore Rules
            // ✅ IMPORTANT: Owner ALSO needs anonymous auth for Firestore Rules to work!
            if (auth) {
                try {
                    await signInAnonymously(auth);
                    console.log('✅ Firebase Anonymous Auth succeeded');
                    
                    // ✅ For owner: Create/update userBinding to mark as owner in Firestore Rules
                    if (userData.role === 'owner' && auth.currentUser) {
                        try {
                            const userBindingRef = doc(db, 'userBindings', auth.currentUser.uid);
                            await setDoc(userBindingRef, {
                                role: 'owner',
                                tenantId: userData.tenantId || 'system-owner',
                                userId: userData.id,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            }, { merge: true });
                            console.log('✅ Owner userBinding created/updated for Firestore Rules');
                        } catch (bindingError: any) {
                            console.warn('⚠️ Failed to create owner userBinding (non-critical):', bindingError);
                        }
                    }
                } catch (authError: any) {
                    // 🚨 CRITICAL ERROR: Anonymous Auth MUST be enabled!
                    if (authError?.code === 'auth/operation-not-allowed') {
                        console.error('🚨 CRITICAL: Anonymous Authentication is NOT enabled in Firebase Console!');
                        console.error('   Go to: Firebase Console → Authentication → Sign-in method → Anonymous → Enable');
                        // Continue with limited functionality (read-only mode)
                    } else {
                        console.error('❌ Firebase Auth sign-in failed:', authError?.message);
                    }
                }
            }


            // ✅ CRITICAL FIX: Owner should NEVER have a branchId
            // Owner accesses all branches dynamically, not through a single branchId
            if (userData.role === 'owner') {
                // Clear any existing branchId for owner
                setBranchIdState(null);
                saveBranchId(''); // Clear stored branchId
            } else {
                // ✅ FIXED: Auto-select branch (preferred branch from PIN mapping or provided branch or first available)
                const availableBranches = (userData as any).availableBranches || [];
                const selectedBranch = branch || (userData as any).preferredBranchId || (availableBranches.length > 0 ? availableBranches[0].id : null);

                if (selectedBranch) {
                    setBranchIdState(selectedBranch);
                    saveBranchId(selectedBranch);
                }
            }

            setUser(userData);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
            setLastUsers(getLastUsers());

            // ✅ SaaS Security: Bind anonymous UID to Tenant/Role in Firestore
            if (auth.currentUser && userData.tenantId && userData.role !== 'owner') {
                // Owner doesn't need binding (system-owner tenant)
                await saveUserBinding(auth.currentUser.uid, userData.tenantId, userData.role || 'employee');
            }

            // ✅ FIX: Update TenantContext immediately after login
            // This ensures the tenant context is synced with the logged-in user's tenantId
            if (userData.tenantId) {
                localStorage.setItem('adora_tenant_id', userData.tenantId);
                // Trigger TenantContext update by dispatching a custom event
                window.dispatchEvent(new CustomEvent('tenant-update', { detail: { tenantId: userData.tenantId } }));
            }

            // ✅ AUDIT: Log successful login
            logAudit(
                'LOGIN',
                userData.id,
                userData.name,
                userData.department || 'system',
                'user',
                userData.id,
                { role: userData.role, branchId: branch },
                { targetName: userData.name, tenantId: userData.tenantId, branchId: branch }
            );

            // ✅ CRITICAL FIX: Return role for navigation logic
            return { 
                path: getDepartmentPath(userData.department, userData.role),
                role: userData.role 
            };


        } catch (err: any) {
            // ✅ AUDIT: Log failed login attempt
            logAudit(
                'LOGIN_FAILED',
                'unknown',
                'محاولة دخول فاشلة',
                'system',
                'auth',
                pin.substring(0, 3) + '***', // Partial PIN for security
                { error: err.message, branch },
                {}
            );
            setError(err.message || 'فشل تسجيل الدخول');
            throw err;
        }
    }, []);

    // Login with biometric
    const loginWithBiometric = useCallback(async (): Promise<string> => {
        setError(null);
        try {
            const result = await verifyBiometric();

            if (!result.success || !result.userId) {
                throw new Error('فشل التحقق من البصمة');
            }

            const userData = await getUserById(result.userId);
            if (!userData) {
                throw new Error('المستخدم غير موجود');
            }

            // Sign in to Firebase
            if (auth) {
                try {
                    await signInAnonymously(auth);
                } catch (authError: any) {
                    console.warn('Firebase Auth sign-in failed:', authError?.message);
                }
            }

            setUser(userData);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
            setLastUsers(getLastUsers());

            // ✅ SaaS Security: Bind anonymous UID to Tenant/Role
            if (auth?.currentUser && userData.tenantId) {
                await saveUserBinding(auth.currentUser.uid, userData.tenantId, userData.role || 'employee');
            }

            return getDepartmentPath(userData.department, userData.role);
        } catch (err: any) {
            setError(err.message || 'فشل تسجيل الدخول بالبصمة');
            throw err;
        }
    }, []);

    // Logout
    const logout = useCallback(async () => {
        // ✅ AUDIT: Log logout (before clearing user)
        if (user) {
            logAudit(
                'LOGOUT',
                user.id,
                user.name,
                user.department || 'system',
                'user',
                user.id,
                {},
                { targetName: user.name, tenantId: user.tenantId, branchId: branchId || undefined }
            );
        }
        
        try {
            await auth.signOut();
        } catch (e) {
            console.error('Firebase signOut failed', e);
        }
        setUser(null);
        localStorage.removeItem(USER_STORAGE_KEY);
    }, [user, branchId]);

    // Set branch
    // ✅ CRITICAL FIX: Owner cannot set a branch - they access all branches dynamically
    const setBranch = useCallback((branch: string) => {
        // Prevent owner from setting a branch
        if (user?.role === 'owner') {
            console.warn('Owner cannot set a branch - they access all branches dynamically');
            return;
        }
        setBranchIdState(branch);
        saveBranchId(branch);
    }, [user?.role]);

    const value: AuthContextType = {
        user,
        branchId,
        isAuthenticated: !!user,
        isLoading,
        error,
        lastUsers,
        biometricAvailable,
        login,
        loginWithBiometric,
        logout,
        setBranch,
        // ✅ New props
        authReady,
        tenantId: (user as any)?.tenantId || null,
        role: user?.role || null,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
