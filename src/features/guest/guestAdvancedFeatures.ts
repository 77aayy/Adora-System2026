/**
 * Guest Portal Advanced Features
 * Migrated from legacy guest.js (1681 lines)
 * Adora Hotel Management System V2
 */

import { db } from '../../services/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, where, orderBy, limit, onSnapshot,
    serverTimestamp, Timestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

interface GuestSession {
    room: string;
    branch: string;
    name: string;
    identity: string;
    verifyType: 'identity' | 'phone';
    timestamp: number;
}

interface GuestRequest {
    id: string;
    roomNumber: string;
    branch: string;
    serviceType: string;
    status: string;
    source: 'QR';
    guestInfo: {
        name: string;
        identity: string;
        verifyType: string;
    };
    createdAt: any;
    timeline?: any;
    rating?: number;
    feedback?: string;
}

interface BranchSettings {
    departmentHours?: Record<string, DepartmentHours>;
    whatsappNumber?: string;
    whatsappMessage?: string;
}

interface DepartmentHours {
    is24h?: boolean;
    start?: string;
    end?: string;
}

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    image?: string;
    category: string;
    available: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const SERVICE_NAMES: Record<string, string> = {
    'cleaning': 'التنظيف',
    'maintenance': 'الصيانة',
    'bellman': 'البيلمان',
    'coffee': 'الكوفي شوب',
    'room_service': 'خدمة الغرف'
};

const STATUS_STEPS: Record<string, number> = {
    'PENDING_RECEPTION': 1,
    'CONFIRMED': 2,
    'IN_PROGRESS': 3,
    'COMPLETED': 4
};

const SESSION_KEY = 'adora_guest_session';

export const getServiceName = (type: string): string => SERVICE_NAMES[type] || type;

// ============================================================
// URL & ROOM EXTRACTION
// ============================================================

interface RoomData {
    room: string | null;
    branch: string | null;
}

/**
 * Extract room and branch from URL
 */
export const extractRoomFromURL = (): RoomData => {
    let room: string | null = null;
    let branch: string | null = null;

    // Method 1: From hash (more secure - not visible in URL bar)
    const hash = window.location.hash;
    if (hash) {
        try {
            const data = JSON.parse(atob(hash.substring(1)));
            room = data.r;
            branch = data.b;
        } catch (e) {
            console.log('Invalid hash data');
        }
    }

    // Method 2: From query params (for compatibility)
    if (!room) {
        const params = new URLSearchParams(window.location.search);
        room = params.get('room') || params.get('r');
        branch = params.get('branch') || params.get('b');
    }

    // Clean URL for security
    if (window.location.search || window.location.hash) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }

    return { room, branch };
};

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Save guest session
 */
export const saveSession = (session: GuestSession): void => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

/**
 * Get saved session
 */
export const getSession = (): GuestSession | null => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            return null;
        }
    }
    return null;
};

/**
 * Clear session
 */
export const clearSession = (): void => {
    localStorage.removeItem(SESSION_KEY);
};

/**
 * Check if session is valid for room
 */
export const isSessionValid = (session: GuestSession, room: string, branch: string): boolean => {
    return session.room === room && session.branch === (branch || 'main');
};

// ============================================================
// ROOM CARD VERIFICATION
// ============================================================

/**
 * Verify room card is active
 */
export const verifyActiveRoomCard = async (
    room: string,
    branch: string
): Promise<boolean> => {
    try {
        const roomCardsQuery = query(
            collection(db, 'roomCards'),
            where('roomNumber', '==', room),
            where('branch', '==', branch || 'main'),
            where('status', '==', 'active'),
            where('qrActive', '==', true),
            limit(1)
        );

        const snapshot = await getDocs(roomCardsQuery);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking room card:', error);
        return true; // Allow entry on error
    }
};

// ============================================================
// GREETING
// ============================================================

/**
 * Get time-based greeting
 */
export const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return 'صباح الخير';
    } else {
        return 'مساء الخير';
    }
};

/**
 * Get personalized greeting
 */
export const getPersonalizedGreeting = (name: string): string => {
    const greeting = getTimeBasedGreeting();
    return `${greeting} يا ${name}، نسعد بضيافتك`;
};

// ============================================================
// DEPARTMENT HOURS
// ============================================================

