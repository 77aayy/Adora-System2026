/**
 * Daily Tips Service
 * Productivity tips and notifications
 * Adora Hotel Management System V2
 */

// ============================================================
// TIPS DATA
// ============================================================

interface Tip {
    id: string;
    text: string;
    textEn: string;
    category: 'productivity' | 'quality' | 'safety' | 'guest' | 'points';
    department?: string;
}

const TIPS: Tip[] = [
    // General productivity
    { id: '1', text: 'تأكد من تحديث حالة الطلبات فوراً لتجنب التأخير', textEn: 'Update request status immediately to avoid delays', category: 'productivity' },
    { id: '2', text: 'اختصارات لوحة المفاتيح توفر وقتك: C للتأكيد، S للبدء', textEn: 'Keyboard shortcuts save time: C to confirm, S to start', category: 'productivity' },
    { id: '3', text: 'تحقق من ملاحظات الوردية قبل البدء بالعمل', textEn: 'Check shift notes before starting work', category: 'productivity' },

    // Quality
    { id: '4', text: 'الصور توثق العمل وتحمي الجميع', textEn: 'Photos document work and protect everyone', category: 'quality' },
    { id: '5', text: 'دقة التفاصيل تصنع الفرق في رضا الضيف', textEn: 'Attention to detail makes all the difference', category: 'quality' },
    { id: '6', text: 'تأكد من فحص الميني بار بشكل دقيق', textEn: 'Check minibar carefully during inspection', category: 'quality', department: 'housekeeping' },

    // Safety
    { id: '7', text: 'سلامتك أولاً - استخدم المعدات المناسبة', textEn: 'Safety first - use proper equipment', category: 'safety' },
    { id: '8', text: 'أبلغ عن أي مشكلة أمنية فوراً', textEn: 'Report any security issues immediately', category: 'safety' },

    // Guest service
    { id: '9', text: 'ابتسامتك تصنع الفرق في تجربة الضيف', textEn: 'Your smile makes a difference', category: 'guest' },
    { id: '10', text: 'استخدم اسم الضيف لتخصيص الخدمة', textEn: 'Use guest name to personalize service', category: 'guest' },
    { id: '11', text: 'ضيوف VIP يستحقون اهتماماً خاصاً', textEn: 'VIP guests deserve special attention', category: 'guest' },

    // Points
    { id: '12', text: 'كل طلب مكتمل = نقاط إضافية!', textEn: 'Every completed request = more points!', category: 'points' },
    { id: '13', text: 'الإنجاز السريع يمنحك نقاطاً إضافية', textEn: 'Quick completion earns bonus points', category: 'points' },
    { id: '14', text: 'تحقق من لوحة المتصدرين يومياً', textEn: 'Check the leaderboard daily', category: 'points' },

    // Department specific
    { id: '15', text: 'تأكد من عدد الأمتعة قبل وبعد النقل', textEn: 'Count luggage before and after transfer', category: 'quality', department: 'bellman' },
    { id: '16', text: 'فحص التكييف والمياه أولوية في الصيانة', textEn: 'AC and water issues are priority', category: 'productivity', department: 'maintenance' },
    { id: '17', text: 'تأكيد الطلبات خلال 5 دقائق من وصولها', textEn: 'Confirm requests within 5 minutes', category: 'productivity', department: 'reception' },
];

// ============================================================
// STATE
// ============================================================

let shownTipIds: Set<string> = new Set();
let tipInterval: number | null = null;
let tipCallback: ((tip: Tip) => void) | null = null;

// ============================================================
// CORE FUNCTIONS
// ============================================================

/**
 * Get random tip
 */
export const getRandomTip = (department?: string): Tip => {
    let availableTips = TIPS.filter(t => !shownTipIds.has(t.id));

    // Filter by department if specified
    if (department) {
        const deptTips = availableTips.filter(t => !t.department || t.department === department);
        if (deptTips.length > 0) {
            availableTips = deptTips;
        }
    }

    // Reset if all shown
    if (availableTips.length === 0) {
        shownTipIds.clear();
        availableTips = TIPS;
    }

    const tip = availableTips[Math.floor(Math.random() * availableTips.length)];
    shownTipIds.add(tip.id);

    return tip;
};

