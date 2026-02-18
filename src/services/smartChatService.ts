/**
 * Smart Chat Service (شات أدوار الذكي)
 * نظام شات مركزي بين النزيل والاستقبال والأقسام
 * 
 * ✅ Features:
 * - Guest chatbot with quick options
 * - Reception as central hub
 * - Department forwarding
 * - Image upload via ImgBB
 * - Auto-cleanup on checkout
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface ChatMessage {
    id?: string;
    roomNumber: string;
    sender: 'guest' | 'reception' | 'system' | 'bot';
    senderName?: string;
    senderId?: string;
    content: string;
    type: 'text' | 'image' | 'quick_option' | 'status_update';
    imageUrl?: string;
    quickOptionId?: string;
    status: 'sent' | 'delivered' | 'read';
    createdAt: Timestamp | any;
}

export interface ChatRoom {
    id: string;
    roomNumber: string;
    guestName?: string;
    guestPhone?: string;
    status: 'active' | 'closed' | 'archived';
    unreadCount: number;
    lastMessage?: string;
    lastMessageAt?: Timestamp;
    createdAt: Timestamp;
}

export interface QuickOption {
    id: string;
    label: string;
    labelEn?: string;
    icon?: string;
    type: 'approval' | 'forward';
    forwardTo?: string; // department
    autoResponse?: string;
    isActive: boolean;
    order: number;
}

export interface ChatSettings {
    welcomeMessage: string;
    welcomeMessageEn?: string;
    slaMinutes: number; // Response time target
    quickOptions: QuickOption[];
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

const DEFAULT_QUICK_OPTIONS: QuickOption[] = [
    {
        id: 'late_checkout',
        label: 'طلب خروج متأخر',
        labelEn: 'Late Checkout',
        icon: '🕐',
        type: 'approval',
        autoResponse: 'تم استلام طلبكم للخروج المتأخر، سيتم الرد عليكم قريباً',
        isActive: true,
        order: 1
    },
    {
        id: 'extend_stay',
        label: 'تمديد الإقامة',
        labelEn: 'Extend Stay',
        icon: '📅',
        type: 'approval',
        autoResponse: 'شكراً لرغبتكم في تمديد الإقامة، سيتواصل معكم الاستقبال',
        isActive: true,
        order: 2
    },
    {
        id: 'room_cleaning',
        label: 'تنظيف الغرفة',
        labelEn: 'Room Cleaning',
        icon: '🧹',
        type: 'forward',
        forwardTo: 'housekeeping',
        isActive: true,
        order: 3
    },
    {
        id: 'maintenance',
        label: 'صيانة',
        labelEn: 'Maintenance',
        icon: '🔧',
        type: 'forward',
        forwardTo: 'maintenance',
        isActive: true,
        order: 4
    },
    {
        id: 'room_service',
        label: 'خدمة الغرف',
        labelEn: 'Room Service',
        icon: '🍽️',
        type: 'forward',
        forwardTo: 'coffee',
        isActive: true,
        order: 5
    },
    {
        id: 'bellman',
        label: 'بيلمان / حمل أمتعة',
        labelEn: 'Bellman',
        icon: '🛎️',
        type: 'forward',
        forwardTo: 'bellman',
        isActive: true,
        order: 6
    },
    {
        id: 'other',
        label: 'طلب آخر',
        labelEn: 'Other Request',
        icon: '💬',
        type: 'approval',
        isActive: true,
        order: 7
    }
];

const DEFAULT_SETTINGS: ChatSettings = {
    welcomeMessage: 'مرحباً بك في فندق أدورا! 🏨\nكيف يمكننا مساعدتك؟',
    welcomeMessageEn: 'Welcome to Adora Hotel! 🏨\nHow can we help you?',
    slaMinutes: 5,
    quickOptions: DEFAULT_QUICK_OPTIONS
};

// ============================================================
// CHAT SETTINGS FUNCTIONS
// ============================================================

/**
 * Get chat settings for tenant
 */
