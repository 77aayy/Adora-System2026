/**
 * Keyboard Shortcuts Service
 * Global keyboard shortcuts
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface Shortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    description: string;
    descriptionAr: string;
    action: () => void;
    scope?: string;
}

// ============================================================
// STATE
// ============================================================

const shortcuts: Map<string, Shortcut> = new Map();
let enabled = true;
let helpModalOpen = false;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize keyboard shortcuts
 */
export const initKeyboardShortcuts = (): void => {
    document.addEventListener('keydown', handleKeyDown);

    // Register default shortcuts
    registerDefaultShortcuts();

    logger.info('✅ Keyboard shortcuts initialized', undefined, 'keyboardShortcutsService');
};

/**
 * Cleanup
 */
export const destroyKeyboardShortcuts = (): void => {
    document.removeEventListener('keydown', handleKeyDown);
    shortcuts.clear();
};

// ============================================================
// EVENT HANDLER
// ============================================================

/**
 * Handle key down event
 */
const handleKeyDown = (e: KeyboardEvent): void => {
    if (!enabled) return;

    // Ignore if typing in input
    const target = e.target as HTMLElement;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        // Only handle Escape in inputs
        if (e.key !== 'Escape') return;
    }

    const shortcutKey = buildShortcutKey(e.key, e.ctrlKey, e.shiftKey, e.altKey);
    const shortcut = shortcuts.get(shortcutKey);

    if (shortcut) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
    }
};

/**
 * Build unique key for shortcut
 */
const buildShortcutKey = (key: string, ctrl: boolean, shift: boolean, alt: boolean): string => {
    const parts: string[] = [];
    if (ctrl) parts.push('Ctrl');
    if (shift) parts.push('Shift');
    if (alt) parts.push('Alt');
    parts.push(key.toUpperCase());
    return parts.join('+');
};

// ============================================================
// REGISTRATION
// ============================================================

/**
 * Register a shortcut
 */
export const registerShortcut = (shortcut: Shortcut): void => {
    const key = buildShortcutKey(shortcut.key, !!shortcut.ctrl, !!shortcut.shift, !!shortcut.alt);
    shortcuts.set(key, shortcut);
};

/**
 * Unregister a shortcut
 */
export const unregisterShortcut = (key: string, ctrl?: boolean, shift?: boolean, alt?: boolean): void => {
    const shortcutKey = buildShortcutKey(key, !!ctrl, !!shift, !!alt);
    shortcuts.delete(shortcutKey);
};

/**
 * Register default shortcuts
 */
const registerDefaultShortcuts = (): void => {
    // Help
    registerShortcut({
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        descriptionAr: 'عرض اختصارات لوحة المفاتيح',
        action: showShortcutsHelp
    });

    // Escape - close modals
    registerShortcut({
        key: 'Escape',
        description: 'Close modal/menu',
        descriptionAr: 'إغلاق النافذة',
        action: closeActiveModal
    });

    // Search
    registerShortcut({
        key: 'k',
        ctrl: true,
        description: 'Open search',
        descriptionAr: 'فتح البحث',
        action: openSearch
    });

    // New request
    registerShortcut({
        key: 'n',
        ctrl: true,
        description: 'New request',
        descriptionAr: 'طلب جديد',
        action: createNewRequest
    });

    // Refresh
    registerShortcut({
        key: 'r',
        ctrl: true,
        shift: true,
        description: 'Refresh data',
        descriptionAr: 'تحديث البيانات',
        action: refreshData
    });

    // Navigation shortcuts
    registerShortcut({
        key: '1',
        alt: true,
        description: 'Go to Dashboard',
        descriptionAr: 'الذهاب للرئيسية',
        action: () => navigateTo('/dashboard')
    });

    registerShortcut({
        key: '2',
        alt: true,
        description: 'Go to Requests',
        descriptionAr: 'الذهاب للطلبات',
        action: () => navigateTo('/requests')
    });

    registerShortcut({
        key: '3',
        alt: true,
        description: 'Go to Rooms',
        descriptionAr: 'الذهاب للغرف',
        action: () => navigateTo('/rooms')
    });

    // Quick actions
    registerShortcut({
        key: 'c',
        description: 'Confirm first request',
        descriptionAr: 'تأكيد أول طلب',
        action: confirmFirstPending,
        scope: 'requests'
    });

    registerShortcut({
        key: 's',
        description: 'Start first confirmed',
        descriptionAr: 'بدء أول مؤكد',
        action: startFirstConfirmed,
        scope: 'requests'
    });

    // Theme toggle
    registerShortcut({
        key: 'd',
        ctrl: true,
        shift: true,
        description: 'Toggle dark mode',
        descriptionAr: 'تبديل الوضع الليلي',
        action: toggleDarkMode
    });
};

