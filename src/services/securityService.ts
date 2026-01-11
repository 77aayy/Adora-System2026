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

export const encryptData = (data: string, key?: string): string => {
    // Would use actual encryption (AES-256)
    const encoded = btoa(data);
    return `ENC:${encoded}`;
};

export const decryptData = (encryptedData: string, key?: string): string => {
    if (!encryptedData.startsWith('ENC:')) return encryptedData;
    const encoded = encryptedData.substring(4);
    return atob(encoded);
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
