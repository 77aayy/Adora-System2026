/**
 * Billing & Subscriptions Service
 * Complete billing management for SaaS
 */

import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, onSnapshot, orderBy, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface Subscription {
    id: string;
    tenantId: string;
    plan: 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'suspended' | 'cancelled' | 'expired';
    startDate: Date;
    endDate: Date;
    renewalDate?: Date;
    autoRenew: boolean;
    pricePerMonth: number;
    currency: string;
    paymentMethod?: 'credit_card' | 'bank_transfer' | 'cash';
    billingCycle: 'monthly' | 'quarterly' | 'yearly';
}

export interface Invoice {
    id: string;
    invoiceNumber?: number; // ✅ رقم الفاتورة التسلسلي
    receiptVoucherId?: string; // ✅ ربط الفاتورة بالسند المقابل
    tenantId: string;
    subscriptionId?: string;
    amount: number;
    currency: string;
    status: 'pending' | 'paid' | 'overdue' | 'cancelled';
    issueDate: Date;
    dueDate: Date;
    paidDate?: Date;
    items: Array<{
        description: string;
        quantity: number;
        price: number;
    }>;
    paymentMethod?: string;
    notes?: string;
    // ✅ معلومات الفاتورة الضريبية
    managerName?: string;
    managerCode?: string;
    branchCode?: string;
    branchName?: string;
    numberOfBranches?: number;
    subscriptionDuration?: 1 | 2;
    subtotal?: number; // قبل الضريبة
    taxAmount?: number; // قيمة الضريبة
    totalAmount?: number; // الإجمالي شامل الضريبة
    isDeleted?: boolean;
    deletedAt?: Date;
    deletedBy?: string;
}

export interface Payment {
    id: string;
    tenantId: string;
    invoiceId: string;
    amount: number;
    currency: string;
    method: 'credit_card' | 'bank_transfer' | 'cash';
    status: 'pending' | 'completed' | 'failed';
    transactionId?: string;
    paidAt?: Date;
    notes?: string;
}

export interface ReceiptVoucher {
    id: string;
    voucherNumber?: number; // ✅ رقم السند التسلسلي (1, 2, 3, ...)
    tenantId: string;
    managerName: string;
    managerCode: string;
    branchCode: string;
    branchName: string;
    totalAmount: number;
    subscriptionPrice: number; // سعر الاشتراك للفرع الواحد (شامل الضريبة)
    numberOfBranches: number;
    subscriptionDuration: 1 | 2; // 1 = سنة، 2 = سنتين
    currency: string;
    paymentMethod?: 'cash' | 'credit' | 'bank_transfer' | 'deferred'; // ✅ طريقة استلام المبلغ
    isDeleted?: boolean; // ✅ حالة الحذف
    deletedAt?: Date; // ✅ تاريخ الحذف
    deletedBy?: string; // ✅ من قام بالحذف
    createdAt: Date;
    createdBy?: string; // ID of the owner who created it
    notes?: string;
}

export interface ExpenseVoucher {
    id: string;
    voucherNumber?: number; // ✅ رقم السند التسلسلي
    paidTo: string; // ✅ دفع لـ (اسم المستلم)
    amount: number; // ✅ المبلغ
    amountInWords?: string; // ✅ المبلغ كتابة (مائة ريال سعودي)
    paymentMethod: 'cash' | 'credit' | 'bank_transfer' | 'deferred'; // ✅ طريقة الدفع
    purpose: string; // ✅ الغرض/الهدف (مثل: لأجل بدل التأمين للوحدات)
    comments?: string; // ✅ تعليقات
    currency: string;
    isDeleted?: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    createdAt: Date;
    createdBy?: string; // ID of the owner who created it
}

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * Get subscription for tenant
 */
