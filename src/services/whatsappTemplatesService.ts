/**
 * WhatsApp Templates Service
 * Allows manager to create and manage WhatsApp message templates
 * Reception staff can use these templates to send messages to guests
 * Adora Hotel Management System V2
 */

import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, Timestamp, addDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface WhatsAppTemplate {
    id: string;
    
    // Template Info
    name: string; // Short name for dropdown (e.g., "تسجيل خروج")
    nameAr: string;
    description?: string; // Optional description
    
    // Message Content
    messageFormat: string; // Full message format with placeholders
    messageFormatAr: string; // Arabic message format
    
    // Placeholders: {guestName}, {roomNumber}, {branchName}, {branchNumber}, {checkoutTime}, {extensionDate}, {customField1}, etc.
    
    // Template Variables
    variables?: TemplateVariable[]; // Dynamic variables that can be filled by reception (e.g., checkout time)
    
    // Settings
    category?: string; // e.g., 'checkout', 'extension', 'smoking', 'contract'
    priority?: 'low' | 'medium' | 'high';
    isActive: boolean;
    
    // Metadata
    createdAt: any;
    createdBy: { id: string; name: string };
    updatedAt?: any;
    updatedBy?: { id: string; name: string };
    
    // Tenant/Branch
    tenantId: string;
    branchId?: string; // If empty, applies to all branches
}

export interface TemplateVariable {
    key: string; // e.g., 'checkoutTime', 'extensionDate'
    label: string; // e.g., 'وقت تسجيل الخروج'
    labelAr: string;
    type: 'text' | 'time' | 'date' | 'datetime' | 'number';
    required: boolean;
    defaultValue?: string;
    placeholder?: string;
}

export interface WhatsAppMessage {
    id: string;
    templateId: string;
    templateName: string;
    roomNumber: string;
    guestFirstName: string;
    guestPhoneNumber: string;
    branchId: string;
    branchName?: string;
    message: string; // Final message with all placeholders filled
    sentAt: any;
    sentBy: { id: string; name: string };
    status: 'sent' | 'failed' | 'pending';
    variables?: Record<string, any>; // Variables used to fill the template
}

// ============================================================
// COLLECTION HELPERS
// ============================================================

const getTemplatesCollectionRef = (tenantId: string) => 
    collection(db, 'tenants', tenantId, 'whatsapp_templates');
const getTemplateDocRef = (tenantId: string, templateId: string) => 
    doc(db, 'tenants', tenantId, 'whatsapp_templates', templateId);
const getMessagesCollectionRef = (tenantId: string) => 
    collection(db, 'tenants', tenantId, 'whatsapp_messages');

// ============================================================
// TEMPLATE MANAGEMENT
// ============================================================

/**
 * Create WhatsApp template
 */
export const createWhatsAppTemplate = async (
    tenantId: string,
    template: Omit<WhatsAppTemplate, 'id' | 'createdAt' | 'tenantId' | 'createdBy'>,
    managerId: string,
    managerName: string
): Promise<string> => {
    try {
        const templateData: Omit<WhatsAppTemplate, 'id'> = {
            ...template,
            tenantId,
            createdAt: Timestamp.now(),
            createdBy: { id: managerId, name: managerName }
        };

        const docRef = doc(getTemplatesCollectionRef(tenantId));
        await setDoc(docRef, templateData);

        return docRef.id;
    } catch (error) {
        logger.error('Error creating WhatsApp template:', error, 'whatsappTemplatesService');
        throw error;
    }
};

/**
 * Update WhatsApp template
 */
export const updateWhatsAppTemplate = async (
    tenantId: string,
    templateId: string,
    updates: Partial<WhatsAppTemplate>,
    managerId: string,
    managerName: string
): Promise<void> => {
    try {
        await updateDoc(getTemplateDocRef(tenantId, templateId), {
            ...updates,
            updatedAt: Timestamp.now(),
            updatedBy: { id: managerId, name: managerName }
        });
    } catch (error) {
        logger.error('Error updating WhatsApp template:', error, 'whatsappTemplatesService');
        throw error;
    }
};

/**
 * Delete/Deactivate WhatsApp template
 */
export const deactivateWhatsAppTemplate = async (tenantId: string, templateId: string): Promise<void> => {
    try {
        await updateDoc(getTemplateDocRef(tenantId, templateId), {
            isActive: false,
            updatedAt: Timestamp.now()
        });
    } catch (error) {
        logger.error('Error deactivating WhatsApp template:', error, 'whatsappTemplatesService');
        throw error;
    }
};

