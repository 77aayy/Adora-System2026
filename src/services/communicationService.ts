/**
 * Communication Service
 * SMS, Email, WhatsApp, Internal Messaging, Broadcasts
 * 
 * ✅ Enhanced with feature checking and notification configuration
 */

import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isFeatureEnabled } from './systemSettingsService';

// ============================================================
// NOTIFICATION CONFIGURATION
// ============================================================

export interface NotificationConfig {
    // SMS Provider (Twilio, MessageBird, etc.)
    sms: {
        enabled: boolean;
        provider: 'twilio' | 'messagebird' | 'unifonic' | 'custom';
        apiKey?: string;
        apiSecret?: string;
        senderId?: string;
        accountSid?: string;
    };
    // Email Provider (SendGrid, Mailgun, SES, etc.)
    email: {
        enabled: boolean;
        provider: 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'custom';
        apiKey?: string;
        fromEmail?: string;
        fromName?: string;
        smtpHost?: string;
        smtpPort?: number;
        smtpUser?: string;
        smtpPassword?: string;
    };
    // WhatsApp Business API
    whatsapp: {
        enabled: boolean;
        provider: 'official' | 'twilio' | 'messagebird';
        phoneNumberId?: string;
        accessToken?: string;
        businessAccountId?: string; // Optional: WhatsApp Business Account ID for advanced features
    };
}

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
    sms: { enabled: false, provider: 'twilio' },
    email: { enabled: false, provider: 'sendgrid' },
    whatsapp: { enabled: false, provider: 'official' }
};

/**
 * Get notification configuration for a tenant
 */