export const getSubscription = async (tenantId: string): Promise<Subscription | null> => {
    try {
        const q = query(
            collection(db, 'subscriptions'),
            where('tenantId', '==', tenantId),
            orderBy('startDate', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        // Get the most recent subscription
        const data = snapshot.docs[0].data();
        return {
            id: snapshot.docs[0].id,
            ...data,
            startDate: data.startDate?.toDate() || new Date(),
            endDate: data.endDate?.toDate() || new Date(),
            renewalDate: data.renewalDate?.toDate()
        } as Subscription;
    } catch (error) {
        console.error('Error getting subscription:', error);
        return null;
    }
};

// ============================================================
// RECEIPT VOUCHER MANAGEMENT (سندات القبض)
// ============================================================

/**
 * Get next voucher number (التسلسل التالي)
 */
const getNextVoucherNumber = async (): Promise<number> => {
    try {
        // Get all vouchers and find max voucherNumber
        const q = query(
            collection(db, 'receiptVouchers'),
            orderBy('voucherNumber', 'desc')
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return 1; // أول سند
        }
        
        // Find the highest voucherNumber
        let maxNumber = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.voucherNumber && typeof data.voucherNumber === 'number') {
                maxNumber = Math.max(maxNumber, data.voucherNumber);
            }
        });
        
        return maxNumber + 1;
    } catch (error) {
        console.error('Error getting next voucher number:', error);
        // Fallback: count all vouchers
        try {
            const allSnapshot = await getDocs(collection(db, 'receiptVouchers'));
            return allSnapshot.size + 1;
        } catch {
            return 1;
        }
    }
};

/**
 * Get next invoice number (التسلسل التالي للفاتورة)
 */
const getNextInvoiceNumber = async (): Promise<number> => {
    try {
        // Get all invoices and find max invoiceNumber
        const q = query(
            collection(db, 'invoices'),
            orderBy('invoiceNumber', 'desc')
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return 1; // أول فاتورة
        }
        
        // Find the highest invoiceNumber
        let maxNumber = 0;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.invoiceNumber && typeof data.invoiceNumber === 'number') {
                maxNumber = Math.max(maxNumber, data.invoiceNumber);
            }
        });
        
        return maxNumber + 1;
    } catch (error) {
        console.error('Error getting next invoice number:', error);
        // Fallback: count all invoices
        try {
            const allSnapshot = await getDocs(collection(db, 'invoices'));
            return allSnapshot.size + 1;
        } catch {
            return 1;
        }
    }
};

/**
 * Create receipt voucher (سند قبض)
 * يتم إنشاؤه تلقائياً عند إضافة مدير جديد
 */
export const createReceiptVoucher = async (voucher: Omit<ReceiptVoucher, 'id' | 'createdAt' | 'voucherNumber'>): Promise<string> => {
    try {
        // ✅ Get next voucher number
        const voucherNumber = await getNextVoucherNumber();
        
        const voucherRef = await addDoc(collection(db, 'receiptVouchers'), {
            ...voucher,
            voucherNumber,
            createdAt: Timestamp.now()
        });
        
        const voucherId = voucherRef.id;
        
        // ✅ Create corresponding invoice automatically
        try {
            const createdVoucher: ReceiptVoucher = {
                id: voucherId,
                ...voucher,
                voucherNumber,
                createdAt: voucher.createdAt || new Date()
            };
            await createInvoiceFromReceiptVoucher(createdVoucher);
        } catch (invoiceError) {
            console.error('Error creating invoice from receipt voucher:', invoiceError);
            // Don't throw - voucher is created, invoice can be created later
        }
        
        return voucherId;
    } catch (error) {
        console.error('Error creating receipt voucher:', error);
        throw error;
    }
};

/**
 * Get all receipt vouchers (for owner dashboard)
 */
export const getAllReceiptVouchers = async (): Promise<ReceiptVoucher[]> => {
    try {
        const q = query(
            collection(db, 'receiptVouchers'),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                voucherNumber: data.voucherNumber || null,
                createdAt: data.createdAt?.toDate() || new Date(),
                deletedAt: data.deletedAt?.toDate(),
                isDeleted: data.isDeleted || false
            } as ReceiptVoucher;
        });
    } catch (error) {
        console.error('Error getting receipt vouchers:', error);
        return [];
    }
};

/**
 * Get receipt vouchers for specific tenant
 */
export const getReceiptVouchersByTenant = async (tenantId: string): Promise<ReceiptVoucher[]> => {
    try {
        const q = query(
            collection(db, 'receiptVouchers'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date()
            } as ReceiptVoucher;
        });
    } catch (error) {
        console.error('Error getting receipt vouchers by tenant:', error);
        return [];
    }
};

/**
 * Update receipt voucher payment method
 */
