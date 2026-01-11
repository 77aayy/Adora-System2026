/**
 * UX Context - Unified UX Feedback System
 * Ensures consistent haptic, sound, and toast feedback across the app
 * Adora Hotel Management System V2
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { haptic, playSound, HapticType, SoundType } from '../utils/uxEffects';
import { useToast } from '../components/common/ToastManager';

// ============================================================
// TYPES
// ============================================================

export type FeedbackType = 'success' | 'error' | 'warning' | 'info' | 'notification';

export interface FeedbackOptions {
    haptic?: boolean;
    sound?: boolean;
    toast?: boolean;
    message?: string;
    duration?: number;
}

export interface UXContextValue {
    // Main feedback function
    feedback: (type: FeedbackType, options?: FeedbackOptions) => void;

    // Quick shortcuts
    success: (message?: string) => void;
    error: (message?: string) => void;
    warning: (message?: string) => void;
    info: (message?: string) => void;
    notify: (message?: string) => void;

    // Action wrappers
    withFeedback: <T>(action: () => Promise<T> | T, successMessage?: string, errorMessage?: string) => Promise<T>;

    // Direct access
    haptic: typeof haptic;
    playSound: typeof playSound;

    // 🧠 Voice State
    voiceEnabled: boolean;
    toggleVoice: (enabled: boolean) => void;
}

// ============================================================
// FEEDBACK CONFIG
// ============================================================

const FEEDBACK_CONFIG: Record<FeedbackType, { haptic: HapticType; sound: SoundType }> = {
    success: { haptic: 'success', sound: 'success' },
    error: { haptic: 'error', sound: 'error' },
    warning: { haptic: 'medium', sound: 'notification' },
    info: { haptic: 'light', sound: 'click' },
    notification: { haptic: 'notification', sound: 'notification' },
};

// ============================================================
// CONTEXT
// ============================================================

const UXContext = createContext<UXContextValue | null>(null);

export const useUX = (): UXContextValue => {
    const context = useContext(UXContext);
    if (!context) {
        // Return a fallback that works without provider (for testing/SSR)
        return {
            feedback: () => { },
            success: () => { },
            error: () => { },
            warning: () => { },
            info: () => { },
            notify: () => { },
            withFeedback: async (action) => action(),
            haptic,
            playSound,
            voiceEnabled: false,
            toggleVoice: () => { },
        };
    }
    return context;
};

// ============================================================
// PROVIDER
// ============================================================

export const UXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const toast = useToast();

    // 🧠 Voice State Persistence
    const [voiceEnabled, setVoiceEnabled] = React.useState(() => {
        const saved = localStorage.getItem('adora_voice_enabled');
        return saved === 'true';
    });

    const toggleVoice = useCallback((enabled: boolean) => {
        setVoiceEnabled(enabled);
        localStorage.setItem('adora_voice_enabled', String(enabled));
    }, []);

    // Main feedback function
    const feedback = useCallback((
        type: FeedbackType,
        options: FeedbackOptions = {}
    ) => {
        const config = FEEDBACK_CONFIG[type];
        const {
            haptic: enableHaptic = true,
            sound: enableSound = true,
            toast: enableToast = !!options.message,
            message,
            duration,
        } = options;

        // Trigger haptic
        if (enableHaptic) {
            haptic(config.haptic);
        }

        // Play sound
        if (enableSound) {
            playSound(config.sound);
        }

        // Show toast
        if (enableToast && message) {
            const toastType = type === 'notification' ? 'info' : type;
            toast.showToast(toastType, message, duration);
        }
    }, [toast]);

    // Quick shortcuts
    const success = useCallback((message?: string) => {
        feedback('success', { message, toast: !!message });
    }, [feedback]);

    const error = useCallback((message?: string) => {
        feedback('error', { message, toast: !!message });
    }, [feedback]);

    const warning = useCallback((message?: string) => {
        feedback('warning', { message, toast: !!message });
    }, [feedback]);

    const info = useCallback((message?: string) => {
        feedback('info', { message, toast: !!message });
    }, [feedback]);

    const notify = useCallback((message?: string) => {
        feedback('notification', { message, toast: !!message });
    }, [feedback]);

    // Action wrapper with automatic feedback
    const withFeedback = useCallback(async <T,>(
        action: () => Promise<T> | T,
        successMessage?: string,
        errorMessage?: string
    ): Promise<T> => {
        try {
            const result = await action();
            success(successMessage);
            return result;
        } catch (err) {
            error(errorMessage || (err instanceof Error ? err.message : 'حدث خطأ'));
            throw err;
        }
    }, [success, error]);

    // Memoize context value (UPDATED)
    const contextValue = useMemo<UXContextValue>(() => ({
        feedback,
        success,
        error,
        warning,
        info,
        notify,
        withFeedback,
        haptic,
        playSound,
        voiceEnabled,
        toggleVoice
    }), [feedback, success, error, warning, info, notify, withFeedback, voiceEnabled, toggleVoice]);

    return (
        <UXContext.Provider value={contextValue}>
            {children}
        </UXContext.Provider>
    );
};

// ============================================================
// HOOK FOR BUTTON FEEDBACK
// ============================================================

export const useButtonFeedback = () => {
    const { haptic: triggerHaptic } = useUX();

    return useCallback((type: HapticType = 'light') => {
        triggerHaptic(type);
    }, [triggerHaptic]);
};

// ============================================================
// HOC FOR AUTOMATIC FEEDBACK
// ============================================================

export function withUXFeedback<P extends object>(
    WrappedComponent: React.ComponentType<P>
): React.FC<P> {
    return function WithUXFeedbackComponent(props: P) {
        return (
            <UXProvider>
                <WrappedComponent {...props} />
            </UXProvider>
        );
    };
}

export default UXProvider;
