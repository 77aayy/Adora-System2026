/**
 * Points Service - Dual Tracking (Individual + Team)
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    collection, doc, getDoc, getDocs, updateDoc, query, orderBy, limit, increment, addDoc, runTransaction, serverTimestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
import { FullPointsConfig } from '../features/admin/PointsConfiguration';

export interface EmployeeContext {
    hotelId: string;
    branchId: string;
    employeeId: string;
    employeeName: string;
}

// Default points config (V4 Unified Logic)
const DEFAULT_POINTS_CONFIG = {
    bellman: {
        checkin: 1,
        checkout: 1,
        complete: 1,
        fast: 2,
        fastTime: 10, // 10 min
        delay: -1,
        delayTime: 20 // 20 min
    },
    housekeeping: {
        start: 1,
        completeOccupied: 1,
        completeCheckout: 1,
        inspection: 1,
        fast: 2,
        fastTime: 25, // 25 min
        delay: -1,
        delayTime: 30 // 30 min
    },
    maintenance: {
        complete: 1
    },
    procurement: {
        purchase: 1,
        receive: 1,
        early: 2,
        ontime: 1,
        delay: -2,
        targetTime: 1440, // 1 Day default
        targetTimeHousekeeping: 1440, // 1 Day
        targetTimeMaintenance: 2880, // 2 Days (user said 2 d)
        targetTimeReception: 1440 // 1 Day
    },
    reception: {
        create: 2,
        confirm: 1,
        complete: 1,
        // Speed Confirmation Logic
        targetConfirmationTime: 3, // Minutes
        lateConfirmationTime: 5, // Minutes (-1)
        veryLateConfirmationTime: 10, // Minutes (-2)
        lateConfirmationPenalty: -1,
        veryLateConfirmationPenalty: -2
    },
    ratings: {
        enabled: true,
        excellent: 3,
        veryGood: 2,
        good: 1,
        fair: 0,
        poor: -2
    },
    financial: {
        exchangeRate: 0.5,
        minRedemption: 100
    },
    shiftHandover: {
        acknowledgeNote: 1
    }
};

// Cache for points config per tenant
let cachedConfigs: Record<string, any> = {};

/**
 * Get points configuration from Tenant settings
 */
export async function getPointsConfig(tenantId: string, branchId?: string): Promise<FullPointsConfig> {
    if (cachedConfigs[tenantId]) return cachedConfigs[tenantId];

    try {
        const configRef = doc(db, `tenants/${tenantId}/settings/pointsConfig`);
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            cachedConfigs[tenantId] = { ...DEFAULT_POINTS_CONFIG, ...configSnap.data() };
        } else {
            cachedConfigs[tenantId] = DEFAULT_POINTS_CONFIG;
        }

        return cachedConfigs[tenantId];
    } catch (error) {
        console.error('Error loading points config:', error);
        return DEFAULT_POINTS_CONFIG as unknown as FullPointsConfig;
    }
}

/**
 * Clear cached config
 */
export function clearPointsConfigCache(tenantId: string): void {
    delete cachedConfigs[tenantId];
}

// ============================================================
// ⚠️ SUSPICIOUS SPEED DETECTION
// ============================================================

/**
 * Suspicious speed threshold (percentage of expected time)
 * If task completes in less than 50% of expected time, flag as suspicious
 */
const SUSPICIOUS_SPEED_THRESHOLD = 0.5; // 50%

interface SuspiciousSpeedResult {
    isSuspicious: boolean;
    expectedTime: number;
    actualTime: number;
    percentage: number;
    message?: string;
}

/**
 * Check if task completion was suspiciously fast
 * ⚠️ Quality assurance: tasks completed too quickly may indicate poor quality
 */
