/**
 * Minibar Restocking Service
 * Inventory and restocking workflow
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, onSnapshot } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface MinibarItem {
    id: string;
    name: string;
    nameEn?: string;
    price: number;
    stock: number;
    minStock: number;
    category: 'drinks' | 'snacks' | 'alcohol' | 'other';
    imageUrl?: string;
    branch: string;
    active: boolean;
}

interface RoomMinibar {
    roomNumber: string;
    branch: string;
    items: { itemId: string; quantity: number }[];
    lastUpdated: Timestamp;
    updatedBy: string;
}

interface RestockTask {
    id?: string;
    roomNumber: string;
    branch: string;
    items: { itemId: string; itemName: string; needed: number }[];
    status: 'pending' | 'in_progress' | 'completed';
    assignedTo?: string;
    assignedToName?: string;
    createdAt: Timestamp;
    completedAt?: Timestamp;
}

interface ConsumptionRecord {
    id?: string;
    roomNumber: string;
    branch: string;
    items: { itemId: string; itemName: string; quantity: number; price: number }[];
    total: number;
    recordedAt: Timestamp;
    recordedBy: string;
    recordedByName: string;
}

// ============================================================
// ITEMS MANAGEMENT
// ============================================================

/**
 * Get all minibar items for branch
 */
export const getMinibarItems = async (branch: string): Promise<MinibarItem[]> => {
    try {
        const q = query(
            collection(db, 'minibarItems'),
            where('branch', '==', branch),
            where('active', '==', true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MinibarItem[];
    } catch (error) {
        console.error('Failed to get minibar items:', error);
        return [];
    }
};

/**
 * Subscribe to minibar items
 */
export const subscribeMinibarItems = (
    branch: string,
    callback: (items: MinibarItem[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'minibarItems'),
        where('branch', '==', branch),
        where('active', '==', true)
    );

    return onSnapshot(q, snapshot => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MinibarItem[];
        callback(items);
    });
};

/**
 * Add minibar item
 */
export const addMinibarItem = async (item: Omit<MinibarItem, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'minibarItems'), item);
    return docRef.id;
};

/**
 * Update minibar item
 */
export const updateMinibarItem = async (itemId: string, updates: Partial<MinibarItem>): Promise<void> => {
    await updateDoc(doc(db, 'minibarItems', itemId), updates);
};

/**
 * Get items needing restock
 */
export const getItemsNeedingRestock = async (branch: string): Promise<MinibarItem[]> => {
    const items = await getMinibarItems(branch);
    return items.filter(item => item.stock <= item.minStock);
};

// ============================================================
// ROOM MINIBAR
// ============================================================

/**
 * Get room minibar status
 */
