/**
 * WhatsApp Message Modal
 * Allows reception staff to send WhatsApp messages to guests using templates
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { X, Send, MessageCircle, User, Phone, Building2, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import {
    subscribeToActiveTemplates,
    sendWhatsAppMessage,
    type WhatsAppTemplate,
    type TemplateVariable
} from '../../services/whatsappTemplatesService';
import { useUX } from '../../context/UXContext';

interface WhatsAppMessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId?: string;
    branchName?: string;
    branchNumber?: string;
    defaultRoomNumber?: string; // Pre-fill room number if provided
    rooms?: { floor: number; rooms: string[] }[]; // For room selection
}

interface MessageQueueItem {
    id: string;
    roomNumber: string;
    guestFirstName: string;
    guestPhoneNumber: string;
    templateId: string;
    templateName: string;
    variables?: Record<string, any>;
    sendOnce: boolean; // If true, this message was marked to send once
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
    isOpen,
    onClose,
    branchId,
    branchName,
    branchNumber,
    defaultRoomNumber,
    rooms
}) => {
    const { user } = useAuth();
    const { tenantId } = useTenant();
    const { success, error } = useUX();

    const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Current message form
    const [roomNumber, setRoomNumber] = useState(defaultRoomNumber || '');
    const [guestFirstName, setGuestFirstName] = useState('');
    const [guestPhoneNumber, setGuestPhoneNumber] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
    const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
    
    // Message queue for multiple rooms
    const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
    const [showQueue, setShowQueue] = useState(false);
    
    // Room selection
    const [showRoomSelector, setShowRoomSelector] = useState(false);

    useEffect(() => {
        if (!isOpen || !tenantId) return;

        const unsubscribe = subscribeToActiveTemplates(
            tenantId,
            branchId,
            (templatesList) => {
                setTemplates(templatesList);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [isOpen, tenantId, branchId]);

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setRoomNumber(defaultRoomNumber || '');
            setGuestFirstName('');
            setGuestPhoneNumber('');
            setSelectedTemplate(null);
            setTemplateVariables({});
            setMessageQueue([]);
            setShowQueue(false);
        }
    }, [isOpen, defaultRoomNumber]);

    // Load guest info when room number changes
    useEffect(() => {
        if (!roomNumber || !tenantId || !branchId) return;

        // Try to fetch guest info from active room cards
        const loadGuestInfo = async () => {
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const { db } = await import('../../services/firebase');
                
                // Check room cards
                const roomCardsRef = collection(db, 'room_cards');
                const roomCardsQuery = query(
                    roomCardsRef,
                    where('roomNumber', '==', roomNumber),
                    where('branchId', '==', branchId),
                    where('tenantId', '==', tenantId),
                    where('status', '==', 'active')
                );
                const roomCardsSnap = await getDocs(roomCardsQuery);

                if (!roomCardsSnap.empty) {
                    const roomCard = roomCardsSnap.docs[0].data();
                    if (roomCard.guestName) {
                        const firstName = roomCard.guestName.split(' ')[0] || roomCard.guestName;
                        setGuestFirstName(firstName);
                    }
                    if (roomCard.guestPhone) {
                        setGuestPhoneNumber(roomCard.guestPhone);
                    }
                }
            } catch (err) {
                console.error('Error loading guest info:', err);
            }
        };

        loadGuestInfo();
    }, [roomNumber, tenantId, branchId]);

    const handleAddToQueue = (sendOnce: boolean = false) => {
        if (!roomNumber || !guestFirstName || !guestPhoneNumber || !selectedTemplate) {
            error('يرجى إكمال جميع الحقول');
            return;
        }

        // Validate template variables
        if (selectedTemplate.variables) {
            for (const variable of selectedTemplate.variables) {
                if (variable.required && !templateVariables[variable.key]) {
                    error(`يرجى إدخال ${variable.labelAr}`);
                    return;
                }
            }
        }

        // If sendOnce is true, check if room already exists in queue with any template
        if (sendOnce) {
            const existingIndex = messageQueue.findIndex(
                item => item.roomNumber === roomNumber && item.sendOnce
            );

            if (existingIndex !== -1) {
                // Replace existing entry with new one
                const newQueue = [...messageQueue];
                newQueue[existingIndex] = {
                    id: Date.now().toString(),
                    roomNumber,
                    guestFirstName,
                    guestPhoneNumber,
                    templateId: selectedTemplate.id,
                    templateName: selectedTemplate.nameAr || selectedTemplate.name,
                    variables: { ...templateVariables },
                    sendOnce: true
                };
                setMessageQueue(newQueue);
                success('تم تحديث الرسالة للغرفة (إرسال مرة واحدة)');
            } else {
                // Add new entry
                const queueItem: MessageQueueItem = {
                    id: Date.now().toString(),
                    roomNumber,
                    guestFirstName,
                    guestPhoneNumber,
                    templateId: selectedTemplate.id,
                    templateName: selectedTemplate.nameAr || selectedTemplate.name,
                    variables: { ...templateVariables },
                    sendOnce: true
                };
                setMessageQueue([...messageQueue, queueItem]);
                success('تمت الإضافة إلى قائمة الإرسال (إرسال مرة واحدة)');
            }
        } else {
            // Normal add (can have multiple templates for same room)
            const queueItem: MessageQueueItem = {
                id: Date.now().toString(),
                roomNumber,
                guestFirstName,
                guestPhoneNumber,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.nameAr || selectedTemplate.name,
                variables: { ...templateVariables },
                sendOnce: false
            };

            setMessageQueue([...messageQueue, queueItem]);
            success('تمت الإضافة إلى قائمة الإرسال');
        }
        
        // Reset form
        setRoomNumber('');
        setGuestFirstName('');
        setGuestPhoneNumber('');
        setSelectedTemplate(null);
        setTemplateVariables({});
        
        setShowQueue(true);
    };

    const handleRemoveFromQueue = (id: string) => {
        setMessageQueue(messageQueue.filter(item => item.id !== id));
    };

    const handleSendAll = async () => {
        if (messageQueue.length === 0) {
            error('لا توجد رسائل في قائمة الإرسال');
            return;
        }

        if (!user || !tenantId || !selectedTemplate) return;

        try {
            let successCount = 0;
            let failCount = 0;

            for (const queueItem of messageQueue) {
                try {
                    const template = templates.find(t => t.id === queueItem.templateId);
                    if (!template) continue;

                    await sendWhatsAppMessage(
                        tenantId,
                        template,
                        {
                            roomNumber: queueItem.roomNumber,
                            guestFirstName: queueItem.guestFirstName,
                            guestPhoneNumber: queueItem.guestPhoneNumber,
                            branchId: branchId || '',
                            branchName: branchName,
                            branchNumber: branchNumber,
                            variables: queueItem.variables
                        },
                        user.id,
                        user.name || 'موظف'
                    );

                    successCount++;
                    
                    // Small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (err) {
                    console.error('Error sending message:', err);
                    failCount++;
                }
            }

            if (successCount > 0) {
                success(`تم إرسال ${successCount} رسالة بنجاح${failCount > 0 ? ` (${failCount} فشلت)` : ''}`);
            }

            // Clear queue
            setMessageQueue([]);
            setShowQueue(false);
            
            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            error('فشل إرسال الرسائل');
        }
    };

    const handleSendSingle = async () => {
        if (!roomNumber || !guestFirstName || !guestPhoneNumber || !selectedTemplate) {
            error('يرجى إكمال جميع الحقول');
            return;
        }

        // Validate template variables
        if (selectedTemplate.variables) {
            for (const variable of selectedTemplate.variables) {
                if (variable.required && !templateVariables[variable.key]) {
                    error(`يرجى إدخال ${variable.labelAr}`);
                    return;
                }
            }
        }

        if (!user || !tenantId) return;

        try {
            await sendWhatsAppMessage(
                tenantId,
                selectedTemplate,
                {
                    roomNumber,
                    guestFirstName,
                    guestPhoneNumber,
                    branchId: branchId || '',
                    branchName: branchName,
                    branchNumber: branchNumber,
                    variables: templateVariables
                },
                user.id,
                user.name || 'موظف'
            );

            success('تم إرسال الرسالة بنجاح');
            
            // Reset form
            setRoomNumber('');
            setGuestFirstName('');
            setGuestPhoneNumber('');
            setSelectedTemplate(null);
            setTemplateVariables({});
            
            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            error('فشل إرسال الرسالة');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="w-full max-w-md sm:max-w-lg lg:max-w-2xl 3xl:max-w-4xl 4xl:max-w-5xl max-h-[90vh] overflow-hidden rounded-xl sm:rounded-2xl 3xl:rounded-3xl modal-enter flex flex-col" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">إرسال رسالة WhatsApp</h2>
                            <p className="text-sm text-white/60">إرسال رسائل للضيوف عبر WhatsApp</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Template Selection */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">صيغة الرسالة *</label>
                                <select
                                    value={selectedTemplate?.id || ''}
                                    onChange={(e) => {
                                        const template = templates.find(t => t.id === e.target.value);
                                        setSelectedTemplate(template || null);
                                        setTemplateVariables({}); // Reset variables
                                    }}
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                >
                                    <option value="">اختر صيغة الرسالة</option>
                                    {templates.map(template => (
                                        <option key={template.id} value={template.id}>
                                            {template.nameAr || template.name}
                                            {template.description && ` - ${template.description}`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Room Number */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">رقم الغرفة *</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={roomNumber}
                                        onChange={(e) => setRoomNumber(e.target.value)}
                                        placeholder="101"
                                        className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                    />
                                    {rooms && rooms.length > 0 && (
                                        <button
                                            onClick={() => setShowRoomSelector(true)}
                                            className="px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/20 transition-colors"
                                            title="اختر الغرفة"
                                        >
                                            <Building2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Guest First Name */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">اسم النزيل الأول *</label>
                                <input
                                    type="text"
                                    value={guestFirstName}
                                    onChange={(e) => setGuestFirstName(e.target.value)}
                                    placeholder="أحمد"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                />
                            </div>

                            {/* Guest Phone Number */}
                            <div>
                                <label className="block text-sm text-white/60 mb-2">رقم الهاتف *</label>
                                <input
                                    type="tel"
                                    value={guestPhoneNumber}
                                    onChange={(e) => setGuestPhoneNumber(e.target.value)}
                                    placeholder="966501234567"
                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                />
                                <p className="text-xs text-white/40 mt-1">أدخل الرقم مع رمز الدولة (مثال: 966501234567)</p>
                            </div>

                            {/* Template Variables */}
                            {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
                                <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                                    <h3 className="text-white font-semibold text-sm mb-3">تفاصيل إضافية:</h3>
                                    {selectedTemplate.variables.map(variable => (
                                        <div key={variable.key}>
                                            <label className="block text-sm text-white/60 mb-2">
                                                {variable.labelAr} {variable.required && <span className="text-red-400">*</span>}
                                            </label>
                                            {variable.type === 'time' ? (
                                                <input
                                                    type="time"
                                                    value={templateVariables[variable.key] || ''}
                                                    onChange={(e) => setTemplateVariables({
                                                        ...templateVariables,
                                                        [variable.key]: e.target.value
                                                    })}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                                    required={variable.required}
                                                />
                                            ) : variable.type === 'date' ? (
                                                <input
                                                    type="date"
                                                    value={templateVariables[variable.key] || ''}
                                                    onChange={(e) => setTemplateVariables({
                                                        ...templateVariables,
                                                        [variable.key]: e.target.value
                                                    })}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                                    required={variable.required}
                                                />
                                            ) : variable.type === 'datetime' ? (
                                                <input
                                                    type="datetime-local"
                                                    value={templateVariables[variable.key] || ''}
                                                    onChange={(e) => setTemplateVariables({
                                                        ...templateVariables,
                                                        [variable.key]: e.target.value
                                                    })}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                                    required={variable.required}
                                                />
                                            ) : (
                                                <input
                                                    type={variable.type === 'number' ? 'number' : 'text'}
                                                    value={templateVariables[variable.key] || ''}
                                                    onChange={(e) => setTemplateVariables({
                                                        ...templateVariables,
                                                        [variable.key]: e.target.value
                                                    })}
                                                    placeholder={variable.placeholder || variable.labelAr}
                                                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white focus:border-green-500/50 focus:outline-none transition-all"
                                                    required={variable.required}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Message Preview */}
                            {selectedTemplate && roomNumber && guestFirstName && (
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
                                    <h3 className="text-green-400 font-semibold text-sm mb-2">معاينة الرسالة:</h3>
                                    <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                                        {selectedTemplate.messageFormatAr
                                            .replace(/{guestName}/g, guestFirstName)
                                            .replace(/{roomNumber}/g, roomNumber)
                                            .replace(/{branchName}/g, branchName || '')
                                            .replace(/{branchNumber}/g, branchNumber || '')
                                            .replace(/{(\w+)}/g, (match, key) => {
                                                return templateVariables[key] || match;
                                            })}
                                    </p>
                                </div>
                            )}

                            {/* Message Queue */}
                            {showQueue && messageQueue.length > 0 && (
                                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-blue-400 font-semibold text-sm">قائمة الإرسال ({messageQueue.length})</h3>
                                        <button
                                            onClick={() => {
                                                setMessageQueue([]);
                                                setShowQueue(false);
                                            }}
                                            className="text-xs text-white/60 hover:text-white"
                                        >
                                            مسح الكل
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {messageQueue.map(item => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center justify-between p-2 rounded-lg ${
                                                    item.sendOnce 
                                                        ? 'bg-purple-500/10 border border-purple-500/30' 
                                                        : 'bg-white/5'
                                                }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white text-sm font-medium">
                                                            غرفة {item.roomNumber}
                                                        </span>
                                                        {item.sendOnce && (
                                                            <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs">
                                                                مرة واحدة
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-white/60 text-xs mt-1">
                                                        {item.guestFirstName} - {item.templateName}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveFromQueue(item.id)}
                                                    className="p-1 rounded-lg hover:bg-red-500/20 text-red-400"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-white/40 mt-2 text-center">
                                        💡 الرسائل المميزة بالبنفسجي يتم إرسالها مرة واحدة فقط للغرفة
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 space-y-3 flex-shrink-0">
                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                        >
                            إلغاء
                        </button>
                        {!showQueue && (
                            <>
                                <button
                                    onClick={() => handleAddToQueue(false)}
                                    disabled={!roomNumber || !guestFirstName || !guestPhoneNumber || !selectedTemplate}
                                    className="px-4 py-3 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="إضافة إلى قائمة الإرسال"
                                >
                                    إضافة
                                </button>
                                <button
                                    onClick={() => handleAddToQueue(true)}
                                    disabled={!roomNumber || !guestFirstName || !guestPhoneNumber || !selectedTemplate}
                                    className="px-4 py-3 rounded-xl bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    title="إضافة (إرسال مرة واحدة للغرفة)"
                                >
                                    <Send className="w-4 h-4" />
                                    إرسال مرة واحدة
                                </button>
                            </>
                        )}
                        {showQueue && messageQueue.length > 0 && (
                            <button
                                onClick={handleSendAll}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                إرسال الكل ({messageQueue.length})
                            </button>
                        )}
                        {!showQueue && (
                            <button
                                onClick={handleSendSingle}
                                disabled={!roomNumber || !guestFirstName || !guestPhoneNumber || !selectedTemplate}
                                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-bold hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                                إرسال
                            </button>
                        )}
                    </div>
                    
                    {/* Help Text */}
                    {!showQueue && (
                        <p className="text-xs text-white/40 text-center">
                            💡 يمكنك إضافة رسائل متعددة لغرف مختلفة في قائمة الإرسال
                        </p>
                    )}
                </div>
            </div>

            {/* Room Selector Modal */}
            {showRoomSelector && rooms && (
                <RoomSelectorModal
                    rooms={rooms.flatMap(f => f.rooms)}
                    selectedRoom={roomNumber}
                    onSelect={(room) => {
                        setRoomNumber(room);
                        setShowRoomSelector(false);
                    }}
                    onClose={() => setShowRoomSelector(false)}
                />
            )}
        </div>
    );
};

// Room Selector Modal Component
const RoomSelectorModal: React.FC<{
    rooms: string[];
    selectedRoom: string;
    onSelect: (room: string) => void;
    onClose: () => void;
}> = ({ rooms, selectedRoom, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
            <div className="w-full max-w-md rounded-2xl modal-enter" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">اختر الغرفة</h3>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                        {rooms.map(room => (
                            <button
                                key={room}
                                onClick={() => onSelect(room)}
                                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                                    selectedRoom === room
                                        ? 'bg-green-500 text-white'
                                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                                }`}
                            >
                                {room}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