export function checkSuspiciousSpeed(
    department: 'bellman' | 'housekeeping' | 'maintenance' | 'coffeeShop' | 'reception' | 'procurement',
    actualMinutes: number,
    config: any
): SuspiciousSpeedResult {
    let expectedTime = 0;
    
    // Get expected time based on department
    switch (department) {
        case 'housekeeping':
            expectedTime = config.fastTime || 25; // Default 25 min for cleaning
            break;
        case 'bellman':
            expectedTime = config.fastTime || 10;
            break;
        case 'maintenance':
            expectedTime = config.fastTime || 30;
            break;
        case 'coffeeShop':
            expectedTime = config.fastTime || 10;
            break;
        case 'reception':
            expectedTime = config.targetConfirmationTime || 3;
            break;
        case 'procurement':
            expectedTime = (config.targetTime || 1440) / 60; // Convert to hours for display
            break;
        default:
            expectedTime = 15;
    }
    
    const percentage = actualMinutes / expectedTime;
    const isSuspicious = percentage < SUSPICIOUS_SPEED_THRESHOLD && actualMinutes > 0;
    
    return {
        isSuspicious,
        expectedTime,
        actualTime: actualMinutes,
        percentage: Math.round(percentage * 100),
        message: isSuspicious 
            ? `⚠️ سرعة مشبوهة: تم الإنجاز في ${actualMinutes} دقيقة من ${expectedTime} دقيقة متوقعة (${Math.round(percentage * 100)}%)`
            : undefined
    };
}

/**
 * Log suspicious speed for admin review
 */
export async function logSuspiciousSpeed(
    tenantId: string,
    branchId: string,
    employeeId: string,
    employeeName: string,
    department: string,
    requestId: string,
    result: SuspiciousSpeedResult
): Promise<void> {
    if (!result.isSuspicious) return;
    
    try {
        await addDoc(collection(db, `tenants/${tenantId}/suspicious_activities`), {
            type: 'suspicious_speed',
            employeeId,
            employeeName,
            department,
            requestId,
            branchId,
            expectedTime: result.expectedTime,
            actualTime: result.actualTime,
            percentage: result.percentage,
            message: result.message,
            timestamp: serverTimestamp(),
            reviewed: false,
            action: null // 'approved' | 'flagged' | 'dismissed'
        });
        
        console.warn(`⚠️ Suspicious speed logged for ${employeeName} in ${department}`);
    } catch (error) {
        console.error('Error logging suspicious speed:', error);
    }
}

/**
 * Award points with suspicious speed check
 * If suspicious, points are held for review instead of immediate award
 */
export async function awardPointsWithQualityCheck(
    tenantId: string,
    branchId: string,
    employeeId: string,
    employeeName: string,
    department: 'bellman' | 'housekeeping' | 'maintenance' | 'coffeeShop' | 'reception' | 'procurement',
    points: number,
    reason: string,
    actualMinutes: number,
    requestId?: string
): Promise<{ awarded: boolean; held: boolean; message: string }> {
    const config = await getPointsConfig(tenantId);
    const deptConfig = config[department] || {};
    
    const suspiciousCheck = checkSuspiciousSpeed(department, actualMinutes, deptConfig);
    
    if (suspiciousCheck.isSuspicious) {
        // Log suspicious activity
        await logSuspiciousSpeed(
            tenantId,
            branchId,
            employeeId,
            employeeName,
            department,
            requestId || 'unknown',
            suspiciousCheck
        );
        
        // Hold points for review instead of awarding immediately
        await addDoc(collection(db, `tenants/${tenantId}/pending_points`), {
            employeeId,
            employeeName,
            department,
            points,
            reason,
            actualMinutes,
            requestId,
            status: 'pending_review',
            suspiciousDetails: suspiciousCheck,
            createdAt: serverTimestamp()
        });
        
        return {
            awarded: false,
            held: true,
            message: `⚠️ تم تعليق ${points} نقاط للمراجعة: ${suspiciousCheck.message}`
        };
    }
    
    // Normal award
    await awardPoints(tenantId, employeeId, points, reason);
    
    return {
        awarded: true,
        held: false,
        message: `✅ تم منح ${points} نقاط: ${reason}`
    };
}

// ============================================================
// STREAK MANAGEMENT
// ============================================================

/**
 * Update user's confirmation streak
 * @param tenantId - Tenant ID
 * @param employeeId - Employee ID
 * @param isSuccess - Whether the confirmation was fast (extends streak) or slow (resets streak)
 */
