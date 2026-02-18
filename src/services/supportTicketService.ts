/**
 * Support Ticket Service
 * Communication system between Owner and Subscribers/Branches
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc, orderBy, increment } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface SupportTicket {
    id: string;
    
    // Ticket Info
    ticketNumber: string; // Auto-generated unique ticket number
    title: string;
    description: string;
    category: 'technical' | 'billing' | 'feature' | 'bug' | 'other';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    
    // Contact Info
    contactPhone: string; // Required
    contactEmail?: string;
    
    // Sender Info
    senderId: string; // User ID
    senderName: string;
    senderCode?: string; // Employee code
    senderRole: string; // User role/department
    senderBranchId: string; // Branch ID
    senderBranchName: string;
    senderBranchCode?: string; // Branch code
    tenantId: string;
    
    // Status & Workflow
    status: 'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';
    acknowledgedBy?: { id: string; name: string };
    acknowledgedAt?: any;
    assignedTo?: { id: string; name: string };
    resolvedBy?: { id: string; name: string };
    resolvedAt?: any;
    resolutionNote?: string; // Reason/notes from owner when closing
    closedBy?: { id: string; name: string };
    closedAt?: any;
    
    // Timestamps
    createdAt: any;
    updatedAt: any;
    
    // Attachments (optional)
    attachments?: string[]; // Array of image URLs
    
    // Owner Response
    ownerResponse?: string;
    ownerResponseAt?: any;
}

export interface SupportTicketStatus {
    tenantId: string;
    unreadCount: number;
    pendingCount: number;
    inProgressCount: number;
    lastUpdated: any;
}

// ============================================================
// COLLECTION HELPERS
// ============================================================

const getTicketsCollectionRef = () => {
    if (!db) throw new Error('Firebase db not initialized');
    return collection(db, 'support_tickets');
};
const getTicketDocRef = (ticketId: string) => {
    if (!db) throw new Error('Firebase db not initialized');
    return doc(db, 'support_tickets', ticketId);
};
const getTicketStatusDocRef = (tenantId: string) => {
    if (!db) throw new Error('Firebase db not initialized');
    return doc(db, 'support_ticket_status', tenantId);
};

// ============================================================
// TICKET MANAGEMENT
// ============================================================

/**
 * Generate unique ticket number
 */
