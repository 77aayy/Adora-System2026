/**
 * Department Stats Cards Component
 * Shows real-time statistics for each department
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Bell, Sparkles, Wrench, ShoppingCart, Users, Clock,
    CheckCircle, AlertCircle, ArrowUp, ArrowDown, TrendingUp,
    Headphones, Timer, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

interface DeptMetrics {
    active: number;
    completed: number;
    avgTime: number; // minutes
    delayed: number; // > 15 mins
}

interface DeptStats {
    reception: DeptMetrics & { inquiries: number };
    bellman: DeptMetrics & { checkIns: number; checkOuts: number };
    housekeeping: DeptMetrics & { cleaned: number; dirty: number; inspecting: number };
    maintenance: DeptMetrics & { urgent: number };
    procurement: DeptMetrics & { pending: number; approved: number };
}

// ============================================================
// COMPONENTS
// ============================================================

const PerformanceFooter: React.FC<{ avgTime: number; delayed: number }> = ({ avgTime, delayed }) => (
    <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
        <div className="flex items-center gap-1.5 transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }} title="متوسط وقت الاستجابة">
            <Timer className="w-3.5 h-3.5" />
            <span className="font-mono">
                {avgTime > 0 ? `${Math.round(avgTime)} د` : '-'}
            </span>
        </div>

        {delayed > 0 ? (
            <div className="flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-bold">{delayed} متأخر</span>
            </div>
        ) : (
            <div className="flex items-center gap-1 text-emerald-400/70">
                <CheckCircle className="w-3 h-3" />
                <span>منتظم</span>
            </div>
        )}
    </div>
);

const DepartmentCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    color: string; // Tailwind color class prefix (e.g., 'purple')
    metrics: DeptMetrics;
    onClick?: () => void;
    children: React.ReactNode;
}> = ({ title, icon, color, metrics, onClick, children }) => {
    // Dynamic classes based on color prop
    const bgGradient = `bg-gradient-to-br from-${color}-500/10 to-${color}-600/5`;
    const iconColor = `text-${color}-400`;
    const borderColor = `border-${color}-500/20`;

    return (
        <div
            onClick={onClick}
            className="relative overflow-hidden p-4 border transition-all group cursor-pointer active:scale-95 transition-colors duration-300"
            style={{ 
                background: 'var(--theme-bg-primary)', 
                borderRadius: 'var(--radius-lg)',
                borderColor: 'var(--theme-border-primary)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--theme-primary-500)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--theme-border-primary)'}
        >
            {/* Background Glow */}
            <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${color}-500/10 blur-[50px] rounded-full group-hover:bg-${color}-500/20 transition-all`} />

            {/* Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${iconColor}`}>
                        {icon}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{title}</h4>
                        <span className="text-[10px] transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>مباشر الآن</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-2xl font-bold font-mono leading-none transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                        {metrics.completed}
                    </span>
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <TrendingUp className="w-3 h-3" />
                        اليوم
                    </span>
                </div>
            </div>

            {/* Content Stats */}
            <div className="space-y-2 relative z-10 min-h-[80px]">
                {children}
            </div>

            {/* Universal Footer */}
            <PerformanceFooter avgTime={metrics.avgTime} delayed={metrics.delayed} />
        </div>
    );
};

