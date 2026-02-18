/**
 * Dynamic Rating System Service
 * Allows managers to customize rating forms and trigger rating invitations
 * Adora Hotel Management System V2
 *
 * SaaS/tenant: Uses root collections rating_templates, rating_invitations, rating_responses.
 * For multi-tenant isolation, consider tenant-scoped paths and passing tenantId.
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface RatingQuestion {
    id: string;
    type: 'star' | 'emoji' | 'text' | 'number' | 'yes_no' | 'multiple_choice';
    question: string;
    questionAr: string;
    required: boolean;
    options?: Array<{ value: string; label: string; labelAr: string }>; // For multiple choice
    min?: number;
    max?: number;
    placeholder?: string;
}

export interface RatingTemplate {
    id: string;
    name: string;
    nameAr: string;
    description?: string;
    
    // Design
    primaryColor?: string;
    backgroundColor?: string;
    headerImage?: string;
    icon?: string;
    
    // Content
    title: string;
    titleAr: string;
    subtitle?: string;
    subtitleAr?: string;
    
    // Questions
    questions: RatingQuestion[];
    
    // Settings
    triggerEvent: 'checkout' | 'request_completed' | 'manual';
    autoShow: boolean; // Show automatically or require user action
    delaySeconds?: number; // Delay before showing (for checkout)
    requireAllQuestions: boolean;
    
    // Metadata
    branchId: string;
    tenantId: string;
    isActive: boolean;
    order: number;
    createdAt: any;
    updatedAt: any;
    createdBy?: { id: string; name: string };
}

export interface RatingInvitation {
    id: string;
    roomNumber: string;
    guestName?: string;
    templateId: string;
    template?: RatingTemplate; // Populated on read
    status: 'pending' | 'shown' | 'completed' | 'dismissed';
    triggerEvent: string;
    triggerData?: any; // e.g., checkout info, request info
    createdAt: any;
    shownAt?: any;
    completedAt?: any;
    branchId: string;
    tenantId: string;
}

export interface RatingResponse {
    id: string;
    invitationId: string;
    templateId: string;
    roomNumber: string;
    guestName?: string;
    responses: Record<string, any>; // questionId -> answer
    overallRating?: number; // If first question is star rating
    feedback?: string;
    submittedAt: any;
    branchId: string;
    tenantId: string;
}

// ============================================================
// TEMPLATE MANAGEMENT
// ============================================================

/**
 * Get all rating templates for a branch
 */
export const getRatingTemplates = async (branchId: string, tenantId: string): Promise<RatingTemplate[]> => {
    try {
        const q = query(
            collection(db, 'rating_templates'),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId),
            where('isActive', '==', true)
        );

        const snapshot = await getDocs(q);
        const templates: RatingTemplate[] = [];

        snapshot.forEach(doc => {
            templates.push({
                id: doc.id,
                ...doc.data()
            } as RatingTemplate);
        });

        return templates.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (error) {
        logger.error('Error getting rating templates:', error, 'ratingService');
        return [];
    }
};

/**
 * Subscribe to rating templates with real-time updates
 */
export const subscribeToRatingTemplates = (
    branchId: string,
    tenantId: string,
    callback: (templates: RatingTemplate[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'rating_templates'),
        where('branchId', '==', branchId),
        where('tenantId', '==', tenantId),
        where('isActive', '==', true)
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const templates: RatingTemplate[] = [];
            snapshot.forEach(doc => {
                templates.push({
                    id: doc.id,
                    ...doc.data()
                } as RatingTemplate);
            });
            callback(templates.sort((a, b) => (a.order || 0) - (b.order || 0)));
        },
        (error) => {
            logger.error('Error subscribing to rating templates:', error, 'ratingService');
            callback([]);
        }
    );
};

/**
 * Create rating template
 */
export const createRatingTemplate = async (
    template: Omit<RatingTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string,
    userName: string
): Promise<string> => {
    try {
        const templateData: Omit<RatingTemplate, 'id'> = {
            ...template,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: { id: userId, name: userName }
        };

        const docRef = doc(collection(db, 'rating_templates'));
        await setDoc(docRef, templateData);

        return docRef.id;
    } catch (error) {
        logger.error('Error creating rating template:', error, 'ratingService');
        throw error;
    }
};

/**
 * Update rating template
 */
export const updateRatingTemplate = async (
    templateId: string,
    updates: Partial<RatingTemplate>,
    userId: string,
    userName: string
): Promise<void> => {
    try {
        const templateRef = doc(db, 'rating_templates', templateId);
        await updateDoc(templateRef, {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: userId, name: userName }
        });
    } catch (error) {
        logger.error('Error updating rating template:', error, 'ratingService');
        throw error;
    }
};

/**
 * Delete rating template
 */
export const deleteRatingTemplate = async (templateId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'rating_templates', templateId));
    } catch (error) {
        logger.error('Error deleting rating template:', error, 'ratingService');
        throw error;
    }
};

// ============================================================
// RATING INVITATIONS
// ============================================================

/**
 * Create rating invitation (triggered by checkout or other events)
 */
