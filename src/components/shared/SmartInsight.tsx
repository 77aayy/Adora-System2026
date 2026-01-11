import React, { useState } from 'react';
import { Sparkles, Lightbulb, Ghost, TrendingUp, AlertTriangle, X } from 'lucide-react';

export type InsightType = 'tip' | 'warning' | 'prediction' | 'ghost' | 'price';

interface SmartInsightProps {
    type: InsightType;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    autoExpand?: boolean;
}

export const SmartInsight: React.FC<SmartInsightProps> = ({
    type,
    title,
    description,
    actionLabel,
    onAction,
    autoExpand = false
}) => {
    const [isExpanded, setIsExpanded] = useState(autoExpand);
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    const getConfig = () => {
        switch (type) {
            case 'ghost':
                return {
                    icon: <Ghost size={18} className="text-purple-400" />,
                    bg: 'bg-purple-900/40',
                    border: 'border-purple-500/30',
                    text: 'text-purple-100',
                    glow: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                };
            case 'price':
                return {
                    icon: <TrendingUp size={18} className="text-emerald-400" />,
                    bg: 'bg-emerald-900/40',
                    border: 'border-emerald-500/30',
                    text: 'text-emerald-100',
                    glow: 'shadow-[0_0_15px_rgba(52,211,153,0.2)]'
                };
            case 'warning':
                return {
                    icon: <AlertTriangle size={18} className="text-amber-400" />,
                    bg: 'bg-amber-900/40',
                    border: 'border-amber-500/30',
                    text: 'text-amber-100',
                    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.2)]'
                };
            default:
                return {
                    icon: <Sparkles size={18} className="text-indigo-400" />,
                    bg: 'bg-indigo-900/40',
                    border: 'border-indigo-500/30',
                    text: 'text-indigo-100',
                    glow: 'shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                };
        }
    };

    const config = getConfig();

    return (
        <div
            className={`
                relative overflow-hidden transition-all duration-300 ease-in-out
                ${config.bg} ${config.border} border rounded-xl 
                ${isExpanded ? 'p-4' : 'p-2'} 
                ${isExpanded ? config.glow : ''}
                cursor-pointer group
            `}
            onClick={() => !isExpanded && setIsExpanded(true)}
            dir="rtl"
        >
            {/* Header / Collapsed State */}
            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-lg bg-black/20
                    ${!isExpanded && 'group-hover:scale-110 transition-transform'}
                `}>
                    {config.icon}
                </div>

                <div className="flex-1">
                    <h4 className={`text-sm font-semibold ${config.text} flex items-center gap-2`}>
                        {title}
                        {!isExpanded && (
                            <span className="text-xs opacity-60 font-normal mr-auto">
                                انقر للتفاصيل
                            </span>
                        )}
                    </h4>
                </div>

                {isExpanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsVisible(false); // Close completely
                        }}
                        className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            <div className={`
                transition-all duration-300 overflow-hidden
                ${isExpanded ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}
            `}>
                <p className="text-xs text-gray-300 leading-relaxed mr-[42px] mb-3">
                    {description}
                </p>

                {onAction && actionLabel && (
                    <div className="mr-[42px]">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction();
                            }}
                            className={`
                                text-xs px-3 py-1.5 rounded-lg
                                bg-white/10 hover:bg-white/20 
                                transition-colors text-white font-medium
                                flex items-center gap-2
                            `}
                        >
                            {actionLabel}
                        </button>
                    </div>
                )}
            </div>

            {/* Active AI Pulse Animation (Subtle) */}
            <div className={`
                absolute top-0 right-0 w-full h-full pointer-events-none
                bg-gradient-to-r from-transparent via-white/5 to-transparent
                animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity
            `} />

            <style>{`
                @keyframes shimmer {
                    from { transform: translateX(100%); }
                    to { transform: translateX(-100%); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite linear;
                }
            `}</style>
        </div>
    );
};