const StatRow: React.FC<{ label: string; value: number | string; color?: string }> = ({ label, value, color }) => (
    <div className="flex items-center justify-between text-sm">
        <span className="transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>{label}</span>
        <span className={`font-bold font-mono ${color || ''}`} style={!color ? { color: 'var(--theme-text-primary)' } : {}}>{value}</span>
    </div>
);

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DepartmentStatsCards: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const branchId = (user as any)?.branch || (user as any)?.branchId || 'default';
    const tenantId = (user as any)?.tenantId;

    const [stats, setStats] = useState<DeptStats>({
        reception: { active: 0, completed: 0, avgTime: 0, delayed: 0, inquiries: 0 },
        bellman: { active: 0, completed: 0, avgTime: 0, delayed: 0, checkIns: 0, checkOuts: 0 },
        housekeeping: { active: 0, completed: 0, avgTime: 0, delayed: 0, cleaned: 0, dirty: 0, inspecting: 0 },
        maintenance: { active: 0, completed: 0, avgTime: 0, delayed: 0, urgent: 0 },
        procurement: { active: 0, completed: 0, avgTime: 0, delayed: 0, pending: 0, approved: 0 },
    });

    useEffect(() => {
        if (!branchId) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Requests Listener
        const requestsConstraints: any[] = [where('branch', '==', branchId)];
        if (tenantId) requestsConstraints.push(where('tenantId', '==', tenantId));

        const unsubRequests = onSnapshot(query(collection(db, 'requests'), ...requestsConstraints), (snapshot) => {
            const reqs = snapshot.docs.map(d => ({ ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() }));

            const calcMetrics = (deptReqs: any[]) => {
                const active = deptReqs.filter(r => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length;
                const completed = deptReqs.filter(r => r.status === 'COMPLETED' && r.completedAt?.toDate() >= today).length;

                // Convert timestamps to Date objects if needed
                const completedReqs = deptReqs.filter(r => r.status === 'COMPLETED' && r.completedAt && r.createdAt);
                const totalTime = completedReqs.reduce((acc, r) => acc + (r.completedAt.toDate().getTime() - r.createdAt.getTime()) / 60000, 0);
                const avgTime = completedReqs.length ? totalTime / completedReqs.length : 0;

                const delayed = deptReqs.filter(r => {
                    if (r.status === 'COMPLETED') return false;
                    const elapsed = (new Date().getTime() - r.createdAt.getTime()) / 60000;
                    return elapsed > 15; // 15 mins threshold
                }).length;

                return { active, completed, avgTime, delayed };
            };

            // Reception (Dispatching Role)
            // Active = Requests currently sitting in reception (waiting to be dispatched)
            const receptionReqs = reqs.filter((r: any) => r.currentDepartment === 'reception' && r.status !== 'COMPLETED');

            // Completed for reception = Requests created by/passed through reception that are now in other departments (Dispatched)
            // Rough approximation: Requests NOT in reception anymore but originated there? 
            // Better metric for now: Total requests handled today (regardless of current status) minus active reception ones?
            // Let's stick to: "Dispatched Today" => Simply count of non-reception requests created today?
            // For simplicity/accuracy given the schema: Active = In Reception. Completed logic needs refinement but we'll use "Total Active - In Reception" style or just keep it simple.

            // Let's treat "Active" as "Needs Dispatch".
            const receptionMetrics = calcMetrics(receptionReqs);

            // Bellman
            const bellmanReqs = reqs.filter((r: any) => r.type === 'bellman');
            const bellmanMetrics = calcMetrics(bellmanReqs);

            // Housekeeping
            const hkReqs = reqs.filter((r: any) => r.type === 'cleaning' || r.type === 'inspection');
            const hkMetrics = calcMetrics(hkReqs);

            // Maintenance
            const maintReqs = reqs.filter((r: any) => r.type === 'maintenance');
            const maintMetrics = calcMetrics(maintReqs);

            setStats(prev => ({
                ...prev,
                reception: { ...receptionMetrics, inquiries: receptionReqs.length },
                bellman: {
                    ...prev.bellman, ...bellmanMetrics,
                    active: bellmanMetrics.active // Keep other fields from cards listener if needed, but here we update metrics
                },
                housekeeping: {
                    ...prev.housekeeping, ...hkMetrics,
                    inspecting: hkReqs.filter((r: any) => r.type === 'inspection' && r.status !== 'COMPLETED').length
                },
                maintenance: {
                    ...prev.maintenance, ...maintMetrics,
                    urgent: maintReqs.filter((r: any) => r.priority === 'urgent' && r.status !== 'COMPLETED').length
                }
            }));
        });

        // 2. Room Cards Listener (For specific counts)
        const cardConstraints: any[] = [where('branch', '==', branchId)];
        if (tenantId) cardConstraints.push(where('tenantId', '==', tenantId));

        const unsubCards = onSnapshot(query(collection(db, 'roomCards'), ...cardConstraints), (snapshot) => {
            const cards = snapshot.docs.map(d => d.data());
            const checkIns = cards.filter((c: any) => c.checkInTime?.toDate() >= today).length;
            // Assuming checkOutDate is populated when checkout happens or is planned
            // For now simply counting inactive updated today logic or similar? 
            // Simplified:
            setStats(prev => ({
                ...prev,
                bellman: { ...prev.bellman, checkIns, checkOuts: 0 } // Todo: Track actual checkouts
            }));
        });

        // 3. Rooms Listener (For HK status)
        const roomConstraints: any[] = [where('branchId', '==', branchId)];
        if (tenantId) roomConstraints.push(where('tenantId', '==', tenantId));

        const unsubRooms = onSnapshot(query(collection(db, 'rooms'), ...roomConstraints), (snapshot) => {
            const rooms = snapshot.docs.map(d => d.data());
            setStats(prev => ({
                ...prev,
                housekeeping: {
                    ...prev.housekeeping,
                    // If we strictly follow the new generic metrics, we might overwrite "active" here.
                    // But let's keep specific stats:
                    dirty: rooms.filter((r: any) => r.housekeepingStatus === 'dirty').length,
                    // cleaned: calculated from requests above
                }
            }));
        });

        return () => { unsubRequests(); unsubCards(); unsubRooms(); };
    }, [branchId]);

    return (
        <div id="department-stats-cards" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            {/* 🎧 Reception (Dispatching) */}
            <DepartmentCard
                title="📞 الاستقبال"
                icon={<Headphones className="w-5 h-5 text-white" />}
                color="indigo"
                metrics={stats.reception}
                onClick={() => navigate('/reception?tab=active')}
            >
                <div className="space-y-2">
                    <StatRow label="بانتظار التوجيه" value={stats.reception.active} color="text-indigo-400" />
                    <StatRow label="متوسط سرعة التوجيه" value={`${Math.round(stats.reception.avgTime || 0)}د`} />
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-3">
                        <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min((stats.reception.completed / (stats.reception.completed + stats.reception.active || 1)) * 100, 100)}%` }} />
                    </div>
                </div>
            </DepartmentCard>

            {/* 🛎️ Bellman */}
            <DepartmentCard
                title="🔔 البيلمان"
                icon={<Bell className="w-5 h-5 text-white" />}
                color="purple"
                metrics={stats.bellman}
                onClick={() => navigate('/bellman?tab=requests')}
            >
                <StatRow label="دخول اليوم" value={stats.bellman.checkIns} color="text-green-400" />
                <StatRow label="خروج اليوم" value={stats.bellman.checkOuts} color="text-blue-400" />
                <StatRow label="طلب حقائب" value={stats.bellman.active} />
            </DepartmentCard>

            {/* ✨ Housekeeping */}
            <DepartmentCard
                title="✨ الهاوس كيبنج"
                icon={<Sparkles className="w-5 h-5 text-white" />}
                color="blue"
                metrics={stats.housekeeping}
                onClick={() => navigate('/housekeeping?tab=in_progress')}
            >
                <StatRow label="غرف متسخة" value={stats.housekeeping.dirty} color="text-orange-400" />
                <StatRow label="جاري التنظيف" value={stats.housekeeping.active} />
                <StatRow label="فحص معلق" value={stats.housekeeping.inspecting} color="text-yellow-400" />
            </DepartmentCard>

            {/* 🛠️ Maintenance */}
            <DepartmentCard
                title="🛠️ الصيانة"
                icon={<Wrench className="w-5 h-5 text-white" />}
                color="orange"
                metrics={stats.maintenance}
                onClick={() => navigate('/maintenance?tab=active')}
            >
                <StatRow label="أعطال مفتوحة" value={stats.maintenance.active} />
                <StatRow label="حرجة جداً" value={stats.maintenance.urgent} color="text-red-500 animate-pulse" />
                <div className="flex items-center gap-1 text-[10px] mt-1 transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>
                    <CheckCircle className="w-3 h-3" />
                    <span>نسبة الإنجاز {(stats.maintenance.completed / (stats.maintenance.completed + stats.maintenance.active || 1) * 100).toFixed(0)}%</span>
                </div>
            </DepartmentCard>

            {/* 🛒 Procurement */}
            <DepartmentCard
                title="المشتريات"
                icon={<ShoppingCart className="w-5 h-5 text-white" />}
                color="emerald"
                metrics={stats.procurement}
                onClick={() => navigate('/procurement')}
            >
                <StatRow label="قيد الموافقة" value={stats.procurement.active} color="text-yellow-400" />
                <StatRow label="تم التعميد" value={stats.procurement.approved} />
                <StatRow label="استلام اليوم" value={stats.procurement.completed} color="text-emerald-400" />
            </DepartmentCard>
        </div>
    );
};

export default DepartmentStatsCards;
