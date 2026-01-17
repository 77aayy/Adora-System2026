/**
 * Financial Tracking Service
 * متابعة مالية للطلبات والخدمات
 * 
 * ✅ Features:
 * - Track request costs
 * - Room billing summary
 * - Department revenue reports
 * - Export to accounting
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp,
    increment,
    runTransaction
} from 'firebase/firestore';
import { validateTenantId, validateTenantAccess } from './tenantSecurityService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface FinancialTransaction {
    id?: string;
    tenantId: string;
    branchId: string;
    roomNumber: string;
    guestId?: string;
    guestName?: string;
    type: 'room_service' | 'minibar' | 'laundry' | 'other' | 'penalty' | 'bonus';
    category: string;
    description: string;
    amount: number;
    currency: string;
    status: 'pending' | 'confirmed' | 'paid' | 'cancelled';
    requestId?: string;
    employeeId?: string;
    employeeName?: string;
    confirmedBy?: string;
    confirmedAt?: Timestamp;
    paidAt?: Timestamp;
    notes?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
}

export interface RoomBillSummary {
    roomNumber: string;
    guestName?: string;
    totalAmount: number;
    pendingAmount: number;
    confirmedAmount: number;
    paidAmount: number;
    transactions: FinancialTransaction[];
    lastUpdated?: Timestamp;
}

export interface DepartmentRevenue {
    department: string;
    totalRevenue: number;
    transactionCount: number;
    averageTransaction: number;
    topItems: { name: string; count: number; revenue: number }[];
}

export interface DailyFinancialReport {
    date: string;
    totalRevenue: number;
    totalTransactions: number;
    byDepartment: Record<string, number>;
    byRoom: Record<string, number>;
}

// ============================================================
// TRANSACTION FUNCTIONS
// ============================================================

/**
 * Create a new financial transaction
 */
