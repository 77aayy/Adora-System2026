/**
 * Sound Service
 * Notification sounds and haptic feedback
 * Adora Hotel Management System V2
 * 
 * NOTE: This is a legacy file. Use src/services/soundService.ts instead.
 * This file exists for backward compatibility with older imports.
 */

// Re-export everything from the main sound service
export {
    initSoundManager,
    playSound,
    playNotification,
    playSuccess,
    playError,
    playWarning,
    playClick,
    playMessage,
    playCheckin,
    playCheckout,
    playPoints,
    setSoundEnabled,
    isSoundEnabled,
    toggleSound,
    setVolume,
    getVolume,
    hapticFeedback,
    playSoundWithHaptic,
    useSound
} from '../services/soundService';

// Legacy exports for backward compatibility
export { playNotification as playNotificationSound } from '../services/soundService';
export { playSuccess as playSuccessSound } from '../services/soundService';
export { playError as playErrorSound } from '../services/soundService';
export { hapticFeedback as triggerHaptic } from '../services/soundService';

/**
 * Legacy: Play new request notification (sound + haptic)
 */
export const playNewRequestAlert = (): void => {
    // Using dynamic import to avoid circular dependency
    import('../services/soundService').then(({ playNotification, hapticFeedback }) => {
        playNotification();
        hapticFeedback('medium');
    });
};
