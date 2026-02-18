/**
 * PWA Service
 * Progressive Web App installation and features
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAStatus {
    isInstallable: boolean;
    isInstalled: boolean;
    isStandalone: boolean;
    isOnline: boolean;
}

// ============================================================
// STATE
// ============================================================

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installState: 'idle' | 'prompted' | 'installed' | 'dismissed' = 'idle';
let statusListeners: ((status: PWAStatus) => void)[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize PWA features
 */
export const initPWA = (): void => {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    // Listen for app installed
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already installed
    checkInstallState();

    logger.info('✅ PWA service initialized', undefined, 'pwaService');
};

/**
 * Handle before install prompt
 */
const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent): void => {
    // Prevent default browser prompt
    e.preventDefault();

    // Store event for later use
    deferredPrompt = e;
    installState = 'idle';

    // Notify listeners
    notifyStatusChange();

    // Show custom install UI after delay
    setTimeout(() => {
        if (deferredPrompt && !shouldSuppressPrompt()) {
            showInstallBanner();
        }
    }, 30000); // Show after 30 seconds
};

/**
 * Handle app installed
 */
const handleAppInstalled = (): void => {
    deferredPrompt = null;
    installState = 'installed';
    hideInstallBanner();
    notifyStatusChange();

    // Show celebration
    showInstallCelebration();

    logger.info('🎉 App installed successfully', undefined, 'pwaService');
};

// ============================================================
// INSTALL PROMPT
// ============================================================

/**
 * Show install prompt
 */
export const showInstallPrompt = async (): Promise<boolean> => {
    if (!deferredPrompt) {
        logger.info('Install prompt not available', undefined, 'pwaService');
        return false;
    }

    try {
        // Show browser prompt
        await deferredPrompt.prompt();

        // Wait for user choice
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            installState = 'installed';
            deferredPrompt = null;
            return true;
        } else {
            installState = 'dismissed';
            // Suppress for 7 days
            suppressPrompt(7);
            return false;
        }
    } catch (error) {
        logger.error('Install prompt error:', error, 'pwaService');
        return false;
    } finally {
        notifyStatusChange();
    }
};

/**
 * Check if can show install prompt
 */
export const canShowInstallPrompt = (): boolean => {
    return deferredPrompt !== null && !shouldSuppressPrompt();
};

// ============================================================
// INSTALL BANNER
// ============================================================

let installBanner: HTMLElement | null = null;

/**
 * Show install banner
 */
export const showInstallBanner = (): void => {
    if (installBanner || !deferredPrompt || shouldSuppressPrompt()) return;

    installBanner = document.createElement('div');
    installBanner.id = 'adora-install-banner';
    installBanner.className = `
        fixed bottom-0 left-0 right-0 z-[9999]
        bg-gradient-to-r from-primary-600 to-primary-700
        text-white p-4 shadow-2xl
        transform translate-y-full
        transition-transform duration-500 ease-out
    `;

    installBanner.innerHTML = `
        <div class="max-w-lg mx-auto flex items-center gap-4">
            <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <span class="text-3xl">📱</span>
            </div>
            <div class="flex-1">
                <h4 class="font-bold text-lg">تثبيت التطبيق</h4>
                <p class="text-white/80 text-sm">ثبّت أدورا للوصول السريع والعمل بدون إنترنت</p>
            </div>
            <div class="flex gap-2">
                <button id="pwa-dismiss" class="px-4 py-2 text-white/60 hover:text-white">
                    لاحقاً
                </button>
                <button id="pwa-install" class="px-6 py-2 bg-white text-primary-600 rounded-xl font-bold hover:bg-white/90">
                    تثبيت
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(installBanner);

    // Animate in
    requestAnimationFrame(() => {
        installBanner!.style.transform = 'translateY(0)';
    });

    // Event listeners
    installBanner.querySelector('#pwa-install')?.addEventListener('click', async () => {
        await showInstallPrompt();
        hideInstallBanner();
    });

    installBanner.querySelector('#pwa-dismiss')?.addEventListener('click', () => {
        hideInstallBanner();
        suppressPrompt(1); // Suppress for 1 day
    });
};

/**
 * Hide install banner
 */
export const hideInstallBanner = (): void => {
    if (installBanner) {
        installBanner.style.transform = 'translateY(100%)';
        setTimeout(() => {
            installBanner?.remove();
            installBanner = null;
        }, 500);
    }
};

// ============================================================
// INSTALL CELEBRATION
// ============================================================

/**
 * Show celebration after install
 */
const showInstallCelebration = (): void => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60';

    modal.innerHTML = `
        <div class="glass-card p-8 rounded-3xl max-w-sm text-center animate-scale-in">
            <div class="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <span class="text-4xl">✓</span>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">تم التثبيت بنجاح! 🎉</h3>
            <p class="text-white/70 mb-6">يمكنك الآن الوصول لأدورا من شاشتك الرئيسية</p>
            <button onclick="this.closest('.fixed').remove()" class="w-full btn-primary py-3 text-lg">
                ابدأ الآن
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // Add confetti effect
    createConfetti();

    // Auto dismiss after 10 seconds
    setTimeout(() => modal.remove(), 10000);
};

