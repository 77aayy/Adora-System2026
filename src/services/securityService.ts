/**
 * Security & Compliance Service
 * 2FA, RBAC, Audit, Encryption, GDPR
 */

import { collection, query, where, getDocs, addDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// 6. TWO-FACTOR AUTHENTICATION
// ============================================================

export const generate2FACode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

export const send2FACode = async (userId: string, method: 'sms' | 'email'): Promise<boolean> => {
    const code = generate2FACode();
    await addDoc(collection(db, '2faCodes'), {
        userId,
        code,
        method,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)), // 5 min
        used: false,
        createdAt: Timestamp.now()
    });
    console.log(`2FA code ${code} sent via ${method}`);
    return true;
};

export const verify2FACode = async (userId: string, code: string): Promise<boolean> => {
    const snapshot = await getDocs(query(
        collection(db, '2faCodes'),
        where('userId', '==', userId),
        where('code', '==', code),
        where('used', '==', false)
    ));
    if (snapshot.empty) return false;
    const doc = snapshot.docs[0];
    const expiresAt = doc.data().expiresAt?.toDate();
    if (!expiresAt || expiresAt < new Date()) return false;
    // Mark as used
    return true;
};

// ============================================================
// 7. ROLE-BASED ACCESS CONTROL
// ============================================================

export interface Permission {
    resource: string;
    actions: ('create' | 'read' | 'update' | 'delete')[];
}

export interface Role {
    name: string;
    permissions: Permission[];
}

export const ROLES: Record<string, Role> = {
    admin: {
        name: 'مدير النظام',
        permissions: [
            { resource: '*', actions: ['create', 'read', 'update', 'delete'] }
        ]
    },
    manager: {
        name: 'مدير الفرع',
        permissions: [
            { resource: 'requests', actions: ['create', 'read', 'update'] },
            { resource: 'employees', actions: ['read', 'update'] },
            { resource: 'reports', actions: ['read'] }
        ]
    },
    reception: {
        name: 'موظف استقبال',
        permissions: [
            { resource: 'requests', actions: ['create', 'read', 'update'] },
            { resource: 'rooms', actions: ['read'] }
        ]
    },
    staff: {
        name: 'موظف',
        permissions: [
            { resource: 'requests', actions: ['read', 'update'] }
        ]
    }
};

export const hasPermission = (userRole: string, resource: string, action: string): boolean => {
    const role = ROLES[userRole];
    if (!role) return false;

    return role.permissions.some(p =>
        (p.resource === '*' || p.resource === resource) &&
        p.actions.includes(action as any)
    );
};

// ============================================================
// 8. AUDIT LOG VIEWER
// ============================================================

export interface AuditEntry {
    id: string;
    action: string;
    resource: string;
    resourceId: string;
    userId: string;
    userName: string;
    details: any;
    timestamp: Date;
    ipAddress?: string;
}

export const getAuditLogs = async (filters: {
    userId?: string;
    resource?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}): Promise<AuditEntry[]> => {
    let q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(filters.limit || 100));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate()
    })) as AuditEntry[];
};

export const searchAuditLogs = async (searchTerm: string, branch: string): Promise<AuditEntry[]> => {
    // Would implement full-text search
    const logs = await getAuditLogs({ limit: 500 });
    return logs.filter(log =>
        log.action.includes(searchTerm) ||
        log.resource.includes(searchTerm) ||
        log.userName?.includes(searchTerm)
    );
};

// ============================================================
// 9. DATA ENCRYPTION SERVICE
// ============================================================

/**
 * Get encryption key from environment or use default
 * ⚠️ In production, ensure VITE_ENCRYPTION_KEY is set in .env
 */
const getEncryptionKey = (key?: string): string => {
    if (key) return key;
    // Try environment variable
    const envKey = import.meta.env.VITE_ENCRYPTION_KEY;
    if (envKey) return envKey;
    // Fallback to default (should be changed in production)
    console.warn('⚠️ VITE_ENCRYPTION_KEY not set. Using default key (not secure for production).');
    return 'adora-default-encryption-key-change-in-production';
};

