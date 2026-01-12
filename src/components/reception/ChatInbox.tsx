/**
 * Reception Chat Inbox (صندوق شات الاستقبال)
 * المحطة المركزية لاستقبال وتوجيه رسائل النزلاء
 * 
 * ✅ Features:
 * - All chat rooms list
 * - Unread count badges
 * - Approve or Forward actions
 * - SLA warnings
 * - Real-time updates
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    MessageCircle,
    Check,
    Forward,
    Clock,
    AlertTriangle,
    Search,
    Filter,
    X,
    Send,
    ChevronRight,
    User,
    Home,
    Wrench,
    Sparkles,
    Coffee,
    BellRing,
    Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/firebase';
import { Timestamp, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import {
    ChatRoom,
    ChatMessage,
    subscribeToChatRooms,
    subscribeToMessages,
    sendMessage,
    approveRequest,
    forwardRequest,
    markMessagesAsRead
} from '../../services/smartChatService';
import { haptic, playSound } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface ChatInboxProps {
    tenantId: string;
    branchId: string;
    className?: string;
}

interface PendingRequest {
    id: string;
    chatRoomId: string;
    roomNumber: string;
    type: string;
    quickOptionId?: string;
    notes?: string;
    createdAt: Timestamp;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEPARTMENTS = [
    { id: 'housekeeping', label: 'النظافة', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'maintenance', label: 'الصيانة', icon: <Wrench className="w-4 h-4" /> },
    { id: 'bellman', label: 'البيلمان', icon: <BellRing className="w-4 h-4" /> },
    { id: 'coffee', label: 'خدمة الغرف', icon: <Coffee className="w-4 h-4" /> }
];

const SLA_WARNING_MINUTES = 3;
const SLA_CRITICAL_MINUTES = 5;

// ============================================================
// CHAT ROOM ITEM
// ============================================================

interface ChatRoomItemProps {
    room: ChatRoom;
    isSelected: boolean;
    onClick: () => void;
    pendingRequest?: PendingRequest;
}

const ChatRoomItem: React.FC<ChatRoomItemProps> = ({
    room,
    isSelected,
    onClick,
    pendingRequest
}) => {
    const getElapsedMinutes = (timestamp: Timestamp | undefined): number => {
        if (!timestamp) return 0;
        return Math.floor((Date.now() - timestamp.toDate().getTime()) / 60000);
    };

    const elapsed = pendingRequest ? getElapsedMinutes(pendingRequest.createdAt) : 0;
    const isWarning = elapsed >= SLA_WARNING_MINUTES && elapsed < SLA_CRITICAL_MINUTES;
    const isCritical = elapsed >= SLA_CRITICAL_MINUTES;

    return (
        <button
            onClick={onClick}
            className={`w-full p-3 flex items-center gap-3 transition-all rounded-xl ${
                isSelected 
                    ? 'bg-teal-500/20 border border-teal-500/30' 
                    : 'hover:bg-white/5 border border-transparent'
            } ${isCritical ? 'animate-pulse bg-red-500/10' : ''}`}
        >
            {/* Room Icon */}
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                ${isCritical ? 'bg-red-500/20 text-red-400' :
                  isWarning ? 'bg-amber-500/20 text-amber-400' :
                  room.unreadCount > 0 ? 'bg-teal-500/20 text-teal-400' :
                  'bg-white/10 text-white/60'}
            `}>
                <Home className="w-5 h-5" />
            </div>

            {/* Info */}
            <div className="flex-1 text-right min-w-0">
                <div className="flex items-center justify-between">
                    <span className="text-white font-bold">غرفة {room.roomNumber}</span>
                    {room.unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-500 text-white text-xs font-bold">
                            {room.unreadCount}
                        </span>
                    )}
                </div>
                
                <p className="text-white/50 text-sm truncate">
                    {room.lastMessage || 'محادثة جديدة'}
                </p>

                {/* SLA Warning */}
                {pendingRequest && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                        isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white/40'
                    }`}>
                        <Clock className="w-3 h-3" />
                        <span>منذ {elapsed} دقيقة</span>
                        {isCritical && <AlertTriangle className="w-3 h-3 ml-1" />}
                    </div>
                )}
            </div>

            <ChevronRight className="w-4 h-4 text-white/30" />
        </button>
    );
};

// ============================================================
// MESSAGE VIEW
// ============================================================

interface MessageViewProps {
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    onApprove: (requestId: string) => void;
    onForward: (requestId: string, department: string) => void;
    pendingRequest?: PendingRequest;
    sending: boolean;
}

