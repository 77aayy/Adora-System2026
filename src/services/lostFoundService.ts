/**
 * Lost & Found Service
 * Complete lost and found items management
 * Adora Hotel Management System V2
 */

import { db, auth } from './firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    onSnapshot,
} from 'firebase/firestore';
import { uploadFileToImgBB } from './imageUploadService'; // ✅ Use ImgBB instead of Firebase Storage

// ============================================================
// TYPES
// ============================================================

export type ItemStatus = 'found' | 'claimed' | 'returned' | 'disposed';
export type ItemCategory = 'electronics' | 'documents' | 'jewelry' | 'clothing' | 'bags' | 'keys' | 'other';

export interface LostFoundItem {
    id: string;
    type: 'lost' | 'found'; // Lost by guest or Found by staff
    category: ItemCategory;
    description: string;
    location: string; // Where it was found/lost
    roomNumber?: string;
    guestName?: string;
    guestContact?: string;
    status: ItemStatus;
    imageUrl?: string;
    storageLocation?: string; // Where item is stored
    foundBy?: { id: string; name: string };
    claimedBy?: { name: string; contact: string; idType?: string; idNumber?: string };
    returnedBy?: { id: string; name: string };
    createdAt: any;
    updatedAt: any;
    claimedAt?: any;
    returnedAt?: any;
    disposedAt?: any;
    notes?: string;
    branch: string;
}

export const CATEGORY_NAMES: Record<ItemCategory, string> = {
    electronics: 'إلكترونيات',
    documents: 'وثائق ومستندات',
    jewelry: 'مجوهرات',
    clothing: 'ملابس',
    bags: 'حقائب',
    keys: 'مفاتيح',
    other: 'أخرى',
};

export const STATUS_NAMES: Record<ItemStatus, string> = {
    found: 'موجود',
    claimed: 'تم المطالبة',
    returned: 'تم الإرجاع',
    disposed: 'تم التخلص',
};

export const CATEGORY_ICONS: Record<ItemCategory, string> = {
    electronics: '📱',
    documents: '📄',
    jewelry: '💍',
    clothing: '👔',
    bags: '👜',
    keys: '🔑',
    other: '📦',
};

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Subscribe to lost & found items
 */
export const subscribeToLostFound = (
    branchId: string,
    callback: (items: LostFoundItem[]) => void,
    status?: ItemStatus
) => {
    let q = query(
        collection(db, 'lost_found'),
        where('branch', '==', branchId)
    );

    if (status) {
        q = query(
            collection(db, 'lost_found'),
            where('branch', '==', branchId),
            where('status', '==', status)
        );
    }

    return onSnapshot(q, (snapshot) => {
        const items: LostFoundItem[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as LostFoundItem);
        });
        // ✅ Client-side Sort
        items.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(items);
    });
};

/**
 * Get single item
 */
export const getLostFoundItem = async (itemId: string): Promise<LostFoundItem | null> => {
    const docRef = doc(db, 'lost_found', itemId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as LostFoundItem;
    }
    return null;
};

/**
 * Add new lost/found item
 * @param item - Item data (without id, createdAt, updatedAt, status)
 * @param imageFile - Optional: File to upload
 * @param imageUrl - Optional: Direct URL (e.g., from inspection photo)
 */
export const addLostFoundItem = async (
    item: Omit<LostFoundItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    imageFile?: File,
    imageUrl?: string // ✅ Support direct URL (e.g., from inspection)
): Promise<string> => {
    let finalImageUrl: string | undefined = imageUrl; // ✅ Use provided URL if available

    // ✅ Upload image to ImgBB with compression (not Firebase Storage) if file provided
    if (imageFile && !imageUrl) {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            throw new Error('يجب تسجيل الدخول قبل رفع الصور');
        }

        const timestamp = Date.now();
        const result = await uploadFileToImgBB(imageFile, undefined, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.7
        });

        if (result.success && result.url) {
            finalImageUrl = result.url; // ✅ ImgBB URL (saved in Firebase as link, not file)
        } else {
            throw new Error('فشل رفع الصورة: ' + (result.error || 'خطأ غير معروف'));
        }
    }

    const docRef = await addDoc(collection(db, 'lost_found'), {
        ...item,
        imageUrl: finalImageUrl,
        status: 'found',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });

    return docRef.id;
};

/**
 * Update item
 */
export const updateLostFoundItem = async (
    itemId: string,
    updates: Partial<LostFoundItem>
): Promise<void> => {
    const docRef = doc(db, 'lost_found', itemId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
};

/**
 * Mark item as claimed
 */
export const claimItem = async (
    itemId: string,
    claimedBy: { name: string; contact: string; idType?: string; idNumber?: string }
): Promise<void> => {
    await updateDoc(doc(db, 'lost_found', itemId), {
        status: 'claimed',
        claimedBy,
        claimedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

/**
 * Mark item as returned
 */
export const returnItem = async (
    itemId: string,
    returnedBy: { id: string; name: string }
): Promise<void> => {
    await updateDoc(doc(db, 'lost_found', itemId), {
        status: 'returned',
        returnedBy,
        returnedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
    });
};

/**
 * Mark item as disposed
 */
export const disposeItem = async (
    itemId: string,
    notes?: string
): Promise<void> => {
    await updateDoc(doc(db, 'lost_found', itemId), {
        status: 'disposed',
        disposedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: notes || null,
    });
};

// ============================================================
// STATISTICS
// ============================================================

export const getLostFoundStats = async (branchId: string) => {
    const q = query(
        collection(db, 'lost_found'),
        where('branch', '==', branchId)
    );

    const snapshot = await getDocs(q);
    let total = 0;
    let found = 0;
    let claimed = 0;
    let returned = 0;
    let disposed = 0;
    const byCategory: Record<string, number> = {};

    snapshot.forEach((doc) => {
        const item = doc.data() as LostFoundItem;
        total++;

        switch (item.status) {
            case 'found': found++; break;
            case 'claimed': claimed++; break;
            case 'returned': returned++; break;
            case 'disposed': disposed++; break;
        }

        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    });

    return {
        total,
        found,
        claimed,
        returned,
        disposed,
        byCategory,
    };
};