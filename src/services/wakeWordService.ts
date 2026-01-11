/**
 * Wake Word Detection Service
 * Listens continuously for "أدورا" / "يا أدورا" / "Hey Adora"
 * Adora Hotel Management System V2
 */

// 🎯 Flexible Wake Word Patterns (Arabic + English)
const WAKE_WORDS = [
    'أدورا',      // Adora (Arabic)
    'ادورا',      // Adora (Arabic without hamza)
    'يا أدورا',   // Ya Adora
    'يا ادورا',   // Ya Adora (without hamza)
    'adora',      // English
    'hey adora',  // Hey Adora
    'hi adora',   // Hi Adora
];

// Normalize text for matching (remove diacritics, lowercase)
const normalizeText = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[ًٌٍَُِّْ]/g, '') // Remove Arabic diacritics
        .replace(/أ|إ|آ/g, 'ا')    // Normalize alef variants
        .trim();
};

// Check if text contains wake word
const containsWakeWord = (text: string): boolean => {
    const normalized = normalizeText(text);
    return WAKE_WORDS.some(word => normalized.includes(normalizeText(word)));
};

// Extract command after wake word (if any)
const extractCommandAfterWakeWord = (text: string): string | null => {
    const normalized = normalizeText(text);

    for (const word of WAKE_WORDS) {
        const normalizedWord = normalizeText(word);
        const index = normalized.indexOf(normalizedWord);

        if (index !== -1) {
            // Get text after wake word
            const afterWord = text.substring(index + word.length).trim();
            return afterWord.length > 2 ? afterWord : null;
        }
    }
    return null;
};

export interface WakeWordServiceOptions {
    onWakeWordDetected: (followUpCommand?: string) => void;
    onError?: (error: string) => void;
    language?: string;
}

let recognition: any = null;
let isListening = false;
let restartTimeout: NodeJS.Timeout | null = null;

/**
 * Check if wake word detection is supported
 */
export const isWakeWordSupported = (): boolean => {
    return !!(window as any).webkitSpeechRecognition || !!(window as any).SpeechRecognition;
};

/**
 * Start continuous wake word listening
 */
export const startWakeWordListening = (options: WakeWordServiceOptions): boolean => {
    if (!isWakeWordSupported()) {
        console.warn('🎤 Wake word not supported in this browser');
        options.onError?.('Wake word not supported');
        return false;
    }

    if (isListening) {
        console.log('🎤 Wake word already listening');
        return true;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    recognition = new SpeechRecognition();

    // Configuration for continuous listening
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.language || 'ar-EG';
    recognition.maxAlternatives = 3; // Get multiple interpretations

    recognition.onstart = () => {
        console.log('👂 Wake word listening started...');
        isListening = true;
    };

    recognition.onresult = (event: any) => {
        // Check all results (including alternatives)
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];

            // Check main result and alternatives
            for (let j = 0; j < result.length; j++) {
                const transcript = result[j].transcript;
                console.log(`🎤 Heard: "${transcript}" (confidence: ${result[j].confidence?.toFixed(2)})`);

                if (containsWakeWord(transcript)) {
                    console.log('✨ WAKE WORD DETECTED!');

                    // Extract any command after wake word
                    const followUpCommand = extractCommandAfterWakeWord(transcript);

                    // Pause listening while main agent handles command
                    pauseWakeWordListening();

                    // Notify callback
                    options.onWakeWordDetected(followUpCommand || undefined);
                    return;
                }
            }
        }
    };

    recognition.onerror = (event: any) => {
        console.warn('👂 Wake word error:', event.error);

        // 🛑 FATAL ERRORS: Stop the loop immediately
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            console.error('🚫 Microphone access denied. Stopping wake word detection.');
            stopWakeWordListening(); // Kill the service completely
            options.onError?.(event.error);
            return;
        }

        if (event.error === 'no-speech' || event.error === 'aborted') {
            // Normal, just restart
            scheduleRestart(options);
        } else {
            console.warn('⚠️ Non-fatal wake word error:', event.error);
            scheduleRestart(options, 2000); // Back off to 2 seconds for unknown errors
            options.onError?.(event.error);
        }
    };

    recognition.onend = () => {
        console.log('🎤 Wake word recognition ended');
        isListening = false;

        // 🔄 AUTO-RESTART: Only if not explicitly killed
        if (recognition) {
            scheduleRestart(options);
        }
    };

    try {
        recognition.start();
        return true;
    } catch (error) {
        console.error('🎤 Failed to start wake word:', error);
        return false;
    }
};

/**
 * Schedule auto-restart of listening
 * @param delay Default is 100ms for seamless listening
 */
const scheduleRestart = (options: WakeWordServiceOptions, delay: number = 100) => {
    if (restartTimeout) {
        clearTimeout(restartTimeout);
    }

    // Only restart if service wasn't explicitly killed/nulled
    if (!recognition) return;

    restartTimeout = setTimeout(() => {
        if (recognition && !isListening) {
            try {
                recognition.start();
            } catch (e) {
                console.warn('🎤 Restart failed, will try again in 5s');
                scheduleRestart(options, 5000); // Exponential-ish backoff
            }
        }
    }, delay);
};

/**
 * Temporarily pause wake word listening (e.g., while main agent speaks)
 */
export const pauseWakeWordListening = () => {
    if (recognition && isListening) {
        try {
            recognition.stop();
            isListening = false;
            console.log('🎤 Wake word paused');
        } catch (e) {
            // Already stopped
        }
    }

    if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
    }
};

/**
 * Resume wake word listening
 */
export const resumeWakeWordListening = (options: WakeWordServiceOptions) => {
    if (!isListening && recognition) {
        scheduleRestart(options);
    }
};

/**
 * Stop wake word listening completely
 */
export const stopWakeWordListening = () => {
    if (restartTimeout) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
    }

    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            // Already stopped
        }
        recognition = null;
    }

    isListening = false;
    console.log('🎤 Wake word stopped');
};

/**
 * Check if currently listening for wake word
 */
export const isWakeWordListening = (): boolean => isListening;
