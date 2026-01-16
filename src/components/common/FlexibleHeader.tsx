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
            {/* Header - Fully Responsive & Theme-Aware */}
            <div className={`flex items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6 ${className}`}>
                {/* Left: Title & Subtitle */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {titleIcon && (
                            <div className="flex-shrink-0" style={{ color: 'var(--theme-primary-500)' }}>
                                {titleIcon}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            {/* Dynamic Greeting Mode */}
                            {showGreeting && greeting ? (
                                <>
                                    <h1 
                                        className="text-lg sm:text-xl md:text-2xl font-bold truncate"
                                        style={{ color: 'var(--theme-text-primary)' }}
                                    >
                                        {greeting.emoji} {greeting.timeGreeting}, {greeting.motivational} {t('greetings.you') || 'you'} {user?.name}
                                    </h1>
                                    {brandName && (
                                        <div 
                                            className="mt-1 sm:mt-1.5 text-xs sm:text-sm flex items-center gap-1.5"
                                            style={{ color: 'var(--theme-text-secondary)' }}
                                        >
                                            🏨 {brandName}
                                        </div>
                                    )}
                                    {subtitle && (
                                        <div 
                                            className="mt-1 text-xs truncate"
                                            style={{ color: 'var(--theme-text-tertiary)' }}
                                        >
                                            {subtitle}
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Standard Title Mode */
                                <>
                                    <h1 
                                        className="text-xl sm:text-2xl md:text-3xl font-bold truncate"
                                        style={{ color: 'var(--theme-text-primary)' }}
                                    >
                                        {title}
                                    </h1>
                                    {subtitle && (
                                        <div 
                                            className="mt-1 sm:mt-1.5 text-xs sm:text-sm truncate"
                                            style={{ color: 'var(--theme-text-secondary)' }}
                                        >
                                            {subtitle}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Actions - ✅ Unified Responsive Action Bar */}
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
