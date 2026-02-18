/**
 * Payout Service
 * Handles financial redemption requests from employees
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection, doc, runTransaction, serverTimestamp, query, where, orderBy, getDocs
} from 'firebase/firestore';
import { PayoutRequest } from '../types';
import { logger } from './loggerService';

/**
 * Request a payout (Redeem Points)
 * Mandatory: Uses Firestore Transaction
 */
export async function requestPayout(
    tenantId: string,
    userId: string,
    userName: string,
    userDepartment: string,
    pointsToRedeem: number,
    exchangeRate: number
): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, userId);
        const payoutId = doc(collection(db, `tenants/${tenantId}/payout_requests`)).id;
        const payoutRef = doc(db, `tenants/${tenantId}/payout_requests`, payoutId);

        const result = await runTransaction(db, async (transaction) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists()) {
                throw new Error('Employee not found');
            }

            const employeeData = employeeDoc.data();
            const currentPoints = employeeData.currentPoints ?? employeeData.personalPoints ?? 0;

            if (currentPoints < pointsToRedeem) {
                throw new Error('Insufficient points balance');
            }

            const sarValue = pointsToRedeem * exchangeRate;

            // 1. Deduct points from spendable balance
            transaction.update(employeeRef, {
                currentPoints: currentPoints - pointsToRedeem,
                personalPoints: currentPoints - pointsToRedeem, // Sync legacy field
                pendingPayoutPoints: (employeeData.pendingPayoutPoints || 0) + pointsToRedeem
            });

            // 2. Create payout request doc
            transaction.set(payoutRef, {
                id: payoutId,
                userId,
                userName,
                userDepartment,
                pointsAmount: pointsToRedeem,
                monetaryValue: sarValue,
                exchangeRate,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // 3. Log to wallet_transactions
            const transactionRef = doc(collection(db, `tenants/${tenantId}/employees/${userId}/wallet_transactions`));
            transaction.set(transactionRef, {
                userId,
                type: 'redeem',
                points: -pointsToRedeem,
                description: `طلب صرف ${pointsToRedeem} نقطة (بقيمة ${sarValue} ريال)`,
                createdAt: serverTimestamp(),
                requestId: payoutId
            });

            return { success: true, requestId: payoutId };
        });

        return result;
    } catch (error: any) {
        logger.error('Payout Request Failed:', error, 'payoutService');
        return { success: false, error: error.message };
    }
}

/**
 * Get pending requests for an employee
 */
export async function getEmployeePayoutHistory(tenantId: string, userId: string): Promise<PayoutRequest[]> {
    try {
        const q = query(
            collection(db, `tenants/${tenantId}/payout_requests`),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as PayoutRequest);
    } catch (error) {
        logger.error('Error getting payout history:', error, 'payoutService');
        return [];
    }
}

/**
 * ADMIN ONLY: Get all pending payouts across the tenant
 */
export async function getPendingPayouts(tenantId: string): Promise<PayoutRequest[]> {
    try {
        const q = query(
            collection(db, `tenants/${tenantId}/payout_requests`),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => doc.data() as PayoutRequest);
    } catch (error) {
        logger.error('Error getting pending payouts:', error, 'payoutService');
        return [];
    }
}

/**
 * ADMIN ONLY: Approve Payout
 * Status -> approved
 */
export async function approvePayout(tenantId: string, requestId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const payoutRef = doc(db, `tenants/${tenantId}/payout_requests`, requestId);
        await runTransaction(db, async (transaction) => {
            const payoutDoc = await transaction.get(payoutRef);
            if (!payoutDoc.exists()) throw new Error('Request not found');
            if (payoutDoc.data().status !== 'pending') throw new Error('Request already processed');

            transaction.update(payoutRef, {
                status: 'approved',
                processedAt: serverTimestamp(),
                processedBy: adminId
            });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * ADMIN ONLY: Reject Payout
 * Status -> rejected + REFUND POINTS
 */
export async function rejectPayout(tenantId: string, requestId: string, adminId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
        const payoutRef = doc(db, `tenants/${tenantId}/payout_requests`, requestId);

        await runTransaction(db, async (transaction) => {
            const payoutDoc = await transaction.get(payoutRef);
            if (!payoutDoc.exists()) throw new Error('Request not found');
            if (payoutDoc.data().status !== 'pending') throw new Error('Request already processed');

            const data = payoutDoc.data();
            const employeeRef = doc(db, `tenants/${tenantId}/employees`, data.userId);
            const employeeDoc = await transaction.get(employeeRef);

            // 1. Mark as rejected
            transaction.update(payoutRef, {
                status: 'rejected',
                processedAt: serverTimestamp(),
                processedBy: adminId,
                rejectionReason: reason
            });

            // 2. Refund points
            if (employeeDoc.exists()) {
                const currentEmpData = employeeDoc.data();
                transaction.update(employeeRef, {
                    currentPoints: (currentEmpData.currentPoints || 0) + data.pointsAmount,
                    personalPoints: (currentEmpData.personalPoints || 0) + data.pointsAmount
                });
            }

            // 3. Log Refund Transaction
            const logRef = doc(collection(db, `tenants/${tenantId}/employees/${data.userId}/wallet_transactions`));
            transaction.set(logRef, {
                userId: data.userId,
                type: 'adjustment',
                points: data.pointsAmount,
                description: `استرجاع نقاط لرفض طلب الصرف: ${reason}`,
                createdAt: serverTimestamp()
            });
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

