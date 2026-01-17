/**
 * Room Service
 * Manages hotel rooms data with multi-tenant isolation
 * Adora Hotel Management System V3
 * 
 * @module roomService
 * @description
 * This service handles all room-related operations in the hotel management system.
 * Rooms are stored under each tenant's isolated collection for data security.
 * 
 * ## Hotel Workflow Context:
 * - Rooms are created by managers during hotel setup
 * - Room status changes throughout the guest journey:
 *   - `available` → Guest can check-in
 *   - `occupied` → Guest is staying
 *   - `cleaning` → Housekeeping is working
 *   - `maintenance` → Maintenance issue detected
 *   - `out_of_order` → Room blocked for use
 * 
 * ## Data Isolation (SaaS):
 * - All rooms stored under: `tenants/{tenantId}/rooms`
 * - Document ID format: `{branchId}_{roomNumber}` for branch isolation
 * - TenantId is mandatory for all operations
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    runTransaction,
    serverTimestamp,
    Unsubscribe,
    getDocs,
    writeBatch,
    where,
} from 'firebase/firestore';
import { db } from './firebase';
import { Room, RoomStatus, RoomType } from '../types';
import { validateTenantAccess, validateTenantId } from './tenantSecurityService';
import { logger } from './loggerService';
import { logAction, LogAction } from './advancedLogService';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Converts a Firestore document to a Room object
 * @private
 * @param doc - Firestore document snapshot
 * @returns Room object with all properties mapped
 */
const mapDocToRoom = (doc: any): Room => {
    const data = doc.data();
    return {
        id: doc.id,
        number: data.number,
        floor: data.floor,
        type: data.type as RoomType,
        status: data.status as RoomStatus,
        currentGuestId: data.currentGuestId || null,
        branchId: data.branchId,
        tenantId: data.tenantId
    };
};

/**
 * Generates a composite document ID for branch-level isolation
 * @private
 * @param branchId - The branch identifier
 * @param roomNumber - The room number
 * @returns Composite ID in format: "{branchId}_{roomNumber}"
 * 
 * @example
 * getRoomDocId('branch-1', '101') // Returns: 'branch-1_101'
 */
const getRoomDocId = (branchId: string, roomNumber: string) => `${branchId}_${roomNumber}`;

// ============================================================
// READ OPERATIONS (Real-time)
// ============================================================

/**
 * Subscribes to real-time room updates for a specific branch
 * 
 * ## Business Logic:
 * - Returns only rooms belonging to the specified branch
 * - Rooms are sorted by floor (ascending), then by room number (natural sort)
 * - Updates callback whenever any room changes (add/update/delete)
 * 
 * ## Security Constraints:
 * - ❌ Returns empty array if tenantId is not provided
 * - ✅ Only returns rooms within tenant's isolated collection
 * 
 * ## Side Effects:
 * - Creates a Firestore listener that persists until unsubscribed
 * - Logs errors to console on subscription failures
 * 
 * @param branchId - The branch to filter rooms by
 * @param callback - Function called with updated rooms array on each change
 * @param tenantId - The tenant ID for data isolation (required)
 * @returns Unsubscribe function to stop listening
 * 
 * @example
 * ```typescript
 * // In a React component
 * useEffect(() => {
 *   const unsubscribe = subscribeToRooms(branchId, (rooms) => {
 *     setRooms(rooms);
 *   }, tenantId);
 *   
 *   return () => unsubscribe();
 * }, [branchId, tenantId]);
 * ```
 */
/**
 * ⚡ PERFORMANCE: Fetch rooms ONE TIME (preferred for lists)
 * Use this instead of subscribeToRooms for better performance
 */
