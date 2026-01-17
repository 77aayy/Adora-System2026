/**
 * useUX Hook
 * Standardized user experience feedback (Haptics, Sounds, Toasts)
 * 
 * ✅ FIX: Uses uxEffects for sound and haptic feedback
 * Adora Hotel Management System V3
 */

import { useCallback } from 'react';
import { playSound as playSoundEffect, haptic as hapticEffect, type SoundType } from '../utils/uxEffects';

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

    // ✅ FIX: Play sound using uxEffects (Web Audio API)
    if (type === 'success') {
        playSoundEffect('success');
        hapticEffect('success');
    } else if (type === 'error') {
        playSoundEffect('error');
        hapticEffect('error');
    } else if (type === 'info') {
        playSoundEffect('notification');
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

    const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'notification' | 'warning' = 'light') => {
        hapticEffect(type);
    }, []);

    // ✅ FIX: Implemented sound logic using uxEffects
    const playSound = useCallback((type: 'success' | 'error' | 'notification' | SoundType = 'notification') => {
        // Map simple types to SoundType if needed
        const soundType: SoundType = (type === 'success' || type === 'error' || type === 'notification') 
            ? type 
            : (type as SoundType);
        
        playSoundEffect(soundType);
    }, []);

    return {
        showSuccess,
        showError,
        showInfo,
        triggerHaptic,
        haptic: triggerHaptic, // Alias for compatibility
        playSound
    };
};