export async function updateStreak(
    tenantId: string,
    employeeId: string,
    isSuccess: boolean
): Promise<void> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);
        const employeeDoc = await getDoc(employeeRef);

        if (!employeeDoc.exists()) {
            console.warn('Employee not found for streak update:', employeeId);
            return;
        }

        const currentStreak = employeeDoc.data().confirmationStreak || 0;
        const newStreak = isSuccess ? currentStreak + 1 : 0;

        await updateDoc(employeeRef, {
            confirmationStreak: newStreak,
            lastStreakUpdate: serverTimestamp()
        });

        console.log(`📊 Streak ${isSuccess ? 'extended' : 'reset'} for ${employeeId}: ${newStreak}`);
    } catch (error) {
        console.error('Error updating streak:', error);
    }
}

/**
 * Get user's current confirmation streak
 */
export async function getStreak(tenantId: string, employeeId: string): Promise<number> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);
        const employeeDoc = await getDoc(employeeRef);

        if (!employeeDoc.exists()) return 0;
        return employeeDoc.data().confirmationStreak || 0;
    } catch (error) {
        console.error('Error getting streak:', error);
        return 0;
    }
}

/**
 * Award points with multiplier (for streak bonuses)
 */
export async function awardPointsWithMultiplier(
    tenantId: string,
    employeeId: string,
    basePoints: number,
    reason: string,
    multiplier: number,
    multiplierReason: string
): Promise<void> {
    const finalPoints = Math.round(basePoints * multiplier);
    const fullReason = multiplierReason ? `${reason} ${multiplierReason}` : reason;
    await awardPoints(tenantId, employeeId, finalPoints, fullReason);
}

/**
 * Award points based on performance (Refined Logic)
 */