export const getRooms = async (
    branchId: string,
    tenantId: string,
    maxResults: number = 100 // ⚡ Limit results
): Promise<Room[]> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get rooms', undefined, 'roomService');
        return [];
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);
    
    const { cachedFetch } = await import('../utils/requestCache');
    const cacheKey = `rooms:${tenantId}:${branchId}`;
    
    return cachedFetch<Room[]>(
        cacheKey,
        async () => {
            // ✅ Use tenant-scoped collection
            const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
            const q = query(
                roomsRef,
                where('branchId', '==', branchId),
                limit(maxResults) // ⚡ LIMIT
            );
            
            const snapshot = await getDocs(q);
            return snapshot.docs
                .map(mapDocToRoom)
                .sort((a, b) => {
                    if (a.floor !== b.floor) return a.floor - b.floor;
                    return a.number.localeCompare(b.number, undefined, { numeric: true });
                });
        },
        { ttl: 30 * 1000 } // 30 second cache
    );
};

/**
 * Subscribe to rooms (real-time) - USE SPARINGLY
 * ⚠️ PERFORMANCE: Prefer getRooms() for most use cases
 */
export const subscribeToRooms = (
    branchId: string,
    callback: (rooms: Room[]) => void,
    tenantId: string,
    maxResults: number = 100 // ⚡ Added limit
): Unsubscribe => {
    // 🛡️ ADORA PROTECTION: Block subscription without TenantId
    if (!tenantId || tenantId.trim() === '') {
        console.warn('⚠️ ADORA: Attempted to subscribe to rooms without TenantId. Blocked.');
        logger.error('TenantId is required for subscribeToRooms', undefined, 'roomService');
        callback([]);
        return () => { }; // Return empty unsubscribe function
    }

    // 🛡️ ADORA PROTECTION: Check Firestore initialization
    if (!db) {
        logger.error('Firebase not initialized - cannot subscribe to rooms', undefined, 'roomService');
        callback([]);
        return () => { };
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
        const q = query(
            roomsRef,
            where('branchId', '==', branchId),
            limit(maxResults) // ⚡ LIMIT
        );

        return onSnapshot(q, (snapshot) => {
            try {
                // Sort client-side to avoid Firestore composite index requirements
                const rooms = snapshot.docs
                    .map(mapDocToRoom)
                    .sort((a, b) => {
                        if (a.floor !== b.floor) return a.floor - b.floor;
                        return a.number.localeCompare(b.number, undefined, { numeric: true });
                    });
                callback(rooms);
            } catch (error) {
                console.error('🔥 ADORA Firestore Error in subscribeToRooms callback:', error);
                logger.error('Error processing rooms snapshot', error, 'roomService');
                callback([]); // Return empty array on error
            }
        }, (error) => {
            console.error('🔥 ADORA Firestore Error subscribing to rooms:', error);
            logger.error('Error subscribing to rooms', error, 'roomService');
            callback([]); // Return empty array on subscription error
        });
    } catch (error) {
        console.error('🔥 ADORA Firestore Error in subscribeToRooms:', error);
        logger.error('Error in subscribeToRooms', error, 'roomService');
        callback([]);
        return () => { }; // Return empty unsubscribe function
    }
};

// ============================================================
// WRITE OPERATIONS
// ============================================================

/**
 * Adds a single room to a branch
 * 
 * ## Business Logic:
 * - Creates a new room document with composite ID for branch isolation
 * - Sets initial status and currentGuestId to null
 * 
 * ## Security Constraints:
 * - ❌ Throws error if branchId is missing
 * - ❌ Throws error if tenantId is missing (SaaS requirement)
 * 
 * ## Side Effects:
 * - Creates document in Firestore: `tenants/{tenantId}/rooms/{branchId}_{roomNumber}`
 * 
 * @param room - Room data (without id and currentGuestId)
 * @throws Error if branchId or tenantId is missing
 * 
 * @example
 * ```typescript
 * await addRoom({
 *   number: '101',
 *   floor: 1,
 *   type: 'standard',
 *   status: 'available',
 *   branchId: 'branch-1',
 *   tenantId: 'tenant-abc'
 * });
 * ```
 */
