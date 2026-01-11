/**
 * Support Ticket Modal
 * Allows employees/managers to create support tickets
 * Adora Hotel Management System V2
 */

import React, { useState } from 'react';
import { X, Send, Phone, MessageSquare, AlertCircle, FileText, Camera } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { createSupportTicket } from '../../services/supportTicketService';
import { uploadFileToImgBB } from '../../services/imageUploadService';

interface SupportTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    branchName: string;
}

export const SupportTicketModal: React.FC<SupportTicketModalProps> = ({
    isOpen,
    onClose,
    branchId,
    branchName
}) => {
    const { user } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [category, setCategory] = useState<'technical' | 'billing' | 'feature' | 'bug' | 'other'>('technical');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        try {
            const uploadPromises = Array.from(files).map(file => uploadFileToImgBB(file));
            const results = await Promise.all(uploadPromises);
            // Filter successful uploads and extract URLs
            const successfulUrls = results
                .filter(r => r.success && r.url)
                .map(r => r.url as string);
            setAttachments([...attachments, ...successfulUrls]);
            success('تم رفع الصور بنجاح');
        } catch (err) {
            error('فشل رفع الصور');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async () => {
        if (!contactPhone.trim()) {
            error('يرجى إدخال رقم التواصل');
            return;
        }
        if (!description.trim()) {
            error('يرجى إدخال وصف المشكلة');
            return;
        }

        if (!user || !tenantId) {
            error('خطأ في البيانات');
            return;
        }

        setSubmitting(true);
        try {
            await createSupportTicket(
                {
                    title: title || 'طلب دعم فني',
                    description,
                    category,
                    priority,
                    contactPhone,
                    senderId: user.id,
                    senderName: user.name || 'غير معروف',
                    senderCode: (user as any).code || (user as any).employeeCode || undefined,
                    senderRole: user.role || user.department || 'staff',
                    senderBranchId: branchId,
                    senderBranchName: branchName,
                    senderBranchCode: (user as any).branchCode || undefined,
                    tenantId,
                    attachments: attachments.length > 0 ? attachments : undefined
                },
                user.id,
                user.name || 'غير معروف'
            );

            success('تم إرسال التذكرة بنجاح. سنتواصل معك قريباً');
            // Reset form
            setTitle('');
            setDescription('');
            setContactPhone('');
            setCategory('technical');
            setPriority('medium');
            setAttachments([]);
            onClose();
        } catch (err) {
            error('فشل إرسال التذكرة');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-md sm:max-w-lg lg:max-w-2xl 3xl:max-w-4xl 4xl:max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl 3xl:rounded-3xl modal-enter">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">دعم فني</h2>
                                <p className="text-sm text-white/60">طلب مساعدة أو إبلاغ عن مشكلة</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/60 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Contact Phone (Required) */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2 flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                رقم التواصل <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="tel"
                                value={contactPhone}
                                onChange={e => setContactPhone(e.target.value)}
                                placeholder="05xxxxxxxx"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                نوع المشكلة
                            </label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value as any)}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none transition-all"
                            >
                                <option value="technical">مشكلة تقنية</option>
                                <option value="billing">مشكلة في الفوترة</option>
                                <option value="feature">طلب ميزة جديدة</option>
                                <option value="bug">بلاغ عن خلل</option>
                                <option value="other">أخرى</option>
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                الأولوية
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { value: 'low', label: 'منخفضة', color: 'blue' },
                                    { value: 'medium', label: 'متوسطة', color: 'yellow' },
                                    { value: 'high', label: 'عالية', color: 'orange' },
                                    { value: 'urgent', label: 'عاجلة', color: 'red' }
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setPriority(opt.value as any)}
                                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                            priority === opt.value
                                                ? `bg-${opt.color}-500/20 text-${opt.color}-400 border border-${opt.color}-500/30`
                                                : 'bg-white/10 text-white/60 border border-white/10 hover:bg-white/20'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title (Optional) */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2">عنوان المشكلة (اختياري)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="مثال: مشكلة في تسجيل الدخول"
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none transition-all"
                            />
                        </div>

                        {/* Description (Required) */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                وصف المشكلة <span className="text-red-400">*</span>
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="يرجى وصف المشكلة بالتفصيل..."
                                rows={5}
                                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white resize-none focus:border-yellow-500/50 focus:outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Attachments */}
                        <div>
                            <label className="block text-sm text-white/60 mb-2 flex items-center gap-2">
                                <Camera className="w-4 h-4" />
                                مرفقات (اختياري)
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full py-3 px-4 rounded-xl bg-white/10 border border-white/10 text-white/60 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Camera className="w-5 h-5" />
                                {uploading ? 'جاري الرفع...' : 'رفع صور'}
                            </button>
                            {attachments.length > 0 && (
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {attachments.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={url}
                                                alt={`Attachment ${index + 1}`}
                                                className="w-full h-20 object-cover rounded-lg"
                                            />
                                            <button
                                                onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                                                className="absolute top-1 right-1 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !contactPhone.trim() || !description.trim()}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold hover:shadow-lg hover:shadow-yellow-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        جاري الإرسال...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        إرسال التذكرة
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