export async function getChatSettings(tenantId: string): Promise<ChatSettings> {
    const settingsRef = doc(db, `tenants/${tenantId}/settings/chat`);
    const settingsSnap = await getDoc(settingsRef);
    
    if (!settingsSnap.exists()) {
        // Create default settings
        await updateDoc(settingsRef, DEFAULT_SETTINGS).catch(() => {
            // Document doesn't exist, create it
            return addDoc(collection(db, `tenants/${tenantId}/settings`), {
                ...DEFAULT_SETTINGS,
                id: 'chat'
            });
        });
        return DEFAULT_SETTINGS;
    }
    
    return settingsSnap.data() as ChatSettings;
}

/**
 * Update chat settings
 */
export async function updateChatSettings(
    tenantId: string,
    settings: Partial<ChatSettings>
): Promise<void> {
    const settingsRef = doc(db, `tenants/${tenantId}/settings/chat`);
    await updateDoc(settingsRef, {
        ...settings,
        updatedAt: serverTimestamp()
    });
}

/**
 * Add/Update quick option
 */
export async function saveQuickOption(
    tenantId: string,
    option: QuickOption
): Promise<void> {
    const settings = await getChatSettings(tenantId);
    const options = settings.quickOptions || [];
    
    const existingIndex = options.findIndex(o => o.id === option.id);
    if (existingIndex >= 0) {
        options[existingIndex] = option;
    } else {
        options.push(option);
    }
    
    await updateChatSettings(tenantId, { quickOptions: options });
}

// ============================================================
// CHAT ROOM FUNCTIONS
// ============================================================

/**
 * Get or create chat room for a room number
 */
export async function getOrCreateChatRoom(
    tenantId: string,
    branchId: string,
    roomNumber: string,
    guestName?: string,
    guestPhone?: string
): Promise<ChatRoom> {
    const roomsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms`);
    const q = query(
        roomsRef,
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active'),
        limit(1)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        const room = snapshot.docs[0];
        return { id: room.id, ...room.data() } as ChatRoom;
    }
    
    // Create new chat room
    const newRoom: Omit<ChatRoom, 'id'> = {
        roomNumber,
        guestName,
        guestPhone,
        status: 'active',
        unreadCount: 0,
        createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(roomsRef, newRoom);
    return { id: docRef.id, ...newRoom };
}

/**
 * Subscribe to chat rooms for reception
 */
export function subscribeToChatRooms(
    tenantId: string,
    branchId: string,
    callback: (rooms: ChatRoom[]) => void
): () => void {
    const roomsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms`);
    const q = query(
        roomsRef,
        where('status', '==', 'active'),
        orderBy('lastMessageAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ChatRoom[];
        callback(rooms);
    });
}

// ============================================================
// MESSAGE FUNCTIONS
// ============================================================

/**
 * Send a message
 */
