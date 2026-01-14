/**
 * 🎯 Unified Department Tabs
 * تبويبات موحدة لجميع الأقسام: جديد | قيد التنفيذ | مكتملة
 * 
 * Features:
 * - Three fixed tabs across all departments
 * - Real-time count badges
 * - Consistent styling (Adora theme)
 * - Responsive design
 */

import React, { useMemo } from 'react';
import { Inbox, Clock, CheckCircle2, LucideIcon } from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

export type TabId = 'new' | 'in_progress' | 'completed';

interface Tab {
    id: TabId;
    label: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
}

interface UnifiedDepartmentTabsProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
    counts: {
        new: number;
        in_progress: number;
        completed: number;
    };
    className?: string;
}

// ============================================================
// TABS CONFIGURATION
// ============================================================

const TABS: Tab[] = [
    {
        id: 'new',
        label: 'جديد',
        icon: Inbox,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500'
    },
    {
        id: 'in_progress',
        label: 'قيد التنفيذ',
        icon: Clock,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500'
    },
    {
        id: 'completed',
        label: 'مكتملة',
        icon: CheckCircle2,
        color: 'text-teal-500',
        bgColor: 'bg-teal-500/10',
        borderColor: 'border-teal-500'
    }
];

// ============================================================
// COMPONENT
// ============================================================

export const UnifiedDepartmentTabs: React.FC<UnifiedDepartmentTabsProps> = ({
    activeTab,
    onTabChange,
    counts,
    className = ''
}) => {
    // Calculate total for indicator
    const total = useMemo(() => counts.new + counts.in_progress + counts.completed, [counts]);

    return (
        <div className={`flex gap-2 p-1 rounded-xl adora-bg-secondary ${className}`}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                const count = counts[tab.id];
                const Icon = tab.icon;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg
                            font-medium text-sm transition-all duration-200
                            ${isActive 
                                ? `${tab.bgColor} ${tab.color} ${tab.borderColor} border-2 shadow-sm` 
                                : 'adora-text-secondary hover:adora-bg-tertiary border-2 border-transparent'
                            }
                        `}
                    >
                        <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        
                        {/* Count Badge */}
                        <span className={`
                            min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold
                            flex items-center justify-center
                            ${isActive 
                                ? `${tab.bgColor.replace('/10', '/20')} ${tab.color}` 
                                : 'adora-bg-tertiary adora-text-tertiary'
                            }
                            ${count > 0 && tab.id === 'new' ? 'animate-pulse' : ''}
                        `}>
                            {count}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

// ============================================================
// COMPACT VERSION (for mobile)
// ============================================================

export const CompactDepartmentTabs: React.FC<UnifiedDepartmentTabsProps> = ({
    activeTab,
    onTabChange,
    counts,
    className = ''
}) => {
    return (
        <div className={`flex gap-1 ${className}`}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                const count = counts[tab.id];
                const Icon = tab.icon;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded-lg
                            text-xs transition-all duration-200
                            ${isActive 
                                ? `${tab.bgColor} ${tab.color} shadow-sm` 
                                : 'adora-text-secondary'
                            }
                        `}
                    >
                        <div className="relative">
                            <Icon className={`w-5 h-5 ${isActive ? tab.color : ''}`} />
                            {count > 0 && (
                                <span className={`
                                    absolute -top-1 -right-1 min-w-[14px] h-3.5 px-1
                                    rounded-full text-[9px] font-bold
                                    flex items-center justify-center
                                    ${tab.id === 'new' ? 'bg-orange-500 text-white' : ''}
                                    ${tab.id === 'in_progress' ? 'bg-blue-500 text-white' : ''}
                                    ${tab.id === 'completed' ? 'bg-teal-500 text-white' : ''}
                                `}>
                                    {count}
                                </span>
                            )}
                        </div>
                        <span className="truncate max-w-full">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

// ============================================================
// HOOK: Use Workflow Tabs
// ============================================================

import { useState, useEffect } from 'react';
import { subscribeToWorkflowCards, DepartmentId } from '../../services/workflowService';

export function useWorkflowTabs(
    tenantId: string | undefined,
    branchId: string | undefined,
    department: DepartmentId
) {
    const [activeTab, setActiveTab] = useState<TabId>('new');
    const [cards, setCards] = useState<{
        new: any[];
        in_progress: any[];
        completed: any[];
    }>({
        new: [],
        in_progress: [],
        completed: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tenantId || !branchId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        
        const unsubscribe = subscribeToWorkflowCards(
            tenantId,
            branchId,
            department,
            (result) => {
                setCards({
                    new: result.new,
                    in_progress: result.inProgress,
                    completed: result.completed
                });
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId, branchId, department]);

    const counts = {
        new: cards.new.length,
        in_progress: cards.in_progress.length,
        completed: cards.completed.length
    };

    const currentCards = cards[activeTab.replace('-', '_') as keyof typeof cards] || [];

    return {
        activeTab,
        setActiveTab,
        cards,
        currentCards,
        counts,
        loading
    };
}

export default UnifiedDepartmentTabs;
