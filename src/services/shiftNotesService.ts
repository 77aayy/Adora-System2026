/**
 * Shift Notes Service
 * Adora Hotel Management System V2
 * 
 * Manages shift notes workflow:
 * - Active notes visible in reception notifications
 * - Notes per room
 * - Archive on checkout (from Bellman)
 */

import { db } from './firebase';
import {
    collection, doc, addDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, Timestamp, writeBatch
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type NoteStatus = 'active' | 'archived';
export type NotePriority = 'normal' | 'important' | 'urgent';

export interface ShiftNote {
    id: string;
    roomNumber?: string;
    content: string;
    priority: NotePriority;
    status: NoteStatus;
    createdBy: {
        id: string;
        name: string;
        department?: string;
    };
    createdAt: any;
    readBy?: string[];      // Employee IDs who read the note
    archivedAt?: any;
    archivedBy?: {
        id: string;
        name: string;
    };
    checkoutId?: string;    // Link to checkout that triggered archive
}

export interface CreateNoteData {
    roomNumber?: string;
    content: string;
    priority?: NotePriority;
    createdBy: {
        id: string;
        name: string;
        department?: string;
    };
}

export interface SessionContext {
    hotelId: string;
    branchId: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const PRIORITY_LABELS: Record<NotePriority, string> = {
    normal: 'عادي',
    important: 'مهم',
    urgent: 'عاجل'
};

export const PRIORITY_COLORS: Record<NotePriority, { bg: string; text: string; border: string }> = {
    normal: { bg: '#E5E7EB', text: '#374151', border: '#9CA3AF' },
    important: { bg: '#FEF3C7', text: '#92400E', border: '#F59E0B' },
    urgent: { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' }
};

// ============================================================
// CRUD OPERATIONS
// ============================================================

/**
 * Get collection path
 */
const getNotesPath = (session: SessionContext): string => {
    // ✅ SaaS FIX: Use 'tenants' collection
    return `tenants/${session.hotelId}/branches/${session.branchId}/shiftNotes`;
};

/**
 * Create a new shift note
 */
export const createShiftNote = async (
    session: SessionContext,
    data: CreateNoteData
): Promise<string | null> => {
    try {
        const note: Omit<ShiftNote, 'id'> = {
            roomNumber: data.roomNumber,
            content: data.content,
            priority: data.priority || 'normal',
            status: 'active',
            createdBy: data.createdBy,
            createdAt: serverTimestamp(),
            readBy: []
        };

        const docRef = await addDoc(collection(db, getNotesPath(session)), note);
        logger.info('✅ Shift note created:', docRef.id, 'shiftNotesService');
        return docRef.id;
    } catch (error) {
        logger.error('Error creating shift note:', error, 'shiftNotesService');
        return null;
    }
};

/**
 * Get all active notes
 */
export const getActiveNotes = async (session: SessionContext): Promise<ShiftNote[]> => {
    try {
        const notesQuery = query(
            collection(db, getNotesPath(session)),
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(notesQuery);
        const notes: ShiftNote[] = [];

        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() } as ShiftNote);
        });

        // ✅ Client-side Sort
        notes.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });

        return notes;
    } catch (error) {
        logger.error('Error getting active notes:', error, 'shiftNotesService');
        return [];
    }
};

/**
 * Get notes for a specific room
 */
export const getNotesForRoom = async (
    session: SessionContext,
    roomNumber: string
): Promise<ShiftNote[]> => {
    try {
        const notesQuery = query(
            collection(db, getNotesPath(session)),
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active')
        );

        const snapshot = await getDocs(notesQuery);
        const notes: ShiftNote[] = [];

        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() } as ShiftNote);
        });

        // ✅ Client-side Sort
        notes.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });

        return notes;
    } catch (error) {
        logger.error('Error getting room notes:', error, 'shiftNotesService');
        return [];
    }
};

/**
 * Get unread notes count
 */
export const getUnreadNotesCount = async (
    session: SessionContext,
    employeeId: string
): Promise<number> => {
    try {
        const notes = await getActiveNotes(session);
        return notes.filter(note => !note.readBy?.includes(employeeId)).length;
    } catch (error) {
        logger.error('Error getting unread count:', error, 'shiftNotesService');
        return 0;
    }
};

/**
 * Mark note as read
 */
