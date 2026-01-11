/**
 * Voice Input Button Component (Smart AI V2)
 * Floating microphone button for voice input
 * NOW WITH WAKE WORD SUPPORT ("يا أدورا" / "أدورا")
 * AND MULTI-LANGUAGE AUTO-DETECT (Arabic, English, Hindi, Bengali)
 * Adora Hotel Management System V2
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Mic, X, Settings, Send, Square, Globe, Ear, EarOff, Languages } from 'lucide-react';
import {
    isVoiceInputSupported,
    initVoiceInput,
    startListening,
    stopListening,
    setLanguage,
    getSupportedLanguages,
} from '../../services/voiceInputService';
import {
    isWakeWordSupported,
    startWakeWordListening,
    stopWakeWordListening,
    pauseWakeWordListening,
    resumeWakeWordListening,
    isWakeWordListening,
} from '../../services/wakeWordService';
import {
    smartDetectLanguage,
    getLanguageOptions,
    getSTTCode,
    SUPPORTED_LANGUAGES,
    LanguageKey
} from '../../services/languageDetectionService';
import { useUX } from '../../context/UXContext';
import { usei18n } from '../../i18n/i18nContext';
import { useFeatureGate } from '../../hooks/useFeatureGate';

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    floatingButton: {
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', // Indigo/Violet (AI feel)
        border: 'none',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    floatingButtonActive: {
        transform: 'scale(1.1)',
        background: '#ef4444', // Red for Listening/Recording
        boxShadow: '0 0 0 8px rgba(239, 68, 68, 0.3)',
    },
    floatingButtonProcessing: {
        transform: 'scale(1.0)',
        background: '#3b82f6', // Blue for Processing
        cursor: 'wait',
    },
    modal: {
        position: 'fixed',
        bottom: '160px',
        left: '20px',
        width: '340px',
        background: 'rgba(15, 23, 42, 0.95)', // Slate 900
        backdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1001,
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.2)',
    },
    statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: '#10b981', // Emerald
        boxShadow: '0 0 8px #10b981',
    },
    statusText: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#e2e8f0', // Slate 200
    },
    actionsRow: {
        display: 'flex',
        gap: '8px',
    },
    iconBtn: {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: '8px',
        borderRadius: '12px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    transcriptArea: {
        minHeight: '80px',
        maxHeight: '150px',
        overflowY: 'auto',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        fontSize: '1.1rem',
        lineHeight: '1.6',
        color: '#f8fafc',
        direction: 'rtl', // Assuming Arabic primary
        border: '1px solid rgba(255, 255, 255, 0.05)',
    },
    controls: {
        display: 'flex',
        gap: '12px',
        marginTop: '8px',
    },
    actionBtn: {
        flex: 1,
        height: '48px',
        borderRadius: '14px',
        border: 'none',
        fontSize: '0.95rem',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        transition: 'all 0.2s',
    },
    stopBtn: {
        background: 'rgba(239, 68, 68, 0.1)', // Red tint
        color: '#f87171',
        border: '1px solid rgba(239, 68, 68, 0.2)',
    },
    sendBtn: {
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
    },
    settingsPanel: {
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap' as const,
        animation: 'fadeIn 0.2s ease',
    },
    langChip: {
        padding: '6px 14px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: '#cbd5e1',
        fontSize: '0.8rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    langChipActive: {
        background: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#6366f1',
        color: '#818cf8',
    }
};

// Language labels map
const LANG_LABELS: Record<string, string> = {
    'ar-SA': 'العربية',
    'en-US': 'English',
    'hi-IN': 'हिंदी',
    'bn-IN': 'বাংলা',
};

// ============================================================
// COMPONENT
// ============================================================

interface VoiceInputButtonProps {
    onResult?: (text: string) => void;
    targetInputId?: string;
    // 🛡️ Error Recovery Props
    isFallbackMode?: boolean;
    errorCount?: number;
    lastError?: string | null;
    onRetry?: () => void;
    onResetErrors?: () => void;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
    onResult,
    targetInputId,
    isFallbackMode = false,
    errorCount = 0,
    lastError = null,
    onRetry,
    onResetErrors,
}) => {
    const { language: appLang } = usei18n();
    const { voiceEnabled, playSound, haptic } = useUX();
    // ✅ Feature Gate: Check if AI Assistant feature is enabled
    const { isEnabled: isAiAssistantEnabled, loading: featureLoading } = useFeatureGate('aiAssistant');
    const [isOpen, setIsOpen] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [currentLang, setCurrentLang] = useState('ar-SA');
    const [showSettings, setShowSettings] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    // 🛡️ Text Input Mode
    const [textInput, setTextInput] = useState('');
    const [showTextInput, setShowTextInput] = useState(false);

    // 👂 Wake Word Mode
    const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
        // ❌ DEFAULT TO FALSE - User must explicitly enable
        // Previously was reading localStorage which could be 'true'
        const saved = localStorage.getItem('adora_wake_word_enabled');
        return saved === 'true' ? false : false; // Force false for now
    });
    const [wakeWordActive, setWakeWordActive] = useState(false);

    // ... rest of code ...

    // ❌ REMOVED: Auto-start wake word on mount
    // This was the root cause - component mounts multiple times and starts mic each time
    // Wake word should ONLY start when user clicks the ear button
    /*
    useEffect(() => {
        if (wakeWordEnabled && wakeWordSupported && onResult && !isListening && !isProcessing) {
            const started = startWakeWordListening({
                onWakeWordDetected: (followUpCommand) => {
                    console.log('✨ Wake word detected! Follow-up:', followUpCommand);
                    setWakeWordActive(false);

                    if (followUpCommand) {
                        onResult?.(followUpCommand);
                    } else {
                        setIsOpen(true);
                        handleStart();
                    }
                },
                onError: (error) => {
                    console.warn('👂 Wake word error:', error);
                    if (error === 'not-allowed') {
                        setWakeWordActive(false);
                    }
                },
                language: currentLang
            });
            setWakeWordActive(started);
        }

        return () => {
            if (wakeWordEnabled) {
                pauseWakeWordListening();
            }
        };
    }, [wakeWordEnabled, wakeWordSupported, onResult, currentLang, isListening, isProcessing, handleStart]);
    */


    // 🌐 Multi-language Mode
    const [autoDetectLang, setAutoDetectLang] = useState(() => {
        return localStorage.getItem('adora_auto_detect_lang') === 'true';
    });
    const [detectedLang, setDetectedLang] = useState<LanguageKey>('arabic');

    // 🛠️ Toolbar State
    const [showToolbar, setShowToolbar] = useState(false);

    // Language options for quick-switch
    const languageOptions = getLanguageOptions();

    const supported = isVoiceInputSupported();
    const wakeWordSupported = isWakeWordSupported();

    // 🌐 Cycle through languages
    const cycleLanguage = useCallback(() => {
        const langCodes = ['ar-EG', 'en-US', 'hi-IN', 'bn-IN'];
        const currentIndex = langCodes.indexOf(currentLang);
        const nextIndex = (currentIndex + 1) % langCodes.length;
        const nextLang = langCodes[nextIndex];
        setCurrentLang(nextLang);
        setLanguage(nextLang);

        // Show which language is now active
        const langNames: Record<string, string> = {
            'ar-EG': '🇪🇬 العربية',
            'en-US': '🇺🇸 English',
            'hi-IN': '🇮🇳 हिन्दी',
            'bn-IN': '🇧🇩 বাংলা'
        };
        console.log(`🌐 Language switched to: ${langNames[nextLang]}`);
    }, [currentLang]);

    // 🌐 Toggle auto-detect
    const toggleAutoDetect = useCallback(() => {
        const newState = !autoDetectLang;
        setAutoDetectLang(newState);
        localStorage.setItem('adora_auto_detect_lang', String(newState));
        console.log(`🌐 Auto-detect: ${newState ? 'ON' : 'OFF'}`);
    }, [autoDetectLang]);

    // Auto-sync language with App Language on mount
    useEffect(() => {
        if (appLang === 'ar') setCurrentLang('ar-SA');
        else if (appLang === 'en') setCurrentLang('en-US');
    }, [appLang]);

    // 🕰️ Auto-hide hint state
    const [showWakeWordHint, setShowWakeWordHint] = useState(false);

    // Show hint when wake word is enabled, hide after 5s
    useEffect(() => {
        if (wakeWordEnabled && wakeWordActive) {
            setShowWakeWordHint(true);
            const timer = setTimeout(() => setShowWakeWordHint(false), 5000);
            return () => clearTimeout(timer);
        } else {
            setShowWakeWordHint(false);
        }
    }, [wakeWordEnabled, wakeWordActive]);

    const transcriptRef = React.useRef(transcript);
    useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

    const handleStopAndSend = useCallback(() => {
        stopListening();
        setIsListening(false);

        const finalText = transcriptRef.current; // Use Ref
        if (!finalText.trim()) return;

        setIsProcessing(true);

        // Small delay to simulate "AI Processing" feeling
        setTimeout(() => {
            onResult?.(finalText.trim());

            if (targetInputId) {
                const input = document.getElementById(targetInputId) as HTMLInputElement;
                if (input) {
                    input.value = finalText.trim();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            setIsProcessing(false);
            setIsOpen(false);
            setTranscript(''); // Clear for next time
        }, 300); // Faster reaction (300ms)
    }, [onResult, targetInputId]);

    const handleStart = useCallback(() => {
        if (!supported) {
            console.warn('⚠️ Voice input not supported');
            playSound?.('error');
            return;
        }
        
        setTranscript('');
        transcriptRef.current = ''; // Reset ref
        setIsListening(true);
        setIsProcessing(false);
        
        // 🛡️ Initialize with improved error handling
        const initSuccess = initVoiceInput({
            language: currentLang,
            onStart: () => {
                console.log("🎤 Mic started successfully");
                playSound?.('click');
                haptic?.('light');
            },
            onEnd: () => {
                console.log("🎤 Mic stopped (Auto-Logic)");
                setIsListening(false);
                // 🧠 Auto-Send using REF to get latest text
                if (transcriptRef.current.trim().length > 1) {
                    handleStopAndSend();
                }
            },
            onError: (error) => {
                console.error("🔴 Voice Error:", error);
                setIsListening(false);
                playSound?.('error');
                haptic?.('heavy');
                
                // Show user-friendly error message
                if (error.includes('ميكروفون') || error.includes('microphone')) {
                    setTranscript('⚠️ تأكد من إعطاء صلاحية الميكروفون');
                } else if (error.includes('شبكة') || error.includes('network')) {
                    setTranscript('⚠️ خطأ في الاتصال، حاول مرة أخرى');
                } else {
                    setTranscript('⚠️ حدث خطأ، حاول مرة أخرى');
                }
                
                // Auto-clear error after 3 seconds
                setTimeout(() => {
                    setTranscript('');
                }, 3000);
            }
        });

        if (!initSuccess) {
            console.error("❌ Failed to initialize voice input");
            setIsListening(false);
            setTranscript('⚠️ فشل تشغيل الميكروفون');
            setTimeout(() => setTranscript(''), 3000);
            return;
        }

        const startSuccess = startListening((text, isFinal) => {
            setTranscript(text);
            transcriptRef.current = text;
            
            // 🎯 Visual feedback on speech detection
            if (text && text.length > 0) {
                haptic?.('light');
            }
        });
        
        if (!startSuccess) {
            console.error("❌ Failed to start listening");
            setIsListening(false);
            setTranscript('⚠️ فشل بدء الاستماع، حاول مرة أخرى');
            setTimeout(() => setTranscript(''), 3000);
        }
    }, [currentLang, supported, handleStopAndSend, playSound, haptic]);

    // 👂 Wake Word Toggle Handler
    const toggleWakeWord = useCallback(() => {
        if (!wakeWordSupported) return;

        const newState = !wakeWordEnabled;
        setWakeWordEnabled(newState);
        localStorage.setItem('adora_wake_word_enabled', String(newState));

        if (newState) {
            // Start listening for wake word
            const started = startWakeWordListening({
                onWakeWordDetected: (followUpCommand) => {
                    console.log('✨ Wake word detected! Follow-up:', followUpCommand);
                    setWakeWordActive(false);

                    // 🔊 AUDIO REACTION
                    playSound('success'); // Feedback
                    haptic('medium');

                    if (followUpCommand) {
                        // User said "Adora [Command]" -> Execute immediately
                        onResult?.(followUpCommand);
                    } else {
                        // User said "Adora" -> Wait for command
                        setIsOpen(true);
                        handleStart();
                    }
                },
                onError: (error) => {
                    console.warn('👂 Wake word error:', error);
                    if (error === 'not-allowed') {
                        setWakeWordActive(false);
                    }
                },
                language: currentLang
            });
            setWakeWordActive(started);
        } else {
            stopWakeWordListening();
            setWakeWordActive(false);
        }
    }, [wakeWordEnabled, wakeWordSupported, currentLang, onResult, handleStart]);

    // Auto-start wake word on mount if enabled
    useEffect(() => {
        // 🛑 ONLY start if wake word is enabled AND we have a result handler
        if (wakeWordEnabled && wakeWordSupported && onResult && !isListening && !isProcessing) {
            const started = startWakeWordListening({
                onWakeWordDetected: (followUpCommand) => {
                    console.log('✨ Wake word detected! Follow-up:', followUpCommand);
                    setWakeWordActive(false);

                    if (followUpCommand) {
                        onResult?.(followUpCommand);
                    } else {
                        setIsOpen(true);
                        handleStart();
                    }
                },
                onError: (error) => {
                    console.warn('👂 Wake word error:', error);
                    // If denied, don't keep trying
                    if (error === 'not-allowed') {
                        setWakeWordActive(false);
                    }
                },
                language: currentLang
            });
            setWakeWordActive(started);
        }

        return () => {
            if (wakeWordEnabled) {
                pauseWakeWordListening();
            }
        };
    }, [wakeWordEnabled, wakeWordSupported, onResult, currentLang, isListening, isProcessing, handleStart]);

    const handleLanguageChange = (lang: string) => {
        setCurrentLang(lang);
        setLanguage(lang);
        if (isListening) {
            stopListening();
            setTimeout(() => {
                initVoiceInput({ language: lang });
                startListening((text) => setTranscript(text));
            }, 200);
        }
    };

    // ✅ Hide if feature is disabled or voice is disabled (unless fallback mode)
    // Wait for feature check to complete before hiding
    if (!supported) return null;
    if (!featureLoading && !isAiAssistantEnabled) return null; // Feature disabled globally
    if (!voiceEnabled && !isFallbackMode) return null; // Voice disabled by user

    return (
        <>
            {/* Minimalist Smart Voice FAB */}
            <button
                style={{
                    ...styles.floatingButton,
                    ...(isListening ? styles.floatingButtonActive : {}),
                    ...(isProcessing ? styles.floatingButtonProcessing : {}),
                }}
                onClick={() => {
                    if (isProcessing) return; // Prevent clicks while processing

                    if (!isListening) {
                        setIsOpen(true); // Keep internal state for consistency
                        handleStart();
                    } else {
                        handleStopAndSend(); // Click again to finish & send
                    }
                }}
                className={`group ${isListening ? 'animate-pulse' : ''}`}
                title="تحدث مع أدورا"
            >
                {/* Icon State Logic */}
                {isProcessing ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : isListening ? (
                    <div className="relative flex items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                        <Square size={24} fill="currentColor" className="relative z-10 text-white" />
                    </div>
                ) : (
                    <Mic size={28} className="group-hover:scale-110 transition-transform" />
                )}
            </button>

            {/* Hidden Transcript Toast/Indicator (Optional: Could be a small floating text close to button) */}
            {isListening && transcript && (
                <div style={{
                    position: 'fixed',
                    bottom: '150px',
                    left: '20px',
                    maxWidth: '300px',
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '0.9rem',
                    zIndex: 1000,
                    border: '1px solid rgba(255,255,255,0.1)',
                    direction: 'rtl',
                    pointerEvents: 'none',
                    animation: 'fadeIn 0.2s ease'
                }}>
                    {transcript}
                </div>
            )}

            {/* 🛡️ Fallback Text Input Panel */}
            {(showTextInput || isFallbackMode) && (
                <div style={{
                    position: 'fixed',
                    bottom: '160px',
                    left: '20px',
                    width: '340px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    backdropFilter: 'blur(16px)',
                    borderRadius: '20px',
                    padding: '16px',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 1001,
                    animation: 'fadeIn 0.3s ease'
                }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}>
                            💬 وضع الكتابة
                        </span>
                        <button
                            onClick={() => {
                                setShowTextInput(false);
                                onResetErrors?.();
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Error Message */}
                    {lastError && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            marginBottom: '12px',
                            color: '#f87171',
                            fontSize: '0.85rem',
                            direction: 'rtl'
                        }}>
                            ⚠️ {lastError}
                        </div>
                    )}

                    {/* Text Input */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter' && textInput.trim()) {
                                    onResult?.(textInput.trim());
                                    setTextInput('');
                                }
                            }}
                            placeholder="اكتب أمرك هنا..."
                            style={{
                                flex: 1,
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: 'white',
                                fontSize: '0.95rem',
                                direction: 'rtl',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                        <button
                            onClick={() => {
                                if (textInput.trim()) {
                                    onResult?.(textInput.trim());
                                    setTextInput('');
                                }
                            }}
                            style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </div>

                    {/* Retry Button */}
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            style={{
                                width: '100%',
                                marginTop: '12px',
                                padding: '10px',
                                borderRadius: '12px',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: '#818cf8',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            🔄 إعادة المحاولة
                        </button>
                    )}

                    {/* Switch back to voice */}
                    <button
                        onClick={() => {
                            setShowTextInput(false);
                            onResetErrors?.();
                        }}
                        style={{
                            width: '100%',
                            marginTop: '8px',
                            padding: '8px',
                            borderRadius: '10px',
                            border: 'none',
                            background: 'transparent',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        🎤 العودة للصوت
                    </button>
                </div>
            )}

            {/* 🛠️ Smart Toolbar Toggle */}
            {!showTextInput && !isFallbackMode && (
                <div style={{
                    position: 'fixed',
                    bottom: '80px',
                    left: '92px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                }}>
                    {/* Expanded Menu Items */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        opacity: showToolbar ? 1 : 0,
                        transform: showToolbar ? 'translateY(0)' : 'translateY(20px)',
                        pointerEvents: showToolbar ? 'auto' : 'none',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        marginBottom: showToolbar ? '0' : '-100px' // Collapse layout
                    }}>
                        {/* ⌨️ Keyboard */}
                        <button
                            onClick={() => { setShowToolbar(false); setShowTextInput(true); }}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgba(30, 41, 59, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title="الكتابة"
                        >
                            ⌨️
                        </button>

                        {/* 👂 Wake Word */}
                        {wakeWordSupported && (
                            <button
                                onClick={toggleWakeWord}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: wakeWordEnabled
                                        ? 'rgba(16, 185, 129, 0.9)'
                                        : 'rgba(30, 41, 59, 0.95)',
                                    border: wakeWordEnabled
                                        ? '2px solid rgba(16, 185, 129, 0.5)'
                                        : '1px solid rgba(255, 255, 255, 0.1)',
                                    color: wakeWordEnabled ? 'white' : '#94a3b8',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                title={wakeWordEnabled ? 'إيقاف "أدورا"' : 'تفعيل "أدورا"'}
                            >
                                {wakeWordEnabled ? <Ear size={18} /> : <EarOff size={18} />}
                            </button>
                        )}

                        {/* 🌐 Language */}
                        <button
                            onClick={cycleLanguage}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgba(30, 41, 59, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                transition: 'all 0.2s'
                            }}
                            title={`اللغة: ${currentLang}`}
                        >
                            {currentLang === 'ar-EG' && '🇪🇬'}
                            {currentLang === 'ar-SA' && '🇸🇦'}
                            {currentLang === 'en-US' && '🇺🇸'}
                            {currentLang === 'hi-IN' && '🇮🇳'}
                            {currentLang === 'bn-IN' && '🇧🇩'}
                        </button>
                    </div>

                    {/* Main Toggle Button */}
                    <button
                        onClick={() => setShowToolbar(!showToolbar)}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: showToolbar ? 'white' : 'rgba(255, 255, 255, 0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: showToolbar ? '#6366f1' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            zIndex: 1001,
                            transition: 'all 0.3s ease',
                            transform: showToolbar ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}
                    >
                        <Settings size={20} />
                    </button>
                </div>
            )}


            {/* Wake word indicator toast */}
            {showWakeWordHint && (
                <div style={{
                    position: 'fixed',
                    bottom: '130px',
                    left: '92px',
                    background: 'rgba(16, 185, 129, 0.95)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    zIndex: 1000,
                    animation: 'fadeIn 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    pointerEvents: 'none', // Allow clicking through
                }}>
                    <span style={{ animation: 'pulse 1.5s infinite' }}>👂</span>
                    أقول "أدورا" أو "يا أدورا"
                </div>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default VoiceInputButton;
