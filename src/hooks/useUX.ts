/**
 * useUX Hook
 * standardized user experience feedback (Haptics, Sounds, Toasts)
 */

import { useCallback } from 'react';

// Simple Toast Implementation
const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    // Create toast element
    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    toast.className = `fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[9999] flex items-center gap-3 text-white font-medium animate-slide-up ${colors[type]}`;

    // Add icon based on type
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

    // Add to body
    document.body.appendChild(toast);

    // Play sound
    if (type === 'success') {
        const audio = new Audio('/sounds/success.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => { }); // Ignore interaction errors
    } else if (type === 'error') {
        // navigator.vibrate([100, 50, 100]); // Haptic
    }

    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 500);
    }, 3000);
};

export const useUX = () => {
    const showSuccess = useCallback((message: string) => {
        showToast(message, 'success');
    }, []);

    const showError = useCallback((message: string) => {
        showToast(message, 'error');
    }, []);

    const showInfo = useCallback((message: string) => {
        showToast(message, 'info');
    }, []);

    const triggerHaptic = useCallback(() => {
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, []);

    const playSound = useCallback((type: 'success' | 'error' | 'notification' = 'notification') => {
        // Placeholder for sound logic
    }, []);

    return {
        showSuccess,
        showError,
        showInfo,
        triggerHaptic,
        playSound
    };
};
