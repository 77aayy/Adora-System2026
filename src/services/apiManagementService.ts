/**
 * API Management & Rate Limiting Service
 * Manages API keys, rate limits, and usage tracking
 */

import { collection, doc, getDoc, setDoc, updateDoc, query, where, getDocs, increment, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface APIKey {
    id: string;
    tenantId: string;
    key: string; // Hashed key
    name: string;
    permissions: string[];
    rateLimit: {
        requestsPerMinute: number;
        requestsPerHour: number;
        requestsPerDay: number;
    };
    status: 'active' | 'suspended' | 'revoked';
    createdAt: Date;
    lastUsed?: Date;
    usageCount: number;
}

export interface APIUsage {
    tenantId: string;
    apiKeyId: string;
    endpoint: string;
    method: string;
    timestamp: Date;
    responseTime: number; // ms
    statusCode: number;
    ipAddress?: string;
}

export interface RateLimitStatus {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    limit: number;
}

// ============================================================
// API KEY MANAGEMENT
// ============================================================

/**
 * Generate API key
 */
export const generateAPIKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = 'ak_';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
};

/**
 * Hash API key (simple hash for demo - use proper hashing in production)
 */
const hashAPIKey = (key: string): string => {
    // Simple hash - use crypto.subtle in production
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
};

/**
 * Create API key
 */
export const createAPIKey = async (
    tenantId: string,
    name: string,
    permissions: string[],
    rateLimit: APIKey['rateLimit']
): Promise<{ key: string; id: string }> => {
    try {
        const key = generateAPIKey();
        const hashedKey = hashAPIKey(key);
        
        const keyRef = doc(collection(db, 'apiKeys'));
        await setDoc(keyRef, {
            tenantId,
            key: hashedKey,
            name,
            permissions,
            rateLimit,
            status: 'active',
            createdAt: serverTimestamp(),
            usageCount: 0
        });
        
        return { key, id: keyRef.id };
    } catch (error) {
        console.error('Error creating API key:', error);
        throw error;
    }
};

/**
 * Get API keys for tenant
 */
export const getAPIKeys = async (tenantId: string): Promise<APIKey[]> => {
    try {
        const q = query(
            collection(db, 'apiKeys'),
            where('tenantId', '==', tenantId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                lastUsed: data.lastUsed?.toDate()
            } as APIKey;
        });
    } catch (error) {
        console.error('Error getting API keys:', error);
        return [];
    }
};

/**
 * Revoke API key
 */
export const revokeAPIKey = async (keyId: string): Promise<void> => {
    try {
        const keyRef = doc(db, 'apiKeys', keyId);
        await updateDoc(keyRef, {
            status: 'revoked',
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error('Error revoking API key:', error);
        throw error;
    }
};

// ============================================================
// RATE LIMITING
// ============================================================

/**
 * Check rate limit
 */
export const checkRateLimit = async (
    tenantId: string,
    apiKeyId: string,
    period: 'minute' | 'hour' | 'day' = 'minute'
): Promise<RateLimitStatus> => {
    try {
        // Get API key
        const keyRef = doc(db, 'apiKeys', apiKeyId);
        const keySnap = await getDoc(keyRef);
        
        if (!keySnap.exists()) {
            return { allowed: false, remaining: 0, resetAt: new Date(), limit: 0 };
        }
        
        const keyData = keySnap.data() as APIKey;
        const limit = keyData.rateLimit[`requestsPer${period.charAt(0).toUpperCase() + period.slice(1)}` as keyof typeof keyData.rateLimit] || 60;
        
        // Check usage in period
        const now = new Date();
        const periodStart = new Date(now);
        
        switch (period) {
            case 'minute':
                periodStart.setMinutes(periodStart.getMinutes() - 1);
                break;
            case 'hour':
                periodStart.setHours(periodStart.getHours() - 1);
                break;
            case 'day':
                periodStart.setDate(periodStart.getDate() - 1);
                break;
        }
        
        // Query usage
        const usageQuery = query(
            collection(db, 'apiUsage'),
            where('tenantId', '==', tenantId),
            where('apiKeyId', '==', apiKeyId),
            where('timestamp', '>=', periodStart)
        );
        const usageSnap = await getDocs(usageQuery);
        const usageCount = usageSnap.size;
        
        const remaining = Math.max(0, limit - usageCount);
        const resetAt = new Date(now);
        
        switch (period) {
            case 'minute':
                resetAt.setMinutes(resetAt.getMinutes() + 1);
                break;
            case 'hour':
                resetAt.setHours(resetAt.getHours() + 1);
                break;
            case 'day':
                resetAt.setDate(resetAt.getDate() + 1);
                break;
        }
        
        return {
            allowed: remaining > 0,
            remaining,
            resetAt,
            limit
        };
    } catch (error) {
        console.error('Error checking rate limit:', error);
        // Fail open - allow request
        return { allowed: true, remaining: 999, resetAt: new Date(), limit: 1000 };
    }
};

/**
 * Record API usage
 */
export const recordAPIUsage = async (usage: Omit<APIUsage, 'timestamp'>): Promise<void> => {
    try {
        await setDoc(doc(collection(db, 'apiUsage')), {
            ...usage,
            timestamp: serverTimestamp()
        });
        
        // Update API key usage count
        const keyRef = doc(db, 'apiKeys', usage.apiKeyId);
        await updateDoc(keyRef, {
            usageCount: increment(1),
            lastUsed: serverTimestamp()
        });
    } catch (error) {
        console.error('Error recording API usage:', error);
        // Don't throw - usage tracking is not critical
    }
};

/**
 * Get API usage stats
 */
export const getAPIUsageStats = async (
    tenantId: string,
    apiKeyId?: string,
    startDate?: Date,
    endDate?: Date
): Promise<APIUsage[]> => {
    try {
        let q = query(collection(db, 'apiUsage'), where('tenantId', '==', tenantId));
        
        if (apiKeyId) {
            q = query(q, where('apiKeyId', '==', apiKeyId));
        }
        
        if (startDate) {
            q = query(q, where('timestamp', '>=', startDate));
        }
        
        if (endDate) {
            q = query(q, where('timestamp', '<=', endDate));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                timestamp: data.timestamp?.toDate() || new Date()
            } as APIUsage;
        });
    } catch (error) {
        console.error('Error getting API usage stats:', error);
        return [];
    }
};