export const updateReceiptVoucherPaymentMethod = async (
    voucherId: string,
    paymentMethod: 'cash' | 'credit' | 'bank_transfer' | 'deferred'
): Promise<void> => {
    try {
        const voucherRef = doc(db, 'receiptVouchers', voucherId);
        await updateDoc(voucherRef, {
            paymentMethod,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error updating receipt voucher payment method:', error);
        throw error;
    }
};

/**
 * Delete receipt voucher (soft delete)
 */
export const deleteReceiptVoucher = async (
    voucherId: string,
    deletedBy?: string
): Promise<void> => {
    try {
        const voucherRef = doc(db, 'receiptVouchers', voucherId);
        await updateDoc(voucherRef, {
            isDeleted: true,
            deletedAt: Timestamp.now(),
            deletedBy: deletedBy || null
        });
    } catch (error) {
        console.error('Error deleting receipt voucher:', error);
        throw error;
    }
};

/**
 * Delete multiple receipt vouchers (soft delete)
 */
export const deleteReceiptVouchers = async (
    voucherIds: string[],
    deletedBy?: string
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        voucherIds.forEach(voucherId => {
            const voucherRef = doc(db, 'receiptVouchers', voucherId);
            batch.update(voucherRef, {
                isDeleted: true,
                deletedAt: Timestamp.now(),
                deletedBy: deletedBy || null
            });
        });
        await batch.commit();
    } catch (error) {
        console.error('Error deleting receipt vouchers:', error);
        throw error;
    }
};

/**
 * Create or update subscription
 */
export const upsertSubscription = async (subscription: Omit<Subscription, 'id'>): Promise<string> => {
    try {
        // Check if subscription exists
        const existing = await getSubscription(subscription.tenantId);
        
        if (existing) {
            // Update existing
            const subRef = doc(db, 'subscriptions', existing.id);
            await updateDoc(subRef, {
                ...subscription,
                startDate: Timestamp.fromDate(subscription.startDate),
                endDate: Timestamp.fromDate(subscription.endDate),
                renewalDate: subscription.renewalDate ? Timestamp.fromDate(subscription.renewalDate) : null,
                updatedAt: Timestamp.now()
            });
            return existing.id;
        } else {
            // Create new
            const subRef = await addDoc(collection(db, 'subscriptions'), {
                ...subscription,
                startDate: Timestamp.fromDate(subscription.startDate),
                endDate: Timestamp.fromDate(subscription.endDate),
                renewalDate: subscription.renewalDate ? Timestamp.fromDate(subscription.renewalDate) : null,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            return subRef.id;
        }
    } catch (error) {
        console.error('Error upserting subscription:', error);
        throw error;
    }
};

/**
 * Renew subscription
 */
export const renewSubscription = async (
    tenantId: string, 
    period: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
    price?: number // ✅ Optional price override
): Promise<void> => {
    const subscription = await getSubscription(tenantId);
    if (!subscription) {
        throw new Error('Subscription not found');
    }

    const now = new Date();
    const renewalDate = new Date(now);
    
    switch (period) {
        case 'monthly':
            renewalDate.setMonth(renewalDate.getMonth() + 1);
            break;
        case 'quarterly':
            renewalDate.setMonth(renewalDate.getMonth() + 3);
            break;
        case 'yearly':
            renewalDate.setFullYear(renewalDate.getFullYear() + 1);
            break;
    }

    // ✅ If price is provided, update it (for new subscriptions or price changes)
    const updatedPrice = price !== undefined ? price : subscription.pricePerMonth;

    await upsertSubscription({
        ...subscription,
        endDate: renewalDate,
        renewalDate: renewalDate,
        status: 'active',
        pricePerMonth: updatedPrice // ✅ Update price if provided
    });
};

// ============================================================
// INVOICE MANAGEMENT
// ============================================================

/**
 * Create invoice
 */
export const createInvoice = async (invoice: Omit<Invoice, 'id' | 'invoiceNumber'>): Promise<string> => {
    try {
        // ✅ Get next invoice number
        const invoiceNumber = await getNextInvoiceNumber();
        
        const invRef = await addDoc(collection(db, 'invoices'), {
            ...invoice,
            invoiceNumber,
            issueDate: Timestamp.fromDate(invoice.issueDate),
            dueDate: Timestamp.fromDate(invoice.dueDate),
            paidDate: invoice.paidDate ? Timestamp.fromDate(invoice.paidDate) : null,
            createdAt: Timestamp.now()
        });
        return invRef.id;
    } catch (error) {
        console.error('Error creating invoice:', error);
        throw error;
    }
};

/**
 * Create invoice from receipt voucher (إنشاء فاتورة من سند قبض)
 */
export const createInvoiceFromReceiptVoucher = async (voucher: ReceiptVoucher): Promise<string> => {
    try {
        const taxRate = 15; // 15% VAT
        const subtotal = voucher.totalAmount / (1 + taxRate / 100);
        const taxAmount = voucher.totalAmount - subtotal;
        
        const invoiceNumber = await getNextInvoiceNumber();
        
        const invoiceData: Omit<Invoice, 'id' | 'invoiceNumber'> = {
            invoiceNumber,
            receiptVoucherId: voucher.id,
            tenantId: voucher.tenantId,
            amount: voucher.totalAmount,
            currency: voucher.currency || 'SAR',
            status: 'paid', // ✅ الفاتورة مدفوعة لأن السند تم إنشاؤه
            issueDate: voucher.createdAt,
            dueDate: voucher.createdAt,
            paidDate: voucher.createdAt,
            items: [{
                description: `اشتراك ${voucher.subscriptionDuration === 1 ? 'سنة واحدة' : 'سنتين'} - ${voucher.branchName} (${voucher.branchCode})`,
                quantity: voucher.numberOfBranches,
                price: voucher.subscriptionPrice
            }],
            paymentMethod: voucher.paymentMethod || 'cash',
            managerName: voucher.managerName,
            managerCode: voucher.managerCode,
            branchCode: voucher.branchCode,
            branchName: voucher.branchName,
            numberOfBranches: voucher.numberOfBranches,
            subscriptionDuration: voucher.subscriptionDuration,
            subtotal,
            taxAmount,
            totalAmount: voucher.totalAmount,
            notes: `فاتورة ضريبية مقابلة لسند قبض رقم ${voucher.voucherNumber || voucher.id.slice(0, 8)}`
        };
        
        const invRef = await addDoc(collection(db, 'invoices'), {
            ...invoiceData,
            invoiceNumber,
            issueDate: Timestamp.fromDate(invoiceData.issueDate),
            dueDate: Timestamp.fromDate(invoiceData.dueDate),
            paidDate: Timestamp.fromDate(invoiceData.paidDate),
            createdAt: Timestamp.now()
        });
        
        return invRef.id;
    } catch (error) {
        console.error('Error creating invoice from receipt voucher:', error);
        throw error;
    }
};

/**
 * Get invoices for tenant
 */
export const getInvoices = async (tenantId: string): Promise<Invoice[]> => {
    try {
        const q = query(
            collection(db, 'invoices'),
            where('tenantId', '==', tenantId),
            orderBy('issueDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                invoiceNumber: data.invoiceNumber || null,
                issueDate: data.issueDate?.toDate() || new Date(),
                dueDate: data.dueDate?.toDate() || new Date(),
                paidDate: data.paidDate?.toDate(),
                deletedAt: data.deletedAt?.toDate(),
                isDeleted: data.isDeleted || false
            } as Invoice;
        });
    } catch (error) {
        console.error('Error getting invoices:', error);
        return [];
    }
};

/**
 * Get all invoices (for owner/admin)
 */
export const getAllInvoices = async (): Promise<Invoice[]> => {
    try {
        const q = query(
            collection(db, 'invoices'),
            orderBy('issueDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                invoiceNumber: data.invoiceNumber || null,
                issueDate: data.issueDate?.toDate() || new Date(),
                dueDate: data.dueDate?.toDate() || new Date(),
                paidDate: data.paidDate?.toDate(),
                deletedAt: data.deletedAt?.toDate(),
                isDeleted: data.isDeleted || false
            } as Invoice;
        });
    } catch (error) {
        console.error('Error getting all invoices:', error);
        return [];
    }
};

/**
 * Delete invoice (soft delete)
 */
export const deleteInvoice = async (
    invoiceId: string,
    deletedBy?: string
): Promise<void> => {
    try {
        const invoiceRef = doc(db, 'invoices', invoiceId);
        await updateDoc(invoiceRef, {
            isDeleted: true,
            deletedAt: Timestamp.now(),
            deletedBy: deletedBy || null
        });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        throw error;
    }
};

/**
 * Delete multiple invoices (soft delete)
 */
export const deleteInvoices = async (
    invoiceIds: string[],
    deletedBy?: string
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        invoiceIds.forEach(invoiceId => {
            const invoiceRef = doc(db, 'invoices', invoiceId);
            batch.update(invoiceRef, {
                isDeleted: true,
                deletedAt: Timestamp.now(),
                deletedBy: deletedBy || null
            });
        });
        await batch.commit();
    } catch (error) {
        console.error('Error deleting invoices:', error);
        throw error;
    }
};

