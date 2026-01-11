/**
 * Sound Manager Service
 * Audio feedback for actions
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

type SoundType =
    | 'notification'
    | 'success'
    | 'error'
    | 'warning'
    | 'click'
    | 'message'
    | 'checkin'
    | 'checkout'
    | 'points';

// ============================================================
// STATE
// ============================================================

let audioContext: AudioContext | null = null;
let enabled = true;
let volume = 0.5;

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize audio context (must be called after user interaction)
 */
export const initSoundManager = (): void => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Load saved preferences
    const savedEnabled = localStorage.getItem('adora_sounds');
    const savedVolume = localStorage.getItem('adora_volume');

    if (savedEnabled !== null) enabled = savedEnabled === 'true';
    if (savedVolume !== null) volume = parseFloat(savedVolume);

    console.log('✅ Sound manager initialized');
};

// ============================================================
// SOUND GENERATION
// ============================================================

/**
 * Play a tone with specific frequency
 */
const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine'): void => {
    if (!enabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
};

/**
 * Play a sequence of tones
 */
const playSequence = (frequencies: number[], duration: number = 0.15): void => {
    frequencies.forEach((freq, i) => {
        setTimeout(() => playTone(freq, duration), i * duration * 1000);
    });
};

// ============================================================
// SOUND EFFECTS
// ============================================================

/**
 * Play notification sound
 */
export const playNotification = (): void => {
    playSequence([880, 1100]);
};

/**
 * Play success sound
 */
export const playSuccess = (): void => {
    playSequence([523, 659, 784]);
};

/**
 * Play error sound
 */
export const playError = (): void => {
    playSequence([200, 150], 0.2);
};

/**
 * Play warning sound
 */
export const playWarning = (): void => {
    playSequence([440, 440], 0.1);
};

/**
 * Play click sound
 */
export const playClick = (): void => {
    playTone(1000, 0.05, 'square');
};

/**
 * Play message sound
 */
export const playMessage = (): void => {
    playSequence([660, 880]);
};

/**
 * Play check-in celebration
 */
export const playCheckin = (): void => {
    playSequence([523, 659, 784, 1047]);
};

/**
 * Play check-out sound
 */
export const playCheckout = (): void => {
    playSequence([784, 659, 523]);
};

/**
 * Play points earned sound
 */
export const playPoints = (): void => {
    playSequence([1047, 1319, 1568]);
};

/**
 * Play sound by type
 */
export const playSound = (type: SoundType): void => {
    switch (type) {
        case 'notification': playNotification(); break;
        case 'success': playSuccess(); break;
        case 'error': playError(); break;
        case 'warning': playWarning(); break;
        case 'click': playClick(); break;
        case 'message': playMessage(); break;
        case 'checkin': playCheckin(); break;
        case 'checkout': playCheckout(); break;
        case 'points': playPoints(); break;
    }
};

// ============================================================
// SETTINGS
// ============================================================

/**
 * Enable/disable sounds
 */
export const setSoundEnabled = (value: boolean): void => {
    enabled = value;
    localStorage.setItem('adora_sounds', String(value));
};

/**
 * Get sound enabled status
 */
export const isSoundEnabled = (): boolean => {
    return enabled;
};

/**
 * Toggle sounds
 */
export const toggleSound = (): boolean => {
    enabled = !enabled;
    localStorage.setItem('adora_sounds', String(enabled));
    return enabled;
};

/**
 * Set volume (0-1)
 */
export const setVolume = (value: number): void => {
    volume = Math.max(0, Math.min(1, value));
    localStorage.setItem('adora_volume', String(volume));
};

/**
 * Get current volume
 */
export const getVolume = (): number => {
    return volume;
};

// ============================================================
// HAPTIC FEEDBACK (Mobile)
// ============================================================

/**
 * Trigger haptic feedback if supported
 */
export const hapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'light'): void => {
    if ('vibrate' in navigator) {
        switch (type) {
            case 'light': navigator.vibrate(10); break;
            case 'medium': navigator.vibrate(25); break;
            case 'heavy': navigator.vibrate(50); break;
        }
    }
};

/**
 * Play sound with haptic feedback
 */
export const playSoundWithHaptic = (type: SoundType): void => {
    playSound(type);
    hapticFeedback(type === 'error' ? 'heavy' : type === 'warning' ? 'medium' : 'light');
};

// ============================================================
// REACT HOOK
// ============================================================

import { useCallback, useState, useEffect } from 'react';

export const useSound = () => {
    const [soundEnabled, setSoundEnabledState] = useState(enabled);
    const [soundVolume, setSoundVolumeState] = useState(volume);

    useEffect(() => {
        initSoundManager();
    }, []);

    const play = useCallback((type: SoundType) => {
        playSound(type);
    }, []);

    const toggle = useCallback(() => {
        const newValue = toggleSound();
        setSoundEnabledState(newValue);
        return newValue;
    }, []);

    const setEnabled = useCallback((value: boolean) => {
        setSoundEnabled(value);
        setSoundEnabledState(value);
    }, []);

    const setVol = useCallback((value: number) => {
        setVolume(value);
        setSoundVolumeState(value);
    }, []);

    return {
        play,
        enabled: soundEnabled,
        volume: soundVolume,
        toggle,
        setEnabled,
        setVolume: setVol,
        haptic: hapticFeedback
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
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
};
