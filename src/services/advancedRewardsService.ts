/**
 * Advanced Rewards System Service
 * Automated daily, weekly, and monthly rewards calculation
 * Adora Hotel Management System V2
 */

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    addDoc,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';

import { db } from './firebase';
import { awardPoints } from './pointsService';

// ============================================================
// TYPES
// ============================================================

export type RewardPeriod = 'daily' | 'weekly' | 'monthly';
export type RewardCategory = 'speed' | 'quality' | 'attendance' | 'overall';

export interface RewardWinner {
    employeeId: string;
    employeeName: string;
    department: string;
    category: RewardCategory;
    score: number;
    bonusPoints: number;
    rank: number;
}

export interface RewardResult {
    period: RewardPeriod;
    date: Date;
    winners: RewardWinner[];
    totalBonusAwarded: number;
}

export interface EmployeeStats {
    id: string;
    name: string;
    department: string;
    tasksCompleted: number;
    avgCompletionTime: number;
    pointsEarned: number;
    rating?: number;
}

// ============================================================
// REWARD CONFIGURATION
// ============================================================

const REWARD_CONFIG = {
    daily: {
        topCount: 3,
        bonusPoints: [50, 30, 20], // 1st, 2nd, 3rd
    },
    weekly: {
        topCount: 5,
        bonusPoints: [200, 150, 100, 75, 50],
    },
    monthly: {
        topCount: 10,
        bonusPoints: [500, 400, 300, 250, 200, 150, 100, 75, 50, 25],
    },
};

// ============================================================
// DAILY REWARDS
// ============================================================

/**
 * Calculate and apply daily rewards
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export async function calculateDailyRewards(
    hotelId: string,
    branchId: string,
    tenantId: string
): Promise<RewardResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all completed tasks for today
    const stats = await getEmployeeStats(hotelId, branchId, tenantId, today, tomorrow);

    // Sort by completed tasks (speed category)
    const rankedBySpeed = [...stats].sort((a, b) => b.tasksCompleted - a.tasksCompleted);

    const winners: RewardWinner[] = [];
    const config = REWARD_CONFIG.daily;

    rankedBySpeed.slice(0, config.topCount).forEach((employee, index) => {
        if (employee.tasksCompleted > 0) {
            winners.push({
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                category: 'speed',
                score: employee.tasksCompleted,
                bonusPoints: config.bonusPoints[index] || 0,
                rank: index + 1,
            });
        }
    });

    // Apply rewards
    await applyRewards(hotelId, branchId, winners, 'daily');

    return {
        period: 'daily',
        date: today,
        winners,
        totalBonusAwarded: winners.reduce((sum, w) => sum + w.bonusPoints, 0),
    };
}

// ============================================================
// WEEKLY REWARDS
// ============================================================

/**
 * Calculate and apply weekly rewards
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export async function calculateWeeklyRewards(
    hotelId: string,
    branchId: string,
    tenantId: string
): Promise<RewardResult> {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const stats = await getEmployeeStats(hotelId, branchId, tenantId, startOfWeek, endOfWeek);

    // Combined score: tasks + points - avg_time_penalty
    const rankedOverall = [...stats]
        .map(e => ({
            ...e,
            combinedScore: e.tasksCompleted * 10 + e.pointsEarned - (e.avgCompletionTime / 10),
        }))
        .sort((a, b) => b.combinedScore - a.combinedScore);

    const winners: RewardWinner[] = [];
    const config = REWARD_CONFIG.weekly;

    rankedOverall.slice(0, config.topCount).forEach((employee, index) => {
        if (employee.tasksCompleted > 0) {
            winners.push({
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                category: 'overall',
                score: Math.round(employee.combinedScore),
                bonusPoints: config.bonusPoints[index] || 0,
                rank: index + 1,
            });
        }
    });

    await applyRewards(hotelId, branchId, winners, 'weekly');

    return {
        period: 'weekly',
        date: startOfWeek,
        winners,
        totalBonusAwarded: winners.reduce((sum, w) => sum + w.bonusPoints, 0),
    };
}

// ============================================================
// MONTHLY REWARDS
// ============================================================

/**
 * Calculate and apply monthly rewards
 * ✅ SaaS: Added tenantId parameter for data isolation
 */