// ============================================================
// EXPENSE VOUCHERS (سندات الصرف)
// ============================================================

/**
 * Get next expense voucher number (sequential)
 */
export const getNextExpenseVoucherNumber = async (): Promise<number> => {
    try {
        const q = query(
            collection(db, 'expenseVouchers'),
            where('voucherNumber', '!=', null),
            orderBy('voucherNumber', 'desc'),
            { limit: 1 }
        );
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return 1;
        }
        
        const lastVoucher = snapshot.docs[0].data();
        return (lastVoucher.voucherNumber || 0) + 1;
    } catch (error) {
        console.error('Error getting next expense voucher number:', error);
        return 1;
    }
};

/**
 * Create expense voucher (سند صرف)
 */
export const createExpenseVoucher = async (
    expenseData: Omit<ExpenseVoucher, 'id' | 'voucherNumber' | 'createdAt' | 'isDeleted'>
): Promise<string> => {
    try {
        const voucherNumber = await getNextExpenseVoucherNumber();
        
        const voucherRef = await addDoc(collection(db, 'expenseVouchers'), {
            ...expenseData,
            voucherNumber,
            createdAt: Timestamp.now(),
            isDeleted: false
        });
        
        return voucherRef.id;
    } catch (error) {
        console.error('Error creating expense voucher:', error);
        throw error;
    }
};