/**
 * Create confetti effect
 */
const createConfetti = (): void => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FF9F43'];
    const container = document.createElement('div');
    container.className = 'fixed inset-0 pointer-events-none z-[10000]';
    document.body.appendChild(container);

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
            position: absolute;
            width: ${Math.random() * 10 + 5}px;
            height: ${Math.random() * 10 + 5}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            left: ${Math.random() * 100}%;
            top: -20px;
            opacity: ${Math.random() * 0.8 + 0.2};
            border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            animation: confetti-fall ${Math.random() * 2 + 2}s linear forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        container.appendChild(confetti);
    }

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes confetti-fall {
            to {
                transform: translateY(100vh) rotate(${Math.random() * 720}deg);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        container.remove();
        style.remove();
    }, 4000);
};

// ============================================================
// SUPPRESSION
// ============================================================

const SUPPRESS_KEY = 'adora_pwa_suppress';

/**
 * Suppress prompt for days
 */
const suppressPrompt = (days: number): void => {
    const until = Date.now() + (days * 24 * 60 * 60 * 1000);
    localStorage.setItem(SUPPRESS_KEY, String(until));
};

/**
 * Check if should suppress prompt
 */
const shouldSuppressPrompt = (): boolean => {
    const until = localStorage.getItem(SUPPRESS_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until);
};

// ============================================================
// STATUS
// ============================================================

/**
 * Check install state
 */
const checkInstallState = (): void => {
    // Check if running as installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

    if (isStandalone) {
        installState = 'installed';
    }
};

/**
 * Get PWA status
 */
export const getPWAStatus = (): PWAStatus => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;

    return {
        isInstallable: deferredPrompt !== null,
        isInstalled: installState === 'installed' || isStandalone,
        isStandalone,
        isOnline: navigator.onLine
    };
};

/**
 * Subscribe to status changes
 */
export const subscribeToPWAStatus = (callback: (status: PWAStatus) => void): (() => void) => {
    statusListeners.push(callback);
    callback(getPWAStatus());

    return () => {
        statusListeners = statusListeners.filter(l => l !== callback);
    };
};

/**
 * Notify status change
 */
const notifyStatusChange = (): void => {
    const status = getPWAStatus();
    statusListeners.forEach(l => l(status));
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const usePWA = () => {
    const [status, setStatus] = useState<PWAStatus>(getPWAStatus());

    useEffect(() => {
        initPWA();
        const unsubscribe = subscribeToPWAStatus(setStatus);
        return unsubscribe;
    }, []);

    const install = useCallback(async () => {
        return showInstallPrompt();
    }, []);

    const showBanner = useCallback(() => {
        showInstallBanner();
    }, []);

    return {
        ...status,
        install,
        showBanner,
        canInstall: status.isInstallable && !status.isInstalled
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    initPWA,
    showInstallPrompt,
    canShowInstallPrompt,
    showInstallBanner,
    hideInstallBanner,
    getPWAStatus,
    subscribeToPWAStatus,
    usePWA
};