export async function calculateMonthlyRewards(
    hotelId: string,
    branchId: string,
    tenantId: string
): Promise<RewardResult> {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const stats = await getEmployeeStats(hotelId, branchId, tenantId, startOfMonth, endOfMonth);

    // Weighted score for monthly
    const rankedOverall = [...stats]
        .map(e => ({
            ...e,
            monthlyScore: (e.tasksCompleted * 5) + (e.pointsEarned * 0.5) + ((e.rating || 4) * 20),
        }))
        .sort((a, b) => b.monthlyScore - a.monthlyScore);

    const winners: RewardWinner[] = [];
    const config = REWARD_CONFIG.monthly;

    rankedOverall.slice(0, config.topCount).forEach((employee, index) => {
        if (employee.tasksCompleted >= 5) { // Minimum threshold
            winners.push({
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department,
                category: 'overall',
                score: Math.round(employee.monthlyScore),
                bonusPoints: config.bonusPoints[index] || 0,
                rank: index + 1,
            });
        }
    });

    await applyRewards(hotelId, branchId, winners, 'monthly');

    return {
        period: 'monthly',
        date: startOfMonth,
        winners,
        totalBonusAwarded: winners.reduce((sum, w) => sum + w.bonusPoints, 0),
    };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get employee statistics for a period
 */
async function getEmployeeStats(
    hotelId: string,
    branchId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date
): Promise<EmployeeStats[]> {
    const stats: Map<string, EmployeeStats> = new Map();

    try {
        const requestsRef = collection(db, 'requests');
        const q = query(
            requestsRef,
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('status', '==', 'COMPLETED'),
            where('completedAt', '>=', Timestamp.fromDate(startDate)),
            where('completedAt', '<', Timestamp.fromDate(endDate))
        );

        const snapshot = await getDocs(q);

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.completedBy?.id) return;

            const employeeId = data.completedBy.id;
            const existing = stats.get(employeeId) || {
                id: employeeId,
                name: data.completedBy.name || 'غير معروف',
                department: data.completedBy.department || '',
                tasksCompleted: 0,
                avgCompletionTime: 0,
                pointsEarned: 0,
            };

            const createdAt = data.createdAt?.toDate() || new Date();
            const completedAt = data.completedAt?.toDate() || new Date();
            const duration = (completedAt.getTime() - createdAt.getTime()) / (1000 * 60);

            existing.tasksCompleted++;
            existing.avgCompletionTime =
                (existing.avgCompletionTime * (existing.tasksCompleted - 1) + duration) / existing.tasksCompleted;
            existing.pointsEarned += data.pointsAwarded || 0;

            stats.set(employeeId, existing);
        });
    } catch (error) {
        console.error('Error getting employee stats:', error);
    }

    return Array.from(stats.values());
}

/**
 * Apply rewards to employees
 */
async function applyRewards(
    hotelId: string,
    branchId: string,
    winners: RewardWinner[],
    period: RewardPeriod
): Promise<void> {
    const batch: Promise<void>[] = [];

    for (const winner of winners) {
        // ✅ SaaS FIX: Use 'tenants' collection
        const employeeRef = doc(
            db,
            `tenants/${hotelId}/branches/${branchId}/employees`,
            winner.employeeId
        );

        batch.push(
            awardPoints(
                hotelId,
                winner.employeeId,
                winner.bonusPoints,
                `مكافأة ${period === 'daily' ? 'يومية' : period === 'weekly' ? 'أسبوعية' : 'شهرية'} (${winner.rank})`
            ).catch(err => console.error('Failed to award points via ledger:', err))
        );

        // Log the reward
        batch.push(
            addDoc(collection(db, 'rewards'), {
                hotelId,
                branchId,
                employeeId: winner.employeeId,
                employeeName: winner.employeeName,
                period,
                category: winner.category,
                rank: winner.rank,
                bonusPoints: winner.bonusPoints,
                score: winner.score,
                awardedAt: serverTimestamp(),
            }).then(() => { })
        );
    }

    await Promise.all(batch);
}

// ============================================================
// GET REWARDS HISTORY
// ============================================================

export interface RewardHistoryItem {
    id: string;
    employeeId: string;
    employeeName: string;
    period: RewardPeriod;
    category: RewardCategory;
    rank: number;
    bonusPoints: number;
    awardedAt: Date;
}

export async function getRewardsHistory(
    branchId: string,
    limit: number = 20
): Promise<RewardHistoryItem[]> {
    try {
        const rewardsRef = collection(db, 'rewards');
        const q = query(
            rewardsRef,
            where('branchId', '==', branchId)
        );

        const snapshot = await getDocs(q);

        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                awardedAt: doc.data().awardedAt?.toDate() || new Date(),
            } as RewardHistoryItem))
            .sort((a, b) => b.awardedAt.getTime() - a.awardedAt.getTime())
            .slice(0, limit);
    } catch (error) {
        console.error('Error getting rewards history:', error);
        return [];
    }
}

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export function useRewardsSystem(hotelId: string, branchId: string, tenantId: string) {
    const [loading, setLoading] = useState(false);
    const [lastResult, setLastResult] = useState<RewardResult | null>(null);

    const runDailyRewards = useCallback(async () => {
        setLoading(true);
        try {
            const result = await calculateDailyRewards(hotelId, branchId, tenantId);
            setLastResult(result);
            return result;
        } finally {
            setLoading(false);
        }
    }, [hotelId, branchId, tenantId]);

    const runWeeklyRewards = useCallback(async () => {
        setLoading(true);
        try {
            const result = await calculateWeeklyRewards(hotelId, branchId, tenantId);
            setLastResult(result);
            return result;
        } finally {
            setLoading(false);
        }
    }, [hotelId, branchId, tenantId]);

    const runMonthlyRewards = useCallback(async () => {
        setLoading(true);
        try {
            const result = await calculateMonthlyRewards(hotelId, branchId, tenantId);
            setLastResult(result);
            return result;
        } finally {
            setLoading(false);
        }
    }, [hotelId, branchId, tenantId]);

    return {
        loading,
        lastResult,
        runDailyRewards,
        runWeeklyRewards,
        runMonthlyRewards,
    };
}

export default {
    calculateDailyRewards,
    calculateWeeklyRewards,
    calculateMonthlyRewards,
    getRewardsHistory,
    useRewardsSystem,
};