export async function createTransaction(
    transaction: Omit<FinancialTransaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
    const transactionsRef = collection(
        db, 
        `tenants/${transaction.tenantId}/branches/${transaction.branchId}/financial_transactions`
    );

    const docRef = await addDoc(transactionsRef, {
        ...transaction,
        status: transaction.status || 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Update room bill summary
    await updateRoomBillSummary(
        transaction.tenantId,
        transaction.branchId,
        transaction.roomNumber,
        transaction.amount,
        'pending'
    );

    return docRef.id;
}

/**
 * Confirm a transaction (reception approved)
 */
export async function confirmTransaction(
    tenantId: string,
    branchId: string,
    transactionId: string,
    confirmedBy: string
): Promise<void> {
    const transactionRef = doc(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions/${transactionId}`
    );

    const transactionSnap = await getDoc(transactionRef);
    if (!transactionSnap.exists()) throw new Error('Transaction not found');

    const transaction = transactionSnap.data() as FinancialTransaction;

    await updateDoc(transactionRef, {
        status: 'confirmed',
        confirmedBy,
        confirmedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Update summary
    await updateRoomBillSummary(
        tenantId,
        branchId,
        transaction.roomNumber,
        transaction.amount,
        'confirmed'
    );
}

/**
 * Mark transaction as paid
 */
export async function markTransactionPaid(
    tenantId: string,
    branchId: string,
    transactionId: string
): Promise<void> {
    const transactionRef = doc(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions/${transactionId}`
    );

    const transactionSnap = await getDoc(transactionRef);
    if (!transactionSnap.exists()) throw new Error('Transaction not found');

    const transaction = transactionSnap.data() as FinancialTransaction;

    await updateDoc(transactionRef, {
        status: 'paid',
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    // Update summary
    await updateRoomBillSummary(
        tenantId,
        branchId,
        transaction.roomNumber,
        transaction.amount,
        'paid'
    );
}

/**
 * Cancel a transaction
 */
export async function cancelTransaction(
    tenantId: string,
    branchId: string,
    transactionId: string,
    reason: string
): Promise<void> {
    const transactionRef = doc(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions/${transactionId}`
    );

    const transactionSnap = await getDoc(transactionRef);
    if (!transactionSnap.exists()) throw new Error('Transaction not found');

    const transaction = transactionSnap.data() as FinancialTransaction;

    await updateDoc(transactionRef, {
        status: 'cancelled',
        notes: reason,
        updatedAt: serverTimestamp()
    });

    // Deduct from summary
    await updateRoomBillSummary(
        tenantId,
        branchId,
        transaction.roomNumber,
        -transaction.amount,
        transaction.status as 'pending' | 'confirmed'
    );
}

// ============================================================
// ROOM BILL FUNCTIONS
// ============================================================

/**
 * Update room bill summary
 * ✅ ATOMIC: Uses runTransaction to prevent Race Conditions
 */
async function updateRoomBillSummary(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    amount: number,
    statusType: 'pending' | 'confirmed' | 'paid'
): Promise<void> {
    if (!db) {
        logger.error('Firebase not initialized - cannot update room bill summary', undefined, 'financialTrackingService');
        return;
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    const summaryRef = doc(
        db,
        `tenants/${validatedTenantId}/branches/${branchId}/room_bills/${roomNumber}`
    );

    // ✅ ATOMIC TRANSACTION: Update room bill summary
    await runTransaction(db, async (transaction) => {
        const summarySnap = await transaction.get(summaryRef);

        if (summarySnap.exists()) {
            const currentData = summarySnap.data();
            const updates: any = {
                roomNumber,
                lastUpdated: serverTimestamp()
            };

            if (statusType === 'pending') {
                updates.pendingAmount = increment(amount);
                updates.totalAmount = increment(amount);
            } else if (statusType === 'confirmed') {
                const currentPending = currentData.pendingAmount || 0;
                const currentConfirmed = currentData.confirmedAmount || 0;
                updates.pendingAmount = currentPending - amount; // Use set instead of increment for atomicity
                updates.confirmedAmount = currentConfirmed + amount;
            } else if (statusType === 'paid') {
                const currentConfirmed = currentData.confirmedAmount || 0;
                const currentPaid = currentData.paidAmount || 0;
                updates.confirmedAmount = currentConfirmed - amount;
                updates.paidAmount = currentPaid + amount;
            }

            transaction.update(summaryRef, updates);
        } else {
            // Create new summary
            const newSummary = {
                roomNumber,
                totalAmount: statusType === 'pending' ? amount : 0,
                pendingAmount: statusType === 'pending' ? amount : 0,
                confirmedAmount: statusType === 'confirmed' ? amount : 0,
                paidAmount: statusType === 'paid' ? amount : 0,
                lastUpdated: serverTimestamp()
            };
            transaction.set(summaryRef, newSummary);
        }
    });
}

/**
 * Get room bill summary
 */
export async function getRoomBillSummary(
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<RoomBillSummary | null> {
    // Get summary
    const summaryRef = doc(
        db,
        `tenants/${tenantId}/branches/${branchId}/room_bills/${roomNumber}`
    );
    const summarySnap = await getDoc(summaryRef);

    // Get transactions
    const transactionsRef = collection(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions`
    );
    const q = query(
        transactionsRef,
        where('roomNumber', '==', roomNumber),
        where('status', 'in', ['pending', 'confirmed']),
        orderBy('createdAt', 'desc')
    );
    const transactionsSnap = await getDocs(q);

    const transactions = transactionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as FinancialTransaction[];

    if (!summarySnap.exists() && transactions.length === 0) {
        return null;
    }

    const summaryData = summarySnap.data() || {};

    return {
        roomNumber,
        guestName: summaryData.guestName,
        totalAmount: summaryData.totalAmount || 0,
        pendingAmount: summaryData.pendingAmount || 0,
        confirmedAmount: summaryData.confirmedAmount || 0,
        paidAmount: summaryData.paidAmount || 0,
        transactions,
        lastUpdated: summaryData.lastUpdated
    };
}

/**
 * Get all active room bills
 */
export async function getActiveRoomBills(
    tenantId: string,
    branchId: string
): Promise<RoomBillSummary[]> {
    const billsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/room_bills`);
    const q = query(billsRef, where('pendingAmount', '>', 0));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        roomNumber: doc.id,
        ...doc.data()
    })) as RoomBillSummary[];
}

// ============================================================
// REPORTING FUNCTIONS
// ============================================================

/**
 * Get department revenue report
 */
export async function getDepartmentRevenue(
    tenantId: string,
    branchId: string,
    startDate: Date,
    endDate: Date
): Promise<DepartmentRevenue[]> {
    const transactionsRef = collection(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions`
    );
    const q = query(
        transactionsRef,
        where('status', 'in', ['confirmed', 'paid']),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);

    const departmentMap = new Map<string, {
        total: number;
        count: number;
        items: Map<string, { count: number; revenue: number }>;
    }>();

    snapshot.docs.forEach(doc => {
        const data = doc.data() as FinancialTransaction;
        const dept = data.type;
        
        if (!departmentMap.has(dept)) {
            departmentMap.set(dept, { total: 0, count: 0, items: new Map() });
        }

        const deptData = departmentMap.get(dept)!;
        deptData.total += data.amount;
        deptData.count++;

        const itemName = data.description || data.category;
        if (!deptData.items.has(itemName)) {
            deptData.items.set(itemName, { count: 0, revenue: 0 });
        }
        const itemData = deptData.items.get(itemName)!;
        itemData.count++;
        itemData.revenue += data.amount;
    });

    return Array.from(departmentMap.entries()).map(([department, data]) => ({
        department,
        totalRevenue: data.total,
        transactionCount: data.count,
        averageTransaction: data.count > 0 ? data.total / data.count : 0,
        topItems: Array.from(data.items.entries())
            .map(([name, item]) => ({ name, ...item }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)
    }));
}

/**
 * Get daily financial report
 */
export async function getDailyReport(
    tenantId: string,
    branchId: string,
    date: Date
): Promise<DailyFinancialReport> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const transactionsRef = collection(
        db,
        `tenants/${tenantId}/branches/${branchId}/financial_transactions`
    );
    const q = query(
        transactionsRef,
        where('status', 'in', ['confirmed', 'paid']),
        where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay))
    );
    const snapshot = await getDocs(q);

    let totalRevenue = 0;
    const byDepartment: Record<string, number> = {};
    const byRoom: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
        const data = doc.data() as FinancialTransaction;
        totalRevenue += data.amount;
        
        byDepartment[data.type] = (byDepartment[data.type] || 0) + data.amount;
        byRoom[data.roomNumber] = (byRoom[data.roomNumber] || 0) + data.amount;
    });

    return {
        date: date.toISOString().split('T')[0],
        totalRevenue,
        totalTransactions: snapshot.docs.length,
        byDepartment,
        byRoom
    };
}