const MessageView: React.FC<MessageViewProps> = ({
    messages,
    onSendMessage,
    onApprove,
    onForward,
    pendingRequest,
    sending
}) => {
    const [inputText, setInputText] = useState('');
    const [showForwardMenu, setShowForwardMenu] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputText.trim()) return;
        onSendMessage(inputText.trim());
        setInputText('');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, index) => {
                    const isGuest = msg.sender === 'guest';
                    const time = msg.createdAt instanceof Timestamp
                        ? msg.createdAt.toDate().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                        : '';

                    return (
                        <div key={msg.id || index} className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                                isGuest 
                                    ? 'bg-white/10 text-white rounded-bl-sm' 
                                    : msg.sender === 'bot'
                                    ? 'bg-purple-500/20 text-white border border-purple-500/30'
                                    : 'bg-teal-600 text-white rounded-br-sm'
                            }`}>
                                {msg.type === 'quick_option' && (
                                    <span className="text-xs text-white/60 block mb-1">طلب سريع</span>
                                )}
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                                <span className="text-xs opacity-50 block text-left mt-1">{time}</span>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Action Buttons (for pending requests) */}
            {pendingRequest && (
                <div className="p-3 border-t border-white/10 bg-slate-800/50">
                    <p className="text-white/60 text-xs mb-2 text-center">
                        طلب: {pendingRequest.notes || pendingRequest.type}
                    </p>
                    <div className="flex gap-2">
                        {/* Approve Button */}
                        <button
                            onClick={() => onApprove(pendingRequest.id)}
                            disabled={sending}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl
                                       bg-green-600 hover:bg-green-700 text-white font-bold
                                       transition-colors disabled:opacity-50"
                        >
                            <Check className="w-5 h-5" />
                            <span>موافقة ✅</span>
                        </button>

                        {/* Forward Button */}
                        <div className="relative flex-1">
                            <button
                                onClick={() => setShowForwardMenu(!showForwardMenu)}
                                disabled={sending}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                                           bg-blue-600 hover:bg-blue-700 text-white font-bold
                                           transition-colors disabled:opacity-50"
                            >
                                <Forward className="w-5 h-5" />
                                <span>توجيه ➡️</span>
                            </button>

                            {/* Forward Menu */}
                            {showForwardMenu && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 
                                               bg-slate-800 border border-white/10 rounded-xl 
                                               shadow-xl overflow-hidden z-10">
                                    {DEPARTMENTS.map(dept => (
                                        <button
                                            key={dept.id}
                                            onClick={() => {
                                                onForward(pendingRequest.id, dept.id);
                                                setShowForwardMenu(false);
                                            }}
                                            className="w-full flex items-center gap-3 px-4 py-3 
                                                       text-white hover:bg-white/10 transition-colors"
                                        >
                                            {dept.icon}
                                            <span>{dept.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="اكتب رسالة للنزيل..."
                        className="flex-1 bg-white/10 border border-white/10 rounded-xl
                                   px-4 py-2.5 text-white placeholder:text-white/40
                                   focus:outline-none focus:border-teal-500/50"
                        dir="rtl"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputText.trim() || sending}
                        className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 
                                   text-white transition-colors disabled:opacity-50"
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
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ChatInbox: React.FC<ChatInboxProps> = ({
    tenantId,
    branchId,
    className = ''
}) => {
    const { user } = useAuth();
    
    // State
    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Map<string, PendingRequest>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [sending, setSending] = useState(false);
    const [showOnlyUnread, setShowOnlyUnread] = useState(false);
    
    // ✅ Track previous unread count for smart notification
    const prevUnreadRef = useRef<number>(0);

    // ============================================================
    // SUBSCRIPTIONS
    // ============================================================

    // Subscribe to chat rooms
    useEffect(() => {
        const unsubscribe = subscribeToChatRooms(tenantId, branchId, (rooms) => {
            // ✅ Calculate new unread count
            const newUnreadCount = rooms.reduce((sum, r) => sum + r.unreadCount, 0);
            
            // ✅ Play sound only if unread count INCREASED (new message)
            if (newUnreadCount > prevUnreadRef.current) {
                playSound('notification');
                haptic('medium');
                
                // ✅ Show browser notification if page is not focused
                if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    const newMsgCount = newUnreadCount - prevUnreadRef.current;
                    new Notification('💬 رسالة جديدة من نزيل', {
                        body: `لديك ${newMsgCount} رسالة جديدة في الشات`,
                        icon: '/adora-logo.png',
                        tag: 'chat-notification'
                    });
                }
            }
            
            prevUnreadRef.current = newUnreadCount;
            setChatRooms(rooms);
        });

        return () => unsubscribe();
    }, [tenantId, branchId]);

    // Subscribe to pending requests
    useEffect(() => {
        const requestsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/requests`);
        const q = query(
            requestsRef,
            where('source', '==', 'chat'),
            where('status', '==', 'PENDING_RECEPTION'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = new Map<string, PendingRequest>();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.chatRoomId) {
                    requests.set(data.chatRoomId, {
                        id: doc.id,
                        chatRoomId: data.chatRoomId,
                        roomNumber: data.roomNumber,
                        type: data.type,
                        quickOptionId: data.quickOptionId,
                        notes: data.notes,
                        createdAt: data.createdAt
                    });
                }
            });
            setPendingRequests(requests);
        });

        return () => unsubscribe();
    }, [tenantId, branchId]);

    // Subscribe to selected room messages
    useEffect(() => {
        if (!selectedRoom) {
            setMessages([]);
            return;
        }

        // Mark as read
        markMessagesAsRead(tenantId, branchId, selectedRoom.id);

        const unsubscribe = subscribeToMessages(
            tenantId,
            branchId,
            selectedRoom.id,
            (newMessages) => {
                setMessages(newMessages);
            }
        );

        return () => unsubscribe();
    }, [selectedRoom, tenantId, branchId]);

    // ============================================================
    // FILTERED ROOMS
    // ============================================================

    const filteredRooms = useMemo(() => {
        let rooms = chatRooms;

        if (searchQuery) {
            rooms = rooms.filter(r => 
                r.roomNumber.includes(searchQuery) ||
                r.guestName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (showOnlyUnread) {
            rooms = rooms.filter(r => r.unreadCount > 0 || pendingRequests.has(r.id));
        }

        return rooms;
    }, [chatRooms, searchQuery, showOnlyUnread, pendingRequests]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleSendMessage = async (text: string) => {
        if (!selectedRoom || !user) return;

        setSending(true);
        try {
            await sendMessage(tenantId, branchId, selectedRoom.id, {
                roomNumber: selectedRoom.roomNumber,
                sender: 'reception',
                senderId: user.id,
                senderName: user.name,
                content: text,
                type: 'text'
            });
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const handleApprove = async (requestId: string) => {
        if (!selectedRoom || !user) return;

        setSending(true);
        haptic('success');
        
        try {
            await approveRequest(
                tenantId,
                branchId,
                requestId,
                selectedRoom.id,
                user.id,
                user.name
            );
            playSound('success');
        } catch (error) {
            console.error('Error approving request:', error);
        } finally {
            setSending(false);
        }
    };

    const handleForward = async (requestId: string, department: string) => {
        if (!selectedRoom || !user) return;

        setSending(true);
        haptic('medium');

        try {
            await forwardRequest(
                tenantId,
                branchId,
                requestId,
                selectedRoom.id,
                department,
                user.id,
                user.name
            );
            playSound('pop');
        } catch (error) {
            console.error('Error forwarding request:', error);
        } finally {
            setSending(false);
        }
    };

    // ============================================================
    // STATS
    // ============================================================

    const stats = useMemo(() => {
        const totalUnread = chatRooms.reduce((sum, r) => sum + r.unreadCount, 0);
        const pendingCount = pendingRequests.size;
        const criticalCount = Array.from(pendingRequests.values()).filter(r => {
            const elapsed = (Date.now() - r.createdAt.toDate().getTime()) / 60000;
            return elapsed >= SLA_CRITICAL_MINUTES;
        }).length;

        return { totalUnread, pendingCount, criticalCount };
    }, [chatRooms, pendingRequests]);

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className={`bg-slate-900 rounded-2xl border border-white/10 overflow-hidden flex ${className}`}
             style={{ height: '600px' }}>
            
            {/* Sidebar - Room List */}
            <div className="w-80 border-l border-white/10 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white font-bold flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-teal-400" />
                            صندوق الشات
                        </h3>
                        <div className="flex items-center gap-2">
                            {stats.totalUnread > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-500 text-white text-xs font-bold">
                                    {stats.totalUnread}
                                </span>
                            )}
                            {stats.criticalCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                                    ⚠️ {stats.criticalCount}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            placeholder="بحث برقم الغرفة..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/10 border border-white/10 rounded-xl pr-10 pl-4 py-2
                                       text-white text-sm placeholder:text-white/40
                                       focus:outline-none focus:border-teal-500/50"
                        />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowOnlyUnread(!showOnlyUnread)}
                        className={`mt-2 flex items-center gap-2 text-xs transition-colors ${
                            showOnlyUnread ? 'text-teal-400' : 'text-white/50'
                        }`}
                    >
                        <Filter className="w-3 h-3" />
                        <span>عرض الغير مقروءة فقط</span>
                    </button>
                </div>

                {/* Room List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredRooms.length === 0 ? (
                        <div className="text-center text-white/40 py-8">
                            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p>لا توجد محادثات</p>
                        </div>
                    ) : (
                        filteredRooms.map(room => (
                            <ChatRoomItem
                                key={room.id}
                                room={room}
                                isSelected={selectedRoom?.id === room.id}
                                onClick={() => setSelectedRoom(room)}
                                pendingRequest={pendingRequests.get(room.id)}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Main - Message View */}
            <div className="flex-1 flex flex-col">
                {selectedRoom ? (
                    <>
                        {/* Room Header */}
                        <div className="p-4 border-b border-white/10 bg-slate-800/30 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                    <Home className="w-5 h-5 text-teal-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">غرفة {selectedRoom.roomNumber}</h4>
                                    {selectedRoom.guestName && (
                                        <p className="text-white/60 text-sm">{selectedRoom.guestName}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedRoom(null)}
                                className="p-2 rounded-lg hover:bg-white/10 transition-colors sm:hidden"
                            >
                                <X className="w-5 h-5 text-white/60" />
                            </button>
                        </div>

                        {/* Messages */}
                        <MessageView
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            onApprove={handleApprove}
                            onForward={handleForward}
                            pendingRequest={pendingRequests.get(selectedRoom.id)}
                            sending={sending}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-white/40">
                        <div className="text-center">
                            <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
                            <p>اختر محادثة للبدء</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatInbox;
