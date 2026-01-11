/**
 * Biometric Authentication Service
 * Uses WebAuthn API (FIDO2) - 100% FREE, no API keys needed
 * Supports: Fingerprint, Face ID, Windows Hello, etc.
 */

// ============================================================
// TYPES
// ============================================================

export interface BiometricCredential {
    id: string; // Credential ID
    publicKey: string; // Public key
    userId: string;
    tenantId: string;
    branchId?: string;
    createdAt: Date;
    lastUsed?: Date;
    deviceInfo?: {
        userAgent: string;
        platform: string;
    };
}

export interface BiometricRegistration {
    credentialId: string;
    publicKey: string;
    counter: number;
}

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Check if WebAuthn is supported
 */
export const isBiometricSupported = (): boolean => {
    return !!(
        window.PublicKeyCredential &&
        navigator.credentials &&
        navigator.credentials.create
    );
};

/**
 * Check if user has registered biometric
 */
export const hasBiometricRegistered = async (userId: string, tenantId: string): Promise<boolean> => {
    try {
        const key = `biometric_${tenantId}_${userId}`;
        const stored = localStorage.getItem(key);
        return !!stored;
    } catch {
        return false;
    }
};

/**
 * Check if user has permanently skipped biometric setup (after 5 skips)
 */
export const hasPermanentlySkippedBiometric = (userId: string, tenantId: string): boolean => {
    try {
        const key = `biometric_skip_${tenantId}_${userId}`;
        const skipCount = parseInt(localStorage.getItem(key) || '0', 10);
        return skipCount >= 5; // After 5 skips, don't show again
    } catch {
        return false;
    }
};

/**
 * Record biometric setup skip
 * Returns true if this was the final skip (5th time)
 */
export const recordBiometricSkip = (userId: string, tenantId: string): { skipCount: number; isPermanent: boolean } => {
    try {
        const key = `biometric_skip_${tenantId}_${userId}`;
        const currentCount = parseInt(localStorage.getItem(key) || '0', 10);
        const newCount = currentCount + 1;
        localStorage.setItem(key, String(newCount));
        
        return {
            skipCount: newCount,
            isPermanent: newCount >= 5
        };
    } catch {
        return { skipCount: 0, isPermanent: false };
    }
};

/**
 * Reset biometric skip counter (for testing or if user wants to try again)
 */
export const resetBiometricSkipCounter = (userId: string, tenantId: string): void => {
    const key = `biometric_skip_${tenantId}_${userId}`;
    localStorage.removeItem(key);
};

/**
 * Get current skip count
 */
export const getBiometricSkipCount = (userId: string, tenantId: string): number => {
    try {
        const key = `biometric_skip_${tenantId}_${userId}`;
        return parseInt(localStorage.getItem(key) || '0', 10);
    } catch {
        return 0;
    }
};

/**
 * Register biometric (fingerprint/face) - Called 4-5 times for training
 */
export const registerBiometric = async (
    userId: string,
    tenantId: string,
    branchId?: string,
    attemptNumber: number = 1
): Promise<BiometricRegistration> => {
    if (!isBiometricSupported()) {
        throw new Error('المتصفح لا يدعم تسجيل الدخول بالبصمة');
    }

    try {
        // Generate challenge (random bytes)
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        // Create credential
        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: 'Adora Hotel Management',
                id: window.location.hostname,
            },
            user: {
                id: new TextEncoder().encode(`${tenantId}_${userId}`),
                name: userId,
                displayName: `User ${userId}`,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // Built-in authenticator (fingerprint/face)
                userVerification: 'required',
                requireResidentKey: false,
            },
            timeout: 60000,
            attestation: 'direct',
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        }) as PublicKeyCredential;

        if (!credential) {
            throw new Error('فشل تسجيل البصمة');
        }

        const response = credential.response as AuthenticatorAttestationResponse;
        
        // Store credential locally
        const credentialData: BiometricCredential = {
            id: credential.id,
            publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
            userId,
            tenantId,
            branchId,
            createdAt: new Date(),
            deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
            },
        };

        const key = `biometric_${tenantId}_${userId}`;
        localStorage.setItem(key, JSON.stringify(credentialData));

        // Also store in IndexedDB for better storage
        await storeCredentialInIndexedDB(credentialData);

        return {
            credentialId: credential.id,
            publicKey: arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0)),
            counter: attemptNumber,
        };
    } catch (error: any) {
        console.error('Biometric registration error:', error);
        throw new Error(error.message || 'فشل تسجيل البصمة. يرجى المحاولة مرة أخرى.');
    }
};

/**
 * Authenticate using biometric
 */
export const authenticateWithBiometric = async (
    userId: string,
    tenantId: string
): Promise<boolean> => {
    if (!isBiometricSupported()) {
        throw new Error('المتصفح لا يدعم تسجيل الدخول بالبصمة');
    }

    try {
        // Get stored credential
        const key = `biometric_${tenantId}_${userId}`;
        const stored = localStorage.getItem(key);
        
        if (!stored) {
            throw new Error('لم يتم تسجيل البصمة بعد');
        }

        const credentialData: BiometricCredential = JSON.parse(stored);

        // Generate challenge
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        // Create authentication request
        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            allowCredentials: [
                {
                    id: base64ToArrayBuffer(credentialData.id),
                    type: 'public-key',
                },
            ],
            rpId: window.location.hostname,
            userVerification: 'required',
            timeout: 60000,
        };

        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        }) as PublicKeyCredential;

        if (!assertion) {
            throw new Error('فشل التحقق من البصمة');
        }

        // Update last used
        credentialData.lastUsed = new Date();
        localStorage.setItem(key, JSON.stringify(credentialData));
        await updateCredentialInIndexedDB(credentialData);

        return true;
    } catch (error: any) {
        console.error('Biometric authentication error:', error);
        throw new Error(error.message || 'فشل التحقق من البصمة');
    }
};

/**
 * Delete biometric registration
 */
export const deleteBiometric = async (userId: string, tenantId: string): Promise<void> => {
    const key = `biometric_${tenantId}_${userId}`;
    localStorage.removeItem(key);
    await deleteCredentialFromIndexedDB(tenantId, userId);
};

/**
 * Get biometric info
 */
export const getBiometricInfo = async (
    userId: string,
    tenantId: string
): Promise<BiometricCredential | null> => {
    try {
        const key = `biometric_${tenantId}_${userId}`;
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch {
        return null;
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// IndexedDB helpers for better storage
async function storeCredentialInIndexedDB(credential: BiometricCredential): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AdoraBiometric', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['credentials'], 'readwrite');
            const store = transaction.objectStore('credentials');
            store.put(credential);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
        
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('credentials')) {
                const objectStore = db.createObjectStore('credentials', { keyPath: 'id' });
                objectStore.createIndex('userId', 'userId', { unique: false });
                objectStore.createIndex('tenantId', 'tenantId', { unique: false });
            }
        };
    });
}

async function updateCredentialInIndexedDB(credential: BiometricCredential): Promise<void> {
    return storeCredentialInIndexedDB(credential);
}

async function deleteCredentialFromIndexedDB(tenantId: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AdoraBiometric', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['credentials'], 'readwrite');
            const store = transaction.objectStore('credentials');
            const index = store.index('userId');
            const getRequest = index.getAll(userId);
            
            getRequest.onsuccess = () => {
                getRequest.result.forEach((cred: BiometricCredential) => {
                    if (cred.tenantId === tenantId) {
                        store.delete(cred.id);
                    }
                });
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            };
        };
    });
}
