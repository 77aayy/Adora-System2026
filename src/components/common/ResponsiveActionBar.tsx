/**
 * 🎯 Responsive Action Bar Component
 * نفس أسلوب تبويبات الهيدر (التحكم، استقبال، هاوس...)
 * 
 * Features:
 * - Desktop: أيقونات كاملة مع مسميات واضحة
 * - Mobile: تنسحب إلى 3 خطوط مع animation حلوة
 * - Smooth transitions between modes
 */

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronLeft } from 'lucide-react';

interface ActionItem {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    color?: string;
    badge?: number;
    isActive?: boolean; // ✅ For highlighting active/selected state
}

interface ResponsiveActionBarProps {
    actions: ActionItem[];
    className?: string;
}

export const ResponsiveActionBar: React.FC<ResponsiveActionBarProps> = ({
    actions,
    className = ''
}) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Check screen size and collapse if needed
    useEffect(() => {
        const checkSize = () => {
            // Collapse at 640px (sm breakpoint)
            setIsCollapsed(window.innerWidth < 640);
        };

        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    // Desktop/Tablet View - ✅ Premium Styling Matching Premium Header
    if (!isCollapsed) {
        return (
            <div className={`flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-2 scrollbar-hide ${className}`}>
                {actions.map((action) => (
                    <button
                        key={action.id}
                        onClick={action.onClick}
                        className={`group relative flex flex-col items-center justify-center gap-1.5
                            min-w-[64px] sm:min-w-[72px] lg:min-w-[80px] px-3 sm:px-4 py-2.5 sm:py-3
                            rounded-xl sm:rounded-2xl
                            border transition-all duration-300 ease-out
                            hover:scale-[1.02] active:scale-[0.98]
                            ${action.isActive 
                                ? 'bg-gradient-to-br from-teal-500/15 to-cyan-500/10 border-teal-400/40 dark:border-teal-500/50 shadow-lg shadow-teal-500/20' 
                                : 'bg-white/5 dark:bg-slate-800/30 backdrop-blur-sm border-white/10 dark:border-slate-700/30 hover:border-teal-400/30 dark:hover:border-teal-500/40 hover:bg-teal-500/5 dark:hover:bg-teal-500/5'
                            }`}
                        style={{
                            boxShadow: action.isActive 
                                ? '0 4px 12px rgba(20, 184, 166, 0.15)' 
                                : '0 2px 8px rgba(0,0,0,0.05)'
                        }}
                    >
                        {/* Badge */}
                        {action.badge && action.badge > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse z-10">
                                {action.badge > 9 ? '9+' : action.badge}
                            </span>
                        )}
                        
                        {/* Icon - Premium Styling */}
                        <span className={`w-5 h-5 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-all duration-300
                            ${action.isActive 
                                ? 'text-teal-500 dark:text-teal-400 scale-110' 
                                : 'text-slate-500 dark:text-slate-400 group-hover:text-teal-500 dark:group-hover:text-teal-400 group-hover:scale-110'
                            }`}
                        >
                            {action.icon}
                        </span>
                        
                        {/* Label - Premium Typography */}
                        <span className={`text-[10px] sm:text-xs lg:text-sm font-semibold text-center whitespace-nowrap leading-tight transition-colors duration-300
                            ${action.isActive 
                                ? 'text-teal-600 dark:text-teal-300' 
                                : 'text-slate-600 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400'
                            }`}
                        >
                            {action.label}
                        </span>
                    </button>
                ))}
            </div>
        );
    }

    // Mobile View - Collapsed to Hamburger Menu with Animation
    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Collapsed Button (3 Lines) */}
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={`
                    flex items-center gap-2 px-3 py-2 rounded-xl
                    bg-gradient-to-r from-teal-500 to-teal-600 
                    text-white font-medium
                    shadow-lg shadow-teal-500/30
                    hover:shadow-xl hover:shadow-teal-500/40
                    active:scale-95 transition-all duration-300
                    ${showMenu ? 'rotate-90' : ''}
                `}
            >
                <Menu className={`w-5 h-5 transition-transform duration-300 ${showMenu ? 'rotate-180' : ''}`} />
                <span className="text-sm">الإجراءات</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {actions.length}
                </span>
            </button>

            {/* Slide-in Menu */}
            <div 
                className={`
                    absolute top-full right-0 mt-2 z-50
                    backdrop-blur-xl
                    bg-white/95 dark:bg-slate-800/95
                    border border-slate-200/50 dark:border-white/10
                    rounded-2xl shadow-2xl shadow-black/20
                    overflow-hidden
                    transition-all duration-300 ease-out origin-top-right
                    ${showMenu 
                        ? 'opacity-100 scale-100 translate-y-0' 
                        : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }
                `}
                style={{ minWidth: '200px' }}
            >
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white">
                    <div className="flex items-center justify-between">
                        <span className="font-bold">الإجراءات السريعة</span>
                        <button 
                            onClick={() => setShowMenu(false)}
                            className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Actions List */}
                <div className="py-2 max-h-[60vh] overflow-y-auto">
                    {actions.map((action, index) => (
                        <button
                            key={action.id}
                            onClick={() => {
                                action.onClick();
                                setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3
                                hover:bg-teal-50 dark:hover:bg-teal-500/10
                                active:bg-teal-100 dark:active:bg-teal-500/20
                                transition-all duration-150"
                            style={{
                                animation: showMenu ? `slideIn 0.2s ease-out ${index * 0.05}s both` : undefined
                            }}
                        >
                            {/* Icon Container */}
                            <span 
                                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ 
                                    background: `${action.color || 'var(--theme-primary-500)'}20`,
                                    color: action.color || 'var(--theme-primary-500)'
                                }}
                            >
                                {action.icon}
                            </span>
                            
                            {/* Label */}
                            <span 
                                className="flex-1 text-right font-medium"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {action.label}
                            </span>

                            {/* Badge */}
                            {action.badge && action.badge > 0 && (
                                <span className="w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {action.badge > 9 ? '9+' : action.badge}
                                </span>
                            )}

                            {/* Arrow */}
                            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
            `}</style>
        </div>
    );
};

export default ResponsiveActionBar;
