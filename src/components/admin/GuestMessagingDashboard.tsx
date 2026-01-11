/**
 * Guest Messaging Dashboard (WhatsApp)
 * مركز رسائل المدير للتواصل مع النزلاء
 * 
 * ✅ Features:
 * - Filter guests by score/date
 * - WhatsApp message templates
 * - Manual sending via wa.me links
 * - Rate limiting (40/week)
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    MessageCircle,
    Filter,
    Search,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    Users,
    X,
    Copy,
    ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
    GuestProfile,
    getGuestsForMessaging,
    getMessageTemplates,
    generateWhatsAppLink,
    trackSentMessage,
    getWeeklySentCount,
    getVipBadgeInfo
} from '../../services/guestLoyaltyService';
import { AdoraLoader } from '../common/AdoraLoader';

// ============================================================
// TYPES
// ============================================================

interface GuestMessagingDashboardProps {
    tenantId: string;
    onClose?: () => void;
}

interface FilterState {
    minScore: number | null;
    maxScore: number | null;
    vipLevels: GuestProfile['vipLevel'][];
    searchQuery: string;
    dateRange: 'week' | 'month' | 'all';
}

// ============================================================
// CONSTANTS
// ============================================================

const WEEKLY_LIMIT = 40;

const VIP_FILTER_OPTIONS: { value: GuestProfile['vipLevel']; label: string; color: string }[] = [
    { value: 'platinum', label: '💎 بلاتيني', color: 'text-purple-400' },
    { value: 'gold', label: '⭐ ذهبي', color: 'text-amber-400' },
    { value: 'silver', label: '🥈 فضي', color: 'text-slate-300' },
    { value: 'regular', label: '✅ دائم', color: 'text-teal-400' },
    { value: 'new', label: '🆕 جديد', color: 'text-blue-400' }
];

// ============================================================
// COMPONENT
// ============================================================

export const GuestMessagingDashboard: React.FC<GuestMessagingDashboardProps> = ({
    tenantId,
    onClose
}) => {
    const { user } = useAuth();
    
    // State
    const [guests, setGuests] = useState<GuestProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [weeklySentCount, setWeeklySentCount] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState(getMessageTemplates()[0]);
    const [customMessage, setCustomMessage] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
    const [sentThisSession, setSentThisSession] = useState<Set<string>>(new Set());
    
    const [filters, setFilters] = useState<FilterState>({
        minScore: null,
        maxScore: null,
        vipLevels: [],
        searchQuery: '',
        dateRange: 'week'
    });

    const templates = getMessageTemplates();

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadData();
    }, [tenantId, filters.dateRange]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Get sent count
            const sentCount = await getWeeklySentCount(tenantId);
            setWeeklySentCount(sentCount);

            // Get guests based on date range
            let fromDate: Date | undefined;
            if (filters.dateRange === 'week') {
                fromDate = new Date();
                fromDate.setDate(fromDate.getDate() - 7);
            } else if (filters.dateRange === 'month') {
                fromDate = new Date();
                fromDate.setMonth(fromDate.getMonth() - 1);
            }

            const guestList = await getGuestsForMessaging(tenantId, {
                fromDate,
                limit: 200
            });

            setGuests(guestList);
        } catch (error) {
            console.error('Error loading guests:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // FILTERED GUESTS
    // ============================================================

    const filteredGuests = useMemo(() => {
        return guests.filter(guest => {
            // Score filters
            if (filters.minScore !== null && guest.respectScore < filters.minScore) return false;
            if (filters.maxScore !== null && guest.respectScore > filters.maxScore) return false;
            
            // VIP level filter
            if (filters.vipLevels.length > 0 && !filters.vipLevels.includes(guest.vipLevel)) return false;
            
            // Search query
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const matchesName = guest.name?.toLowerCase().includes(query);
                const matchesPhone = guest.phone.includes(query);
                if (!matchesName && !matchesPhone) return false;
            }
            
            return true;
        });
    }, [guests, filters]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const handleSendMessage = async (guest: GuestProfile) => {
        if (weeklySentCount >= WEEKLY_LIMIT) {
            alert('⚠️ تم الوصول للحد الأقصى من الرسائل هذا الأسبوع (40 رسالة)');
            return;
        }

        const message = customMessage || selectedTemplate.template;
        const link = generateWhatsAppLink(guest.phone, message);
        
        // Track the message
        await trackSentMessage(
            tenantId,
            guest.id,
            guest.phone,
            selectedTemplate.id,
            user?.id || 'unknown'
        );

        // Update counts
        setWeeklySentCount(prev => prev + 1);
        setSentThisSession(prev => new Set([...prev, guest.id]));
        
        // Open WhatsApp
        window.open(link, '_blank');
    };

    const copyPhoneNumber = (phone: string) => {
        navigator.clipboard.writeText(phone);
    };

    const toggleGuestSelection = (guestId: string) => {
        setSelectedGuests(prev => {
            const newSet = new Set(prev);
            if (newSet.has(guestId)) {
                newSet.delete(guestId);
            } else {
                newSet.add(guestId);
            }
            return newSet;
        });
    };

    const selectAllFiltered = () => {
        const allIds = new Set(filteredGuests.map(g => g.id));
        setSelectedGuests(allIds);
    };

    const clearSelection = () => {
        setSelectedGuests(new Set());
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <div className="bg-slate-900 rounded-2xl border border-white/10 overflow-hidden">
            
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-green-900/20 to-teal-900/20">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">مركز رسائل النزلاء</h2>
                            <p className="text-white/60 text-sm">تواصل مع نزلائك عبر WhatsApp</p>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    )}
                </div>

                {/* Weekly Limit Progress */}
                <div className="bg-slate-800/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-white/60 text-sm">رسائل هذا الأسبوع</span>
                        <span className={`font-bold ${
                            weeklySentCount >= WEEKLY_LIMIT ? 'text-red-400' : 
                            weeklySentCount >= WEEKLY_LIMIT * 0.8 ? 'text-amber-400' : 'text-teal-400'
                        }`}>
                            {weeklySentCount} / {WEEKLY_LIMIT}
                        </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                weeklySentCount >= WEEKLY_LIMIT ? 'bg-red-500' :
                                weeklySentCount >= WEEKLY_LIMIT * 0.8 ? 'bg-amber-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${Math.min(100, (weeklySentCount / WEEKLY_LIMIT) * 100)}%` }}
                        />
                    </div>
                    {weeklySentCount >= WEEKLY_LIMIT && (
                        <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            تم الوصول للحد الأقصى - لحماية رقمك من الحظر
                        </p>
                    )}
                </div>
            </div>

            {/* Message Template */}
            <div className="p-4 border-b border-white/10">
                <label className="block text-white/60 text-sm mb-2">قالب الرسالة:</label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {templates.map(template => (
                        <button
                            key={template.id}
                            onClick={() => {
                                setSelectedTemplate(template);
                                setCustomMessage('');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                selectedTemplate.id === template.id
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            {template.name}
                        </button>
                    ))}
                </div>
                <textarea
                    value={customMessage || selectedTemplate.template}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    className="w-full bg-slate-800 border border-white/10 rounded-xl p-3 text-white text-sm
                               placeholder:text-white/30 focus:outline-none focus:border-green-500/50
                               resize-none h-24"
                    dir="rtl"
                />

                {/* ✅ Message Preview Card */}
                <div className="mt-3 bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-green-400 text-xs font-medium">📱 معاينة الرسالة</span>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 border border-white/5">
                        {/* WhatsApp Style Preview */}
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <MessageCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="bg-green-800/30 rounded-xl rounded-tr-sm p-3">
                                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap" dir="rtl">
                                        {(customMessage || selectedTemplate.template)
                                            .replace(/{guestName}/g, '🔹 أحمد محمد')
                                            .replace(/{hotelName}/g, '🏨 فندق الواحة')
                                            .replace(/{roomNumber}/g, '🚪 غرفة 305')
                                            .replace(/{checkInDate}/g, '📅 15 يناير')
                                            .replace(/{checkOutDate}/g, '📅 18 يناير')
                                            .replace(/{totalAmount}/g, '💰 1,500 ر.س')
                                        }
                                    </p>
                                </div>
                                <p className="text-white/40 text-xs mt-1 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <Check className="w-3 h-3 -mr-2" />
                                    الآن
                                </p>
                            </div>
                        </div>
                        <p className="text-white/40 text-xs mt-3 text-center">
                            💡 المتغيرات مثل {'{guestName}'} ستُستبدل تلقائياً ببيانات النزيل الحقيقية
                        </p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-white/10">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
                >
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">تصفية النزلاء</span>
                    {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showFilters && (
                    <div className="mt-4 space-y-4 animate-in slide-in-from-top duration-200">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="بحث بالاسم أو الرقم..."
                                value={filters.searchQuery}
                                onChange={(e) => setFilters(f => ({ ...f, searchQuery: e.target.value }))}
                                className="w-full bg-slate-800 border border-white/10 rounded-xl pr-10 pl-4 py-2
                                           text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-teal-500/50"
                            />
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-white/40 text-xs mb-2">الفترة:</label>
                            <div className="flex gap-2">
                                {[
                                    { value: 'week', label: 'هذا الأسبوع' },
                                    { value: 'month', label: 'هذا الشهر' },
                                    { value: 'all', label: 'الكل' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setFilters(f => ({ ...f, dateRange: opt.value as any }))}
                                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                            filters.dateRange === opt.value
                                                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* VIP Levels */}
                        <div>
                            <label className="block text-white/40 text-xs mb-2">مستوى النزيل:</label>
                            <div className="flex flex-wrap gap-2">
                                {VIP_FILTER_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            setFilters(f => ({
                                                ...f,
                                                vipLevels: f.vipLevels.includes(opt.value)
                                                    ? f.vipLevels.filter(v => v !== opt.value)
                                                    : [...f.vipLevels, opt.value]
                                            }));
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                            filters.vipLevels.includes(opt.value)
                                                ? 'bg-white/20 text-white border border-white/30'
                                                : 'bg-white/5 text-white/60 hover:bg-white/10'
                                        } ${opt.color}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Score Range */}
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-white/40 text-xs mb-2">الحد الأدنى للتقييم:</label>
                                <input
                                    type="number"
                                    value={filters.minScore ?? ''}
                                    onChange={(e) => setFilters(f => ({ ...f, minScore: e.target.value ? Number(e.target.value) : null }))}
                                    placeholder="0"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2
                                               text-white text-sm focus:outline-none focus:border-teal-500/50"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-white/40 text-xs mb-2">الحد الأقصى للتقييم:</label>
                                <input
                                    type="number"
                                    value={filters.maxScore ?? ''}
                                    onChange={(e) => setFilters(f => ({ ...f, maxScore: e.target.value ? Number(e.target.value) : null }))}
                                    placeholder="100"
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2
                                               text-white text-sm focus:outline-none focus:border-teal-500/50"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Bar */}
            <div className="px-4 py-3 bg-slate-800/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-white/60 text-sm">
                        <Users className="w-4 h-4 inline ml-1" />
                        {filteredGuests.length} نزيل
                    </span>
                    {selectedGuests.size > 0 && (
                        <span className="text-teal-400 text-sm">
                            ✓ {selectedGuests.size} محدد
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={selectAllFiltered}
                        className="text-xs text-white/60 hover:text-white"
                    >
                        تحديد الكل
                    </button>
                    {selectedGuests.size > 0 && (
                        <button
                            onClick={clearSelection}
                            className="text-xs text-red-400 hover:text-red-300"
                        >
                            إلغاء التحديد
                        </button>
                    )}
                </div>
            </div>

            {/* Guest List */}
            <div className="max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="p-8 text-center">
                        <AdoraLoader size="md" message="جاري تحميل النزلاء..." />
                    </div>
                ) : filteredGuests.length === 0 ? (
                    <div className="p-8 text-center text-white/40">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p>لا يوجد نزلاء مطابقين للفلتر</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filteredGuests.map(guest => {
                            const badge = getVipBadgeInfo(guest.vipLevel, guest.respectScore);
                            const isSent = sentThisSession.has(guest.id);

                            return (
                                <div
                                    key={guest.id}
                                    className={`p-4 flex items-center gap-4 hover:bg-white/5 transition-colors ${
                                        selectedGuests.has(guest.id) ? 'bg-teal-500/10' : ''
                                    }`}
                                >
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => toggleGuestSelection(guest.id)}
                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                            selectedGuests.has(guest.id)
                                                ? 'bg-teal-500 border-teal-500'
                                                : 'border-white/30 hover:border-white/50'
                                        }`}
                                    >
                                        {selectedGuests.has(guest.id) && (
                                            <Check className="w-3 h-3 text-white" />
                                        )}
                                    </button>

                                    {/* Guest Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-white font-medium truncate">
                                                {guest.name || guest.firstName || 'نزيل'}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs ${badge.bgColor} ${badge.color}`}>
                                                {badge.icon} {badge.labelAr}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-white/60">
                                            <span dir="ltr">{guest.phone}</span>
                                            <span>•</span>
                                            <span>{guest.totalVisits} زيارة</span>
                                            <span>•</span>
                                            <span className={guest.respectScore >= 0 ? 'text-teal-400' : 'text-red-400'}>
                                                {guest.respectScore} نقطة
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyPhoneNumber(guest.phone)}
                                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                            title="نسخ الرقم"
                                        >
                                            <Copy className="w-4 h-4 text-white/60" />
                                        </button>
                                        
                                        <button
                                            onClick={() => handleSendMessage(guest)}
                                            disabled={isSent || weeklySentCount >= WEEKLY_LIMIT}
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 transition-all ${
                                                isSent
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : weeklySentCount >= WEEKLY_LIMIT
                                                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                            }`}
                                        >
                                            {isSent ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    <span className="text-sm">تم</span>
                                                </>
                                            ) : (
                                                <>
                                                    <MessageCircle className="w-4 h-4" />
                                                    <span className="text-sm">واتساب</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer Note */}
            <div className="p-4 bg-slate-800/30 border-t border-white/10">
                <p className="text-white/40 text-xs text-center">
                    💡 الإرسال يدوي عبر روابط wa.me لتجنب حظر الرقم. الحد الأقصى {WEEKLY_LIMIT} رسالة أسبوعياً.
                </p>
            </div>
        </div>
    );
};

export default GuestMessagingDashboard;
