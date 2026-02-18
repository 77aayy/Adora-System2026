/**
 * Support Tickets Manager
 * Owner's view for managing support tickets from branches
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Mail, X, CheckCircle, Clock, AlertCircle, Phone, User, Building2,
    MessageSquare, FileText, ArrowRight, Check, XCircle, Save, Eye, Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { useTenantBranches } from '../../hooks/useTenantData';
import { SupportTicketModal } from '../../components/shared/SupportTicketModal';
import { formatDateTimeGregorianEn } from '../../utils/dateUtils';
import {
    subscribeToAllTickets,
    subscribeToTenantTickets,
    subscribeToBranchTickets,
    subscribeToUserTickets,
    acknowledgeTicket,
    markTicketInProgress,
    resolveTicket,
    closeTicket,
    addOwnerResponse,
    markTicketAsRead,
    subscribeToTicketStatus,
    type SupportTicket,
    type SupportTicketStatus
} from '../../services/supportTicketService';

export const SupportTicketsManager: React.FC = () => {
    const { user, branchId } = useAuth();
    const { tenantId } = useTenant();
    const { success, error } = useUX();
    const { t } = useTranslation();

    const isOwner = user?.role === 'owner';
    const isManager = user?.role === 'manager';

    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [ticketStatus, setTicketStatus] = useState<SupportTicketStatus | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [selectedTab, setSelectedTab] = useState<'pending' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'all'>('pending');
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
    const [resolutionNote, setResolutionNote] = useState('');
    const [ownerResponse, setOwnerResponse] = useState('');
    const { branches: rawBranches } = useTenantBranches();
    // ✅ ARCHITECT FIX: Ensure branches is always an array (SaaS Safety)
    const branches = Array.isArray(rawBranches) ? rawBranches : [];
    const currentBranch = branchId ? branches.find(b => b.id === branchId) || branches[0] : branches[0];

    useEffect(() => {
        // ✅ CRITICAL FIX: Owner doesn't need tenantId - they see all tickets
        // For Owner, we'll use a special subscription that gets all tickets
        // For Manager/Other users, we need tenantId
        if (!isOwner && !tenantId) return;

        // Subscribe to ticket status (for badge) - Owner only
        let unsubStatus: (() => void) | null = null;
        if (isOwner) {
            // ✅ Owner: Subscribe to all tickets (no tenantId needed)
            // We'll use a special service method or pass null/undefined for tenantId
            // For now, if tenantId is 'system-owner', we'll handle it differently
            const ownerTenantId = tenantId || 'system-owner';
            unsubStatus = subscribeToTicketStatus(ownerTenantId, (status) => {
                setTicketStatus(status);
            });
        }

        // Subscribe to tickets based on role
        let unsubTickets: (() => void) | null = null;
        if (isOwner) {
            // ✅ Owner: See ALL tickets from ALL managers and employees (no tenantId filter)
            unsubTickets = subscribeToAllTickets((ticketsList) => {
                setTickets(ticketsList);
            });
        } else if (isManager && branchId && tenantId) {
            // Manager: See only tickets from their branch
            unsubTickets = subscribeToBranchTickets(branchId, tenantId, (ticketsList) => {
                setTickets(ticketsList);
            });
        } else if (user?.id && tenantId) {
            // Other users: See only their own tickets
            unsubTickets = subscribeToUserTickets(user.id, tenantId, (ticketsList) => {
                setTickets(ticketsList);
            });
        }

        return () => {
            if (unsubStatus) unsubStatus();
            if (unsubTickets) unsubTickets();
        };
    }, [tenantId, branchId, user?.id, isOwner, isManager]);

    const filteredTickets = tickets.filter(ticket => {
        if (selectedTab === 'all') return true;
        return ticket.status === selectedTab;
    });

    const handleAcknowledge = async (ticketId: string) => {
        if (!user) return;
        try {
            await acknowledgeTicket(ticketId, user.id, user.name || '');
            success('تم العلم بالتذكرة');
        } catch (err) {
            error('فشل تحديث التذكرة');
        }
    };

    const handleMarkInProgress = async (ticketId: string) => {
        if (!user) return;
        try {
            await markTicketInProgress(ticketId, user.id, user.name || '');
            success('تم تحديث الحالة إلى "جاري العمل"');
        } catch (err) {
            error('فشل تحديث التذكرة');
        }
    };

    const handleResolve = async (ticketId: string) => {
        if (!user || !resolutionNote.trim()) {
            error('يرجى إدخال ملاحظة الحل');
            return;
        }
        try {
            await resolveTicket(ticketId, user.id, user.name || '', resolutionNote);
            success('تم إغلاق التذكرة');
            setShowTicketModal(false);
            setResolutionNote('');
        } catch (err) {
            error('فشل إغلاق التذكرة');
        }
    };

    const handleClose = async (ticketId: string) => {
        if (!user) return;
        try {
            await closeTicket(ticketId, user.id, user.name || '', resolutionNote || 'تم الإغلاق');
            success('تم إغلاق التذكرة');
            setShowTicketModal(false);
            setResolutionNote('');
        } catch (err) {
            error('فشل إغلاق التذكرة');
        }
    };

    const handleAddResponse = async (ticketId: string) => {
        if (!user || !ownerResponse.trim()) {
            error('يرجى إدخال رد');
            return;
        }
        try {
            await addOwnerResponse(ticketId, ownerResponse, user.id, user.name || '');
            success('تم إضافة الرد');
            setOwnerResponse('');
        } catch (err) {
            error('فشل إضافة الرد');
        }
    };

    const handleViewTicket = (ticket: SupportTicket) => {
        setSelectedTicket(ticket);
        setShowTicketModal(true);
        markTicketAsRead(ticket.id, tenantId);
    };

    const getStatusBadge = (status: SupportTicket['status']) => {
        const badges = {
            pending: { label: 'في الانتظار', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
            acknowledged: { label: 'تم العلم', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
            in_progress: { label: 'جاري العمل', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
            resolved: { label: 'تم الحل', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
            closed: { label: 'مغلق', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
        };
        const badge = badges[status];
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${badge.color}`}>
                {badge.label}
            </span>
        );
    };

    const getPriorityBadge = (priority: SupportTicket['priority']) => {
        const badges = {
            low: { label: 'منخفضة', color: 'bg-blue-500/20 text-blue-400' },
            medium: { label: 'متوسطة', color: 'bg-yellow-500/20 text-yellow-400' },
            high: { label: 'عالية', color: 'bg-orange-500/20 text-orange-400' },
            urgent: { label: 'عاجلة', color: 'bg-red-500/20 text-red-400' }
        };
        const badge = badges[priority];
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
                {badge.label}
            </span>
        );
    };

    return (
        <div className="min-h-screen theme-page p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                {isOwner ? 'دعم فني - التذاكر' : 'تذاكر الدعم الفني'}
                            </h1>
                            <p className="text-sm text-white/60">
                                {isOwner && ticketStatus && ticketStatus.unreadCount > 0 && (
                                    <span className="text-yellow-400">
                                        {ticketStatus.unreadCount} تذكرة جديدة
                                    </span>
                                )}
                                {!isOwner && (
                                    <span>إرسال ومتابعة طلبات الدعم الفني</span>
                                )}
                            </p>
                        </div>
                    </div>
                    {/* ✅ Manager: Add "Create Ticket" button */}
                    {!isOwner && currentBranch && (
                        <button
                            onClick={() => setShowCreateTicketModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl font-medium hover:shadow-lg shadow-yellow-500/25 transition-all active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            إرسال تذكرة جديدة
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto">
                    {[
                        { id: 'pending', label: t('admin.supportTickets.status.pending') || 'في الانتظار', count: tickets.filter(t => t.status === 'pending').length },
                        { id: 'acknowledged', label: t('admin.supportTickets.status.acknowledged') || 'تم العلم', count: tickets.filter(t => t.status === 'acknowledged').length },
                        { id: 'in_progress', label: t('admin.supportTickets.status.inProgress') || 'جاري العمل', count: tickets.filter(t => t.status === 'in_progress').length },
                        { id: 'resolved', label: t('admin.supportTickets.status.resolved') || 'تم الحل', count: tickets.filter(t => t.status === 'resolved').length },
                        { id: 'closed', label: t('admin.supportTickets.status.closed') || 'مغلق', count: tickets.filter(t => t.status === 'closed').length },
                        { id: 'all', label: t('common.all') || 'الكل', count: tickets.length }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedTab(tab.id as any)}
                            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
                                selectedTab === tab.id
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/25'
                                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                            }`}
                        >
                            {tab.label}
                            {tab.count > 0 && (
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    selectedTab === tab.id ? 'bg-white/20' : 'bg-white/10'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Tickets List */}
                <div className="space-y-4">
                    {filteredTickets.map(ticket => (
                        <div
                            key={ticket.id}
                            onClick={() => handleViewTicket(ticket)}
                            className="glass-card p-4 rounded-xl border border-white/10 hover:border-yellow-500/30 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-yellow-400 font-bold">#{ticket.ticketNumber}</span>
                                        {getStatusBadge(ticket.status)}
                                        {getPriorityBadge(ticket.priority)}
                                    </div>
                                    <h3 className="text-white font-semibold mb-1">{ticket.title || 'طلب دعم فني'}</h3>
                                    <p className="text-white/60 text-sm line-clamp-2 mb-3">{ticket.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-white/50">
                                        <span className="flex items-center gap-1">
                                            <Building2 className="w-3 h-3" />
                                            {ticket.senderBranchName} ({ticket.senderBranchCode || ticket.senderBranchId})
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {ticket.senderName} {ticket.senderCode && `(${ticket.senderCode})`}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            {ticket.contactPhone}
                                        </span>
                                        <span>
                                            {formatDateTimeGregorianEn(ticket.createdAt?.toDate ? ticket.createdAt.toDate() : ticket.createdAt, { showSeconds: false })}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 text-white/30 flex-shrink-0" />
                            </div>
                        </div>
                    ))}

                    {filteredTickets.length === 0 && (
                        <div className="text-center py-12 text-white/40">
                            <Mail className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>لا توجد تذاكر في هذا التبويب</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ticket Details Modal */}
            {showTicketModal && selectedTicket && (
                <TicketDetailsModal
                    ticket={selectedTicket}
                    onClose={() => {
                        setShowTicketModal(false);
                        setSelectedTicket(null);
                        setResolutionNote('');
                        setOwnerResponse('');
                    }}
                    onAcknowledge={isOwner ? handleAcknowledge : undefined}
                    onMarkInProgress={isOwner ? handleMarkInProgress : undefined}
                    onResolve={isOwner ? handleResolve : undefined}
                    onCloseTicket={isOwner ? handleClose : undefined}
                    onAddResponse={isOwner ? handleAddResponse : undefined}
                    resolutionNote={resolutionNote}
                    setResolutionNote={setResolutionNote}
                    ownerResponse={ownerResponse}
                    setOwnerResponse={setOwnerResponse}
                    isOwner={isOwner}
                />
            )}

            {/* ✅ Create Ticket Modal for Manager */}
            {!isOwner && currentBranch && (
                <SupportTicketModal
                    isOpen={showCreateTicketModal}
                    onClose={() => setShowCreateTicketModal(false)}
                    branchId={currentBranch.id}
                    branchName={currentBranch.name || 'الفرع'}
                />
            )}
        </div>
    );
};

// Ticket Details Modal Component
const TicketDetailsModal: React.FC<{
    ticket: SupportTicket;
    onClose: () => void;
    onAcknowledge?: (ticketId: string) => void;
    onMarkInProgress?: (ticketId: string) => void;
    onResolve?: (ticketId: string) => void;
    onCloseTicket?: (ticketId: string) => void;
    onAddResponse?: (ticketId: string) => void;
    resolutionNote: string;
    setResolutionNote: (note: string) => void;
    ownerResponse: string;
    setOwnerResponse: (response: string) => void;
    isOwner?: boolean;
}> = ({
    ticket,
    onClose,
    onAcknowledge,
    onMarkInProgress,
    onResolve,
    onCloseTicket,
    onAddResponse,
    resolutionNote,
    setResolutionNote,
    ownerResponse,
    setOwnerResponse,
    isOwner = false
}) => {
    const getStatusBadge = (status: SupportTicket['status']) => {
        const badges = {
            pending: { label: 'في الانتظار', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
            acknowledged: { label: 'تم العلم', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
            in_progress: { label: 'جاري العمل', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
            resolved: { label: 'تم الحل', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
            closed: { label: 'مغلق', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
        };
        const badge = badges[status];
        return (
            <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${badge.color}`}>
                {badge.label}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <Mail className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">#{ticket.ticketNumber}</h2>
                                {getStatusBadge(ticket.status)}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Ticket Info */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">{ticket.title || 'طلب دعم فني'}</h3>
                            <p className="text-white/80 leading-relaxed">{ticket.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 rounded-xl">
                            <div>
                                <span className="text-white/60 text-sm">الفرع:</span>
                                <p className="text-white font-medium">{ticket.senderBranchName}</p>
                                <p className="text-white/50 text-xs">{ticket.senderBranchCode || ticket.senderBranchId}</p>
                            </div>
                            <div>
                                <span className="text-white/60 text-sm">الموظف:</span>
                                <p className="text-white font-medium">{ticket.senderName}</p>
                                {ticket.senderCode && <p className="text-white/50 text-xs">كود: {ticket.senderCode}</p>}
                            </div>
                            <div>
                                <span className="text-white/60 text-sm">رقم التواصل:</span>
                                <p className="text-white font-medium">{ticket.contactPhone}</p>
                            </div>
                            <div>
                                <span className="text-white/60 text-sm">التاريخ:</span>
                                <p className="text-white font-medium">
                                    {formatDateTimeGregorianEn(ticket.createdAt?.toDate ? ticket.createdAt.toDate() : ticket.createdAt, { showSeconds: false })}
                                </p>
                            </div>
                        </div>

                        {/* Attachments */}
                        {ticket.attachments && ticket.attachments.length > 0 && (
                            <div>
                                <span className="text-white/60 text-sm block mb-2">المرفقات:</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {ticket.attachments.map((url, index) => (
                                        <img
                                            key={index}
                                            src={url}
                                            alt={`Attachment ${index + 1}`}
                                            className="w-full h-24 object-cover rounded-lg"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Owner Response */}
                        {ticket.ownerResponse && (
                            <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
                                <span className="text-blue-400 text-sm font-medium">رد المالك:</span>
                                <p className="text-white mt-1">{ticket.ownerResponse}</p>
                                {ticket.ownerResponseAt && (
                                    <p className="text-white/50 text-xs mt-1">
                                        {formatDateTimeGregorianEn(ticket.ownerResponseAt.toDate ? ticket.ownerResponseAt.toDate() : ticket.ownerResponseAt, { showSeconds: false })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Resolution Note */}
                        {ticket.resolutionNote && (
                            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
                                <span className="text-green-400 text-sm font-medium">ملاحظة الحل:</span>
                                <p className="text-white mt-1">{ticket.resolutionNote}</p>
                                {ticket.resolvedAt && (
                                    <p className="text-white/50 text-xs mt-1">
                                        {formatDateTimeGregorianEn(ticket.resolvedAt.toDate ? ticket.resolvedAt.toDate() : ticket.resolvedAt, { showSeconds: false })}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Owner Response Input - Owner Only */}
                    {isOwner && onAddResponse && (
                        <div className="mb-4">
                            <label className="block text-sm text-white/60 mb-2">إضافة رد:</label>
                            <textarea
                                value={ownerResponse}
                                onChange={e => setOwnerResponse(e.target.value)}
                                placeholder="اكتب ردك هنا..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-yellow-500/50 focus:outline-none transition-all"
                            />
                            <button
                                onClick={() => onAddResponse(ticket.id)}
                                disabled={!ownerResponse.trim()}
                                className="mt-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all disabled:opacity-50"
                            >
                                إرسال الرد
                            </button>
                        </div>
                    )}

                    {/* Resolution Note Input - Owner Only */}
                    {isOwner && ticket.status !== 'closed' && (
                        <div className="mb-4">
                            <label className="block text-sm text-white/60 mb-2">ملاحظة الحل (عند الإغلاق):</label>
                            <textarea
                                value={resolutionNote}
                                onChange={e => setResolutionNote(e.target.value)}
                                placeholder="اكتب ملاحظة الحل..."
                                rows={2}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-yellow-500/50 focus:outline-none transition-all"
                            />
                        </div>
                    )}

                    {/* Actions - Owner Only */}
                    {isOwner && (
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            {ticket.status === 'pending' && onAcknowledge && (
                                <button
                                    onClick={() => onAcknowledge(ticket.id)}
                                    className="flex-1 py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    تم العلم
                                </button>
                            )}
                            {ticket.status === 'acknowledged' && onMarkInProgress && (
                                <button
                                    onClick={() => onMarkInProgress(ticket.id)}
                                    className="flex-1 py-3 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    <Clock className="w-5 h-5" />
                                    جاري العمل
                                </button>
                            )}
                            {ticket.status === 'in_progress' && (
                                <>
                                    {onResolve && (
                                        <button
                                            onClick={() => onResolve(ticket.id)}
                                            disabled={!resolutionNote.trim()}
                                            className="flex-1 py-3 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            تم الإصلاح
                                        </button>
                                    )}
                                    {onCloseTicket && (
                                        <button
                                            onClick={() => onCloseTicket(ticket.id)}
                                            className="flex-1 py-3 rounded-xl bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 transition-all flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-5 h-5" />
                                            إغلاق
                                        </button>
                                    )}
                                </>
                            )}
                            <button
                                onClick={onClose}
                                className="px-4 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-all"
                            >
                                إغلاق النافذة
                            </button>
                        </div>
                    )}
                    {/* Manager: Only close button */}
                    {!isOwner && (
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-all"
                            >
                                إغلاق
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