export const markNoteAsRead = async (
    session: SessionContext,
    noteId: string,
    employeeId: string,
    employeeName?: string // Passed for points logging
): Promise<boolean> => {
    try {
        const noteRef = doc(db, getNotesPath(session), noteId);

        // Get current note state (to ensure transactional integrity for points)
        const noteDoc = await getDocs(query(
            collection(db, getNotesPath(session)),
            where('__name__', '==', noteId)
        ));

        if (!noteDoc.empty) {
            const currentReadBy = noteDoc.docs[0].data().readBy || []; // Assuming array of IDs

            // Check if already read to prevent double points
            // Note: readBy stores IDs
            if (!currentReadBy.includes(employeeId)) {

                // 1. Update Note as Read
                await updateDoc(noteRef, {
                    readBy: [...currentReadBy, employeeId]
                });

                // 2. Award Points (Gamification - Shift Handover)
                // Need to import awardPoints dynamically or implementation locally?
                // Better to import the service helper if possible, or use raw firestore.
                // We'll dynamic import to avoid potential circular deps if pointsService imports this.
                try {
                    const { awardPoints, getPointsConfig } = await import('./pointsService');
                    // Fetch config specific to this branch
                    const config = await getPointsConfig(session.hotelId, session.branchId);

                    const points = config.shiftHandover?.acknowledgeNote ?? 2; // Default 2

                    if (points > 0) {
                        await awardPoints(
                            session.branchId,
                            employeeId,
                            points,
                            'تأكيد استلام ملاحظة وردية'
                        );
                        logger.info(`✨ Awarded ${points} points to ${employeeId} for note acknowledgment`, undefined, 'shiftNotesService');
                    }
                } catch (pointsError) {
                    logger.error('Error awarding points for note read:', pointsError, 'shiftNotesService');
                    // Don't fail the read operation just because points failed
                }
            }
        }

        return true;
    } catch (error) {
        logger.error('Error marking note as read:', error, 'shiftNotesService');
        return false;
    }
};

/**
 * Archive note (called on checkout)
 */
export const archiveNote = async (
    session: SessionContext,
    noteId: string,
    archivedBy: { id: string; name: string },
    checkoutId?: string
): Promise<boolean> => {
    try {
        await updateDoc(doc(db, getNotesPath(session), noteId), {
            status: 'archived',
            archivedAt: serverTimestamp(),
            archivedBy,
            checkoutId: checkoutId || null
        });

        logger.info('✅ Note archived:', noteId, 'shiftNotesService');
        return true;
    } catch (error) {
        logger.error('Error archiving note:', error, 'shiftNotesService');
        return false;
    }
};

/**
 * Archive all notes for a room (called on checkout)
 */
export const archiveRoomNotes = async (
    session: SessionContext,
    roomNumber: string,
    archivedBy: { id: string; name: string },
    checkoutId?: string
): Promise<number> => {
    try {
        const notes = await getNotesForRoom(session, roomNumber);
        const batch = writeBatch(db);

        notes.forEach(note => {
            const noteRef = doc(db, getNotesPath(session), note.id);
            batch.update(noteRef, {
                status: 'archived',
                archivedAt: serverTimestamp(),
                archivedBy,
                checkoutId: checkoutId || null
            });
        });

        await batch.commit();
        logger.info(`✅ Archived ${notes.length} notes for room ${roomNumber}`, undefined, 'shiftNotesService');
        return notes.length;
    } catch (error) {
        logger.error('Error archiving room notes:', error, 'shiftNotesService');
        return 0;
    }
};

/**
 * Get archived notes
 */
export const getArchivedNotes = async (
    session: SessionContext,
    limitCount: number = 50
): Promise<ShiftNote[]> => {
    try {
        const notesQuery = query(
            collection(db, getNotesPath(session)),
            where('status', '==', 'archived')
        );

        const snapshot = await getDocs(notesQuery);
        const notes: ShiftNote[] = [];

        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() } as ShiftNote);
        });

        // ✅ Client-side Sort
        notes.sort((a, b) => {
            const tA = a.archivedAt?.toMillis?.() || 0;
            const tB = b.archivedAt?.toMillis?.() || 0;
            return tB - tA;
        });

        return notes.slice(0, limitCount);
    } catch (error) {
        logger.error('Error getting archived notes:', error, 'shiftNotesService');
        return [];
    }
};

/**
 * Delete note (only for creators or managers)
 */
