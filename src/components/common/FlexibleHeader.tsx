/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Flexible Header Component
 * Mobile-first, responsive header for all dashboards
 * Adora Hotel Management System V2
 * 
 * ✅ Updated: Now uses ResponsiveActionBar for consistent styling
 */

import React, { useState, useMemo } from 'react';
import { Menu, X, LogOut, History, MessageSquare, ShoppingCart, Users, RefreshCw, FileText } from 'lucide-react';
import { HeaderButton } from './HeaderButton';
import { MobileMenu } from './MobileMenu';
import { ResponsiveActionBar } from './ResponsiveActionBar'; // ✅ New unified action bar
import { useAuth } from '../../context/AuthContext';
import { getGreetingParts } from '../../utils/greetings';
import { useTranslation } from 'react-i18next';

interface HeaderAction {
    id: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'danger' | 'primary' | 'warning';
    count?: number;
    showOnMobile?: boolean; // Show in mobile menu even if hidden in header
    showLabel?: boolean; // Show label text on desktop
}

interface FlexibleHeaderProps {
    title: string;
    titleIcon?: React.ReactNode;
    subtitle?: string | React.ReactNode;
    actions?: HeaderAction[];
    showLogout?: boolean;
    className?: string;
    /** Enable dynamic greeting with user name */
    showGreeting?: boolean;
    /** Brand name to show below greeting */
    brandName?: string;
}

export const FlexibleHeader: React.FC<FlexibleHeaderProps> = ({
    title,
    titleIcon,
    subtitle,
    actions = [],
    showLogout = true,
    className = '',
    showGreeting = false,
    brandName
}) => {
    const { user, logout } = useAuth();
    const { t } = useTranslation();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    // Dynamic greeting based on time of day with i18n
    const greeting = useMemo(() => {
        if (!showGreeting || !user?.name) return null;
        return getGreetingParts(user.name, t);
    }, [showGreeting, user?.name, t]);

    // Filter actions based on user role
    const visibleActions = actions.filter(action => {
        if (action.id === 'logout' && !showLogout) return false;
        if (action.id === 'logout' && ['manager', 'admin', 'owner'].includes(user?.role || '')) return false;
        return true;
    });

    // Actions that should appear in mobile menu
    const mobileMenuActions = visibleActions.map(action => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        onClick: action.onClick,
        color: action.variant === 'danger' ? 'text-red-400' : action.variant === 'primary' ? 'text-blue-400' : 'text-white'
    }));

    // Actions that should appear in header (desktop + important mobile)
    const headerActions = visibleActions.filter(action => action.showOnMobile !== false);

    return (
        <>
            {/* Header - Fully Responsive & Theme-Aware - ✅ MOBILE-FIRST CLEAN LAYOUT */}
            <div 
                className={`flex items-center justify-between gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 md:mb-6 ${className}`}
                style={{ 
                    background: 'transparent', // ✅ FIX: No white gap
                    borderBottom: 'none' // ✅ FIX: No border causing visual pollution
                }}
            >
                {/* Left: Title & Subtitle - ✅ Mobile-First Clean Spacing */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                        {titleIcon && (
                            <div className="flex-shrink-0" style={{ color: 'var(--theme-primary-500)' }}>
                                {titleIcon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            {/* ✅ REMOVED: Static greeting - now only Smart Time-based greeting in right side */}
                            {/* Standard Title Mode Only - Mobile-First Responsive */}
                            <>
                                <h1 
                                    className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold truncate leading-tight"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {title}
                                </h1>
                                {subtitle && (
                                    <div 
                                        className="mt-0.5 sm:mt-1 md:mt-1.5 text-[10px] sm:text-xs md:text-sm truncate"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        {subtitle}
                                    </div>
                                )}
                                {showGreeting && brandName && (
                                    <div 
                                        className="mt-0.5 sm:mt-1 md:mt-1.5 text-[10px] sm:text-xs md:text-sm flex items-center gap-1"
                                        style={{ color: 'var(--theme-text-secondary)' }}
                                    >
                                        <span className="text-xs">🏨</span>
                                        <span className="truncate">{brandName}</span>
                                    </div>
                                )}
                            </>
                        </div>
                    </div>
                </div>

                {/* Right: Smart Greeting + Actions - ✅ Mobile-First Responsive */}
                <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
                    {/* ✅ NEW: Smart Time-based Greeting - Mobile Compact / Desktop Full */}
                    {showGreeting && greeting && user?.name && (
                        <>
                            {/* Mobile: Icon + Name Only (Compact) */}
                            <div 
                                className="flex md:hidden items-center gap-1 px-2 py-1 rounded-lg transition-all"
                                style={{ 
                                    background: 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                                title={`${greeting.emoji} ${greeting.timeGreeting}, ${user.name}`}
                            >
                                <span className="text-xs">{greeting.emoji}</span>
                                <span 
                                    className="text-xs font-bold truncate max-w-[60px]"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {user.name.split(' ')[0]}
                                </span>
                            </div>
                            
                            {/* Tablet/Desktop: Full Greeting */}
                            <div 
                                className="hidden md:flex items-center gap-1.5 lg:gap-2 px-2.5 md:px-3 py-1.5 rounded-lg transition-all"
                                style={{ 
                                    background: 'var(--theme-bg-secondary)',
                                    border: '1px solid var(--theme-border-primary)'
                                }}
                            >
                                <span 
                                    className="text-xs md:text-sm font-medium whitespace-nowrap"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    {greeting.emoji} {greeting.timeGreeting}
                                </span>
                                <span 
                                    className="text-xs md:text-sm font-bold whitespace-nowrap"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {user.name}
                                </span>
                            </div>
                        </>
                    )}

                    {/* Actions - ✅ Unified Responsive Action Bar */}
                    <div className="flex-shrink-0">
                        <ResponsiveActionBar
                            actions={visibleActions.map(action => ({
                                id: action.id,
                                icon: action.icon,
                                label: action.label,
                                onClick: action.onClick,
                                color: action.variant === 'danger' ? '#ef4444' 
                                     : action.variant === 'primary' ? '#14b8a6'
                                     : action.variant === 'warning' ? '#f59e0b'
                                     : undefined,
                                badge: action.count
                            }))}
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={showMobileMenu}
                onClose={() => setShowMobileMenu(false)}
                user={user || undefined}
                onLogout={logout}
                items={mobileMenuActions}
            />
        </>
    );
};
