// src/services/vaultService.ts
/**
 * 🏦 Vault Service - Bank-Grade Atomic Transactions
 * Ensures data integrity for all financial operations using Firestore Transactions
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    doc,
    runTransaction,
    serverTimestamp,
    collection,
    addDoc,
    Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface AuditLogEntry {
    action: string;
    actorId: string;
    actorName?: string;
    timestamp: Date;
    note?: string;
}

interface PayoutResult {
    success: boolean;
    message: string;
    newBalance?: number;
}

// ============================================================
// ATOMIC PAYOUT PROCESSING
// ============================================================

/**
 * 🏦 Bank-Grade: Process payout request as atomic transaction
 * Either ALL operations succeed, or NONE do. No gray area.
 */
export const processSecurePayout = async (
    requestId: string,
    adminId: string,
    adminName: string,
    action: 'approve' | 'reject'
): Promise<PayoutResult> => {
    return await runTransaction(db, async (transaction) => {
        // 1. Read the payout request
        const requestRef = doc(db, 'payout_requests', requestId);
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) {
            throw new Error("PAYOUT_REQUEST_NOT_FOUND");
        }

        const requestData = requestSnap.data();

        // 2. Prevent double-processing
        if (requestData.status !== 'pending') {
            throw new Error(`ALREADY_PROCESSED: ${requestData.status}`);
        }

        // 3. Read user for balance
        const userRef = doc(db, 'users', requestData.userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
            throw new Error("USER_NOT_FOUND");
        }

        const userData = userSnap.data();
        const currentPoints = userData.currentPoints || 0;

        // 4. Build audit log entry
        const auditEntry: AuditLogEntry = {
            action: `PAYOUT_${action.toUpperCase()}`,
            actorId: adminId,
            actorName: adminName,
            timestamp: new Date(),
            note: action === 'reject' ? 'تم رفض الطلب وإعادة النقاط' : 'تم قبول الطلب'
        };

        // 5. Update payout request status
        transaction.update(requestRef, {
            status: action === 'approve' ? 'approved' : 'rejected',
            processedAt: serverTimestamp(),
            processedBy: adminId,
            auditLog: [...(requestData.auditLog || []), auditEntry]
        });

        let newBalance = currentPoints;

        // 6. If REJECTED: Refund points immediately (Atomic)
        if (action === 'reject') {
            newBalance = currentPoints + requestData.pointsAmount;
            transaction.update(userRef, {
                currentPoints: newBalance
            });
        }

        return {
            success: true,
            message: action === 'approve'
                ? 'تم قبول طلب الصرف بنجاح'
                : 'تم رفض الطلب وإعادة النقاط للمحفظة',
            newBalance
        };
    });
};

// ============================================================
// ATOMIC POINTS TRANSFER
// ============================================================

/**
 * 🏦 Bank-Grade: Transfer points between users atomically
 */
export const transferPointsSecure = async (
    fromUserId: string,
    toUserId: string,
    amount: number,
    reason: string,
    actorId: string
): Promise<{ success: boolean; message: string }> => {
    if (amount <= 0) throw new Error("INVALID_AMOUNT");

    return await runTransaction(db, async (transaction) => {
        const fromRef = doc(db, 'users', fromUserId);
        const toRef = doc(db, 'users', toUserId);

        const fromSnap = await transaction.get(fromRef);
        const toSnap = await transaction.get(toRef);

        if (!fromSnap.exists() || !toSnap.exists()) {
            throw new Error("USER_NOT_FOUND");
        }

        const fromData = fromSnap.data();
        const toData = toSnap.data();

        // Check sufficient balance
        if ((fromData.currentPoints || 0) < amount) {
            throw new Error("INSUFFICIENT_BALANCE");
        }

        // Atomic debit & credit
        transaction.update(fromRef, {
            currentPoints: (fromData.currentPoints || 0) - amount
        });

        transaction.update(toRef, {
            currentPoints: (toData.currentPoints || 0) + amount,
            lifetimePoints: (toData.lifetimePoints || 0) + amount
        });

        return {
            success: true,
            message: `تم تحويل ${amount} نقطة بنجاح`
        };
    });
};

// ============================================================
// ATOMIC PAYOUT REQUEST CREATION
// ============================================================

/**
 * 🏦 Bank-Grade: Create payout request with instant point deduction
 * Points are deducted IMMEDIATELY to prevent double-spend
 */
export const createSecurePayoutRequest = async (
    tenantId: string,
    userId: string,
    userName: string,
    userDepartment: string,
    pointsAmount: number,
    exchangeRate: number
): Promise<string> => {
    if (pointsAmount <= 0) throw new Error("INVALID_AMOUNT");

    return await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) throw new Error("USER_NOT_FOUND");

        const userData = userSnap.data();
        const currentPoints = userData.currentPoints || 0;

        if (currentPoints < pointsAmount) {
            throw new Error("INSUFFICIENT_BALANCE");
        }

        // 1. Deduct points IMMEDIATELY (prevent double-spend)
        transaction.update(userRef, {
            currentPoints: currentPoints - pointsAmount
        });

        // 2. Create payout request document
        const payoutData = {
            tenantId,
            userId,
            userName,
            userDepartment,
            pointsAmount,
            monetaryValue: pointsAmount * exchangeRate,
            exchangeRate,
            status: 'pending',
            createdAt: serverTimestamp(),
            auditLog: [{
                action: 'PAYOUT_REQUESTED',
                actorId: userId,
                actorName: userName,
                timestamp: new Date()
            }]
        };

        // Note: We can't use addDoc inside transaction, so we generate ID
        const newDocRef = doc(collection(db, 'payout_requests'));
        transaction.set(newDocRef, payoutData);

        return newDocRef.id;
    });
};

// ============================================================
// AUDIT TRAIL
// ============================================================

/**
 * 📝 Record audit entry for any sensitive operation
 */
export const recordAudit = async (
    tenantId: string,
    entityType: 'user' | 'branch' | 'payout' | 'room' | 'request',
    entityId: string,
    action: string,
    actorId: string,
    actorName: string,
    details?: Record<string, any>
): Promise<void> => {
    await addDoc(collection(db, `tenants/${tenantId}/audit_logs`), {
        entityType,
        entityId,
        action,
        actorId,
        actorName,
        details,
        timestamp: serverTimestamp(),
        ip: typeof window !== 'undefined' ? 'client' : 'server'
    });
};
