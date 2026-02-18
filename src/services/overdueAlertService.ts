/**
 * Overdue Alert Service
 * Monitor and alert for delayed/overdue requests
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    onSnapshot,
    Unsubscribe,
} from 'firebase/firestore';
import { getSafeFirestore } from './firebase';
import { playSound, hapticFeedback } from './soundService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface OverdueConfig {
    warningMinutes: number;    // First warning (yellow)
    criticalMinutes: number;   // Critical alert (red)
    checkIntervalMs: number;   // How often to check
}

export interface OverdueRequest {
    id: string;
    roomNumber: string;
    serviceType: string;
    createdAt: Date;
    elapsedMinutes: number;
    level: 'warning' | 'critical';
}

type OverdueCallback = (requests: OverdueRequest[]) => void;

// ============================================================
// STATE
// ============================================================

const DEFAULT_CONFIG: OverdueConfig = {
    warningMinutes: 15,
    criticalMinutes: 30,
    checkIntervalMs: 60000, // 1 minute
};

let checkInterval: ReturnType<typeof setInterval> | null = null;
let unsubscribe: Unsubscribe | null = null;
let pendingRequests: any[] = [];
let callbacks: OverdueCallback[] = [];
let currentConfig = DEFAULT_CONFIG;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Start monitoring for overdue requests
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export function startOverdueMonitoring(
    branchId: string,
    tenantId: string,
    config: Partial<OverdueConfig> = {}
): void {
    currentConfig = { ...DEFAULT_CONFIG, ...config };

    // Stop existing monitoring
    stopOverdueMonitoring();

    // 🔐 SECURITY: Check tenantId before proceeding
    if (!tenantId || !branchId) {
        logger.warn('⚠️ [OverdueAlert] startOverdueMonitoring called without tenantId or branchId', undefined, 'overdueAlertService');
        return;
    }

    // ✅ FIX: Use tenant-scoped collection for SaaS isolation
    if (!tenantId) {
        throw new Error('tenantId is required for SaaS isolation');
    }

    getSafeFirestore().then((safeDb) => {
        if (!safeDb) return;
        const requestsRef = collection(safeDb, 'tenants', tenantId, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('status', 'in', ['PENDING', 'CONFIRMED', 'IN_PROGRESS'])
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
        pendingRequests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
        }));

        // Check immediately on update
        checkOverdueRequests();
    });

        // Start periodic checks
        checkInterval = setInterval(checkOverdueRequests, currentConfig.checkIntervalMs);

        logger.info('⏰ Overdue monitoring started', undefined, 'overdueAlertService');
    });
}

/**
 * Stop monitoring
 */
export function stopOverdueMonitoring(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
    pendingRequests = [];
}

// ============================================================
// CHECK LOGIC
// ============================================================

function checkOverdueRequests(): void {
    const now = new Date();
    const overdueList: OverdueRequest[] = [];

    pendingRequests.forEach(request => {
        const createdAt = request.createdAt instanceof Date
            ? request.createdAt
            : new Date(request.createdAt);

        const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));

        if (elapsedMinutes >= currentConfig.criticalMinutes) {
            overdueList.push({
                id: request.id,
                roomNumber: request.roomNumber,
                serviceType: request.serviceType || request.type,
                createdAt,
                elapsedMinutes,
                level: 'critical',
            });
        } else if (elapsedMinutes >= currentConfig.warningMinutes) {
            overdueList.push({
                id: request.id,
                roomNumber: request.roomNumber,
                serviceType: request.serviceType || request.type,
                createdAt,
                elapsedMinutes,
                level: 'warning',
            });
        }
    });

    // Notify callbacks
    if (overdueList.length > 0) {
        callbacks.forEach(cb => cb(overdueList));

        // Play alert for critical
        const hasCritical = overdueList.some(r => r.level === 'critical');
        if (hasCritical) {
            playSound?.('warning');
            hapticFeedback?.('heavy');
        }
    }
}

// ============================================================
// CALLBACKS
// ============================================================

export function onOverdue(callback: OverdueCallback): () => void {
    callbacks.push(callback);
    return () => {
        callbacks = callbacks.filter(cb => cb !== callback);
    };
}

// ============================================================
// UI COMPONENT
// ============================================================

export function showOverdueAlert(request: OverdueRequest): void {
    const alert = document.createElement('div');
    alert.className = `overdue-alert ${request.level}`;
    alert.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 9998;
        animation: slideIn 0.3s ease;
        display: flex;
        align-items: center;
        gap: 12px;
        ${request.level === 'critical'
            ? 'background: linear-gradient(135deg, #EF4444, #DC2626); color: white;'
            : 'background: linear-gradient(135deg, #F59E0B, #D97706); color: white;'
        }
    `;

    alert.innerHTML = `
        <span style="font-size: 1.5rem;">${request.level === 'critical' ? '🚨' : '⚠️'}</span>
        <div>
            <div style="font-weight: 600;">غرفة ${request.roomNumber}</div>
            <div style="font-size: 0.85rem; opacity: 0.9;">
                ${getServiceLabel(request.serviceType)} - ${request.elapsedMinutes} دقيقة
            </div>
        </div>
    `;

    document.body.appendChild(alert);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

function getServiceLabel(type: string): string {
    const labels: Record<string, string> = {
        cleaning: 'تنظيف',
        maintenance: 'صيانة',
        bellman: 'بيلمان',
        inspection: 'فحص',
    };
    return labels[type] || type;
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect } from 'react';

export function useOverdueAlerts(branchId: string, config?: Partial<OverdueConfig> & { tenantId?: string }) {
    const [overdueRequests, setOverdueRequests] = useState<OverdueRequest[]>([]);

    useEffect(() => {
        if (!branchId || !config?.tenantId) return;

        startOverdueMonitoring(branchId, config.tenantId, config);

        const unsubscribe = onOverdue((requests) => {
            setOverdueRequests(requests);
        });

        return () => {
            unsubscribe();
            stopOverdueMonitoring();
        };
    }, [branchId, config?.tenantId]);

    return {
        overdueRequests,
        warningCount: overdueRequests.filter(r => r.level === 'warning').length,
        criticalCount: overdueRequests.filter(r => r.level === 'critical').length,
    };
}

export default {
    startOverdueMonitoring,
    stopOverdueMonitoring,
    onOverdue,
    showOverdueAlert,
    useOverdueAlerts,
};
