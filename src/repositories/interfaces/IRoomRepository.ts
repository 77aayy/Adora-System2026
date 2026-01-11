/**
 * Room Repository Interface
 * Defines the contract for room management operations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @interface IRoomRepository
 * @description
 * This interface abstracts room CRUD operations and real-time
 * subscriptions. All implementations must:
 * - Support multi-tenant data isolation (tenantId)
 * - Support branch-level filtering (branchId)
 * - Maintain real-time update capabilities
 */

import { Room, RoomStatus, RoomType } from '../../types';
import { Unsubscribe } from 'firebase/firestore';

/**
 * Room statistics for dashboard display
 */
export interface RoomStats {
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
}

/**
 * Room statistics grouped by room type
 */
export type RoomStatsByType = Record<string, { total: number; occupied: number }>;

/**
 * Room Repository Interface
 * Provides abstraction for all room-related operations
 */
export interface IRoomRepository {
    // ============================================================
    // READ OPERATIONS
    // ============================================================

    /**
     * Subscribes to real-time room updates for a branch
     * 
     * ## CRITICAL: Real-time Feature
     * Must support live updates via subscription pattern
     * Callback should be invoked on any room change
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch to filter rooms by
     * @param callback - Function called with updated rooms array
     * @returns Unsubscribe function to stop listening
     */
    subscribeToRooms(
        tenantId: string,
        branchId: string,
        callback: (rooms: Room[]) => void
    ): Unsubscribe;

    /**
     * Gets current status of a specific room
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch the room belongs to
     * @param roomNumber - Room number to query
     * @returns Room status or null if not found
     */
    getRoomStatus(
        tenantId: string,
        branchId: string,
        roomNumber: string
    ): Promise<RoomStatus | null>;

    /**
     * Gets room statistics for a branch
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch to get stats for
     * @returns Room counts by status
     */
    getRoomStats(
        tenantId: string,
        branchId: string
    ): Promise<RoomStats>;

    /**
     * Gets room statistics grouped by room type
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch to get stats for
     * @returns Room counts by type
     */
    getRoomStatsByType(
        tenantId: string,
        branchId: string
    ): Promise<RoomStatsByType>;

    // ============================================================
    // WRITE OPERATIONS
    // ============================================================

    /**
     * Adds a single room to a branch
     * 
     * @param room - Room data (without id and currentGuestId)
     * @throws Error if branchId or tenantId is missing
     */
    addRoom(room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void>;

    /**
     * Updates an existing room's properties
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch the room belongs to
     * @param roomNumber - Room number to update
     * @param updates - Partial room data to update
     */
    updateRoom(
        tenantId: string,
        branchId: string,
        roomNumber: string,
        updates: Partial<Room>
    ): Promise<void>;

    /**
     * Deletes a room from a branch
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch the room belongs to
     * @param roomNumber - Room number to delete
     */
    deleteRoom(
        tenantId: string,
        branchId: string,
        roomNumber: string
    ): Promise<void>;

    /**
     * Creates multiple rooms in a batch operation
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch to add rooms to
     * @param floor - Floor number for all rooms
     * @param startNumber - First room number
     * @param endNumber - Last room number (inclusive)
     * @param type - Room type for all rooms
     * @returns Number of rooms created
     */
    createRoomBatch(
        tenantId: string,
        branchId: string,
        floor: number,
        startNumber: number,
        endNumber: number,
        type: RoomType
    ): Promise<number>;

    /**
     * Updates a room's status
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch the room belongs to
     * @param roomNumber - Room number to update
     * @param status - New status to set
     */
    updateRoomStatus(
        tenantId: string,
        branchId: string,
        roomNumber: string,
        status: RoomStatus
    ): Promise<void>;

    // ============================================================
    // SPECIAL OPERATIONS
    // ============================================================

    /**
     * Transfers a guest from one room to another
     * 
     * ## Business Rules:
     * - Old room: status → 'cleaning', currentGuestId → null
     * - New room: status → 'occupied', currentGuestId → guestId
     * - Personal requests (amenities, bellman) move to new room
     * - Physical requests (maintenance) stay with old room
     * - Auto-creates bellman request for luggage transfer
     * - Auto-creates cleaning request for old room
     * 
     * @param tenantId - Tenant ID for data isolation
     * @param branchId - Branch containing both rooms
     * @param oldRoomNumber - Room guest is leaving
     * @param newRoomNumber - Room guest is moving to
     * @param guestId - Guest's ID
     * @param guestName - Guest's name
     */
    transferGuest(
        tenantId: string,
        branchId: string,
        oldRoomNumber: string,
        newRoomNumber: string,
        guestId: string,
        guestName: string
    ): Promise<void>;
}
