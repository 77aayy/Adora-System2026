/**
 * Rewards System Service
 * Migrated from rewards-system.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Automated rewards calculation:
 * - Daily rewards for top performers
 * - Weekly rewards on Saturdays
 * - Monthly rewards on last day of month
 */

import { db } from './firebase';
import {
    collection, query, where, getDocs, getDoc,
    orderBy, limit, doc, updateDoc, addDoc,
    Timestamp, serverTimestamp, increment
} from 'firebase/firestore';
// import { getReasonText, EmployeeContext } from './pointsService';

// ============================================================
// TYPES
// ============================================================

export type RewardType = 'daily' | 'weekly' | 'monthly';

export interface RewardSettings {
    enabled: boolean;
    daily: number;
    weekly: number;
    monthly: number;
    dailyCount: number;
    weeklyCount: number;
    monthlyCount: number;
}

export interface RewardedEmployee {
    id: string;
    name: string;
    department?: string;
    periodPoints: number;
    totalPoints: number;
    rank: number;
    rewardPoints: number;
}

export interface RewardResult {
    daily: RewardedEmployee[];
    weekly: RewardedEmployee[];
    monthly: RewardedEmployee[];
    totalRewarded: number;
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

export const DEFAULT_REWARD_SETTINGS: RewardSettings = {
    enabled: true,
    daily: 10,
    weekly: 50,
    monthly: 200,
    dailyCount: 1,
    weeklyCount: 3,
    monthlyCount: 5
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get start of today
 */
const getStartOfToday = (): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

/**
 * Get start of week (Sunday)
 */
const getStartOfWeek = (): Date => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
};

/**
 * Get start of month
 */
const getStartOfMonth = (): Date => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
};

/**
 * Check if today is Saturday (end of week)
 */
const isSaturday = (): boolean => {
    return new Date().getDay() === 6;
};

/**
 * Check if today is last day of month
 */
const isLastDayOfMonth = (): boolean => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return today.getDate() === lastDay.getDate();
};

// ============================================================
// REWARD SETTINGS
// ============================================================

/**
 * Load reward settings from Firestore
 */
export const loadRewardSettings = async (
    hotelId: string,
    branchId: string
): Promise<RewardSettings> => {
    try {
        // ✅ SaaS FIX: Use 'tenants' collection
        const branchDoc = await getDoc(
            doc(db, `tenants/${hotelId}/branches/${branchId}`)
        );

        if (branchDoc.exists()) {
            const data = branchDoc.data();
            return data.rewardsSettings || DEFAULT_REWARD_SETTINGS;
        }
    } catch (error) {
        console.error('Error loading reward settings:', error);
    }

    return DEFAULT_REWARD_SETTINGS;
};

// ============================================================
// DAILY REWARDS
// ============================================================

/**
 * Calculate daily rewards
 */
