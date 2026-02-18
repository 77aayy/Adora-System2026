/**
 * Daily Activity Service
 * Universal daily activity tracking for ALL departments
 * 
 * ✅ Features:
 * - Records any department activity (create, complete, etc.)
 * - Awards commitment points based on daily activity
 * - Works for ALL departments (housekeeping, maintenance, bellman, reception, procurement, coffeeShop)
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
    addDoc,
    serverTimestamp,
    increment
} from 'firebase/firestore';
import { checkDailyAttendance } from './challengeService';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type Department = 
    | 'housekeeping' 
    | 'maintenance' 
    | 'bellman' 
    | 'reception' 
    | 'procurement' 
    | 'coffeeShop';

export type ActivityType = 
    | 'create'      // Created a request/order
    | 'accept'      // Accepted/claimed a task
    | 'start'       // Started working
    | 'complete'    // Completed a task
    | 'deliver'     // Delivered an order
    | 'receive'     // Received goods (procurement)
    | 'confirm'     // Confirmed a request (reception)
    | 'inspect'     // Inspection (housekeeping)
    | 'login';      // Daily login

interface DailyActivityRecord {
    date: string; // YYYY-MM-DD
    department: Department;
    activities: {
        type: ActivityType;
        count: number;
        lastTimestamp: any;
    }[];
    totalActivities: number;
    pointsAwarded: number;
}

// ============================================================
// MAIN FUNCTIONS
// ============================================================

/**
 * Get today's date string
 */
const getTodayString = (): string => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Record daily activity for any department
 * This should be called whenever an employee performs any action
 */
export async function recordDailyActivity(
    tenantId: string,
    employeeId: string,
    department: Department,
    activityType: ActivityType
): Promise<{
    success: boolean;
    isFirstActivityToday: boolean;
    streakUnlocked?: any;
    message?: string;
}> {
    const today = getTodayString();
    const activityRef = doc(db, `tenants/${tenantId}/employees/${employeeId}/daily_activities/${today}`);

    try {
        const activityDoc = await getDoc(activityRef);
        let isFirstActivityToday = false;

        if (!activityDoc.exists()) {
            // First activity of the day
            isFirstActivityToday = true;

            await setDoc(activityRef, {
                date: today,
                department,
                activities: [{
                    type: activityType,
                    count: 1,
                    lastTimestamp: serverTimestamp()
                }],
                totalActivities: 1,
                pointsAwarded: 0,
                createdAt: serverTimestamp()
            });

            // ✅ Trigger commitment/streak check on first activity
            const streakResult = await checkDailyAttendance(tenantId, employeeId);

            return {
                success: true,
                isFirstActivityToday: true,
                streakUnlocked: streakResult.unlocked,
                message: streakResult.unlocked 
                    ? `🎉 مبروك! حصلت على ${streakResult.unlocked.rewardPoints} نقطة من مكافآت الالتزام`
                    : '✅ تم تسجيل نشاطك اليومي'
            };
        } else {
            // Update existing activity record
            const data = activityDoc.data() as DailyActivityRecord;
            const existingActivity = data.activities?.find(a => a.type === activityType);

            if (existingActivity) {
                // Increment count for this activity type
                const updatedActivities = data.activities.map(a => 
                    a.type === activityType 
                        ? { ...a, count: a.count + 1, lastTimestamp: serverTimestamp() }
                        : a
                );

                await updateDoc(activityRef, {
                    activities: updatedActivities,
                    totalActivities: increment(1)
                });
            } else {
                // Add new activity type
                await updateDoc(activityRef, {
                    activities: [...(data.activities || []), {
                        type: activityType,
                        count: 1,
                        lastTimestamp: serverTimestamp()
                    }],
                    totalActivities: increment(1)
                });
            }

            return {
                success: true,
                isFirstActivityToday: false,
                message: '✅ تم تسجيل النشاط'
            };
        }
    } catch (error) {
        logger.error('Error recording daily activity:', error, 'dailyActivityService');
        return {
            success: false,
            isFirstActivityToday: false,
            message: '❌ فشل تسجيل النشاط'
        };
    }
}