export const addRoom = async (room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot add room', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    if (!room.branchId) throw new Error('Branch ID is required for adding a room');
    const validatedTenantId = validateTenantId(room.tenantId);
    validateTenantAccess(validatedTenantId);

    const docId = getRoomDocId(room.branchId, room.number);
    // ✅ Use tenant-scoped collection
    const roomsCollection = collection(db, `tenants/${validatedTenantId}/rooms`);
    const roomRef = doc(roomsCollection, docId);
    await setDoc(roomRef, {
        ...room,
        currentGuestId: null,
    });
};

/**
 * Updates an existing room's properties
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * - ❌ Throws error if branchId is missing
 * 
 * ## Side Effects:
 * - Updates document in Firestore
 * 
 * @param tenantId - The tenant ID for data isolation
 * @param branchId - The branch the room belongs to
 * @param roomNumber - The room number to update
 * @param updates - Partial room data to update
 * @throws Error if tenantId or branchId is missing
 */
export const updateRoom = async (tenantId: string, branchId: string, roomNumber: string, updates: Partial<Room>): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot update room', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);
    if (!branchId) throw new Error('Branch ID is required for updating a room');

    const docId = getRoomDocId(branchId, roomNumber);
    // ✅ Use tenant-scoped collection
    const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, docId);
    await updateDoc(roomRef, updates);
};

/**
 * Deletes a room from a branch
 * 
 * ## Business Logic:
 * - Permanently removes the room document from Firestore
 * - Should only be used during hotel setup, not during operations
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * - ❌ Throws error if branchId is missing
 * 
 * ## Warning:
 * This is a destructive operation. Consider checking for active room cards
 * before deleting a room.
 * 
 * @param tenantId - The tenant ID for data isolation
 * @param branchId - The branch the room belongs to
 * @param roomNumber - The room number to delete
 * @throws Error if tenantId or branchId is missing
 */
export const deleteRoom = async (tenantId: string, branchId: string, roomNumber: string): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot delete room', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);
    if (!branchId) throw new Error('Branch ID is required for deleting a room');

    const docId = getRoomDocId(branchId, roomNumber);
    // ✅ Use tenant-scoped collection
    const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, docId);
    await deleteDoc(roomRef);
};

/**
 * Creates multiple rooms in a single batch operation
 * 
 * ## Business Logic:
 * - Creates rooms with sequential numbers from startNumber to endNumber
 * - All rooms are assigned to the same floor and type
 * - All rooms start with 'available' status
 * 
 * ## Use Cases:
 * - Initial hotel setup: "Create rooms 101-120 on floor 1"
 * - Adding a new floor: "Add rooms 201-225 on floor 2"
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * 
 * ## Side Effects:
 * - Creates multiple documents in a single Firestore batch write
 * 
 * @param floor - The floor number for all rooms
 * @param startNumber - First room number in the range
 * @param endNumber - Last room number in the range (inclusive)
 * @param type - Room type for all rooms
 * @param branchId - The branch to add rooms to
 * @param tenantId - The tenant ID (mandatory)
 * @returns Number of rooms created
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * // Create rooms 101-110 on floor 1
 * const count = await createRoomBatch(1, 101, 110, 'standard', branchId, tenantId);
 * console.log(`Created ${count} rooms`); // "Created 10 rooms"
 * ```
 */
export const createRoomBatch = async (
    floor: number,
    startNumber: number,
    endNumber: number,
    type: RoomType,
    branchId: string,
    tenantId: string
): Promise<number> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot create room batch', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    const batch = writeBatch(db);
    let count = 0;

    for (let num = startNumber; num <= endNumber; num++) {
        const roomNumber = num.toString();
        const docId = getRoomDocId(branchId, roomNumber);
        // ✅ Use tenant-scoped collection
        const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, docId);

        batch.set(roomRef, {
            number: roomNumber,
            floor,
            type,
            status: 'available' as RoomStatus,
            currentGuestId: null,
            branchId,
            tenantId: validatedTenantId
        });
        count++;
    }

    await batch.commit();
    return count;
};

