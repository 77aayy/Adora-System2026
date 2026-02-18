/**
 * Guest Tour Service
 * Manages the introductory tour for guests (shown only 2 times)
 * 
 * Features:
 * - Track tour completion per room session
 * - Limit to 2 tours per guest session
 * - Reset on new check-in
 * 
 * Adora Hotel Management System V3
 */

import { logger } from './loggerService';

// ============================================================
// CONSTANTS
// ============================================================

const TOUR_STORAGE_KEY = 'adora_guest_tour';
const MAX_TOUR_VIEWS = 2;

// ============================================================
// TYPES
// ============================================================

interface GuestTourData {
    roomNumber: string;
    branchId: string;
    tourViewCount: number;
    lastViewedAt: string;
    completedAt?: string;
    deviceId: string;
}

// ============================================================
// DEVICE ID GENERATION
// ============================================================

const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('adora_device_id');
    if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('adora_device_id', deviceId);
    }
    return deviceId;
};

// ============================================================
// TOUR DATA MANAGEMENT
// ============================================================

/**
 * Get tour data for a specific room
 */
export const getGuestTourData = (roomNumber: string, branchId: string): GuestTourData | null => {
    try {
        const key = `${TOUR_STORAGE_KEY}_${branchId}_${roomNumber}`;
        const data = localStorage.getItem(key);
        if (!data) return null;
        return JSON.parse(data) as GuestTourData;
    } catch {
        return null;
    }
};

/**
 * Save tour data for a specific room
 */
const saveTourData = (data: GuestTourData): void => {
    try {
        const key = `${TOUR_STORAGE_KEY}_${data.branchId}_${data.roomNumber}`;
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        logger.error('Error saving tour data:', error, 'guestTourService');
    }
};

/**
 * Check if tour should be shown to guest
 */
export const shouldShowGuestTour = (roomNumber: string, branchId: string): boolean => {
    const tourData = getGuestTourData(roomNumber, branchId);
    
    if (!tourData) {
        // First visit - show tour
        return true;
    }
    
    // Check if tour has been viewed less than MAX_TOUR_VIEWS times
    return tourData.tourViewCount < MAX_TOUR_VIEWS;
};

/**
 * Record that tour was viewed
 * Returns the updated view count
 */
export const recordTourView = (roomNumber: string, branchId: string): number => {
    const deviceId = getDeviceId();
    const existing = getGuestTourData(roomNumber, branchId);
    
    const newData: GuestTourData = {
        roomNumber,
        branchId,
        tourViewCount: (existing?.tourViewCount || 0) + 1,
        lastViewedAt: new Date().toISOString(),
        deviceId
    };
    
    saveTourData(newData);
    return newData.tourViewCount;
};

/**
 * Mark tour as completed (user clicked "Got it" or finished tour)
 */
export const completeTour = (roomNumber: string, branchId: string): void => {
    const deviceId = getDeviceId();
    const existing = getGuestTourData(roomNumber, branchId);
    
    const newData: GuestTourData = {
        roomNumber,
        branchId,
        tourViewCount: MAX_TOUR_VIEWS, // Mark as max views to stop showing
        lastViewedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        deviceId
    };
    
    saveTourData(newData);
};

/**
 * Skip tour for this session
 */
export const skipTour = (roomNumber: string, branchId: string): number => {
    return recordTourView(roomNumber, branchId);
};

/**
 * Get remaining tour views
 */
export const getRemainingTourViews = (roomNumber: string, branchId: string): number => {
    const tourData = getGuestTourData(roomNumber, branchId);
    if (!tourData) return MAX_TOUR_VIEWS;
    return Math.max(0, MAX_TOUR_VIEWS - tourData.tourViewCount);
};

/**
 * Reset tour for a room (called on new check-in)
 */
export const resetRoomTour = (roomNumber: string, branchId: string): void => {
    try {
        const key = `${TOUR_STORAGE_KEY}_${branchId}_${roomNumber}`;
        localStorage.removeItem(key);
    } catch (error) {
        logger.error('Error resetting tour data:', error, 'guestTourService');
    }
};

