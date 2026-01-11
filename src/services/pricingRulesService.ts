/**
 * Pricing Rules Service
 * Manages Dynamic Room Types, Seasons, and Pricing Matrix
 * Adora Hotel Management System V2
 */

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    Timestamp,
    orderBy,
    onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';

// ============================================================
// TYPES
// ============================================================

export interface RoomTypeConfig {
    id: string;
    name: string; // e.g., "King Suite", "Twin Standard"
    basePrice: number; // Default price for regular days
    seasonalPrice?: number; // Default price for ANY active season (if not overridden in matrix)
    maxOccupancy: number;
    description?: string;
    amenities?: string[];
    bookingRate?: number; // Usage: Booking.com Price = Base Price * (1 + bookingRate/100)
    active: boolean;
}

// ... (Existing interfaces Season, SeasonalPrice remain unchanged)

// ============================================================
// ROOM TYPES MANAGEMENT
// ============================================================
// ... (Existing functions getRoomTypes, subscribeToRoomTypes, etc. remain unchanged)

// ============================================================
// LOGIC: GET EFFECTIVE PRICE
// ============================================================

/**
 * Calculates the base price for a specific date and room type.
 * Priority: Specific Matrix Price > General Room Seasonal Price (if season active) > General Room Base Price
 */
export const getEffectiveBasePrice = async (
    tenantId: string,
    branchId: string,
    roomTypeId: string,
    date: Date = new Date()
): Promise<{ price: number; source: 'SEASONAL' | 'BASE' | 'MATRIX'; seasonName?: string }> => {

    // 1. Get Room Type Default
    const typeDoc = await import('firebase/firestore').then(m => m.getDoc(
        doc(db, `tenants/${tenantId}/branches/${branchId}/room_types`, roomTypeId)
    ));

    if (!typeDoc.exists()) {
        console.warn("Room Type not found, returning fallback 0");
        return { price: 0, source: 'BASE' };
    }

    const roomType = typeDoc.data() as RoomTypeConfig;
    const basePrice = roomType.basePrice || 0;
    const seasonalPrice = roomType.seasonalPrice || basePrice; // Fallback to base if not set

    // 2. Check Active Seasons
    const seasons = await getSeasons(tenantId, branchId);

    // Filter seasons that include 'date'
    const activeSeasons = seasons.filter(s => {
        const start = s.startDate.toDate();
        const end = s.endDate.toDate();
        // Reset hours for clean comparison
        const check = new Date(date);
        check.setHours(0, 0, 0, 0);
        return check >= start && check <= end;
    });

    if (activeSeasons.length === 0) {
        return { price: basePrice, source: 'BASE' };
    }

    // 3. Resolve Priority (Highest priority season wins)
    // Sort by priority descending
    activeSeasons.sort((a, b) => b.priority - a.priority);
    const winningSeason = activeSeasons[0];

    // 4. Get Price for this Season + Room Type (Matrix Override)
    const pricesSnap = await getDocs(query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/seasonal_prices`),
        where('seasonId', '==', winningSeason.id),
        where('roomTypeId', '==', roomTypeId)
    ));

    if (!pricesSnap.empty) {
        const matrixPrice = pricesSnap.docs[0].data().price;
        // Only return if it's a valid number
        if (matrixPrice > 0) {
            return {
                price: Number(matrixPrice),
                source: 'MATRIX',
                seasonName: winningSeason.name
            };
        }
    }

    // 5. Fallback to General Seasonal Price (New Logic)
    // If we are in a season, but no specific matrix override, use the Room Type's "Seasonal Price"
    if (seasonalPrice > 0 && seasonalPrice !== basePrice) {
        return {
            price: seasonalPrice,
            source: 'SEASONAL',
            seasonName: winningSeason.name
        };
    }

    // Final Fallback
    return { price: basePrice, source: 'BASE' };
};

export interface Season {
    id: string;
    name: string; // e.g., "Winter Holiday", "Ramadan"
    startDate: Timestamp;
    endDate: Timestamp;
    color?: string; // For UI visualization
    priority: number; // 1 = Low, 10 = High (If seasons overlap, high priority wins)
}

export interface SeasonalPrice {
    id: string;
    seasonId: string;
    roomTypeId: string;
    price: number; // The specific price for this room in this season
}

// ============================================================
// ROOM TYPES MANAGEMENT
// ============================================================

export const getRoomTypes = async (tenantId: string, branchId: string): Promise<RoomTypeConfig[]> => {
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/room_types`),
        where('active', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomTypeConfig));
};

export const subscribeToRoomTypes = (
    tenantId: string,
    branchId: string,
    callback: (types: RoomTypeConfig[]) => void
) => {
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/room_types`),
        where('active', '==', true)
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomTypeConfig)));
    });
};

export const addRoomType = async (tenantId: string, branchId: string, type: Omit<RoomTypeConfig, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/room_types`), type);
    return docRef.id;
};

export const updateRoomType = async (tenantId: string, branchId: string, typeId: string, updates: Partial<RoomTypeConfig>) => {
    await updateDoc(doc(db, `tenants/${tenantId}/branches/${branchId}/room_types`, typeId), updates);
};

export const deleteRoomType = async (tenantId: string, branchId: string, typeId: string) => {
    // Soft delete to preserve history
    await updateDoc(doc(db, `tenants/${tenantId}/branches/${branchId}/room_types`, typeId), { active: false });
};

// ============================================================
// SEASONS MANAGEMENT
// ============================================================

export const getSeasons = async (tenantId: string, branchId: string): Promise<Season[]> => {
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/seasons`),
        orderBy('startDate')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Season));
};

export const subscribeToSeasons = (
    tenantId: string,
    branchId: string,
    callback: (seasons: Season[]) => void
) => {
    const q = query(
        collection(db, `tenants/${tenantId}/branches/${branchId}/seasons`),
        orderBy('startDate')
    );
    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Season)));
    });
};

export const addSeason = async (tenantId: string, branchId: string, season: Omit<Season, 'id'>): Promise<string> => {
    const docRef = await addDoc(collection(db, `tenants/${tenantId}/branches/${branchId}/seasons`), season);
    return docRef.id;
};

export const deleteSeason = async (tenantId: string, branchId: string, seasonId: string) => {
    await deleteDoc(doc(db, `tenants/${tenantId}/branches/${branchId}/seasons`, seasonId));
};

// ============================================================
// PRICING MATRIX MANAGEMENT
// ============================================================

export const getSeasonalPrices = async (tenantId: string, branchId: string): Promise<SeasonalPrice[]> => {
    const snap = await getDocs(collection(db, `tenants/${tenantId}/branches/${branchId}/seasonal_prices`));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SeasonalPrice));
};

export const setSeasonalPrice = async (
    tenantId: string,
    branchId: string,
    seasonId: string,
    roomTypeId: string,
    price: number
) => {
    const colRef = collection(db, `tenants/${tenantId}/branches/${branchId}/seasonal_prices`);
    // Check if exists
    const q = query(
        colRef,
        where('seasonId', '==', seasonId),
        where('roomTypeId', '==', roomTypeId)
    );
    const snap = await getDocs(q);

    if (!snap.empty) {
        // Update
        const docId = snap.docs[0].id;
        await updateDoc(doc(db, `tenants/${tenantId}/branches/${branchId}/seasonal_prices`, docId), { price });
    } else {
        // Create
        await addDoc(colRef, { seasonId, roomTypeId, price });
    }
};