export const deleteNote = async (
    session: SessionContext,
    noteId: string
): Promise<boolean> => {
    try {
        await deleteDoc(doc(db, getNotesPath(session), noteId));
        logger.info('✅ Note deleted:', noteId, 'shiftNotesService');
        return true;
    } catch (error) {
        logger.error('Error deleting note:', error, 'shiftNotesService');
        return false;
    }
};

// ============================================================
// REAL-TIME SUBSCRIPTION
// ============================================================

/**
 * Subscribe to active notes
 */
export const subscribeToActiveNotes = (
    session: SessionContext,
    callback: (notes: ShiftNote[]) => void
): (() => void) => {
    const notesQuery = query(
        collection(db, getNotesPath(session)),
        where('status', '==', 'active')
    );

    return onSnapshot(notesQuery, (snapshot) => {
        const notes: ShiftNote[] = [];
        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() } as ShiftNote);
        });
        // ✅ Client-side Sort
        notes.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(notes);
    });
};

/**
 * Subscribe to notes for a room
 */
export const subscribeToRoomNotes = (
    session: SessionContext,
    roomNumber: string,
    callback: (notes: ShiftNote[]) => void
): (() => void) => {
    const notesQuery = query(
        collection(db, getNotesPath(session)),
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active')
    );

    return onSnapshot(notesQuery, (snapshot) => {
        const notes: ShiftNote[] = [];
        snapshot.forEach(doc => {
            notes.push({ id: doc.id, ...doc.data() } as ShiftNote);
        });
        // ✅ Client-side Sort
        notes.sort((a, b) => {
            const tA = a.createdAt?.toMillis?.() || 0;
            const tB = b.createdAt?.toMillis?.() || 0;
            return tB - tA;
        });
        callback(notes);
    });
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Format note timestamp
 */
export const formatNoteTime = (timestamp: any): string => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
};

/**
 * Check if note is unread by employee
 */
export const isNoteUnread = (note: ShiftNote, employeeId: string): boolean => {
    return !note.readBy?.includes(employeeId);
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseShiftNotesReturn {
    notes: ShiftNote[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    createNote: (data: CreateNoteData) => Promise<boolean>;
    markAsRead: (noteId: string) => Promise<boolean>;
    archiveByRoom: (roomNumber: string) => Promise<number>;
    refresh: () => Promise<void>;
}

export const useShiftNotes = (
    session: SessionContext | null,
    employeeId: string | null
): UseShiftNotesReturn => {
    const [notes, setNotes] = useState<ShiftNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Subscribe to real-time updates
    useEffect(() => {
        if (!session?.hotelId || !session?.branchId) return;

        setLoading(true);
        const unsubscribe = subscribeToActiveNotes(session, (activeNotes) => {
            setNotes(activeNotes);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [session]);

    const unreadCount = employeeId
        ? notes.filter(n => isNoteUnread(n, employeeId)).length
        : 0;

    const createNote = useCallback(async (data: CreateNoteData): Promise<boolean> => {
        if (!session) return false;
        const id = await createShiftNote(session, data);
        return id !== null;
    }, [session]);

    const markAsRead = useCallback(async (noteId: string): Promise<boolean> => {
        if (!session || !employeeId) return false;
        return await markNoteAsRead(session, noteId, employeeId);
    }, [session, employeeId]);

    const archiveByRoom = useCallback(async (roomNumber: string): Promise<number> => {
        if (!session || !employeeId) return 0;
        return await archiveRoomNotes(session, roomNumber, { id: employeeId, name: 'System' });
    }, [session, employeeId]);

    const refresh = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const activeNotes = await getActiveNotes(session);
            setNotes(activeNotes);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل الملاحظات');
        } finally {
            setLoading(false);
        }
    }, [session]);

    return {
        notes,
        unreadCount,
        loading,
        error,
        createNote,
        markAsRead,
        archiveByRoom,
        refresh
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Constants
    PRIORITY_LABELS,
    PRIORITY_COLORS,

    // CRUD
    createShiftNote,
    getActiveNotes,
    getNotesForRoom,
    getUnreadNotesCount,
    markNoteAsRead,
    archiveNote,
    archiveRoomNotes,
    getArchivedNotes,
    deleteNote,

    // Subscriptions
    subscribeToActiveNotes,
    subscribeToRoomNotes,

    // Helpers
    formatNoteTime,
    isNoteUnread,

    // Hook
    useShiftNotes
};