// ============================================================
// STATISTICS & ANALYTICS
// ============================================================

/**
 * Gets room statistics for a branch (occupancy overview)
 * 
 * ## Business Logic:
 * Counts rooms by status for dashboard display:
 * - `total`: All rooms in the branch
 * - `available`: Ready for check-in
 * - `occupied`: Guest staying
 * - `cleaning`: Housekeeping in progress
 * - `maintenance`: Under maintenance
 * 
 * ## Use Cases:
 * - Manager dashboard: Show occupancy rates
 * - Reception: Quick availability check
 * - Reports: Daily occupancy statistics
 * 
 * @param branchId - The branch to get stats for
 * @param tenantId - The tenant ID for data isolation
 * @returns Object with room counts by status
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * const stats = await getRoomStats(branchId, tenantId);
 * const occupancyRate = (stats.occupied / stats.total) * 100;
 * console.log(`Occupancy: ${occupancyRate.toFixed(1)}%`);
 * ```
 */
export const getRoomStats = async (branchId: string, tenantId: string): Promise<{
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
}> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get room stats', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
    const q = query(roomsRef, where('branchId', '==', branchId));
    const snapshot = await getDocs(q);

    const stats = {
        total: 0,
        available: 0,
        occupied: 0,
        cleaning: 0,
        maintenance: 0,
    };

    snapshot.forEach((doc) => {
        const data = doc.data();
        stats.total++;
        if (data.status === 'available') stats.available++;
        else if (data.status === 'occupied') stats.occupied++;
        else if (data.status === 'cleaning') stats.cleaning++;
        else if (data.status === 'maintenance') stats.maintenance++;
    });

    return stats;
};

/**
 * Gets room statistics grouped by room type
 * 
 * ## Business Logic:
 * Provides occupancy breakdown by room category (standard, deluxe, suite, etc.)
 * Useful for pricing analysis and demand forecasting.
 * 
 * @param branchId - The branch to get stats for
 * @param tenantId - The tenant ID for data isolation
 * @returns Map of room types to their total and occupied counts
 * @throws Error if tenantId is missing
 * 
 * @example
 * ```typescript
 * const statsByType = await getRoomStatsByType(branchId, tenantId);
 * // { 'standard': { total: 20, occupied: 15 }, 'suite': { total: 5, occupied: 3 } }
 * ```
 */
export const getRoomStatsByType = async (branchId: string, tenantId: string): Promise<Record<string, { total: number; occupied: number }>> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get room stats by type', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    // ✅ Use tenant-scoped collection
    const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
    const q = query(roomsRef, where('branchId', '==', branchId));
    const snapshot = await getDocs(q);

    const stats: Record<string, { total: number; occupied: number }> = {};

    snapshot.forEach((doc) => {
        const data = doc.data();
        const type = data.type || 'standard';

        if (!stats[type]) {
            stats[type] = { total: 0, occupied: 0 };
        }

        stats[type].total++;
        if (data.status === 'occupied') {
            stats[type].occupied++;
        }
    });

    return stats;
};

// ============================================================
// STATUS MANAGEMENT
// ============================================================

/**
 * Updates a room's status
 * 
 * ## Business Logic:
 * Central function for room status transitions. Common flows:
 * - Check-in: `available` → `occupied`
 * - Check-out: `occupied` → `cleaning`
 * - Cleaning done: `cleaning` → `available`
 * - Issue found: any → `maintenance`
 * 
 * ## Side Effects:
 * - Updates room document with new status
 * - Sets `updatedAt` timestamp for audit trail
 * 
 * @param tenantId - The tenant ID for data isolation
 * @param branchId - The branch the room belongs to
 * @param roomNumber - The room number to update
 * @param status - The new status to set
 * @throws Error if tenantId is missing or update fails
 * 
 * @example
 * ```typescript
 * // After housekeeping completes cleaning
 * await updateRoomStatus(tenantId, branchId, '101', 'available');
 * ```
 */