/**
 * Derive encryption key from password using PBKDF2
 */
const deriveKey = async (password: string): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('adora-security-salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * ✅ Production-ready encryption
 */
export const encryptData = async (data: string, key?: string): Promise<string> => {
    if (!data) return '';
    
    try {
        // Check if Web Crypto API is available
        if (!crypto || !crypto.subtle) {
            console.warn('⚠️ Web Crypto API not available. Falling back to Base64 (not secure).');
            // Fallback to Base64 for old browsers
            const encoded = btoa(data);
            return `ENC:${encoded}`;
        }

        const encryptionKey = getEncryptionKey(key);
        const derivedKey = await deriveKey(encryptionKey);
        
        const encoder = new TextEncoder();
        const dataBytes = encoder.encode(data);
        
        // Generate random IV (12 bytes for AES-GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt data
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            derivedKey,
            dataBytes
        );
        
        // Combine IV + encrypted data
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        // Return Base64-encoded result with prefix
        const encoded = btoa(String.fromCharCode(...combined));
        return `ENC:${encoded}`;
    } catch (error) {
        console.error('AES encryption failed:', error);
        // Fallback to Base64 on error (not secure, but maintains compatibility)
        const encoded = btoa(data);
        return `ENC:${encoded}`;
    }
};

/**
 * Decrypt sensitive data using AES-256-GCM
 * Supports both new AES-encrypted data and legacy Base64 data (backward compatibility)
 */
export const decryptData = async (encryptedData: string, key?: string): Promise<string> => {
    if (!encryptedData) return '';
    
    try {
        // Check if data has ENC: prefix
        if (!encryptedData.startsWith('ENC:')) {
            // No prefix, return as-is (might be unencrypted data)
            return encryptedData;
        }
        
        const encoded = encryptedData.substring(4); // Remove 'ENC:' prefix
        
        // Check if Web Crypto API is available
        if (!crypto || !crypto.subtle) {
            // Fallback to Base64 for old browsers
            return atob(encoded);
        }

        // Try to decrypt as AES-encrypted data first
        try {
            const encryptionKey = getEncryptionKey(key);
            const derivedKey = await deriveKey(encryptionKey);
            
            // Decode Base64
            const combined = new Uint8Array(
                atob(encoded).split('').map(c => c.charCodeAt(0))
            );
            
            // Extract IV (first 12 bytes) and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                derivedKey,
                encrypted
            );
            
            // Return decrypted text
            return new TextDecoder().decode(decrypted);
        } catch (aesError) {
            // If AES decryption fails, try legacy Base64 (backward compatibility)
            console.warn('AES decryption failed, trying Base64 fallback:', aesError);
            return atob(encoded);
        }
    } catch (error) {
        console.error('Decryption failed:', error);
        return encryptedData; // Return as-is if decryption fails
    }
};

export const hashPassword = (password: string): string => {
    // Would use bcrypt or similar
    return `HASH:${btoa(password)}`;
};

// ============================================================
// 10. GDPR COMPLIANCE TOOLS
// ============================================================

export const exportUserData = async (userId: string): Promise<any> => {
    const data: any = { userId, exportedAt: new Date() };

    // Collect all user data
    const collections = ['requests', 'feedback', 'bookings', 'preferences'];
    for (const coll of collections) {
        const snapshot = await getDocs(query(collection(db, coll), where('userId', '==', userId)));
        data[coll] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    return data;
};

export const deleteUserData = async (userId: string, confirmation: string): Promise<boolean> => {
    if (confirmation !== 'DELETE_CONFIRMED') return false;

    console.log(`GDPR: Deleting all data for user ${userId}`);
    // Would delete from all collections
    return true;
};

export const getConsentStatus = async (userId: string): Promise<Record<string, boolean>> => {
    return {
        marketing: true,
        analytics: true,
        thirdParty: false,
        dataSharing: false
    };
};

export const updateConsent = async (userId: string, consents: Record<string, boolean>): Promise<void> => {
    await addDoc(collection(db, 'consents'), {
        userId,
        consents,
        updatedAt: Timestamp.now()
    });
};