export async function awardPerformancePoints(
    tenantId: string,
    employeeId: string,
    department: 'bellman' | 'housekeeping' | 'maintenance' | 'reception' | 'procurement',
    baseAction: string,
    durationMinutes: number,
    targetMinutes: number = 0 // New parameter for procurement/maintenance target time
): Promise<number> {
    // 🛡️ SECURITY: Tenant Isolation Guard
    // Verify user belongs to this tenant before awarding points
    const userRef = doc(db, `tenants/${tenantId}/employees/${employeeId}`);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        console.error(`🚨 Security Alert: Attempt to award points to non-existent user ${employeeId} in tenant ${tenantId}`);
        return 0;
    }

    try {
        const config = await getPointsConfig(tenantId);
        const deptConfig = config[department];

        if (!deptConfig) {
            console.warn(`⚠️ No points config found for department: ${department}`);
            // Fallback to minimal points
            await awardPoints(tenantId, employeeId, 1, baseAction);
            return 1;
        }

        let totalPoints = 0;
        let bonusReason = '';

        // 🟢 STRICT DEPARTMENT LOGIC (Switch Case)
        switch (department) {
            case 'reception': {
                const receptionConfig = deptConfig as FullPointsConfig['reception'];
                if (baseAction === 'create') totalPoints = receptionConfig.create ?? 0;
                else if (baseAction === 'confirm') totalPoints = receptionConfig.confirm ?? 0;
                else if (baseAction === 'complete') totalPoints = receptionConfig.complete ?? 0;

                // Speed Confirmation Logic
                if (baseAction === 'confirm') {
                    const targetTime = receptionConfig.targetConfirmationTime || 3;
                    if (durationMinutes <= targetTime) {
                        await updateStreak(tenantId, employeeId, true);
                        const currentStreak = await getStreak(tenantId, employeeId);

                        let multiplier = 1;
                        let multiplierReason = '';
                        if (currentStreak >= 5) { multiplier = 1.5; multiplierReason = '🔥 (شعلة x1.5)'; }
                        else if (currentStreak >= 3) { multiplier = 1.2; multiplierReason = '⚡ (كومبو x1.2)'; }

                        await awardPointsWithMultiplier(tenantId, employeeId, totalPoints, 'تأكيد سريع', multiplier, multiplierReason);
                        return Math.round(totalPoints * multiplier);
                    } else {
                        await updateStreak(tenantId, employeeId, false);
                        if (durationMinutes > (receptionConfig.veryLateConfirmationTime || 10)) {
                            totalPoints += (receptionConfig.veryLateConfirmationPenalty || -2);
                            bonusReason = ' (خصم تأخير كبير)';
                        } else if (durationMinutes > (receptionConfig.lateConfirmationTime || 5)) {
                            totalPoints += (receptionConfig.lateConfirmationPenalty || -1);
                            bonusReason = ' (خصم تأخير بسيط)';
                        }
                    }
                }
                break;
            }

            case 'procurement': {
                const procurementConfig = deptConfig as FullPointsConfig['procurement'];
                if (baseAction === 'purchase') totalPoints = procurementConfig.purchase ?? 0;
                else if (baseAction === 'receive') totalPoints = procurementConfig.receive ?? 0;

                if (baseAction === 'purchase' && targetMinutes > 0) {
                    const earlyThreshold = targetMinutes * 0.8;
                    if (durationMinutes <= earlyThreshold) {
                        totalPoints += (procurementConfig.early || 0);
                        bonusReason = ` (تبكير: ${durationMinutes}/${targetMinutes} د)`;
                    } else if (durationMinutes > targetMinutes) {
                        totalPoints += (procurementConfig.delay || 0);
                        bonusReason = ` (تأخير: ${durationMinutes}/${targetMinutes} د)`;
                    } else {
                        totalPoints += (procurementConfig.ontime || 0);
                        bonusReason = ` (بالموعد: ${durationMinutes}/${targetMinutes} د)`;
                    }
                }
                break;
            }

            case 'maintenance': {
                const maintConfig = deptConfig as FullPointsConfig['maintenance'];
                if (baseAction === 'complete') totalPoints = maintConfig.complete ?? 0;
                break;
            }

            case 'housekeeping': {
                const hkConfig = deptConfig as FullPointsConfig['housekeeping'];
                if (baseAction === 'start') totalPoints = hkConfig.start ?? 0;
                else if (baseAction === 'completeOccupied') totalPoints = hkConfig.completeOccupied ?? 0;
                else if (baseAction === 'completeCheckout') totalPoints = hkConfig.completeCheckout ?? 0;
                else if (baseAction === 'inspection') totalPoints = hkConfig.inspection ?? 0;
                break;
            }

            case 'bellman': {
                const bellmanConfig = deptConfig as FullPointsConfig['bellman'];
                if (baseAction === 'checkin') totalPoints = bellmanConfig.checkin ?? 0;
                else if (baseAction === 'checkout') totalPoints = bellmanConfig.checkout ?? 0;
                else if (baseAction === 'complete') totalPoints = bellmanConfig.complete ?? 0;

                // Existing speed logic re-implementation
                if (baseAction === 'fast' && durationMinutes <= (bellmanConfig.fastTime || 10)) {
                    totalPoints = bellmanConfig.fast ?? 2;
                }
                break;
            }
        }

        // Final Award
        if (totalPoints !== 0 || bonusReason !== '') {
            await awardPoints(tenantId, employeeId, totalPoints, `${getArabicActionName(baseAction)}${bonusReason}`);
        }

        return totalPoints;

    } catch (error) {
        console.error('Error awarding performance points:', error);
        return 0;
    }
}

function getArabicActionName(action: string): string {
    const map: Record<string, string> = {
        'start': 'بدء مهمة',
        'complete': 'إتمام مهمة',
        'confirm': 'تأكيد طلب',
        'inspection': 'فحص',
        'purchase': 'عملية شراء',
        'receive': 'استلام',
        'checkin': 'دخول نزيل',
        'checkout': 'مغادرة نزيل',
        'completeOccupied': 'تنظيف (ساكن)',
        'completeCheckout': 'تنظيف (مغادرة)',
        'confirmRequest': 'تأكيد طلب',
        'completeRequest': 'إتمام طلب',
        'create': 'إنشاء طلب'
    };
    return map[action] || action;
}

/**
 * Award points based on guest rating (5-star mapping)
 */
