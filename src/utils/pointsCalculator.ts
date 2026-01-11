/**
 * Points Calculator
 * Gamification Engine for Adora Hotel
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

export type CleaningType = 'occupied' | 'checkout';

export interface PointsBreakdown {
    base: number;
    speedBonus: number;
    qualityBonus: number;
    total: number;
    duration: number; // in minutes
}

// ============================================================
// POINT RULES (Business Logic)
// ============================================================

const RULES = {
    BASE_POINTS: {
        occupied: 3,
        checkout: 5,
    },
    SPEED_BONUS: {
        FAST: { maxMinutes: 30, bonus: 2 },
        NORMAL: { maxMinutes: 45, bonus: 1 },
        SLOW: { bonus: -1 },
    },
    QUALITY_BONUS: {
        NO_ISSUES: 1,
    },
};

// ============================================================
// CALCULATOR
// ============================================================

/**
 * Calculate points for a cleaning task
 * @param type - 'occupied' or 'checkout'
 * @param startTime - When cleaning started
 * @param endTime - When cleaning completed
 * @param hasIssues - Whether maintenance issues were reported
 */
export const calculateCleaningPoints = (
    type: CleaningType,
    startTime: Date,
    endTime: Date,
    hasIssues: boolean,
    settings: any = {}
): PointsBreakdown => {
    // Calculate duration in minutes
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Get config from settings or defaults
    const hkSettings = settings.housekeeping || {};
    // Map settings to rules format or use defaults
    const fastTime = hkSettings.fastTime || RULES.SPEED_BONUS.FAST.maxMinutes;
    const normalTime = hkSettings.delayTime || RULES.SPEED_BONUS.NORMAL.maxMinutes;

    const fastBonus = hkSettings.fast || RULES.SPEED_BONUS.FAST.bonus;
    const normalBonus = hkSettings.normal || RULES.SPEED_BONUS.NORMAL.bonus;
    const slowBonus = hkSettings.delay || RULES.SPEED_BONUS.SLOW.bonus;
    const base = RULES.BASE_POINTS[type];

    // Speed bonus
    let speedBonus = 0;
    if (duration < fastTime) {
        speedBonus = fastBonus;
    } else if (duration <= normalTime) {
        speedBonus = normalBonus;
    } else {
        speedBonus = slowBonus;
    }

    // Quality bonus (no issues reported)
    const qualityBonus = hasIssues ? 0 : RULES.QUALITY_BONUS.NO_ISSUES;

    // Total
    const total = Math.max(0, base + speedBonus + qualityBonus);

    return {
        base,
        speedBonus,
        qualityBonus,
        total,
        duration,
    };
};

/**
 * Get a descriptive message for the points earned
 */
export const getPointsMessage = (breakdown: PointsBreakdown): string => {
    const messages: string[] = [];

    messages.push(`نقاط أساسية: +${breakdown.base}`);

    if (breakdown.speedBonus > 0) {
        messages.push(`مكافأة السرعة: +${breakdown.speedBonus}`);
    } else if (breakdown.speedBonus < 0) {
        messages.push(`خصم التأخير: ${breakdown.speedBonus}`);
    }

    if (breakdown.qualityBonus > 0) {
        messages.push(`مكافأة الجودة: +${breakdown.qualityBonus}`);
    }

    messages.push(`الإجمالي: ${breakdown.total} نقطة`);
    messages.push(`الوقت: ${breakdown.duration} دقيقة`);

    return messages.join('\n');
};

/**
 * Get emoji based on performance
 */
export const getPerformanceEmoji = (breakdown: PointsBreakdown): string => {
    if (breakdown.total >= 7) return '🌟'; // Excellent
    if (breakdown.total >= 5) return '⭐'; // Good
    if (breakdown.total >= 3) return '👍'; // Okay
    return '📊'; // Needs improvement
};

// ============================================================
// MAINTENANCE POINTS
// ============================================================

export type MaintenanceType = 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';

export interface MaintenancePointsBreakdown {
    typeBonus: number;
    speedBonus: number;
    total: number;
    duration: number;
}

const MAINTENANCE_RULES = {
    TYPE_BONUS: {
        electrical: 5,
        plumbing: 4,
        ac: 4,
        furniture: 3,
        other: 3,
    },
    SPEED_BONUS: {
        FAST: { maxMinutes: 20, bonus: 2 },
        NORMAL: { maxMinutes: 40, bonus: 1 },
        SLOW: { bonus: -1 },
    },
};

/**
 * Calculate points for a maintenance task
 * @param type - Type of maintenance (electrical, plumbing, etc.)
 * @param startTime - When maintenance started
 * @param endTime - When maintenance completed
 */
