/**
 * Global Keyboard Shortcuts Hook
 * Enterprise-grade keyboard navigation
 * Adora Hotel Management System
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutConfig {
    [key: string]: () => void;
}

/**
 * Global keyboard shortcuts for the entire app
 * Automatically active on all pages
 * 
 * Shortcuts:
 * - Ctrl+K: Quick search/command palette
 * - Ctrl+/: Show shortcuts help
 * - Alt+1-9: Navigate to departments
 * - Ctrl+N: New request (context-aware)
 * - Ctrl+R: Refresh current view
 * - Esc: Close modals/dialogs
 */
export function useGlobalKeyboardShortcuts() {
    const navigate = useNavigate();
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in input/textarea
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                // Allow Escape in inputs
                if (e.key !== 'Escape') return;
            }
            
            const ctrl = e.ctrlKey || e.metaKey;
            const alt = e.altKey;
            const key = e.key.toLowerCase();
            
            // Ctrl+K: Quick search (future feature)
            if (ctrl && key === 'k') {
                e.preventDefault();
                // TODO: Open command palette
                console.log('🔍 Quick search (Ctrl+K)');
            }
            
            // Ctrl+/: Show shortcuts
            if (ctrl && key === '/') {
                e.preventDefault();
                showShortcutsHelp();
            }
            
            // Alt+Number: Navigate to departments
            if (alt && !ctrl) {
                const num = parseInt(key);
                if (num >= 1 && num <= 9) {
                    e.preventDefault();
                    navigateToDepartment(num, navigate);
                }
            }
            
            // Ctrl+R: Refresh (let browser handle, just log)
            if (ctrl && key === 'r') {
                console.log('🔄 Refreshing...');
                // Browser will handle the actual refresh
            }
            
            // Escape: Close modals (handled by individual components)
            if (key === 'escape') {
                // Let modals handle this
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate]);
}

/**
 * Navigate to department by number
 */
function navigateToDepartment(num: number, navigate: (path: string) => void) {
    const routes: { [key: number]: string } = {
        1: '/reception',
        2: '/housekeeping',
        3: '/bellman',
        4: '/maintenance',
        5: '/procurement',
        6: '/coffeeshop',
        7: '/admin',
        8: '/owner-dashboard',
    };
    
    const route = routes[num];
    if (route) {
        navigate(route);
        console.log(`⌨️ Navigated to ${route} (Alt+${num})`);
    }
}

/**
 * Show keyboard shortcuts help
 */
function showShortcutsHelp() {
    const shortcuts = `
╔═══════════════════════════════════════════════╗
║        ⌨️  اختصارات لوحة المفاتيح             ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Alt + 1  →  الاستقبال                       ║
║  Alt + 2  →  الهاوس كيبنج                     ║
║  Alt + 3  →  البيلمان                         ║
║  Alt + 4  →  الصيانة                          ║
║  Alt + 5  →  المشتريات                        ║
║  Alt + 6  →  الكوفي شوب                       ║
║  Alt + 7  →  لوحة الإدارة                     ║
║  Alt + 8  →  لوحة المالك                      ║
║                                               ║
║  Ctrl + /  →  عرض الاختصارات                 ║
║  Ctrl + R  →  تحديث الصفحة                   ║
║  Esc       →  إغلاق                          ║
║                                               ║
╚═══════════════════════════════════════════════╝
    `.trim();
    
    console.log(shortcuts);
    
    // Optional: Show in-app toast
    if (typeof window !== 'undefined') {
        alert(shortcuts);
    }
}

/**
 * Dashboard-specific shortcuts hook
 * Use in individual dashboards for context-aware shortcuts
 * 
 * @example
 * ```typescript
 * useDashboardShortcuts({
 *   'ctrl+n': () => setShowNewRequestModal(true),
 *   'ctrl+s': () => handleSave(),
 *   'ctrl+f': () => searchInputRef.current?.focus(),
 * });
 * ```
 */
export function useDashboardShortcuts(shortcuts: ShortcutConfig) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable
            ) {
                return;
            }
            
            const ctrl = e.ctrlKey || e.metaKey;
            const alt = e.altKey;
            const shift = e.shiftKey;
            const key = e.key.toLowerCase();
            
            // Build shortcut string
            let shortcut = '';
            if (ctrl) shortcut += 'ctrl+';
            if (alt) shortcut += 'alt+';
            if (shift) shortcut += 'shift+';
            shortcut += key;
            
            // Execute shortcut if exists
            const handler = shortcuts[shortcut];
            if (handler) {
                e.preventDefault();
                handler();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [shortcuts]);
}

export default useGlobalKeyboardShortcuts;
