/**
 * Voice Input Service
 * Speech recognition for hands-free input
 * Adora Hotel Management System V2
 */

import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

interface VoiceInputOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onStart?: () => void;
    onEnd?: () => void;
}

interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

// ============================================================
// STATE
// ============================================================

let recognition: any = null;
let isListening = false;
let currentCallback: ((text: string, isFinal: boolean) => void) | null = null;

// ============================================================
// BROWSER SUPPORT
// ============================================================

/**
 * Check if speech recognition is supported
 */
export const isVoiceInputSupported = (): boolean => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
};

/**
 * Get SpeechRecognition constructor
 */
const getSpeechRecognition = (): any => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
};


// ============================================================
// REFINER LOGIC (GENIUS FEATURE)
// ============================================================

const JARGON_MAP: Record<string, RegExp> = {
    // Departments
    'Housekeeping': /(hous\s*keeping|hows\s*keeping|house\s*clean)/gi,
    'Minibar': /(mini\s*bar|meeny\s*bar|mini\s*fridge)/gi,
    'Reception': /(recep\s*shon|resip\s*eshen|front\s*desk)/gi,
    'Bellman': /(bel\s*man|bill\s*man|luggage\s*guy)/gi,
    'Check-in': /(check\s*in|chick\s*in)/gi,
    'Check-out': /(check\s*out|chick\s*out)/gi,
    'Maintenance': /(main\s*ten\s*ance|fix\s*it|broken)/gi,
    'Room': /(rome|r\s*oo\s*m)/gi,

    // Laundry Specific (Multi-Lingual/Phonetic)
    'شرشف': /(shar\s*shaf|shar\s*chef|sheet|bed\s*sheet)/gi,
    'منشفة': /(man\s*shafa|tow\s*el|fouta|foo\s*ta)/gi,
    'كيس مخدة': /(pillow\s*case|kes\s*makhada|kis\s*makhada)/gi,
    'وجه لحاف': /(duvet|wejh|wageh)/gi,
    'روب': /(robe|bath\s*robe|roob)/gi,
    'دعاسة': /(mat|da\s*asa|da\s*3a\s*sa)/gi
};

export const refineTranscript = (text: string): string => {
    let refined = text;
    Object.entries(JARGON_MAP).forEach(([replacement, regex]) => {
        refined = refined.replace(regex, replacement);
    });
    return refined;
};

// ============================================================
// CONTROL FUNCTIONS
// ============================================================

/**
 * Initialize voice input
 * ✅ IMPROVED: Better error handling and auto-recovery
 */
let lastInitOptions: VoiceInputOptions = {};
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;

