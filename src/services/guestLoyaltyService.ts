/**
 * Guest Loyalty & Respect Score Service
 * نظام ولاء النزيل والتقييم العكسي
 * 
 * ✅ Features:
 * - Guest Digital Identity (phone-based)
 * - Respect Score (worker rates guest)
 * - VIP/Attention Badge system
 * - Visit history tracking
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    increment,
    serverTimestamp,
    Timestamp,
    orderBy,
    limit
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface GuestProfile {
    id: string;
    phone: string;
    name?: string;
    firstName?: string;
    respectScore: number;
    totalVisits: number;
    totalLikes: number;
    totalDislikes: number;
    lastVisit?: Timestamp;
    firstVisit?: Timestamp;
    notes?: string;
    vipLevel: 'new' | 'regular' | 'silver' | 'gold' | 'platinum';
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface GuestRating {
    id?: string;
    guestId: string;
    guestPhone: string;
    roomNumber: string;
    requestId: string;
    requestType: string;
    workerId: string;
    workerName: string;
    workerDepartment: string;
    rating: 'like' | 'dislike';
    reason?: string;
    createdAt: Timestamp;
}

export interface GuestVisit {
    id?: string;
    guestId: string;
    roomNumber: string;
    checkIn: Timestamp;
    checkOut?: Timestamp;
    totalRequests: number;
    averageRating?: number;
    notes?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const LIKE_POINTS = 1;      // نقطة واحدة للايك
const DISLIKE_POINTS = -5;  // خصم 5 نقاط للديسلايك

// VIP Levels based on Respect Score
const VIP_THRESHOLDS = {
    platinum: 50,   // 50+ نقطة
    gold: 30,       // 30-49 نقطة
    silver: 15,     // 15-29 نقطة
    regular: 5,     // 5-14 نقطة
    new: 0          // أقل من 5
};

// ============================================================
// GUEST IDENTITY FUNCTIONS
// ============================================================

/**
 * Find or create guest by phone number
 * البحث عن النزيل بالجوال أو إنشاء ملف جديد
 */
export async function findOrCreateGuest(
    tenantId: string,
    phone: string,
    name?: string,
    firstName?: string
): Promise<GuestProfile> {
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    
    // Search for existing guest
    const guestsRef = collection(db, `tenants/${tenantId}/guests`);
    const q = query(guestsRef, where('phone', '==', normalizedPhone), limit(1));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
        // Returning guest! 🎉
        const guestDoc = snapshot.docs[0];
        const guestData = guestDoc.data() as GuestProfile;
        
        // Update last visit
        await updateDoc(guestDoc.ref, {
            lastVisit: serverTimestamp(),
            totalVisits: increment(1),
            updatedAt: serverTimestamp(),
            ...(name && { name }),
            ...(firstName && { firstName })
        });
        
        return {
            ...guestData,
            id: guestDoc.id,
            totalVisits: guestData.totalVisits + 1
        };
    }
    
    // New guest - create profile
    const newGuest: Omit<GuestProfile, 'id'> = {
        phone: normalizedPhone,
        name: name || '',
        firstName: firstName || '',
        respectScore: 0,
        totalVisits: 1,
        totalLikes: 0,
        totalDislikes: 0,
        vipLevel: 'new',
        firstVisit: Timestamp.now(),
        lastVisit: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    };
    
    const docRef = await addDoc(guestsRef, newGuest);
    
    return {
        ...newGuest,
        id: docRef.id
    };
}

/**
 * Get guest by ID
 */
export async function getGuestById(
    tenantId: string,
    guestId: string
): Promise<GuestProfile | null> {
    const guestRef = doc(db, `tenants/${tenantId}/guests/${guestId}`);
    const guestSnap = await getDoc(guestRef);
    
    if (!guestSnap.exists()) return null;
    
    return {
        id: guestSnap.id,
        ...guestSnap.data()
    } as GuestProfile;
}

/**
 * Get guest by phone
 */
export async function getGuestByPhone(
    tenantId: string,
    phone: string
): Promise<GuestProfile | null> {
    const normalizedPhone = normalizePhone(phone);
    const guestsRef = collection(db, `tenants/${tenantId}/guests`);
    const q = query(guestsRef, where('phone', '==', normalizedPhone), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const guestDoc = snapshot.docs[0];
    return {
        id: guestDoc.id,
        ...guestDoc.data()
    } as GuestProfile;
}

/**
 * Normalize phone number (remove spaces, dashes, etc.)
 */
function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '').trim();
}

// ============================================================
// RESPECT SCORE FUNCTIONS
// ============================================================

/**
 * Rate guest (called by worker after task completion)
 * تقييم النزيل من العامل بعد إنهاء المهمة
 */