/**
 * Get tip of the day
 */
export const getTipOfTheDay = (department?: string): Tip => {
    // Use date as seed for consistent daily tip
    const today = new Date().toISOString().split('T')[0];
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);

    let tips = TIPS;
    if (department) {
        tips = TIPS.filter(t => !t.department || t.department === department);
    }

    const index = seed % tips.length;
    return tips[index];
};

/**
 * Get tips by category
 */
export const getTipsByCategory = (category: Tip['category']): Tip[] => {
    return TIPS.filter(t => t.category === category);
};

/**
 * Get tips for department
 */
export const getTipsForDepartment = (department: string): Tip[] => {
    return TIPS.filter(t => !t.department || t.department === department);
};

// ============================================================
// AUTO TIPS
// ============================================================

/**
 * Start auto tips (show tip every interval)
 */
export const startAutoTips = (
    callback: (tip: Tip) => void,
    intervalMinutes = 30,
    department?: string
): void => {
    tipCallback = callback;

    // Show first tip immediately
    callback(getRandomTip(department));

    // Schedule next tips
    tipInterval = window.setInterval(() => {
        if (tipCallback) {
            tipCallback(getRandomTip(department));
        }
    }, intervalMinutes * 60 * 1000);
};

/**
 * Stop auto tips
 */
export const stopAutoTips = (): void => {
    if (tipInterval) {
        clearInterval(tipInterval);
        tipInterval = null;
    }
    tipCallback = null;
};

// ============================================================
// UI HELPERS
// ============================================================

/**
 * Show tip notification
 */
export const showTipNotification = (tip: Tip): void => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `
        fixed bottom-24 left-1/2 -translate-x-1/2 z-[9998]
        bg-gradient-to-r from-primary-600 to-primary-700
        text-white px-6 py-4 rounded-2xl shadow-xl
        max-w-sm text-center
        animate-slide-up
    `;

    const icons: Record<Tip['category'], string> = {
        productivity: '⚡',
        quality: '✨',
        safety: '🛡️',
        guest: '😊',
        points: '⭐'
    };

    notification.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-2xl">${icons[tip.category]}</span>
            <div class="text-right">
                <p class="font-medium">${tip.text}</p>
                <p class="text-xs text-white/60 mt-1">نصيحة اليوم</p>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slide-down 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
};

/**
 * Show tip modal
 */
export const showTipModal = (tip: Tip): void => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-6';

    modal.innerHTML = `
        <div class="glass-card p-6 rounded-2xl max-w-sm text-center">
            <div class="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl">💡</span>
            </div>
            <h3 class="text-xl font-bold text-white mb-3">نصيحة اليوم</h3>
            <p class="text-white/80 mb-6">${tip.text}</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full btn-primary py-3">
                فهمت!
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useDailyTips = (department?: string, autoShow = false, intervalMinutes = 30) => {
    const [currentTip, setCurrentTip] = useState<Tip | null>(null);

    useEffect(() => {
        // Get tip of the day
        setCurrentTip(getTipOfTheDay(department));

        // Start auto tips if enabled
        if (autoShow) {
            startAutoTips(setCurrentTip, intervalMinutes, department);
            return () => stopAutoTips();
        }
    }, [department, autoShow, intervalMinutes]);

    const nextTip = useCallback(() => {
        setCurrentTip(getRandomTip(department));
    }, [department]);

    const showNotification = useCallback(() => {
        if (currentTip) {
            showTipNotification(currentTip);
        }
    }, [currentTip]);

    const showModal = useCallback(() => {
        if (currentTip) {
            showTipModal(currentTip);
        }
    }, [currentTip]);

    return {
        tip: currentTip,
        nextTip,
        showNotification,
        showModal,
        allTips: TIPS,
        categoryTips: (cat: Tip['category']) => getTipsByCategory(cat)
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    getRandomTip,
    getTipOfTheDay,
    getTipsByCategory,
    getTipsForDepartment,
    startAutoTips,
    stopAutoTips,
    showTipNotification,
    showTipModal,
    useDailyTips
};