// ============================================================
// HELPER: CREATE FROM REQUEST
// ============================================================

/**
 * Create financial transaction from a completed request
 */
export async function createTransactionFromRequest(
    tenantId: string,
    branchId: string,
    request: {
        id: string;
        roomNumber: string;
        type: string;
        guestId?: string;
        guestName?: string;
        items?: { name: string; price: number; quantity: number }[];
        totalAmount?: number;
        employeeId?: string;
        employeeName?: string;
    }
): Promise<string> {
    const amount = request.totalAmount || 
        (request.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0);

    if (amount <= 0) return '';

    const description = request.items?.map(i => `${i.name} x${i.quantity}`).join(', ') || request.type;

    return createTransaction({
        tenantId,
        branchId,
        roomNumber: request.roomNumber,
        guestId: request.guestId,
        guestName: request.guestName,
        type: request.type as FinancialTransaction['type'],
        category: request.type,
        description,
        amount,
        currency: 'SAR',
        status: 'pending',
        requestId: request.id,
        employeeId: request.employeeId,
        employeeName: request.employeeName
    });
}

export default {
    createTransaction,
    confirmTransaction,
    markTransactionPaid,
    cancelTransaction,
    getRoomBillSummary,
    getActiveRoomBills,
    getDepartmentRevenue,
    getDailyReport,
    createTransactionFromRequest
};