export async function awardRatingPoints(
    tenantId: string,
    employeeId: string,
    department: 'bellman' | 'housekeeping' | 'reception' | 'maintenance',
    stars: number
): Promise<number> {
    try {
        const config = await getPointsConfig(tenantId);
        const ratingConfig = config.ratings;

        if (!ratingConfig || !ratingConfig.enabled) return 0;

        let points = 0;
        let starLabel = '';

        switch (stars) {
            case 5: points = ratingConfig.excellent || 3; starLabel = '⭐⭐⭐⭐⭐'; break;
            case 4: points = ratingConfig.veryGood || 2; starLabel = '⭐⭐⭐⭐'; break;
            case 3: points = ratingConfig.good || 1; starLabel = '⭐⭐⭐'; break;
            case 2: points = ratingConfig.fair || 0; starLabel = '⭐⭐'; break;
            case 1: points = ratingConfig.poor || -2; starLabel = '⭐'; break;
        }

        if (points !== 0) {
            await awardPoints(tenantId, employeeId, points, `تقييم النزيل (${starLabel})`);
        }

        return points;
    } catch (error) {
        console.error('Error awarding rating points:', error);
        return 0;
    }
}

/**
 * Award points for an achievement (Manager-controlled)
 */
export async function awardAchievementPoints(
    tenantId: string,
    employeeId: string,
    achievementName: string,
    points: number,
    prefix: string = 'وسام'
): Promise<void> {
    await awardPoints(tenantId, employeeId, points, `${prefix}: ${achievementName}`);
}

/**
 * Spend points for rewards (Redemption)
 */
export async function deductPoints(
    tenantId: string,
    employeeId: string,
    points: number,
    description: string
): Promise<boolean> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);

        await runTransaction(db, async (transaction) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists()) throw new Error('Employee not found');

            const employeeData = employeeDoc.data();
            const currentPoints = (employeeData.currentPoints || 0);

            if (currentPoints < points) {
                throw new Error('Insufficient points');
            }

            const newBalance = currentPoints - points;

            // Update balance
            transaction.update(employeeRef, {
                currentPoints: newBalance,
                points: newBalance, // legacy sync
                personalPoints: newBalance // legacy sync
            });

            // Log Transaction
            const transactionRef = doc(collection(db, `tenants/${tenantId}/employees/${employeeId}/wallet_transactions`));
            transaction.set(transactionRef, {
                userId: employeeId,
                type: 'redeem',
                points: points,
                description,
                createdAt: serverTimestamp()
            });
        });

        return true;
    } catch (error) {
        console.error('Points deduction failed:', error);
        return false;
    }
}

/**
 * Award points to employee (updates both personal and team points)
 * Uses Firestore Transaction for financial integrity
 */
export async function awardPoints(
    tenantId: string,
    employeeId: string,
    points: number,
    reason: string = ''
): Promise<void> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);

        await runTransaction(db, async (transaction) => {
            const employeeDoc = await transaction.get(employeeRef);
            if (!employeeDoc.exists()) {
                throw new Error('Employee not found');
            }

            const employeeData = employeeDoc.data();

            // 🛡️ Backward Compatibility: Initialize fields if missing
            const currentPoints = (employeeData.currentPoints ?? employeeData.personalPoints ?? 0) + points;
            const lifetimePoints = (employeeData.lifetimePoints ?? 0) + points;

            // 1. Update employee financial points
            transaction.update(employeeRef, {
                personalPoints: currentPoints, // Legacy field
                points: currentPoints,         // Legacy field
                currentPoints: currentPoints,  // New spendable field
                lifetimePoints: lifetimePoints,// New archival field
                lastAwardedAt: serverTimestamp()
            });

            // 2. Add to wallet_transactions (New Ledger System)
            const transactionRef = doc(collection(db, `tenants/${tenantId}/employees/${employeeId}/wallet_transactions`));
            transaction.set(transactionRef, {
                userId: employeeId,
                type: 'earn',
                points: points,
                description: reason,
                createdAt: serverTimestamp()
            });

            // 3. Add to legacy points history (optional but keeping for audit)
            const historyRef = doc(collection(db, `tenants/${tenantId}/employees/${employeeId}/pointsHistory`));
            transaction.set(historyRef, {
                points,
                reason,
                timestamp: serverTimestamp(),
                previousPoints: employeeData.currentPoints ?? employeeData.personalPoints ?? 0
            });

            // 4. Update team points if employee is in a team
            if (employeeData.teamId) {
                const teamRef = doc(db, `tenants/${tenantId}/teams`, employeeData.teamId);
                transaction.update(teamRef, {
                    teamPoints: increment(points)
                });
            }
        });

        // 5. Check for Formatting Achievements (Async/Fire&Forget)
        // Dynamic import avoids circular dependency
        import('./rewardsSystemService').then(async ({ checkAchievements }) => {
            try {
                // Fetch fresh stats to ensure accuracy after transaction
                const freshDoc = await getDoc(doc(db, `tenants/${tenantId}/employees`, employeeId));
                if (freshDoc.exists()) {
                    const data = freshDoc.data();
                    const freshLifetimePoints = data.lifetimePoints || data.points || 0;

                    await checkAchievements(employeeId, {
                        totalPoints: freshLifetimePoints,
                        // We could also pass other stats here if tracked (e.g. tasks completed)
                    });
                }
            } catch (err) {
                console.error('Error in achievement check:', err);
            }
        }).catch(err => console.error('Failed to load rewards module:', err));

        console.log(`✅ Awarded ${points} points to ${employeeId}`, reason);

    } catch (error) {
        console.error('Error awarding points (Transaction failed):', error);
        throw error;
    }
}

