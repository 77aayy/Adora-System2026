/**
 * Keyboard Shortcuts Hook
 * Global keyboard shortcuts for common actions
 * Adora Hotel Management System V2
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
    keys: string[]; // e.g., ['Ctrl', 'K'] or ['Escape']
    action: () => void;
    description?: string;
    preventDefault?: boolean;
}

/**
 * Hook for keyboard shortcuts
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            shortcuts.forEach(({ keys, action, preventDefault = true }) => {
                const pressedKeys: string[] = [];

                if (event.ctrlKey || event.metaKey) pressedKeys.push('Ctrl');
                if (event.shiftKey) pressedKeys.push('Shift');
                if (event.altKey) pressedKeys.push('Alt');

                // Normalize key name
                let keyName = event.key;
                if (keyName === 'Meta') keyName = 'Ctrl'; // Cmd on Mac

                // Special keys
                if (['Escape', 'Enter', 'Backspace', 'Delete', 'Tab'].includes(keyName)) {
                    pressedKeys.push(keyName);
                } else if (keyName.length === 1) {
                    // Letter or number
                    pressedKeys.push(keyName.toUpperCase());
                } else {
                    // Function keys or arrows
                    pressedKeys.push(keyName);
                }

                // Check if all required keys are pressed
                const requiredKeys = keys.map(k => k.toLowerCase());
                const pressedKeysLower = pressedKeys.map(k => k.toLowerCase());

                const allKeysPressed = requiredKeys.every(key =>
                    pressedKeysLower.includes(key.toLowerCase())
                );

                if (allKeysPressed && requiredKeys.length === pressedKeysLower.length) {
                    if (preventDefault) {
                        event.preventDefault();
                        event.stopPropagation();
                    }
                    action();
                }
            });
        },
        [shortcuts]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);
};

/**
 * Common keyboard shortcuts for the app
 */
export const CommonShortcuts = {
    // Navigation
    ESCAPE: (action: () => void) => ({ keys: ['Escape'], action, description: 'إغلاق/إلغاء' }),
    ENTER: (action: () => void) => ({ keys: ['Enter'], action, description: 'تأكيد' }),

    // Actions
    SAVE: (action: () => void) => ({
        keys: ['Ctrl', 'S'],
        action,
        description: 'حفظ',
        preventDefault: true,
    }),
    NEW: (action: () => void) => ({
        keys: ['Ctrl', 'N'],
        action,
        description: 'جديد',
        preventDefault: true,
    }),
    SEARCH: (action: () => void) => ({
        keys: ['Ctrl', 'K'],
        action,
        description: 'بحث',
        preventDefault: true,
    }),
    DELETE: (action: () => void) => ({
        keys: ['Delete'],
        action,
        description: 'حذف',
    }),
    REFRESH: (action: () => void) => ({
        keys: ['Ctrl', 'R'],
        action,
        description: 'تحديث',
        preventDefault: true,
    }),
};

export default useKeyboardShortcuts;