export const calculateDailyRewards = async (
    hotelId: string,
    branchId: string
): Promise<RewardedEmployee[]> => {
    try {
        const settings = await loadRewardSettings(hotelId, branchId);

        if (!settings.enabled) {
            return [];
        }

        const today = getStartOfToday();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${hotelId}/branches/${branchId}/employees`;
        const employeesQuery = query(
            collection(db, basePath),
            where('active', '!=', false)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: { id: string; name: string; department: string; todayPoints: number; totalPoints: number }[] = [];

        for (const empDoc of snapshot.docs) {
            const empData = empDoc.data();

            // Get today's points
            const pointsQuery = query(
                collection(empDoc.ref, 'pointsHistory'),
                where('timestamp', '>=', Timestamp.fromDate(today)),
                where('timestamp', '<', Timestamp.fromDate(tomorrow))
            );

            const pointsSnapshot = await getDocs(pointsQuery);
            let todayPoints = 0;

            pointsSnapshot.forEach(doc => {
                todayPoints += doc.data().points || 0;
            });

            if (todayPoints > 0) {
                employees.push({
                    id: empDoc.id,
                    name: empData.name || empData.employeeName || 'Unknown',
                    department: empData.department,
                    todayPoints,
                    totalPoints: empData.kpi_points || 0
                });
            }
        }

        // Sort by today's points
        employees.sort((a, b) => b.todayPoints - a.todayPoints);

        // Select top performers
        const topCount = settings.dailyCount || 1;
        const winners = employees.slice(0, topCount);
        const rewardPoints = settings.daily || 10;
        const rewarded: RewardedEmployee[] = [];

        for (let i = 0; i < winners.length; i++) {
            const winner = winners[i];

            // Check if already rewarded today
            const rewardCheckQuery = query(
                collection(db, `${basePath}/${winner.id}/pointsHistory`),
                where('action', '==', 'daily_reward'),
                where('timestamp', '>=', Timestamp.fromDate(today)),
                where('timestamp', '<', Timestamp.fromDate(tomorrow))
            );

            const rewardCheck = await getDocs(rewardCheckQuery);

            if (rewardCheck.empty) {
                // Add reward
                const employeeRef = doc(db, basePath, winner.id);

                await updateDoc(employeeRef, {
                    kpi_points: increment(rewardPoints)
                });

                await addDoc(collection(employeeRef, 'pointsHistory'), {
                    action: 'daily_reward',
                    points: rewardPoints,
                    reason: 'مكافأة الأداء اليومي',
                    details: {
                        todayPoints: winner.todayPoints,
                        rank: i + 1
                    },
                    timestamp: serverTimestamp(),
                    employeeId: winner.id,
                    employeeName: winner.name
                });

                rewarded.push({
                    id: winner.id,
                    name: winner.name,
                    department: winner.department,
                    periodPoints: winner.todayPoints,
                    totalPoints: winner.totalPoints + rewardPoints,
                    rank: i + 1,
                    rewardPoints
                });
            }
        }

        return rewarded;
    } catch (error) {
        console.error('Error calculating daily rewards:', error);
        return [];
    }
};

// ============================================================
// WEEKLY REWARDS
// ============================================================

/**
 * Calculate weekly rewards (applies on Saturday)
 */
export const calculateWeeklyRewards = async (
    hotelId: string,
    branchId: string
): Promise<RewardedEmployee[]> => {
    if (!isSaturday()) {
        return [];
    }

    try {
        const settings = await loadRewardSettings(hotelId, branchId);

        if (!settings.enabled) {
            return [];
        }

        const startOfWeek = getStartOfWeek();
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${hotelId}/branches/${branchId}/employees`;

        const employeesQuery = query(
            collection(db, basePath),
            where('active', '!=', false)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: { id: string; name: string; department: string; weekPoints: number; totalPoints: number }[] = [];

        for (const empDoc of snapshot.docs) {
            const empData = empDoc.data();

            // Get this week's points
            const pointsQuery = query(
                collection(empDoc.ref, 'pointsHistory'),
                where('timestamp', '>=', Timestamp.fromDate(startOfWeek))
            );

            const pointsSnapshot = await getDocs(pointsQuery);
            let weekPoints = 0;

            pointsSnapshot.forEach(doc => {
                weekPoints += doc.data().points || 0;
            });

            if (weekPoints > 0) {
                employees.push({
                    id: empDoc.id,
                    name: empData.name || empData.employeeName || 'Unknown',
                    department: empData.department,
                    weekPoints,
                    totalPoints: empData.kpi_points || 0
                });
            }
        }

        // Sort by week points
        employees.sort((a, b) => b.weekPoints - a.weekPoints);

        // Select top performers
        const topCount = settings.weeklyCount || 3;
        const winners = employees.slice(0, topCount);
        const rewardPoints = settings.weekly || 50;
        const rewarded: RewardedEmployee[] = [];

        for (let i = 0; i < winners.length; i++) {
            const winner = winners[i];

            // Check if already rewarded this week
            const rewardCheckQuery = query(
                collection(db, `${basePath}/${winner.id}/pointsHistory`),
                where('action', '==', 'weekly_reward'),
                where('timestamp', '>=', Timestamp.fromDate(startOfWeek))
            );

            const rewardCheck = await getDocs(rewardCheckQuery);

            if (rewardCheck.empty) {
                // Add reward
                const employeeRef = doc(db, basePath, winner.id);

                await updateDoc(employeeRef, {
                    kpi_points: increment(rewardPoints)
                });

                await addDoc(collection(employeeRef, 'pointsHistory'), {
                    action: 'weekly_reward',
                    points: rewardPoints,
                    reason: 'مكافأة الأداء الأسبوعي',
                    details: {
                        weekPoints: winner.weekPoints,
                        rank: i + 1
                    },
                    timestamp: serverTimestamp(),
                    employeeId: winner.id,
                    employeeName: winner.name
                });

                rewarded.push({
                    id: winner.id,
                    name: winner.name,
                    department: winner.department,
                    periodPoints: winner.weekPoints,
                    totalPoints: winner.totalPoints + rewardPoints,
                    rank: i + 1,
                    rewardPoints
                });
            }
        }

        return rewarded;
    } catch (error) {
        console.error('Error calculating weekly rewards:', error);
        return [];
    }
};

// ============================================================
// MONTHLY REWARDS
// ============================================================

/**
 * Calculate monthly rewards (applies on last day of month)
 */
export const calculateMonthlyRewards = async (
    hotelId: string,
    branchId: string
): Promise<RewardedEmployee[]> => {
    if (!isLastDayOfMonth()) {
        return [];
    }

    try {
        const settings = await loadRewardSettings(hotelId, branchId);

        if (!settings.enabled) {
            return [];
        }

        const startOfMonth = getStartOfMonth();
        // ✅ SaaS FIX: Use 'tenants' collection
        const basePath = `tenants/${hotelId}/branches/${branchId}/employees`;

        const employeesQuery = query(
            collection(db, basePath),
            where('active', '!=', false)
        );

        const snapshot = await getDocs(employeesQuery);
        const employees: { id: string; name: string; department: string; monthPoints: number; totalPoints: number }[] = [];

        for (const empDoc of snapshot.docs) {
            const empData = empDoc.data();

            // Get this month's points
            const pointsQuery = query(
                collection(empDoc.ref, 'pointsHistory'),
                where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
            );

            const pointsSnapshot = await getDocs(pointsQuery);
            let monthPoints = 0;

            pointsSnapshot.forEach(doc => {
                monthPoints += doc.data().points || 0;
            });

            if (monthPoints > 0) {
                employees.push({
                    id: empDoc.id,
                    name: empData.name || empData.employeeName || 'Unknown',
                    department: empData.department,
                    monthPoints,
                    totalPoints: empData.kpi_points || 0
                });
            }
        }

        // Sort by month points
        employees.sort((a, b) => b.monthPoints - a.monthPoints);

        // Select top performers
        const topCount = settings.monthlyCount || 5;
        const winners = employees.slice(0, topCount);
        const rewardPoints = settings.monthly || 200;
        const rewarded: RewardedEmployee[] = [];

        for (let i = 0; i < winners.length; i++) {
            const winner = winners[i];

            // Check if already rewarded this month
            const rewardCheckQuery = query(
                collection(db, `${basePath}/${winner.id}/pointsHistory`),
                where('action', '==', 'monthly_reward'),
                where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
            );

            const rewardCheck = await getDocs(rewardCheckQuery);

            if (rewardCheck.empty) {
                // Add reward
                const employeeRef = doc(db, basePath, winner.id);

                await updateDoc(employeeRef, {
                    kpi_points: increment(rewardPoints)
                });

                await addDoc(collection(employeeRef, 'pointsHistory'), {
                    action: 'monthly_reward',
                    points: rewardPoints,
                    reason: 'مكافأة الأداء الشهري',
                    details: {
                        monthPoints: winner.monthPoints,
                        rank: i + 1
                    },
                    timestamp: serverTimestamp(),
                    employeeId: winner.id,
                    employeeName: winner.name
                });

                rewarded.push({
                    id: winner.id,
                    name: winner.name,
                    department: winner.department,
                    periodPoints: winner.monthPoints,
                    totalPoints: winner.totalPoints + rewardPoints,
                    rank: i + 1,
                    rewardPoints
                });
            }
        }

        return rewarded;
    } catch (error) {
        console.error('Error calculating monthly rewards:', error);
        return [];
    }
};

// ============================================================
// APPLY ALL REWARDS
// ============================================================

/**
 * Apply all applicable rewards
 */
export const applyAllRewards = async (
    hotelId: string,
    branchId: string
): Promise<RewardResult> => {
    const [daily, weekly, monthly] = await Promise.all([
        calculateDailyRewards(hotelId, branchId),
        calculateWeeklyRewards(hotelId, branchId),
        calculateMonthlyRewards(hotelId, branchId)
    ]);

    return {
        daily,
        weekly,
        monthly,
        totalRewarded: daily.length + weekly.length + monthly.length
    };
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

interface UseRewardsReturn {
    result: RewardResult | null;
    loading: boolean;
    error: string | null;
    applyRewards: () => Promise<void>;
}

export const useRewards = (hotelId: string, branchId: string): UseRewardsReturn => {
    const [result, setResult] = useState<RewardResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const applyRewards = useCallback(async () => {
        if (!hotelId || !branchId) return;

        setLoading(true);
        setError(null);

        try {
            const rewardResult = await applyAllRewards(hotelId, branchId);
            setResult(rewardResult);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تطبيق المكافآت');
        } finally {
            setLoading(false);
        }
    }, [hotelId, branchId]);

    return {
        result,
        loading,
        error,
        applyRewards
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Settings
    DEFAULT_REWARD_SETTINGS,
    loadRewardSettings,

    // Calculations
    calculateDailyRewards,
    calculateWeeklyRewards,
    calculateMonthlyRewards,
    applyAllRewards,

    // Helpers
    isSaturday,
    isLastDayOfMonth,

    // Hook
    useRewards
};
