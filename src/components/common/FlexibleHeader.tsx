/**
 * Flexible Header Component
 * Mobile-first, responsive header for all dashboards
 * Adora Hotel Management System V2
 */

import React, { useState } from 'react';
import { Menu, X, LogOut, History, MessageSquare, ShoppingCart, Users, RefreshCw, FileText } from 'lucide-react';
import { HeaderButton } from './HeaderButton';
import { MobileMenu } from './MobileMenu';
import { useAuth } from '../../context/AuthContext';

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
}

export const FlexibleHeader: React.FC<FlexibleHeaderProps> = ({
    title,
    titleIcon,
    subtitle,
    actions = [],
    showLogout = true,
    className = ''
}) => {
    const { user, logout } = useAuth();
    const [showMobileMenu, setShowMobileMenu] = useState(false);

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
                        </div>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {/* Mobile: Show only critical actions (max 2) */}
                    <div className="flex gap-1.5 sm:hidden">
                        {headerActions.slice(0, 2).map(action => (
                            <HeaderButton
                                key={action.id}
                                onClick={action.onClick}
                                icon={action.icon}
                                label={action.label}
                                variant={action.variant}
                                count={action.count}
                            />
                        ))}
                        {headerActions.length > 2 && (
                            <button
                                onClick={() => setShowMobileMenu(true)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                    color: 'var(--theme-text-secondary)'
                                }}
                                aria-label="القائمة"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Tablet: Show more actions (max 4) */}
                    <div className="hidden sm:flex md:hidden gap-1.5">
                        {headerActions.slice(0, 4).map(action => (
                            <HeaderButton
                                key={action.id}
                                onClick={action.onClick}
                                icon={action.icon}
                                label={action.label}
                                variant={action.variant}
                                count={action.count}
                            />
                        ))}
                        {headerActions.length > 4 && (
                            <button
                                onClick={() => setShowMobileMenu(true)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                    color: 'var(--theme-text-secondary)'
                                }}
                                aria-label="القائمة"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Desktop: Show all actions */}
                    <div className="hidden md:flex gap-2">
                        {visibleActions.map(action => (
                            <HeaderButton
                                key={action.id}
                                onClick={action.onClick}
                                icon={action.icon}
                                label={action.label}
                                variant={action.variant}
                                count={action.count}
                                showLabel={action.showLabel}
                            />
                        ))}
                        {showLogout && !['manager', 'admin', 'owner'].includes(user?.role || '') && (
                            <HeaderButton
                                onClick={logout}
                                icon={<LogOut className="w-5 h-5" />}
                                label="تسجيل خروج"
                                variant="danger"
                            />
                        )}
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