const generateTicketNumber = async (): Promise<string> => {
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TK${year}${timestamp}${random}`;
};

/**
 * Create a new support ticket
 */
export const createSupportTicket = async (
    ticketData: Omit<SupportTicket, 'id' | 'ticketNumber' | 'createdAt' | 'updatedAt' | 'status'>,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        const ticketNumber = await generateTicketNumber();
        
        const ticket: Omit<SupportTicket, 'id'> = {
            ...ticketData,
            ticketNumber,
            status: 'pending',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        
        const docRef = doc(getTicketsCollectionRef());
        await setDoc(docRef, ticket);
        
        // Update status counter
        await updateTicketStatusCounter(ticketData.tenantId, 'increment');
        
        return docRef.id;
    } catch (error) {
        logger.error('Error creating support ticket:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Get ticket by ID
 */
export const getTicket = async (ticketId: string): Promise<SupportTicket | null> => {
    try {
        const docSnap = await getDoc(getTicketDocRef(ticketId));
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as SupportTicket;
        }
        return null;
    } catch (error) {
        logger.error('Error getting ticket:', error, 'supportTicketService');
        return null;
    }
};

/**
 * Subscribe to ALL tickets (Owner view - sees tickets from all managers/employees)
 */
export const subscribeToAllTickets = (
    callback: (tickets: SupportTicket[]) => void
): (() => void) => {
    if (!db) {
        logger.warn('Firebase db not initialized, skipping all tickets subscription', undefined, 'supportTicketService');
        callback([]);
        return () => {};
    }
    
    const q = query(
        getTicketsCollectionRef(),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(
        q,
        (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            callback(tickets);
        },
        (error) => {
            logger.error('Error subscribing to all tickets:', error, 'supportTicketService');
            callback([]);
        }
    );
};

/**
 * Subscribe to tickets for a tenant (Manager view - sees only their tenant's tickets)
 */
export const subscribeToTenantTickets = (
    tenantId: string,
    callback: (tickets: SupportTicket[]) => void
): (() => void) => {
    if (!db) {
        logger.warn('Firebase db not initialized, skipping tenant tickets subscription', undefined, 'supportTicketService');
        callback([]);
        return () => {};
    }
    
    const q = query(
        getTicketsCollectionRef(),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(
        q,
        (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            callback(tickets);
        },
        (error) => {
            logger.error('Error subscribing to tickets:', error, 'supportTicketService');
            callback([]);
        }
    );
};

/**
 * Subscribe to tickets for a user (Sender view)
 */
export const subscribeToUserTickets = (
    userId: string,
    tenantId: string,
    callback: (tickets: SupportTicket[]) => void
): (() => void) => {
    const q = query(
        getTicketsCollectionRef(),
        where('senderId', '==', userId),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(
        q,
        (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            callback(tickets);
        },
        (error) => {
            logger.error('Error subscribing to user tickets:', error, 'supportTicketService');
            callback([]);
        }
    );
};

/**
 * Subscribe to branch tickets (Branch manager view)
 */
export const subscribeToBranchTickets = (
    branchId: string,
    tenantId: string,
    callback: (tickets: SupportTicket[]) => void
): (() => void) => {
    const q = query(
        getTicketsCollectionRef(),
        where('senderBranchId', '==', branchId),
        where('tenantId', '==', tenantId),
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(
        q,
        (snapshot) => {
            const tickets = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupportTicket));
            callback(tickets);
        },
        (error) => {
            logger.error('Error subscribing to branch tickets:', error, 'supportTicketService');
            callback([]);
        }
    );
};

/**
 * Acknowledge ticket (Owner clicks "تم العلم")
 * ✅ Sends notification to ticket sender
 */
export const acknowledgeTicket = async (
    ticketId: string,
    ownerId: string,
    ownerName: string
): Promise<void> => {
    try {
        // Get ticket to find sender info
        const ticket = await getTicket(ticketId);
        if (!ticket) {
            throw new Error('التذكرة غير موجودة');
        }

        // Update ticket status
        await updateDoc(getTicketDocRef(ticketId), {
            status: 'acknowledged',
            acknowledgedBy: { id: ownerId, name: ownerName },
            acknowledgedAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        // ✅ Send push notification to ticket sender
        try {
            const { sendPushNotification } = await import('./pushNotificationService');
            if (ticket.senderId && db) {
                const senderRef = doc(db, 'users', ticket.senderId);
                const senderDoc = await getDoc(senderRef);
                if (senderDoc.exists()) {
                    const senderData = senderDoc.data();
                    const fcmToken = senderData.fcmToken;
                    if (fcmToken) {
                        await sendPushNotification(fcmToken, {
                            title: 'تم العلم بتذكرتك',
                            body: `تم العلم بتذكرة الدعم الفني #${ticket.ticketNumber} من قبل المالك`,
                            data: {
                                type: 'support_ticket_acknowledged',
                                ticketId: ticketId,
                                ticketNumber: ticket.ticketNumber
                            }
                        });
                    }
                }
            }
        } catch (notifError) {
            logger.warn('Failed to send notification (non-critical):', notifError, 'supportTicketService');
        }
    } catch (error) {
        logger.error('Error acknowledging ticket:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Mark ticket as in progress
 */
export const markTicketInProgress = async (
    ticketId: string,
    ownerId: string,
    ownerName: string
): Promise<void> => {
    try {
        await updateDoc(getTicketDocRef(ticketId), {
            status: 'in_progress',
            assignedTo: { id: ownerId, name: ownerName },
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error marking ticket in progress:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Resolve ticket (Owner clicks "تم الإصلاح/الانتهاء")
 * ✅ Sends notification to ticket sender
 */
export const resolveTicket = async (
    ticketId: string,
    ownerId: string,
    ownerName: string,
    resolutionNote: string
): Promise<void> => {
    try {
        // Get ticket to find sender info
        const ticket = await getTicket(ticketId);
        if (!ticket) {
            throw new Error('التذكرة غير موجودة');
        }

        // Update ticket status
        await updateDoc(getTicketDocRef(ticketId), {
            status: 'resolved',
            resolvedBy: { id: ownerId, name: ownerName },
            resolvedAt: Timestamp.now(),
            resolutionNote,
            updatedAt: Timestamp.now()
        });

        // ✅ Send push notification to ticket sender
        try {
            const { sendPushNotification } = await import('./pushNotificationService');
            if (ticket.senderId && db) {
                const senderRef = doc(db, 'users', ticket.senderId);
                const senderDoc = await getDoc(senderRef);
                if (senderDoc.exists()) {
                    const senderData = senderDoc.data();
                    const fcmToken = senderData.fcmToken;
                    if (fcmToken) {
                        await sendPushNotification(fcmToken, {
                            title: 'تم حل تذكرتك',
                            body: `تم حل تذكرة الدعم الفني #${ticket.ticketNumber}. ${resolutionNote.substring(0, 80)}${resolutionNote.length > 80 ? '...' : ''}`,
                            data: {
                                type: 'support_ticket_resolved',
                                ticketId: ticketId,
                                ticketNumber: ticket.ticketNumber
                            }
                        });
                    }
                }
            }
        } catch (notifError) {
            logger.warn('Failed to send notification (non-critical):', notifError, 'supportTicketService');
        }
    } catch (error) {
        logger.error('Error resolving ticket:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Close ticket
 * ✅ Sends notification to ticket sender
 */
export const closeTicket = async (
    ticketId: string,
    ownerId: string,
    ownerName: string,
    resolutionNote?: string
): Promise<void> => {
    try {
        // Get ticket to find sender info
        const ticket = await getTicket(ticketId);
        if (!ticket) {
            throw new Error('التذكرة غير موجودة');
        }

        const note = resolutionNote || 'تم الإغلاق';

        // Update ticket status
        await updateDoc(getTicketDocRef(ticketId), {
            status: 'closed',
            closedBy: { id: ownerId, name: ownerName },
            closedAt: Timestamp.now(),
            resolutionNote: note,
            updatedAt: Timestamp.now()
        });

        // ✅ Send push notification to ticket sender
        try {
            const { sendPushNotification } = await import('./pushNotificationService');
            if (ticket.senderId && db) {
                const senderRef = doc(db, 'users', ticket.senderId);
                const senderDoc = await getDoc(senderRef);
                if (senderDoc.exists()) {
                    const senderData = senderDoc.data();
                    const fcmToken = senderData.fcmToken;
                    if (fcmToken) {
                        await sendPushNotification(fcmToken, {
                            title: 'تم إغلاق تذكرتك',
                            body: `تم إغلاق تذكرة الدعم الفني #${ticket.ticketNumber}. ${note.substring(0, 80)}${note.length > 80 ? '...' : ''}`,
                            data: {
                                type: 'support_ticket_closed',
                                ticketId: ticketId,
                                ticketNumber: ticket.ticketNumber
                            }
                        });
                    }
                }
            }
        } catch (notifError) {
            logger.warn('Failed to send notification (non-critical):', notifError, 'supportTicketService');
        }
    } catch (error) {
        logger.error('Error closing ticket:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Add owner response to ticket
 * ✅ Sends notification to ticket sender when owner responds
 */
export const addOwnerResponse = async (
    ticketId: string,
    response: string,
    ownerId: string,
    ownerName: string
): Promise<void> => {
    try {
        // Get ticket to find sender info
        const ticket = await getTicket(ticketId);
        if (!ticket) {
            throw new Error('التذكرة غير موجودة');
        }

        // Update ticket with owner response
        await updateDoc(getTicketDocRef(ticketId), {
            ownerResponse: response,
            ownerResponseAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            status: ticket.status === 'pending' ? 'acknowledged' : ticket.status // Auto-acknowledge if pending
        });

        // ✅ Send push notification to ticket sender
        try {
            const { sendPushNotification } = await import('./pushNotificationService');
            // Get sender's FCM token from users collection
            if (ticket.senderId && db) {
                const senderRef = doc(db, 'users', ticket.senderId);
                const senderDoc = await getDoc(senderRef);
                if (senderDoc.exists()) {
                    const senderData = senderDoc.data();
                    const fcmToken = senderData.fcmToken;
                    if (fcmToken) {
                        await sendPushNotification(fcmToken, {
                            title: 'رد على تذكرة الدعم الفني',
                            body: `رد المالك على تذكرتك #${ticket.ticketNumber}: ${response.substring(0, 100)}${response.length > 100 ? '...' : ''}`,
                            data: {
                                type: 'support_ticket_response',
                                ticketId: ticketId,
                                ticketNumber: ticket.ticketNumber
                            }
                        });
                    }
                }
            }
        } catch (notifError) {
            logger.warn('Failed to send notification (non-critical):', notifError, 'supportTicketService');
            // Don't throw - notification failure shouldn't block response
        }
    } catch (error) {
        logger.error('Error adding owner response:', error, 'supportTicketService');
        throw error;
    }
};

/**
 * Update ticket status counter
 */
const updateTicketStatusCounter = async (
    tenantId: string,
    action: 'increment' | 'decrement'
): Promise<void> => {
    try {
        const statusRef = getTicketStatusDocRef(tenantId);
        const statusSnap = await getDoc(statusRef);
        
        if (statusSnap.exists()) {
            await updateDoc(statusRef, {
                unreadCount: action === 'increment' ? increment(1) : increment(-1),
                pendingCount: action === 'increment' ? increment(1) : increment(-1),
                lastUpdated: Timestamp.now()
            });
        } else {
            await setDoc(statusRef, {
                tenantId,
                unreadCount: action === 'increment' ? 1 : 0,
                pendingCount: action === 'increment' ? 1 : 0,
                inProgressCount: 0,
                lastUpdated: Timestamp.now()
            });
        }
    } catch (error) {
        logger.error('Error updating ticket status counter:', error, 'supportTicketService');
    }
};

/**
 * Get ticket status for tenant (Owner view)
 */
export const getTicketStatus = async (tenantId: string): Promise<SupportTicketStatus | null> => {
    try {
        const statusSnap = await getDoc(getTicketStatusDocRef(tenantId));
        if (statusSnap.exists()) {
            return statusSnap.data() as SupportTicketStatus;
        }
        return {
            tenantId,
            unreadCount: 0,
            pendingCount: 0,
            inProgressCount: 0,
            lastUpdated: Timestamp.now()
        };
    } catch (error) {
        logger.error('Error getting ticket status:', error, 'supportTicketService');
        return null;
    }
};

/**
 * Subscribe to ticket status (Owner view)
 */
export const subscribeToTicketStatus = (
    tenantId: string,
    callback: (status: SupportTicketStatus) => void
): (() => void) => {
    // ✅ Guard against null db
    if (!db) {
        logger.warn('Firebase db not initialized, skipping ticket status subscription', undefined, 'supportTicketService');
        callback({
            tenantId,
            unreadCount: 0,
            pendingCount: 0,
            inProgressCount: 0,
            lastUpdated: Timestamp.now()
        });
        return () => {}; // Return empty unsubscribe
    }
    
    try {
        return onSnapshot(
            getTicketStatusDocRef(tenantId),
            (doc) => {
                if (doc.exists()) {
                    callback(doc.data() as SupportTicketStatus);
                } else {
                    callback({
                        tenantId,
                        unreadCount: 0,
                        pendingCount: 0,
                        inProgressCount: 0,
                        lastUpdated: Timestamp.now()
                    });
                }
            },
            (error: any) => {
                // ✅ Handle Firestore internal errors gracefully
                if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
                    logger.warn('Firestore internal error in subscribeToTicketStatus (likely cache issue)', error, 'supportTicketService');
                } else {
                    // ✅ Handle permission errors gracefully (expected for non-owners)
                    const isPermissionError = error?.code === 'permission-denied' || 
                                              error?.message?.includes('permission') ||
                                              error?.message?.includes('Missing or insufficient');
                    
                    if (isPermissionError) {
                        logger.debug('Permission denied for ticket status subscription (expected for non-owners)', error, 'supportTicketService');
                    } else {
                        logger.error('Error subscribing to ticket status:', error, 'supportTicketService');
                    }
                }
                callback({
                    tenantId,
                    unreadCount: 0,
                    pendingCount: 0,
                    inProgressCount: 0,
                    lastUpdated: Timestamp.now()
                });
            }
        );
    } catch (error: any) {
        // ✅ Handle Firestore internal errors gracefully
        if (error?.message?.includes('INTERNAL ASSERTION FAILED') || error?.message?.includes('Unexpected state')) {
            logger.warn('Firestore internal error setting up ticket status subscription (likely cache issue)', error, 'supportTicketService');
        } else {
            // ✅ Handle permission errors gracefully (expected for non-owners)
            const isPermissionError = error?.code === 'permission-denied' || 
                                      error?.message?.includes('permission') ||
                                      error?.message?.includes('Missing or insufficient');
            
            if (isPermissionError) {
                logger.debug('Permission denied for ticket status subscription (expected for non-owners)', error, 'supportTicketService');
            } else {
                logger.error('Error setting up ticket status subscription:', error, 'supportTicketService');
            }
        }
        callback({
            tenantId,
            unreadCount: 0,
            pendingCount: 0,
            inProgressCount: 0,
            lastUpdated: Timestamp.now()
        });
        return () => {}; // Return empty unsubscribe
    }
};

/**
 * Mark ticket as read (Update status counter when owner views)
 */
export const markTicketAsRead = async (ticketId: string, tenantId: string): Promise<void> => {
    try {
        const statusRef = getTicketStatusDocRef(tenantId);
        const statusSnap = await getDoc(statusRef);
        
        if (statusSnap.exists()) {
            const currentUnread = statusSnap.data()?.unreadCount || 0;
            if (currentUnread > 0) {
                await updateDoc(statusRef, {
                    unreadCount: Math.max(0, currentUnread - 1),
                    lastUpdated: Timestamp.now()
                });
            }
        }
    } catch (error) {
        logger.error('Error marking ticket as read:', error, 'supportTicketService');
    }
};

/**
 * Get tickets statistics for tenant
 */
export const getTicketStatistics = async (tenantId: string): Promise<{
    total: number;
    pending: number;
    acknowledged: number;
    inProgress: number;
    resolved: number;
    closed: number;
}> => {
    try {
        const q = query(
            getTicketsCollectionRef(),
            where('tenantId', '==', tenantId)
        );
        
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => doc.data() as SupportTicket);
        
        return {
            total: tickets.length,
            pending: tickets.filter(t => t.status === 'pending').length,
            acknowledged: tickets.filter(t => t.status === 'acknowledged').length,
            inProgress: tickets.filter(t => t.status === 'in_progress').length,
            resolved: tickets.filter(t => t.status === 'resolved').length,
            closed: tickets.filter(t => t.status === 'closed').length
        };
    } catch (error) {
        logger.error('Error getting ticket statistics:', error, 'supportTicketService');
        return {
            total: 0,
            pending: 0,
            acknowledged: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0
        };
    }
};

/**
 * Get count of unresponded support tickets for Owner (SaaS - from all tenants)
 * ✅ Returns count of tickets with status 'pending' or 'acknowledged' from ALL tenants
 */
export const getUnrespondedTicketsCount = async (): Promise<number> => {
    try {
        if (!db) {
            logger.warn('Firebase db not initialized, returning 0 for unresponded tickets count', undefined, 'supportTicketService');
            return 0;
        }

        // Get all tickets with status 'pending' or 'acknowledged' (not resolved or closed)
        const q = query(
            getTicketsCollectionRef(),
            orderBy('createdAt', 'desc')
        );
        
        const snapshot = await getDocs(q);
        const tickets = snapshot.docs.map(doc => doc.data() as SupportTicket);
        
        // Count tickets that haven't been responded to (pending or acknowledged but not resolved/closed)
        const unrespondedCount = tickets.filter(t => 
            t.status === 'pending' || t.status === 'acknowledged' || t.status === 'in_progress'
        ).length;
        
        return unrespondedCount;
    } catch (error: any) {
        const isPermissionError = error?.code === 'permission-denied' ||
            error?.message?.includes('permission') ||
            error?.message?.includes('Missing or insufficient');
        const isChannelError = error?.code === 400 || error?.code === 404 ||
            error?.message?.includes('400') || error?.message?.includes('Listen/channel');
        if (isPermissionError || isChannelError) {
            if (isChannelError) {
                logger.debug('Unresponded tickets count: channel error, returning 0', undefined, 'supportTicketService');
            }
            return 0;
        }
        logger.error('Error getting unresponded tickets count:', error, 'supportTicketService');
        return 0;
    }
};