/**
 * Get employee points summary
 */
export async function getPointsSummary(
    tenantId: string,
    employeeId: string
): Promise<{
    personalPoints: number;
    teamPoints?: number;
    teamName?: string;
}> {
    try {
        const employeeRef = doc(db, `tenants/${tenantId}/employees`, employeeId);
        const employeeDoc = await getDoc(employeeRef);

        if (!employeeDoc.exists()) {
            throw new Error('Employee not found');
        }

        const employee = employeeDoc.data();
        const result: any = {
            personalPoints: employee.personalPoints || 0
        };

        if (employee.teamId) {
            const teamRef = doc(db, `tenants/${tenantId}/teams`, employee.teamId);
            const teamDoc = await getDoc(teamRef);

            if (teamDoc.exists()) {
                const team = teamDoc.data();
                result.teamPoints = team.teamPoints || 0;
                result.teamName = team.name;
            }
        }

        return result;

    } catch (error) {
        console.error('Error getting points summary:', error);
        throw error;
    }
}

/**
 * Get employee points history
 */
export async function getPointsHistory(context: EmployeeContext, limitCount: number = 50): Promise<any[]> {
    try {
        const historyRef = collection(db, `users/${context.employeeId}/pointsHistory`);
        const q = query(historyRef, orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const history: any[] = [];
        snapshot.forEach((docSnap) => {
            history.push({ id: docSnap.id, ...docSnap.data() });
        });

        return history;
    } catch (error) {
        console.error('Error getting points history:', error);
        return [];
    }
}

/**
 * Get employee leaderboard (personal points)
 */
export async function getLeaderboard(tenantId: string, limitCount: number = 10): Promise<any[]> {
    try {
        const usersRef = collection(db, `tenants/${tenantId}/employees`);
        const q = query(usersRef, orderBy('lifetimePoints', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const leaderboard: any[] = [];
        let rank = 1;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            leaderboard.push({
                id: docSnap.id,
                name: data.name || 'موظف',
                points: data.lifetimePoints || data.points || 0,
                rank: rank++,
                department: data.department || ''
            });
        });

        return leaderboard;
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}

/**
 * Get team leaderboard
 */
export async function getTeamLeaderboard(tenantId: string, limitCount: number = 10): Promise<any[]> {
    try {
        const teamsRef = collection(db, `tenants/${tenantId}/teams`);
        const q = query(teamsRef, orderBy('teamPoints', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const leaderboard: any[] = [];
        let rank = 1;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            leaderboard.push({
                id: docSnap.id,
                name: data.name || 'فريق',
                points: data.teamPoints || 0,
                rank: rank++,
                memberCount: data.members?.length || 0
            });
        });

        return leaderboard;
    } catch (error) {
        console.error('Error getting team leaderboard:', error);
        return [];
    }
}