export const getRoomMinibar = async (roomNumber: string, branch: string): Promise<RoomMinibar | null> => {
    try {
        const q = query(
            collection(db, 'roomMinibars'),
            where('roomNumber', '==', roomNumber),
            where('branch', '==', branch)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;
        return { ...snapshot.docs[0].data() } as RoomMinibar;
    } catch {
        return null;
    }
};

/**
 * Update room minibar after inspection
 */
export const updateRoomMinibar = async (
    roomNumber: string,
    branch: string,
    items: { itemId: string; quantity: number }[],
    updatedBy: string
): Promise<void> => {
    const existing = await getRoomMinibar(roomNumber, branch);

    const data: RoomMinibar = {
        roomNumber,
        branch,
        items,
        lastUpdated: Timestamp.now(),
        updatedBy
    };

    if (existing) {
        // Find and update
        const q = query(
            collection(db, 'roomMinibars'),
            where('roomNumber', '==', roomNumber),
            where('branch', '==', branch)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            await updateDoc(doc(db, 'roomMinibars', snapshot.docs[0].id), data as any);
        }
    } else {
        await addDoc(collection(db, 'roomMinibars'), data);
    }
};

// ============================================================
// CONSUMPTION
// ============================================================

/**
 * Record minibar consumption
 */
export const recordConsumption = async (
    roomNumber: string,
    branch: string,
    items: { itemId: string; itemName: string; quantity: number; price: number }[],
    recordedBy: string,
    recordedByName: string
): Promise<string> => {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    const record: Omit<ConsumptionRecord, 'id'> = {
        roomNumber,
        branch,
        items,
        total,
        recordedAt: Timestamp.now(),
        recordedBy,
        recordedByName
    };

    const docRef = await addDoc(collection(db, 'minibarConsumption'), record);

    // Update inventory
    for (const item of items) {
        const itemDoc = doc(db, 'minibarItems', item.itemId);
        const itemData = await getDocs(query(collection(db, 'minibarItems'), where('id', '==', item.itemId)));
        if (!itemData.empty) {
            const current = itemData.docs[0].data();
            await updateDoc(itemDoc, { stock: Math.max(0, (current.stock || 0) - item.quantity) });
        }
    }

    return docRef.id;
};

/**
 * Get room consumption history
 */
export const getRoomConsumption = async (
    roomNumber: string,
    branch: string,
    limitCount = 50
): Promise<ConsumptionRecord[]> => {
    try {
        const q = query(
            collection(db, 'minibarConsumption'),
            where('roomNumber', '==', roomNumber),
            where('branch', '==', branch)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as ConsumptionRecord[];
    } catch {
        return [];
    }
};

// ============================================================
// RESTOCKING
// ============================================================

/**
 * Create restock task
 */
export const createRestockTask = async (
    roomNumber: string,
    branch: string,
    items: { itemId: string; itemName: string; needed: number }[]
): Promise<string> => {
    const task: Omit<RestockTask, 'id'> = {
        roomNumber,
        branch,
        items,
        status: 'pending',
        createdAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'restockTasks'), task);
    return docRef.id;
};

/**
 * Get pending restock tasks
 */
export const getPendingRestockTasks = async (branch: string): Promise<RestockTask[]> => {
    try {
        const q = query(
            collection(db, 'restockTasks'),
            where('branch', '==', branch),
            where('status', 'in', ['pending', 'in_progress'])
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as RestockTask[];
    } catch {
        return [];
    }
};

/**
 * Assign restock task
 */
export const assignRestockTask = async (
    taskId: string,
    assignedTo: string,
    assignedToName: string
): Promise<void> => {
    await updateDoc(doc(db, 'restockTasks', taskId), {
        status: 'in_progress',
        assignedTo,
        assignedToName
    });
};

/**
 * Complete restock task
 */
export const completeRestockTask = async (taskId: string): Promise<void> => {
    await updateDoc(doc(db, 'restockTasks', taskId), {
        status: 'completed',
        completedAt: Timestamp.now()
    });
};

/**
 * Auto-generate restock tasks for rooms that need it
 */
export const generateRestockTasks = async (branch: string): Promise<number> => {
    const items = await getMinibarItems(branch);
    const lowStockItems = items.filter(i => i.stock <= i.minStock);

    if (lowStockItems.length === 0) return 0;

    // Create a general restock task
    await createRestockTask(
        'المخزن',
        branch,
        lowStockItems.map(i => ({
            itemId: i.id,
            itemName: i.name,
            needed: i.minStock * 2 - i.stock
        }))
    );

    return lowStockItems.length;
};

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get consumption analytics
 */
export const getConsumptionAnalytics = async (
    branch: string,
    days = 30
): Promise<{
    totalRevenue: number;
    topItems: { name: string; quantity: number; revenue: number }[];
    byRoom: { room: string; total: number }[];
}> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all consumption records
    const q = query(
        collection(db, 'minibarConsumption'),
        where('branch', '==', branch),
        where('recordedAt', '>=', Timestamp.fromDate(startDate))
    );
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(d => d.data()) as ConsumptionRecord[];

    // Calculate totals
    let totalRevenue = 0;
    const itemStats: Record<string, { quantity: number; revenue: number }> = {};
    const roomStats: Record<string, number> = {};

    records.forEach(record => {
        totalRevenue += record.total;
        roomStats[record.roomNumber] = (roomStats[record.roomNumber] || 0) + record.total;

        record.items.forEach(item => {
            if (!itemStats[item.itemName]) {
                itemStats[item.itemName] = { quantity: 0, revenue: 0 };
            }
            itemStats[item.itemName].quantity += item.quantity;
            itemStats[item.itemName].revenue += item.quantity * item.price;
        });
    });

    const topItems = Object.entries(itemStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

    const byRoom = Object.entries(roomStats)
        .map(([room, total]) => ({ room, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    return { totalRevenue, topItems, byRoom };
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useMinibar = (branch: string) => {
    const [items, setItems] = useState<MinibarItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = subscribeMinibarItems(branch, (newItems) => {
            setItems(newItems);
            setLoading(false);
        });

        return unsubscribe;
    }, [branch]);

    const record = useCallback(async (
        roomNumber: string,
        consumedItems: { itemId: string; itemName: string; quantity: number; price: number }[],
        userId: string,
        userName: string
    ) => {
        return recordConsumption(roomNumber, branch, consumedItems, userId, userName);
    }, [branch]);

    const createTask = useCallback(async (
        roomNumber: string,
        neededItems: { itemId: string; itemName: string; needed: number }[]
    ) => {
        return createRestockTask(roomNumber, branch, neededItems);
    }, [branch]);

    return {
        items,
        loading,
        recordConsumption: record,
        createRestockTask: createTask,
        getAnalytics: () => getConsumptionAnalytics(branch)
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getMinibarItems,
    subscribeMinibarItems,
    addMinibarItem,
    updateMinibarItem,
    getItemsNeedingRestock,
    getRoomMinibar,
    updateRoomMinibar,
    recordConsumption,
    getRoomConsumption,
    createRestockTask,
    getPendingRestockTasks,
    assignRestockTask,
    completeRestockTask,
    generateRestockTasks,
    getConsumptionAnalytics,
    useMinibar
};
