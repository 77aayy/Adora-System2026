/**
 * Firebase Room Repository Implementation
 * Implements IRoomRepository using Firebase/Firestore
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * This implementation wraps the existing roomService functions
 * to provide the IRoomRepository interface. Maintains:
 * - Real-time subscriptions (onSnapshot)
 * - Multi-tenant data isolation
 * - Offline persistence compatibility
 */

import { IRoomRepository, RoomStats, RoomStatsByType } from '../interfaces/IRoomRepository';
import { Room, RoomStatus, RoomType } from '../../types';
import { Unsubscribe } from 'firebase/firestore';
import {
    subscribeToRooms as firebaseSubscribeToRooms,
    addRoom as firebaseAddRoom,
    updateRoom as firebaseUpdateRoom,
    deleteRoom as firebaseDeleteRoom,
    createRoomBatch as firebaseCreateRoomBatch,
    getRoomStats as firebaseGetRoomStats,
    getRoomStatsByType as firebaseGetRoomStatsByType,
    updateRoomStatus as firebaseUpdateRoomStatus,
    getRoomStatus as firebaseGetRoomStatus,
    transferGuest as firebaseTransferGuest
} from '../../services/roomService';

/**
 * Firebase implementation of IRoomRepository
 * 
 * @example
 * ```typescript
 * const roomRepo = new FirebaseRoomRepository();
 * const unsubscribe = roomRepo.subscribeToRooms(tenantId, branchId, setRooms);
 * ```
 */
export class FirebaseRoomRepository implements IRoomRepository {
    /**
     * Subscribes to real-time room updates
     * Uses Firebase onSnapshot for live updates
     */
    subscribeToRooms(
        tenantId: string,
        branchId: string,
        callback: (rooms: Room[]) => void
    ): Unsubscribe {
        return firebaseSubscribeToRooms(branchId, callback, tenantId);
    }

    /**
     * Gets current status of a room
     */
    async getRoomStatus(
        tenantId: string,
        branchId: string,
        roomNumber: string
    ): Promise<RoomStatus | null> {
        return firebaseGetRoomStatus(tenantId, branchId, roomNumber);
    }

    /**
     * Gets room statistics for a branch
     */
    async getRoomStats(tenantId: string, branchId: string): Promise<RoomStats> {
        return firebaseGetRoomStats(branchId, tenantId);
    }

    /**
     * Gets room statistics grouped by type
     */
    async getRoomStatsByType(tenantId: string, branchId: string): Promise<RoomStatsByType> {
        return firebaseGetRoomStatsByType(branchId, tenantId);
    }

    /**
     * Adds a single room
     */
    async addRoom(room: Omit<Room, 'id' | 'currentGuestId'>): Promise<void> {
        return firebaseAddRoom(room);
    }

    /**
     * Updates a room
     */
    async updateRoom(
        tenantId: string,
        branchId: string,
        roomNumber: string,
        updates: Partial<Room>
    ): Promise<void> {
        return firebaseUpdateRoom(tenantId, branchId, roomNumber, updates);
    }

    /**
     * Deletes a room
     */
    async deleteRoom(
        tenantId: string,
        branchId: string,
        roomNumber: string
    ): Promise<void> {
        return firebaseDeleteRoom(tenantId, branchId, roomNumber);
    }

    /**
     * Creates multiple rooms in batch
     */
    async createRoomBatch(
        tenantId: string,
        branchId: string,
        floor: number,
        startNumber: number,
        endNumber: number,
        type: RoomType
    ): Promise<number> {
        return firebaseCreateRoomBatch(floor, startNumber, endNumber, type, branchId, tenantId);
    }

    /**
     * Updates room status
     */
    async updateRoomStatus(
        tenantId: string,
        branchId: string,
        roomNumber: string,
        status: RoomStatus
    ): Promise<void> {
        return firebaseUpdateRoomStatus(tenantId, branchId, roomNumber, status);
    }

    /**
     * Transfers a guest between rooms
     */
    async transferGuest(
        tenantId: string,
        branchId: string,
        oldRoomNumber: string,
        newRoomNumber: string,
        guestId: string,
        guestName: string
    ): Promise<void> {
        return firebaseTransferGuest(tenantId, branchId, oldRoomNumber, newRoomNumber, guestId, guestName);
    }
}

/**
 * Singleton instance for convenience
 */
export const roomRepository = new FirebaseRoomRepository();