export const updateRoomStatus = async (
    tenantId: string,
    branchId: string,
    roomNumber: string,
    status: RoomStatus
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot update room status', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);
        const docId = getRoomDocId(branchId, roomNumber);
        
        // ✅ Get room before update (for audit log)
        const roomRef = doc(db, `tenants/${validatedTenantId}/rooms`, docId);
        const roomSnap = await getDoc(roomRef);
        const oldStatus = roomSnap.exists() ? (roomSnap.data().status as RoomStatus) : null;
        
        // ✅ Use tenant-scoped collection
        await updateDoc(roomRef, {
            status,
            updatedAt: serverTimestamp()
        });

        // 📝 Audit Log: Room Status Change
        try {
            const storedUser = localStorage.getItem('adora_user');
            const userData = storedUser ? JSON.parse(storedUser) : {};
            await logAction(
                'ROOM_STATUS_CHANGE' as LogAction,
                {
                    id: userData.id || 'system',
                    name: userData.name || 'System',
                    role: userData.role || 'staff',
                    department: userData.department || 'reception'
                },
                {
                    type: 'room',
                    id: docId,
                    name: `غرفة ${roomNumber}`
                },
                {
                    tenantId: validatedTenantId,
                    branchId: branchId,
                    roomNumber: roomNumber
                },
                {
                    description: `تم تغيير حالة الغرفة من ${oldStatus || 'unknown'} إلى ${status}`,
                    previousValue: oldStatus,
                    newValue: status,
                    metadata: { roomNumber, branchId }
                }
            ).catch(err => logger.warn('Failed to log room status change', err, 'roomService'));
        } catch (auditError) {
            logger.warn('Failed to create audit log for room status change', auditError, 'roomService');
        }
    } catch (error) {
        console.error(`Error updating room ${roomNumber} status:`, error);
        throw error;
    }
};

/**
 * Gets the current status of a specific room
 * 
 * ## Use Cases:
 * - Reception: Check if room is available before check-in
 * - Housekeeping: Verify room status before starting work
 * 
 * @param tenantId - The tenant ID for data isolation
 * @param branchId - The branch the room belongs to
 * @param roomNumber - The room number to query
 * @returns The room's current status, or null if room not found
 * @throws Error if tenantId is missing
 */
export const getRoomStatus = async (
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<RoomStatus | null> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot get room status', undefined, 'roomService');
        return null;
    }

    try {
        const validatedTenantId = validateTenantId(tenantId);
        validateTenantAccess(validatedTenantId);

        // ✅ Use tenant-scoped collection
        const roomsRef = collection(db, `tenants/${validatedTenantId}/rooms`);
        const q = query(roomsRef, where('branchId', '==', branchId), where('number', '==', roomNumber));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return null;
        return snapshot.docs[0].data().status as RoomStatus;

    } catch (error) {
        console.error(`Error getting room ${roomNumber} status:`, error);
        return null;
    }
};

// ============================================================
// MIGRATION UTILITIES
// ============================================================

/**
 * Migrates a legacy room to the new composite ID structure
 * 
 * ## Business Logic:
 * Used for database migration from old schema (ID = roomNumber) to new
 * schema (ID = branchId_roomNumber). Uses atomic transaction to prevent
 * data loss.
 * 
 * ## Migration Steps:
 * 1. Verify target location doesn't already have a room (collision check)
 * 2. Copy room data to new location with composite ID
 * 3. Delete old document
 * 
 * ## Security Constraints:
 * - ❌ Throws error if target room already exists (no overwrite)
 * 
 * ## Side Effects:
 * - Creates new document in tenant's rooms collection
 * - Deletes old document from legacy 'rooms' collection
 * - Adds `_migratedAt` timestamp for audit
 * 
 * @param legacyDocId - The old document ID in legacy 'rooms' collection
 * @param roomData - The room data to migrate
 * @param branchId - The branch to migrate the room to
 * @param tenantId - The tenant ID for data isolation
 * @throws Error if target room already exists or migration fails
 */
