import React, { useState, useEffect } from 'react';
import { Users, X, Plus, Trash2, Edit2, Save, User } from 'lucide-react';
import { db } from '../../services/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';

interface TeamMember {
    id: string;
    name: string;
    shift?: string;
}

interface HousekeepingTeamManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void; // Callback to refresh parent data
}

export const HousekeepingTeamManager: React.FC<HousekeepingTeamManagerProps> = ({
    isOpen,
    onClose,
    onUpdate
}) => {
    const { user } = useAuth();
    const { success, error: showError } = useUX();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadTeam();
        }
    }, [isOpen]);

    const loadTeam = async () => {
        setLoading(true);
        try {
            const docRef = doc(db, 'settings', 'housekeeping');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setMembers(docSnap.data().teamMembers || []);
            } else {
                // Create default if not exists
                await setDoc(docRef, { teamMembers: [] });
                setMembers([]);
            }
        } catch (error) {
            console.error('Error loading team:', error);
            showError('حدث خطأ في تحميل الفريق');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMember = async () => {
        if (!newName.trim()) return;

        setIsAdding(true);
        try {
            const newMember: TeamMember = {
                id: crypto.randomUUID(),
                name: newName.trim(),
                shift: 'morning' // Default shift
            };

            const docRef = doc(db, 'settings', 'housekeeping');
            await updateDoc(docRef, {
                teamMembers: arrayUnion(newMember)
            });

            setMembers([...members, newMember]);
            setNewName('');
            success('تمت إضافة العضو بنجاح');
            onUpdate();
        } catch (error) {
            console.error('Error adding member:', error);
            showError('فشل إضافة العضو');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemoveMember = async (member: TeamMember) => {
        if (!window.confirm(`هل أنت متأكد من حذف ${member.name}؟`)) return;

        try {
            const docRef = doc(db, 'settings', 'housekeeping');
            await updateDoc(docRef, {
                teamMembers: arrayRemove(member)
            });

            setMembers(members.filter(m => m.id !== member.id));
            success('تم حذف العضو');
            onUpdate();
        } catch (error) {
            console.error('Error removing member:', error);
            showError('فشل حذف العضو');
        }
    };

    const startEdit = (member: TeamMember) => {
        setEditingId(member.id);
        setEditName(member.name);
    };

    const saveEdit = async () => {
        if (!editingId || !editName.trim()) return;

        try {
            const updatedMembers = members.map(m =>
                m.id === editingId ? { ...m, name: editName.trim() } : m
            );

            const docRef = doc(db, 'settings', 'housekeeping');
            await updateDoc(docRef, {
                teamMembers: updatedMembers
            });

            setMembers(updatedMembers);
            setEditingId(null);
            setEditName('');
            success('تم تحديث البيانات');
            onUpdate();
        } catch (error) {
            console.error('Error updating member:', error);
            showError('فشل التحديث');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">إدارة فريق الهاوس كيبنج</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    {/* Add New */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="اسم الموظف الجديد..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500/50"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                        />
                        <button
                            onClick={handleAddMember}
                            disabled={!newName.trim() || isAdding}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                        >
                            {isAdding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-white/40">
                            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>لا يوجد أعضاء، أضف أعضاء للفريق</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {members.map(member => (
                                <div key={member.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between group">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60">
                                            <User className="w-4 h-4" />
                                        </div>

                                        {editingId === member.id ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="bg-black/20 border border-white/20 rounded px-2 py-1 text-white text-sm w-full"
                                                autoFocus
                                                onBlur={saveEdit}
                                                onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                                            />
                                        ) : (
                                            <span className="text-white font-medium">{member.name}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        {editingId === member.id ? (
                                            <button onClick={saveEdit} className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg">
                                                <Save className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => startEdit(member)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleRemoveMember(member)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
