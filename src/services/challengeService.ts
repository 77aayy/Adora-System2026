/**
 * Challenge Service
 * Manages daily attendance streaks and milestone rewards
 */

import { db } from './firebase';
import {
    doc,
    runTransaction,
    serverTimestamp,
    getDoc,
    collection,
    setDoc
} from 'firebase/firestore';
import { UserChallengeProgress, ChallengeMilestone, ChallengeConfig } from '../types';
import { logger } from './loggerService';

const DEFAULT_MILESTONES: ChallengeMilestone[] = [
    { day: 1, rewardPoints: 1, label: 'بداية الرحلة' },
    { day: 3, rewardPoints: 50, label: 'المثابر' },
    { day: 7, rewardPoints: 150, label: 'أسبوع الانضباط' },
    { day: 15, rewardPoints: 400, label: 'خبير الالتزام' },
    { day: 30, rewardPoints: 1000, label: 'بطل Adora الذهبي' }
];

/**
 * Fetch tenant-specific challenge configuration
 */
export async function getChallengeConfig(tenantId: string): Promise<ChallengeConfig> {
    // ✅ CRITICAL: Check db before use
    if (!db) {
        logger.error('Firebase Firestore not initialized - returning default config', undefined, 'challengeService');
        return {
            isEnabled: true,
            gracePeriodDays: 2,
            milestones: DEFAULT_MILESTONES
        };
    }

    const configRef = doc(db, `tenants/${tenantId}/settings/challengeConfig`);
    const configDoc = await getDoc(configRef);

    if (configDoc.exists()) {
        return configDoc.data() as ChallengeConfig;
    }

    // Return defaults if not configured
    return {
        isEnabled: true,
        gracePeriodDays: 2,
        milestones: [
            { day: 1, rewardPoints: 1, label: 'بداية الرحلة' },
            { day: 3, rewardPoints: 50, label: 'المثابر' },
            { day: 7, rewardPoints: 150, label: 'أسبوع الانضباط' },
            { day: 15, rewardPoints: 400, label: 'خبير الالتزام' },
            { day: 30, rewardPoints: 1000, label: 'بطل Adora الذهبي' }
        ]
    };
}

/**
 * Save tenant-specific challenge configuration
 */