export const migrateLegacyRoom = async (
    legacyDocId: string,
    roomData: Room,
    branchId: string,
    tenantId: string
): Promise<void> => {
    try {
        const newDocId = getRoomDocId(branchId, roomData.number);

        await runTransaction(db, async (transaction) => {
            const legacyRef = doc(db, 'rooms', legacyDocId);
            const newRef = doc(db, `tenants/${tenantId}/rooms`, newDocId);

            // Collision protection: Check if target already exists
            const newSnap = await transaction.get(newRef);
            if (newSnap.exists()) {
                throw new Error("Target room already exists. Please delete duplicate manually.");
            }

            // Copy data to new document with audit trail
            transaction.set(newRef, {
                ...roomData,
                id: newDocId,
                _migratedAt: serverTimestamp()
            });

            // Delete legacy document
            transaction.delete(legacyRef);
        });
    } catch (error) {
        console.error("Migration failed:", error);
        throw error;
    }
};

/**
 * Transfers a guest from one room to another (Room Turn Operation)
 * 
 * ## Business Logic:
 * Handles the complete room transfer workflow when a guest needs to move:
 * 
 * ### Room Status Changes:
 * - Old room: `occupied` → `cleaning`
 * - New room: any → `occupied`
 * 
 * ### Request Migration:
 * - "Personal" requests (amenities, bellman, vip_service) move to new room
 * - "Physical" requests (maintenance) stay with old room
 * 
 * ### Auto-Generated Requests:
 * 1. **Bellman Request**: Move luggage from old to new room (URGENT)
 * 2. **Cleaning Request**: Clean old room after guest leaves
 * 
 * ## Use Cases:
 * - Room upgrade: Guest moves to better room
 * - Room issue: AC broken, move guest temporarily
 * - Guest complaint: Move to quieter room
 * 
 * ## Security Constraints:
 * - ❌ Throws error if tenantId is missing
 * - ❌ Throws error if either room doesn't exist
 * 
 * ## Side Effects:
 * - Updates both room documents
 * - Migrates relevant requests to new room
 * - Creates bellman request for luggage
 * - Creates cleaning request for old room
 * 
 * @param tenantId - The tenant ID for data isolation
 * @param branchId - The branch containing both rooms
 * @param oldRoomNumber - The room guest is leaving
 * @param newRoomNumber - The room guest is moving to
 * @param guestId - The guest's ID for tracking
 * @param guestName - The guest's name for request creation
 * @throws Error if tenantId is missing or either room doesn't exist
 * 
 * @example
 * ```typescript
 * // Guest in room 101 needs upgrade to room 301
 * await transferGuest(
 *   tenantId,
 *   branchId,
 *   '101',    // old room
 *   '301',    // new room (suite)
 *   'guest-abc',
 *   'محمد أحمد'
 * );
 * // Result:
 * // - Room 101: status = 'cleaning'
 * // - Room 301: status = 'occupied', currentGuestId = 'guest-abc'
 * // - Bellman request created: "نقل أمتعة (تحويل غرفة)"
 * // - Cleaning request created for room 101
 * ```
 */
