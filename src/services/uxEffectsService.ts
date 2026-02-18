/**
 * UX Effects Service
 * Migrated from ux-effects.js with TypeScript
 * Adora Hotel Management System V2
 * 
 * Provides:
 * - Theme management (light/dark)
 * - Sound effects
 * - Haptic feedback
 * - Animations (ripple, shake, bounce)
 * - Button loading states
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export type Theme = 'light' | 'dark';
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'notification' | 'warning';
export type SoundType = 'click' | 'success' | 'error' | 'notification' | 'toggle' |
    'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'urgent' | 'receive' | 'pop' | 'alert';

// ============================================================
// THEME MANAGEMENT
// ============================================================

let currentTheme: Theme = 'light';

/**
 * Load saved theme
 */
export const loadTheme = (): Theme => {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('adora_theme') as Theme;
        if (saved === 'light' || saved === 'dark') {
            currentTheme = saved;
        }
    }
    return currentTheme;
};

/**
 * Apply theme to document
 */
export const applyTheme = (theme: Theme): void => {
    if (typeof document === 'undefined') return;

    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('adora_theme', theme);
    }

    // Update theme icon if exists
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
};

/**
 * Toggle between light and dark
 */
export const toggleTheme = (): Theme => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    return newTheme;
};

/**
 * Get current theme
 */
export const getTheme = (): Theme => currentTheme;

// ============================================================
// SOUND EFFECTS
// ============================================================

let soundsEnabled = true;

/**
 * Check if sounds are enabled
 */
const checkSoundsEnabled = (): boolean => {
    if (typeof localStorage !== 'undefined') {
        soundsEnabled = localStorage.getItem('adora_sounds') !== 'off';
    }
    return soundsEnabled;
};

/**
 * Create a beep sound
 */
const createBeep = (
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    multipliers: number[] = [1]
): (() => void) => {
    return () => {
        if (!checkSoundsEnabled()) return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const audioContext = new AudioContextClass();

            multipliers.forEach((mult, index) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = frequency * mult;
                oscillator.type = type;

                const startTime = audioContext.currentTime + (index * duration * 0.5);
                gainNode.gain.setValueAtTime(0.1, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

                oscillator.start(startTime);
                oscillator.stop(startTime + duration);
            });
        } catch (e) {
            logger.info('Audio not supported', undefined, 'uxEffectsService');
        }
    };
};

/**
 * Create urgent sound
 */
const createUrgentSound = (): (() => void) => {
    return () => {
        if (!checkSoundsEnabled()) return;

        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;

            const audioContext = new AudioContextClass();

            [0, 0.15, 0.3].forEach((delay) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 880;
                oscillator.type = 'square';

                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + delay);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + delay + 0.1);

                oscillator.start(audioContext.currentTime + delay);
                oscillator.stop(audioContext.currentTime + delay + 0.1);
            });
        } catch (e) {
            logger.info('Audio not supported', undefined, 'uxEffectsService');
        }
    };
};

// Sound functions
const sounds: Record<SoundType, () => void> = {
    click: createBeep(800, 0.05, 'sine'),
    success: createBeep(880, 0.15, 'sine', [1, 1.5]),
    error: createBeep(300, 0.2, 'sawtooth'),
    notification: createBeep(660, 0.1, 'sine', [1, 1.25, 1.5]),
    toggle: createBeep(440, 0.03, 'sine'),
    cleaning: createBeep(523, 0.12, 'sine', [1, 1.26, 1.5]),
    maintenance: createBeep(392, 0.15, 'triangle', [1, 1.33]),
    bellman: createBeep(659, 0.1, 'sine', [1, 1.5, 2]),
    coffee: createBeep(440, 0.08, 'sine', [1, 1.25]),
    urgent: createUrgentSound()
};

/**
 * Play a sound
 */
export const playSound = (soundName: SoundType): void => {
    if (sounds[soundName]) {
        sounds[soundName]();
    }
};

/**
 * Play request-specific sound
 */
export const playRequestSound = (serviceType: string, isUrgent: boolean = false): void => {
    if (isUrgent) {
        playSound('urgent');
        return;
    }

    switch (serviceType) {
        case 'cleaning':
            playSound('cleaning');
            break;
        case 'maintenance':
            playSound('maintenance');
            break;
        case 'bellman':
            playSound('bellman');
            break;
        case 'coffee':
            playSound('coffee');
            break;
        default:
            playSound('notification');
    }
};

/**
 * Enable/disable sounds
 */
export const setSoundsEnabled = (enabled: boolean): void => {
    soundsEnabled = enabled;
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('adora_sounds', enabled ? 'on' : 'off');
    }
};

// ============================================================
// HAPTIC FEEDBACK
// ============================================================

