/**
 * Unified Room Type
 * Used across all departments
 */

import { Timestamp } from 'firebase/firestore';

export enum RoomType {
    SINGLE = 'single',
    DOUBLE = 'double',
    SUITE = 'suite',
    DELUXE = 'deluxe',
    PRESIDENTIAL = 'presidential'
}

/**
 * Room Status - Complete workflow states
 */
export enum RoomStatus {
    AVAILABLE = 'available',      // متاحة للحجز
    OCCUPIED = 'occupied',         // مشغولة بنزيل
    DIRTY = 'dirty',              // تحتاج تنظيف بعد checkout
    CLEANING = 'cleaning',         // قيد التنظيف
    READY = 'ready',              // نظيفة وجاهزة
    MAINTENANCE = 'maintenance',   // تحت الصيانة
    BLOCKED = 'blocked'           // محجوبة/غير متاحة
}

export interface Room {
    id: string;
    roomNumber: string;
    floor: number;
    type: RoomType;
    status: RoomStatus;

    // Branch/Hotel
    branch: string;
    hotelId?: string;

    // Capacity
    maxOccupancy: number;
    bedsCount: number;

    // Features
    hasBalcony?: boolean;
    hasSeaView?: boolean;
    isAccessible?: boolean;
    isSmoking?: boolean;

    // Current occupancy
    isOccupied: boolean;
    currentGuestId?: string;
    currentRoomCardId?: string;

    // Cleaning
    lastCleanedAt?: Timestamp;
    lastInspectedAt?: Timestamp;
    needsCleaning?: boolean;
    needsMaintenance?: boolean;

    // Metadata
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    notes?: string;
}

export interface RoomCard {
    id: string;
    roomNumber: string;

    // Guest info
    guestName: string;
    guestIdentity?: string;
    guestPhone?: string;

    // Occupancy
    adults: number;
    children: number;

    // Timing
    checkInTime: Timestamp;
    checkOutTime?: Timestamp;
    expectedCheckOut?: Timestamp;

    // Status
    status: 'active' | 'checked_out' | 'ready';

    // Bellman
    needsCart?: boolean;
    createdBy: string;

    // Branch
    branch: string;
    hotelId?: string;

    // Notes
    notes?: string;

    // Inspection
    inspectionCompletedAt?: Timestamp;
    inspectionStatus?: 'pending' | 'clean' | 'needs_attention';

    // QR Access
    qrActive?: boolean; // ✅ QR access enabled/disabled for this room card
}

export interface Floor {
    number: number;
    rooms: Room[];
    totalRooms: number;
    occupiedRooms: number;
    cleanRooms: number;
    dirtyRooms: number;
}