export const calculateMaintenancePoints = (
    type: MaintenanceType,
    startTime: Date,
    endTime: Date,
    settings: any = {}
): MaintenancePointsBreakdown => {
    // Calculate duration in minutes
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));

    // Type bonus
    const typeBonus = MAINTENANCE_RULES.TYPE_BONUS[type] || 3;

    // Speed bonus
    const maintSettings = settings.maintenance || {};
    const fastTime = maintSettings.fastTime || MAINTENANCE_RULES.SPEED_BONUS.FAST.maxMinutes;
    const normalTime = maintSettings.delayTime || MAINTENANCE_RULES.SPEED_BONUS.NORMAL.maxMinutes;

    const fastBonus = maintSettings.fast || MAINTENANCE_RULES.SPEED_BONUS.FAST.bonus;
    const normalBonus = maintSettings.normal || MAINTENANCE_RULES.SPEED_BONUS.NORMAL.bonus;
    const slowBonus = maintSettings.delay || MAINTENANCE_RULES.SPEED_BONUS.SLOW.bonus;

    let speedBonus = 0;
    if (duration < fastTime) {
        speedBonus = fastBonus;
    } else if (duration <= normalTime) {
        speedBonus = normalBonus;
    } else {
        speedBonus = slowBonus;
    }

    // Total
    const total = Math.max(0, typeBonus + speedBonus);

    return {
        typeBonus,
        speedBonus,
        total,
        duration,
    };
};

/**
 * Get maintenance type label in Arabic
 */
export const getMaintenanceTypeLabel = (type: MaintenanceType): string => {
    const labels: Record<MaintenanceType, string> = {
        electrical: 'كهرباء',
        plumbing: 'سباكة',
        ac: 'تكييف',
        furniture: 'أثاث',
        other: 'أخرى',
    };
    return labels[type] || 'أخرى';
};

// ============================================================
// BELLMAN POINTS
// ============================================================

export type BellmanAction = 'check-in' | 'check-out';

const BELLMAN_POINTS = {
    'check-in': 2,
    'check-out': 2,
};

/**
 * Calculate points for bellman action
 * @param action - 'check-in' or 'check-out'
 */
export const calculateBellmanPoints = (action: BellmanAction): number => {
    return BELLMAN_POINTS[action] || 2;
};

// ============================================================
// RECEPTION VERIFICATION POINTS (Guest Portal)
// ============================================================

export interface VerificationPointsBreakdown {
    base: number;          // نقاط أساسية (فحص وموافقة)
    speedBonus: number;    // مكافأة السرعة (< حد التحويل التلقائي)
    autoBonus: number;     // خصم للتحويل التلقائي
    total: number;
    duration: number;      // بالدقائق
}

/**
 * Calculate points for guest verification (reception)
 * @param verificationStartTime - When verification request was created
 * @param verificationEndTime - When verification was approved/rejected
 * @param isAutoApproved - Whether request was auto-approved (timeout)
 * @param settings - Manager-configurable settings (SaaS dynamic)
 */
export const calculateVerificationPoints = (
    verificationStartTime: Date,
    verificationEndTime: Date,
    isAutoApproved: boolean,
    settings: any = {}
): VerificationPointsBreakdown => {
    // Calculate duration in minutes
    const duration = Math.round((verificationEndTime.getTime() - verificationStartTime.getTime()) / (1000 * 60));

    // ⚙️ Get Manager-Configurable Settings (SaaS Dynamic)
    const receptionSettings = settings.reception || {};
    const basePoints = receptionSettings.verificationBase || 2;
    const autoApprovalTimeout = receptionSettings.autoApprovalTimeout || 5; // المدير يحددها (5, 8, 10, 15 دقيقة...)
    const speedBonusValue = receptionSettings.speedBonus || 3;
    const autoApprovalPenalty = receptionSettings.autoPenalty || -1; // خصم للتحويل التلقائي

    // Speed bonus (استجابة سريعة قبل التحويل التلقائي)
    let speedBonus = 0;
    if (duration < autoApprovalTimeout && !isAutoApproved) {
        speedBonus = speedBonusValue;
    }

    // Auto-approval penalty (موظف لم يستجب في الوقت المحدد)
    let autoBonus = 0;
    if (isAutoApproved) {
        autoBonus = autoApprovalPenalty;
    }

    // Total
    const total = Math.max(0, basePoints + speedBonus + autoBonus);

    return {
        base: basePoints,
        speedBonus,
        autoBonus,
        total,
        duration,
    };
};

/**
 * Get verification points message in Arabic
 */
export const getVerificationPointsMessage = (breakdown: VerificationPointsBreakdown): string => {
    const messages: string[] = [];

    messages.push(`نقاط أساسية: +${breakdown.base}`);

    if (breakdown.speedBonus > 0) {
        messages.push(`مكافأة السرعة: +${breakdown.speedBonus}`);
    }

    if (breakdown.autoBonus < 0) {
        messages.push(`خصم التأخير: ${breakdown.autoBonus}`);
    }

    messages.push(`الإجمالي: ${breakdown.total} نقطة`);
    messages.push(`وقت الاستجابة: ${breakdown.duration} دقيقة`);

    return messages.join('\n');
};