export const getNotificationConfig = async (tenantId: string): Promise<NotificationConfig> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings/notifications`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { ...DEFAULT_NOTIFICATION_CONFIG, ...docSnap.data() } as NotificationConfig;
        }
        return DEFAULT_NOTIFICATION_CONFIG;
    } catch (error) {
        console.error('Error getting notification config:', error);
        return DEFAULT_NOTIFICATION_CONFIG;
    }
};

/**
 * Save notification configuration for a tenant
 */
export const saveNotificationConfig = async (
    tenantId: string,
    config: Partial<NotificationConfig>
): Promise<void> => {
    try {
        const docRef = doc(db, `tenants/${tenantId}/settings/notifications`);
        await setDoc(docRef, config, { merge: true });
    } catch (error) {
        console.error('Error saving notification config:', error);
        throw error;
    }
};

// ============================================================
// NOTIFICATION QUEUE (For processing later via Cloud Functions)
// ============================================================

export interface NotificationQueueItem {
    id?: string;
    type: 'sms' | 'email' | 'whatsapp' | 'push';
    to: string;
    subject?: string;
    message: string;
    templateId?: string;
    variables?: Record<string, string>;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    status: 'pending' | 'processing' | 'sent' | 'failed';
    tenantId: string;
    createdAt: any;
    processedAt?: any;
    error?: string;
    retryCount?: number;
}

/**
 * Add notification to queue for processing
 */
export const queueNotification = async (
    tenantId: string,
    notification: Omit<NotificationQueueItem, 'id' | 'status' | 'createdAt' | 'tenantId'>
): Promise<string> => {
    try {
        const docRef = await addDoc(collection(db, 'notificationQueue'), {
            ...notification,
            tenantId,
            status: 'pending',
            createdAt: Timestamp.now(),
            retryCount: 0
        });
        return docRef.id;
    } catch (error) {
        console.error('Error queueing notification:', error);
        throw error;
    }
};

/**
 * Get pending notifications from queue
 */
export const getPendingNotifications = async (limit: number = 100): Promise<NotificationQueueItem[]> => {
    try {
        const q = query(
            collection(db, 'notificationQueue'),
            where('status', '==', 'pending'),
            orderBy('priority', 'desc'),
            orderBy('createdAt', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NotificationQueueItem));
    } catch (error) {
        console.error('Error getting pending notifications:', error);
        return [];
    }
};

// ============================================================
// 11. SMS NOTIFICATIONS
// ============================================================

export interface SMSMessage {
    to: string;
    message: string;
    status: 'pending' | 'sent' | 'failed' | 'queued';
    sentAt?: Date;
    tenantId?: string;
}

/**
 * Send SMS - checks feature flag and configuration before sending
 */
export const sendSMS = async (
    phoneNumber: string,
    message: string,
    tenantId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    // 1. Check if SMS feature is enabled
    if (tenantId) {
        const isEnabled = await isFeatureEnabled('smsNotifications', tenantId);
        if (!isEnabled) {
            console.log('📱 SMS feature is disabled for this tenant');
            return { success: false, error: 'SMS_FEATURE_DISABLED' };
        }
        
        const config = await getNotificationConfig(tenantId);
        if (!config.sms.enabled) {
            console.log('📱 SMS is not configured for this tenant');
            // Queue for later processing
            const queueId = await queueNotification(tenantId, {
                type: 'sms',
                to: phoneNumber,
                message,
                priority: 'normal'
            });
            return { success: true, messageId: queueId, error: 'QUEUED_FOR_PROCESSING' };
        }
    }
    
    // 2. Create SMS record
    const docRef = await addDoc(collection(db, 'smsMessages'), {
        to: phoneNumber,
        message,
        status: 'pending',
        tenantId,
        createdAt: Timestamp.now()
    });

    // 3. In a real implementation, this would call the SMS provider API
    // For now, we mark as sent (Cloud Functions would handle actual sending)
    console.log(`📱 SMS queued to ${phoneNumber}: ${message.substring(0, 50)}...`);

    await updateDoc(doc(db, 'smsMessages', docRef.id), {
        status: 'queued',
        queuedAt: Timestamp.now()
    });

    return { success: true, messageId: docRef.id };
};

export const sendBulkSMS = async (phoneNumbers: string[], message: string): Promise<number> => {
    let sent = 0;
    for (const phone of phoneNumbers) {
        try {
            await sendSMS(phone, message);
            sent++;
        } catch (e) {
            console.error(`Failed to send SMS to ${phone}`);
        }
    }
    return sent;
};

// ============================================================
// 12. EMAIL TEMPLATES
// ============================================================

export const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
    welcome: {
        subject: 'مرحباً بك في فندق أدورا',
        body: 'عزيزي {{guestName}}،\n\nنرحب بك في فندق أدورا. نتمنى لك إقامة ممتعة.\n\nمع تحياتنا'
    },
    checkout: {
        subject: 'شكراً لإقامتك معنا',
        body: 'عزيزي {{guestName}}،\n\nنشكرك على اختيار فندق أدورا. نتطلع لرؤيتك مجدداً.'
    },
    feedback: {
        subject: 'رأيك يهمنا',
        body: 'عزيزي {{guestName}}،\n\nنود معرفة رأيك في تجربتك معنا.'
    },
    promotion: {
        subject: 'عرض خاص لك!',
        body: 'عزيزي {{guestName}}،\n\nلدينا عرض خاص حصري لك. استخدم الكود: {{promoCode}}'
    }
};

/**
 * Send Email - checks feature flag and configuration before sending
 */
export const sendEmail = async (
    to: string,
    templateId: string,
    variables: Record<string, string>,
    tenantId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    // 1. Check if email feature is enabled
    if (tenantId) {
        const isEnabled = await isFeatureEnabled('emailNotifications', tenantId);
        if (!isEnabled) {
            console.log('📧 Email feature is disabled for this tenant');
            return { success: false, error: 'EMAIL_FEATURE_DISABLED' };
        }
        
        const config = await getNotificationConfig(tenantId);
        if (!config.email.enabled) {
            console.log('📧 Email is not configured for this tenant');
            // Queue for later processing
            const queueId = await queueNotification(tenantId, {
                type: 'email',
                to,
                subject: EMAIL_TEMPLATES[templateId]?.subject || 'Notification',
                message: EMAIL_TEMPLATES[templateId]?.body || '',
                templateId,
                variables,
                priority: 'normal'
            });
            return { success: true, messageId: queueId, error: 'QUEUED_FOR_PROCESSING' };
        }
    }
    
    // 2. Get and process template
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) {
        return { success: false, error: `TEMPLATE_NOT_FOUND: ${templateId}` };
    }

    let subject = template.subject;
    let body = template.body;

    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value);
        body = body.replace(regex, value);
    });

    // 3. Create email record
    const docRef = await addDoc(collection(db, 'emails'), {
        to,
        subject,
        body,
        templateId,
        variables,
        tenantId,
        status: 'queued',
        createdAt: Timestamp.now()
    });

    // 4. In a real implementation, this would call the email provider API
    // For now, we mark as queued (Cloud Functions would handle actual sending)
    console.log(`📧 Email queued to ${to}: ${subject}`);

    return { success: true, messageId: docRef.id };
};

/**
 * Send custom email (not using template)
 */
export const sendCustomEmail = async (
    to: string,
    subject: string,
    body: string,
    tenantId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    // 1. Check if email feature is enabled
    if (tenantId) {
        const isEnabled = await isFeatureEnabled('emailNotifications', tenantId);
        if (!isEnabled) {
            return { success: false, error: 'EMAIL_FEATURE_DISABLED' };
        }
    }

    // 2. Create email record
    const docRef = await addDoc(collection(db, 'emails'), {
        to,
        subject,
        body,
        tenantId,
        status: 'queued',
        createdAt: Timestamp.now()
    });

    console.log(`📧 Custom email queued to ${to}: ${subject}`);
    return { success: true, messageId: docRef.id };
};

// ============================================================
// 13. WHATSAPP INTEGRATION
// ============================================================

export const sendWhatsApp = async (phoneNumber: string, message: string, mediaUrl?: string): Promise<string> => {
    const docRef = await addDoc(collection(db, 'whatsappMessages'), {
        to: phoneNumber,
        message,
        mediaUrl,
        status: 'sent',
        sentAt: Timestamp.now()
    });

    // Would integrate with WhatsApp Business API
    console.log(`WhatsApp to ${phoneNumber}: ${message}`);
    return docRef.id;
};

export const sendWhatsAppTemplate = async (phoneNumber: string, template: string, params: string[]): Promise<string> => {
    // WhatsApp Business requires pre-approved templates
    return sendWhatsApp(phoneNumber, `Template: ${template} with params: ${params.join(', ')}`);
};

// ============================================================
// 14. INTERNAL MESSAGING
// ============================================================

export interface InternalMessage {
    id: string;
    from: string;
    fromName: string;
    to: string;
    toName: string;
    subject: string;
    body: string;
    read: boolean;
    createdAt: Date;
}

export const sendInternalMessage = async (from: string, fromName: string, to: string, toName: string, subject: string, body: string): Promise<string> => {
    const docRef = await addDoc(collection(db, 'internalMessages'), {
        from,
        fromName,
        to,
        toName,
        subject,
        body,
        read: false,
        createdAt: Timestamp.now()
    });
    return docRef.id;
};

export const getInbox = async (userId: string): Promise<InternalMessage[]> => {
    const snapshot = await getDocs(query(
        collection(db, 'internalMessages'),
        where('to', '==', userId),
        orderBy('createdAt', 'desc')
    ));
    return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate()
    })) as InternalMessage[];
};

export const markAsRead = async (messageId: string): Promise<void> => {
    await updateDoc(doc(db, 'internalMessages', messageId), { read: true, readAt: Timestamp.now() });
};

export const getUnreadCount = async (userId: string): Promise<number> => {
    const snapshot = await getDocs(query(
        collection(db, 'internalMessages'),
        where('to', '==', userId),
        where('read', '==', false)
    ));
    return snapshot.size;
};

// ============================================================
// 15. BROADCAST ANNOUNCEMENTS
// ============================================================

export interface Broadcast {
    id: string;
    title: string;
    message: string;
    targetDepartments: string[];
    targetRoles: string[];
    priority: 'normal' | 'important' | 'urgent';
    createdBy: string;
    createdAt: Date;
    expiresAt?: Date;
}

export const createBroadcast = async (data: Omit<Broadcast, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, 'broadcasts'), {
        ...data,
        createdAt: Timestamp.now()
    });
    return docRef.id;
};

export const getActiveBroadcasts = async (department: string, role: string): Promise<Broadcast[]> => {
    const snapshot = await getDocs(query(
        collection(db, 'broadcasts'),
        orderBy('createdAt', 'desc')
    ));

    return snapshot.docs
        .map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate(),
            expiresAt: d.data().expiresAt?.toDate()
        }))
        .filter((b: any) => {
            if (b.expiresAt && b.expiresAt < new Date()) return false;
            if (b.targetDepartments.length && !b.targetDepartments.includes(department)) return false;
            if (b.targetRoles.length && !b.targetRoles.includes(role)) return false;
            return true;
        }) as Broadcast[];
};

export const dismissBroadcast = async (broadcastId: string, userId: string): Promise<void> => {
    await addDoc(collection(db, 'broadcastDismissals'), {
        broadcastId,
        userId,
        dismissedAt: Timestamp.now()
    });
};
