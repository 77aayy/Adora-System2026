/**
 * Custom Confirm Service
 * Custom confirmation dialogs with FULL theme support
 * Adora Hotel Management System V2
 * 
 * ✅ Theme-aware dialogs using CSS variables
 */

// ============================================================
// TYPES
// ============================================================

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger' | 'success';
    showCancel?: boolean;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
}

interface PromptOptions extends ConfirmOptions {
    inputType?: 'text' | 'number' | 'password' | 'textarea';
    placeholder?: string;
    defaultValue?: string;
    validation?: (value: string) => boolean | string;
}

// ============================================================
// STATE
// ============================================================

let dialogContainer: HTMLElement | null = null;
let stylesAdded = false;

// ============================================================
// STYLES - Theme-aware CSS
// ============================================================

const addDialogStyles = (): void => {
    if (stylesAdded || document.getElementById('adora-custom-dialog-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'adora-custom-dialog-styles';
    styles.textContent = `
        /* ✅ Theme-aware Dialog Styles */
        .adora-dialog-overlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            animation: adora-fade-in 0.2s ease-out;
        }
        
        .adora-dialog-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }
        
        .adora-dialog-content {
            position: relative;
            max-width: 400px;
            width: 100%;
            padding: 1.5rem;
            border-radius: 1.25rem;
            animation: adora-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            
            /* ✅ Theme-aware colors */
            background: var(--theme-bg-secondary);
            border: 1px solid var(--theme-border-primary);
            box-shadow: var(--theme-shadow-2xl);
        }
        
        .adora-dialog-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        
        .adora-dialog-icon {
            width: 3.5rem;
            height: 3.5rem;
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
        }
        
        .adora-dialog-icon-success {
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.25));
            color: #22c55e;
        }
        
        .adora-dialog-icon-warning {
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.25));
            color: #f59e0b;
        }
        
        .adora-dialog-icon-danger {
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.25));
            color: #ef4444;
        }
        
        .adora-dialog-icon-info {
            background: linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.25));
            color: #14b8a6;
        }
        
        .adora-dialog-title {
            font-size: 1.125rem;
            font-weight: 700;
            color: var(--theme-text-primary);
        }
        
        .adora-dialog-message {
            font-size: 0.9375rem;
            line-height: 1.6;
            color: var(--theme-text-secondary);
            margin-bottom: 1.5rem;
        }
        
        .adora-dialog-buttons {
            display: flex;
            gap: 0.75rem;
        }
        
        .adora-dialog-btn {
            flex: 1;
            padding: 0.875rem 1rem;
            border-radius: 0.875rem;
            font-family: inherit;
            font-size: 0.9375rem;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }
        
        .adora-dialog-btn-cancel {
            background: var(--theme-bg-tertiary);
            color: var(--theme-text-primary);
            border: 1px solid var(--theme-border-primary);
        }
        
        .adora-dialog-btn-cancel:hover {
            background: var(--theme-border-hover);
        }
        
        .adora-dialog-btn-confirm {
            color: white;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .adora-dialog-btn-confirm:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
        
        .adora-dialog-btn-success {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        }
        
        .adora-dialog-btn-warning {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
        
        .adora-dialog-btn-danger {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        
        .adora-dialog-btn-info {
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
        }
        
        /* ✅ Input Styles */
        .adora-dialog-input {
            width: 100%;
            padding: 0.875rem 1rem;
            border-radius: 0.875rem;
            font-family: inherit;
            font-size: 0.9375rem;
            background: var(--theme-input-bg);
            border: 2px solid var(--theme-input-border);
            color: var(--theme-text-primary);
            transition: all 0.2s ease;
            margin-bottom: 1rem;
        }
        
        .adora-dialog-input::placeholder {
            color: var(--theme-input-placeholder);
        }
        
        .adora-dialog-input:focus {
            outline: none;
            border-color: #14b8a6;
            box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
        }
        
        .adora-dialog-error {
            color: #ef4444;
            font-size: 0.8125rem;
            margin-top: -0.5rem;
            margin-bottom: 1rem;
        }
        
        /* ✅ Loading Dialog */
        .adora-loading-spinner {
            width: 3rem;
            height: 3rem;
            border: 4px solid var(--theme-border-primary);
            border-top-color: #14b8a6;
            border-radius: 50%;
            animation: adora-spin 0.8s linear infinite;
            margin: 0 auto 1rem;
        }
        
        .adora-loading-text {
            text-align: center;
            color: var(--theme-text-primary);
            font-weight: 500;
        }
        
        /* ✅ Animations */
        @keyframes adora-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes adora-scale-in {
            from { 
                opacity: 0;
                transform: scale(0.9) translateY(10px);
            }
            to { 
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }
        
        @keyframes adora-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styles);
    stylesAdded = true;
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize dialog container
 */
const ensureContainer = (): HTMLElement => {
    addDialogStyles();
    
    if (!dialogContainer) {
        dialogContainer = document.createElement('div');
        dialogContainer.id = 'adora-dialog-container';
        document.body.appendChild(dialogContainer);
    }
    return dialogContainer;
};

// ============================================================
// HELPERS
// ============================================================

const getTypeConfig = (type: ConfirmOptions['type'] = 'info'): { icon: string; iconClass: string; btnClass: string } => {
    switch (type) {
        case 'success':
            return { icon: '✓', iconClass: 'adora-dialog-icon-success', btnClass: 'adora-dialog-btn-success' };
        case 'warning':
            return { icon: '⚠', iconClass: 'adora-dialog-icon-warning', btnClass: 'adora-dialog-btn-warning' };
        case 'danger':
            return { icon: '🗑️', iconClass: 'adora-dialog-icon-danger', btnClass: 'adora-dialog-btn-danger' };
        case 'info':
        default:
            return { icon: 'ℹ', iconClass: 'adora-dialog-icon-info', btnClass: 'adora-dialog-btn-info' };
    }
};

// ============================================================
// CONFIRM DIALOG
// ============================================================

/**
 * Show confirmation dialog
 */
export const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
        const container = ensureContainer();
        const { icon, iconClass, btnClass } = getTypeConfig(options.type);

        const dialog = document.createElement('div');
        dialog.className = 'adora-dialog-overlay';

        dialog.innerHTML = `
            <div class="adora-dialog-backdrop" id="dialog-backdrop"></div>
            <div class="adora-dialog-content">
                <div class="adora-dialog-header">
                    <div class="adora-dialog-icon ${iconClass}">
                        ${icon}
                    </div>
                    <div class="adora-dialog-title">${options.title || 'تأكيد'}</div>
                </div>
                <p class="adora-dialog-message">${options.message}</p>
                <div class="adora-dialog-buttons">
                    ${options.showCancel !== false ? `
                        <button id="dialog-cancel" class="adora-dialog-btn adora-dialog-btn-cancel">
                            ${options.cancelText || 'إلغاء'}
                        </button>
                    ` : ''}
                    <button id="dialog-confirm" class="adora-dialog-btn adora-dialog-btn-confirm ${btnClass}">
                        ${options.confirmText || 'تأكيد'}
                    </button>
                </div>
            </div>
        `;

        const close = (result: boolean) => {
            dialog.style.opacity = '0';
            dialog.style.transition = 'opacity 0.15s ease';
            setTimeout(() => {
                dialog.remove();
                if (result) {
                    options.onConfirm?.();
                } else {
                    options.onCancel?.();
                }
                resolve(result);
            }, 150);
        };

        container.appendChild(dialog);

        // Event listeners
        dialog.querySelector('#dialog-backdrop')?.addEventListener('click', () => close(false));
        dialog.querySelector('#dialog-cancel')?.addEventListener('click', () => close(false));
        dialog.querySelector('#dialog-confirm')?.addEventListener('click', () => close(true));
        
        // Keyboard support
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Cleanup keyboard listener
        const originalClose = close;
        const closeWithCleanup = (result: boolean) => {
            document.removeEventListener('keydown', handleKeydown);
            originalClose(result);
        };
        
        dialog.querySelector('#dialog-backdrop')?.addEventListener('click', () => closeWithCleanup(false));
        dialog.querySelector('#dialog-cancel')?.addEventListener('click', () => closeWithCleanup(false));
        dialog.querySelector('#dialog-confirm')?.addEventListener('click', () => closeWithCleanup(true));
    });
};

/**
 * Show delete confirmation
 */
export const confirmDelete = (itemName: string): Promise<boolean> => {
    return confirm({
        title: 'تأكيد الحذف',
        message: `هل أنت متأكد من حذف "${itemName}"؟ لا يمكن التراجع عن هذا الإجراء.`,
        confirmText: 'حذف',
        cancelText: 'إلغاء',
        type: 'danger'
    });
};

/**
 * Show logout confirmation
 */
export const confirmLogout = (): Promise<boolean> => {
    return confirm({
        title: 'تسجيل الخروج',
        message: 'هل أنت متأكد من تسجيل الخروج؟',
        confirmText: 'خروج',
        cancelText: 'بقاء',
        type: 'warning'
    });
};

/**
 * Show save confirmation (success)
 */
export const confirmSave = (message: string = 'تم الحفظ بنجاح'): Promise<boolean> => {
    return confirm({
        title: 'تم الحفظ',
        message,
        confirmText: 'حسناً',
        showCancel: false,
        type: 'success'
    });
};

// ============================================================
// PROMPT DIALOG
// ============================================================

/**
 * Show prompt dialog
 */
export const prompt = (options: PromptOptions): Promise<string | null> => {
    return new Promise((resolve) => {
        const container = ensureContainer();
        const { icon, iconClass, btnClass } = getTypeConfig(options.type);

        const dialog = document.createElement('div');
        dialog.className = 'adora-dialog-overlay';

        const inputHtml = options.inputType === 'textarea'
            ? `<textarea id="dialog-input" class="adora-dialog-input" style="resize: none; min-height: 80px;" placeholder="${options.placeholder || ''}">${options.defaultValue || ''}</textarea>`
            : `<input type="${options.inputType || 'text'}" id="dialog-input" class="adora-dialog-input" placeholder="${options.placeholder || ''}" value="${options.defaultValue || ''}" />`;

        dialog.innerHTML = `
            <div class="adora-dialog-backdrop" id="dialog-backdrop"></div>
            <div class="adora-dialog-content">
                <div class="adora-dialog-header">
                    <div class="adora-dialog-icon ${iconClass}">
                        ${icon}
                    </div>
                    <div class="adora-dialog-title">${options.title || 'إدخال'}</div>
                </div>
                <p class="adora-dialog-message">${options.message}</p>
                <div>
                    ${inputHtml}
                    <p id="dialog-error" class="adora-dialog-error" style="display: none;"></p>
                </div>
                <div class="adora-dialog-buttons">
                    <button id="dialog-cancel" class="adora-dialog-btn adora-dialog-btn-cancel">
                        ${options.cancelText || 'إلغاء'}
                    </button>
                    <button id="dialog-confirm" class="adora-dialog-btn adora-dialog-btn-confirm ${btnClass}">
                        ${options.confirmText || 'تأكيد'}
                    </button>
                </div>
            </div>
        `;

        container.appendChild(dialog);

        const input = dialog.querySelector('#dialog-input') as HTMLInputElement | HTMLTextAreaElement;
        const errorEl = dialog.querySelector('#dialog-error') as HTMLElement;
        setTimeout(() => input.focus(), 100);

        const close = (value: string | null) => {
            dialog.style.opacity = '0';
            dialog.style.transition = 'opacity 0.15s ease';
            setTimeout(() => {
                dialog.remove();
                resolve(value);
            }, 150);
        };

        const validate = (): boolean => {
            if (options.validation) {
                const result = options.validation(input.value);
                if (result !== true) {
                    errorEl.textContent = typeof result === 'string' ? result : 'قيمة غير صالحة';
                    errorEl.style.display = 'block';
                    return false;
                }
            }
            return true;
        };

        dialog.querySelector('#dialog-backdrop')?.addEventListener('click', () => close(null));
        dialog.querySelector('#dialog-cancel')?.addEventListener('click', () => close(null));
        dialog.querySelector('#dialog-confirm')?.addEventListener('click', () => {
            if (validate()) {
                close(input.value);
            }
        });

        input.addEventListener('keydown', (event) => {
            const e = event as KeyboardEvent;
            if (e.key === 'Enter' && options.inputType !== 'textarea') {
                if (validate()) {
                    close(input.value);
                }
            }
            if (e.key === 'Escape') {
                close(null);
            }
        });
    });
};

// ============================================================
// ALERT DIALOG
// ============================================================

/**
 * Show alert dialog
 */
export const alert = (message: string, title?: string, type?: ConfirmOptions['type']): Promise<void> => {
    return new Promise((resolve) => {
        confirm({
            title: title || 'تنبيه',
            message,
            confirmText: 'حسناً',
            showCancel: false,
            type
        }).then(() => resolve());
    });
};

/**
 * Show success alert
 */
export const alertSuccess = (message: string): Promise<void> => {
    return alert(message, 'نجاح', 'success');
};

/**
 * Show error alert
 */
export const alertError = (message: string): Promise<void> => {
    return alert(message, 'خطأ', 'danger');
};

/**
 * Show warning alert
 */
export const alertWarning = (message: string): Promise<void> => {
    return alert(message, 'تحذير', 'warning');
};

// ============================================================
// LOADING DIALOG
// ============================================================

let loadingDialog: HTMLElement | null = null;

/**
 * Show loading dialog
 */
export const showLoading = (message = 'جاري التحميل...'): void => {
    const container = ensureContainer();

    loadingDialog = document.createElement('div');
    loadingDialog.className = 'adora-dialog-overlay';

    loadingDialog.innerHTML = `
        <div class="adora-dialog-backdrop"></div>
        <div class="adora-dialog-content" style="max-width: 280px; text-align: center;">
            <div class="adora-loading-spinner"></div>
            <p class="adora-loading-text">${message}</p>
        </div>
    `;

    container.appendChild(loadingDialog);
};

/**
 * Hide loading dialog
 */
export const hideLoading = (): void => {
    if (loadingDialog) {
        loadingDialog.style.opacity = '0';
        loadingDialog.style.transition = 'opacity 0.15s ease';
        setTimeout(() => {
            loadingDialog?.remove();
            loadingDialog = null;
        }, 150);
    }
};

/**
 * Show loading while executing async function
 */
export const withLoading = async <T>(
    fn: () => Promise<T>,
    message = 'جاري التحميل...'
): Promise<T> => {
    showLoading(message);
    try {
        const result = await fn();
        return result;
    } finally {
        hideLoading();
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useCallback } from 'react';

export const useConfirm = () => {
    const showConfirm = useCallback((options: ConfirmOptions) => {
        return confirm(options);
    }, []);

    const showPrompt = useCallback((options: PromptOptions) => {
        return prompt(options);
    }, []);

    const showAlert = useCallback((message: string, title?: string, type?: ConfirmOptions['type']) => {
        return alert(message, title, type);
    }, []);

    const showDelete = useCallback((itemName: string) => {
        return confirmDelete(itemName);
    }, []);

    return {
        confirm: showConfirm,
        prompt: showPrompt,
        alert: showAlert,
        confirmDelete: showDelete,
        confirmLogout,
        alertSuccess,
        alertError,
        alertWarning,
        showLoading,
        hideLoading,
        withLoading
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    confirm,
    confirmDelete,
    confirmLogout,
    confirmSave,
    prompt,
    alert,
    alertSuccess,
    alertError,
    alertWarning,
    showLoading,
    hideLoading,
    withLoading,
    useConfirm
};
