/**
 * Data Health Report Card 🏥
 * Displays weekly health report summary for owners
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Activity, TrendingUp, TrendingDown, Minus, CheckCircle2,
    RefreshCw, ChevronRight, FileText, Shield, Sparkles, Wrench, Zap, Eye
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import {
    DataHealthReport,
    getRecentHealthReports,
    generateWeeklyHealthReport,
    saveAndNotifyReport,
    markReportAsViewed
} from '../../services/dataHealthReportService';

// ============================================================
// TYPES
// ============================================================

interface DataHealthReportCardProps {
    tenantId: string;
    onViewDetails?: (report: DataHealthReport) => void;
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

const HealthScoreRing: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
    const sizeConfig = {
        sm: { ring: 60, stroke: 4, text: 'text-lg' },
        md: { ring: 80, stroke: 6, text: 'text-2xl' },
        lg: { ring: 120, stroke: 8, text: 'text-4xl' }
    };

    const config = sizeConfig[size];
    const radius = (config.ring - config.stroke) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const getColor = () => {
        if (score >= 80) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        if (score >= 40) return 'text-orange-400';
        return 'text-red-400';
    };

    const getStrokeColor = () => {
        if (score >= 80) return '#4ade80';
        if (score >= 60) return '#facc15';
        if (score >= 40) return '#fb923c';
        return '#f87171';
    };

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={config.ring} height={config.ring} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={config.ring / 2}
                    cy={config.ring / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth={config.stroke}
                />
                {/* Progress circle */}
                <circle
                    cx={config.ring / 2}
                    cy={config.ring / 2}
                    r={radius}
                    fill="none"
                    stroke={getStrokeColor()}
                    strokeWidth={config.stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                />
            </svg>
            <span className={`absolute ${config.text} font-bold ${getColor()}`}>
                {score}%
            </span>
        </div>
    );
};

