/**
 * Room Management Component
 * Admin panel for managing hotel rooms
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import {
    Home,
    Plus,
    Edit2,
    Trash2,
    Upload
} from 'lucide-react';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { haptic, playSound } from '../../utils/uxEffects';

interface Room {
    id: string;
    number: string;
    type: 'standard' | 'deluxe' | 'suite' | 'presidential';
    floor: number;
    status: string;
    createdAt?: Date;
}

export const RoomManagement: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);

    // Load rooms
    useEffect(() => {
        const q = query(collection(db, 'rooms'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const roomList: Room[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Room));
            setRooms(roomList.sort((a, b) => parseInt(a.number) - parseInt(b.number)));
        });

        return () => unsubscribe();
    }, []);

    // Add room
    const handleAddRoom = async (data: {
        number: string;
        type: string;
        floor: number;
    }) => {
        try {
            await addDoc(collection(db, 'rooms'), {
                number: data.number,
                type: data.type,
                floor: data.floor,
                status: 'ready',
                createdAt: Timestamp.now(),
                createdBy: currentUser?.id
            });

            haptic('success');
            playSound('success');
            setShowAddModal(false);
        } catch (error) {
            console.error('Error adding room:', error);
            haptic('error');
            alert('حدث خطأ في إضافة الغرفة');
        }
    };

    // Delete room
    const handleDeleteRoom = async (roomId: string, roomNumber: string) => {
        if (!confirm(`هل أنت متأكد من حذف الغرفة ${roomNumber}?`)) return;

        try {
            await deleteDoc(doc(db, 'rooms', roomId));
            haptic('success');
            playSound('notification');
        } catch (error) {
            console.error('Error deleting room:', error);
            haptic('error');
        }
    };

    // Bulk import
    const handleBulkImport = async () => {
        const input = prompt(
            'أدخل أرقام الغرف (مفصولة بفواصل)\nمثال: 101,102,103,201,202,203'
        );

        if (!input) return;

        const numbers = input.split(',').map(n => n.trim());

        try {
            for (const number of numbers) {
                const floor = Math.floor(parseInt(number) / 100);
                await addDoc(collection(db, 'rooms'), {
                    number,
                    type: 'standard',
                    floor,
                    status: 'ready',
                    createdAt: Timestamp.now(),
                    createdBy: currentUser?.id
                });
            }

            haptic('success');
            playSound('success');
            alert(`تم إضافة ${numbers.length} غرفة بنجاح`);
        } catch (error) {
            console.error('Error bulk importing:', error);
            haptic('error');
        }
    };

    const roomTypeLabels: Record<string, string> = {
        standard: 'عادية',
        deluxe: 'ديلوكس',
        suite: 'جناح',
        presidential: 'رئاسية'
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Home className="w-8 h-8 text-purple-400" />
                    <h2 className="text-2xl font-bold text-white">إدارة الغرف</h2>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleBulkImport}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                    >
                        <Upload className="w-5 h-5" />
                        <span>استيراد مجموعة</span>
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all"
                    >
                        <Plus className="w-5 h-5" />
                        <span>إضافة غرفة</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-white">{rooms.length}</div>
                    <div className="text-sm text-white/60">إجمالي الغرف</div>
                </div>
                <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-green-400">
                        {rooms.filter(r => r.status === 'ready').length}
                    </div>
                    <div className="text-sm text-white/60">جاهزة</div>
                </div>
                <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-blue-400">
                        {rooms.filter(r => r.status === 'occupied').length}
                    </div>
                    <div className="text-sm text-white/60">مشغولة</div>
                </div>
                <div className="glass rounded-xl p-4">
                    <div className="text-2xl font-bold text-red-400">
                        {rooms.filter(r => r.status === 'maintenance').length}
                    </div>
                    <div className="text-sm text-white/60">صيانة</div>
                </div>
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {rooms.map((room) => (
                    <div key={room.id} className="glass rounded-xl p-4 group relative">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white mb-1">{room.number}</div>
                            <div className="text-xs text-white/60">{roomTypeLabels[room.type]}</div>
                            <div className="text-xs text-white/40 mt-2">الدور {room.floor}</div>
                        </div>

                        {/* Actions (on hover) */}
                        <div className="absolute inset-0 bg-black/80 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                onClick={() => setEditingRoom(room)}
                                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all"
                                title="تعديل"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDeleteRoom(room.id, room.number)}
                                className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                title="حذف"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Room Modal */}
            {showAddModal && (
                <AddRoomModal
                    onClose={() => setShowAddModal(false)}
                    onSubmit={handleAddRoom}
                />
            )}

            {/* Edit Room Modal */}
            {editingRoom && (
                <EditRoomModal
                    room={editingRoom}
                    onClose={() => setEditingRoom(null)}
                />
            )}
        </div>
    );
};

// Add Room Modal
const AddRoomModal: React.FC<{
    onClose: () => void;
    onSubmit: (data: any) => void;
}> = ({ onClose, onSubmit }) => {
    const [number, setNumber] = useState('');
    const [type, setType] = useState('standard');
    const [floor, setFloor] = useState(1);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ number, type, floor });
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-4">إضافة غرفة جديدة</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">رقم الغرفة</label>
                        <input
                            type="text"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            required
                            placeholder="مثال: 101"
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">نوع الغرفة</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        >
                            <option value="standard">عادية</option>
                            <option value="deluxe">ديلوكس</option>
                            <option value="suite">جناح</option>
                            <option value="presidential">رئاسية</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">الدور</label>
                        <input
                            type="number"
                            value={floor}
                            onChange={(e) => setFloor(parseInt(e.target.value))}
                            min="1"
                            required
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all"
                        >
                            إضافة
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Edit Room Modal
const EditRoomModal: React.FC<{
    room: Room;
    onClose: () => void;
}> = ({ room, onClose }) => {
    const [number, setNumber] = useState(room.number);
    const [type, setType] = useState(room.type);
    const [floor, setFloor] = useState(room.floor);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'rooms', room.id), {
                number,
                type,
                floor
            });
            haptic('success');
            playSound('success');
            onClose();
        } catch (error) {
            console.error('Error updating room:', error);
            haptic('error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="glass rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-4">تعديل الغرفة</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-white/60 mb-2">رقم الغرفة</label>
                        <input
                            type="text"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            required
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">نوع الغرفة</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as any)}
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        >
                            <option value="standard">عادية</option>
                            <option value="deluxe">ديلوكس</option>
                            <option value="suite">جناح</option>
                            <option value="presidential">رئاسية</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-white/60 mb-2">الدور</label>
                        <input
                            type="number"
                            value={floor}
                            onChange={(e) => setFloor(parseInt(e.target.value))}
                            min="1"
                            required
                            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all"
                        >
                            حفظ
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
