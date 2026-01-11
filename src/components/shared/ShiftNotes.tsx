/**
 * Enhanced Shift Notes Modal
 * Uses shiftNotesService for room-based notes with archive on checkout
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, MessageSquare, Send, Archive, Bell, Filter, DoorOpen, Map, CheckCircle2, Mic, MicOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';
import { useFeatureGate } from '../../hooks/useFeatureGate';
import * as ShiftNotesService from '../../services/shiftNotesService';
import { useVoiceInput } from '../../services/voiceInputService';
import { FloorRoomSelector } from './FloorRoomSelector';
import { useTenantRooms } from '../../hooks/useTenantData';

// ============================================================
// TYPES
// ============================================================

interface ShiftNotesProps {
    isOpen: boolean;
    onClose: () => void;
    roomNumber?: string; // Optional: filter by specific room
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const ShiftNotes: React.FC<ShiftNotesProps> = ({ isOpen, onClose, roomNumber }) => {
    const { user, branchId: authBranchId } = useAuth();
    
    // ✅ Feature Gate: Check if shift notes feature is enabled
    const { isEnabled: isShiftNotesEnabled } = useFeatureGate('shiftNotes');

    // State - ALL hooks must be called before any conditional returns
    const [notes, setNotes] = useState<ShiftNotesService.ShiftNote[]>([]);
    const [newNote, setNewNote] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(roomNumber || '');
    const [priority, setPriority] = useState<ShiftNotesService.NotePriority>('normal');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [filterRoom, setFilterRoom] = useState('');
    const [showRoomSelector, setShowRoomSelector] = useState(false);

    const { rooms } = useTenantRooms();

    // 🎤 VOICE INPUT INTEGRATION
    const { listening, toggle: toggleVoice, transcript, clear: clearVoice } = useVoiceInput({
        onResult: (text, isFinal) => {
            if (!isFinal) return;

            // Intelligence: Detect if user said a room number
            // Patterns: "Room 101", "Ghorfa 101", "101"
            const roomMatch = text.match(/\d{3,4}/);

            if (roomMatch) {
                // If text is MOSTLY just a number, treat as Room Selection
                if (text.length < 10) {
                    setSelectedRoom(roomMatch[0]);
                    playSound('success');
                    haptic('success');
                } else {
                    // Otherwise, append to note content
                    setNewNote(prev => prev ? prev + ' ' + text : text);
                }
            } else {
                // No number? Just content
                setNewNote(prev => prev ? prev + ' ' + text : text);
            }

            clearVoice();
        }
    });

    // Session context
    const session: ShiftNotesService.SessionContext | null = useMemo(() => {
        if (!user) return null;
        return {
            // ✅ SaaS: Use tenantId for hotelId field in service
            hotelId: (user as any).tenantId || 'default',
            branchId: authBranchId || (user as any).branchId || (user as any).branch || 'default'
        };
    }, [user, authBranchId]);

    // Load notes on open
    useEffect(() => {
        if (isOpen && session && isShiftNotesEnabled) {
            loadNotes();
        }
    }, [isOpen, session, viewMode, isShiftNotesEnabled]);

    // Real-time subscription
    useEffect(() => {
        if (!isOpen || !session || !isShiftNotesEnabled) return;

        const unsubscribe = ShiftNotesService.subscribeToActiveNotes(session, (activeNotes) => {
            if (viewMode === 'active') {
                setNotes(activeNotes);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [isOpen, session, viewMode, isShiftNotesEnabled]);

    const loadNotes = async () => {
        if (!session) return;
        setLoading(true);

        try {
            if (viewMode === 'active') {
                const activeNotes = await ShiftNotesService.getActiveNotes(session);
                setNotes(activeNotes);
            } else {
                const archivedNotes = await ShiftNotesService.getArchivedNotes(session, 50);
                setNotes(archivedNotes);
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            setLoading(false);
        }
    };

    // Group notes by room
    const groupedNotes = useMemo(() => {
        const filtered = filterRoom
            ? notes.filter(n => n.roomNumber?.includes(filterRoom))
            : notes;

        const groups: Record<string, ShiftNotesService.ShiftNote[]> = {};

        filtered.forEach(note => {
            const key = note.roomNumber || 'عام';
            if (!groups[key]) groups[key] = [];
            groups[key].push(note);
        });

        return groups;
    }, [notes, filterRoom]);

    const unreadCount = useMemo(() => {
        if (!user) return 0;
        return notes.filter(n => !n.readBy?.includes(user.id || '')).length;
    }, [notes, user]);
    
    // ✅ Hide component if feature is disabled or not open - AFTER all hooks
    if (!isShiftNotesEnabled || !isOpen) {
        return null;
    }

    const addNote = async () => {
        if (!newNote.trim() || !session || submitting) return;

        setSubmitting(true);
        try {
            await ShiftNotesService.createShiftNote(session, {
                roomNumber: selectedRoom || '',
                content: newNote.trim(),
                priority,
                createdBy: { id: user?.id || '', name: user?.name || '' }
            });

            setNewNote('');
            setSelectedRoom('');
            setPriority('normal');

            haptic('success');
            playSound('notification');
        } catch (error) {
            console.error('Failed to add note:', error);
            haptic('error');
        } finally {
            setSubmitting(false);
        }
    };

    const markAsRead = async (noteId: string) => {
        if (!session || !user) return;

        try {
            await ShiftNotesService.markNoteAsRead(session, noteId, user.id || '');
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-md sm:max-w-lg lg:max-w-2xl 3xl:max-w-4xl 4xl:max-w-5xl max-h-[85vh] flex flex-col rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-white" />
                            </div>
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">ملاحظات الشيفت</h3>
                            <p className="text-sm text-white/50">{notes.length} ملاحظة</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-3 border-b border-white/10">
                    <button
                        onClick={() => setViewMode('active')}
                        className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'active'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                    >
                        <Bell className="w-4 h-4" />
                        نشطة
                    </button>
                    <button
                        onClick={() => setViewMode('archived')}
                        className={`flex-1 py-2 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${viewMode === 'archived'
                            ? 'bg-gray-500 text-white'
                            : 'bg-white/10 text-white/60 hover:bg-white/20'
                            }`}
                    >
                        <Archive className="w-4 h-4" />
                        أرشيف
                    </button>
                </div>

                {/* Filter */}
                <div className="p-3 border-b border-white/10">
                    <div className="relative">
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={filterRoom}
                            onChange={(e) => setFilterRoom(e.target.value)}
                            placeholder="بحث برقم الغرفة..."
                            className="w-full pr-10 pl-4 py-2 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>
                </div>

                {/* Notes List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-10 h-10 border-3 border-white/20 border-t-blue-400 rounded-full animate-spin" />
                        </div>
                    ) : Object.keys(groupedNotes).length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <p className="text-white/40 text-lg">
                                {viewMode === 'active' ? 'لا توجد ملاحظات نشطة' : 'لا توجد ملاحظات مؤرشفة'}
                            </p>
                        </div>
                    ) : (
                        Object.entries(groupedNotes).map(([room, roomNotes]) => (
                            <div key={room} className="space-y-2">
                                {/* Room Header */}
                                <div className="flex items-center gap-2 text-white/60">
                                    <DoorOpen className="w-4 h-4" />
                                    <span className="text-sm font-medium">
                                        {room === 'عام' ? 'ملاحظات عامة' : `غرفة ${room}`}
                                    </span>
                                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">
                                        {roomNotes.length}
                                    </span>
                                </div>

                                {/* Room Notes */}
                                {roomNotes.map((note) => {
                                    const isUnread = user && !note.readBy?.includes(user.id || '');

                                    return (
                                        <div
                                            key={note.id}
                                            className={`p-4 rounded-xl transition-all ${isUnread
                                                ? 'bg-blue-500/20 border border-blue-400/30'
                                                : 'bg-white/5 hover:bg-white/10'
                                                } ${note.priority === 'urgent' ? 'border-r-4 border-r-red-500' :
                                                    note.priority === 'important' ? 'border-r-4 border-r-yellow-500' : ''
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-white leading-relaxed flex-1 ml-4">{note.content}</p>
                                                {/* 🤝 Scenario 3: Shift Handover Acknowledgment */}
                                                {isUnread && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markAsRead(note.id);
                                                            haptic('success');
                                                        }}
                                                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5 animate-pulse"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        تم العلم
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-white/40">
                                                <span className="flex items-center gap-1">
                                                    {note.createdBy?.name}
                                                    {note.priority === 'urgent' && (
                                                        <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">عاجل</span>
                                                    )}
                                                    {note.priority === 'important' && (
                                                        <span className="bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">مهم</span>
                                                    )}
                                                </span>
                                                <span>{ShiftNotesService.formatNoteTime(note.createdAt)}</span>
                                            </div>
                                            {note.status === 'archived' && note.archivedAt && (
                                                <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/30">
                                                    أُرشف بواسطة {note.archivedBy?.name} • {ShiftNotesService.formatNoteTime(note.archivedAt)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>

                {/* Add Note (only in active mode) */}
                {viewMode === 'active' && (
                    <div className="p-4 border-t border-white/10 space-y-3">
                        {/* Room & Priority */}
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={selectedRoom}
                                    onChange={(e) => setSelectedRoom(e.target.value)}
                                    placeholder={listening ? "جاري الاستماع..." : "رقم الغرفة (اختياري)"}
                                    className={`w-full pr-4 pl-20 py-2 border rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-all ${listening ? 'bg-red-500/10 border-red-500/50 ring-2 ring-red-500/20' : 'bg-white/10 border-white/10 focus:ring-blue-500/50'
                                        }`}
                                />
                                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex gap-1">
                                    <button
                                        type="button"
                                        onClick={toggleVoice}
                                        className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
                                            }`}
                                        title="إدخال صوتي"
                                    >
                                        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowRoomSelector(true)}
                                        className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all flex items-center justify-center"
                                        title="اختر باللمس"
                                    >
                                        <DoorOpen className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value as ShiftNotesService.NotePriority)}
                                className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="normal">عادي</option>
                                <option value="important">مهم</option>
                                <option value="urgent">عاجل</option>
                            </select>
                        </div>

                        {/* Note Input */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && !submitting && addNote()}
                                placeholder="أضف ملاحظة للشيفت..."
                                className="flex-1 px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                disabled={submitting}
                            />
                            <button
                                onClick={addNote}
                                disabled={!newNote.trim() || submitting}
                                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-blue-500/25 transition-all"
                            >
                                {submitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Send className="w-5 h-5" />
                                )}
                            </button>
                        </div>

                        <p className="text-xs text-white/30 text-center">
                            💡 الملاحظات المرتبطة بغرفة تُؤرشف تلقائياً عند checkout من البيلمان
                        </p>
                    </div>
                )}
            </div>

            <FloorRoomSelector
                rooms={rooms.map(r => r.number)}
                selectedRoom={selectedRoom}
                onSelect={(room) => {
                    setSelectedRoom(room);
                    setShowRoomSelector(false);
                }}
                isOpen={showRoomSelector}
                onClose={() => setShowRoomSelector(false)}
            />
        </div >
    );
};

export default ShiftNotes;