const DEPARTMENT_KEY_MAP: Record<string, string> = {
    'cleaning': 'housekeeping',
    'maintenance': 'maintenance',
    'bellman': 'bellman',
    'coffee': 'coffee'
};

/**
 * Check if department is open
 */
export const isDepartmentOpen = (
    serviceType: string,
    settings: BranchSettings | null
): boolean => {
    if (!settings?.departmentHours) {
        return true;
    }

    const deptKey = DEPARTMENT_KEY_MAP[serviceType] || serviceType;
    const deptHours = settings.departmentHours[deptKey];

    if (!deptHours) {
        return true;
    }

    if (deptHours.is24h) {
        return true;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMin] = (deptHours.start || '00:00').split(':').map(Number);
    const [endHour, endMin] = (deptHours.end || '23:59').split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
        return currentTime >= startTime && currentTime <= endTime;
    } else {
        // Period extends to next day (e.g., 22:00 - 06:00)
        return currentTime >= startTime || currentTime <= endTime;
    }
};

/**
 * Get WhatsApp link for out-of-hours contact
 */
export const getWhatsAppLink = (
    settings: BranchSettings | null,
    room: string,
    serviceName: string
): string => {
    if (!settings?.whatsappNumber) {
        return '';
    }

    let message = settings.whatsappMessage ||
        'مرحباً، أنا نزيل في الغرفة {room}، أود طلب خدمة {service}.';

    message = message
        .replace('{room}', room)
        .replace('{service}', serviceName);

    return `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(message)}`;
};

// ============================================================
// REQUESTS
// ============================================================

/**
 * Submit guest request
 * 🔐 CRITICAL FIX: Added tenantId parameter for SaaS multi-tenant isolation
 */
export const submitRequest = async (
    serviceType: string,
    room: string,
    branch: string,
    guestName: string,
    guestIdentity: string,
    verifyType: string,
    tenantId: string, // 🔐 NEW: Required for SaaS isolation
    data: Record<string, any> = {}
): Promise<string | null> => {
    // 🔐 Security: Validate tenantId
    if (!tenantId) {
        console.error('🚨 Security Error: tenantId is required for guest request');
        return null;
    }

    try {
        const request = {
            roomNumber: room,
            branch: branch || 'main',
            tenantId, // 🔐 SaaS: Critical for tenant isolation
            source: 'QR',
            guestInfo: {
                name: guestName,
                identity: guestIdentity,
                verifyType
            },
            serviceType,
            ...data,
            status: 'PENDING_RECEPTION',
            createdAt: serverTimestamp(),
            timeline: {
                created: serverTimestamp()
            }
        };

        const docRef = await addDoc(collection(db, 'requests'), request);
        return docRef.id;
    } catch (error) {
        console.error('Submit error:', error);
        return null;
    }
};

/**
 * Subscribe to request updates
 */
export const subscribeToRequest = (
    requestId: string,
    callback: (request: GuestRequest | null) => void
): (() => void) => {
    const requestRef = doc(db, 'requests', requestId);

    return onSnapshot(requestRef, docSnap => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() } as GuestRequest);
        } else {
            callback(null);
        }
    });
};

/**
 * Listen for active requests for room
 */
export const subscribeToActiveRequests = (
    room: string,
    branch: string,
    callback: (requests: GuestRequest[]) => void
): (() => void) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const requestsQuery = query(
        collection(db, 'requests'),
        where('roomNumber', '==', room),
        where('branch', '==', branch || 'main'),
        where('source', '==', 'QR'),
        where('createdAt', '>=', Timestamp.fromDate(today))
    );

    return onSnapshot(requestsQuery, snapshot => {
        const requests: GuestRequest[] = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'COMPLETED') {
                requests.push({ id: doc.id, ...data } as GuestRequest);
            }
        });
        callback(requests);
    });
};

// ============================================================
// RATING
// ============================================================

/**
 * Submit rating for completed request
 */
export const submitRating = async (
    requestId: string,
    rating: number,
    feedback?: string
): Promise<boolean> => {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            rating,
            feedback: feedback || null,
            ratedAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Rating error:', error);
        return false;
    }
};

// ============================================================
// GUEST ACTIVITY LOG
// ============================================================

/**
 * Log guest activity
 */
