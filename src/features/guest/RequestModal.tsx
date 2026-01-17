/**
 * Request Modal
 * Modal for guests to submit service requests
 * Uses unified GuestModal component for consistent design
 * Adora Hotel Management System V3
 */

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { createRequest } from '../../services/requestService';
import { Request } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { 
    GuestModal, 
    GuestButton, 
    GuestSuccessState 
} from '../../components/guest/GuestModal';

interface RequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceType: Request['type'];
    serviceName: string;
    roomNumber: string;
    tenantId: string; // ✅ SaaS Requirement
}

export const RequestModal: React.FC<RequestModalProps> = ({
    isOpen,
    onClose,
    serviceType,
    serviceName,
    roomNumber,
    tenantId,
}) => {
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const { isDark } = useTheme();

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // ✅ Use createRequest with tenantId
            await createRequest({
                type: serviceType as any, // Cast to avoid old/new enum mismatch
                roomNumber,
                guestName: 'ضيف الغرفة ' + roomNumber,
                details: {
                    notes: notes.trim() || 'لا توجد ملاحظات',
                },
                source: 'guest' as any,
                tenantId // ✅ Pass to service
            }, 'default', 'guest', 'Guest User');

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setNotes('');
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Failed to submit request:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <GuestModal
            isOpen={isOpen}
            onClose={onClose}
            title={success ? undefined : `طلب ${serviceName}`}
            subtitle={success ? undefined : `الغرفة ${roomNumber}`}
            size="md"
            position="bottom"
            showCloseButton={!success}
        >
            {/* Success State */}
            {success ? (
                <GuestSuccessState
                    icon={<Send className="w-10 h-10 text-green-400" />}
                    title="تم إرسال طلبك!"
                    message="سيقوم فريقنا بالتواصل معك قريباً"
                />
            ) : (
                <div className="space-y-6">
                    {/* Notes Input */}
                    <div>
                        <label className={`block text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            ملاحظات إضافية (اختياري)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="أضف أي تفاصيل تساعدنا في خدمتك بشكل أفضل..."
                            className={`
                                w-full min-h-[120px] resize-none px-4 py-3 rounded-xl
                                border-2 transition-all duration-200
                                focus:outline-none focus:border-teal-500
                                ${isDark 
                                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                                }
                            `}
                            dir="rtl"
                        />
                    </div>

                    {/* Submit Button */}
                    <GuestButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        fullWidth
                    >
                        <Send className="w-5 h-5" />
                        إرسال الطلب
                    </GuestButton>

                    {/* Info */}
                    <p className={`text-center text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        سيتم إشعارك عند تأكيد الطلب
                    </p>
                </div>
            )}
        </GuestModal>
    );
};

export default RequestModal;
