/**
 * Live Chat Monitor (الرادار الحي للمدير)
 * مراقبة جميع المحادثات في الفندق لحظة بلحظة
 * 
 * ✅ Features:
 * - All active chats overview
 * - SLA tracking & alerts
 * - Filter by room/department/status
 * - Response time analytics
 * - Click to view conversation
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Radio,
    MessageCircle,
    Clock,
    AlertTriangle,
    Search,
    Eye,
    TrendingUp,
    Home,
    X,
    RefreshCw,
    Activity
} from 'lucide-react';
import { db } from '../../services/firebase';
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import {
    ChatMessage,
    subscribeToMessages
} from '../../services/smartChatService';

// ============================================================
// TYPES
// ============================================================

interface LiveChatMonitorProps {
    tenantId: string;
    branchId?: string; // If not provided, shows all branches
    className?: string;
}

interface MonitoredChat {
    roomId: string;
    roomNumber: string;
    branchId: string;
    guestName?: string;
    status: 'active' | 'waiting' | 'resolved';
    unreadCount: number;
    lastMessage?: string;
    lastMessageAt?: Timestamp;
    createdAt: Timestamp;
    waitingTime: number; // minutes
    responseTime?: number; // minutes (time to first response)
}

interface ChatStats {
    totalActive: number;
    waitingResponse: number;
    criticalSLA: number;
    avgResponseTime: number;
    resolvedToday: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const SLA_WARNING = 3; // minutes
const SLA_CRITICAL = 5; // minutes

// ============================================================
// STAT CARD
// ============================================================

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    color: string;
    bgColor: string;
    alert?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bgColor, alert }) => (
    <div className={`rounded-xl p-4 ${bgColor} ${alert ? 'animate-pulse' : ''}`}>
        <div className="flex items-center gap-3">
            <div className={`${color}`}>{icon}</div>
            <div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-white/60 text-sm">{label}</p>
            </div>
        </div>
    </div>
);

// ============================================================
// CHAT ROW
// ============================================================

interface ChatRowProps {
    chat: MonitoredChat;
    onView: () => void;
}

const ChatRow: React.FC<ChatRowProps & { t: (key: string) => string }> = ({ chat, onView, t }) => {
    const isWarning = chat.waitingTime >= SLA_WARNING && chat.waitingTime < SLA_CRITICAL;
    const isCritical = chat.waitingTime >= SLA_CRITICAL;

    const getStatusBadge = () => {
        if (chat.status === 'resolved') {
            return <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">✓ {t('admin.resolved') || 'Resolved'}</span>;
        }
        if (isCritical) {
            return <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs animate-pulse">⚠️ {t('admin.delayed') || 'Delayed'}</span>;
        }
        if (isWarning) {
            return <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">{t('admin.warning') || 'Warning'}</span>;
        }
        if (chat.unreadCount > 0) {
            return <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 text-xs">{t('admin.new') || 'New'}</span>;
        }
        return <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">{t('admin.active') || 'Active'}</span>;
    };

    return (
        <div className={`
            flex items-center gap-4 p-4 rounded-xl transition-all
            hover:bg-white/5 border border-transparent
            ${isCritical ? 'bg-red-500/10 border-red-500/30' : ''}
            ${isWarning && !isCritical ? 'bg-amber-500/5 border-amber-500/20' : ''}
        `}>
            {/* Room Icon */}
            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center
                ${isCritical ? 'bg-red-500/20' : isWarning ? 'bg-amber-500/20' : 'bg-white/10'}
            `}>
                <Home className={`w-5 h-5 ${isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white/60'}`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-bold">غرفة {chat.roomNumber}</span>
                    {getStatusBadge()}
                </div>
                <p className="text-white/50 text-sm truncate">{chat.lastMessage || t('admin.newConversation') || 'New conversation'}</p>
                {chat.guestName && (
                    <p className="text-white/40 text-xs mt-0.5">{chat.guestName}</p>
                )}
            </div>

            {/* Time */}
            <div className="text-left">
                <div className={`flex items-center gap-1 ${
                    isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-white/50'
                }`}>
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">{chat.waitingTime} د</span>
                </div>
                {chat.responseTime !== undefined && (
                    <p className="text-white/40 text-xs mt-0.5">
                        رد في {chat.responseTime} د
                    </p>
                )}
            </div>

            {/* Actions */}
            <button
                onClick={onView}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                title="عرض المحادثة"
            >
                <Eye className="w-4 h-4 text-white/60" />
            </button>
        </div>
    );
};

