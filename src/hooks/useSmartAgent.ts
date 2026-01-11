/**
 * useSmartAgent Hook
 * Intelligent Voice Agent Integration
 * Adora Hotel Management System V2
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useVoiceInput, setLanguage as setVoiceLanguage } from '../services/voiceInputService';
import { useAuth } from '../context/AuthContext';
import { processAICommand, AICommandResponse } from '../services/ai/geminiService';
import { useUX } from '../context/UXContext';
import { useAI } from '../context/AIContext';
import { db, analytics, logEvent } from '../services/firebase';
import { writeBatch, doc, addDoc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { synthesizeSpeech, playAudioUrl, isGoogleTTSAvailable } from '../services/googleTTSService';
import {
    smartDetectLanguage,
    getTTSVoice,
    SUPPORTED_LANGUAGES,
    LanguageKey
} from '../services/languageDetectionService';

// 📊 Voice Command Analytics Helper
const trackVoiceCommand = (eventName: string, params: Record<string, any>) => {
    if (analytics) {
        try {
            logEvent(analytics, eventName, params);
            console.log('📊 Analytics:', eventName, params);
        } catch (e) {
            console.warn('Analytics tracking failed:', e);
        }
    }
};

type AgentStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'executing';

interface SmartAgentOptions {
    context: string;
    schema: Record<string, any>;
    data?: Record<string, any>; // Dynamic data for matching
    onSuccess: (action: string, params: any) => void;
}

export const useSmartAgent = ({ context, schema, data, onSuccess }: SmartAgentOptions) => {
    const [status, setStatus] = useState<AgentStatus>('idle');
    const [lastTranscript, setLastTranscript] = useState('');
    const [thoughtProcess, setThoughtProcess] = useState<string | null>(null); // 🧠 Visual Brain
    const [feedback, setFeedback] = useState('');
    const [errorCount, setErrorCount] = useState(0); // 🛡️ Error Recovery
    const [isFallbackMode, setIsFallbackMode] = useState(false); // 🛡️ Text Input Fallback
    const [lastError, setLastError] = useState<string | null>(null);
    const transcriptRef = useRef(''); // Track live transcript for manual send

    // 🌊 Streaming State
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState(''); // Progressive text display

    // 🧠 Conversation Memory (Last 5 exchanges)
    interface ConversationEntry {
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }

    const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>(() => {
        // Load from session storage on mount
        try {
            const saved = sessionStorage.getItem(`adora_conversation_${context}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Persist conversation to session storage
    useEffect(() => {
        try {
            sessionStorage.setItem(`adora_conversation_${context}`, JSON.stringify(conversationHistory));
        } catch (e) {
            console.warn('Failed to persist conversation:', e);
        }
    }, [conversationHistory, context]);

    // Add to conversation history (max 10 entries = 5 exchanges)
    const addToHistory = useCallback((role: 'user' | 'assistant', content: string) => {
        setConversationHistory(prev => {
            const newEntry: ConversationEntry = { role, content, timestamp: Date.now() };
            const updated = [...prev, newEntry];
            // Keep last 10 entries (5 user + 5 assistant)
            return updated.slice(-10);
        });
    }, []);

    // Clear conversation history
    const clearConversation = useCallback(() => {
        setConversationHistory([]);
        sessionStorage.removeItem(`adora_conversation_${context}`);
    }, [context]);

    // Existing Voice Service
    const {
        start: startListening,
        stop: stopListening,
        listening,
        transcript,
        clear
    } = useVoiceInput({
        language: 'ar-EG',
        onResult: (text, isFinal) => {
            transcriptRef.current = text; // Update ref constantly
            if (isFinal) {
                handleVoiceResult(text);
            }
        }
    });

    // Sync transcript to ref (backup)
    useEffect(() => {
        if (transcript) transcriptRef.current = transcript;
    }, [transcript]);

    const { playSound, haptic } = useUX();
    const { settings: aiSettings, canSendNow, notifySent } = useAI();
    const { tenantId: userTenantId, user } = useAuth();

    // Text-to-Speech (Egyptian Arabic)
    // State to hold loaded voices
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    // 🔄 Pre-load voices on mount
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                setAvailableVoices(voices);
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, []);

    // Text-to-Speech (Egyptian Female - Cheerful & Smooth)
    const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // 🔔 Visual Toast Fallback for when TTS fails
    const showToast = useCallback((message: string) => {
        // Create a floating toast notification
        const toast = document.createElement('div');
        toast.className = 'adora-voice-toast';
        toast.innerHTML = `
            <div style="
                position: fixed;
                bottom: 160px;
                left: 20px;
                right: 20px;
                max-width: 400px;
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.95));
                backdrop-filter: blur(16px);
                padding: 16px 20px;
                border-radius: 16px;
                color: white;
                font-size: 1rem;
                line-height: 1.5;
                z-index: 9999;
                direction: rtl;
                text-align: right;
                box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
                animation: slideUp 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.5rem;">🤖</span>
                    <span>${message}</span>
                </div>
            </div>
            <style>
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        `;
        document.body.appendChild(toast);

        // Auto-remove after 6 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }, []);

    const speak = useCallback(async (text: string) => {
        console.log('🔊 SPEAK CALLED with text:', text);
        if (!text) {
            console.log('🔊 SPEAK: Empty text, returning');
            return;
        }
        setStatus('speaking');

        // 🔔 Always show visual toast as backup (in case TTS fails silently)
        showToast(text);

        // � Detect Language of the response
        const detectedLang = smartDetectLanguage(text);
        const langConfig = SUPPORTED_LANGUAGES[detectedLang];
        console.log(`🌐 Speaking in ${langConfig.nameEn} (${detectedLang})`);

        // �🎙️ TRY GOOGLE CLOUD TTS FIRST (High Quality)
        if (isGoogleTTSAvailable()) {
            try {
                console.log(`🎙️ Attempting Google Cloud TTS (${langConfig.code})...`);
                const audioUrl = await synthesizeSpeech(text, langConfig.code);

                if (audioUrl) {
                    console.log('✅ Google TTS success, playing audio');
                    await playAudioUrl(audioUrl);
                    setStatus('idle');

                    // Track TTS success
                    trackVoiceCommand('tts_played', {
                        source: 'google_cloud',
                        text_length: text.length,
                        language: detectedLang
                    });
                    return; // Success! Don't fall through to browser TTS
                }
            } catch (error) {
                console.warn('🔇 Google TTS failed, falling back to browser TTS:', error);
            }
        }

        // 📢 FALLBACK: Browser TTS
        console.log('📢 Using browser TTS fallback');

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // 🧠 Logic: Split into small semantic chunks (commas, periods, conjunctions) to prevent cut-off
        let chunks: string[] = text.match(/[^.!?،]+[.!?،]*/g) || [text];

        // Safety: If chunks are too long (browser limit ~15s), split by space
        chunks = chunks.flatMap(c => c.length > 100 ? (c.match(/.{1,100}/g) || [c]) : [c]);

        let chunkIndex = 0;
        let ttsWorked = false;

        const speakNextChunk = () => {
            if (chunkIndex >= chunks.length) {
                setStatus('idle');
                if (!ttsWorked) {
                    console.log('⚠️ TTS did not produce audio, Toast is shown as fallback');
                }
                // Track browser TTS usage
                trackVoiceCommand('tts_played', { source: 'browser', text_length: text.length });
                return;
            }

            const chunkText = chunks[chunkIndex].trim();
            if (!chunkText) {
                chunkIndex++;
                speakNextChunk();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunkText);
            activeUtteranceRef.current = utterance; // 🛡️ Anti-GC

            // 🎯 Set Language dynamically
            utterance.lang = langConfig.code;

            // 🎯 Voice Selection Strategy (Dynamic based on language)
            let voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();

            const preferredVoice =
                voices.find(v => v.lang === langConfig.code && v.name.includes('Google')) ||
                voices.find(v => v.lang === langConfig.code);

            if (preferredVoice) {
                utterance.voice = preferredVoice;
                console.log(`🗣️ Using browser voice: ${preferredVoice.name} (${preferredVoice.lang})`);
            } else {
                console.warn(`⚠️ No specific voice found for ${langConfig.code}, using default`);
            }

            // 🎚️ Persona Tuning (Dynamic Emotion)
            let rate = 1.0;
            let pitch = 1.0;

            if (text.match(/عاجل|طوارئ|بسرعة|urgent|emergency|fast/i)) {
                rate = 1.2;
                pitch = 1.1; // Alert
            } else if (text.match(/تم|نجاح|شكرا|done|success|great/i)) {
                rate = 1.1;
                pitch = 1.1; // Cheerful
            } else if (text.match(/عذرا|آسف|خطأ|sorry|error/i)) {
                rate = 0.9;
                pitch = 0.9; // Apologetic
            }

            utterance.rate = rate;
            utterance.pitch = pitch;

            utterance.onstart = () => {
                ttsWorked = true; // TTS started successfully
            };

            utterance.onend = () => {
                chunkIndex++;
                setTimeout(speakNextChunk, 50);
            };

            utterance.onerror = (e) => {
                console.error('TTS Error:', e);
                chunkIndex++;
                speakNextChunk();
            };

            window.speechSynthesis.speak(utterance);
        };

        // Start the chain
        speakNextChunk();
    }, [availableVoices, showToast]);

    // Expose manual stop control for UI
    // Expose manual stop control for UI
    useEffect(() => {
        (window as any).stopVoiceAndSend = () => {
            console.log("⚡ Manual Stop Triggered");
            if (haptic) haptic('medium');
            playSound('click');

            stopListening();

            // ⚡ FORCE SEND: Use the current ref value even if not 'final'
            if (transcriptRef.current && transcriptRef.current.trim().length > 0) {
                console.log("🚀 Force Sending:", transcriptRef.current);
                handleVoiceResult(transcriptRef.current);
            }
        };

        // 🛠️ DEBUG TOOL: Simulate Voice Input
        (window as any).debugSimulateVoice = (text: string) => {
            console.log("🧪 Simulating Voice:", text);
            handleVoiceResult(text);
        };

        return () => {
            (window as any).stopVoiceAndSend = undefined;
            (window as any).debugSimulateVoice = undefined;
        };
    }, [stopListening, haptic, playSound]);

    // Core AI Logic
    const handleVoiceResult = async (text: string) => {
        console.log('🎯 handleVoiceResult CALLED with:', text);
        // 🔒 Global AI switch
        if (!aiSettings.enabled) {
            setFeedback('وضع الذكاء الاصطناعي متوقف حالياً');
            showToast('🤖 تم إيقاف الذكاء الاصطناعي من الإعدادات');
            return;
        }
        // ⏱️ Simple client-side rate limit
        if (!canSendNow()) {
            setFeedback('تم تجاوز الحد المسموح للطلبات. انتظر ثوانٍ قليلة.');
            showToast('⏳ تهدئة مؤقتة لطلبات AI');
            return;
        }

        setLastTranscript(text);
        setStatus('processing');
        stopListening(); // Stop listening while processing

        // 🧠 Add user message to conversation history
        addToHistory('user', text);

        // 📊 Track command start
        const startTime = Date.now();
        trackVoiceCommand('voice_command_start', {
            command_text: text.substring(0, 100), // Limit length
            context: context
        });

        try {
            console.log('🤖 Calling processAICommand...');
            // Process with Gemini, passing dynamic data, Tenant Identity, AND conversation history
            const result = await processAICommand(text, context, schema, data, {
                tenantId: userTenantId || 'unknown',
                branchId: (user as any)?.branch || 'default',
                userRole: (user as any)?.role || 'staff'
            }, conversationHistory);

            // ✅ Runtime validation against schema (minimal)
            const validate = () => {
                const action = result?.action;
                if (!action || typeof action !== 'string') return 'Action missing';
                const required: string[] = Array.isArray((schema as any).required) ? (schema as any).required : [];
                const params = result?.params || {};
                for (const key of required) {
                    if (!(key in params) || params[key] === undefined || params[key] === null || params[key] === '') {
                        return `Missing required param: ${key}`;
                    }
                }
                return null;
            };
            const validationError = validate();
            if (validationError) {
                console.warn('AI validation failed:', validationError);
                setFeedback('أحتاج تفاصيل أكثر لتنفيذ الطلب. ' + validationError.replace('Missing required param:', 'المعلومة الناقصة:'));
                await speak('من فضلك وضّح التفاصيل الناقصة');
                setStatus('idle');
                return;
            }

            // 🧠 Capture Reasoning
            if (result.reasoning) {
                console.log(`🧠 AI THOUGHT: ${result.reasoning}`);
                setThoughtProcess(result.reasoning);
            }

            // 🧠 Add assistant response to history
            if (result.confirmation) {
                addToHistory('assistant', result.confirmation);
            } else if (result.missingInfo) {
                addToHistory('assistant', result.missingInfo);
            }

            // 📊 Track success
            const responseTime = Date.now() - startTime;
            trackVoiceCommand('voice_command_success', {
                action: result.action,
                response_time_ms: responseTime,
                has_confirmation: !!result.confirmation,
                context: context
            });

            if (result.missingInfo) {
                // Case 1: Information Missing/Clarification -> Ask User
                setFeedback(result.missingInfo);
                await speak(result.missingInfo);

                // 🗣️ CONVERSATION LOOP: Auto-listen after question
                setTimeout(() => {
                    if (!isFallbackMode) {
                        setStatus('listening');
                        startListening();
                        // playSound('ping'); // Subtle cue? Maybe redundant if user knows to speak.
                    }
                }, 500); // Small buffer after speech ends 
            } else if (result.confirmation) {
                // Count successful send
                notifySent();
                // Case 2: Success -> Confirm & Execute
                setFeedback(result.confirmation);
                speak(result.confirmation);
                setStatus('executing');

                // 🛑 SECURITY GATEKEEPER
                if (result.action === 'DENY_ACCESS') {
                    console.warn(`🛡️ Security Block: ${result.confirmation}`);
                    playSound('error'); // Error sound
                    haptic('heavy');   // Heavy vibration for rejection
                    await speak(result.confirmation || 'عذراً، غير مصرح لك');
                    setStatus('idle');
                    return; // ⛔ STOP EXECUTION
                }

                // 🚨 IRON DOME (ANTI-INJECTION RESPONSE)
                if (result.action === 'SECURITY_ALERT') {
                    console.error(`🚨 SECURITY INCIDENT: ${result.reasoning}`);
                    playSound('error');
                    haptic('heavy');

                    // 📝 Log Incident to Firestore (Silent Audit)
                    try {
                        addDoc(collection(db, `tenants/${userTenantId}/security_logs`), {
                            type: 'PROMPT_INJECTION_ATTEMPT',
                            user: { id: (user as any)?.id, name: (user as any)?.name, role: (user as any)?.role },
                            query: lastTranscript, // Variable from closure
                            ai_reasoning: result.reasoning,
                            timestamp: serverTimestamp()
                        });
                    } catch (e) { console.error('Failed to log incident', e); }

                    await speak(result.confirmation || 'تم تسجيل محاولة اختراق أمني.');
                    setStatus('idle');
                    return;
                }

                // ⚡ ATOMIC EXECUTION (Adora Logic)
                if (result.action === 'UPDATE_STATUS') {
                    try {
                        const batch = writeBatch(db);
                        const { requestId, roomId, needsInspection } = result.params;

                        if (requestId) {
                            const requestRef = doc(db, 'requests', requestId);
                            batch.update(requestRef, { status: 'COMPLETED' });
                        }

                        if (roomId && !needsInspection) {
                            const roomRef = doc(db, 'rooms', roomId);
                            batch.update(roomRef, { status: 'ready' });
                        }

                        await batch.commit();
                        console.log('✅ Atomic Status Update Committed');
                    } catch (err) {
                        console.error('❌ Atomic Update Failed:', err);
                        speak('حدث خطأ في تحديث البيانات');
                        setStatus('idle');
                    }
                } else if (result.action === 'RECORD_LAUNDRY_INVENTORY') {
                    // ⚡ ATOMIC LAUNDRY BATCH UPDATE
                    try {
                        const batch = writeBatch(db);
                        const { items } = result.params;
                        // params: { items: [{ itemId, count, itemName }] }

                        if (!items || !Array.isArray(items)) throw new Error('Invalid items array');

                        items.forEach((item: any) => {
                            // Use 'laundry_inventory' collection logic. 
                            const itemRef = doc(db, `tenants/${userTenantId}/branches/${(user as any)?.branch || 'default'}/laundry_inventory`, item.itemId);

                            // Update totalStock based on "Jard" (Exact Count)
                            batch.update(itemRef, {
                                totalStock: Number(item.count),
                                lastJardAt: serverTimestamp(),
                                updatedBy: (user as any)?.name || 'Adora AI'
                            });
                        });

                        await batch.commit();
                        console.log('✅ Laundry Inventory Updated by AI');

                        onSuccess(result.action, result.params);
                        playSound('success');
                        haptic('medium');
                        return;

                    } catch (err) {
                        console.error('Laundry Update Failed:', err);
                        // Fallback: If update fails (e.g. doc doesn't exist), report error.
                        speak('حدث خطأ في تحديث المخزون، تأكد من وجود الأصناف');
                        setStatus('idle');
                        return;
                    }

                } else if (result.action === 'CREATE_PROCUREMENT_REQUEST') {
                    // ⚡ ATOMIC PROCUREMENT REQUEST
                    try {
                        const { items } = result.params;
                        // params: { items: [{ itemName, quantity }] }

                        if (!items || !Array.isArray(items)) throw new Error('Invalid items array');

                        // Create one request containing all items
                        await addDoc(collection(db, 'procurementRequests'), {
                            items: items.map((i: any) => ({
                                itemName: i.itemName,
                                quantity: Number(i.quantity),
                                priority: 'normal', // Default
                                status: 'pending'   // Item-level status if needed
                            })),
                            branch: (user as any)?.branch || 'default',
                            tenantId: userTenantId,
                            requestedBy: { id: (user as any)?.id || 'ai', name: (user as any)?.name || 'Adora AI' },
                            department: 'General', // Could be inferred from context if passed
                            status: 'PENDING_APPROVAL',
                            createdAt: serverTimestamp(), // Use imported serverTimestamp
                            priority: 'NORMAL'
                        });

                        console.log('✅ Procurement Created by AI');
                        onSuccess(result.action, result.params);
                        playSound('success');
                        haptic('medium');
                        return;
                    } catch (err) {
                        console.error('Procurement Creation Failed:', err);
                        speak('حدث خطأ في إنشاء الطلب');
                        setStatus('idle');
                        return;
                    }
                } else if (result.action === 'CREATE_SERVICE_REQUEST') {
                    // ⚡ ATOMIC SERVICE REQUEST (Cleaning, Maintenance, etc.)
                    try {
                        const { roomNumber, type, priority, notes } = result.params;
                        if (!roomNumber || !type) throw new Error('Missing room number or type');

                        // Map type to department
                        const getDepartment = (t: string): string => {
                            switch (t) {
                                case 'cleaning': case 'laundry': case 'minibar': case 'inspection': case 'coffee':
                                    return 'housekeeping';
                                case 'maintenance': return 'maintenance';
                                case 'bellman': return 'bellman';
                                case 'extension': return 'reception';
                                default: return 'reception';
                            }
                        };

                        await addDoc(collection(db, 'requests'), {
                            type,
                            serviceType: type,
                            roomNumber: String(roomNumber),
                            priority: priority || 'normal',
                            notes: notes || '',
                            status: 'CONFIRMED',
                            branch: (user as any)?.branchId || (user as any)?.branch || 'default',
                            tenantId: userTenantId,
                            guestName: 'طلب بالذكاء الاصطناعي',
                            originDepartment: (user as any)?.role || 'reception',
                            currentDepartment: getDepartment(type),
                            createdAt: serverTimestamp(),
                            confirmedAt: serverTimestamp(),
                            createdBy: {
                                id: (user as any)?.id || 'ai-agent',
                                name: (user as any)?.name || 'Adora AI'
                            },
                            confirmedBy: {
                                id: (user as any)?.id || 'ai-agent',
                                name: (user as any)?.name || 'Adora AI'
                            },
                            timeline: {
                                created: serverTimestamp(),
                                confirmed: serverTimestamp()
                            }
                        });

                        console.log('✅ Service Request Created by AI:', type, roomNumber);
                        onSuccess(result.action, result.params);
                        playSound('success');
                        haptic('medium');
                        return;
                    } catch (err) {
                        console.error('Service Request Creation Failed:', err);
                        speak('حدث خطأ في تنفيذ الطلب');
                        setStatus('idle');
                        return;
                    }
                }

                // Execute Callback
                onSuccess(result.action, result.params);
                playSound('success');
                haptic('medium');
            } else {
                // Case 3: Error / Unclear
                speak('لم أفهم الطلب، يرجى الإعادة');
                playSound('error');
                // Track unclear response as partial error
                setErrorCount(prev => prev + 1);
            }

            // Reset error count on success
            setErrorCount(0);
            setLastError(null);

        } catch (error: any) {
            console.error('Smart Agent Error:', error);
            const errorMessage = error?.message || 'خطأ غير معروف';
            setLastError(errorMessage);

            // 📊 Track error
            trackVoiceCommand('voice_command_error', {
                error_message: errorMessage.substring(0, 100),
                context: context,
                error_count: errorCount + 1
            });

            // Increment error counter
            const newErrorCount = errorCount + 1;
            setErrorCount(newErrorCount);

            // 🛡️ Trigger Fallback Mode after 3 consecutive failures
            if (newErrorCount >= 3) {
                setIsFallbackMode(true);
                speak('حدثت مشاكل متكررة. تم تفعيل وضع الكتابة.');
                showToast('⚠️ تم تفعيل وضع الكتابة بدلاً من الصوت');

                // 📊 Track fallback trigger
                trackVoiceCommand('voice_fallback_activated', {
                    context: context,
                    consecutive_errors: newErrorCount
                });
            } else {
                speak('عذراً، حدث خطأ فني. جرب تاني.');
            }

            setStatus('idle');
        }
    };

    // Manual Trigger
    const activateAgent = () => {
        // ✅ FIX: Prevent race condition - wait for speaking to finish
        if (status === 'speaking') {
            window.speechSynthesis.cancel();
            // Give a small delay for speech to fully stop before listening
            setTimeout(() => {
                setStatus('listening');
                clear();
                startListening();
                playSound('notification');
                haptic('light');
            }, 300);
            return;
        }
        setStatus('listening');
        clear();
        startListening();
        playSound('notification');
        haptic('light');
    };

    // 🔄 Retry Last Command
    const retryLastCommand = useCallback(() => {
        if (lastTranscript) {
            console.log('🔄 Retrying last command:', lastTranscript);
            setLastError(null);
            handleVoiceResult(lastTranscript);
        }
    }, [lastTranscript]);

    // 🛡️ Reset Error State
    const resetErrors = useCallback(() => {
        setErrorCount(0);
        setIsFallbackMode(false);
        setLastError(null);
    }, []);

    return {
        status,
        transcript: lastTranscript,
        thoughtProcess, // 🧠 Exposed for UI
        feedback,
        isActive: status !== 'idle',
        startListening,
        activateAgent, // ✅ Exposed
        stopListening,
        cancel: stopListening,
        processCommand: handleVoiceResult,
        // 🛡️ Error Recovery
        errorCount,
        isFallbackMode,
        lastError,
        retryLastCommand,
        resetErrors,
        // 🧠 Conversation Memory
        conversationHistory,
        clearConversation,
        // 🌊 Streaming
        isStreaming,
        streamingText,
        // 🌍 Language Control - ✅ FIXED: Using imported setVoiceLanguage
        setLanguage: (lang: string) => {
            console.log('🌍 Switching Language to:', lang);
            setVoiceLanguage(lang);
        }
    };
};