/**
 * Get active templates for a branch
 */
export const getActiveTemplates = async (
    tenantId: string,
    branchId?: string
): Promise<WhatsAppTemplate[]> => {
    try {
        const q = query(
            getTemplatesCollectionRef(tenantId),
            where('isActive', '==', true),
            orderBy('nameAr', 'asc')
        );

        const snapshot = await getDocs(q);
        const templates: WhatsAppTemplate[] = [];

        snapshot.forEach(doc => {
            const data = doc.data() as WhatsAppTemplate;
            
            // Check branch targeting
            if (data.branchId && branchId && data.branchId !== branchId) {
                return; // Not for this branch
            }

            templates.push({
                id: doc.id,
                ...data
            });
        });

        return templates;
    } catch (error) {
        logger.error('Error getting active templates:', error, 'whatsappTemplatesService');
        return [];
    }
};

/**
 * Subscribe to active templates (real-time)
 */
export const subscribeToActiveTemplates = (
    tenantId: string,
    branchId: string | undefined,
    callback: (templates: WhatsAppTemplate[]) => void
): (() => void) => {
    const q = query(
        getTemplatesCollectionRef(tenantId),
        where('isActive', '==', true),
        orderBy('nameAr', 'asc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const templates: WhatsAppTemplate[] = [];

            snapshot.forEach(doc => {
                const data = doc.data() as WhatsAppTemplate;
                
                // Check branch targeting
                if (data.branchId && branchId && data.branchId !== branchId) {
                    return; // Not for this branch
                }

                templates.push({
                    id: doc.id,
                    ...data
                });
            });

            callback(templates);
        },
        (error) => {
            logger.error('Error subscribing to templates:', error, 'whatsappTemplatesService');
            callback([]);
        }
    );
};

/**
 * Get all templates (for manager management)
 */
export const getAllTemplates = async (tenantId: string): Promise<WhatsAppTemplate[]> => {
    try {
        const q = query(
            getTemplatesCollectionRef(tenantId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as WhatsAppTemplate));
    } catch (error) {
        logger.error('Error getting all templates:', error, 'whatsappTemplatesService');
        return [];
    }
};

/**
 * Subscribe to all templates (for manager management)
 */
export const subscribeToAllTemplates = (
    tenantId: string,
    callback: (templates: WhatsAppTemplate[]) => void
): (() => void) => {
    const q = query(
        getTemplatesCollectionRef(tenantId),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const templates = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WhatsAppTemplate));
            callback(templates);
        },
        (error) => {
            logger.error('Error subscribing to all templates:', error, 'whatsappTemplatesService');
            callback([]);
        }
    );
};

/**
 * Fill template with variables
 */
export const fillTemplate = (
    template: WhatsAppTemplate,
    variables: {
        guestFirstName: string;
        roomNumber: string;
        branchName?: string;
        branchNumber?: string;
        [key: string]: any; // Additional variables
    }
): string => {
    let message = template.messageFormatAr || template.messageFormat;
    
    // Replace placeholders
    message = message.replace(/{guestName}/g, variables.guestFirstName);
    message = message.replace(/{roomNumber}/g, variables.roomNumber);
    message = message.replace(/{branchName}/g, variables.branchName || '');
    message = message.replace(/{branchNumber}/g, variables.branchNumber || '');
    
    // Replace custom variables
    if (template.variables) {
        template.variables.forEach(variable => {
            const value = variables[variable.key] || variable.defaultValue || '';
            message = message.replace(new RegExp(`{${variable.key}}`, 'g'), value);
        });
    }
    
    return message;
};

/**
 * Send WhatsApp message
 */