/**
 * Get all expense vouchers (for owner/admin)
 */
export const getAllExpenseVouchers = async (): Promise<ExpenseVoucher[]> => {
    try {
        const q = query(
            collection(db, 'expenseVouchers'),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                voucherNumber: data.voucherNumber || null,
                createdAt: data.createdAt?.toDate() || new Date(),
                deletedAt: data.deletedAt?.toDate(),
                isDeleted: data.isDeleted || false
            } as ExpenseVoucher;
        });
    } catch (error) {
        console.error('Error getting all expense vouchers:', error);
        return [];
    }
};

/**
 * Delete expense voucher (soft delete)
 */
export const deleteExpenseVoucher = async (
    voucherId: string,
    deletedBy?: string
): Promise<void> => {
    try {
        const voucherRef = doc(db, 'expenseVouchers', voucherId);
        await updateDoc(voucherRef, {
            isDeleted: true,
            deletedAt: Timestamp.now(),
            deletedBy: deletedBy || null
        });
    } catch (error) {
        console.error('Error deleting expense voucher:', error);
        throw error;
    }
};

/**
 * Delete multiple expense vouchers (soft delete)
 */
export const deleteExpenseVouchers = async (
    voucherIds: string[],
    deletedBy?: string
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        voucherIds.forEach(voucherId => {
            const voucherRef = doc(db, 'expenseVouchers', voucherId);
            batch.update(voucherRef, {
                isDeleted: true,
                deletedAt: Timestamp.now(),
                deletedBy: deletedBy || null
            });
        });
        await batch.commit();
    } catch (error) {
        console.error('Error deleting expense vouchers:', error);
        throw error;
    }
};

/**
 * Mark invoice as paid
 */
