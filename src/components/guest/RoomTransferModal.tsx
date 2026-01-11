/**
 * Room Transfer Modal
 * Allows Reception/Bellman to transfer a guest to a different room
 * 
 * Features:
 * - Select new room from available rooms
 * - Add transfer reason
 * - Preview affected requests
 * - Confirm transfer with notifications to all departments
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    X, ArrowRight, ArrowLeftRight, AlertTriangle, Check, Loader2,
    BedDouble, User, Phone, FileText, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { transferGuestToRoom } from '../../services/roomTransferService';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface RoomTransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRoom: string;
    guestName?: string;
    guestIdentity?: string;
    guestPhone?: string;
    branchId: string;
    tenantId: string;
    onTransferComplete?: (newRoom: string) => void;
}

interface AvailableRoom {
    number: string;
    type: string;
    floor: string;
    status: 'available' | 'ready';
}

export const RoomTransferModal: React.FC<RoomTransferModalProps> = ({
    isOpen,
    onClose,
    currentRoom,
    guestName,
    guestIdentity,
    guestPhone,
    branchId,
    tenantId,
    onTransferComplete
}) => {
    const { user } = useAuth();
    const { haptic, success, error: showError } = useUX();

    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [reason, setReason] = useState('');
    const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
    const [affectedRequests, setAffectedRequests] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [transferring, setTransferring] = useState(false);
    const [step, setStep] = useState<'select' | 'confirm' | 'success'>('select');

    // Common transfer reasons
    const commonReasons = [
        'طلب الضيف',
        'ترقية الغرفة',
        'مشكلة في التكييف',
        'مشكلة في السباكة',
        'ضوضاء',
        'إطلالة أفضل',
        'قرب من المصعد',
        'سبب آخر'
    ];

    // Fetch available rooms
    useEffect(() => {
        if (!isOpen) return;

        const fetchAvailableRooms = async () => {
            setLoading(true);
            try {
                // Get rooms that are available (not occupied)
                const roomsRef = collection(db, 'rooms');
                const q = query(
                    roomsRef,
                    where('tenantId', '==', tenantId),
                    where('branchId', '==', branchId),
                    where('status', 'in', ['available', 'ready', 'clean'])
                );

                const snapshot = await getDocs(q);
                const rooms: AvailableRoom[] = snapshot.docs
                    .map(doc => ({
                        number: doc.data().roomNumber || doc.data().number,
                        type: doc.data().type || 'قياسي',
                        floor: doc.data().floor || '1',
                        status: doc.data().status
                    }))
                    .filter(r => r.number !== currentRoom);

                setAvailableRooms(rooms);
            } catch (err) {
                console.error('Error fetching available rooms:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchAvailableRooms();
    }, [isOpen, tenantId, branchId, currentRoom]);

    // Fetch affected requests count
    useEffect(() => {
        if (!isOpen) return;

        const fetchAffectedRequests = async () => {
            try {
                const requestsRef = collection(db, 'requests');
                const q = query(
                    requestsRef,
                    where('roomNumber', '==', currentRoom),
                    where('tenantId', '==', tenantId),
                    where('status', 'in', ['pending', 'in_progress', 'PENDING_RECEPTION', 'confirmed'])
                );

                const snapshot = await getDocs(q);
                setAffectedRequests(snapshot.size);
            } catch (err) {
                console.error('Error fetching affected requests:', err);
            }
        };

        fetchAffectedRequests();
    }, [isOpen, tenantId, currentRoom]);

    const handleTransfer = async () => {
        if (!selectedRoom || !user) return;

        setTransferring(true);
        haptic('medium');

        try {
            const result = await transferGuestToRoom(
                tenantId,
                branchId,
                currentRoom,
                selectedRoom,
                {
                    id: user.id,
                    name: user.name || 'موظف',
                    department: (user.department as any) || 'reception'
                },
                reason || 'تغيير الغرفة'
            );

            if (result.success) {
                setStep('success');
                haptic('success');
                success(`✅ تم نقل الضيف بنجاح إلى الغرفة ${selectedRoom}`);
                
                setTimeout(() => {
                    onTransferComplete?.(selectedRoom);
                    onClose();
                    // Reset state
                    setStep('select');
                    setSelectedRoom(null);
                    setReason('');
                }, 2000);
            } else {
                showError(result.error || 'فشل في نقل الغرفة');
                haptic('error');
            }
        } catch (err: any) {
            console.error('Transfer error:', err);
            showError(err.message || 'حدث خطأ أثناء النقل');
            haptic('error');
        } finally {
            setTransferring(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop - SOLID, NO BLUR per memory */}
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                className="relative w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
                style={{
                    background: 'var(--theme-bg-secondary)',
                    border: '1px solid var(--theme-border-primary)'
                }}
            >
                {/* Header */}
                <div className="p-4 border-b" style={{ borderColor: 'var(--theme-border-primary)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <ArrowLeftRight className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg" style={{ color: 'var(--theme-text-primary)' }}>
                                    نقل الضيف لغرفة أخرى
                                </h2>
                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    الغرفة الحالية: <span className="font-mono font-bold text-teal-400">{currentRoom}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Guest Info */}
                    {(guestName || guestIdentity || guestPhone) && (
                        <div
                            className="p-3 rounded-xl"
                            style={{ background: 'var(--theme-bg-tertiary)' }}
                        >
                            <p className="text-xs font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                بيانات الضيف
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {guestName && (
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                                        <User className="w-4 h-4 text-teal-400" />
                                        <span>{guestName}</span>
                                    </div>
                                )}
                                {guestPhone && (
                                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-primary)' }}>
                                        <Phone className="w-4 h-4 text-blue-400" />
                                        <span dir="ltr">{guestPhone}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 'select' && (
                        <>
                            {/* Select New Room */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    اختر الغرفة الجديدة <span className="text-red-400">*</span>
                                </label>

                                {loading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                                    </div>
                                ) : availableRooms.length === 0 ? (
                                    <div
                                        className="p-4 rounded-xl text-center"
                                        style={{ background: 'var(--theme-bg-tertiary)' }}
                                    >
                                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                                        <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                            لا توجد غرف متاحة حالياً
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                                        {availableRooms.map(room => (
                                            <button
                                                key={room.number}
                                                onClick={() => {
                                                    setSelectedRoom(room.number);
                                                    haptic('light');
                                                }}
                                                className={`p-3 rounded-xl text-center transition-all ${
                                                    selectedRoom === room.number
                                                        ? 'ring-2 ring-teal-400 bg-teal-500/20'
                                                        : 'hover:bg-white/10'
                                                }`}
                                                style={{
                                                    background: selectedRoom === room.number
                                                        ? undefined
                                                        : 'var(--theme-bg-tertiary)'
                                                }}
                                            >
                                                <BedDouble className={`w-5 h-5 mx-auto mb-1 ${
                                                    selectedRoom === room.number ? 'text-teal-400' : 'text-white/40'
                                                }`} />
                                                <span className={`font-mono font-bold text-sm ${
                                                    selectedRoom === room.number ? 'text-teal-400' : ''
                                                }`}
                                                    style={{ color: selectedRoom === room.number ? undefined : 'var(--theme-text-primary)' }}
                                                >
                                                    {room.number}
                                                </span>
                                                <p className="text-[10px]" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                    {room.type}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Transfer Reason */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    سبب النقل
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {commonReasons.map(r => (
                                        <button
                                            key={r}
                                            onClick={() => {
                                                setReason(r);
                                                haptic('light');
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                                                reason === r
                                                    ? 'bg-teal-500/20 text-teal-400 ring-1 ring-teal-400/50'
                                                    : 'hover:bg-white/10'
                                            }`}
                                            style={{
                                                background: reason === r ? undefined : 'var(--theme-bg-tertiary)',
                                                color: reason === r ? undefined : 'var(--theme-text-secondary)'
                                            }}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="أو اكتب سبباً مخصصاً..."
                                    className="w-full px-3 py-2 rounded-xl text-sm resize-none"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        border: '1px solid var(--theme-border-primary)',
                                        color: 'var(--theme-text-primary)'
                                    }}
                                    rows={2}
                                />
                            </div>

                            {/* Affected Requests Warning */}
                            {affectedRequests > 0 && (
                                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-orange-400">
                                                تنبيه: يوجد {affectedRequests} طلب نشط
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                سيتم نقل جميع الطلبات النشطة للغرفة الجديدة وإشعار جميع الأقسام
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Continue Button */}
                            <button
                                onClick={() => setStep('confirm')}
                                disabled={!selectedRoom}
                                className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                    selectedRoom
                                        ? 'bg-teal-500 text-white hover:bg-teal-600'
                                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                                }`}
                            >
                                متابعة
                                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                            </button>
                        </>
                    )}

                    {step === 'confirm' && (
                        <>
                            {/* Confirmation Summary */}
                            <div
                                className="p-4 rounded-xl text-center"
                                style={{ background: 'var(--theme-bg-tertiary)' }}
                            >
                                <div className="flex items-center justify-center gap-4 mb-4">
                                    <div className="text-center">
                                        <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>من</p>
                                        <div className="w-16 h-16 rounded-xl bg-red-500/20 flex items-center justify-center">
                                            <span className="text-xl font-mono font-bold text-red-400">{currentRoom}</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-8 h-8 text-teal-400 rtl:rotate-180" />
                                    <div className="text-center">
                                        <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إلى</p>
                                        <div className="w-16 h-16 rounded-xl bg-green-500/20 flex items-center justify-center">
                                            <span className="text-xl font-mono font-bold text-green-400">{selectedRoom}</span>
                                        </div>
                                    </div>
                                </div>

                                {reason && (
                                    <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <FileText className="w-4 h-4" />
                                        <span>{reason}</span>
                                    </div>
                                )}
                            </div>

                            {/* What will happen */}
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <div className="flex items-start gap-2">
                                    <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs space-y-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <p className="font-medium text-blue-400 text-sm">عند التأكيد سيحدث التالي:</p>
                                        <ul className="space-y-1 mr-2">
                                            <li>• نقل جلسة الضيف للغرفة الجديدة</li>
                                            {affectedRequests > 0 && (
                                                <li>• نقل {affectedRequests} طلب نشط للغرفة الجديدة</li>
                                            )}
                                            <li>• إشعار فوري لجميع الأقسام بالنقل</li>
                                            <li>• تحديث بيانات الضيف على جهازه تلقائياً</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Confirm/Cancel Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setStep('select')}
                                    className="flex-1 py-3 rounded-xl font-medium transition-colors"
                                    style={{
                                        background: 'var(--theme-bg-tertiary)',
                                        color: 'var(--theme-text-secondary)'
                                    }}
                                >
                                    رجوع
                                </button>
                                <button
                                    onClick={handleTransfer}
                                    disabled={transferring}
                                    className="flex-1 py-3 rounded-xl font-bold bg-orange-500 text-white hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    {transferring ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            جاري النقل...
                                        </>
                                    ) : (
                                        <>
                                            <ArrowLeftRight className="w-4 h-4" />
                                            تأكيد النقل
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}

                    {step === 'success' && (
                        <div className="py-8 text-center">
                            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-in zoom-in">
                                <Check className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-green-400 mb-2">
                                تم النقل بنجاح! ✅
                            </h3>
                            <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                تم نقل الضيف من الغرفة {currentRoom} إلى {selectedRoom}
                            </p>
                            <p className="text-xs mt-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                تم إشعار جميع الأقسام بالتغيير
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomTransferModal;