export const sendWhatsAppMessage = async (
    tenantId: string,
    template: WhatsAppTemplate,
    messageData: {
        roomNumber: string;
        guestFirstName: string;
        guestPhoneNumber: string;
        branchId: string;
        branchName?: string;
        branchNumber?: string;
        variables?: Record<string, any>;
    },
    senderId: string,
    senderName: string
): Promise<string> => {
    try {
        // Fill template
        const finalMessage = fillTemplate(template, {
            guestFirstName: messageData.guestFirstName,
            roomNumber: messageData.roomNumber,
            branchName: messageData.branchName,
            branchNumber: messageData.branchNumber,
            ...(messageData.variables || {})
        });

        // Create WhatsApp link
        const whatsappNumber = messageData.guestPhoneNumber.replace(/[^0-9]/g, ''); // Remove non-digits
        const encodedMessage = encodeURIComponent(finalMessage);
        const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        // Save message record
        const messageDataRecord: Omit<WhatsAppMessage, 'id'> = {
            templateId: template.id,
            templateName: template.nameAr || template.name,
            roomNumber: messageData.roomNumber,
            guestFirstName: messageData.guestFirstName,
            guestPhoneNumber: messageData.guestPhoneNumber,
            branchId: messageData.branchId,
            branchName: messageData.branchName,
            message: finalMessage,
            sentAt: Timestamp.now(),
            sentBy: { id: senderId, name: senderName },
            status: 'sent',
            variables: messageData.variables
        };

        const docRef = doc(getMessagesCollectionRef(tenantId));
        await setDoc(docRef, messageDataRecord);

        // Open WhatsApp (in browser, this will open WhatsApp Web/Desktop)
        window.open(whatsappLink, '_blank');

        return docRef.id;
    } catch (error) {
        logger.error('Error sending WhatsApp message:', error, 'whatsappTemplatesService');
        throw error;
    }
};

/**
 * Get default templates
 */
export const getDefaultTemplates = (): Omit<WhatsAppTemplate, 'id' | 'createdAt' | 'tenantId' | 'createdBy'>[] => {
    return [
        {
            name: 'Checkout Notice',
            nameAr: 'تسجيل خروج',
            description: 'تنبيه بتسجيل الخروج',
            messageFormat: 'Dear {guestName}, Room {roomNumber} at {branchName} branch {branchNumber}. We inform you that your checkout is today at {checkoutTime}. Thank you for staying with us.',
            messageFormatAr: 'عاملنا العزيز {guestName} غرفة رقم {roomNumber} في فرع فندق {branchName} رقم {branchNumber} نعلمكم أن تسجيل خروجك اليوم الساعة {checkoutTime} نشكركم على إقامتكم معنا',
            variables: [
                {
                    key: 'checkoutTime',
                    label: 'Checkout Time',
                    labelAr: 'وقت تسجيل الخروج',
                    type: 'time',
                    required: true,
                    placeholder: '2:00 PM'
                }
            ],
            category: 'checkout',
            priority: 'high',
            isActive: true
        },
        {
            name: 'Extension Notice',
            nameAr: 'تمديد',
            description: 'تنبيه بتمديد الإقامة',
            messageFormat: 'Dear {guestName}, Room {roomNumber} at {branchName} branch {branchNumber}. We inform you that your stay has been extended until {extensionDate}. Thank you.',
            messageFormatAr: 'عاملنا العزيز {guestName} غرفة رقم {roomNumber} في فرع فندق {branchName} رقم {branchNumber} نعلمكم أن إقامتكم تم تمديدها حتى {extensionDate} نشكركم',
            variables: [
                {
                    key: 'extensionDate',
                    label: 'Extension Date',
                    labelAr: 'تاريخ التمديد',
                    type: 'date',
                    required: true,
                    placeholder: '2024-01-15'
                }
            ],
            category: 'extension',
            priority: 'medium',
            isActive: true
        },
        {
            name: 'Contract Expiry',
            nameAr: 'انتهاء العقد',
            description: 'تنبيه بانتهاء العقد',
            messageFormat: 'Dear {guestName}, Room {roomNumber} at {branchName} branch {branchNumber}. We inform you that your contract expires on {expiryDate}. Please contact reception for renewal.',
            messageFormatAr: 'عاملنا العزيز {guestName} غرفة رقم {roomNumber} في فرع فندق {branchName} رقم {branchNumber} نعلمكم أن عقد إقامتكم ينتهي في {expiryDate} يرجى التواصل مع الاستقبال للتجديد',
            variables: [
                {
                    key: 'expiryDate',
                    label: 'Expiry Date',
                    labelAr: 'تاريخ الانتهاء',
                    type: 'date',
                    required: true,
                    placeholder: '2024-01-15'
                }
            ],
            category: 'contract',
            priority: 'high',
            isActive: true
        },
        {
            name: 'No Smoking',
            nameAr: 'عدم التدخين',
            description: 'تنبيه بعدم التدخين',
            messageFormat: 'Dear {guestName}, Room {roomNumber} at {branchName} branch {branchNumber}. We remind you that smoking is not allowed in rooms. Thank you for your cooperation.',
            messageFormatAr: 'عاملنا العزيز {guestName} غرفة رقم {roomNumber} في فرع فندق {branchName} رقم {branchNumber} نذكركم أن التدخين غير مسموح في الغرف نشكركم على تعاونكم',
            category: 'smoking',
            priority: 'medium',
            isActive: true
        }
    ];
};