export const createRatingInvitation = async (
    roomNumber: string,
    branchId: string,
    tenantId: string,
    triggerEvent: string,
    triggerData?: any,
    guestName?: string,
    templateId?: string
): Promise<string | null> => {
    try {
        // If templateId not provided, find active template for this event
        let activeTemplateId = templateId;
        if (!activeTemplateId) {
            const templates = await getRatingTemplates(branchId, tenantId);
            const matchingTemplate = templates.find(t => 
                t.triggerEvent === triggerEvent && t.isActive
            );
            if (!matchingTemplate) {
                logger.info('No active rating template found for event:', triggerEvent, 'ratingService');
                return null; // No template configured
            }
            activeTemplateId = matchingTemplate.id;
        }

        // Check if invitation already exists for this room
        const existingQuery = query(
            collection(db, 'rating_invitations'),
            where('roomNumber', '==', roomNumber),
            where('branchId', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', 'in', ['pending', 'shown'])
        );
        const existingSnapshot = await getDocs(existingQuery);
        if (!existingSnapshot.empty) {
            logger.info('Rating invitation already exists for room:', roomNumber, 'ratingService');
            return existingSnapshot.docs[0].id;
        }

        const invitation: Omit<RatingInvitation, 'id'> = {
            roomNumber,
            guestName,
            templateId: activeTemplateId,
            status: 'pending',
            triggerEvent,
            triggerData,
            createdAt: Timestamp.now(),
            branchId,
            tenantId
        };

        const docRef = doc(collection(db, 'rating_invitations'));
        await setDoc(docRef, invitation);

        return docRef.id;
    } catch (error) {
        logger.error('Error creating rating invitation:', error, 'ratingService');
        return null;
    }
};

/**
 * Subscribe to rating invitations for a room
 */
export const subscribeToRatingInvitations = (
    roomNumber: string,
    branchId: string,
    tenantId: string,
    callback: (invitations: RatingInvitation[]) => void
): (() => void) => {
    const q = query(
        collection(db, 'rating_invitations'),
        where('roomNumber', '==', roomNumber),
        where('branchId', '==', branchId),
        where('tenantId', '==', tenantId),
        where('status', 'in', ['pending', 'shown'])
    );

    return onSnapshot(
        q,
        async (snapshot) => {
            const invitations: RatingInvitation[] = [];
            for (const docSnap of snapshot.docs) {
                const data = docSnap.data() as RatingInvitation;
                // Load template if not included
                if (data.templateId && !data.template) {
                    try {
                        const templateDoc = await getDoc(doc(db, 'rating_templates', data.templateId));
                        if (templateDoc.exists()) {
                            data.template = { id: templateDoc.id, ...templateDoc.data() } as RatingTemplate;
                        }
                    } catch (error) {
                        logger.error('Error loading template:', error, 'ratingService');
                    }
                }
                invitations.push({
                    id: docSnap.id,
                    ...data
                });
            }
            callback(invitations);
        },
        (error) => {
            logger.error('Error subscribing to rating invitations:', error, 'ratingService');
            callback([]);
        }
    );
};

/**
 * Mark invitation as shown
 */
export const markInvitationAsShown = async (invitationId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'rating_invitations', invitationId), {
            status: 'shown',
            shownAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error marking invitation as shown:', error, 'ratingService');
    }
};

/**
 * Submit rating response
 */
export const submitRatingResponse = async (
    invitationId: string,
    responses: Record<string, any>,
    overallRating?: number,
    feedback?: string
): Promise<string> => {
    try {
        const invitationDoc = await getDoc(doc(db, 'rating_invitations', invitationId));
        if (!invitationDoc.exists()) {
            throw new Error('Invitation not found');
        }

        const invitation = invitationDoc.data() as RatingInvitation;

        // Create rating response
        const response: Omit<RatingResponse, 'id'> = {
            invitationId,
            templateId: invitation.templateId,
            roomNumber: invitation.roomNumber,
            guestName: invitation.guestName,
            responses,
            overallRating,
            feedback,
            submittedAt: Timestamp.now(),
            branchId: invitation.branchId,
            tenantId: invitation.tenantId
        };

        const responseRef = doc(collection(db, 'rating_responses'));
        await setDoc(responseRef, response);

        // Update invitation status
        await updateDoc(doc(db, 'rating_invitations', invitationId), {
            status: 'completed',
            completedAt: Timestamp.now()
        });

        return responseRef.id;
    } catch (error) {
        logger.error('Error submitting rating response:', error, 'ratingService');
        throw error;
    }
};

/**
 * Dismiss rating invitation
 */
export const dismissRatingInvitation = async (invitationId: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'rating_invitations', invitationId), {
            status: 'dismissed'
        });
    } catch (error) {
        logger.error('Error dismissing invitation:', error, 'ratingService');
    }
};

// ============================================================
// DEFAULT TEMPLATES
// ============================================================

export const getDefaultRatingTemplate = (): Omit<RatingTemplate, 'id' | 'createdAt' | 'updatedAt' | 'branchId' | 'tenantId' | 'createdBy'> => ({
    name: 'Checkout Rating',
    nameAr: 'تقييم الخدمة بعد الخروج',
    description: 'Default template for checkout ratings',
    primaryColor: '#10b981',
    backgroundColor: '#0f172a',
    icon: '⭐',
    title: 'كيف كانت إقامتك؟',
    titleAr: 'كيف كانت إقامتك؟',
    subtitle: 'نقدر رأيك ونسعى لتحسين خدماتنا',
    subtitleAr: 'نقدر رأيك ونسعى لتحسين خدماتنا',
    questions: [
        {
            id: 'overall',
            type: 'star',
            question: 'Overall Rating',
            questionAr: 'تقييمك العام للإقامة',
            required: true
        },
        {
            id: 'cleanliness',
            type: 'star',
            question: 'Cleanliness',
            questionAr: 'نظافة الغرفة',
            required: false
        },
        {
            id: 'service',
            type: 'star',
            question: 'Service Quality',
            questionAr: 'جودة الخدمة',
            required: false
        },
        {
            id: 'feedback',
            type: 'text',
            question: 'Additional Feedback',
            questionAr: 'ملاحظات إضافية (اختياري)',
            required: false,
            placeholder: 'شاركنا برأيك...'
        }
    ],
    triggerEvent: 'checkout',
    autoShow: true,
    delaySeconds: 5,
    requireAllQuestions: false,
    isActive: true,
    order: 0
});
