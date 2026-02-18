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
import { preloadRouteByPath } from '../hooks/useRoutePreload';
import { signInAnonymously, onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions as firebaseFunctions, setAuthReadyForFirestore, getSafeFirestore } from '../services/firebase';
import { logAudit } from '../utils/auditService';
import { logger } from '../services/loggerService';

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
                    logger.info('Firebase Auth not initialized, skipping auth sync', undefined, 'AuthContext');
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
                // ✅ CRITICAL FIX: Wait longer and ensure auth token is ready
                const firebaseUser = await new Promise<any>(resolve => {
                    let resolved = false;
                    const unsub = auth.onAuthStateChanged(async (user) => {
                        if (resolved) return;
                        resolved = true;
                        unsub();
                        // ✅ CRITICAL: Wait for auth token to be ready (for Firestore Rules)
                        if (user) {
                            try {
                                // Force token refresh to ensure it's available for Firestore Rules
                                await user.getIdToken(true);
                                logger.info('✅ [AuthContext] Auth token refreshed for Firestore Rules', undefined, 'AuthContext');
                            } catch (tokenError: any) {
                                logger.warn('⚠️ [AuthContext] Token refresh failed:', tokenError.message, 'AuthContext');
                            }
                        }
                        resolve(user);
                    });
                    // ⚡ Faster timeout - 500ms instead of 2000ms
                    setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            unsub();
                            resolve(auth.currentUser);
                        }
                    }, 500);
                });

                // 2. Load Local Storage User (Immediate UI Update)
                const storedUser = localStorage.getItem(USER_STORAGE_KEY);
                let appUser: User | null = null;

                if (storedUser) {
                    try {
                        appUser = JSON.parse(storedUser);
                        setUser(appUser);
                        // ⚡ استجابة أسرع: تحميل مسبق لـ chunk لوحة المستخدم أثناء انتظار Firebase
                        if (appUser) {
                            try {
                                preloadRouteByPath(getDepartmentPath(appUser.department ?? '', appUser.role));
                            } catch (_) { /* non-blocking */ }
                        }
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

                // ⚡ Don't block UI: wait at most 1s for owner userBinding, then show app (binding continues in background)
                const MAX_OWNER_BINDING_WAIT_MS = 1000;
                const ownerBindingPromise = (async () => {
                        // ✅ CRITICAL: Always ensure Anonymous Auth for Firestore Rules
                        let currentFirebaseUser = firebaseUser;
                        if (!currentFirebaseUser) {
                            try {
                                const userCredential = await signInAnonymously(auth);
                                currentFirebaseUser = userCredential.user;
                                // ✅ CRITICAL: Force token refresh immediately after anonymous sign-in
                                try {
                                    await currentFirebaseUser.getIdToken(true);
                                    // ✅ CRITICAL: Mark Auth as ready for Firestore operations
                                    setAuthReadyForFirestore(true);
                                } catch (tokenError: any) {
                                    logger.warn('⚠️ [AuthContext] Token refresh after anonymous sign-in failed:', tokenError.message, 'AuthContext');
                                    // Still mark as ready even if token refresh failed
                                    setAuthReadyForFirestore(true);
                                }
                            } catch (e) {
                                logger.error('❌ [AuthContext] Auto-login sync failed', e, 'AuthContext');
                            }
                        } else {
                            // ✅ CRITICAL: Ensure token is fresh even if user already exists
                            try {
                                await currentFirebaseUser.getIdToken(true);
                                logger.info('✅ [AuthContext] Auth token refreshed for existing user', undefined, 'AuthContext');
                                // ✅ CRITICAL: Mark Auth as ready for Firestore operations
                                setAuthReadyForFirestore(true);
                            } catch (tokenError: any) {
                                logger.warn('⚠️ [AuthContext] Token refresh failed:', tokenError.message, 'AuthContext');
                                // Still mark as ready even if token refresh failed
                                setAuthReadyForFirestore(true);
                            }
                        }
                        
                        // ✅ CRITICAL: For owner, ALWAYS create/update userBinding (even if already exists)
                        // ✅ FIX: Wait for auth state to be fully settled before creating userBinding
                        if (appUser && appUser.role === 'owner' && currentFirebaseUser) {
                            const ownerUid = currentFirebaseUser.uid;
                            logger.debug('🔍 [AuthContext] Ensuring owner userBinding exists for UID:', ownerUid, 'AuthContext');
                            
                            // ✅ CRITICAL: Verify auth state is propagated to Firestore Rules
                            // ✅ FIX: Wait longer and force token refresh before testing
                            let authVerified = false;
                            
                            // ✅ CRITICAL: Force token refresh and wait for propagation
                            // ✅ FIX: Use onIdTokenChanged to ensure token is actually updated
                            try {
                                // Wait for token change event (more reliable than just getIdToken)
                                const tokenPromise = new Promise<void>((resolve) => {
                                    const unsubscribe = auth.onIdTokenChanged(async (user) => {
                                        if (user && user.uid === ownerUid) {
                                            unsubscribe();
                                            // Force token refresh one more time
                                            try {
                                                await user.getIdToken(true);
                                                await new Promise(resolve => setTimeout(resolve, 280));
                                            } catch (e) {
                                                logger.warn('⚠️ [AuthContext] Token refresh in listener failed:', e, 'AuthContext');
                                            }
                                            resolve();
                                        }
                                    });
                                    // Fallback: If no token change event, just refresh and wait
                                    setTimeout(async () => {
                                        unsubscribe();
                                        try {
                                            await currentFirebaseUser.getIdToken(true);
                                            await new Promise(resolve => setTimeout(resolve, 280));
                                        } catch (e) {
                                            logger.warn('⚠️ [AuthContext] Fallback token refresh failed:', e, 'AuthContext');
                                        }
                                        resolve();
                                    }, 280);
                                });
                                await tokenPromise;
                            } catch (tokenError: any) {
                                logger.warn('⚠️ [AuthContext] Token refresh failed before verification:', tokenError.message, 'AuthContext');
                                await new Promise(resolve => setTimeout(resolve, 450));
                            }
                            
                            const ownerDb = await getSafeFirestore();
                            if (!ownerDb) {
                                logger.warn('Firestore not ready for owner userBinding', undefined, 'AuthContext');
                            } else {
                            // ✅ Verify auth (fewer attempts / shorter delays so UI can show within ~2s)
                            for (let attempt = 0; attempt < 4; attempt++) {
                                try {
                                    if (!auth.currentUser) {
                                        await new Promise(resolve => setTimeout(resolve, 320));
                                        continue;
                                    }
                                    if (auth.currentUser.uid !== ownerUid) {
                                        await new Promise(resolve => setTimeout(resolve, 320));
                                        continue;
                                    }
                                    const testRef = doc(ownerDb, 'userBindings', ownerUid);
                                    await getDoc(testRef);
                                    authVerified = true;
                                    logger.info(`✅ [AuthContext] Auth verified on attempt ${attempt + 1}`, undefined, 'AuthContext');
                                    break;
                                } catch (testError: any) {
                                    const isChannelError = testError?.code === 400 || testError?.code === 404 ||
                                        testError?.message?.includes('400') || testError?.message?.includes('Listen/channel');
                                    if (isChannelError) {
                                        logger.debug('AuthContext: Listen channel error during verification, continuing', undefined, 'AuthContext');
                                        authVerified = true;
                                        break;
                                    }
                                    if (testError?.code === 'permission-denied') {
                                        try {
                                            if (auth.currentUser) {
                                                await auth.currentUser.getIdToken(true);
                                                await new Promise(resolve => setTimeout(resolve, Math.min(350 + attempt * 100, 600)));
                                            } else {
                                                await new Promise(resolve => setTimeout(resolve, 320));
                                            }
                                        } catch {
                                            await new Promise(resolve => setTimeout(resolve, 320));
                                        }
                                    } else {
                                        authVerified = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!authVerified) {
                                logger.error('❌ [AuthContext] CRITICAL: Auth state not propagated to Firestore Rules after 5 attempts!', undefined, 'AuthContext');
                                logger.error('   This means request.auth is null in Firestore Rules!', undefined, 'AuthContext');
                                logger.error('   ⚠️ System will use localStorage fallback for settings', undefined, 'AuthContext');
                            }
                            
                            try {
                                const userBindingRef = doc(ownerDb, 'userBindings', ownerUid);
                                const bindingData = {
                                    uid: ownerUid, // ✅ CRITICAL: Must include uid field for Firestore Rules
                                    role: 'owner',
                                    tenantId: appUser.tenantId || 'system-owner',
                                    userId: appUser.id || 'owner',
                                    createdAt: serverTimestamp(),
                                    updatedAt: serverTimestamp()
                                };
                                logger.debug('🔍 [AuthContext] Creating/updating owner userBinding:', bindingData, 'AuthContext');
                                
                                await new Promise(resolve => setTimeout(resolve, 80));
                                
                                // ✅ setDoc مع merge + معالجة failed-precondition و 400
                                let created = false;
                                const isWriteChannelError = (e: any) =>
                                    e?.code === 400 || e?.code === 404 ||
                                    e?.message?.includes('400') || e?.message?.includes('Write/channel') || e?.message?.includes('Bad Request');
                                const isRetryableWriteError = (e: any) =>
                                    e?.code === 'failed-precondition' || isWriteChannelError(e);
                                for (let attempt = 0; attempt < 4; attempt++) {
                                    try {
                                        if (attempt > 0) {
                                            await new Promise(resolve => setTimeout(resolve, attempt === 1 ? 400 : 500 + attempt * 200));
                                        }
                                        await setDoc(userBindingRef, {
                                            ...bindingData,
                                            updatedAt: serverTimestamp()
                                        }, { merge: true });
                                        created = true;
                                        break;
                                    } catch (writeError: any) {
                                        if (isWriteChannelError(writeError)) {
                                            logger.debug('AuthContext: Write channel error on setDoc, skip further retries', undefined, 'AuthContext');
                                            const snap = await getDoc(userBindingRef).catch(() => null);
                                            if (snap?.exists()) created = true;
                                            break;
                                        }
                                        const isPrecondition = writeError?.code === 'failed-precondition';
                                        if (isPrecondition && attempt < 3) {
                                            const snap = await getDoc(userBindingRef).catch(() => null);
                                            if (snap?.exists()) {
                                                created = true;
                                                break;
                                            }
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                            continue;
                                        }
                                        if (isRetryableWriteError(writeError) && attempt < 3) {
                                            continue;
                                        }
                                        if (attempt < 3) {
                                            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 400));
                                        }
                                    }
                                }
                                
                                if (!created) {
                                    // ✅ FALLBACK: Try Cloud Function if direct write fails
                                    logger.warn('⚠️ [AuthContext] Direct write failed after 3 attempts, trying Cloud Function...', undefined, 'AuthContext');
                                    try {
                                        if (!firebaseFunctions) {
                                            throw new Error('Firebase Functions not initialized');
                                        }
                                        const createUserBinding = httpsCallable(firebaseFunctions, 'createUserBinding');
                                        logger.info('🔍 [AuthContext] Calling Cloud Function createUserBinding...', undefined, 'AuthContext');
                                        const result = await createUserBinding({
                                            uid: ownerUid,
                                            role: 'owner',
                                            tenantId: appUser.tenantId || 'system-owner',
                                            userId: appUser.id || 'owner'
                                        });
                                        const response = result.data as { success: boolean; error?: string };
                                        if (response.success) {
                                            logger.info('✅ [AuthContext] Owner userBinding created via Cloud Function', undefined, 'AuthContext');
                                            created = true;
                                        } else {
                                            logger.error('❌ [AuthContext] Cloud Function returned error:', response.error, 'AuthContext');
                                            throw new Error(response.error || 'Cloud Function failed');
                                        }
                                    } catch (cfError: any) {
                                        logger.error('❌ [AuthContext] Cloud Function also failed:', {
                                            code: cfError?.code,
                                            message: cfError?.message,
                                            fullError: cfError
                                        }, 'AuthContext');
                                        throw new Error('Failed to create userBinding via all methods');
                                    }
                                }
                                
                                // ✅ VERIFY: Check if userBinding was actually created
                                try {
                                    const verifyDoc = await getDoc(userBindingRef);
                                    if (verifyDoc.exists()) {
                                        logger.debug('✅ [AuthContext] Verified: userBinding exists in Firestore', verifyDoc.data(), 'AuthContext');
                                    } else {
                                        logger.error('❌ [AuthContext] CRITICAL: userBinding was NOT created in Firestore!', undefined, 'AuthContext');
                                    }
                                } catch (verifyError: any) {
                                    logger.error('❌ [AuthContext] Error verifying userBinding:', verifyError, 'AuthContext');
                                }
                            } catch (bindingError: any) {
                                const isChannelError = bindingError?.code === 400 || bindingError?.code === 404 ||
                                    bindingError?.message?.includes('400') || bindingError?.message?.includes('Write/channel') || bindingError?.message?.includes('Listen/channel');
                                if (isChannelError) {
                                    logger.debug('AuthContext: Write/Listen channel error creating userBinding', undefined, 'AuthContext');
                                } else {
                                    logger.error('❌ [AuthContext] CRITICAL: Failed to create owner userBinding:', {
                                        code: bindingError?.code,
                                        message: bindingError?.message,
                                        uid: ownerUid,
                                        fullError: bindingError
                                    }, 'AuthContext');
                                    logger.error('   This will cause permission-denied errors in Firestore Rules!', undefined, 'AuthContext');
                                }
                            }
                            }
                        } else if (appUser && !firebaseUser) {
                            // For non-owner users, create userBinding normally
                            try {
                                const userCredential = await signInAnonymously(auth);
                                // ✅ Re-bind UID to Tenant/Role for Security Rules
                                if (userCredential.user && appUser.tenantId) {
                                    await saveUserBinding(userCredential.user.uid, appUser.tenantId, appUser.role || 'employee');
                                }
                            } catch (e) {
                                logger.error('Auto-login sync failed', e, 'AuthContext');
                            }
                        }
                })();

                const [_, securityCheckResult, bioAvailable] = await Promise.allSettled([
                    // Wait at most MAX_OWNER_BINDING_WAIT_MS so UI doesn't block; binding continues in background
                    Promise.race([
                        ownerBindingPromise,
                        new Promise<void>(r => setTimeout(r, MAX_OWNER_BINDING_WAIT_MS))
                    ]),
                    // 🛑 SECURITY CHECK (Kill Switch) - Run in parallel
                    (async () => {
                        if (appUser && appUser.tenantId && appUser.role !== 'owner' && appUser.tenantId !== 'system-owner') {
                            const safeDb = await getSafeFirestore();
                            if (!safeDb) return; // Skip when Firestore not ready; avoids collection() invalid-arg error
                            try {
                                const tenantRef = doc(safeDb, 'tenants', appUser.tenantId);
                                const tenantSnap = await getDoc(tenantRef);
                                if (tenantSnap.exists()) {
                                    const tenantData = tenantSnap.data();
                                    if (tenantData.status === 'suspended') {
                                        throw new Error('ACCOUNT_SUSPENDED');
                                    }
                                }
                            } catch (securityError: any) {
                                if (securityError.message === 'ACCOUNT_SUSPENDED') {
                                    logger.error('🚫 Account Suspended', undefined, 'AuthContext');
                                    localStorage.removeItem(USER_STORAGE_KEY);
                                    if (mounted) {
                                        setUser(null);
                                        setBranchIdState(null);
                                    }
                                    throw securityError; // Re-throw to stop execution
                                }
                                // Ignore permission errors or network errors during initial load
                                logger.warn('Non-fatal security check warning:', securityError.message, 'AuthContext');
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
                logger.error('Auth Init Error:', err, 'AuthContext');
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
                    // ✅ CRITICAL: Sign out any existing anonymous user first to avoid conflicts
                    if (auth.currentUser && auth.currentUser.isAnonymous) {
                        try {
                            await auth.signOut();
                            logger.info('✅ [AuthContext] Signed out existing anonymous user', undefined, 'AuthContext');
                            await new Promise(resolve => setTimeout(resolve, 250));
                        } catch (signOutError: any) {
                            logger.warn('⚠️ [AuthContext] Sign out failed (non-critical):', signOutError.message, 'AuthContext');
                        }
                    }
                    
                    const userCredential = await signInAnonymously(auth);
                    logger.info('✅ Firebase Anonymous Auth succeeded', undefined, 'AuthContext');
                    
                    // ✅ CRITICAL: Force token refresh immediately after anonymous sign-in
                    // This ensures Firestore Rules can read request.auth
                    try {
                        await userCredential.user.getIdToken(true);
                        logger.info('✅ [AuthContext] Token refreshed after anonymous sign-in', undefined, 'AuthContext');
                        await new Promise(resolve => setTimeout(resolve, 450));
                        // ✅ CRITICAL: Mark Auth as ready for Firestore operations
                        setAuthReadyForFirestore(true);
                    } catch (tokenError: any) {
                        logger.warn('⚠️ [AuthContext] Token refresh after anonymous sign-in failed:', tokenError.message, 'AuthContext');
                        // Still mark as ready even if token refresh failed
                        setAuthReadyForFirestore(true);
                    }
                    
                    // ✅ For owner: Create/update userBinding to mark as owner in Firestore Rules
                    if (userData.role === 'owner' && auth.currentUser) {
                        const ownerUid = auth.currentUser.uid;
                        logger.info('🔍 [AuthContext] Creating owner userBinding for UID:', ownerUid, 'AuthContext');
                        
                        // ✅ CRITICAL: Wait for token to propagate to Firestore Rules
                        await new Promise(resolve => setTimeout(resolve, 550));
                        
                        try {
                            // ✅ CRITICAL: Use getSafeFirestore to ensure Auth is ready
                            const safeDb = await getSafeFirestore();
                            if (!safeDb) {
                                throw new Error('Firestore not ready');
                            }
                            
                            const userBindingRef = doc(safeDb, 'userBindings', ownerUid);
                            const bindingData = {
                                uid: ownerUid, // ✅ CRITICAL: Must include uid field for Firestore Rules
                                role: 'owner',
                                tenantId: userData.tenantId || 'system-owner',
                                userId: userData.id,
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            };
                            logger.info('🔍 [AuthContext] userBinding data:', bindingData, 'AuthContext');
                            for (let w = 0; w < 3; w++) {
                                try {
                                    await setDoc(userBindingRef, bindingData, { merge: true });
                                    break;
                                } catch (we: any) {
                                    if (we?.message?.includes('400') || we?.message?.includes('Bad Request') || we?.code === 'failed-precondition') {
                                        if (w < 2) await new Promise(r => setTimeout(r, 500 + w * 400));
                                        else throw we;
                                    } else throw we;
                                }
                            }
                            logger.info('✅ [AuthContext] Owner userBinding created/updated for Firestore Rules', undefined, 'AuthContext');
                            
                            // ✅ CRITICAL: Force token refresh again after userBinding creation
                            try {
                                await auth.currentUser.getIdToken(true);
                                logger.info('✅ [AuthContext] Token refreshed after userBinding creation', undefined, 'AuthContext');
                                // Wait for token to propagate
                                await new Promise(resolve => setTimeout(resolve, 250));
                            } catch (tokenError2: any) {
                                logger.warn('⚠️ [AuthContext] Token refresh after userBinding creation failed:', tokenError2.message, 'AuthContext');
                            }
                            
                            // ✅ VERIFY: Check if userBinding was actually created
                            try {
                                const verifyDoc = await getDoc(userBindingRef);
                                if (verifyDoc.exists()) {
                                    logger.debug('✅ [AuthContext] Verified: userBinding exists in Firestore', verifyDoc.data(), 'AuthContext');
                                } else {
                                    logger.error('❌ [AuthContext] CRITICAL: userBinding was NOT created in Firestore!', undefined, 'AuthContext');
                                }
                            } catch (verifyError: any) {
                                logger.error('❌ [AuthContext] Error verifying userBinding:', verifyError, 'AuthContext');
                            }
                        } catch (bindingError: any) {
                            logger.error('❌ [AuthContext] CRITICAL: Failed to create owner userBinding:', {
                                code: bindingError?.code,
                                message: bindingError?.message,
                                uid: ownerUid,
                                fullError: bindingError
                            }, 'AuthContext');
                            logger.error('   This will cause permission-denied errors in Firestore Rules!', undefined, 'AuthContext');
                        }
                    }
                } catch (authError: any) {
                    // 🚨 CRITICAL ERROR: Anonymous Auth MUST be enabled!
                    if (authError?.code === 'auth/operation-not-allowed') {
                        logger.error('🚨 CRITICAL: Anonymous Authentication is NOT enabled in Firebase Console!', undefined, 'AuthContext');
                        logger.error('   Go to: Firebase Console → Authentication → Sign-in method → Anonymous → Enable', undefined, 'AuthContext');
                        // Continue with limited functionality (read-only mode)
                    } else {
                        logger.error('❌ Firebase Auth sign-in failed:', authError?.message, 'AuthContext');
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

            // ✅ Phase 0: Ensure userBinding exists for tenant users (required for Firestore tenant isolation rules)
            if (auth.currentUser && userData.tenantId && userData.role !== 'owner') {
                await saveUserBinding(auth.currentUser.uid, userData.tenantId, userData.role || 'employee');
                if (db) {
                    try {
                        const bindingRef = doc(db, 'userBindings', auth.currentUser.uid);
                        const bindingSnap = await getDoc(bindingRef);
                        if (!bindingSnap.exists()) {
                            logger.warn('userBinding missing after saveUserBinding, retrying once', undefined, 'AuthContext');
                            await saveUserBinding(auth.currentUser.uid, userData.tenantId, userData.role || 'employee');
                        }
                    } catch (e) {
                        logger.warn('Could not verify userBinding after login', e, 'AuthContext');
                    }
                }
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
                    logger.warn('Firebase Auth sign-in failed:', authError?.message, 'AuthContext');
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
            logger.error('Firebase signOut failed', e, 'AuthContext');
        }
        setUser(null);
        localStorage.removeItem(USER_STORAGE_KEY);
    }, [user, branchId]);

    // Set branch
    // ✅ CRITICAL FIX: Owner cannot set a branch - they access all branches dynamically
    const setBranch = useCallback((branch: string) => {
        // Prevent owner from setting a branch
        if (user?.role === 'owner') {
            logger.warn('Owner cannot set a branch - they access all branches dynamically', undefined, 'AuthContext');
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