export const initVoiceInput = (options: VoiceInputOptions = {}): boolean => {
    if (!isVoiceInputSupported()) {
        logger.warn('Speech recognition not supported', undefined, 'voiceInputService');
        return false;
    }

    // 🛡️ Cleanup previous instance if exists
    if (recognition) {
        try {
            recognition.abort();
        } catch (e) {
            logger.warn('Failed to abort previous recognition:', e, 'voiceInputService');
        }
        recognition = null;
    }

    const SpeechRecognition = getSpeechRecognition();
    recognition = new SpeechRecognition();
    lastInitOptions = options;

    // Configure
    recognition.lang = options.language || 'ar-SA';
    recognition.continuous = options.continuous === true;
    // ✅ FIX: Proper boolean check for interimResults
    recognition.interimResults = options.interimResults !== false;
    recognition.maxAlternatives = 1;

    // Event handlers
    recognition.onstart = () => {
        isListening = true;
        initRetryCount = 0; // Reset retry count on success
        options.onStart?.();
        logger.info('🎤 Voice input started', undefined, 'voiceInputService');
    };

    recognition.onend = () => {
        const wasListening = isListening;
        isListening = false;
        options.onEnd?.();
        logger.info('🎤 Voice input ended', wasListening ? '(was listening)' : '(was not listening)', 'voiceInputService');
    };

    // 🛡️ Handle audio events for debugging
    recognition.onaudiostart = () => {
        logger.info('🔊 Audio capture started', undefined, 'voiceInputService');
    };

    recognition.onaudioend = () => {
        logger.info('🔇 Audio capture ended', undefined, 'voiceInputService');
    };

    recognition.onspeechstart = () => {
        logger.info('🗣️ Speech detected', undefined, 'voiceInputService');
    };

    recognition.onspeechend = () => {
        logger.info('🤐 Speech ended', undefined, 'voiceInputService');
    };

    recognition.onnomatch = () => {
        logger.warn('❓ No speech recognized (nomatch)', undefined, 'voiceInputService');
        options.onError?.('no-speech');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
        const result = event.results[event.resultIndex];
        let transcript = result[0].transcript;
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;

        logger.info(`🎯 Result: "${transcript}" (final: ${isFinal}, confidence: ${(confidence * 100).toFixed(1)}%)`, undefined, 'voiceInputService');

        // 🧠 Apply Genius Refiner
        if (isFinal) {
            transcript = refineTranscript(transcript);
            logger.debug(`🧠 Refined: "${result[0].transcript}" -> "${transcript}"`, undefined, 'voiceInputService');
        }

        options.onResult?.(transcript, isFinal);
        currentCallback?.(transcript, isFinal);

        // 🤫 SMART SILENCE DETECTION (Auto-Stop when user finishes speaking)
        if (typeof (window as any).silenceTimer !== 'undefined') clearTimeout((window as any).silenceTimer);

        (window as any).silenceTimer = setTimeout(() => {
            if (isListening && transcript.trim().length > 0) {
                logger.info("🤫 Silence detected, auto-sending...", undefined, 'voiceInputService');
                stopListening();
            }
        }, 2500); // 2.5 seconds silence = Done talking (increased from 2s)
    };

    recognition.onerror = (event: any) => {
        const error = event.error;
        logger.error('🔴 Voice input error:', { error, event }, 'voiceInputService');
        
        // 🛡️ Handle specific errors
        switch (error) {
            case 'no-speech':
                logger.warn('⚠️ No speech detected - user may not have spoken', undefined, 'voiceInputService');
                // Don't call error callback for no-speech, just end silently
                isListening = false;
                options.onEnd?.();
                break;
                
            case 'aborted':
                logger.warn('⚠️ Recognition aborted (intentional stop)', undefined, 'voiceInputService');
                isListening = false;
                break;
                
            case 'audio-capture':
                logger.error('🎤 No microphone found or microphone error', undefined, 'voiceInputService');
                options.onError?.('لم يتم العثور على ميكروفون أو حدث خطأ في التسجيل');
                isListening = false;
                break;
                
            case 'not-allowed':
                logger.error('🚫 Microphone permission denied', undefined, 'voiceInputService');
                options.onError?.('لم يتم السماح بالوصول للميكروفون');
                isListening = false;
                break;
                
            case 'network':
                logger.error('🌐 Network error during speech recognition', undefined, 'voiceInputService');
                options.onError?.('خطأ في الشبكة أثناء التعرف على الصوت');
                isListening = false;
                // 🔄 Auto-retry for network errors
                if (initRetryCount < MAX_INIT_RETRIES) {
                    initRetryCount++;
                    logger.info(`🔄 Retrying... (${initRetryCount}/${MAX_INIT_RETRIES})`, undefined, 'voiceInputService');
                    setTimeout(() => {
                        if (initVoiceInput(lastInitOptions)) {
                            startListening(currentCallback || undefined);
                        }
                    }, 1000);
                }
                break;
                
            case 'service-not-allowed':
                logger.error('🚫 Speech recognition service not allowed', undefined, 'voiceInputService');
                options.onError?.('خدمة التعرف على الصوت غير متاحة');
                isListening = false;
                break;
                
            default:
                options.onError?.(error);
                isListening = false;
        }
    };

    logger.info('✅ Voice input initialized with lang:', recognition.lang, 'voiceInputService');
    return true;
};

// ============================================================
// CONTROL FUNCTIONS
// ============================================================

/**
 * Start listening
 * ✅ IMPROVED: Added delay after stop to prevent abort errors
 */
let startPending = false;

export const startListening = (
    callback?: (text: string, isFinal: boolean) => void
): boolean => {
    if (!recognition) {
        if (!initVoiceInput(lastInitOptions)) {
            return false;
        }
    }

    // 🛡️ Prevent multiple starts
    if (startPending) {
        logger.warn('⚠️ Start already pending, ignoring...', undefined, 'voiceInputService');
        return false;
    }

    currentCallback = callback || null;

    // If already listening, stop first and wait
    if (isListening) {
        logger.info('🔄 Stopping current session before restart...', undefined, 'voiceInputService');
        startPending = true;
        stopListening();
        
        // Wait for recognition to fully stop before starting again
        setTimeout(() => {
            startPending = false;
            try {
                recognition.start();
                logger.info('🎤 Recognition restarted after stop', undefined, 'voiceInputService');
            } catch (error: any) {
                logger.error('Failed to restart voice input:', error, 'voiceInputService');
                // 🛡️ Handle "already started" error
                if (error.name === 'InvalidStateError') {
                    logger.warn('⚠️ Recognition already running, ignoring...', undefined, 'voiceInputService');
                }
            }
        }, 300); // 300ms delay to ensure clean restart
        return true;
    }

    try {
        recognition.start();
        logger.info('🎤 Recognition started', undefined, 'voiceInputService');
        return true;
    } catch (error: any) {
        logger.error('Failed to start voice input:', error, 'voiceInputService');
        // 🛡️ Handle "already started" error
        if (error.name === 'InvalidStateError') {
            logger.warn('⚠️ Recognition already running, attempting restart...', undefined, 'voiceInputService');
            stopListening();
            setTimeout(() => {
                try {
                    recognition.start();
                } catch (e) {
                    logger.error('Restart failed:', e, 'voiceInputService');
                }
            }, 300);
        }
        return false;
    }
};

/**
 * Stop listening
 * ✅ IMPROVED: Better cleanup
 */
export const stopListening = (): void => {
    // Clear silence timer
    if (typeof (window as any).silenceTimer !== 'undefined') {
        clearTimeout((window as any).silenceTimer);
    }
    
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            logger.warn('Error stopping recognition:', e, 'voiceInputService');
        }
        isListening = false;
        currentCallback = null;
    }
};

