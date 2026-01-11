/**
 * Rewards System
 * Advanced gamification with badges and levels
 * Adora Hotel Management System V2
 */

import { doc, updateDoc, getDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    condition: string;
    points: number;
}

export interface Level {
    level: number;
    name: string;
    minPoints: number;
    icon: string;
    benefits: string[];
}

// ============================================================
// BADGES
// ============================================================

export const BADGES: Badge[] = [
    // Achievement Badges
    {
        id: 'first_task',
        name: 'البداية',
        description: 'أكملت أول مهمة لك',
        icon: '🎯',
        condition: 'firstTask',
        points: 10,
    },
    {
        id: 'speed_demon',
        name: 'سريع البرق',
        description: 'أكملت 5 مهام في أقل من 10 دقائق لكل مهمة',
        icon: '⚡',
        condition: 'speedDemon',
        points: 25,
    },
    {
        id: 'early_bird',
        name: 'طائر الصباح',
        description: 'أكملت 10 مهام قبل الساعة 8 صباحاً',
        icon: '🌅',
        condition: 'earlyBird',
        points: 20,
    },
    {
        id: 'night_owl',
        name: 'بومة الليل',
        description: 'أكملت 10 مهام بعد الساعة 10 مساءً',
        icon: '🦉',
        condition: 'nightOwl',
        points: 20,
    },
    {
        id: 'perfectionist',
        name: 'الكمال',
        description: 'أكملت 20 مهمة بدون أي مشاكل',
        icon: '✨',
        condition: 'perfectionist',
        points: 50,
    },
    {
        id: 'team_player',
        name: 'روح الفريق',
        description: 'ساعدت زميلاً في إتمام مهمته',
        icon: '🤝',
        condition: 'teamPlayer',
        points: 15,
    },
    {
        id: 'marathon',
        name: 'الماراثون',
        description: 'أكملت 50 مهمة في أسبوع واحد',
        icon: '🏃',
        condition: 'marathon',
        points: 100,
    },
    {
        id: 'centurion',
        name: 'المئوي',
        description: 'أكملت 100 مهمة',
        icon: '💯',
        condition: 'centurion',
        points: 200,
    },

    // Department Specific
    {
        id: 'cleaning_master',
        name: 'سيد النظافة',
        description: 'أكملت 50 مهمة تنظيف',
        icon: '🧹',
        condition: 'cleaningMaster',
        points: 75,
    },
    {
        id: 'fix_it',
        name: 'المصلح',
        description: 'أصلحت 30 عطلاً',
        icon: '🔧',
        condition: 'fixIt',
        points: 75,
    },
    {
        id: 'guest_favorite',
        name: 'محبوب الضيوف',
        description: 'حصلت على 10 تقييمات إيجابية',
        icon: '⭐',
        condition: 'guestFavorite',
        points: 100,
    },
];

// ============================================================
// LEVELS
// ============================================================

export const LEVELS: Level[] = [
    {
        level: 1,
        name: 'مبتدئ',
        minPoints: 0,
        icon: '🌱',
        benefits: [],
    },
    {
        level: 2,
        name: 'متدرب',
        minPoints: 100,
        icon: '🌿',
        benefits: ['شارة المستوى 2'],
    },
    {
        level: 3,
        name: 'موظف',
        minPoints: 300,
        icon: '🌲',
        benefits: ['أولوية في اختيار المهام'],
    },
    {
        level: 4,
        name: 'محترف',
        minPoints: 600,
        icon: '⭐',
        benefits: ['مكافأة أسبوعية'],
    },
    {
        level: 5,
        name: 'خبير',
        minPoints: 1000,
        icon: '🌟',
        benefits: ['يوم إجازة إضافي شهرياً'],
    },
    {
        level: 6,
        name: 'نخبة',
        minPoints: 2000,
        icon: '💫',
        benefits: ['زيادة 5% على الراتب'],
    },
    {
        level: 7,
        name: 'أسطورة',
        minPoints: 5000,
        icon: '👑',
        benefits: ['موظف الشهر', 'مكافأة خاصة'],
    },
];

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Get user's current level
 */
export const getUserLevel = (points: number): Level => {
    const level = [...LEVELS].reverse().find(l => points >= l.minPoints);
    return level || LEVELS[0];
};

/**
 * Get progress to next level
 */
export const getLevelProgress = (points: number): { current: Level; next: Level | null; progress: number } => {
    const current = getUserLevel(points);
    const currentIndex = LEVELS.findIndex(l => l.level === current.level);
    const next = LEVELS[currentIndex + 1] || null;

    if (!next) {
        return { current, next: null, progress: 100 };
    }

    const pointsInLevel = points - current.minPoints;
    const pointsNeeded = next.minPoints - current.minPoints;
    const progress = Math.min(100, (pointsInLevel / pointsNeeded) * 100);

    return { current, next, progress };
};

/**
 * Award a badge to user
 */
export const awardBadge = async (userId: string, badgeId: string): Promise<boolean> => {
    const badge = BADGES.find(b => b.id === badgeId);
    if (!badge) return false;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    const existingBadges = userData.badges || [];

    // Check if already has badge
    if (existingBadges.includes(badgeId)) return false;

    // Award badge and points
    await updateDoc(userRef, {
        badges: arrayUnion(badgeId),
        points: (userData.points || 0) + badge.points,
        lastBadge: {
            id: badgeId,
            awardedAt: Timestamp.now(),
        },
    });

    return true;
};

/**
 * Check and award applicable badges
 */
export const checkAndAwardBadges = async (
    userId: string,
    stats: {
        totalTasks: number;
        fastTasks: number;
        earlyTasks: number;
        lateTasks: number;
        cleaningTasks: number;
        maintenanceTasks: number;
        perfectTasks: number;
    }
): Promise<string[]> => {
    const awarded: string[] = [];

    // First task
    if (stats.totalTasks === 1) {
        if (await awardBadge(userId, 'first_task')) awarded.push('first_task');
    }

    // Speed demon
    if (stats.fastTasks >= 5) {
        if (await awardBadge(userId, 'speed_demon')) awarded.push('speed_demon');
    }

    // Centurion
    if (stats.totalTasks >= 100) {
        if (await awardBadge(userId, 'centurion')) awarded.push('centurion');
    }

    // Cleaning master
    if (stats.cleaningTasks >= 50) {
        if (await awardBadge(userId, 'cleaning_master')) awarded.push('cleaning_master');
    }

    // Fix it
    if (stats.maintenanceTasks >= 30) {
        if (await awardBadge(userId, 'fix_it')) awarded.push('fix_it');
    }

    return awarded;
};

/**
 * Get all badges for display
 */
export const getAllBadges = (): Badge[] => BADGES;

/**
 * Get user's earned badges
 */
export const getUserBadges = async (userId: string): Promise<Badge[]> => {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const badgeIds = userDoc.data().badges || [];
    return BADGES.filter(b => badgeIds.includes(b.id));
};
