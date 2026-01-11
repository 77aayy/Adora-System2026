/**
 * Voice Command Service 🎤
 * Arabic voice commands for hands-free operation
 * Perfect for housekeeping staff with busy hands
 * Adora Hotel Management System V3 - SaaS
 */

// ============================================================
// TYPES
// ============================================================

export interface VoiceCommand {
    pattern: RegExp;
    action: string;
    params: string[];
    example: string;
    department?: string;
}

export interface VoiceCommandResult {
    recognized: boolean;
    command: string;
    action: string | null;
    params: Record<string, string>;
    confidence: number;
    suggestions?: string[];
}

// ============================================================
// ARABIC VOICE COMMANDS
// ============================================================

const VOICE_COMMANDS: VoiceCommand[] = [
    // Room Status Commands
    {
        pattern: /(?:افتح|فتح)\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'OPEN_ROOM',
        params: ['roomNumber'],
        example: 'افتح غرفة 101',
        department: 'housekeeping',
    },
    {
        pattern: /(?:اتمم|أنهي|خلصت|انتهيت من)\s*(?:التنظيف|تنظيف)?\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'COMPLETE_CLEANING',
        params: ['roomNumber'],
        example: 'خلصت تنظيف غرفة 102',
        department: 'housekeeping',
    },
    {
        pattern: /(?:ابدأ|بدء)\s*(?:تنظيف)?\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'START_CLEANING',
        params: ['roomNumber'],
        example: 'ابدأ تنظيف غرفة 103',
        department: 'housekeeping',
    },
    
    // Bellman Commands
    {
        pattern: /(?:تسليم|سلمت)\s*(?:الأمتعة|امتعة|شنط)?\s*(?:غرفة|للغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'DELIVER_LUGGAGE',
        params: ['roomNumber'],
        example: 'سلمت الأمتعة غرفة 201',
        department: 'bellman',
    },
    {
        pattern: /(?:دخول|تشيك ان|check in)\s*(?:نزيل|ضيف)?\s*(?:غرفة|للغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'CHECKIN_GUEST',
        params: ['roomNumber'],
        example: 'تشيك ان غرفة 202',
        department: 'bellman',
    },
    {
        pattern: /(?:خروج|تشيك اوت|check out)\s*(?:نزيل|ضيف)?\s*(?:غرفة|من غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'CHECKOUT_GUEST',
        params: ['roomNumber'],
        example: 'تشيك اوت غرفة 203',
        department: 'bellman',
    },
    
    // Maintenance Commands
    {
        pattern: /(?:صيانة|إصلاح|فيه مشكلة)\s*(?:في)?\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)\s*(.+)?/i,
        action: 'REPORT_MAINTENANCE',
        params: ['roomNumber', 'issue'],
        example: 'صيانة غرفة 301 التكييف معطل',
        department: 'maintenance',
    },
    {
        pattern: /(?:أنهيت|خلصت)\s*(?:الصيانة|إصلاح)?\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'COMPLETE_MAINTENANCE',
        params: ['roomNumber'],
        example: 'أنهيت الصيانة غرفة 302',
        department: 'maintenance',
    },
    
    // Reception Commands
    {
        pattern: /(?:طلب جديد|طلب)\s*(?:من)?\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)\s*(.+)?/i,
        action: 'NEW_REQUEST',
        params: ['roomNumber', 'description'],
        example: 'طلب جديد من غرفة 401 يحتاج منشفة',
        department: 'reception',
    },
    {
        pattern: /(?:أكد|تأكيد)\s*(?:الطلب|طلب)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'CONFIRM_REQUEST',
        params: ['requestId'],
        example: 'أكد الطلب 123',
        department: 'reception',
    },
    
    // Navigation Commands
    {
        pattern: /(?:اذهب|روح|افتح)\s*(?:إلى|ل|لصفحة)?\s*(الاستقبال|النظافة|البيلمان|الصيانة|المشتريات|الإعدادات)/i,
        action: 'NAVIGATE',
        params: ['page'],
        example: 'روح للنظافة',
    },
    
    // Status Queries
    {
        pattern: /(?:كم|عدد)\s*(?:الطلبات|طلب)\s*(?:الجديدة|المعلقة|اليوم)?/i,
        action: 'COUNT_REQUESTS',
        params: [],
        example: 'كم الطلبات الجديدة',
    },
    {
        pattern: /(?:حالة|وضع)\s*(?:غرفة|الغرفة)?\s*(?:رقم)?\s*(\d+)/i,
        action: 'ROOM_STATUS',
        params: ['roomNumber'],
        example: 'حالة غرفة 501',
    },
    
    // Quick Actions
    {
        pattern: /(?:نداء|اتصل|كلم)\s*(?:الاستقبال|المدير|الأمن)/i,
        action: 'CALL_DEPARTMENT',
        params: ['department'],
        example: 'نداء الاستقبال',
    },
    {
        pattern: /(?:طوارئ|حريق|إسعاف|إنذار)/i,
        action: 'EMERGENCY_ALERT',
        params: [],
        example: 'طوارئ',
    },
];

// ============================================================
// VOICE RECOGNITION
// ============================================================

let recognition: SpeechRecognition | null = null;
let isListening = false;
let onResultCallback: ((result: VoiceCommandResult) => void) | null = null;

/**
 * Check if voice recognition is supported
 */
export function isVoiceSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/**
 * Initialize voice recognition
 */
export function initVoiceRecognition(): boolean {
    if (!isVoiceSupported()) {
        console.warn('Voice recognition not supported');
        return false;
    }
    
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.lang = 'ar-SA'; // Arabic (Saudi)
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    
    recognition.onresult = (event) => {
        const results = event.results[0];
        const transcript = results[0].transcript;
        const confidence = results[0].confidence;
        
        const parsed = parseVoiceCommand(transcript);
        parsed.confidence = Math.round(confidence * 100);
        
        if (onResultCallback) {
            onResultCallback(parsed);
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Voice recognition error:', event.error);
        isListening = false;
        
        if (onResultCallback) {
            onResultCallback({
                recognized: false,
                command: '',
                action: null,
                params: {},
                confidence: 0,
                suggestions: ['حاول مرة أخرى', 'تأكد من صلاحيات الميكروفون'],
            });
        }
    };
    
    recognition.onend = () => {
        isListening = false;
    };
    
    return true;
}

/**
 * Start listening for voice commands
 */
export function startListening(
    callback: (result: VoiceCommandResult) => void
): boolean {
    if (!recognition) {
        if (!initVoiceRecognition()) {
            return false;
        }
    }
    
    if (isListening) {
        stopListening();
    }
    
    onResultCallback = callback;
    isListening = true;
    recognition?.start();
    
    return true;
}

/**
 * Stop listening
 */
export function stopListening(): void {
    if (recognition && isListening) {
        recognition.stop();
        isListening = false;
    }
}

/**
 * Check if currently listening
 */
export function getIsListening(): boolean {
    return isListening;
}

// ============================================================
// COMMAND PARSING
// ============================================================

/**
 * Parse voice command text
 */
export function parseVoiceCommand(text: string): VoiceCommandResult {
    const normalizedText = normalizeArabicText(text);
    
    for (const cmd of VOICE_COMMANDS) {
        const match = normalizedText.match(cmd.pattern);
        
        if (match) {
            const params: Record<string, string> = {};
            cmd.params.forEach((param, index) => {
                if (match[index + 1]) {
                    params[param] = match[index + 1].trim();
                }
            });
            
            return {
                recognized: true,
                command: text,
                action: cmd.action,
                params,
                confidence: 100,
            };
        }
    }
    
    // No match found - provide suggestions
    const suggestions = VOICE_COMMANDS
        .filter(cmd => {
            // Simple similarity check
            const words = normalizedText.split(/\s+/);
            return words.some(word => cmd.example.includes(word));
        })
        .slice(0, 3)
        .map(cmd => cmd.example);
    
    return {
        recognized: false,
        command: text,
        action: null,
        params: {},
        confidence: 0,
        suggestions: suggestions.length > 0 ? suggestions : [
            'افتح غرفة 101',
            'خلصت التنظيف',
            'طلب جديد',
        ],
    };
}

/**
 * Normalize Arabic text for better matching
 */
function normalizeArabicText(text: string): string {
    return text
        .replace(/[إأآا]/g, 'ا')
        .replace(/[ىي]/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .toLowerCase()
        .trim();
}

// ============================================================
// TEXT-TO-SPEECH FEEDBACK
// ============================================================

/**
 * Speak response in Arabic
 */
export function speak(text: string): void {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // Find Arabic voice
        const voices = speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) {
            utterance.voice = arabicVoice;
        }
        
        speechSynthesis.speak(utterance);
    }
}

/**
 * Get voice command examples by department
 */
export function getCommandExamples(department?: string): string[] {
    return VOICE_COMMANDS
        .filter(cmd => !department || !cmd.department || cmd.department === department)
        .map(cmd => cmd.example);
}

export default {
    isVoiceSupported,
    initVoiceRecognition,
    startListening,
    stopListening,
    getIsListening,
    parseVoiceCommand,
    speak,
    getCommandExamples,
};