// ============================================================
// CONVERSATION VIEWER
// ============================================================

interface ConversationViewerProps {
    tenantId: string;
    branchId: string;
    roomId: string;
    roomNumber: string;
    onClose: () => void;
}

const ConversationViewer: React.FC<ConversationViewerProps> = ({
    tenantId,
    branchId,
    roomId,
    roomNumber,
    onClose
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToMessages(
            tenantId,
            branchId,
            roomId,
            setMessages
        );

        return () => unsubscribe();
    }, [tenantId, branchId, roomId]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">{t('admin.room') || 'Room'} {roomNumber}</h3>
                            <p className="text-white/60 text-xs">{t('admin.monitorConversation') || 'Monitor conversation'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Messages */}
                <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
                    {messages.length === 0 ? (
                        <p className="text-center text-white/40 py-8">لا توجد رسائل</p>
                    ) : (
                        messages.map((msg, index) => {
                            const isGuest = msg.sender === 'guest';
                            const time = msg.createdAt instanceof Timestamp
                                ? msg.createdAt.toDate().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                                : '';

                            return (
                                <div key={msg.id || index} className={`flex ${isGuest ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                        isGuest 
                                            ? 'bg-white/10 text-white' 
                                            : msg.sender === 'bot'
                                            ? 'bg-purple-500/20 text-white'
                                            : 'bg-teal-600 text-white'
                                    }`}>
                                        <p className="text-xs text-white/60 mb-1">
                                            {msg.senderName || (isGuest ? 'النزيل' : 'الاستقبال')}
                                        </p>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <span className="text-xs opacity-50 block text-left mt-1">{time}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Note */}
                <div className="p-3 bg-slate-800/50 border-t border-white/10">
                    <p className="text-center text-white/40 text-xs">
                        🔒 {t('admin.readOnlyMonitor') || 'This view is for monitoring only - cannot send messages from here'}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const LiveChatMonitor: React.FC<LiveChatMonitorProps> = ({
    tenantId,
    branchId,
    className = ''
}) => {
    const { t } = useTranslation();
    // State
    const [chats, setChats] = useState<MonitoredChat[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'critical'>('all');
    const [selectedChat, setSelectedChat] = useState<MonitoredChat | null>(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    // ============================================================
    // SUBSCRIPTION
    // ============================================================

    useEffect(() => {
        if (!db) return;
        
        const branchIds = branchId ? [branchId] : ['main']; // TODO: Get all branches if not specified

        const unsubscribes: (() => void)[] = [];

        branchIds.forEach(bid => {
            if (!db) return;
            const roomsRef = collection(db, `tenants/${tenantId}/branches/${bid}/chat_rooms`);
            const q = query(
                roomsRef,
                where('status', '==', 'active'),
                orderBy('lastMessageAt', 'desc')
            );

            const unsub = onSnapshot(q, (snapshot) => {
                const now = Date.now();
                const roomChats: MonitoredChat[] = snapshot.docs.map(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt || Timestamp.now();
                    const lastMessageAt = data.lastMessageAt || createdAt;
                    
                    const waitingTime = Math.floor((now - lastMessageAt.toDate().getTime()) / 60000);

                    return {
                        roomId: doc.id,
                        roomNumber: data.roomNumber,
                        branchId: bid,
                        guestName: data.guestName,
                        status: data.unreadCount > 0 ? 'waiting' : 'active',
                        unreadCount: data.unreadCount || 0,
                        lastMessage: data.lastMessage,
                        lastMessageAt: data.lastMessageAt,
                        createdAt,
                        waitingTime,
                        responseTime: data.firstResponseTime
                    };
                });

                setChats(prev => {
                    // Merge with other branches
                    const otherBranches = prev.filter(c => c.branchId !== bid);
                    return [...otherBranches, ...roomChats];
                });
                setLastRefresh(new Date());
            });

            unsubscribes.push(unsub);
        });

        return () => unsubscribes.forEach(u => u());
    }, [tenantId, branchId]);

    // ============================================================
    // COMPUTED VALUES
    // ============================================================

    const filteredChats = useMemo(() => {
        let result = chats;

        if (searchQuery) {
            result = result.filter(c =>
                c.roomNumber.includes(searchQuery) ||
                c.guestName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (statusFilter === 'waiting') {
            result = result.filter(c => c.unreadCount > 0);
        } else if (statusFilter === 'critical') {
            result = result.filter(c => c.waitingTime >= SLA_CRITICAL);
        }

        return result.sort((a, b) => b.waitingTime - a.waitingTime);
    }, [chats, searchQuery, statusFilter]);

    const stats: ChatStats = useMemo(() => {
        const totalActive = chats.length;
        const waitingResponse = chats.filter(c => c.unreadCount > 0).length;
        const criticalSLA = chats.filter(c => c.waitingTime >= SLA_CRITICAL).length;
        const withResponse = chats.filter(c => c.responseTime !== undefined);
        const avgResponseTime = withResponse.length > 0
            ? Math.round(withResponse.reduce((sum, c) => sum + (c.responseTime || 0), 0) / withResponse.length)
            : 0;
        const resolvedToday = 0; // TODO: Track from separate collection

        return { totalActive, waitingResponse, criticalSLA, avgResponseTime, resolvedToday };
    }, [chats]);

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className={`bg-slate-900 rounded-2xl border border-white/10 overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-b border-white/10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                            <Radio className="w-6 h-6 text-indigo-400 animate-pulse" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('admin.liveRadar') || '📡 Live Radar'}</h2>
                            <p className="text-white/60 text-sm">{t('admin.monitorAllChats') || 'Monitor all conversations'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                        <Activity className="w-3 h-3 text-green-400 animate-pulse" />
                        <span>{t('admin.liveUpdate') || 'Live Update'}</span>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        icon={<MessageCircle className="w-5 h-5" />}
                        label={t('admin.activeChats') || 'Active Chats'}
                        value={stats.totalActive}
                        color="text-teal-400"
                        bgColor="bg-teal-500/10"
                    />
                    <StatCard
                        icon={<Clock className="w-5 h-5" />}
                        label="تنتظر رد"
                        value={stats.waitingResponse}
                        color="text-amber-400"
                        bgColor="bg-amber-500/10"
                    />
                    <StatCard
                        icon={<AlertTriangle className="w-5 h-5" />}
                        label="تجاوز SLA"
                        value={stats.criticalSLA}
                        color="text-red-400"
                        bgColor="bg-red-500/10"
                        alert={stats.criticalSLA > 0}
                    />
                    <StatCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="متوسط الرد"
                        value={`${stats.avgResponseTime} د`}
                        color="text-blue-400"
                        bgColor="bg-blue-500/10"
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-white/10 flex flex-wrap gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                        type="text"
                        placeholder="بحث برقم الغرفة..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-xl pr-10 pl-4 py-2
                                   text-white text-sm placeholder:text-white/40
                                   focus:outline-none focus:border-indigo-500/50"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                    {[
                        { value: 'all', label: t('admin.all') || 'All' },
                        { value: 'waiting', label: t('admin.waiting') || 'Waiting' },
                        { value: 'critical', label: `⚠️ ${t('admin.delayed') || 'Delayed'}` }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value as any)}
                            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                statusFilter === opt.value
                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat List */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                {filteredChats.length === 0 ? (
                    <div className="p-8 text-center text-white/40">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p>{t('admin.noActiveChats') || 'No active chats'}</p>
                    </div>
                ) : (
                    filteredChats.map(chat => (
                        <ChatRow
                            key={chat.roomId}
                            chat={chat}
                            onView={() => setSelectedChat(chat)}
                            t={t}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-800/30 border-t border-white/10 flex items-center justify-between">
                <p className="text-white/40 text-xs">
                    {t('admin.lastUpdate') || 'Last update'}: {lastRefresh.toLocaleTimeString()}
                </p>
                <button
                    onClick={() => setLastRefresh(new Date())}
                    className="flex items-center gap-1 text-white/50 text-xs hover:text-white transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    تحديث
                </button>
            </div>

            {/* Conversation Viewer Modal */}
            {selectedChat && (
                <ConversationViewer
                    tenantId={tenantId}
                    branchId={selectedChat.branchId}
                    roomId={selectedChat.roomId}
                    roomNumber={selectedChat.roomNumber}
                    onClose={() => setSelectedChat(null)}
                />
            )}
        </div>
    );
};

export default LiveChatMonitor;