export const transferGuest = async (
    tenantId: string,
    branchId: string,
    oldRoomNumber: string,
    newRoomNumber: string,
    guestId: string,
    guestName: string
): Promise<void> => {
    if (!db) {
        logger.error('Firebase not initialized - cannot transfer guest', undefined, 'roomService');
        throw new Error('النظام غير جاهز. يرجى إعادة المحاولة.');
    }

    const validatedTenantId = validateTenantId(tenantId);
    validateTenantAccess(validatedTenantId);

    try {
        const oldDocId = getRoomDocId(branchId, oldRoomNumber);
        const newDocId = getRoomDocId(branchId, newRoomNumber);

        // ✅ Use tenant-scoped collections
        const roomsCollPath = `tenants/${validatedTenantId}/rooms`;
        const oldRoomRef = doc(db, roomsCollPath, oldDocId);
        const newRoomRef = doc(db, roomsCollPath, newDocId);
        const requestsRef = collection(db, `tenants/${validatedTenantId}/requests`);

        // Atomic room status update
        await runTransaction(db, async (transaction) => {
            // Verify both rooms exist
            const oldRoomSnap = await transaction.get(oldRoomRef);
            const newRoomSnap = await transaction.get(newRoomRef);

            if (!oldRoomSnap.exists() || !newRoomSnap.exists()) {
                throw new Error("One of the rooms does not exist in this branch");
            }

            // Update old room: mark for cleaning
            transaction.update(oldRoomRef, {
                status: 'cleaning',
                currentGuestId: null,
                updatedAt: serverTimestamp()
            });

            // Update new room: mark as occupied
            transaction.update(newRoomRef, {
                status: 'occupied',
                currentGuestId: guestId,
                updatedAt: serverTimestamp()
            });
        });

        // Post-transaction: Migrate requests and create follow-up tasks
        const timestamp = serverTimestamp();
        const batch = writeBatch(db);

        // Find active requests for the old room
        const q = query(
            requestsRef,
            where('roomNumber', '==', oldRoomNumber),
            where('branchId', '==', branchId),
            where('status', 'in', ['PENDING_RECEPTION', 'CONFIRMED', 'IN_PROGRESS', 'WAITING_PARTS'])
        );
        const activeRequests = await getDocs(q);

        // Migrate "personal" requests (follow the guest)
        activeRequests.forEach((requestDoc) => {
            const data = requestDoc.data();
            const shouldMove = ['amenities', 'bellman', 'vip_service', 'other'].includes(data.type);

            if (shouldMove) {
                batch.update(requestDoc.ref, {
                    roomNumber: newRoomNumber,
                    notes: (data.notes || '') + `\n[System]: Transferred from Room ${oldRoomNumber}`,
                    updatedAt: timestamp
                });
            }
        });

        // Auto-create: Bellman request for luggage transfer
        const bellmanReqRef = doc(requestsRef);
        batch.set(bellmanReqRef, {
            type: 'bellman',
            status: 'PENDING_RECEPTION',
            priority: 'urgent',
            guestName: guestName,
            roomNumber: newRoomNumber,
            title: `نقل أمتعة (تحويل غرفة)`,
            description: `نقل الأمتعة من الغرفة ${oldRoomNumber} إلى ${newRoomNumber}`,
            branchId: branchId,
            tenantId: validatedTenantId,
            createdAt: timestamp,
            timeline: { created: timestamp },
            source: 'system_auto'
        });

        // Auto-create: Cleaning request for old room
        const cleaningReqRef = doc(requestsRef);
        batch.set(cleaningReqRef, {
            type: 'cleaning',
            status: 'PENDING_HOUSEKEEPING',
            guestName: 'System (Checkout)',
            roomNumber: oldRoomNumber,
            title: 'تنظيف خروج (نقل نزيل)',
            description: `الغرفة بحاجة لتنظيف بعد نقل النزيل إلى ${newRoomNumber}`,
            branchId: branchId,
            tenantId: validatedTenantId,
            createdAt: timestamp,
            timeline: { created: timestamp },
            source: 'system_auto'
        });

        await batch.commit();

    } catch (error) {
        console.error("Transfer Guest failed:", error);
        throw error;
    }
};
