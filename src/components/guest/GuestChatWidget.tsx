/**
 * Guest Chat Widget (شات النزيل الذكي)
 * واجهة الشات الكاملة للنزيل مع البوت والخيارات السريعة
 * 
 * ✅ Features:
 * - Floating chat bubble
 * - Quick options (checklist)
 * - Text messaging
 * - Image upload (ImgBB)
 * - Real-time updates
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    MessageCircle,
    X,
    Send,
    Image as ImageIcon,
    ChevronRight,
    Check,
    Clock,
    Loader2,
    Smile,
    ArrowDown
} from 'lucide-react';
import { db } from '../../services/firebase';
import { Timestamp } from 'firebase/firestore';
import { logger } from '../../services/loggerService';
import { formatTimeGregorianEn } from '../../utils/dateUtils';
import {
    ChatMessage,
    QuickOption,
    getOrCreateChatRoom,
    getChatSettings,
    sendMessage,
    sendWelcomeMessage,
    sendQuickOptionMessage,
    subscribeToMessages
} from '../../services/smartChatService';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface GuestChatWidgetProps {
    tenantId: string;
    branchId: string;
    roomNumber: string;
    guestName?: string;
    guestPhone?: string;
    language?: 'ar' | 'en';
    isDemoMode?: boolean; // 🎮 Demo mode support
}

// ============================================================
// IMAGE UPLOAD HELPER (ImgBB)
// ============================================================

// ✅ Using centralized image upload service
import { uploadToImgBB as uploadImageToImgBB } from '../../services/imageUploadService';

async function uploadToImgBB(base64Image: string): Promise<string | null> {
    try {
        const result = await uploadImageToImgBB(base64Image);
        return result.success ? result.url || null : null;
    } catch (error) {
        logger.error('Error uploading image:', error, 'GuestChatWidget');
        return null;
    }
}

// ============================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================

interface MessageBubbleProps {
    message: ChatMessage;
    isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
    const time = message.createdAt instanceof Timestamp 
        ? formatTimeGregorianEn(message.createdAt.toDate(), { showSeconds: false })
        : '';

    const getBubbleStyle = () => {
        if (isOwn) {
            return 'bg-teal-600 text-white ml-auto rounded-br-sm';
        }
        if (message.sender === 'bot') {
            return 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-white border border-purple-500/30 rounded-bl-sm';
        }
        if (message.sender === 'system') {
            return 'bg-slate-700/50 text-white/70 text-center mx-auto text-sm';
        }
        return 'bg-slate-700 text-white rounded-bl-sm';
    };

    return (
        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${getBubbleStyle()}`}>
                {/* Sender name for non-own messages */}
                {!isOwn && message.sender !== 'system' && message.senderName && (
                    <p className="text-xs text-white/60 mb-1">{message.senderName}</p>
                )}

                {/* Image */}
                {message.type === 'image' && message.imageUrl && (
                    <img 
                        src={message.imageUrl} 
                        alt="صورة مرفقة" 
                        className="rounded-lg max-w-full mb-2"
                        loading="lazy"
                    />
                )}

                {/* Text content */}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>

                {/* Time & Status */}
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-xs opacity-60">{time}</span>
                    {isOwn && (
                        message.status === 'read' ? (
                            <Check className="w-3 h-3 text-blue-400" />
                        ) : message.status === 'delivered' ? (
                            <Check className="w-3 h-3 opacity-60" />
                        ) : (
                            <Clock className="w-3 h-3 opacity-40" />
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// QUICK OPTIONS COMPONENT
// ============================================================

interface QuickOptionsProps {
    options: QuickOption[];
    onSelect: (option: QuickOption) => void;
    disabled?: boolean;
}

const QuickOptions: React.FC<QuickOptionsProps> = ({ options, onSelect, disabled }) => {
    const activeOptions = options.filter(o => o.isActive).sort((a, b) => a.order - b.order);

    return (
        <div className="p-3 border-t border-white/10 bg-slate-800/50">
            <p className="text-white/50 text-xs mb-2 text-center">اختر من القائمة:</p>
            <div className="flex flex-wrap gap-2 justify-center">
                {activeOptions.map(option => (
                    <button
                        key={option.id}
                        onClick={() => onSelect(option)}
                        disabled={disabled}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 
                                   hover:bg-white/20 text-white text-sm transition-all
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   border border-white/10 hover:border-white/30"
                    >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GuestChatWidget: React.FC<GuestChatWidgetProps> = ({
    tenantId,
    branchId,
    roomNumber,
    guestName,
    guestPhone,
    language = 'ar',
    isDemoMode = false // 🎮 Demo mode support
}) => {
    // State
    const [isOpen, setIsOpen] = useState(false);
    const [chatRoomId, setChatRoomId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [quickOptions, setQuickOptions] = useState<QuickOption[]>([]);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [initialized, setInitialized] = useState(false);
    
    // 🎨 Toast notification (replaces native alert)
    const [toast, setToast] = useState<{
        show: boolean;
        type: 'info' | 'warning' | 'error';
        message: string;
    } | null>(null);
    
    const showToast = (type: 'info' | 'warning' | 'error', message: string) => {
        setToast({ show: true, type, message });
        setTimeout(() => setToast(null), 4000);
    };
    
    // ✅ Rate Limiting
    const [requestTimestamps, setRequestTimestamps] = useState<number[]>([]);
    const RATE_LIMIT_MAX = 5;
    const RATE_LIMIT_WINDOW = 60000; // 1 minute

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // ✅ Rate Limit Check
    const checkRateLimit = (): boolean => {
        const now = Date.now();
        const recent = requestTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
        setRequestTimestamps(recent);
        
        if (recent.length >= RATE_LIMIT_MAX) {
            const wait = Math.ceil((RATE_LIMIT_WINDOW - (now - recent[0])) / 1000);
            showToast('warning', `⏳ يرجى الانتظار ${wait} ثانية قبل إرسال رسالة جديدة`);
            return false;
        }
        return true;
    };
    
    const recordRequest = () => setRequestTimestamps(prev => [...prev, Date.now()]);

    // ============================================================
    // INITIALIZATION
    // ============================================================

    useEffect(() => {
        if (isOpen && !initialized) {
            initializeChat();
        }
    }, [isOpen, initialized]);

    const initializeChat = async () => {
        try {
            // Get chat settings
            const settings = await getChatSettings(tenantId);
            setQuickOptions(settings.quickOptions || []);

            // Get or create chat room
            const room = await getOrCreateChatRoom(
                tenantId,
                branchId,
                roomNumber,
                guestName,
                guestPhone
            );
            setChatRoomId(room.id);

            // Send welcome message if new room
            if (!room.lastMessage) {
                await sendWelcomeMessage(tenantId, branchId, room.id, guestName);
            }

            setInitialized(true);
        } catch (error) {
            logger.error('Error initializing chat:', error, 'GuestChatWidget');
        }
    };

    // ============================================================
    // MESSAGE SUBSCRIPTION
    // ============================================================

    useEffect(() => {
        if (!chatRoomId) return;

        const unsubscribe = subscribeToMessages(
            tenantId,
            branchId,
            chatRoomId,
            (newMessages) => {
                setMessages(newMessages);
                
                // Count unread (non-guest messages when chat is closed)
                if (!isOpen) {
                    const unread = newMessages.filter(
                        m => m.sender !== 'guest' && m.status !== 'read'
                    ).length;
                    setUnreadCount(unread);
                }
            }
        );

        return () => unsubscribe();
    }, [chatRoomId, tenantId, branchId, isOpen]);

    // ============================================================
    // AUTO SCROLL
    // ============================================================

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setUnreadCount(0);
        }
    }, [messages, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleScroll = () => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };

    // ============================================================
    // SEND MESSAGE
    // ============================================================

    const handleSendMessage = async () => {
        if (!inputText.trim() || !chatRoomId || sending) return;
        
        // ✅ Rate Limit Check
        if (!checkRateLimit()) return;

        const text = inputText.trim();
        setInputText('');
        setSending(true);
        haptic('light');

        try {
            await sendMessage(tenantId, branchId, chatRoomId, {
                roomNumber,
                sender: 'guest',
                senderName: guestName,
                content: text,
                type: 'text'
            });
            recordRequest(); // ✅ تسجيل الرسالة
        } catch (error) {
            logger.error('Error sending message:', error, 'GuestChatWidget');
            setInputText(text); // Restore on error
        } finally {
            setSending(false);
        }
    };

    // ============================================================
    // QUICK OPTION
    // ============================================================

    const handleQuickOption = async (option: QuickOption) => {
        if (!chatRoomId || sending) return;
        
        // ✅ Rate Limit Check
        if (!checkRateLimit()) return;

        setSending(true);
        haptic('medium');
        playSound('pop');

        try {
            await sendQuickOptionMessage(
                tenantId,
                branchId,
                chatRoomId,
                roomNumber,
                option,
                guestPhone,
                isDemoMode // 🎮 Pass demo mode to bypass room verification
            );
            recordRequest(); // ✅ تسجيل الطلب
        } catch (error: any) {
            logger.error('Error sending quick option:', error, 'GuestChatWidget');
            
            // ✅ Handle ROOM_NOT_AVAILABLE error gracefully
            if (error?.message === 'ROOM_NOT_AVAILABLE') {
                showToast('warning', 'عذراً، خدمة الشات غير متاحة حالياً. يرجى التواصل مع الاستقبال مباشرة.');
            } else {
                showToast('error', 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            setSending(false);
        }
    };

    // ============================================================
    // IMAGE UPLOAD
    // ============================================================

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !chatRoomId) return;

        setUploading(true);
        haptic('light');

        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target?.result as string;
                
                // Upload to ImgBB
                const imageUrl = await uploadToImgBB(base64);
                
                if (imageUrl) {
                    await sendMessage(tenantId, branchId, chatRoomId, {
                        roomNumber,
                        sender: 'guest',
                        senderName: guestName,
                        content: '📷 صورة مرفقة',
                        type: 'image',
                        imageUrl
                    });
                }
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            logger.error('Error uploading image:', error, 'GuestChatWidget');
            setUploading(false);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // ============================================================
    // TOGGLE CHAT
    // ============================================================

    const toggleChat = () => {
        setIsOpen(!isOpen);
        haptic('light');
        if (!isOpen) {
            playSound('pop');
        }
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <>
            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-96 z-50
                               bg-slate-900 border border-white/10 rounded-2xl shadow-2xl
                               flex flex-col max-h-[70vh] animate-in slide-in-from-bottom-4 duration-300">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10
                                    bg-gradient-to-r from-teal-900/50 to-cyan-900/50 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold">شات الدعم</h3>
                                <p className="text-white/60 text-xs">غرفة {roomNumber}</p>
                            </div>
                        </div>
                        <button
                            onClick={toggleChat}
                            className="p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 space-y-1"
                        style={{ minHeight: '200px', maxHeight: '400px' }}
                    >
                        {messages.map((msg, index) => (
                            <MessageBubble
                                key={msg.id || index}
                                message={msg}
                                isOwn={msg.sender === 'guest'}
                            />
                        ))}
                        <div ref={messagesEndRef} />

                        {/* Scroll to bottom button */}
                        {showScrollButton && (
                            <button
                                onClick={scrollToBottom}
                                className="absolute bottom-32 right-4 p-2 rounded-full bg-teal-600 text-white
                                           shadow-lg hover:bg-teal-700 transition-colors"
                            >
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Quick Options */}
                    {quickOptions.length > 0 && messages.length <= 2 && (
                        <QuickOptions
                            options={quickOptions}
                            onSelect={handleQuickOption}
                            disabled={sending}
                        />
                    )}

                    {/* Input Area */}
                    <div className="p-3 border-t border-white/10 bg-slate-800/30">
                        <div className="flex items-center gap-2">
                            {/* Image Upload */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 
                                           text-white/60 hover:text-white transition-colors
                                           disabled:opacity-50"
                            >
                                {uploading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <ImageIcon className="w-5 h-5" />
                                )}
                            </button>

                            {/* Text Input */}
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="اكتب رسالتك..."
                                className="flex-1 bg-white/10 border border-white/10 rounded-xl
                                           px-4 py-2.5 text-white placeholder:text-white/40
                                           focus:outline-none focus:border-teal-500/50"
                                dir="rtl"
                            />

                            {/* Send Button */}
                            <button
                                onClick={handleSendMessage}
                                disabled={!inputText.trim() || sending}
                                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 
                                           text-white transition-colors disabled:opacity-50
                                           disabled:cursor-not-allowed"
                            >
                                {sending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Chat Button */}
            <button
                onClick={toggleChat}
                className={`fixed bottom-4 right-4 z-50 p-4 rounded-full shadow-2xl
                           transition-all duration-300 ${
                               isOpen 
                                   ? 'bg-slate-700 scale-90' 
                                   : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:scale-110'
                           }`}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-white" />
                ) : (
                    <>
                        <MessageCircle className="w-6 h-6 text-white" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full 
                                           bg-red-500 text-white text-xs font-bold
                                           flex items-center justify-center animate-pulse">
                                {unreadCount}
                            </span>
                        )}
                    </>
                )}
            </button>

            {/* Pulse animation for button */}
            {!isOpen && (
                <div className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full 
                               bg-teal-500/30 animate-ping pointer-events-none" />
            )}

            {/* 🎨 Toast Notification */}
            {toast && (
                <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999]
                               px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm
                               flex items-center gap-3 max-w-sm animate-in fade-in zoom-in duration-200
                               ${toast.type === 'warning' 
                                   ? 'bg-amber-900/90 border-amber-500/40 text-amber-100' 
                                   : toast.type === 'error'
                                   ? 'bg-red-900/90 border-red-500/40 text-red-100'
                                   : 'bg-teal-900/90 border-teal-500/40 text-teal-100'
                               }`}>
                    <span className="text-2xl">
                        {toast.type === 'warning' ? '⚠️' : toast.type === 'error' ? '❌' : 'ℹ️'}
                    </span>
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button 
                        onClick={() => setToast(null)}
                        className="ml-2 p-1 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
        </>
    );
};

export default GuestChatWidget;