export const markInvoiceAsPaid = async (invoiceId: string, paymentMethod: string, transactionId?: string): Promise<void> => {
    try {
        const invRef = doc(db, 'invoices', invoiceId);
        await updateDoc(invRef, {
            status: 'paid',
            paidDate: Timestamp.now(),
            paymentMethod,
            transactionId,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error marking invoice as paid:', error);
        throw error;
    }
};

// ============================================================
// PAYMENT MANAGEMENT
// ============================================================

/**
 * Record payment
 */
export const recordPayment = async (payment: Omit<Payment, 'id'>): Promise<string> => {
    try {
        const payRef = await addDoc(collection(db, 'payments'), {
            ...payment,
            paidAt: payment.paidAt ? Timestamp.fromDate(payment.paidAt) : Timestamp.now(),
            createdAt: Timestamp.now()
        });

        // Update invoice status
        if (payment.invoiceId) {
            await markInvoiceAsPaid(payment.invoiceId, payment.method, payment.transactionId);
        }

        return payRef.id;
    } catch (error) {
        console.error('Error recording payment:', error);
        throw error;
    }
};

/**
 * Get payments for tenant
 */
export const getPayments = async (tenantId: string): Promise<Payment[]> => {
    try {
        const q = query(
            collection(db, 'payments'),
            where('tenantId', '==', tenantId),
            orderBy('paidAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                paidAt: data.paidAt?.toDate()
            } as Payment;
        });
    } catch (error) {
        console.error('Error getting payments:', error);
        return [];
    }
};

// ============================================================
// SUBSCRIPTION MONITORING
// ============================================================

/**
 * Check for expiring subscriptions
 */
export const getExpiringSubscriptions = async (days: number = 7): Promise<Subscription[]> => {
    try {
        const now = new Date();
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() + days);

        const q = query(
            collection(db, 'subscriptions'),
            where('status', '==', 'active'),
            where('endDate', '<=', Timestamp.fromDate(threshold)),
            where('endDate', '>=', Timestamp.fromDate(now))
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startDate: data.startDate?.toDate() || new Date(),
                endDate: data.endDate?.toDate() || new Date(),
                renewalDate: data.renewalDate?.toDate()
            } as Subscription;
        });
    } catch (error) {
        console.error('Error getting expiring subscriptions:', error);
        return [];
    }
};

/**
 * Get overdue invoices
 */
export const getOverdueInvoices = async (): Promise<Invoice[]> => {
    try {
        const now = Timestamp.now();
        const q = query(
            collection(db, 'invoices'),
            where('status', '==', 'pending'),
            where('dueDate', '<', now)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                issueDate: data.issueDate?.toDate() || new Date(),
                dueDate: data.dueDate?.toDate() || new Date(),
                paidDate: data.paidDate?.toDate()
            } as Invoice;
        });
    } catch (error) {
        console.error('Error getting overdue invoices:', error);
        return [];
    }
};

// ============================================================
// REVENUE CALCULATION
// ============================================================

/**
 * Calculate total revenue from paid invoices and active subscriptions
 * ✅ REAL DATA: Aggregates from actual billing data
 * ✅ FIXED: Now includes ALL invoices (not just paid) to show accurate totals
 */
export const calculateTotalRevenue = async (): Promise<number> => {
    try {
        if (!db) return 0;
        
        let totalRevenue = 0;

        // 1. Sum ALL invoices (including pending, paid, overdue) - not just paid
        // ✅ FIX: This ensures we show accurate totals even if invoices exist but aren't marked as 'paid'
        const allInvoicesQuery = query(collection(db, 'invoices'));
        const allInvoicesSnapshot = await getDocs(allInvoicesQuery);
        allInvoicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Only count if not soft-deleted
            if (!data.isDeleted && data.amount) {
                totalRevenue += data.amount || 0;
            }
        });

        // 2. Sum all completed payments
        const completedPaymentsQuery = query(
            collection(db, 'payments'),
            where('status', '==', 'completed')
        );
        const completedPaymentsSnapshot = await getDocs(completedPaymentsQuery);
        completedPaymentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            totalRevenue += data.amount || 0;
        });

        return totalRevenue;
    } catch (error) {
        logger.error('Error calculating total revenue', error, 'billingService');
        return 0;
    }
};

/**
 * Get count of deleted invoices and vouchers
 * ✅ NEW: Counts all deleted billing documents
 */