export async function rateGuest(
    tenantId: string,
    rating: Omit<GuestRating, 'id' | 'createdAt'>
): Promise<{ success: boolean; newScore?: number; message: string }> {
    try {
        // 1. Save rating record
        const ratingsRef = collection(db, `tenants/${tenantId}/guest_ratings`);
        await addDoc(ratingsRef, {
            ...rating,
            createdAt: serverTimestamp()
        });
        
        // 2. Update guest score
        const guestRef = doc(db, `tenants/${tenantId}/guests/${rating.guestId}`);
        const points = rating.rating === 'like' ? LIKE_POINTS : DISLIKE_POINTS;
        
        const updateData: any = {
            respectScore: increment(points),
            updatedAt: serverTimestamp()
        };
        
        if (rating.rating === 'like') {
            updateData.totalLikes = increment(1);
        } else {
            updateData.totalDislikes = increment(1);
        }
        
        await updateDoc(guestRef, updateData);
        
        // 3. Get updated score and recalculate VIP level
        const updatedGuest = await getDoc(guestRef);
        const newScore = updatedGuest.data()?.respectScore || 0;
        const newVipLevel = calculateVipLevel(newScore);
        
        // Update VIP level if changed
        await updateDoc(guestRef, { vipLevel: newVipLevel });
        
        return {
            success: true,
            newScore,
            message: rating.rating === 'like' 
                ? '✅ شكراً على تقييمك' 
                : '⚠️ تم تسجيل الملاحظة'
        };
    } catch (error) {
        logger.error('Error rating guest:', error, 'guestLoyaltyService');
        return {
            success: false,
            message: '❌ فشل تسجيل التقييم'
        };
    }
}

/**
 * Calculate VIP level based on respect score
 */
export function calculateVipLevel(score: number): GuestProfile['vipLevel'] {
    if (score >= VIP_THRESHOLDS.platinum) return 'platinum';
    if (score >= VIP_THRESHOLDS.gold) return 'gold';
    if (score >= VIP_THRESHOLDS.silver) return 'silver';
    if (score >= VIP_THRESHOLDS.regular) return 'regular';
    return 'new';
}

/**
 * Get VIP badge info for display
 */
export function getVipBadgeInfo(vipLevel: GuestProfile['vipLevel'], score: number): {
    label: string;
    labelAr: string;
    color: string;
    bgColor: string;
    icon: string;
    isWarning: boolean;
} {
    // Warning for very low scores
    if (score < -10) {
        return {
            label: 'Needs Attention',
            labelAr: '⚠️ يحتاج عناية',
            color: 'text-red-400',
            bgColor: 'bg-red-500/20',
            icon: '⚠️',
            isWarning: true
        };
    }
    
    switch (vipLevel) {
        case 'platinum':
            return {
                label: 'Platinum VIP',
                labelAr: 'نزيل بلاتيني',
                color: 'text-purple-400',
                bgColor: 'bg-gradient-to-r from-purple-500/30 to-pink-500/30',
                icon: '💎',
                isWarning: false
            };
        case 'gold':
            return {
                label: 'Gold VIP',
                labelAr: 'نزيل ذهبي',
                color: 'text-amber-400',
                bgColor: 'bg-gradient-to-r from-amber-500/30 to-yellow-500/30',
                icon: '⭐',
                isWarning: false
            };
        case 'silver':
            return {
                label: 'Silver',
                labelAr: 'نزيل فضي',
                color: 'text-slate-300',
                bgColor: 'bg-slate-500/20',
                icon: '🥈',
                isWarning: false
            };
        case 'regular':
            return {
                label: 'Regular',
                labelAr: 'نزيل دائم',
                color: 'text-teal-400',
                bgColor: 'bg-teal-500/20',
                icon: '✅',
                isWarning: false
            };
        default:
            return {
                label: 'New Guest',
                labelAr: 'نزيل جديد',
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/20',
                icon: '🆕',
                isWarning: false
            };
    }
}

// ============================================================
// GUEST LIST FOR MANAGER
// ============================================================

/**
 * Get guests for WhatsApp messaging (filtered)
 */
