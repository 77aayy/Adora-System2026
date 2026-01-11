/**
 * Unified Team Members Panel
 * Shared component for displaying team members across departments
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Users, X, Star, TrendingUp, Award } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

interface TeamMember {
    id: string;
    name: string;
    code: string;
    department: string;
    points: number;
    status: 'active' | 'inactive' | 'on_break';
}

interface TeamMembersProps {
    isOpen: boolean;
    onClose: () => void;
    department?: string;
    showPoints?: boolean;
    showAllDepartments?: boolean;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const TeamMembers: React.FC<TeamMembersProps> = ({
    isOpen,
    onClose,
    department,
    showPoints = true,
    showAllDepartments = false
}) => {
    const { user } = useAuth();

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && user) {
            loadTeamMembers();
        }
    }, [isOpen, user, department]);

    const loadTeamMembers = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const constraints = [
                where('status', '==', 'active')
            ];

            // Filter by department if specified
            if (!showAllDepartments && department) {
                constraints.push(where('department', '==', department));
            } else if (!showAllDepartments && user?.department) {
                constraints.push(where('department', '==', user.department));
            }

            const q = showPoints
                ? query(usersRef, ...constraints, orderBy('points', 'desc'))
                : query(usersRef, ...constraints, orderBy('name', 'asc'));

            const snapshot = await getDocs(q);

            const loadedMembers: TeamMember[] = [];
            snapshot.forEach((doc) => {
                loadedMembers.push({ id: doc.id, ...doc.data() } as TeamMember);
            });

            setMembers(loadedMembers);
        } catch (error) {
            console.error('Failed to load team members:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">نشط</span>;
            case 'on_break':
                return <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">استراحة</span>;
            case 'inactive':
                return <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">غير نشط</span>;
            default:
                return null;
        }
    };

    const getRankIcon = (index: number) => {
        if (index === 0) return <Award className="w-5 h-5 text-yellow-400" />;
        if (index === 1) return <Award className="w-5 h-5 text-gray-300" />;
        if (index === 2) return <Award className="w-5 h-5 text-orange-400" />;
        return null;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-card w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">أعضاء الفريق</h3>
                            {!showAllDepartments && department && (
                                <p className="text-sm text-white/60">{department}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-white/30 mx-auto mb-2" />
                            <p className="text-white/50">لا يوجد أعضاء في الفريق</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {members.map((member, index) => (
                                <div
                                    key={member.id}
                                    className="bg-white/10 rounded-xl p-3 hover:bg-white/15 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 flex-1">
                                            {showPoints && getRankIcon(index)}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{member.name}</span>
                                                    {getStatusBadge(member.status)}
                                                </div>
                                                <p className="text-sm text-white/60">كود: {member.code}</p>
                                                {showAllDepartments && (
                                                    <p className="text-xs text-white/50">{member.department}</p>
                                                )}
                                            </div>
                                        </div>

                                        {showPoints && (
                                            <div className="flex items-center gap-2">
                                                <Star className="w-4 h-4 text-yellow-400" />
                                                <span className="font-bold text-yellow-400">{member.points || 0}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Stats */}
                {!loading && members.length > 0 && showPoints && (
                    <div className="p-4 border-t border-white/10 flex-shrink-0">
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-2xl font-bold text-white">{members.length}</div>
                                <div className="text-xs text-white/60">الأعضاء</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-yellow-400">
                                    {members.reduce((sum, m) => sum + (m.points || 0), 0)}
                                </div>
                                <div className="text-xs text-white/60">مجموع النقاط</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-green-400">
                                    {Math.round(members.reduce((sum, m) => sum + (m.points || 0), 0) / members.length)}
                                </div>
                                <div className="text-xs text-white/60">المتوسط</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamMembers;
