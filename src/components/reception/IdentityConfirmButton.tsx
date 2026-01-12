/**
 * Identity Confirm Button
 * A button component for reception to confirm guest identity before processing requests
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, AlertTriangle, Loader2, Eye, EyeOff, Phone, IdCard } from 'lucide-react';
import { fetchGuestInfoForReception, confirmGuestIdentity } from '../../services/identityCheckService';
import { useToast } from '../../context/ToastContext';

// ============================================================
// TYPES
// ============================================================

interface IdentityConfirmButtonProps {
    tenantId: string;
    branchId: string;
    roomNumber: string;
    requestId: string;
    guestName?: string;
    userId: string;
    userName: string;
    onConfirmed: () => void;
    disabled?: boolean;
    className?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export const IdentityConfirmButton: React.FC<IdentityConfirmButtonProps> = ({
    tenantId,
    branchId,
    roomNumber,
    requestId,
    guestName,
    userId,
    userName,
    onConfirmed,
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingInfo, setFetchingInfo] = useState(false);
    const [guestInfo, setGuestInfo] = useState<{
        guestName: string;
        guestPhone: string;
        guestIdentity: string;
    } | null>(null);
    const [showPhone, setShowPhone] = useState(false);
    const [showIdentity, setShowIdentity] = useState(false);
    
    const { success, error } = useToast();

    // ============================================================
    // FETCH GUEST INFO
    // ============================================================

    const handleOpenModal = async () => {
        setIsOpen(true);
        setFetchingInfo(true);
        
        try {
            const info = await fetchGuestInfoForReception(tenantId, branchId, roomNumber);
            setGuestInfo(info);
        } catch (err) {
            console.error('Error fetching guest info:', err);
        } finally {
            setFetchingInfo(false);
        }
    };

    // ============================================================
    // CONFIRM IDENTITY
    // ============================================================

    const handleConfirmIdentity = async () => {
        setLoading(true);
        
        try {
            const result = await confirmGuestIdentity(
                tenantId,
                branchId,
                roomNumber,
                requestId,
                { id: userId, name: userName },
                guestInfo?.guestName || guestName || 'نزيل'
            );

            if (result.success) {
                success('تم تأكيد هوية النزيل ✓');
                setIsOpen(false);
                onConfirmed();
            } else {
                error(result.message);
            }
        } catch (err) {
            error('فشل تأكيد الهوية');
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // HELPERS
    // ============================================================

    const maskPhone = (phone: string): string => {
        if (!phone) return '---';
        if (showPhone) return phone;
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 4) return '****';
        return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
    };

    const maskIdentity = (identity: string): string => {
        if (!identity) return '---';
        if (showIdentity) return identity;
        if (identity.length < 4) return '****';
        return `${'*'.repeat(identity.length - 4)}${identity.slice(-4)}`;
    };

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={handleOpenModal}
                disabled={disabled}
                className={`
                    flex items-center justify-center gap-2 px-4 py-2.5 
                    bg-gradient-to-r from-teal-500 to-cyan-600 
                    text-white font-medium rounded-xl
                    hover:from-teal-400 hover:to-cyan-500
                    active:scale-95 transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg shadow-teal-500/25
                    ${className}
                `}
            >
                <Shield className="w-5 h-5" />
                <span>تأكيد الهوية</span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !loading && setIsOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 flex items-center justify-center">
                                    <UserCheck className="w-6 h-6 text-teal-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">تأكيد هوية النزيل</h3>
                                    <p className="text-white/50 text-sm">غرفة {roomNumber}</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            {fetchingInfo ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
                                </div>
                            ) : guestInfo ? (
                                <>
                                    {/* Guest Name */}
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <p className="text-white/50 text-xs mb-1">اسم النزيل</p>
                                        <p className="text-white font-bold text-lg">
                                            {guestInfo.guestName || guestName || 'غير محدد'}
                                        </p>
                                    </div>

                                    {/* Guest Phone */}
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-white/50 text-xs flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                رقم الجوال
                                            </p>
                                            <button 
                                                onClick={() => setShowPhone(!showPhone)}
                                                className="text-teal-400 hover:text-teal-300"
                                            >
                                                {showPhone ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-white font-mono text-lg" dir="ltr">
                                            {maskPhone(guestInfo.guestPhone)}
                                        </p>
                                    </div>

                                    {/* Guest Identity */}
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-white/50 text-xs flex items-center gap-1">
                                                <IdCard className="w-3 h-3" />
                                                رقم الهوية/الجواز
                                            </p>
                                            <button 
                                                onClick={() => setShowIdentity(!showIdentity)}
                                                className="text-teal-400 hover:text-teal-300"
                                            >
                                                {showIdentity ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-white font-mono text-lg" dir="ltr">
                                            {maskIdentity(guestInfo.guestIdentity)}
                                        </p>
                                    </div>

                                    {/* Warning */}
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-amber-200 text-sm">
                                            تأكد من مطابقة بيانات النزيل قبل تأكيد الهوية. 
                                            سيتم تسجيل اسمك كمؤكد للهوية.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
                                    <p className="text-red-300 text-center">
                                        لم يتم العثور على بيانات النزيل. 
                                        تأكد من أن الغرفة مشغولة وبطاقة النزيل مفعلة.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t border-white/10 flex gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                disabled={loading}
                                className="flex-1 py-3 px-4 rounded-xl bg-white/5 text-white/70 font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleConfirmIdentity}
                                disabled={loading || !guestInfo}
                                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold flex items-center justify-center gap-2 hover:from-green-400 hover:to-emerald-500 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-green-500/25"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <UserCheck className="w-5 h-5" />
                                        <span>تأكيد الهوية</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default IdentityConfirmButton;