/**
 * Toggle listening
 */
export const toggleListening = (
    callback?: (text: string, isFinal: boolean) => void
): boolean => {
    if (isListening) {
        stopListening();
        return false;
    } else {
        return startListening(callback);
    }
};

/**
 * Check if currently listening
 */
export const getListeningStatus = (): boolean => {
    return isListening;
};

// ============================================================
// LANGUAGE SUPPORT
// ============================================================

/**
 * Set recognition language
 */
export const setLanguage = (lang: string): void => {
    if (recognition) {
        recognition.lang = lang;
    }
};

/**
 * Get supported languages
 */
export const getSupportedLanguages = (): string[] => {
    return [
        'ar-SA', // Arabic (Saudi Arabia)
        'ar-EG', // Arabic (Egypt)
        'en-US', // English (US)
        'en-GB', // English (UK)
        'fr-FR', // French
        'de-DE', // German
        'es-ES', // Spanish
        'it-IT', // Italian
        'ja-JP', // Japanese
        'ko-KR', // Korean
        'zh-CN', // Chinese (Simplified)
        'zh-TW', // Chinese (Traditional)
        'ru-RU', // Russian
        'pt-BR', // Portuguese (Brazil)
        'hi-IN', // Hindi
        'tr-TR', // Turkish
    ];
};

// ============================================================
// VOICE COMMANDS
// ============================================================

interface VoiceCommand {
    patterns: string[];
    action: (params?: string) => void;
}

const commands: VoiceCommand[] = [];

/**
 * Register a voice command
 */
export const registerCommand = (patterns: string[], action: (params?: string) => void): void => {
    commands.push({ patterns, action });
};

/**
 * Clear all registered commands
 */
export const clearCommands = (): void => {
    commands.length = 0;
};

/**
 * Process voice input for commands
 */
export const processCommand = (text: string): boolean => {
    const normalizedText = text.trim().toLowerCase();

    for (const command of commands) {
        for (const pattern of command.patterns) {
            if (normalizedText.includes(pattern.toLowerCase())) {
                // Extract params after the pattern
                const params = normalizedText.split(pattern.toLowerCase())[1]?.trim();
                command.action(params);
                return true;
            }
        }
    }

    return false;
};

/**
 * Start command listening mode
 */
export const startCommandMode = (): void => {
    startListening((text, isFinal) => {
        if (isFinal) {
            processCommand(text);
        }
    });
};

// ============================================================
// PRESET COMMANDS (Arabic)
// ============================================================

/**
 * Register Arabic hotel commands
 */
export const registerHotelCommands = (handlers: {
    onCleaningRequest?: (room?: string) => void;
    onMaintenanceRequest?: (room?: string) => void;
    onBellmanRequest?: (room?: string) => void;
    onSearch?: (query: string) => void;
}): void => {
    // Cleaning commands
    if (handlers.onCleaningRequest) {
        registerCommand(
            ['طلب تنظيف', 'نظافة غرفة', 'تنظيف'],
            (params) => handlers.onCleaningRequest!(params)
        );
    }

    // Maintenance commands
    if (handlers.onMaintenanceRequest) {
        registerCommand(
            ['طلب صيانة', 'صيانة غرفة', 'عطل'],
            (params) => handlers.onMaintenanceRequest!(params)
        );
    }

    // Bellman commands
    if (handlers.onBellmanRequest) {
        registerCommand(
            ['طلب بيلمان', 'أمتعة', 'حقائب'],
            (params) => handlers.onBellmanRequest!(params)
        );
    }

    // Search commands
    if (handlers.onSearch) {
        registerCommand(
            ['ابحث عن', 'بحث', 'فين'],
            (params) => handlers.onSearch!(params || '')
        );
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useEffect, useCallback } from 'react';

export const useVoiceInput = (options: VoiceInputOptions = {}) => {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        setSupported(isVoiceInputSupported());

        const success = initVoiceInput({
            ...options,
            onStart: () => {
                setListening(true);
                options.onStart?.();
            },
            onEnd: () => {
                setListening(false);
                options.onEnd?.();
            },
            onResult: (text, isFinal) => {
                setTranscript(text);
                options.onResult?.(text, isFinal);
            }
        });

        return () => {
            stopListening();
        };
    }, []);

    const start = useCallback(() => {
        startListening();
    }, []);

    const stop = useCallback(() => {
        stopListening();
    }, []);

    const toggle = useCallback(() => {
        toggleListening();
    }, []);

    const clear = useCallback(() => {
        setTranscript('');
    }, []);

    return {
        listening,
        transcript,
        supported,
        start,
        stop,
        toggle,
        clear,
        setLanguage
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    isVoiceInputSupported,
    initVoiceInput,
    startListening,
    stopListening,
    toggleListening,
    getListeningStatus,
    setLanguage,
    getSupportedLanguages,
    registerCommand,
    clearCommands,
    processCommand,
    startCommandMode,
    registerHotelCommands,
    useVoiceInput
};
