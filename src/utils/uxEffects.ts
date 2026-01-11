/**
 * UX Effects System
 * Sound, Haptic, and Animation effects
 * Adora Hotel Management System V2
 */

// ============================================================
// HAPTIC FEEDBACK
// ============================================================

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'notification' | 'warning';

const hapticPatterns: Record<HapticType, number[]> = {
    light: [10],
    medium: [20],
    heavy: [30],
    success: [10, 50, 10, 50, 20],
    error: [50, 30, 50],
    notification: [15, 30, 15],
};

/**
 * Trigger haptic feedback
 */
export const haptic = (type: HapticType = 'light'): void => {
    if (!navigator.vibrate) return;
    navigator.vibrate(hapticPatterns[type] || hapticPatterns.light);
};

// Alias for compatibility
export const triggerHaptic = haptic;

// ============================================================
// SOUND EFFECTS
// ============================================================

export type SoundType = 'click' | 'success' | 'error' | 'notification' | 'toggle' |
    'cleaning' | 'maintenance' | 'bellman' | 'coffee' | 'urgent' | 'receive' | 'pop' | 'alert';

/**
 * Create a beep sound using Web Audio API
 */
const createBeep = (
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    multipliers: number[] = [1]
): (() => void) => {
    return () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

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
            console.log('Audio not supported');
        }
    };
};

/**
 * Create urgent sound
 */
const createUrgentSound = (): (() => void) => {
    return () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            [0, 0.15, 0.3].forEach((delay) => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 880;
                oscillator.type = 'square';

                const startTime = audioContext.currentTime + delay;
                gainNode.gain.setValueAtTime(0.1, startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);

                oscillator.start(startTime);
                oscillator.stop(startTime + 0.1);
            });
        } catch (e) {
            console.log('Audio not supported');
        }
    };
};

/**
 * Create soft receive sound (WhatsApp-style)
 */
const createReceiveSound = (): (() => void) => {
    return () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Soft ding sound - very subtle
            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1320, audioContext.currentTime + 0.05);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very soft
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.log('Audio not supported');
        }
    };
};

// Sound library
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
    urgent: createUrgentSound(),
    receive: createReceiveSound(),
};

/**
 * Play a sound
 */
export const playSound = (soundName: SoundType): void => {
    if (localStorage.getItem('adora_sounds') === 'off') return;
    if (sounds[soundName]) {
        sounds[soundName]();
    }
};

/**
 * Play request sound based on type
 */
export const playRequestSound = (serviceType: string, isUrgent = false): void => {
    if (localStorage.getItem('adora_sounds') === 'off') return;

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

// ============================================================
// ANIMATIONS
// ============================================================

/**
 * Fade in animation
 */
export const fadeIn = (element: HTMLElement, duration = 300): void => {
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

// Alias
export const shakeElement = shake;

/**
 * Bounce success animation
 */
export const bounceSuccess = (element: HTMLElement): void => {
    element.style.animation = 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    haptic('success');
    playSound('success');
};

/**
 * Create ripple effect
 */
export const createRipple = (event: React.MouseEvent<HTMLElement>): void => {
    const button = event.currentTarget;
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

// ============================================================
// BUTTON LOADING STATE
// ============================================================

/**
 * Set button loading state
 */
export const setButtonLoading = (button: HTMLButtonElement, loading = true): void => {
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
// SPECIFIC MESSAGES
// ============================================================

const specificMessages: Record<string, Record<string, string>> = {
    ar: {
        login_success: 'مرحباً {name}! جاري تحويلك إلى {department}...',
        login_wrong_branch: 'كود الفرع "{code}" غير موجود. تأكد من الكود وحاول مرة أخرى.',
        login_wrong_employee: 'كود الموظف غير صحيح في فرع "{branch}". تأكد من الكود.',
        login_inactive: 'حسابك غير نشط. تواصل مع المدير.',
        login_empty_branch: 'أدخل كود الفرع أولاً',
        login_empty_employee: 'أدخل كود الموظف',
        network_error: 'فشل الاتصال بالخادم. تحقق من الإنترنت.',
        saved: 'تم الحفظ بنجاح',
        deleted: 'تم الحذف',
        updated: 'تم التحديث',
    },
    en: {
        login_success: 'Welcome {name}! Redirecting to {department}...',
        login_wrong_branch: 'Branch code "{code}" not found. Please check and try again.',
        login_wrong_employee: 'Invalid employee code for branch "{branch}". Please verify.',
        login_inactive: 'Your account is inactive. Contact the manager.',
        login_empty_branch: 'Enter branch code first',
        login_empty_employee: 'Enter employee code',
        network_error: 'Failed to connect to server. Check your internet.',
        saved: 'Saved successfully',
        deleted: 'Deleted',
        updated: 'Updated',
    },
};

/**
 * Get specific localized message
 */
export const getSpecificMessage = (key: string, params: Record<string, string> = {}): string => {
    const lang = localStorage.getItem('i18nextLng')?.substring(0, 2) || 'ar';
    const messages = specificMessages[lang] || specificMessages.ar;
    let message = messages[key] || key;

    Object.keys(params).forEach(param => {
        message = message.replace(`{${param}}`, params[param]);
    });

    return message;
};

// ============================================================
// CSS ANIMATIONS (inject on load)
// ============================================================

if (typeof document !== 'undefined') {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
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
    `;
    document.head.appendChild(styleEl);
}
