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
    runTransaction,
    serverTimestamp,
    limit,
} from 'firebase/firestore';
import { uploadFileToImgBB } from './imageUploadService'; // ✅ Use ImgBB instead of Firebase Storage
import { sendWhatsApp } from './communicationService';

// ============================================================
// TYPES
// ============================================================

// ✅ Updated Status Flow: FOUND -> CLAIMED -> RETURNED/DONATED
export type ItemStatus = 'found' | 'claimed' | 'returned' | 'donated' | 'disposed';
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
    claimedBy?: { 
        name: string; 
        contact: string; 
        idType?: string; 
        idNumber?: string;
        // ✅ Proof of Delivery fields
        guestIdentityURL?: string; // URL to guest ID document (ImgBB)
        signatureData?: string; // Base64 signature data
        signatureUrl?: string; // ImgBB URL for signature image
    };
    returnedBy?: { id: string; name: string };
    createdAt: any;
    updatedAt: any;
    claimedAt?: any;
    returnedAt?: any;
    disposedAt?: any;
    notes?: string;
    branch: string;
    tenantId?: string; // ✅ SaaS isolation
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
    donated: 'تم التبرع',
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
 * 🔐 SECURITY: Added tenantId filter for multi-tenant isolation
 */
export const subscribeToLostFound = (
    branchId: string,
    callback: (items: LostFoundItem[]) => void,
    status?: ItemStatus,
    tenantId?: string // 🔐 NEW: Required for SaaS isolation
) => {
    // 🔐 SECURITY: tenantId is required for SaaS isolation
    if (!tenantId) {
        console.warn('⚠️ [LostFound] subscribeToLostFound called without tenantId - returning empty');
        callback([]);
        return () => { };
    }

    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    const lostFoundRef = collection(db, `tenants/${tenantId}/lost_found`);
    const constraints: any[] = [
        where('branch', '==', branchId) // tenantId already in path, only need branch
    ];
    
    if (status) {
        constraints.push(where('status', '==', status));
    }

    const q = query(
        collection(db, 'lost_found'),
        ...constraints
    );

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
export const getLostFoundItem = async (itemId: string, tenantId: string): Promise<LostFoundItem | null> => {
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    if (!tenantId) {
        console.warn('⚠️ [LostFound] getLostFoundItem called without tenantId');
        return null;
    }
    const docRef = doc(db, `tenants/${tenantId}/lost_found`, itemId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as LostFoundItem;
    }
    return null;
};

/**
 * 🔍 Get last checked-out guest from room
 * Searches roomCards for the most recent checkout for a given room
 */
const getLastCheckedOutGuest = async (
    roomNumber: string,
    branchId: string,
    tenantId?: string
): Promise<{ name?: string; phone?: string } | null> => {
    if (!db) return null;
    
    try {
        // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
        if (!tenantId) {
            console.warn('⚠️ [Lost & Found] getLastCheckedOutGuest called without tenantId');
            return null;
        }
        const roomCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
        const constraints: any[] = [
            where('roomNumber', '==', roomNumber),
            where('status', 'in', ['checkout_pending', 'checked_out', 'completed'])
        ];
        
        if (branchId) {
            constraints.push(where('branch', '==', branchId));
        }
        if (tenantId) {
            constraints.push(where('tenantId', '==', tenantId));
        }
        
        const q = query(
            roomCardsRef,
            ...constraints,
            orderBy('checkOutTime', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            console.warn(`⚠️ [Lost & Found] No checked-out guest found for Room ${roomNumber}`);
            return null;
        }
        
        const cardData = snapshot.docs[0].data();
        return {
            name: cardData.guestName || cardData.guest_name,
            phone: cardData.guestPhone || cardData.guest_phone || cardData.phone
        };
    } catch (error) {
        console.error('Error fetching last checked-out guest:', error);
        return null;
    }
};

/**
 * Add new lost/found item
 * 📱 WhatsApp Automation: If room number provided, automatically notify last checked-out guest
 * @param item - Item data (without id, createdAt, updatedAt, status)
 * @param imageFile - Optional: File to upload
 * @param imageUrl - Optional: Direct URL (e.g., from inspection photo)
 * @param foundBy - Optional: Employee who found the item
 */
export const addLostFoundItem = async (
    item: Omit<LostFoundItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    imageFile?: File,
    imageUrl?: string, // ✅ Support direct URL (e.g., from inspection)
    foundBy?: { id: string; name: string }
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

    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    if (!item.tenantId) {
        throw new Error('tenantId is required for SaaS isolation');
    }
    const lostFoundRef = collection(db, `tenants/${item.tenantId}/lost_found`);
    const docRef = await addDoc(lostFoundRef, {
        ...item,
        imageUrl: finalImageUrl,
        status: 'found',
        foundBy: foundBy || (auth.currentUser ? { 
            id: auth.currentUser.uid, 
            name: auth.currentUser.displayName || 'موظف' 
        } : undefined),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    // 📱 WhatsApp Automation: If room number provided, notify last checked-out guest
    if (item.roomNumber && item.branch) {
        try {
            const lastGuest = await getLastCheckedOutGuest(
                item.roomNumber,
                item.branch,
                item.tenantId
            );
            
            if (lastGuest?.phone) {
                const itemName = item.description || 'عنصر مفقود';
                const message = `مرحباً بك في فندق أدورا 🌟\n\nتم العثور على ${itemName} في الغرفة ${item.roomNumber}.\n\nهل ترغب في استلامه شخصياً أم تفضّل شحنه إليك؟\n\nنحن في خدمتك دائماً.`;
                
                await sendWhatsApp(
                    lastGuest.phone,
                    message,
                    undefined,
                    item.tenantId
                );
                
                console.log(`✅ WhatsApp notification sent to ${lastGuest.phone} for Room ${item.roomNumber}`);
            } else {
                console.warn(`⚠️ [Lost & Found] Could not find phone number for last guest in Room ${item.roomNumber}`);
            }
        } catch (whatsappError: any) {
            // Don't fail item creation if WhatsApp fails
            console.warn('⚠️ WhatsApp notification failed (non-critical):', whatsappError.message);
        }
    }

    return docRef.id;
};

/**
 * Update item
 */
export const updateLostFoundItem = async (
    itemId: string,
    updates: Partial<LostFoundItem>,
    tenantId: string
): Promise<void> => {
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    if (!tenantId) {
        throw new Error('tenantId is required for SaaS isolation');
    }
    const docRef = doc(db, `tenants/${tenantId}/lost_found`, itemId);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
    });
};

/**
 * 🔐 ATOMIC: Mark item as claimed
 * Uses runTransaction to ensure atomic update with guest identity and signature
 * Status Flow: FOUND -> CLAIMED
 */
export const claimItem = async (
    itemId: string,
    claimedBy: { 
        name: string; 
        contact: string; 
        idType?: string; 
        idNumber?: string;
        guestIdentityURL?: string; // 🔐 Proof of Identity
    },
    tenantId: string, // 🔐 REQUIRED: Tenant isolation
    signatureData?: string, // 🔐 Digital signature (Base64 or ImgBB URL)
    signatureUrl?: string // 🔐 Signature image URL
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    const itemRef = doc(db, `tenants/${tenantId}/lost_found`, itemId);
    
    try {
        await runTransaction(db, async (transaction) => {
            // 1. Re-read item to ensure latest data (prevents race conditions)
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) {
                throw new Error('العنصر غير موجود في النظام');
            }
            
            const currentData = itemDoc.data() as LostFoundItem;
            
            // 2. Validate status flow: Only FOUND items can be claimed
            if (currentData.status !== 'found') {
                throw new Error(`لا يمكن المطالبة بعنصر بحالة: ${STATUS_NAMES[currentData.status] || currentData.status}`);
            }
            
            // 3. ATOMIC UPDATE: Update status + Link guest identity + Save signature
            transaction.update(itemRef, {
                status: 'claimed',
                claimedBy: {
                    ...claimedBy,
                    guestIdentityURL: claimedBy.guestIdentityURL || null
                },
                signatureData: signatureData || null,
                signatureUrl: signatureUrl || null,
                claimedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            
            console.log(`✅ ATOMIC: Item ${itemId} claimed by ${claimedBy.name} with identity verification`);
        });
    } catch (error: any) {
        console.error('❌ ATOMIC TRANSACTION FAILED (claimItem):', error);
        throw new Error(`فشل المطالبة بالعنصر: ${error.message || 'خطأ غير معروف'}`);
    }
};

/**
 * 🔐 ATOMIC: Mark item as returned
 * Uses runTransaction to ensure atomic update
 * Status Flow: CLAIMED -> RETURNED
 * 
 * ⚠️ PROOF OF DELIVERY REQUIRED:
 * - GuestIdentityURL: Must be provided (proof of identity)
 * - SignatureData: Must be provided (digital signature)
 */
export const returnItem = async (
    itemId: string,
    returnedBy: { id: string; name: string },
    tenantId: string, // 🔐 REQUIRED: Tenant isolation
    guestIdentityURL?: string, // 🔐 REQUIRED: Proof of Identity
    signatureData?: string, // 🔐 REQUIRED: Digital signature
    signatureUrl?: string // 🔐 Optional: Signature image URL
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    
    // 🛡️ PROOF OF DELIVERY VALIDATION
    if (!guestIdentityURL || !signatureData) {
        throw new Error('يجب توفير إثبات الهوية والتوقيع الرقمي لإتمام عملية الإرجاع');
    }
    
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    const itemRef = doc(db, `tenants/${tenantId}/lost_found`, itemId);
    
    try {
        await runTransaction(db, async (transaction) => {
            // 1. Re-read item to ensure latest data (prevents race conditions)
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) {
                throw new Error('العنصر غير موجود في النظام');
            }
            
            const currentData = itemDoc.data() as LostFoundItem;
            
            // 2. Validate status flow: Only CLAIMED items can be returned
            if (currentData.status !== 'claimed') {
                throw new Error(`لا يمكن إرجاع عنصر بحالة: ${STATUS_NAMES[currentData.status] || currentData.status}. يجب أن يكون العنصر في حالة "تم المطالبة" أولاً.`);
            }
            
            // 3. ATOMIC UPDATE: Update status + Save delivery proof
            transaction.update(itemRef, {
                status: 'returned',
                returnedBy,
                signatureData: signatureData, // 🔐 Store signature
                signatureUrl: signatureUrl || null,
                claimedBy: {
                    ...currentData.claimedBy,
                    guestIdentityURL: guestIdentityURL // 🔐 Store identity proof
                },
                returnedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            
            console.log(`✅ ATOMIC: Item ${itemId} returned by ${returnedBy.name} with proof of delivery`);
        });
    } catch (error: any) {
        console.error('❌ ATOMIC TRANSACTION FAILED (returnItem):', error);
        throw new Error(`فشل إرجاع العنصر: ${error.message || 'خطأ غير معروف'}`);
    }
};

/**
 * 🔐 ATOMIC: Mark item as donated
 * Uses runTransaction to ensure atomic update
 * Status Flow: CLAIMED -> DONATED
 */
export const donateItem = async (
    itemId: string,
    donatedBy: { id: string; name: string },
    tenantId: string, // 🔐 REQUIRED: Tenant isolation
    notes?: string
): Promise<void> => {
    if (!db) throw new Error('Firebase not initialized');
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    const itemRef = doc(db, `tenants/${tenantId}/lost_found`, itemId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) {
                throw new Error('العنصر غير موجود في النظام');
            }
            
            const currentData = itemDoc.data() as LostFoundItem;
            
            // Validate status flow: Only CLAIMED items can be donated
            if (currentData.status !== 'claimed') {
                throw new Error(`لا يمكن التبرع بعنصر بحالة: ${STATUS_NAMES[currentData.status] || currentData.status}`);
            }
            
            transaction.update(itemRef, {
                status: 'donated',
                returnedBy: donatedBy, // Reuse returnedBy field for consistency
                returnedAt: serverTimestamp(), // Reuse returnedAt field
                updatedAt: serverTimestamp(),
                notes: notes || currentData.notes || null,
            });
            
            console.log(`✅ ATOMIC: Item ${itemId} donated by ${donatedBy.name}`);
        });
    } catch (error: any) {
        console.error('❌ ATOMIC TRANSACTION FAILED (donateItem):', error);
        throw new Error(`فشل التبرع بالعنصر: ${error.message || 'خطأ غير معروف'}`);
    }
};

/**
 * Mark item as disposed
 */
export const disposeItem = async (
    itemId: string,
    tenantId: string, // 🔐 REQUIRED: Tenant isolation
    notes?: string
): Promise<void> => {
    if (!tenantId) throw new Error('tenantId is required for SaaS isolation');
    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    await updateDoc(doc(db, `tenants/${tenantId}/lost_found`, itemId), {
        status: 'disposed',
        disposedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        notes: notes || null,
    });
};

// ============================================================
// STATISTICS
// ============================================================

export const getLostFoundStats = async (branchId: string, tenantId?: string) => {
    // 🔐 SECURITY: tenantId is required for SaaS isolation
    if (!tenantId) {
        console.warn('⚠️ [LostFound] getLostFoundStats called without tenantId');
        return {
            total: 0,
            found: 0,
            claimed: 0,
            returned: 0,
            donated: 0,
            disposed: 0,
            byCategory: {}
        };
    }

    // ✅ FIX: Use tenant-scoped collection for proper SaaS isolation
    const lostFoundRef = collection(db, `tenants/${tenantId}/lost_found`);
    const constraints: any[] = [
        where('branch', '==', branchId) // tenantId already in path, only need branch
    ];
    
    const q = query(
        lostFoundRef,
        ...constraints
    );

    const snapshot = await getDocs(q);
    let total = 0;
    let found = 0;
    let claimed = 0;
    let returned = 0;
    let donated = 0;
    let disposed = 0;
    const byCategory: Record<string, number> = {};

    snapshot.forEach((doc) => {
        const item = doc.data() as LostFoundItem;
        total++;

        switch (item.status) {
            case 'found': found++; break;
            case 'claimed': claimed++; break;
            case 'returned': returned++; break;
            case 'donated': donated++; break;
            case 'disposed': disposed++; break;
        }

        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    });

    return {
        total,
        found,
        claimed,
        returned,
        donated,
        disposed,
        byCategory,
    };
};