const hapticPatterns: Record<HapticType, number[]> = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10, 50, 20],
    error: [50, 30, 50],
    notification: [15, 30, 15]
};

/**
 * Trigger haptic feedback
 */
export const haptic = (type: HapticType = 'light'): void => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const pattern = hapticPatterns[type] || hapticPatterns.light;
        navigator.vibrate(pattern);
    }
};

// Alias for compatibility
export const triggerHaptic = haptic;

// ============================================================
// ANIMATIONS
// ============================================================

/**
 * Create ripple effect on element
 */
export const createRipple = (event: MouseEvent): void => {
    const button = event.currentTarget as HTMLElement;
    if (!button) return;

    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();

    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
    `;

    button.style.position = 'relative';
    button.style.overflow = 'hidden';
    button.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
};

/**
 * Fade in animation
 */
export const fadeIn = (element: HTMLElement, duration: number = 300): void => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(10px)';
    element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    });
};

/**
 * Shake animation for errors
 */
export const shake = (element: HTMLElement): void => {
    element.style.animation = 'none';
    element.offsetHeight; // Trigger reflow
    element.style.animation = 'shakeHard 0.5s ease';
    haptic('error');
    playSound('error');
};

// Alias for compatibility
export const shakeElement = shake;

/**
 * Bounce animation for success
 */
export const bounceSuccess = (element: HTMLElement): void => {
    element.style.animation = 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    haptic('success');
    playSound('success');
};

/**
 * Slide in animation
 */
export const slideIn = (element: HTMLElement, direction: 'left' | 'right' | 'up' | 'down' = 'up', duration: number = 300): void => {
    const transforms: Record<string, string> = {
        left: 'translateX(-20px)',
        right: 'translateX(20px)',
        up: 'translateY(20px)',
        down: 'translateY(-20px)'
    };

    element.style.opacity = '0';
    element.style.transform = transforms[direction];
    element.style.transition = `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;

    requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'translate(0)';
    });
};

// ============================================================
// BUTTON LOADING STATE
// ============================================================

/**
 * Set button loading state
 */
export const setButtonLoading = (button: HTMLButtonElement, loading: boolean = true): void => {
    if (loading) {
        button.dataset.originalContent = button.innerHTML;
        button.innerHTML = `
            <div style="
                width: 24px;
                height: 24px;
                border: 3px solid rgba(255,255,255,0.3);
                border-top-color: white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            "></div>
        `;
        button.disabled = true;
        button.classList.add('loading');
    } else {
        button.innerHTML = button.dataset.originalContent || button.innerHTML;
        button.disabled = false;
        button.classList.remove('loading');
    }
};

// ============================================================
// STYLES INJECTION
// ============================================================

/**
 * Add required CSS animations
 */
export const injectAnimationStyles = (): void => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ux-effects-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'ux-effects-styles';
    styles.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }

        @keyframes shakeHard {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-8px) rotate(-1deg); }
            20%, 40%, 60%, 80% { transform: translateX(8px) rotate(1deg); }
        }

        @keyframes bounceIn {
            0% { transform: scale(0.3); opacity: 0; }
            50% { transform: scale(1.05); }
            70% { transform: scale(0.9); }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;
    document.head.appendChild(styles);
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize UX effects
 */
export const initUXEffects = (): void => {
    loadTheme();
    applyTheme(currentTheme);
    injectAnimationStyles();
    logger.info('✅ UX Effects initialized', undefined, 'uxEffectsService');
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect } from 'react';

interface UseUXEffectsReturn {
    theme: Theme;
    toggleTheme: () => void;
    playSound: (sound: SoundType) => void;
    haptic: (type: HapticType) => void;
}

export const useUXEffects = (): UseUXEffectsReturn => {
    const [theme, setTheme] = useState<Theme>(() => loadTheme());

    useEffect(() => {
        injectAnimationStyles();
    }, []);

    const handleToggleTheme = useCallback(() => {
        const newTheme = toggleTheme();
        setTheme(newTheme);
    }, []);

    const handlePlaySound = useCallback((sound: SoundType) => {
        playSound(sound);
    }, []);

    const handleHaptic = useCallback((type: HapticType) => {
        haptic(type);
    }, []);

    return {
        theme,
        toggleTheme: handleToggleTheme,
        playSound: handlePlaySound,
        haptic: handleHaptic
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Theme
    loadTheme,
    applyTheme,
    toggleTheme,
    getTheme,

    // Sound
    playSound,
    playRequestSound,
    setSoundsEnabled,

    // Haptic
    haptic,
    triggerHaptic,

    // Animations
    createRipple,
    fadeIn,
    shake,
    shakeElement,
    bounceSuccess,
    slideIn,

    // Button
    setButtonLoading,

    // Init
    initUXEffects,
    injectAnimationStyles,

    // Hook
    useUXEffects
};
