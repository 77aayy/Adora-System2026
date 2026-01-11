/**
 * Department Performance Chart (Slim Edition)
 * Visual analytics for points distribution and highlights
 */

import React, { useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Trophy, TrendingUp, AlertCircle, Users, X, Star } from 'lucide-react';
import { User as UserType } from '../../types';

interface DepartmentPerformanceChartProps {
    employees: UserType[];
}

const DEPARTMENTS = [
    { value: 'reception', label: 'الاستقبال', color: '#3b82f6' },
    { value: 'housekeeping', label: 'هاوس كيبنج', color: '#a855f7' },
    { value: 'bellman', label: 'البيلمان', color: '#eab308' },
    { value: 'maintenance', label: 'الصيانة', color: '#f97316' },
    { value: 'procurement', label: 'المشتريات', color: '#6366f1' },
    { value: 'admin', label: 'الإدارة', color: '#10b981' },
];

export const DepartmentPerformanceChart: React.FC<DepartmentPerformanceChartProps> = ({ employees }) => {
    const [selectedDept, setSelectedDept] = useState<string | null>(null);

    // 1. Data Processing
    const stats = useMemo(() => {
        const deptTotals: Record<string, number> = {};
        DEPARTMENTS.forEach(d => deptTotals[d.value] = 0);

        employees.forEach(emp => {
            if (deptTotals[emp.department] !== undefined) {
                deptTotals[emp.department] += emp.points || 0;
            }
        });

        const chartData = DEPARTMENTS.map(d => ({
            name: d.label,
            value: d.value,
            points: deptTotals[d.value],
            color: d.color
        }));

        const validEmployees = employees.filter(e => e.role !== 'owner' && e.status === 'active');
        const sorted = [...validEmployees].sort((a, b) => (b.points || 0) - (a.points || 0));
        const topPerformer = sorted[0];
        const lowPerformer = sorted.length > 0 ? sorted[sorted.length - 1] : null;

        return { chartData, topPerformer, lowPerformer };
    }, [employees]);

    const handleBarClick = (data: any) => {
        if (data && data.value) setSelectedDept(data.value);
    };

    const selectedEmployees = useMemo(() => {
        if (!selectedDept) return [];
        return employees
            .filter(e => e.department === selectedDept)
            .sort((a, b) => (b.points || 0) - (a.points || 0));
    }, [selectedDept, employees]);

    const deptLabel = DEPARTMENTS.find(d => d.value === selectedDept)?.label;

    return (
        <div className="space-y-3">
            {/* Slimmer Header Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border flex items-center gap-3 transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0">
                        <Trophy className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider block">الأعلى أداءً</span>
                        <h4 className="font-bold text-xs truncate transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{stats.topPerformer?.name || '---'}</h4>
                        <p className="text-[9px] transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>{stats.topPerformer?.points || 0} ن</p>
                    </div>
                </div>

                <div className="p-3 rounded-xl border flex items-center gap-3 transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                    <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30 shrink-0">
                        <AlertCircle className="w-5 h-5 text-orange-400" />
                    </div>
                    <div className="min-w-0">
                        <span className="text-[8px] font-black text-orange-400 uppercase tracking-wider block">الأقل نقاطاً</span>
                        <h4 className="font-bold text-xs truncate transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{stats.lowPerformer?.name || '---'}</h4>
                        <p className="text-[9px] transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>{stats.lowPerformer?.points || 0} ن</p>
                    </div>
                </div>
            </div>

            {/* Compact Chart Card */}
            <div className="p-4 rounded-2xl border transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border-primary)', borderRadius: 'var(--radius-xl)' }}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold flex items-center gap-2 transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>
                            <TrendingUp className="text-primary-500 w-4 h-4" />
                            توزيع النقاط حسب الأقسام
                        </h3>
                        <p className="text-[9px] mt-0.5 animate-pulse transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>اضغط على العمود للتفاصيل</p>
                    </div>
                </div>

                <div className="h-[180px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={stats.chartData}
                            onClick={(v: any) => v && v.activePayload && handleBarClick(v.activePayload[0].payload)}
                            margin={{ top: 0, right: 0, left: -40, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#ffffff20', fontSize: 9, fontWeight: 'bold' }}
                                dy={5}
                            />
                            <YAxis hide />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="p-2 rounded-lg border shadow-xl transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border-primary)' }}>
                                                <p className="font-bold text-[10px] transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{payload[0].payload.name}</p>
                                                <p className="text-primary-400 font-black text-xs">{payload[0].value} نقطة</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="points"
                                radius={[6, 6, 0, 0]}
                                barSize={30}
                                className="cursor-pointer"
                            >
                                {stats.chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.7} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Compact Modal */}
            {selectedDept && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedDept(null)} style={{ backdropFilter: 'none' }} />
                    <div className="relative w-full max-w-sm rounded-3xl border overflow-hidden animate-in zoom-in-95 duration-200 transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderColor: 'var(--theme-border-primary)' }}>
                        <div className="p-5 border-b flex items-center justify-between transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center border border-primary-500/30">
                                    <Users className="w-5 h-5 text-primary-400" />
                                </div>
                                <div className="text-right">
                                    <h3 className="text-base font-black transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{deptLabel}</h3>
                                    <p className="text-[9px] font-bold transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>ترتيب الموظفين</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDept(null)}
                                className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-300"
                                style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 max-h-[350px] overflow-y-auto space-y-2">
                            {selectedEmployees.map((emp, i) => (
                                <div key={emp.id} className="flex items-center justify-between p-3 rounded-xl border transition-all transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--theme-primary-500)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--theme-border-primary)'}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-primary-500/10 flex items-center justify-center text-[10px] font-bold text-primary-400 border border-primary-500/20 shrink-0">
                                            {i + 1}
                                        </div>
                                        <span className="text-xs font-bold truncate transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{emp.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        <span className="text-xs font-black transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{emp.points || 0}</span>
                                    </div>
                                </div>
                            ))}
                            {selectedEmployees.length === 0 && (
                                <p className="text-center py-6 text-xs font-bold transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>لا يوجد موظفين</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