/**
 * Clear all tour data (for debugging)
 */
export const clearAllTourData = (): void => {
    try {
        const keys = Object.keys(localStorage).filter(key => key.startsWith(TOUR_STORAGE_KEY));
        keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
        logger.error('Error clearing tour data:', error, 'guestTourService');
    }
};

// ============================================================
// TOUR STEPS CONFIGURATION
// ============================================================

export interface TourStep {
    id: string;
    title: string;
    description: string;
    icon: string;
    targetSelector?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export const GUEST_TOUR_STEPS: TourStep[] = [
    {
        id: 'welcome',
        title: 'مرحباً بك! 👋',
        description: 'هذه بوابة خدمات الغرف الذكية. يمكنك طلب أي خدمة من هاتفك مباشرة.',
        icon: '🏨',
        position: 'center'
    },
    {
        id: 'services',
        title: 'الخدمات المتاحة 🛎️',
        description: 'اضغط على أي خدمة لطلبها: القهوة، التنظيف، الصيانة، والمزيد.',
        icon: '☕',
        targetSelector: '.services-grid',
        position: 'bottom'
    },
    {
        id: 'request',
        title: 'كيفية الطلب 📱',
        description: 'اختر الخدمة، أضف ملاحظاتك إن وجدت، ثم اضغط إرسال. سيصلك إشعار عند قبول الطلب.',
        icon: '✅',
        position: 'center'
    },
    {
        id: 'track',
        title: 'تتبع طلباتك 📍',
        description: 'يمكنك متابعة حالة طلبك في أي وقت من قائمة "طلباتي".',
        icon: '📋',
        targetSelector: '.my-orders-tab',
        position: 'bottom'
    },
    {
        id: 'help',
        title: 'تحتاج مساعدة؟ 🆘',
        description: 'تواصل مع الاستقبال مباشرة عبر زر "اتصل بالاستقبال" في أي وقت.',
        icon: '📞',
        position: 'center'
    }
];

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseGuestTourReturn {
    showTour: boolean;
    currentStep: number;
    totalSteps: number;
    remainingViews: number;
    nextStep: () => void;
    prevStep: () => void;
    skipTour: () => void;
    completeTour: () => void;
    steps: TourStep[];
}

export const useGuestTour = (roomNumber: string, branchId: string): UseGuestTourReturn => {
    const [showTour, setShowTour] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [remainingViews, setRemainingViews] = useState(MAX_TOUR_VIEWS);

    useEffect(() => {
        if (roomNumber && branchId) {
            const shouldShow = shouldShowGuestTour(roomNumber, branchId);
            const remaining = getRemainingTourViews(roomNumber, branchId);
            setShowTour(shouldShow);
            setRemainingViews(remaining);
            
            if (shouldShow) {
                recordTourView(roomNumber, branchId);
            }
        }
    }, [roomNumber, branchId]);

    const nextStep = useCallback(() => {
        if (currentStep < GUEST_TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            // Last step - complete tour
            completeTour(roomNumber, branchId);
            setShowTour(false);
        }
    }, [currentStep, roomNumber, branchId]);

    const prevStep = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    }, [currentStep]);

    const handleSkipTour = useCallback(() => {
        const newCount = skipTour(roomNumber, branchId);
        setRemainingViews(MAX_TOUR_VIEWS - newCount);
        setShowTour(false);
    }, [roomNumber, branchId]);

    const handleCompleteTour = useCallback(() => {
        completeTour(roomNumber, branchId);
        setRemainingViews(0);
        setShowTour(false);
    }, [roomNumber, branchId]);

    return {
        showTour,
        currentStep,
        totalSteps: GUEST_TOUR_STEPS.length,
        remainingViews,
        nextStep,
        prevStep,
        skipTour: handleSkipTour,
        completeTour: handleCompleteTour,
        steps: GUEST_TOUR_STEPS
    };
};

export default {
    shouldShowGuestTour,
    recordTourView,
    completeTour,
    skipTour,
    getRemainingTourViews,
    resetRoomTour,
    clearAllTourData,
    GUEST_TOUR_STEPS,
    useGuestTour
};
