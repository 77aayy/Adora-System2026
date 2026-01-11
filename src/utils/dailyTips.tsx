/**
 * Daily Tips System
 * Rotating tips for employees
 * Adora Hotel Management System V2
 */

import { useState, useEffect } from 'react';

// ============================================================
// TIPS DATA
// ============================================================

export interface DailyTip {
    id: string;
    category: 'general' | 'reception' | 'housekeeping' | 'maintenance' | 'bellman';
    title: string;
    content: string;
    icon: string;
}

const TIPS: DailyTip[] = [
    // General Tips
    {
        id: 'gen1',
        category: 'general',
        title: 'ابتسم دائماً',
        content: 'الابتسامة هي أول ما يراه الضيف وتترك انطباعاً دائماً',
        icon: '😊',
    },
    {
        id: 'gen2',
        category: 'general',
        title: 'الاستماع الفعال',
        content: 'استمع جيداً لطلبات الضيف قبل الرد لتفهم احتياجاته بشكل أفضل',
        icon: '👂',
    },
    {
        id: 'gen3',
        category: 'general',
        title: 'السرعة في الاستجابة',
        content: 'كلما كانت استجابتك أسرع، زاد رضا الضيف',
        icon: '⚡',
    },

    // Reception Tips
    {
        id: 'rec1',
        category: 'reception',
        title: 'التحقق من البيانات',
        content: 'تأكد من صحة بيانات الضيف قبل تأكيد الحجز',
        icon: '✅',
    },
    {
        id: 'rec2',
        category: 'reception',
        title: 'الترحيب الحار',
        content: 'رحب بالضيف باسمه إن أمكن - هذا يُشعره بالتقدير',
        icon: '🤝',
    },
    {
        id: 'rec3',
        category: 'reception',
        title: 'التنسيق مع الأقسام',
        content: 'تأكد من تنسيق الطلبات مع القسم المختص قبل إبلاغ الضيف بوقت التنفيذ',
        icon: '📋',
    },

    // Housekeeping Tips
    {
        id: 'hk1',
        category: 'housekeeping',
        title: 'فحص الغرفة بدقة',
        content: 'افحص جميع الزوايا والأماكن المخفية - الضيف يلاحظ التفاصيل',
        icon: '🔍',
    },
    {
        id: 'hk2',
        category: 'housekeeping',
        title: 'الميني بار',
        content: 'تأكد من تعبئة الميني بار وترتيب المنتجات بشكل جذاب',
        icon: '🥤',
    },
    {
        id: 'hk3',
        category: 'housekeeping',
        title: 'النظافة الشخصية',
        content: 'حافظ على نظافتك الشخصية وارتدِ القفازات عند التنظيف',
        icon: '🧤',
    },

    // Maintenance Tips
    {
        id: 'mt1',
        category: 'maintenance',
        title: 'توثيق العمل',
        content: 'التقط صوراً قبل وبعد الإصلاح لتوثيق جودة العمل',
        icon: '📸',
    },
    {
        id: 'mt2',
        category: 'maintenance',
        title: 'السلامة أولاً',
        content: 'تأكد من إغلاق الكهرباء والمياه قبل الصيانة',
        icon: '⚠️',
    },
    {
        id: 'mt3',
        category: 'maintenance',
        title: 'إبلاغ الضيف',
        content: 'أخبر الضيف بالوقت المتوقع للإصلاح والتزم به',
        icon: '⏰',
    },

    // Bellman Tips
    {
        id: 'bl1',
        category: 'bellman',
        title: 'التعامل مع الأمتعة',
        content: 'تعامل مع أمتعة الضيف بعناية كأنها ملكك',
        icon: '🧳',
    },
    {
        id: 'bl2',
        category: 'bellman',
        title: 'معرفة الفندق',
        content: 'كن ملماً بجميع مرافق الفندق لتجيب على استفسارات الضيوف',
        icon: '🏨',
    },
    {
        id: 'bl3',
        category: 'bellman',
        title: 'العربة',
        content: 'تأكد من أن العربة نظيفة ومجهزة دائماً',
        icon: '🛒',
    },
];

// ============================================================
// FUNCTIONS
// ============================================================

/**
 * Get tip of the day based on date
 */
export const getTipOfTheDay = (department?: string): DailyTip => {
    const today = new Date();
    const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Filter by department if provided
    const relevantTips = department
        ? TIPS.filter(t => t.category === department || t.category === 'general')
        : TIPS;

    const tipIndex = dayOfYear % relevantTips.length;
    return relevantTips[tipIndex];
};

/**
 * Get random tip
 */
export const getRandomTip = (department?: string): DailyTip => {
    const relevantTips = department
        ? TIPS.filter(t => t.category === department || t.category === 'general')
        : TIPS;

    const randomIndex = Math.floor(Math.random() * relevantTips.length);
    return relevantTips[randomIndex];
};

/**
 * Get all tips for a department
 */
export const getTipsForDepartment = (department: string): DailyTip[] => {
    return TIPS.filter(t => t.category === department || t.category === 'general');
};

// ============================================================
// REACT HOOK
// ============================================================

/**
 * React hook for daily tip
 */
export const useDailyTip = (department?: string) => {
    const [tip, setTip] = useState<DailyTip | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Check if already seen today
        const lastSeen = localStorage.getItem('adora_tip_last_seen');
        const today = new Date().toDateString();

        if (lastSeen !== today) {
            setTip(getTipOfTheDay(department));
            setDismissed(false);
        } else {
            setDismissed(true);
        }
    }, [department]);

    const dismissTip = () => {
        localStorage.setItem('adora_tip_last_seen', new Date().toDateString());
        setDismissed(true);
    };

    return {
        tip: dismissed ? null : tip,
        dismissTip,
        getNewTip: () => setTip(getRandomTip(department)),
    };
};

// ============================================================
// TIP CARD COMPONENT
// ============================================================

import React from 'react';
import { X, Lightbulb, RefreshCw } from 'lucide-react';

interface TipCardProps {
    department?: string;
}

export const TipCard: React.FC<TipCardProps> = ({ department }) => {
    const { tip, dismissTip, getNewTip } = useDailyTip(department);

    if (!tip) return null;

    return (
        <div className="glass rounded-2xl p-4 mb-4 relative overflow-hidden">
            {/* Background icon */}
            <div className="absolute top-2 left-2 text-4xl opacity-20">
                {tip.icon}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-yellow-400">نصيحة اليوم</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={getNewTip}
                        className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/50 hover:text-white"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={dismissTip}
                        className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/50 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <h3 className="text-white font-bold mb-1">{tip.title}</h3>
            <p className="text-white/70 text-sm">{tip.content}</p>
        </div>
    );
};

export default useDailyTip;