/**
 * Check if employee has any activity today
 */
export async function hasActivityToday(
    tenantId: string,
    employeeId: string
): Promise<boolean> {
    const today = getTodayString();
    const activityRef = doc(db, `tenants/${tenantId}/employees/${employeeId}/daily_activities/${today}`);

    try {
        const activityDoc = await getDoc(activityRef);
        return activityDoc.exists();
    } catch (error) {
        logger.error('Error checking daily activity:', error, 'dailyActivityService');
        return false;
    }
}

/**
 * Get employee's daily activity summary
 */
export async function getDailyActivitySummary(
    tenantId: string,
    employeeId: string,
    date?: string
): Promise<DailyActivityRecord | null> {
    const targetDate = date || getTodayString();
    const activityRef = doc(db, `tenants/${tenantId}/employees/${employeeId}/daily_activities/${targetDate}`);

    try {
        const activityDoc = await getDoc(activityRef);
        if (!activityDoc.exists()) return null;
        return activityDoc.data() as DailyActivityRecord;
    } catch (error) {
        logger.error('Error getting daily activity:', error, 'dailyActivityService');
        return null;
    }
}

/**
 * Get activity count for a specific type today
 */
export async function getActivityCount(
    tenantId: string,
    employeeId: string,
    activityType: ActivityType
): Promise<number> {
    const summary = await getDailyActivitySummary(tenantId, employeeId);
    if (!summary) return 0;

    const activity = summary.activities?.find(a => a.type === activityType);
    return activity?.count || 0;
}

// ============================================================
// DEPARTMENT-SPECIFIC WRAPPERS
// ============================================================

/**
 * Record housekeeping activity
 */
export async function recordHousekeepingActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'start' | 'complete' | 'inspect'
) {
    return recordDailyActivity(tenantId, employeeId, 'housekeeping', activityType);
}

/**
 * Record maintenance activity
 */
export async function recordMaintenanceActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'accept' | 'start' | 'complete'
) {
    return recordDailyActivity(tenantId, employeeId, 'maintenance', activityType);
}

/**
 * Record bellman activity
 */
export async function recordBellmanActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'accept' | 'complete' | 'deliver'
) {
    return recordDailyActivity(tenantId, employeeId, 'bellman', activityType);
}

/**
 * Record reception activity
 */
export async function recordReceptionActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'create' | 'confirm' | 'complete'
) {
    return recordDailyActivity(tenantId, employeeId, 'reception', activityType);
}

/**
 * Record procurement activity
 */
export async function recordProcurementActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'create' | 'receive' | 'deliver'
) {
    return recordDailyActivity(tenantId, employeeId, 'procurement', activityType);
}

/**
 * Record coffee shop activity
 */
export async function recordCoffeeShopActivity(
    tenantId: string,
    employeeId: string,
    activityType: 'accept' | 'start' | 'complete' | 'deliver'
) {
    return recordDailyActivity(tenantId, employeeId, 'coffeeShop', activityType);
}

// ============================================================
// ADMIN FUNCTIONS
// ============================================================

/**
 * Get all employees' activity status for today (for admin dashboard)
 */
export async function getAllEmployeesActivityStatus(
    tenantId: string,
    branchId?: string
): Promise<{
    employeeId: string;
    employeeName: string;
    department: string;
    hasActivityToday: boolean;
    totalActivities: number;
}[]> {
    // This would require fetching all employees and their daily activities
    // Implementation depends on your employee structure
    // For now, return empty array - implement based on your needs
    return [];
}

export default {
    recordDailyActivity,
    hasActivityToday,
    getDailyActivitySummary,
    getActivityCount,
    recordHousekeepingActivity,
    recordMaintenanceActivity,
    recordBellmanActivity,
    recordReceptionActivity,
    recordProcurementActivity,
    recordCoffeeShopActivity,
    getAllEmployeesActivityStatus
};