export async function saveChallengeConfig(tenantId: string, config: ChallengeConfig): Promise<void> {
    // ✅ CRITICAL: Check db before use
    if (!db) {
        throw new Error('Firebase Firestore not initialized');
    }

    const configRef = doc(db, `tenants/${tenantId}/settings/challengeConfig`);
    // ✅ FIX: Use setDoc instead of transaction for simpler write
    await setDoc(configRef, {
        ...config,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * Check and update daily attendance streak with dynamic config and exceptions
 */
export async function checkDailyAttendance(tenantId: string, userId: string): Promise<{
    success: boolean;
    unlocked?: ChallengeMilestone;
    alreadyCheckedToday?: boolean;
}> {
    // ✅ CRITICAL: Check db before use
    if (!db) {
        logger.error('Firebase Firestore not initialized', undefined, 'challengeService');
        return { success: false };
    }

    const userRef = doc(db, `tenants/${tenantId}/employees`, userId);
    const today = new Date().toISOString().split('T')[0];

    try {
        const config = await getChallengeConfig(tenantId);
        if (!config.isEnabled) return { success: false };

        const result = await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error('User not found');

            const data = userDoc.data();
            const progress: UserChallengeProgress = data.challengeProgress || {
                currentStreak: 0,
                lastLoginDate: null,
                claimedMilestones: [],
                attendanceHistory: [],
                allowedWeeklyOffDays: 1, // Default 1 day off
                offDaysUsedThisWeek: 0
            };

            // 1. Check if already checked today
            if (progress.lastLoginDate === today) {
                return { success: true, alreadyCheckedToday: true };
            }

            // 2. Calculate Gap & Streak
            const lastDate = progress.lastLoginDate ? new Date(progress.lastLoginDate) : null;
            const todayDate = new Date(today);

            // ✅ Weekly Reset Logic: Reset offDaysUsedThisWeek at start of new week
            let updatedOffDays = progress.offDaysUsedThisWeek || 0;
            if (lastDate) {
                const lastDateObj = new Date(lastDate);
                const todayDateObj = new Date(today);
                
                // Get day of week (0 = Sunday, 6 = Saturday)
                const lastDayOfWeek = lastDateObj.getDay();
                const todayDayOfWeek = todayDateObj.getDay();
                
                // Calculate days difference
                const diffDays = Math.ceil(Math.abs(todayDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
                
                // Reset if we've crossed into a new week (Sunday to next Sunday = 7+ days)
                // OR if today is Sunday and last date was not Sunday (new week started)
                if (diffDays >= 7 || (todayDayOfWeek === 0 && lastDayOfWeek !== 0)) {
                    updatedOffDays = 0; // Reset weekly counter
                }
            } else {
                // First time - reset to 0
                updatedOffDays = 0;
            }

            let newStreak = 1;
            let resetHistory = false;

            if (lastDate) {
                const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    // Regular consecutive day
                    newStreak = progress.currentStreak + 1;
                } else {
                    // Gap detected - Check for exceptions (Off Days)
                    const missedDays = diffDays - 1;
                    const allowedRemaining = (progress.allowedWeeklyOffDays || 1) - updatedOffDays;

                    if (missedDays <= allowedRemaining) {
                        // Success! Gap is within allowed off-days
                        newStreak = progress.currentStreak + 1;
                        updatedOffDays += missedDays;
                        // Mark missed days as exceptions in history
                    } else {
                        // Streak Broken
                        newStreak = 1;
                        updatedOffDays = 0; // Reset counter on break
                        resetHistory = true;
                    }
                }
            }

            // 3. Update History (Transparency)
            const newHistoryItem = { date: today, attended: true };
            let updatedHistory = [...(progress.attendanceHistory || []), newHistoryItem];

            // If we missed days but and it was an exception, let's backfill
            if (!resetHistory && lastDate) {
                const diffDays = Math.ceil(Math.abs(todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                for (let i = 1; i < diffDays; i++) {
                    const missedDate = new Date(lastDate);
                    missedDate.setDate(lastDate.getDate() + i);
                    updatedHistory.push({
                        date: missedDate.toISOString().split('T')[0],
                        attended: false,
                        isException: true
                    } as any);
                }
            }

            updatedHistory = updatedHistory.slice(-30);

            // 4. Check for milestones using DYNAMIC config
            const milestone = config.milestones.find(m => m.day === newStreak);
            const isAlreadyClaimed = progress.claimedMilestones?.includes(newStreak);

            let unlockedMilestone: ChallengeMilestone | undefined;

            if (milestone && !isAlreadyClaimed) {
                unlockedMilestone = milestone;

                // ✅ FIX: Mark milestone as claimed in transaction
                transaction.update(userRef, {
                    'challengeProgress.claimedMilestones': [...(progress.claimedMilestones || []), newStreak]
                });
            }

            // 5. Save State
            transaction.update(userRef, {
                'challengeProgress.currentStreak': newStreak,
                'challengeProgress.lastLoginDate': today,
                'challengeProgress.attendanceHistory': updatedHistory,
                'challengeProgress.offDaysUsedThisWeek': updatedOffDays
            });

            return {
                success: true,
                unlocked: unlockedMilestone
            };
        });

        // ✅ FIX: Award points AFTER transaction using unified pointsService
        // This ensures achievements are checked automatically
        if (result.success && result.unlocked) {
            try {
                const { awardPoints } = await import('./pointsService');
                await awardPoints(
                    tenantId,
                    userId,
                    result.unlocked.rewardPoints,
                    `مكافأة تحدي الالتزام - اليوم ${result.unlocked.day}: ${result.unlocked.label}`
                );
            } catch (err) {
                logger.error('Error awarding challenge points:', err, 'challengeService');
                // Don't fail the whole operation if points award fails
            }
        }

        return result;
    } catch (error: any) {
        // ✅ Silent fail for common cases (user not found, config disabled, etc.)
        // Only log unexpected errors
        if (error?.message === 'User not found') {
            // User doesn't exist in employees collection - this is expected for some scenarios
            return { success: false };
        }
        // Log only unexpected errors
        logger.error('Error updating attendance:', error, 'challengeService');
        return { success: false };
    }
}

/**
 * Get current challenge status
 */
export function getAvailableMilestones() {
    return DEFAULT_MILESTONES;
}