export const logGuestActivity = async (
    action: string,
    room: string,
    branch: string,
    guestName?: string,
    guestIdentity?: string,
    details: Record<string, any> = {}
): Promise<void> => {
    try {
        await addDoc(collection(db, 'guestLogs'), {
            roomNumber: room,
            branch: branch || 'main',
            guestName: guestName || null,
            guestIdentity: guestIdentity || null,
            action,
            details,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Log error:', error);
    }
};

// ============================================================
// COFFEE SHOP / ROOM SERVICE
// ============================================================

/**
 * Load menu items
 */
export const loadMenuItems = async (
    hotelId: string,
    branchId: string,
    category?: string
): Promise<MenuItem[]> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        let menuQuery = query(
            collection(db, `tenants/${hotelId}/branches/${branchId}/menu`),
            where('available', '==', true)
        );

        if (category) {
            menuQuery = query(
                menuQuery,
                where('category', '==', category)
            );
        }

        const snapshot = await getDocs(menuQuery);
        const items: MenuItem[] = [];

        snapshot.forEach(doc => {
            items.push({
                id: doc.id,
                ...doc.data()
            } as MenuItem);
        });

        return items;
    } catch (error) {
        console.error('Error loading menu:', error);
        return [];
    }
};

/**
 * Submit room service order
 */
export const submitRoomServiceOrder = async (
    room: string,
    branch: string,
    guestName: string,
    guestIdentity: string,
    verifyType: string,
    items: { id: string; name: string; quantity: number; price: number }[],
    notes?: string
): Promise<string | null> => {
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return submitRequest('room_service', room, branch, guestName, guestIdentity, verifyType, {
        items,
        total,
        notes: notes || null
    });
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format time
 */
export const formatTime = (timestamp: any): string => {
    if (!timestamp) return '--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Get status step number
 */
export const getStatusStep = (status: string): number => {
    return STATUS_STEPS[status] || 1;
};

/**
 * Check if request is completed
 */
export const isRequestCompleted = (status: string): boolean => {
    return status === 'COMPLETED';
};

// ============================================================
// BRANCH SETTINGS
// ============================================================

/**
 * Load branch settings
 */
export const loadBranchSettings = async (
    branchId: string
): Promise<BranchSettings | null> => {
    try {
        const settingsRef = doc(db, `branches/${branchId}/settings/general`);
        const settingsDoc = await getDoc(settingsRef);

        if (settingsDoc.exists()) {
            return settingsDoc.data() as BranchSettings;
        }
        return null;
    } catch (error) {
        console.error('Error loading branch settings:', error);
        return null;
    }
};

// ============================================================
// INPUT VALIDATION
// ============================================================

/**
 * Validate guest name (letters only)
 */
export const validateGuestName = (name: string): boolean => {
    if (!name || name.trim().length < 2) {
        return false;
    }
    // Remove numbers from name
    const cleanName = name.replace(/[0-9٠-٩]/g, '').trim();
    return cleanName.length >= 2;
};

/**
 * Validate identity/phone number
 */
export const validateIdentity = (value: string): boolean => {
    // Just check that it's not empty and has at least 3 digits
    const cleanValue = value.replace(/[^0-9]/g, '');
    return cleanValue.length >= 3;
};

/**
 * Clean identity input (numbers only)
 */
export const cleanIdentityInput = (value: string): string => {
    return value.replace(/[^0-9]/g, '');
};

/**
 * Clean name input (no numbers)
 */
export const cleanNameInput = (value: string): string => {
    return value.replace(/[0-9٠-٩]/g, '');
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // URL & Room
    extractRoomFromURL,

    // Session
    saveSession,
    getSession,
    clearSession,
    isSessionValid,

    // Verification
    verifyActiveRoomCard,

    // Greeting
    getTimeBasedGreeting,
    getPersonalizedGreeting,

    // Department Hours
    isDepartmentOpen,
    getWhatsAppLink,

    // Requests
    submitRequest,
    subscribeToRequest,
    subscribeToActiveRequests,

    // Rating
    submitRating,

    // Logging
    logGuestActivity,

    // Menu
    loadMenuItems,
    submitRoomServiceOrder,

    // Settings
    loadBranchSettings,

    // Validation
    validateGuestName,
    validateIdentity,
    cleanIdentityInput,
    cleanNameInput,

    // Utils
    formatTime,
    getStatusStep,
    isRequestCompleted,
    getServiceName
};
