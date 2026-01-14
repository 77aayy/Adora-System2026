/**
 * 🎯 Unified Request Tabs Component
 * التبويبات الموحدة لجميع الأقسام
 * 
 * ✅ نفس الشكل والألوان والحجم في كل الأقسام:
 * - جديد: برتقالي
 * - قيد التنفيذ: أزرق
 * - مكتمل: أخضر
 */

import React from 'react';

export type TabType = 'new' | 'in_progress' | 'completed';

interface Tab {
    key: TabType;
    label: string;
    count: number;
}

interface UnifiedRequestTabsProps {
    currentTab: TabType;
    onTabChange: (tab: TabType) => void;
    newCount: number;
    inProgressCount: number;
    completedCount: number;
}

// ✅ الألوان الموحدة - نفس الاستقبال بالضبط
const TAB_STYLES = {
    new: {
        activeClass: 'bg-orange-500 text-white shadow-lg shadow-orange-500/25',
        inactiveClass: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
    },
    in_progress: {
        activeClass: 'bg-blue-500 text-white shadow-lg shadow-blue-500/25',
        inactiveClass: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
    },
    completed: {
        activeClass: 'bg-green-500 text-white shadow-lg shadow-green-500/25',
        inactiveClass: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
    }
};

const TAB_LABELS: Record<TabType, string> = {
    new: 'جديد',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل'
};

export const UnifiedRequestTabs: React.FC<UnifiedRequestTabsProps> = ({
    currentTab,
    onTabChange,
    newCount,
    inProgressCount,
    completedCount
}) => {
    const tabs: Tab[] = [
        { key: 'new', label: TAB_LABELS.new, count: newCount },
        { key: 'in_progress', label: TAB_LABELS.in_progress, count: inProgressCount },
        { key: 'completed', label: TAB_LABELS.completed, count: completedCount }
    ];

    return (
        <div className="flex gap-1 sm:gap-2 mb-3 sm:mb-4 overflow-x-auto pb-1 -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
            {tabs.map(tab => {
                const isActive = currentTab === tab.key;
                const styles = TAB_STYLES[tab.key];
                
                return (
                    <button
                        key={tab.key}
                        onClick={() => onTabChange(tab.key)}
                        className={`
                            flex items-center gap-1 sm:gap-1.5 
                            px-2.5 sm:px-4 py-1.5 sm:py-2 
                            rounded-lg sm:rounded-xl 
                            whitespace-nowrap transition-all 
                            active:scale-95 touch-manipulation flex-shrink-0
                            text-xs sm:text-sm font-medium
                            ${isActive ? styles.activeClass : `${styles.inactiveClass} hover:opacity-80`}
                        `}
                    >
                        <span>{tab.label}</span>
                        <span className={`
                            px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-bold
                            ${isActive ? 'bg-white/25' : 'bg-current/20'}
                        `}>
                            {tab.count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default UnifiedRequestTabs;
