/**
 * Mobile Menu Component (Hamburger Menu)
 * Drawer menu for mobile devices
 * Adora Hotel Management System
 */

import React from 'react';
import { X, History, MessageSquare, Users, ShoppingCart, Moon, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    color?: string;
    badge?: number;
}

interface MobileMenuProps {
    isOpen: boolean;
    onClose: () => void;
    items: MenuItem[];
    user?: { id?: string; name: string; role?: string };
    onLogout?: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
    isOpen,
    onClose,
    items,
    user,
    onLogout
}) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 z-40 lg:hidden" style={{ backdropFilter: 'none' }}
                onClick={onClose}
            />

            {/* Drawer - Opens from right (RTL) - Theme Aware */}
            <div
                className={`
                    fixed top-0 right-0 h-full w-80 max-w-[85vw] 
                    shadow-2xl z-50 lg:hidden
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
                style={{
                    background: 'var(--theme-bg-secondary)',
                    borderLeft: '1px solid var(--theme-border-primary)'
                }}
            >
                {/* Header - Theme Aware */}
                <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--theme-border-primary)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                            <span className="text-xl">🏨</span>
                        </div>
                        <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--theme-text-primary)' }}>{user?.name || t('common.user')}</p>
                            <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{user?.role === 'owner' ? t('roles.owner') : t('roles.employee')}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
                        style={{ 
                            background: 'var(--theme-bg-tertiary)', 
                            color: 'var(--theme-text-secondary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Menu Items - Theme Aware */}
                <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-180px)]">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                item.onClick();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-95 touch-manipulation"
                            style={{
                                background: 'var(--theme-bg-tertiary)',
                                border: '1px solid var(--theme-border-primary)',
                                color: item.color || 'var(--theme-text-primary)'
                            }}
                        >
                            <div style={{ color: item.color || 'var(--theme-text-secondary)' }}>
                                {item.icon}
                            </div>
                            <span className="flex-1 text-right font-medium text-sm">
                                {item.label}
                            </span>
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer - Logout with Zero-Inbox Check */}
                {onLogout && (
                    <div 
                        className="absolute bottom-0 left-0 right-0 p-4"
                        style={{ 
                            borderTop: '1px solid var(--theme-border-primary)',
                            background: 'var(--theme-bg-secondary)'
                        }}
                    >
                        <button
                            onClick={async () => {
                                try {
                                    onLogout();
                                    onClose();
                                } catch (e) {
                                    onLogout();
                                    onClose();
                                }
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/20 text-red-400 transition-all active:scale-95 touch-manipulation"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="flex-1 text-right font-medium text-sm">{t('auth.logout')}</span>
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