// ============================================================
// SHORTCUT ACTIONS
// ============================================================

const closeActiveModal = (): void => {
    const modal = document.querySelector('[data-modal="true"]');
    if (modal) {
        const closeBtn = modal.querySelector('[data-close="true"]');
        if (closeBtn) {
            (closeBtn as HTMLElement).click();
        }
    }

    // Also close shortcuts help if open
    if (helpModalOpen) {
        hideShortcutsHelp();
    }
};

const openSearch = (): void => {
    const searchInput = document.querySelector('[data-search="true"]') as HTMLInputElement;
    if (searchInput) {
        searchInput.focus();
        searchInput.select();
    }
};

const createNewRequest = (): void => {
    const newBtn = document.querySelector('[data-new-request="true"]') as HTMLElement;
    newBtn?.click();
};

const refreshData = (): void => {
    window.dispatchEvent(new CustomEvent('adora:refresh'));
};

const navigateTo = (path: string): void => {
    window.dispatchEvent(new CustomEvent('adora:navigate', { detail: { path } }));
};

const confirmFirstPending = (): void => {
    const confirmBtn = document.querySelector('[data-action="confirm"]') as HTMLElement;
    confirmBtn?.click();
};

const startFirstConfirmed = (): void => {
    const startBtn = document.querySelector('[data-action="start"]') as HTMLElement;
    startBtn?.click();
};

const toggleDarkMode = (): void => {
    document.documentElement.classList.toggle('dark');
};

// ============================================================
// HELP MODAL
// ============================================================

/**
 * Show shortcuts help
 */
export const showShortcutsHelp = (): void => {
    if (helpModalOpen) return;
    helpModalOpen = true;

    const modal = document.createElement('div');
    modal.id = 'shortcuts-help';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
    modal.setAttribute('data-modal', 'true');

    const shortcutsList = Array.from(shortcuts.values());
    const shortcutsHtml = shortcutsList.map(s => {
        const keys: string[] = [];
        if (s.ctrl) keys.push('Ctrl');
        if (s.shift) keys.push('Shift');
        if (s.alt) keys.push('Alt');
        keys.push(s.key.toUpperCase());

        return `
            <div class="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                <span class="text-white/80">${s.descriptionAr}</span>
                <div class="flex gap-1">
                    ${keys.map(k => `<kbd class="px-2 py-1 bg-white/10 rounded text-sm font-mono">${k}</kbd>`).join('<span class="text-white/40">+</span>')}
                </div>
            </div>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/60" onclick="document.getElementById('shortcuts-help')?.remove()"></div>
        <div class="relative glass-card p-6 rounded-2xl max-w-md w-full max-h-[80vh] overflow-auto">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-white">⌨️ اختصارات لوحة المفاتيح</h3>
                <button data-close="true" onclick="document.getElementById('shortcuts-help')?.remove()" class="text-white/60 hover:text-white text-2xl">✕</button>
            </div>
            <div class="space-y-1">
                ${shortcutsHtml}
            </div>
            <p class="text-white/40 text-sm mt-4 text-center">اضغط Escape للإغلاق</p>
        </div>
    `;

    document.body.appendChild(modal);
};

/**
 * Hide shortcuts help
 */
export const hideShortcutsHelp = (): void => {
    document.getElementById('shortcuts-help')?.remove();
    helpModalOpen = false;
};

// ============================================================
// CONTROLS
// ============================================================

/**
 * Enable/disable shortcuts
 */
export const setShortcutsEnabled = (value: boolean): void => {
    enabled = value;
};

/**
 * Get all shortcuts
 */
export const getAllShortcuts = (): Shortcut[] => {
    return Array.from(shortcuts.values());
};

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useCallback } from 'react';

export const useKeyboardShortcuts = () => {
    useEffect(() => {
        initKeyboardShortcuts();
        return () => destroyKeyboardShortcuts();
    }, []);

    const register = useCallback((shortcut: Shortcut) => {
        registerShortcut(shortcut);
    }, []);

    const unregister = useCallback((key: string, ctrl?: boolean, shift?: boolean, alt?: boolean) => {
        unregisterShortcut(key, ctrl, shift, alt);
    }, []);

    const showHelp = useCallback(() => {
        showShortcutsHelp();
    }, []);

    return {
        register,
        unregister,
        showHelp,
        shortcuts: getAllShortcuts(),
        setEnabled: setShortcutsEnabled
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initKeyboardShortcuts,
    destroyKeyboardShortcuts,
    registerShortcut,
    unregisterShortcut,
    showShortcutsHelp,
    hideShortcutsHelp,
    setShortcutsEnabled,
    getAllShortcuts,
    useKeyboardShortcuts
};
