/**
 * Staff Leaderboard (لوحة شرف الموظفين)
 * ترتيب الموظفين أسبوعياً حسب النقاط والتقييمات
 * 
 * ✅ Features:
 * - Weekly rankings
 * - Points + Guest likes combined
 * - Department filtering
 * - PDF export
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Trophy,
    Star,
    TrendingUp,
    TrendingDown,
    Filter,
    FileText,
    ChevronDown,
    ThumbsUp
} from 'lucide-react';
import { db } from '../../services/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { AdoraLoader } from '../common/AdoraLoader';

// ============================================================
// TYPES
// ============================================================

interface StaffLeaderboardProps {
    tenantId: string;
    branchId?: string;
    limit?: number;
    showFilters?: boolean;
    compact?: boolean;
}

interface EmployeeStats {
    id: string;
    name: string;
    department: string;
    avatar?: string;
    weeklyPoints: number;
    weeklyLikes: number;
    weeklyDislikes: number;
    totalScore: number;
    tasksCompleted: number;
    avgResponseTime?: number;
    rank: number;
    trend: 'up' | 'down' | 'same';
    previousRank?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEPARTMENTS = [
    { value: 'all', label: 'جميع الأقسام' },
    { value: 'housekeeping', label: 'النظافة' },
    { value: 'maintenance', label: 'الصيانة' },
    { value: 'bellman', label: 'البيلمان' },
    { value: 'reception', label: 'الاستقبال' },
    { value: 'coffee', label: 'الكوفي شوب' }
];

const RANK_BADGES = [
    { rank: 1, icon: '👑', color: 'from-amber-400 to-yellow-500', label: 'البطل' },
    { rank: 2, icon: '🥈', color: 'from-slate-300 to-slate-400', label: 'المتميز' },
    { rank: 3, icon: '🥉', color: 'from-amber-600 to-amber-700', label: 'المجتهد' }
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _getWeekNumber(): string {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 604800000;
    const weekNum = Math.ceil(diff / oneWeek);
    return `${now.getFullYear()}-W${weekNum}`;
}

function getWeekDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
}

// ============================================================
// COMPONENT
// ============================================================

export const StaffLeaderboard: React.FC<StaffLeaderboardProps> = ({
    tenantId,
    branchId,
    limit = 10,
    showFilters = true,
    compact = false
}) => {
    const [employees, setEmployees] = useState<EmployeeStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [showDropdown, setShowDropdown] = useState(false);

    // ============================================================
    // LOAD DATA
    // ============================================================

    useEffect(() => {
        loadLeaderboard();
    }, [tenantId, branchId]);

    const loadLeaderboard = async () => {
        setLoading(true);
        if (!db) {
            setLoading(false);
            return;
        }
        try {
            const { start, end } = getWeekDateRange();

            // Get all employees
            const employeesRef = collection(db, `tenants/${tenantId}/employees`);
            let employeeQuery = query(employeesRef);
            if (branchId) {
                employeeQuery = query(employeesRef, where('branchId', '==', branchId));
            }
            const employeesSnap = await getDocs(employeeQuery);

            // Get weekly points logs
            const pointsRef = collection(db, `tenants/${tenantId}/points_log`);
            const pointsQuery = query(
                pointsRef,
                where('createdAt', '>=', Timestamp.fromDate(start)),
                where('createdAt', '<=', Timestamp.fromDate(end))
            );
            const pointsSnap = await getDocs(pointsQuery);

            // Get weekly guest ratings (likes from workers to guests don't count here)
            // This would be ratings FROM guests TO employees
            const ratingsRef = collection(db, `tenants/${tenantId}/employee_ratings`);
            const ratingsQuery = query(
                ratingsRef,
                where('createdAt', '>=', Timestamp.fromDate(start)),
                where('createdAt', '<=', Timestamp.fromDate(end))
            );
            const ratingsSnap = await getDocs(ratingsQuery);

            // Aggregate points by employee
            const pointsByEmployee: Record<string, number> = {};
            pointsSnap.docs.forEach(doc => {
                const data = doc.data();
                const empId = data.employeeId;
                if (empId) {
                    pointsByEmployee[empId] = (pointsByEmployee[empId] || 0) + (data.points || 0);
                }
            });

            // Aggregate ratings by employee
            const ratingsByEmployee: Record<string, { likes: number; dislikes: number }> = {};
            ratingsSnap.docs.forEach(doc => {
                const data = doc.data();
                const empId = data.employeeId;
                if (empId) {
                    if (!ratingsByEmployee[empId]) {
                        ratingsByEmployee[empId] = { likes: 0, dislikes: 0 };
                    }
                    if (data.rating === 'like' || data.rating === 'positive') {
                        ratingsByEmployee[empId].likes++;
                    } else if (data.rating === 'dislike' || data.rating === 'negative') {
                        ratingsByEmployee[empId].dislikes++;
                    }
                }
            });

            // Build employee stats
            const stats: EmployeeStats[] = employeesSnap.docs.map(doc => {
                const data = doc.data();
                const weeklyPoints = pointsByEmployee[doc.id] || 0;
                const ratings = ratingsByEmployee[doc.id] || { likes: 0, dislikes: 0 };
                
                // Score = points + (likes * 2) - (dislikes * 3)
                const totalScore = weeklyPoints + (ratings.likes * 2) - (ratings.dislikes * 3);

                return {
                    id: doc.id,
                    name: data.name || 'موظف',
                    department: data.department || 'other',
                    avatar: data.avatar,
                    weeklyPoints,
                    weeklyLikes: ratings.likes,
                    weeklyDislikes: ratings.dislikes,
                    totalScore,
                    tasksCompleted: data.weeklyTasks || 0,
                    rank: 0,
                    trend: 'same' as const,
                    previousRank: data.previousRank
                };
            });

            // Sort by total score and assign ranks
            stats.sort((a, b) => b.totalScore - a.totalScore);
            stats.forEach((emp, index) => {
                emp.rank = index + 1;
                if (emp.previousRank) {
                    if (emp.rank < emp.previousRank) emp.trend = 'up';
                    else if (emp.rank > emp.previousRank) emp.trend = 'down';
                }
            });

            setEmployees(stats);
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============================================================
    // FILTERED EMPLOYEES
    // ============================================================

    const filteredEmployees = useMemo(() => {
        let filtered = employees;
        
        if (selectedDepartment !== 'all') {
            filtered = filtered.filter(e => e.department === selectedDepartment);
        }
        
        return filtered.slice(0, limit);
    }, [employees, selectedDepartment, limit]);

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="p-8 text-center">
                <AdoraLoader size="md" message="جاري تحميل لوحة الشرف..." />
            </div>
        );
    }

    return (
        <div className={`bg-slate-900 rounded-2xl border border-white/10 overflow-hidden ${compact ? '' : 'shadow-xl'}`}>
            {/* Header */}
            <div className="p-4 sm:p-6 bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <Trophy className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">🏆 لوحة الشرف</h2>
                            <p className="text-white/60 text-sm">ترتيب الموظفين هذا الأسبوع</p>
                        </div>
                    </div>

                    {/* Department Filter */}
                    {showFilters && (
                        <div className="relative">
                            <button
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm
                                           hover:bg-white/20 transition-colors"
                            >
                                <Filter className="w-4 h-4" />
                                <span>{DEPARTMENTS.find(d => d.value === selectedDepartment)?.label}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-800 border border-white/10 
                                                rounded-xl shadow-xl overflow-hidden z-10">
                                    {DEPARTMENTS.map(dept => (
                                        <button
                                            key={dept.value}
                                            onClick={() => {
                                                setSelectedDepartment(dept.value);
                                                setShowDropdown(false);
                                            }}
                                            className={`w-full px-4 py-2 text-right text-sm transition-colors ${
                                                selectedDepartment === dept.value
                                                    ? 'bg-amber-500/20 text-amber-400'
                                                    : 'text-white/70 hover:bg-white/10'
                                            }`}
                                        >
                                            {dept.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Leaderboard */}
            <div className="divide-y divide-white/5">
                {filteredEmployees.length === 0 ? (
                    <div className="p-8 text-center text-white/40">
                        لا يوجد بيانات لهذا الأسبوع
                    </div>
                ) : (
                    filteredEmployees.map((employee, index) => {
                        const rankBadge = RANK_BADGES.find(b => b.rank === employee.rank);
                        const isTopThree = employee.rank <= 3;

                        return (
                            <div
                                key={employee.id}
                                className={`p-4 flex items-center gap-4 transition-colors ${
                                    isTopThree ? 'bg-gradient-to-r from-amber-500/5 to-transparent' : 'hover:bg-white/5'
                                }`}
                            >
                                {/* Rank */}
                                <div className={`
                                    w-10 h-10 rounded-xl flex items-center justify-center font-bold
                                    ${isTopThree 
                                        ? `bg-gradient-to-br ${rankBadge?.color} text-white shadow-lg` 
                                        : 'bg-white/10 text-white/60'
                                    }
                                `}>
                                    {isTopThree ? (
                                        <span className="text-lg">{rankBadge?.icon}</span>
                                    ) : (
                                        <span>{employee.rank}</span>
                                    )}
                                </div>

                                {/* Avatar & Name */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-medium truncate">
                                            {employee.name}
                                        </span>
                                        {isTopThree && (
                                            <span className="text-xs text-amber-400">{rankBadge?.label}</span>
                                        )}
                                        {employee.trend === 'up' && (
                                            <TrendingUp className="w-4 h-4 text-green-400" />
                                        )}
                                        {employee.trend === 'down' && (
                                            <TrendingDown className="w-4 h-4 text-red-400" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-white/50">
                                        <span>{DEPARTMENTS.find(d => d.value === employee.department)?.label || employee.department}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Star className="w-3 h-3 text-amber-400" />
                                            {employee.weeklyPoints} نقطة
                                        </span>
                                        {employee.weeklyLikes > 0 && (
                                            <>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <ThumbsUp className="w-3 h-3" />
                                                    {employee.weeklyLikes}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Total Score */}
                                <div className="text-left">
                                    <div className={`text-lg font-bold ${
                                        isTopThree ? 'text-amber-400' : 'text-white'
                                    }`}>
                                        {employee.totalScore}
                                    </div>
                                    <div className="text-xs text-white/40">نقطة</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            {!compact && (
                <div className="p-4 bg-slate-800/30 border-t border-white/10 flex items-center justify-between">
                    <p className="text-white/40 text-xs">
                        📊 يتم تصفير الترتيب كل أسبوع
                    </p>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm
                                       hover:bg-white/20 transition-colors">
                        <FileText className="w-4 h-4" />
                        تصدير PDF
                    </button>
                </div>
            )}
        </div>
    );
};

export default StaffLeaderboard;