const MetricCard: React.FC<{
    label: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    trendPercent?: number;
    status: 'good' | 'warning' | 'critical';
    icon: React.ReactNode;
}> = ({ label, value, unit, trend, trendPercent, status, icon }) => {
    const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const trendColor = status === 'good'
        ? (trend === 'down' ? 'text-green-400' : 'text-gray-400')
        : (trend === 'up' ? 'text-red-400' : 'text-gray-400');

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                status === 'critical' ? 'bg-red-500/20' :
                status === 'warning' ? 'bg-orange-500/20' : 'bg-teal-500/20'
            }`}>
                {icon}
            </div>
            <div className="flex-1">
                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>{label}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>{value}</span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>{unit}</span>
                </div>
            </div>
            {trendPercent !== undefined && trendPercent > 0 && (
                <div className={`flex items-center gap-1 text-xs ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    <span>{trendPercent}%</span>
                </div>
            )}
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const DataHealthReportCard: React.FC<DataHealthReportCardProps> = ({
    tenantId,
    onViewDetails
}) => {
    const { user } = useAuth();
    const { success, error, haptic } = useUX();

    const [report, setReport] = useState<DataHealthReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [expanded, setExpanded] = useState(false);

    // Load latest report
    useEffect(() => {
        const loadReport = async () => {
            if (!tenantId) return;

            try {
                const reports = await getRecentHealthReports(tenantId, 1);
                if (reports.length > 0) {
                    setReport(reports[0]);

                    // Mark as viewed if not already
                    if (!reports[0].viewed && reports[0].id) {
                        await markReportAsViewed(reports[0].id);
                    }
                }
            } catch (err) {
                console.error('Error loading health report:', err);
            } finally {
                setLoading(false);
            }
        };

        loadReport();
    }, [tenantId]);

    const handleGenerateReport = async () => {
        if (!tenantId || !user) return;

        setGenerating(true);
        haptic('medium');

        try {
            const newReport = await generateWeeklyHealthReport(tenantId);
            await saveAndNotifyReport(newReport, user.id);
            setReport(newReport);
            success('✅ تم إنشاء التقرير بنجاح');
            haptic('success');
        } catch (err) {
            console.error('Error generating report:', err);
            error('فشل في إنشاء التقرير');
            haptic('error');
        } finally {
            setGenerating(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('ar-SA', {
            day: 'numeric',
            month: 'short'
        });
    };

    if (loading) {
        return (
            <div className="solid-modal rounded-2xl p-6" style={{ background: 'var(--theme-bg-secondary)' }}>
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/3" />
                    <div className="flex gap-4">
                        <div className="w-20 h-20 bg-white/10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-2/3" />
                            <div className="h-4 bg-white/10 rounded w-1/2" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="solid-modal rounded-2xl overflow-hidden" style={{ background: 'var(--theme-bg-secondary)' }}>
            {/* Header */}
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded(!expanded)}
                style={{ borderBottom: expanded ? '1px solid var(--theme-border-primary)' : 'none' }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h3 className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                            🏥 تقرير صحة البيانات
                        </h3>
                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                            {report
                                ? `${formatDate(report.reportPeriod.start)} - ${formatDate(report.reportPeriod.end)}`
                                : 'لم يتم إنشاء تقرير بعد'
                            }
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {report && (
                        <HealthScoreRing score={report.overallHealth} size="sm" />
                    )}
                    <ChevronRight className={`w-5 h-5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--theme-text-tertiary)' }}
                    />
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="p-4 space-y-4">
                    {report ? (
                        <>
                            {/* Main Score */}
                            <div className="flex items-center justify-center gap-6 py-4">
                                <HealthScoreRing score={report.overallHealth} size="lg" />
                                <div>
                                    <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                        الحالة العامة للنظام
                                    </p>
                                    <p className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.overallHealth >= 80 ? '✅ ممتاز' :
                                         report.overallHealth >= 60 ? '👍 جيد' :
                                         report.overallHealth >= 40 ? '⚠️ يحتاج تحسين' : '🚨 حرج'}
                                    </p>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.totalIssues}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي الحالات</p>
                                </div>
                                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-2xl font-bold text-green-400">{report.resolvedIssues}</p>
                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>تم حلها</p>
                                </div>
                                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className={`text-2xl font-bold ${report.criticalIssues > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                        {report.criticalIssues}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>حرجة</p>
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="space-y-2">
                                <p className="text-xs font-medium" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    📊 المؤشرات
                                </p>
                                {report.metrics.map((metric, idx) => (
                                    <MetricCard
                                        key={idx}
                                        label={metric.label}
                                        value={metric.value}
                                        unit={metric.unit}
                                        trend={metric.trend}
                                        trendPercent={metric.trendPercent}
                                        status={metric.status}
                                        icon={
                                            metric.category === 'cleaning' ? <Sparkles className="w-5 h-5 text-blue-400" /> :
                                            metric.category === 'maintenance' ? <Wrench className="w-5 h-5 text-orange-400" /> :
                                            metric.category === 'security' ? <Shield className="w-5 h-5 text-red-400" /> :
                                            <Zap className="w-5 h-5 text-yellow-400" />
                                        }
                                    />
                                ))}
                            </div>

                            {/* Recommendations */}
                            {report.recommendations.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        💡 التوصيات
                                    </p>
                                    {report.recommendations.map((rec, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-2 p-3 rounded-xl"
                                            style={{ background: 'var(--theme-bg-tertiary)' }}
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                                {rec}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* View Full Report Button */}
                            {onViewDetails && (
                                <button
                                    onClick={() => onViewDetails(report)}
                                    className="w-full py-3 rounded-xl bg-teal-500/10 text-teal-400 font-medium hover:bg-teal-500/20 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    عرض التقرير الكامل
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="py-8 text-center">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-white/20" />
                            <p className="text-sm mb-4" style={{ color: 'var(--theme-text-secondary)' }}>
                                لم يتم إنشاء تقرير صحة البيانات بعد
                            </p>
                            <button
                                onClick={handleGenerateReport}
                                disabled={generating}
                                className="px-6 py-2 rounded-xl bg-teal-500 text-white font-medium hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                            >
                                {generating ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        جاري الإنشاء...
                                    </>
                                ) : (
                                    <>
                                        <Activity className="w-4 h-4" />
                                        إنشاء التقرير الآن
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Generate New Report */}
                    {report && (
                        <button
                            onClick={handleGenerateReport}
                            disabled={generating}
                            className="w-full py-2 rounded-xl text-sm font-medium hover:bg-white/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                        >
                            {generating ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    جاري التحديث...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    تحديث التقرير
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default DataHealthReportCard;