export async function getGuestsForMessaging(
    tenantId: string,
    filters: {
        minScore?: number;
        maxScore?: number;
        fromDate?: Date;
        toDate?: Date;
        vipLevels?: GuestProfile['vipLevel'][];
        limit?: number;
    } = {}
): Promise<GuestProfile[]> {
    const guestsRef = collection(db, `tenants/${tenantId}/guests`);
    
    // Build query constraints
    let constraints: any[] = [orderBy('lastVisit', 'desc')];
    
    if (filters.minScore !== undefined) {
        constraints.push(where('respectScore', '>=', filters.minScore));
    }
    
    if (filters.limit) {
        constraints.push(limit(filters.limit));
    }
    
    const q = query(guestsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    let guests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as GuestProfile[];
    
    // Additional client-side filtering
    if (filters.maxScore !== undefined) {
        guests = guests.filter(g => g.respectScore <= filters.maxScore!);
    }
    
    if (filters.vipLevels?.length) {
        guests = guests.filter(g => filters.vipLevels!.includes(g.vipLevel));
    }
    
    if (filters.fromDate) {
        guests = guests.filter(g => {
            const lastVisit = g.lastVisit?.toDate();
            return lastVisit && lastVisit >= filters.fromDate!;
        });
    }
    
    if (filters.toDate) {
        guests = guests.filter(g => {
            const lastVisit = g.lastVisit?.toDate();
            return lastVisit && lastVisit <= filters.toDate!;
        });
    }
    
    return guests;
}

/**
 * Get this week's guests
 */
export async function getWeeklyGuests(tenantId: string): Promise<GuestProfile[]> {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return getGuestsForMessaging(tenantId, {
        fromDate: weekAgo,
        limit: 100
    });
}

// ============================================================
// WHATSAPP MESSAGING HELPERS
// ============================================================

/**
 * Generate WhatsApp message link
 */
export function generateWhatsAppLink(
    phone: string,
    message: string
): string {
    // Ensure phone starts with country code
    let formattedPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (formattedPhone.startsWith('05')) {
        formattedPhone = '966' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+') && !formattedPhone.startsWith('966')) {
        formattedPhone = '966' + formattedPhone;
    }
    formattedPhone = formattedPhone.replace('+', '');
    
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

/**
 * Get default message templates
 */
export function getMessageTemplates(): { id: string; name: string; template: string }[] {
    return [
        {
            id: 'thank_you',
            name: 'شكر على الزيارة',
            template: 'شكراً لزيارتكم فندق أدورا 🏨✨\nنتمنى أن تكون إقامتكم قد نالت رضاكم.\nننتظر عودتكم دائماً! 💫'
        },
        {
            id: 'vip_welcome',
            name: 'ترحيب VIP',
            template: 'أهلاً بعودتك يا ضيفنا الكريم! 🌟\nيسعدنا استضافتك مرة أخرى في فندق أدورا.\nلا تتردد في طلب أي خدمة خاصة. 💎'
        },
        {
            id: 'special_offer',
            name: 'عرض خاص',
            template: 'عرض خاص لضيوفنا المميزين! 🎁\nاحجز الآن واحصل على خصم 20% على إقامتك القادمة.\nالعرض ساري حتى نهاية الشهر.'
        },
        {
            id: 'feedback_request',
            name: 'طلب تقييم',
            template: 'نأمل أن إقامتك كانت مريحة 🏨\nنود سماع رأيك لتحسين خدماتنا.\nشكراً لثقتكم بفندق أدورا! ⭐'
        }
    ];
}

/**
 * Track sent message (for rate limiting)
 */
export async function trackSentMessage(
    tenantId: string,
    guestId: string,
    guestPhone: string,
    templateId: string,
    sentBy: string
): Promise<void> {
    const messagesRef = collection(db, `tenants/${tenantId}/sent_messages`);
    await addDoc(messagesRef, {
        guestId,
        guestPhone,
        templateId,
        sentBy,
        sentAt: serverTimestamp(),
        week: getWeekNumber()
    });
}

/**
 * Get sent messages count this week
 */
export async function getWeeklySentCount(tenantId: string): Promise<number> {
    const weekNumber = getWeekNumber();
    const messagesRef = collection(db, `tenants/${tenantId}/sent_messages`);
    const q = query(messagesRef, where('week', '==', weekNumber));
    const snapshot = await getDocs(q);
    return snapshot.size;
}

/**
 * Get current week number
 */
function getWeekNumber(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 604800000;
    const weekNum = Math.ceil(diff / oneWeek);
    return `${now.getFullYear()}-W${weekNum}`;
}

// ============================================================
// RECEPTION DASHBOARD HELPERS
// ============================================================

/**
 * Get active room guests with badges
 */
export async function getRoomGuestsWithBadges(
    tenantId: string,
    roomNumbers: string[]
): Promise<Map<string, { guest: GuestProfile; badge: ReturnType<typeof getVipBadgeInfo> } | null>> {
    const result = new Map();
    
    // This would need to be linked with room check-ins
    // For now, return empty map
    // Implementation depends on how rooms are linked to guests
    
    roomNumbers.forEach(room => {
        result.set(room, null);
    });
    
    return result;
}

export default {
    findOrCreateGuest,
    getGuestById,
    getGuestByPhone,
    rateGuest,
    calculateVipLevel,
    getVipBadgeInfo,
    getGuestsForMessaging,
    getWeeklyGuests,
    generateWhatsAppLink,
    getMessageTemplates,
    trackSentMessage,
    getWeeklySentCount
};
