/**
 * Room Transfer Service
 * Handles smart room transfers for guests with notifications to all departments
 * 
 * Features:
 * - Transfer guest session to new room
 * - Update active requests to new room
 * - Notify all departments about the transfer
 * - Real-time sync with guest device
 * 
 * Adora Hotel Management System V3
 */

import {
    collection, doc, addDoc, updateDoc, getDocs, query, where,
    Timestamp, serverTimestamp, writeBatch, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface RoomTransfer {
    id?: string;
    tenantId: string;
    branchId: string;
    fromRoom: string;
    toRoom: string;
    guestName?: string;
    guestIdentity?: string;
    guestPhone?: string;
    reason?: string;
    transferredBy: {
        id: string;
        name: string;
        department: 'reception' | 'bellman' | 'manager';
    };
    transferredAt: Date | any;
    // Affected requests
    affectedRequestIds: string[];
    // Status
    status: 'pending' | 'completed' | 'failed';
    error?: string;
}

export interface TransferNotification {
    id?: string;
    transferId: string;
    tenantId: string;
    branchId: string;
    department: string;
    fromRoom: string;
    toRoom: string;
    message: string;
    type: 'room_transfer';
    read: boolean;
    createdAt: Date | any;
}

// ============================================================
// ROOM TRANSFER EXECUTION
// ============================================================

/**
 * Transfer a guest to a new room
 * - Updates room card
 * - Updates all active requests
 * - Notifies all departments
 * - Creates transfer record
 */
export const transferGuestToRoom = async (
    tenantId: string,
    branchId: string,
    fromRoom: string,
    toRoom: string,
    transferredBy: RoomTransfer['transferredBy'],
    reason?: string
): Promise<{ success: boolean; transferId?: string; error?: string }> => {
    const batch = writeBatch(db);
    const affectedRequestIds: string[] = [];

    try {
        // 1. Find and update the active room card (tenant-scoped)
        const roomCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
        const roomCardQuery = query(
            roomCardsRef,
            where('roomNumber', '==', fromRoom),
            where('status', '==', 'active')
        );
        const roomCardSnapshot = await getDocs(roomCardQuery);

        if (roomCardSnapshot.empty) {
            return { success: false, error: 'لا يوجد حجز نشط لهذه الغرفة' };
        }

        const roomCardDoc = roomCardSnapshot.docs[0];
        const roomCardData = roomCardDoc.data();

        // Update room card with new room number
        batch.update(doc(db, `tenants/${tenantId}/roomCards`, roomCardDoc.id), {
            roomNumber: toRoom,
            previousRoom: fromRoom,
            transferredAt: serverTimestamp(),
            transferredBy: transferredBy,
            transferReason: reason || 'تغيير الغرفة'
        });

        // 2. Find and update all active requests for this room (tenant-scoped)
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        const activeRequestsQuery = query(
            requestsRef,
            where('roomNumber', '==', fromRoom),
            where('status', 'in', ['pending', 'in_progress', 'PENDING_RECEPTION', 'confirmed'])
        );
        const requestsSnapshot = await getDocs(activeRequestsQuery);

        requestsSnapshot.docs.forEach(requestDoc => {
            affectedRequestIds.push(requestDoc.id);
            batch.update(doc(db, `tenants/${tenantId}/requests`, requestDoc.id), {
                roomNumber: toRoom,
                previousRoom: fromRoom,
                transferredAt: serverTimestamp(),
                transferNote: `⚠️ تم نقل هذا الطلب من الغرفة ${fromRoom} إلى الغرفة ${toRoom}`
            });
        });

        // 3. Create transfer record
        const transferRecord: Omit<RoomTransfer, 'id'> = {
            tenantId,
            branchId,
            fromRoom,
            toRoom,
            guestName: roomCardData.guestName,
            guestIdentity: roomCardData.guestIdentity,
            guestPhone: roomCardData.guestPhone,
            reason: reason || 'تغيير الغرفة',
            transferredBy,
            transferredAt: serverTimestamp(),
            affectedRequestIds,
            status: 'completed'
        };

        const transferRef = await addDoc(collection(db, `tenants/${tenantId}/roomTransfers`), transferRecord);

        // 4. Create notifications for all departments (tenant-scoped)
        const departments = ['reception', 'housekeeping', 'maintenance', 'coffee_shop', 'bellman'];
        
        for (const department of departments) {
            const notification: Omit<TransferNotification, 'id'> = {
                transferId: transferRef.id,
                tenantId,
                branchId,
                department,
                fromRoom,
                toRoom,
                message: `⚠️ تم نقل النزيل "${roomCardData.guestName || 'ضيف'}" من الغرفة ${fromRoom} إلى ${toRoom}`,
                type: 'room_transfer',
                read: false,
                createdAt: serverTimestamp()
            };
            
            await addDoc(collection(db, `tenants/${tenantId}/departmentNotifications`), notification);
        }

        // 5. Create guest-facing notification (for real-time sync, tenant-scoped)
        await addDoc(collection(db, `tenants/${tenantId}/guestNotifications`), {
            tenantId,
            branchId,
            roomNumber: toRoom, // New room
            previousRoom: fromRoom,
            type: 'room_transfer',
            message: `تم نقلك إلى الغرفة ${toRoom}`,
            createdAt: serverTimestamp(),
            read: false
        });

        // Commit batch updates
        await batch.commit();

        logger.info(`✅ Room transfer completed: ${fromRoom} → ${toRoom} (${affectedRequestIds.length} requests updated)`, undefined, 'roomTransferService');

        return { 
            success: true, 
            transferId: transferRef.id 
        };

    } catch (error: any) {
        logger.error('Error transferring room:', error, 'roomTransferService');
        return { 
            success: false, 
            error: error.message || 'حدث خطأ أثناء نقل الغرفة' 
        };
    }
};

// ============================================================
// REAL-TIME LISTENERS
// ============================================================

/**
 * Subscribe to room transfer notifications for a specific guest
 * Used by the guest device to detect room changes
 */
export const subscribeToRoomTransfers = (
    tenantId: string,
    branchId: string,
    currentRoom: string,
    onTransfer: (notification: { newRoom: string; message: string }) => void
): Unsubscribe => {
    const q = query(
        collection(db, `tenants/${tenantId}/guestNotifications`),
        where('branchId', '==', branchId),
        where('previousRoom', '==', currentRoom),
        where('type', '==', 'room_transfer'),
        where('read', '==', false)
    );

    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                onTransfer({
                    newRoom: data.roomNumber,
                    message: data.message
                });

                // Mark as read
                updateDoc(doc(db, `tenants/${tenantId}/guestNotifications`, change.doc.id), { read: true });
            }
        });
    });
};

