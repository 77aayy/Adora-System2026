/**
 * Rewards System Service
 * Gamification and employee rewards
 * Adora Hotel Management System V2
 *
 * SaaS/tenant: Uses tenants/${tenantId}/employees/${userId}/achievements; some paths may be
 * tenant-scoped. Unify all achievements/redemptions/streaks under tenant or document any mix.
 */

import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { awardAchievementPoints, deductPoints } from './pointsService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface Reward {
    id: string;
    name: string;
    description: string;
    pointsCost: number;
    category: 'voucher' | 'day_off' | 'bonus' | 'gift' | 'recognition';
    imageUrl?: string;
    available: boolean;
    quantity?: number;
    branch: string;
}

interface RewardRedemption {
    id?: string;
    rewardId: string;
    rewardName: string;
    userId: string;
    userName: string;
    pointsSpent: number;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    requestedAt: Timestamp;
    processedAt?: Timestamp;
    processedBy?: string;
    branch: string;
}

import { Achievement } from '../types';

interface EmployeeAchievement {
    achievementId: string;
    earnedAt: Timestamp;
}

interface Streak {
    userId: string;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
}

// ============================================================
// ACHIEVEMENTS
// ============================================================

// Hardcoded ACHIEVEMENTS removed in favor of Firestore


/**
 * Get all achievements (Dynamic from Firestore)
 */
export const getAllAchievements = async (tenantId: string): Promise<Achievement[]> => {
    try {
        // ✅ FIX: Order by requirement.value (points threshold) instead of points field
        // Achievements are ranked by their requirement threshold, not reward points
        const q = query(collection(db, `tenants/${tenantId}/achievements`), orderBy('requirement.value', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Achievement));
    } catch {
        // Fallback to empty if fails, but never hardcoded legacy array
        return [];
    }
};

/**
 * Get employee achievements (Tenant Scoped)
 */
