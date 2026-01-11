/**
 * Onboarding Tour Service
 * Tracks user onboarding status in Firestore
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

export interface OnboardingStatus {
    userId: string;
    completedTours: {
        reception?: Timestamp;
        housekeeping?: Timestamp;
        bellman?: Timestamp;
        maintenance?: Timestamp;
        procurement?: Timestamp;
        coffeeshop?: Timestamp;
        admin?: Timestamp;
    };
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export type DepartmentTour = 
    | 'reception' 
    | 'housekeeping' 
    | 'bellman' 
    | 'maintenance' 
    | 'procurement' 
    | 'coffeeshop' 
    | 'admin';

// ============================================================
// SERVICE FUNCTIONS
// ============================================================

/**
 * Check if user has completed tour for a specific department
 */
export const hasCompletedTour = async (
    userId: string,
    department: DepartmentTour
): Promise<boolean> => {
    try {
        const docRef = doc(db, 'onboardingStatus', userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return false;
        }

        const data = docSnap.data() as OnboardingStatus;
        return !!data.completedTours?.[department];
    } catch (error) {
        console.error('Error checking tour status:', error);
        // Fallback to localStorage if Firestore fails
        const localKey = `adora_tour_${department}_${userId}`;
        return localStorage.getItem(localKey) === 'true';
    }
};

/**
 * Mark tour as completed for a specific department
 */
export const markTourCompleted = async (
    userId: string,
    department: DepartmentTour
): Promise<void> => {
    try {
        const docRef = doc(db, 'onboardingStatus', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Update existing document
            await updateDoc(docRef, {
                [`completedTours.${department}`]: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        } else {
            // Create new document
            await setDoc(docRef, {
                userId,
                completedTours: {
                    [department]: Timestamp.now()
                },
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
        }

        // Also save to localStorage as backup
        const localKey = `adora_tour_${department}_${userId}`;
        localStorage.setItem(localKey, 'true');
    } catch (error) {
        console.error('Error marking tour completed:', error);
        // Fallback to localStorage
        const localKey = `adora_tour_${department}_${userId}`;
        localStorage.setItem(localKey, 'true');
    }
};

/**
 * Reset all tours for a user (useful for testing)
 */
export const resetAllTours = async (userId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'onboardingStatus', userId);
        await setDoc(docRef, {
            userId,
            completedTours: {},
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        });

        // Clear localStorage too
        const departments: DepartmentTour[] = [
            'reception', 'housekeeping', 'bellman', 
            'maintenance', 'procurement', 'coffeeshop', 'admin'
        ];
        departments.forEach(dept => {
            localStorage.removeItem(`adora_tour_${dept}_${userId}`);
        });
    } catch (error) {
        console.error('Error resetting tours:', error);
    }
};

/**
 * Get all completed tours for a user
 */
export const getCompletedTours = async (
    userId: string
): Promise<Partial<Record<DepartmentTour, boolean>>> => {
    try {
        const docRef = doc(db, 'onboardingStatus', userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return {};
        }

        const data = docSnap.data() as OnboardingStatus;
        const result: Partial<Record<DepartmentTour, boolean>> = {};

        Object.keys(data.completedTours || {}).forEach(key => {
            if (data.completedTours[key as DepartmentTour]) {
                result[key as DepartmentTour] = true;
            }
        });

        return result;
    } catch (error) {
        console.error('Error getting completed tours:', error);
        return {};
    }
};