/**
 * Subscribe to transfer notifications for a department
 */
export const subscribeToDepartmentTransferNotifications = (
    tenantId: string,
    branchId: string,
    department: string,
    callback: (notifications: TransferNotification[]) => void
): Unsubscribe => {
    const q = query(
        collection(db, `tenants/${tenantId}/departmentNotifications`),
        where('branchId', '==', branchId),
        where('department', '==', department),
        where('type', '==', 'room_transfer'),
        where('read', '==', false)
    );

    return onSnapshot(q, (snapshot) => {
        const notifications: TransferNotification[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as TransferNotification));
        callback(notifications);
    });
};

/**
 * Mark transfer notification as read (tenant-scoped)
 */
export const markTransferNotificationAsRead = async (tenantId: string, notificationId: string): Promise<void> => {
    await updateDoc(doc(db, `tenants/${tenantId}/departmentNotifications`, notificationId), { read: true });
};

// ============================================================
// TRANSFER HISTORY
// ============================================================

/**
 * Get transfer history for a room
 */
export const getRoomTransferHistory = async (
    tenantId: string,
    roomNumber: string
): Promise<RoomTransfer[]> => {
    const q = query(
        collection(db, `tenants/${tenantId}/roomTransfers`),
        where('fromRoom', '==', roomNumber)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as RoomTransfer));
};

/**
 * Get all transfers for a tenant (for admin view)
 */
export const getAllTransfers = async (
    tenantId: string,
    branchId?: string,
    limit: number = 50
): Promise<RoomTransfer[]> => {
    const baseRef = collection(db, `tenants/${tenantId}/roomTransfers`);
    let q = branchId
        ? query(baseRef, where('branchId', '==', branchId))
        : query(baseRef);

    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({
            id: doc.id,
            ...doc.data()
        } as RoomTransfer))
        .slice(0, limit);
};

export default {
    transferGuestToRoom,
    subscribeToRoomTransfers,
    subscribeToDepartmentTransferNotifications,
    markTransferNotificationAsRead,
    getRoomTransferHistory,
    getAllTransfers
};