export const getEmployeeAchievements = async (userId: string, tenantId?: string): Promise<EmployeeAchievement[]> => {
    try {
        // ✅ FIX: Use tenant-scoped path if tenantId provided, otherwise fallback to legacy
        if (tenantId) {
            const q = query(
                collection(db, `tenants/${tenantId}/employees/${userId}/achievements`),
                orderBy('earnedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ achievementId: d.data().achievementId, earnedAt: d.data().earnedAt } as EmployeeAchievement));
        } else {
            // Legacy fallback
            const q = query(
                collection(db, 'employeeAchievements'),
                where('userId', '==', userId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data()) as EmployeeAchievement[];
        }
    } catch {
        return [];
    }
};

/**
 * Award achievement to employee (Tenant Scoped)
 */
export const awardAchievement = async (
    tenantId: string,
    userId: string,
    achievementId: string
): Promise<boolean> => {
    try {
        const achievementRef = collection(db, `tenants/${tenantId}/employees/${userId}/achievements`);
        // ✅ FIX: Check if achievement already exists (prevent duplicates)
        const existingSnap = await getDocs(query(achievementRef, where('achievementId', '==', achievementId)));

        if (!existingSnap.empty) return false;

        // Fetch dedicated achievement definition from Firestore
        const achDoc = await getDocs(query(collection(db, `tenants/${tenantId}/achievements`), where('__name__', '==', achievementId))); // Firestore IDs are keys
        // or just getAllAchievements(tenantId)

        // Simpler: Fetch single doc
        // Note: achievementId passed here is expected to be the Document ID from Firestore

        // However, user logic might pass legacy IDs. 
        // For new system, we rely on Dynamic IDs.

        // Let's refactor:
        // We need the achievement details (name, points) to log it properly.

        let achievement: Achievement | undefined;
        // Try getting doc directly
        try {
            const docRef = doc(db, `tenants/${tenantId}/achievements`, achievementId);
            const docSnap = await getDocs(query(collection(db, `tenants/${tenantId}/achievements`))); // Wait, this is inefficient for single doc.
            // Actually getDoc is better
            // But we already have getAllAchievements above.

            // Let's assume the caller passes a valid Id
            // We just need to find it.
            const all = await getAllAchievements(tenantId);
            achievement = all.find(a => a.id === achievementId);

        } catch (e) { logger.error('Error getting achievement:', e, 'rewardsSystemService'); }

        if (!achievement) return false;

        // 1. Log achievement
        await addDoc(achievementRef, {
            achievementId,
            earnedAt: serverTimestamp()
        });

        // 2. Award points via Unified Ledger
        const prefix = achievement.category === 'rank' ? 'ترقية' : 'وسام';
        await awardAchievementPoints(tenantId, userId, achievement.name, achievement.pointsReward, prefix);

        return true;
    } catch (error) {
        logger.error('Failed to award achievement:', error, 'rewardsSystemService');
        return false;
    }
};

/**
 * Check and award achievements based on stats
 */
/**
 * Check and award achievements based on stats
 */
export const checkAchievements = async (
    userId: string,
    stats: { tasksCompleted?: number; totalPoints: number; streak?: number }
): Promise<Achievement[]> => {
    const newAchievements: Achievement[] = [];

    // 1. Get User Context (TenantID)
    let tenantId = '';
    try {
        const userDocs = await getDocs(query(collection(db, 'users'), where('id', '==', userId)));
        if (!userDocs.empty) {
            tenantId = userDocs.docs[0].data().tenantId;
        }
    } catch (e) { logger.error('Error getting tenantId:', e, 'rewardsSystemService'); }

    if (!tenantId) return [];

    // 2. Fetch User's Existing Achievements & All System Achievements
    // ✅ FIX: Pass tenantId to getEmployeeAchievements for correct path
    const [existing, dynamicAchievements] = await Promise.all([
        getEmployeeAchievements(userId, tenantId),
        getAllAchievements(tenantId)
    ]);

    // Map existing counts
    const achievementCounts: Record<string, number> = {};
    existing.forEach(a => {
        achievementCounts[a.achievementId] = (achievementCounts[a.achievementId] || 0) + 1;
    });

    for (const achievement of dynamicAchievements) {
        // ✅ FIX: Skip inactive or manual-only (0 points requirement)
        // Default to active=true if not specified (backward compatibility)
        if ((achievement.active === false) || !achievement.requirement || achievement.requirement.value <= 0) continue;

        let shouldAwardCount = 0;

        // 🟢 Logic 1: Points Threshold
        if (achievement.requirement.type === 'points') {
            const threshold = achievement.requirement.value;
            // Floor division determines how many "stacks" of this badge the user SHOULD have based on lifetime points
            const earnedCount = Math.floor(stats.totalPoints / threshold);
            const currentCount = achievementCounts[achievement.id] || 0;

            if (achievement.isRepeatable) {
                // If repeatable, award the difference
                if (earnedCount > currentCount) {
                    shouldAwardCount = earnedCount - currentCount;
                }
            } else {
                // If one-time, award only if not owned and threshold met
                if (currentCount === 0 && stats.totalPoints >= threshold) {
                    shouldAwardCount = 1;
                }
            }
        }

        // 🔵 Logic 2: Tasks/Streak (Future Expansion)
        // ...

        // 🎁 Execution: Award the determined number of times
        if (shouldAwardCount > 0) {
            logger.info(`🏆 Awarding ${shouldAwardCount}x ${achievement.name} to ${userId}`, undefined, 'rewardsSystemService');
            for (let i = 0; i < shouldAwardCount; i++) {
                await awardAchievement(tenantId, userId, achievement.id);
            }
            newAchievements.push(achievement);
        }
    }

    return newAchievements;
};

// ============================================================
// REWARDS
// ============================================================

/**
 * Get available rewards
 */
export const getAvailableRewards = async (branch: string): Promise<Reward[]> => {
    try {
        const q = query(
            collection(db, 'rewards'),
            where('branch', '==', branch),
            where('available', '==', true)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Reward[];
    } catch {
        return [];
    }
};

/**
 * Request reward redemption (Tenant Scoped & Unified Ledger)
 */
export const redeemReward = async (
    tenantId: string,
    rewardId: string,
    rewardName: string,
    userId: string,
    userName: string,
    pointsCost: number,
    branchId: string
): Promise<string | null> => {
    try {
        // 1. Deduct points via Unified Ledger (Handles insufficient funds safely)
        const success = await deductPoints(
            tenantId,
            userId,
            pointsCost,
            `صرف مكافأة: ${rewardName}`
        );

        if (!success) return null;

        // 2. Create redemption record
        const redemptionRef = collection(db, `tenants/${tenantId}/redemptions`);
        const docRef = await addDoc(redemptionRef, {
            rewardId,
            rewardName,
            userId,
            userName,
            pointsSpent: pointsCost,
            status: 'pending',
            requestedAt: serverTimestamp(),
            branchId
        });

        return docRef.id;
    } catch (error) {
        logger.error('Failed to redeem reward:', error, 'rewardsSystemService');
        return null;
    }
};

/**
 * Get user's redemptions
 */
export const getUserRedemptions = async (userId: string): Promise<RewardRedemption[]> => {
    try {
        const q = query(
            collection(db, 'rewardRedemptions'),
            where('userId', '==', userId),
            orderBy('requestedAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as RewardRedemption[];
    } catch {
        return [];
    }
};

/**
 * Get pending redemptions (admin)
 */
export const getPendingRedemptions = async (branch: string): Promise<RewardRedemption[]> => {
    try {
        const q = query(
            collection(db, 'rewardRedemptions'),
            where('branch', '==', branch),
            where('status', '==', 'pending')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as RewardRedemption[];
    } catch {
        return [];
    }
};

/**
 * Process redemption (approve/reject)
 */
export const processRedemption = async (
    redemptionId: string,
    status: 'approved' | 'rejected',
    processedBy: string
): Promise<void> => {
    await updateDoc(doc(db, 'rewardRedemptions', redemptionId), {
        status,
        processedAt: Timestamp.now(),
        processedBy
    });

    // If rejected, refund points
    if (status === 'rejected') {
        const redemption = await getDocs(query(collection(db, 'rewardRedemptions'), where('id', '==', redemptionId)));
        if (!redemption.empty) {
            const data = redemption.docs[0].data();
            const userRef = query(collection(db, 'users'), where('id', '==', data.userId));
            const userDoc = await getDocs(userRef);
            if (!userDoc.empty) {
                const currentPoints = userDoc.docs[0].data().points || 0;
                await updateDoc(doc(db, 'users', userDoc.docs[0].id), {
                    points: currentPoints + data.pointsSpent
                });
            }
        }
    }
};

// ============================================================
// STREAKS
// ============================================================

/**
 * Update employee streak
 */
export const updateStreak = async (userId: string): Promise<Streak> => {
    const today = new Date().toISOString().split('T')[0];

    // Get current streak data
    const q = query(collection(db, 'streaks'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    let streak: Streak;

    if (snapshot.empty) {
        streak = {
            userId,
            currentStreak: 1,
            longestStreak: 1,
            lastActiveDate: today
        };
        await addDoc(collection(db, 'streaks'), streak);
    } else {
        const existing = snapshot.docs[0].data() as Streak;

        if (existing.lastActiveDate === today) {
            // Already active today
            return existing;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (existing.lastActiveDate === yesterdayStr) {
            // Continue streak
            streak = {
                userId,
                currentStreak: existing.currentStreak + 1,
                longestStreak: Math.max(existing.longestStreak, existing.currentStreak + 1),
                lastActiveDate: today
            };
        } else {
            // Streak broken
            streak = {
                userId,
                currentStreak: 1,
                longestStreak: existing.longestStreak,
                lastActiveDate: today
            };
        }

        await updateDoc(doc(db, 'streaks', snapshot.docs[0].id), {
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastActiveDate: streak.lastActiveDate
        });
    }

    return streak;
};

/**
 * Get employee streak
 */
export const getStreak = async (userId: string): Promise<Streak | null> => {
    const q = query(collection(db, 'streaks'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Streak;
};

// ============================================================
// LEADERBOARD
// ============================================================

import * as PointsService from './pointsService';

/**
 * Get leaderboard (Unified via PointsService)
 */
export const getLeaderboard = async (tenantId: string, limitCount = 10): Promise<{
    rank: number;
    userId: string;
    name: string;
    points: number;
    department: string;
}[]> => {
    try {
        const rawLeaderboard = await PointsService.getLeaderboard(tenantId, limitCount);
        return rawLeaderboard.map(e => ({
            rank: e.rank,
            userId: e.id,
            name: e.name,
            points: e.points,
            department: e.department
        }));
    } catch {
        return [];
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useRewards = (userId: string, branch: string, tenantId: string) => {
    const [achievements, setAchievements] = useState<EmployeeAchievement[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [streak, setStreak] = useState<Streak | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const [ach, rew, str] = await Promise.all([
                getEmployeeAchievements(userId),
                getAvailableRewards(branch),
                getStreak(userId)
            ]);
            setAchievements(ach);
            setRewards(rew);
            setStreak(str);
            setLoading(false);
        };

        load();
    }, [userId, branch]);

    const redeem = useCallback(async (reward: Reward) => {
        const userName = ''; // Would get from context
        if (!tenantId) {
            logger.error("Critical: tenantId missing in redeem action", undefined, 'rewardsSystemService');
            return null;
        }
        return redeemReward(tenantId, reward.id, reward.name, userId, userName, reward.pointsCost, branch);
    }, [userId, branch, tenantId]);

    const updateUserStreak = useCallback(async () => {
        const newStreak = await updateStreak(userId);
        setStreak(newStreak);
        return newStreak;
    }, [userId]);

    return {
        achievements,
        allAchievements: [], // Use a separate effect to load if needed, or remove property
        rewards,
        streak,
        loading,
        redeemReward: redeem,
        updateStreak: updateUserStreak,
        getLeaderboard: () => getLeaderboard(branch)
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getAllAchievements,
    getEmployeeAchievements,
    awardAchievement,
    checkAchievements,
    getAvailableRewards,
    redeemReward,
    getUserRedemptions,
    getPendingRedemptions,
    processRedemption,
    updateStreak,
    getStreak,
    getLeaderboard,
    useRewards
};
