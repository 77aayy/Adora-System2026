/**
 * Confetti Celebration Component
 * Adora Hotel Management System V2
 */

import React, { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

// ============================================================
// TYPES
// ============================================================

export type ConfettiPreset = 'celebration' | 'success' | 'points' | 'achievement' | 'fireworks';

interface ConfettiOptions {
    particleCount?: number;
    spread?: number;
    startVelocity?: number;
    decay?: number;
    gravity?: number;
    colors?: string[];
    origin?: { x: number; y: number };
}

// ============================================================
// DEFAULT COLORS (Adora Brand)
// ============================================================

const ADORA_COLORS = ['#0D9488', '#14B8A6', '#2DD4BF', '#FFD700', '#FF6B6B'];

// ============================================================
// CONFETTI FUNCTIONS
// ============================================================

/**
 * Fire basic confetti
 */
export const fireConfetti = (options: ConfettiOptions = {}): void => {
    confetti({
        particleCount: options.particleCount ?? 100,
        spread: options.spread ?? 70,
        startVelocity: options.startVelocity ?? 30,
        decay: options.decay ?? 0.9,
        gravity: options.gravity ?? 1,
        colors: options.colors ?? ADORA_COLORS,
        origin: options.origin ?? { x: 0.5, y: 0.6 },
        scalar: 1.2,
    });
};

/**
 * Fire celebration confetti (both sides)
 */
export const fireCelebration = (): void => {
    const count = 200;
    const defaults = {
        colors: ADORA_COLORS,
        origin: { y: 0.7 },
    };

    function fire(particleRatio: number, opts: confetti.Options) {
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
        });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
};

/**
 * Fire success confetti
 */
export const fireSuccess = (): void => {
    confetti({
        particleCount: 50,
        spread: 50,
        colors: ['#22C55E', '#10B981', '#14B8A6'],
        origin: { x: 0.5, y: 0.6 },
    });
};

/**
 * Fire points earned confetti
 */
export const firePoints = (): void => {
    confetti({
        particleCount: 30,
        spread: 40,
        colors: ['#FFD700', '#FFA500', '#FF8C00'],
        origin: { x: 0.5, y: 0.5 },
        shapes: ['star'],
        scalar: 1.5,
    });
};

/**
 * Fire fireworks effect
 */
export const fireFireworks = (): void => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }

    const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            clearInterval(interval);
            return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ADORA_COLORS,
        });
        confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ADORA_COLORS,
        });
    }, 250);
};

/**
 * Fire confetti by preset
 */
export const firePreset = (preset: ConfettiPreset): void => {
    switch (preset) {
        case 'celebration':
            fireCelebration();
            break;
        case 'success':
            fireSuccess();
            break;
        case 'points':
            firePoints();
            break;
        case 'achievement':
            fireCelebration();
            setTimeout(firePoints, 500);
            break;
        case 'fireworks':
            fireFireworks();
            break;
    }
};

// ============================================================
// REACT HOOK
// ============================================================

export const useConfetti = () => {
    return {
        fire: fireConfetti,
        celebration: fireCelebration,
        success: fireSuccess,
        points: firePoints,
        fireworks: fireFireworks,
        preset: firePreset,
    };
};

// ============================================================
// REACT COMPONENT
// ============================================================

interface ConfettiTriggerProps {
    trigger?: boolean;
    preset?: ConfettiPreset;
    onComplete?: () => void;
    children?: React.ReactNode;
}

export const ConfettiTrigger: React.FC<ConfettiTriggerProps> = ({
    trigger,
    preset = 'celebration',
    onComplete,
    children,
}) => {
    const prevTrigger = useRef(trigger);

    useEffect(() => {
        if (trigger && !prevTrigger.current) {
            firePreset(preset);
            onComplete?.();
        }
        prevTrigger.current = trigger;
    }, [trigger, preset, onComplete]);

    return <>{children}</>;
};

export default {
    fire: fireConfetti,
    celebration: fireCelebration,
    success: fireSuccess,
    points: firePoints,
    fireworks: fireFireworks,
    preset: firePreset,
    useConfetti,
    ConfettiTrigger,
};