export async function sendMessage(
    tenantId: string,
    branchId: string,
    chatRoomId: string,
    message: Omit<ChatMessage, 'id' | 'createdAt' | 'status'>
): Promise<string> {
    const messagesRef = collection(
        db, 
        `tenants/${tenantId}/branches/${branchId}/chat_rooms/${chatRoomId}/messages`
    );
    
    const newMessage: Omit<ChatMessage, 'id'> = {
        ...message,
        status: 'sent',
        createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(messagesRef, newMessage);
    
    // Update chat room
    const roomRef = doc(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms/${chatRoomId}`);
    await updateDoc(roomRef, {
        lastMessage: message.content.substring(0, 100),
        lastMessageAt: serverTimestamp(),
        unreadCount: message.sender === 'guest' ? 1 : 0 // Increment for guest messages
    });
    
    return docRef.id;
}

/**
 * Get smart greeting based on time of day
 */
const getSmartGreeting = (): { greeting: string; emoji: string } => {
    const hour = new Date().getHours();
    
    if (hour >= 5 && hour < 12) {
        return { greeting: 'صباح الخير', emoji: '☀️' };
    } else if (hour >= 12 && hour < 17) {
        return { greeting: 'مساء النور', emoji: '🌤️' };
    } else if (hour >= 17 && hour < 21) {
        return { greeting: 'مساء الخير', emoji: '🌅' };
    } else {
        return { greeting: 'مساء النجوم', emoji: '🌙' };
    }
};

/**
 * Send bot welcome message
 * ✅ Enhanced: Smart greeting based on time + guest name
 */
export async function sendWelcomeMessage(
    tenantId: string,
    branchId: string,
    chatRoomId: string,
    guestName?: string
): Promise<void> {
    const settings = await getChatSettings(tenantId);
    const { greeting, emoji } = getSmartGreeting();
    
    let welcomeText: string;
    
    if (guestName) {
        // ✅ Personalized greeting with name and time
        welcomeText = `${emoji} ${greeting} يا ${guestName}!\n\n` +
            `🏨 نسعد بخدمتك في فندق أدورا.\n` +
            `كيف يمكننا مساعدتك اليوم؟\n\n` +
            `💡 اختر من الخيارات السريعة أدناه أو اكتب طلبك.`;
    } else {
        // ✅ Generic but still time-aware greeting
        welcomeText = `${emoji} ${greeting}!\n\n` +
            `${settings.welcomeMessage}\n\n` +
            `💡 اختر من الخيارات السريعة أدناه أو اكتب طلبك.`;
    }
    
    await sendMessage(tenantId, branchId, chatRoomId, {
        roomNumber: '',
        sender: 'bot',
        senderName: 'Adora Bot',
        content: welcomeText,
        type: 'text'
    });
}

/**
 * Send quick option selection
 * ✅ SECURITY: Verifies room card is active and QR is enabled before creating request
 * 🎮 Demo mode bypasses security check for testing purposes
 */
export async function sendQuickOptionMessage(
    tenantId: string,
    branchId: string,
    chatRoomId: string,
    roomNumber: string,
    option: QuickOption,
    guestPhone?: string,
    isDemoMode: boolean = false // 🎮 Added for demo mode support
): Promise<string> {
    // 🎮 Demo mode: Skip room verification
    if (!isDemoMode) {
        // ✅ SECURITY CHECK: Verify room card is active and QR is enabled (tenant-scoped)
        const roomCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
        const roomQuery = query(
            roomCardsRef,
            where('roomNumber', '==', roomNumber),
            where('status', '==', 'active'),
            where('qrActive', '==', true),
            limit(1)
        );
        
        const roomSnap = await getDocs(roomQuery);
        if (roomSnap.empty) {
            // Room is not checked in or QR is disabled (e.g., after checkout)
            throw new Error('ROOM_NOT_AVAILABLE');
        }
    } else {
        logger.info('🎮 Demo Mode: Bypassing room card verification for quick option', undefined, 'smartChatService');
    }
    
    // Send guest message
    await sendMessage(tenantId, branchId, chatRoomId, {
        roomNumber,
        sender: 'guest',
        content: `${option.icon} ${option.label}`,
        type: 'quick_option',
        quickOptionId: option.id
    });
    
    // Create request for reception
    const requestData = {
        type: option.forwardTo || 'general',
        requestType: option.id,
        roomNumber,
        room: roomNumber,
        guestPhone,
        status: 'PENDING_RECEPTION',
        source: 'chat',
        chatRoomId,
        quickOptionId: option.id,
        notes: option.label,
        createdAt: serverTimestamp()
    };
    
    const requestRef = await addDoc(
        collection(db, `tenants/${tenantId}/branches/${branchId}/requests`),
        requestData
    );
    
    // Send auto-response if configured
    if (option.autoResponse) {
        await sendMessage(tenantId, branchId, chatRoomId, {
            roomNumber,
            sender: 'bot',
            content: option.autoResponse,
            type: 'text'
        });
    }
    
    return requestRef.id;
}

/**
 * Subscribe to messages in a chat room
 */
export function subscribeToMessages(
    tenantId: string,
    branchId: string,
    chatRoomId: string,
    callback: (messages: ChatMessage[]) => void
): () => void {
    const messagesRef = collection(
        db,
        `tenants/${tenantId}/branches/${branchId}/chat_rooms/${chatRoomId}/messages`
    );
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as ChatMessage[];
        callback(messages);
    });
}

// ============================================================
// RECEPTION ACTIONS
// ============================================================

/**
 * Approve a request (for admin-type requests)
 */
export async function approveRequest(
    tenantId: string,
    branchId: string,
    requestId: string,
    chatRoomId: string,
    receptionUserId: string,
    receptionUserName: string,
    approvalMessage?: string
): Promise<void> {
    // Update request status
    const requestRef = doc(db, `tenants/${tenantId}/branches/${branchId}/requests/${requestId}`);
    await updateDoc(requestRef, {
        status: 'APPROVED',
        approvedBy: receptionUserId,
        approvedByName: receptionUserName,
        approvedAt: serverTimestamp()
    });
    
    // Send approval message to guest
    const message = approvalMessage || '✅ تمت الموافقة على طلبكم';
    await sendMessage(tenantId, branchId, chatRoomId, {
        roomNumber: '',
        sender: 'reception',
        senderId: receptionUserId,
        senderName: receptionUserName,
        content: message,
        type: 'status_update'
    });
}

/**
 * Forward request to department
 */
export async function forwardRequest(
    tenantId: string,
    branchId: string,
    requestId: string,
    chatRoomId: string,
    department: string,
    receptionUserId: string,
    receptionUserName: string
): Promise<void> {
    // Update request
    const requestRef = doc(db, `tenants/${tenantId}/branches/${branchId}/requests/${requestId}`);
    await updateDoc(requestRef, {
        status: 'PENDING',
        forwardedTo: department,
        forwardedBy: receptionUserId,
        forwardedByName: receptionUserName,
        forwardedAt: serverTimestamp()
    });
    
    // Send status update to guest
    const departmentNames: Record<string, string> = {
        housekeeping: 'النظافة',
        maintenance: 'الصيانة',
        bellman: 'البيلمان',
        coffee: 'خدمة الغرف'
    };
    
    await sendMessage(tenantId, branchId, chatRoomId, {
        roomNumber: '',
        sender: 'system',
        content: `🔄 تم توجيه طلبكم إلى قسم ${departmentNames[department] || department}`,
        type: 'status_update'
    });
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(
    tenantId: string,
    branchId: string,
    chatRoomId: string
): Promise<void> {
    // Reset unread count
    const roomRef = doc(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms/${chatRoomId}`);
    await updateDoc(roomRef, { unreadCount: 0 });
}

// ============================================================
// CLEANUP FUNCTIONS
// ============================================================

/**
 * Archive chat room on checkout (keeps logs, removes from active)
 */
export async function archiveChatRoom(
    tenantId: string,
    branchId: string,
    roomNumber: string
): Promise<void> {
    const roomsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms`);
    const q = query(
        roomsRef,
        where('roomNumber', '==', roomNumber),
        where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    
    snapshot.docs.forEach(roomDoc => {
        batch.update(roomDoc.ref, {
            status: 'archived',
            archivedAt: serverTimestamp()
        });
    });
    
    await batch.commit();
}

/**
 * Delete old archived chats (older than 30 days)
 */
export async function cleanupOldChats(
    tenantId: string,
    branchId: string,
    daysOld: number = 30
): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    const roomsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/chat_rooms`);
    const q = query(
        roomsRef,
        where('status', '==', 'archived'),
        where('archivedAt', '<', Timestamp.fromDate(cutoff))
    );
    
    const snapshot = await getDocs(q);
    let deletedCount = 0;
    
    for (const roomDoc of snapshot.docs) {
        // Delete messages first
        const messagesRef = collection(roomDoc.ref, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        
        const batch = writeBatch(db);
        messagesSnap.docs.forEach(msgDoc => {
            batch.delete(msgDoc.ref);
        });
        batch.delete(roomDoc.ref);
        await batch.commit();
        
        deletedCount++;
    }
    
    return deletedCount;
}

// ============================================================
// SLA MONITORING
// ============================================================

/**
 * Get requests exceeding SLA
 */
export async function getOverdueChatRequests(
    tenantId: string,
    branchId: string,
    slaMinutes: number = 5
): Promise<any[]> {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - slaMinutes);
    
    const requestsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/requests`);
    const q = query(
        requestsRef,
        where('source', '==', 'chat'),
        where('status', '==', 'PENDING_RECEPTION'),
        where('createdAt', '<', Timestamp.fromDate(cutoff))
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export default {
    // Settings
    getChatSettings,
    updateChatSettings,
    saveQuickOption,
    // Rooms
    getOrCreateChatRoom,
    subscribeToChatRooms,
    // Messages
    sendMessage,
    sendWelcomeMessage,
    sendQuickOptionMessage,
    subscribeToMessages,
    // Reception
    approveRequest,
    forwardRequest,
    markMessagesAsRead,
    // Cleanup
    archiveChatRoom,
    cleanupOldChats,
    // SLA
    getOverdueChatRequests
};
