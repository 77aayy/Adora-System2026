/**
 * Custom Confirm Dialog Service
 * Migrated from custom-confirm.js
 * Adora Hotel Management System V2
 * 
 * ✅ Theme-aware confirm dialogs using CSS variables
 */

// ============================================================
// TYPES
// ============================================================

export type ConfirmType = 'warning' | 'danger' | 'info' | 'success';

export interface ConfirmOptions {
    type?: ConfirmType;
    confirmText?: string;
    cancelText?: string;
    icon?: string;
}

// ============================================================
// CONFIRM DIALOG
// ============================================================

class ConfirmDialog {
    private overlay: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private resolvePromise: ((value: boolean) => void) | null = null;

    /**
     * Initialize the dialog
     */
    init(): void {
        if (typeof document === 'undefined') return;
        if (document.getElementById('adora-confirm-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'adora-confirm-overlay';
        overlay.className = 'adora-confirm-overlay';
        overlay.innerHTML = `
            <div class="adora-confirm-modal" id="adora-confirm-modal">
                <div class="adora-confirm-icon" id="adora-confirm-icon">⚠️</div>
                <div class="adora-confirm-message" id="adora-confirm-message"></div>
                <div class="adora-confirm-buttons">
                    <button class="adora-confirm-btn confirm" id="adora-confirm-yes">نعم</button>
                    <button class="adora-confirm-btn cancel" id="adora-confirm-no">إلغاء</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        this.overlay = overlay;
        this.modal = overlay.querySelector('.adora-confirm-modal');

        // Events
        document.getElementById('adora-confirm-yes')!.onclick = () => this.resolve(true);
        document.getElementById('adora-confirm-no')!.onclick = () => this.resolve(false);
        overlay.onclick = (e) => {
            if (e.target === overlay) this.resolve(false);
        };

        // Add styles
        this.addStyles();
    }

    /**
     * Show confirm dialog
     */
    show(message: string, options: ConfirmOptions = {}): Promise<boolean> {
        return new Promise((resolve) => {
            if (!this.overlay) this.init();

            this.resolvePromise = resolve;

            const msgEl = document.getElementById('adora-confirm-message');
            const iconEl = document.getElementById('adora-confirm-icon');
            const yesBtn = document.getElementById('adora-confirm-yes');
            const noBtn = document.getElementById('adora-confirm-no');

            if (msgEl) msgEl.textContent = message;

            // Type styling
            const type = options.type || 'warning';
            if (iconEl) {
                iconEl.className = `adora-confirm-icon ${type}`;
                iconEl.textContent = this.getIcon(type, options.icon);
            }

            // Button text
            if (yesBtn && options.confirmText) {
                yesBtn.textContent = options.confirmText;
            }
            if (noBtn && options.cancelText) {
                noBtn.textContent = options.cancelText;
            }

            // Show
            this.overlay?.classList.add('active');
            this.modal?.classList.add('active');
        });
    }

    /**
     * Resolve and close
     */
    private resolve(value: boolean): void {
        this.overlay?.classList.remove('active');
        this.modal?.classList.remove('active');

        if (this.resolvePromise) {
            this.resolvePromise(value);
            this.resolvePromise = null;
        }
    }

    /**
     * Get icon for type
     */
    private getIcon(type: ConfirmType, custom?: string): string {
        if (custom) return custom;

        const icons: Record<ConfirmType, string> = {
            warning: '⚠️',
            danger: '🗑️',
            info: 'ℹ️',
            success: '✅'
        };
        return icons[type] || '⚠️';
    }

    /**
     * Add CSS styles - Theme-aware using CSS variables
     */
    private addStyles(): void {
        if (document.getElementById('adora-confirm-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'adora-confirm-styles';
        styles.textContent = `
            .adora-confirm-overlay {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .adora-confirm-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            .adora-confirm-modal {
                /* ✅ Theme-aware background */
                background: var(--theme-bg-secondary);
                border: 1px solid var(--theme-border-primary);
                border-radius: 1.25rem;
                padding: 1.5rem;
                max-width: 360px;
                width: 90%;
                text-align: center;
                transform: scale(0.9) translateY(20px);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: var(--theme-shadow-2xl);
                opacity: 0;
                visibility: hidden;
            }

            .adora-confirm-modal.active {
                transform: scale(1) translateY(0);
                opacity: 1;
                visibility: visible;
            }

            .adora-confirm-icon {
                width: 4rem;
                height: 4rem;
                border-radius: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1rem;
                font-size: 2rem;
            }

            .adora-confirm-icon.warning { 
                background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.25)); 
            }
            .adora-confirm-icon.danger { 
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.25)); 
            }
            .adora-confirm-icon.info { 
                background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.25)); 
            }
            .adora-confirm-icon.success { 
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.25)); 
            }

            .adora-confirm-message {
                font-size: 1rem;
                font-weight: 600;
                /* ✅ Theme-aware text */
                color: var(--theme-text-primary);
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }

            .adora-confirm-buttons {
                display: flex;
                gap: 0.75rem;
            }

            .adora-confirm-btn {
                flex: 1;
                padding: 0.875rem 1rem;
                border: none;
                border-radius: 0.875rem;
                font-family: inherit;
                font-size: 0.9375rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .adora-confirm-btn.confirm {
                background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
            }

            .adora-confirm-btn.confirm:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(20, 184, 166, 0.4);
            }

            .adora-confirm-btn.cancel {
                /* ✅ Theme-aware cancel button */
                background: var(--theme-bg-tertiary);
                color: var(--theme-text-primary);
                border: 1px solid var(--theme-border-primary);
            }

            .adora-confirm-btn.cancel:hover {
                background: var(--theme-border-hover);
            }
        `;
        document.head.appendChild(styles);
    }
}

// ============================================================
// SINGLETON
// ============================================================

export const confirmDialog = new ConfirmDialog();

// ============================================================
// CONVENIENCE FUNCTIONS
// ============================================================

/**
 * Show confirm dialog (async)
 */
export const confirm = async (message: string, options?: ConfirmOptions): Promise<boolean> => {
    return confirmDialog.show(message, options);
};

/**
 * Show delete confirmation
 */
export const confirmDelete = async (itemName?: string): Promise<boolean> => {
    const message = itemName
        ? `هل أنت متأكد من حذف "${itemName}"؟`
        : 'هل أنت متأكد من الحذف؟';

    return confirmDialog.show(message, {
        type: 'danger',
        confirmText: 'حذف',
        cancelText: 'إلغاء'
    });
};

/**
 * Show action confirmation
 */
export const confirmAction = async (action: string): Promise<boolean> => {
    return confirmDialog.show(`هل تريد ${action}؟`, {
        type: 'info',
        confirmText: 'نعم',
        cancelText: 'لا'
    });
};

// ============================================================
// REACT HOOK
// ============================================================

import { useCallback } from 'react';

interface UseConfirmReturn {
    confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
    confirmDelete: (itemName?: string) => Promise<boolean>;
    confirmAction: (action: string) => Promise<boolean>;
}

export const useConfirm = (): UseConfirmReturn => {
    const handleConfirm = useCallback(async (message: string, options?: ConfirmOptions) => {
        return confirm(message, options);
    }, []);

    const handleConfirmDelete = useCallback(async (itemName?: string) => {
        return confirmDelete(itemName);
    }, []);

    const handleConfirmAction = useCallback(async (action: string) => {
        return confirmAction(action);
    }, []);

    return {
        confirm: handleConfirm,
        confirmDelete: handleConfirmDelete,
        confirmAction: handleConfirmAction
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    confirmDialog,
    confirm,
    confirmDelete,
    confirmAction,
    useConfirm
};