export const getDeletedBillingCount = async (): Promise<number> => {
    try {
        if (!db) return 0;
        
        let deletedCount = 0;

        // Count deleted invoices
        const invoicesQuery = query(collection(db, 'invoices'));
        const invoicesSnapshot = await getDocs(invoicesQuery);
        invoicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.isDeleted === true || data.deletedAt) {
                deletedCount++;
            }
        });

        // Count deleted receipt vouchers
        const receiptVouchersQuery = query(collection(db, 'receipt_vouchers'));
        const receiptVouchersSnapshot = await getDocs(receiptVouchersQuery);
        receiptVouchersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.isDeleted === true || data.deletedAt) {
                deletedCount++;
            }
        });

        // Count deleted expense vouchers
        const expenseVouchersQuery = query(collection(db, 'expense_vouchers'));
        const expenseVouchersSnapshot = await getDocs(expenseVouchersQuery);
        expenseVouchersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.isDeleted === true || data.deletedAt) {
                deletedCount++;
            }
        });

        return deletedCount;
    } catch (error) {
        console.error('Error counting deleted billing documents:', error);
        return 0;
    }
};

/**
 * Calculate monthly recurring revenue (MRR) from active subscriptions
 * ✅ REAL DATA: Based on active subscriptions only
 * ⚡ PERFORMANCE: 60-second memory cache
 */
export const calculateMonthlyRecurringRevenue = async (forceRefresh: boolean = false): Promise<number> => {
    const { cachedFetch } = await import('../utils/requestCache');
    
    return cachedFetch<number>(
        'billing:mrr',
        async () => {
            try {
                let mrr = 0;

                // Get all active subscriptions
                const activeSubsQuery = query(
                    collection(db, 'subscriptions'),
                    where('status', '==', 'active')
                );
                const activeSubsSnapshot = await getDocs(activeSubsQuery);

                activeSubsSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const pricePerMonth = data.pricePerMonth || 0;
                    const billingCycle = data.billingCycle || 'monthly';

                    // Convert to monthly equivalent
                    let monthlyAmount = pricePerMonth;
                    if (billingCycle === 'quarterly') {
                        monthlyAmount = pricePerMonth / 3;
                    } else if (billingCycle === 'yearly') {
                        monthlyAmount = pricePerMonth / 12;
                    }

                    mrr += monthlyAmount;
                });

                return mrr;
            } catch (error) {
                console.error('Error calculating MRR:', error);
                return 0;
            }
        },
        { ttl: 60 * 1000, forceRefresh }
    );
};

/**
 * Calculate revenue for specific tenant
 * ✅ REAL DATA: Based on tenant's invoices and payments
 */
export const calculateTenantRevenue = async (tenantId: string): Promise<number> => {
    try {
        let revenue = 0;

        // Sum paid invoices for this tenant
        const invoicesQuery = query(
            collection(db, 'invoices'),
            where('tenantId', '==', tenantId),
            where('status', '==', 'paid')
        );
        const invoicesSnapshot = await getDocs(invoicesQuery);
        invoicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            revenue += data.amount || 0;
        });

        // Sum completed payments for this tenant
        const paymentsQuery = query(
            collection(db, 'payments'),
            where('tenantId', '==', tenantId),
            where('status', '==', 'completed')
        );
        const paymentsSnapshot = await getDocs(paymentsQuery);
        paymentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            revenue += data.amount || 0;
        });

        return revenue;
    } catch (error) {
        console.error('Error calculating tenant revenue:', error);
        return 0;
    }
};

/**
 * Get all subscriptions (for owner dashboard)
 */
export const getAllSubscriptions = async (): Promise<Subscription[]> => {
    try {
        const q = query(
            collection(db, 'subscriptions'),
            orderBy('startDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                startDate: data.startDate?.toDate() || new Date(),
                endDate: data.endDate?.toDate() || new Date(),
                renewalDate: data.renewalDate?.toDate()
            } as Subscription;
        });
    } catch (error) {
        console.error('Error getting all subscriptions:', error);
        return [];
    }
};

/**
 * Calculate Annual Recurring Revenue (ARR)
 * ✅ REAL DATA: Based on active subscriptions (yearly equivalent)
 */
export const calculateAnnualRecurringRevenue = async (): Promise<number> => {
    try {
        const mrr = await calculateMonthlyRecurringRevenue();
        return mrr * 12;
    } catch (error) {
        console.error('Error calculating ARR:', error);
        return 0;
    }
};

/**
 * Calculate monthly renewal revenue (renewals from start of current month to today)
 * ✅ REAL DATA: Based on invoices/payments for renewals in current month
 */
export const calculateMonthlyRenewalRevenue = async (): Promise<number> => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        let renewalRevenue = 0;

        // 1. Get paid invoices from this month (renewal-related)
        const paidInvoicesQuery = query(
            collection(db, 'invoices'),
            where('status', '==', 'paid'),
            where('issueDate', '>=', Timestamp.fromDate(startOfMonth)),
            where('issueDate', '<=', Timestamp.now())
        );
        const paidInvoicesSnapshot = await getDocs(paidInvoicesQuery);
        paidInvoicesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Check if invoice is for renewal (description contains renewal keywords)
            const description = (data.items?.[0]?.description || '').toLowerCase();
            if (description.includes('renewal') || description.includes('تجديد') || 
                description.includes('license') || description.includes('ترخيص')) {
                renewalRevenue += data.amount || 0;
            }
        });

        // 2. Get completed payments from this month (renewal-related)
        const completedPaymentsQuery = query(
            collection(db, 'payments'),
            where('status', '==', 'completed'),
            where('paidAt', '>=', Timestamp.fromDate(startOfMonth)),
            where('paidAt', '<=', Timestamp.now())
        );
        const completedPaymentsSnapshot = await getDocs(completedPaymentsQuery);
        completedPaymentsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Check if payment notes indicate renewal
            const notes = (data.notes || '').toLowerCase();
            if (notes.includes('renewal') || notes.includes('تجديد') || 
                notes.includes('license') || notes.includes('ترخيص')) {
                renewalRevenue += data.amount || 0;
            }
        });

        // 3. Also check subscriptions renewed this month (if renewalDate is in current month)
        const allSubs = await getAllSubscriptions();
        allSubs.forEach(sub => {
            if (sub.renewalDate && sub.renewalDate >= startOfMonth && sub.renewalDate <= now) {
                // If yearly subscription, add full year price
                if (sub.billingCycle === 'yearly') {
                    renewalRevenue += sub.pricePerMonth * 12;
                } else if (sub.billingCycle === 'quarterly') {
                    renewalRevenue += sub.pricePerMonth * 3;
                } else {
                    renewalRevenue += sub.pricePerMonth;
                }
            }
        });

        return renewalRevenue;
    } catch (error) {
        console.error('Error calculating monthly renewal revenue:', error);
        return 0;
    }
};

/**
 * Get nearest expiring subscription with branch info
 * Returns subscription with days until expiry and branch name
 */
export const getNearestExpiringSubscription = async (): Promise<{
    subscription: Subscription;
    daysUntilExpiry: number;
    branchName?: string;
    tenantName?: string;
} | null> => {
    try {
        const now = new Date();
        const allSubs = await getAllSubscriptions();
        
        // Filter active subscriptions and calculate days until expiry
        const expiringSubs = allSubs
            .filter(sub => sub.status === 'active' && sub.endDate > now)
            .map(sub => {
                const daysUntilExpiry = Math.ceil(
                    (sub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                );
                return { subscription: sub, daysUntilExpiry };
            })
            .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry); // Sort by nearest expiry

        if (expiringSubs.length === 0) {
            return null;
        }

        const nearest = expiringSubs[0];
        
        // Try to get branch/tenant name
        let branchName: string | undefined;
        let tenantName: string | undefined;
        
        try {
            const { getDoc } = await import('firebase/firestore');
            const tenantRef = doc(db, 'tenants', nearest.subscription.tenantId);
            const tenantDoc = await getDoc(tenantRef);
            if (tenantDoc.exists()) {
                const tenantData = tenantDoc.data();
                tenantName = tenantData.info?.name || tenantData.name;
                // Get first branch name if available
                const branchesRef = collection(db, `tenants/${nearest.subscription.tenantId}/branches`);
                const branchesSnapshot = await getDocs(branchesRef);
                if (branchesSnapshot.docs.length > 0) {
                    branchName = branchesSnapshot.docs[0].data().name || branchesSnapshot.docs[0].id;
                }
            }
        } catch (err) {
            console.warn('Could not fetch branch/tenant name:', err);
        }

        return {
            subscription: nearest.subscription,
            daysUntilExpiry: nearest.daysUntilExpiry,
            branchName,
            tenantName
        };
    } catch (error) {
        console.error('Error getting nearest expiring subscription:', error);
        return null;
    }
};