/**
 * Data Health Report Card 🏥
 * Displays weekly health report summary for owners
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import {
    Activity, TrendingUp, TrendingDown, Minus, CheckCircle2,
    RefreshCw, ChevronRight, FileText, Shield, Sparkles, Wrench, Zap, Eye,
    AlertTriangle, Database, Wifi, Lock, Clock, Code, BarChart3, History,
    X, Download, Copy, Terminal, ExternalLink, FileSpreadsheet, ArrowLeft
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
import { formatHijriDate } from '../../utils/printUtils';

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
    const [showFullReport, setShowFullReport] = useState(false);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [activeTab, setActiveTab] = useState<'errors' | 'performance' | 'userActivity' | 'requestStats' | 'database' | 'timeline' | 'console' | 'system' | 'raw'>('errors');

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
            } catch (err: any) {
                console.error('Error loading health report:', err);
                // ✅ Show user-friendly error message
                if (err?.message?.includes('not initialized')) {
                    error('Firebase غير متصل - يرجى التحقق من الاتصال');
                } else {
                    error('فشل تحميل التقرير - يرجى المحاولة مرة أخرى');
                }
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
        } catch (err: any) {
            console.error('❌ Error generating report:', err);
            console.error('Error details:', {
                message: err?.message,
                code: err?.code,
                stack: err?.stack
            });
            
            // ✅ Show user-friendly error message
            if (err?.message?.includes('not initialized')) {
                error('Firebase غير متصل - يرجى التحقق من الاتصال');
            } else if (err?.code === 'permission-denied') {
                error('ليس لديك صلاحية لإنشاء التقرير');
            } else if (err?.message?.includes('tenantId')) {
                error('معرف المستأجر غير صحيح');
            } else {
                const errorMsg = err?.message || 'خطأ غير معروف';
                error(`فشل في إنشاء التقرير: ${errorMsg.substring(0, 100)}`);
                console.error('Full error:', err);
            }
            haptic('error');
        } finally {
            setGenerating(false);
        }
    };

    const formatDate = (date: Date) => {
        // ✅ Format: Day Name, Day/Month/Year (Gregorian) - Full Hijri
        const dayName = date.toLocaleDateString('ar-SA', { weekday: 'long' });
        const day = date.getDate();
        const month = date.toLocaleDateString('ar-SA', { month: 'long' });
        const year = date.getFullYear();
        
        const gregorianDate = `${dayName} ${day} ${month} ${year}`;
        const hijriDate = formatHijriDate(date);
        
        return `${gregorianDate} (ميلادي) | ${hijriDate} (هجري)`;
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
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-text-tertiary)' }}>
                            {report ? (
                                <>
                                    <span className="block mb-1">
                                        <span className="font-medium">من:</span> {formatDate(report.reportPeriod.start)}
                                    </span>
                                    <span className="block">
                                        <span className="font-medium">إلى:</span> {formatDate(report.reportPeriod.end)}
                                    </span>
                                </>
                            ) : (
                                'لم يتم إنشاء تقرير بعد'
                            )}
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
                            <div className="grid grid-cols-4 gap-3">
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
                                <div className="text-center p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className={`text-2xl font-bold ${report.errorAnalysis?.totalErrors > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
                                        {report.errorAnalysis?.totalErrors || 0}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>أخطاء</p>
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
                                            metric.category === 'performance' ? <Clock className="w-5 h-5 text-yellow-400" /> :
                                            metric.category === 'quality' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                                            metric.category === 'connectivity' ? <Wifi className="w-5 h-5 text-blue-400" /> :
                                            metric.category === 'authentication' ? <Lock className="w-5 h-5 text-purple-400" /> :
                                            metric.category === 'database' ? <Database className="w-5 h-5 text-cyan-400" /> :
                                            metric.category === 'api' ? <Code className="w-5 h-5 text-green-400" /> :
                                            <Zap className="w-5 h-5 text-yellow-400" />
                                        }
                                    />
                                ))}
                            </div>

                            {/* Error Analysis */}
                            {report.errorAnalysis && report.errorAnalysis.totalErrors > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        <AlertTriangle className="w-4 h-4" />
                                        تحليل الأخطاء
                                    </p>
                                    <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div>
                                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي الأخطاء</p>
                                                <p className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                    {report.errorAnalysis.totalErrors}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>غير محلولة</p>
                                                <p className={`text-lg font-bold ${report.errorAnalysis.unresolvedErrors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                                    {report.errorAnalysis.unresolvedErrors}
                                                </p>
                                            </div>
                                        </div>
                                        {report.errorAnalysis.topErrors.length > 0 && (
                                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                                <p className="text-xs mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>أكثر الأخطاء تكراراً:</p>
                                                {report.errorAnalysis.topErrors.slice(0, 3).map((error, idx) => (
                                                    <div key={idx} className="text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                        <span className="font-medium">{error.count}x</span> - {error.message.substring(0, 60)}...
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Performance Analysis */}
                            {report.performanceAnalysis && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        <BarChart3 className="w-4 h-4" />
                                        تحليل الأداء
                                    </p>
                                    <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>متوسط وقت الاستجابة</p>
                                                <p className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                    {report.performanceAnalysis.averageResponseTime}s
                                                </p>
                                            </div>
                                            {report.performanceAnalysis.apiCallsCount > 0 && (
                                                <div>
                                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>مكالمات API</p>
                                                    <p className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {report.performanceAnalysis.apiCallsCount}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {report.performanceAnalysis.slowestEndpoints.length > 0 && (
                                            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border-primary)' }}>
                                                <p className="text-xs mb-2" style={{ color: 'var(--theme-text-tertiary)' }}>أبطأ Endpoints:</p>
                                                {report.performanceAnalysis.slowestEndpoints.slice(0, 3).map((endpoint, idx) => (
                                                    <div key={idx} className="text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                        <span className="font-medium">{endpoint.endpoint}</span> - {endpoint.avgTime}ms ({endpoint.count}x)
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Activity Timeline Preview */}
                            {report.activityTimeline && report.activityTimeline.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        <History className="w-4 h-4" />
                                        خط زمني للأحداث ({report.activityTimeline.length})
                                    </p>
                                    <div className="p-3 rounded-xl max-h-48 overflow-y-auto" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                        {report.activityTimeline.slice(0, 10).map((event, idx) => (
                                            <div key={idx} className="flex items-start gap-2 mb-2 text-xs">
                                                <div className={`w-2 h-2 rounded-full mt-1 ${
                                                    event.type === 'error' ? 'bg-red-400' :
                                                    event.type === 'warning' ? 'bg-yellow-400' :
                                                    event.type === 'info' ? 'bg-blue-400' : 'bg-green-400'
                                                }`} />
                                                <div className="flex-1">
                                                    <p style={{ color: 'var(--theme-text-secondary)' }}>{event.event}</p>
                                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        {new Date(event.timestamp).toLocaleString('ar-SA', { 
                                                            day: 'numeric', 
                                                            month: 'short', 
                                                            hour: '2-digit', 
                                                            minute: '2-digit' 
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {report.activityTimeline.length > 10 && (
                                            <p className="text-xs text-center mt-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                +{report.activityTimeline.length - 10} حدث آخر
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

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
                            <button
                                ref={buttonRef}
                                onClick={() => setShowFullReport(true)}
                                className="w-full py-3 rounded-xl bg-teal-500/10 text-teal-400 font-medium hover:bg-teal-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <Eye className="w-4 h-4" />
                                عرض التقرير الكامل للمبرمج
                            </button>
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

            {/* Full Report Popup */}
            {showFullReport && report && (
                <FullReportModal
                    report={report}
                    onClose={() => setShowFullReport(false)}
                    anchorRef={buttonRef}
                />
            )}
        </div>
    );
};

// ============================================================
// FULL REPORT MODAL COMPONENT
// ============================================================

interface FullReportModalProps {
    report: DataHealthReport;
    onClose: () => void;
    anchorRef?: React.RefObject<HTMLButtonElement>;
}

const FullReportModal: React.FC<FullReportModalProps> = ({ report, onClose, anchorRef }) => {
    const { success } = useUX();
    const [activeTab, setActiveTab] = useState<'errors' | 'performance' | 'userActivity' | 'requestStats' | 'database' | 'timeline' | 'console' | 'system' | 'raw'>('errors');
    const [copied, setCopied] = useState(false);
    const popupRef = React.useRef<HTMLDivElement>(null);
    const [position, setPosition] = React.useState({ top: 0, left: 0 });

    // ✅ FIX: Calculate position relative to button - ALWAYS show near button
    const updatePosition = React.useCallback(() => {
        if (popupRef.current && typeof window !== 'undefined') {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const isMobile = viewportWidth < 768; // Mobile breakpoint
            
            let left: number = 0;
            let top: number = 0;
            
            if (isMobile) {
                // ✅ MOBILE: Full screen, but scroll to button first
                if (anchorRef?.current) {
                    anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                left = 0;
                top = 0;
            } else {
                // ✅ DESKTOP: ALWAYS position relative to button
                if (anchorRef?.current) {
                    // ✅ CRITICAL: Scroll button into view first if needed
                    const buttonRect = anchorRef.current.getBoundingClientRect();
                    const isButtonVisible = 
                        buttonRect.top >= 0 && 
                        buttonRect.left >= 0 && 
                        buttonRect.bottom <= viewportHeight && 
                        buttonRect.right <= viewportWidth;
                    
                    // If button is not visible, scroll to it first
                    if (!isButtonVisible) {
                        anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Wait a bit for scroll to complete, then recalculate
                        setTimeout(() => {
                            const newButtonRect = anchorRef.current?.getBoundingClientRect();
                            if (newButtonRect && popupRef.current) {
                                const popupWidth = Math.min(1200, viewportWidth - 40);
                                const popupHeight = Math.min(800, viewportHeight - 40);
                                
                                // Position popup relative to button
                                left = newButtonRect.left + (newButtonRect.width / 2) - (popupWidth / 2);
                                top = newButtonRect.bottom + 10;
                                
                                // Adjust boundaries
                                if (left + popupWidth > viewportWidth - 20) left = viewportWidth - popupWidth - 20;
                                if (left < 20) left = 20;
                                if (top + popupHeight > viewportHeight - 20) {
                                    top = newButtonRect.top - popupHeight - 10;
                                }
                                if (top < 20) top = 20;
                                
                                setPosition({ top, left });
                            }
                        }, 300);
                        return; // Exit early, will update after scroll
                    }
                    
                    // Button is visible - position popup relative to button
                    const popupWidth = Math.min(1200, viewportWidth - 40);
                    const popupHeight = Math.min(800, viewportHeight - 40);
                    
                    // ✅ CRITICAL FIX: Position popup BELOW button (preferred) or ABOVE if no space
                    const spaceBelow = viewportHeight - buttonRect.bottom;
                    const spaceAbove = buttonRect.top;
                    
                    if (spaceBelow >= popupHeight + 20 || spaceBelow > spaceAbove) {
                        // Show below button
                        top = buttonRect.bottom + 10;
                    } else {
                        // Show above button
                        top = buttonRect.top - popupHeight - 10;
                    }
                    
                    // Center horizontally relative to button
                    left = buttonRect.left + (buttonRect.width / 2) - (popupWidth / 2);
                    
                    // Adjust if too far right
                    if (left + popupWidth > viewportWidth - 20) {
                        left = viewportWidth - popupWidth - 20;
                    }
                    
                    // Adjust if too far left
                    if (left < 20) {
                        left = 20;
                    }
                    
                    // ✅ CRITICAL FIX: Final boundary checks - ensure popup is visible
                    if (top < 20) {
                        top = 20;
                    }
                    if (top + popupHeight > viewportHeight - 20) {
                        // If popup doesn't fit, show it above button
                        if (buttonRect.top - popupHeight - 10 >= 20) {
                            top = buttonRect.top - popupHeight - 10;
                        } else {
                            // Last resort: center in viewport
                            top = Math.max(20, (viewportHeight - popupHeight) / 2);
                        }
                    }
                } else {
                    // No anchor - center in viewport (fallback)
                    const popupWidth = Math.min(1200, viewportWidth - 40);
                    const popupHeight = Math.min(800, viewportHeight - 40);
                    left = (viewportWidth - popupWidth) / 2;
                    top = (viewportHeight - popupHeight) / 2;
                }
            }
            
            setPosition({ top, left });
        }
    }, [anchorRef]);

    React.useEffect(() => {
        // ✅ CRITICAL: Calculate position IMMEDIATELY when modal opens - NO DELAY
        if (typeof window === 'undefined') return;
        
        const viewportWidth = window.innerWidth;
        const isMobile = viewportWidth < 768;
        
        if (isMobile) {
            // Mobile: scroll to button first, then show fullscreen
            if (anchorRef?.current) {
                anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setPosition({ top: 0, left: 0 });
        } else if (anchorRef?.current) {
            // Desktop: Calculate position immediately based on button location
            const buttonRect = anchorRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            // Check if button is visible
            const isButtonVisible = 
                buttonRect.top >= 0 && 
                buttonRect.left >= 0 && 
                buttonRect.bottom <= viewportHeight && 
                buttonRect.right <= viewportWidth;
            
            if (!isButtonVisible) {
                // Scroll button into view first
                anchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Wait for scroll, then calculate position
                setTimeout(() => {
                    updatePosition();
                }, 400);
            } else {
                // Button is visible - calculate position IMMEDIATELY (no delay)
                updatePosition();
            }
        } else {
            // No anchor - calculate position anyway
            updatePosition();
        }
        
        // Update position on resize or orientation change (but NOT on scroll to avoid blocking)
        window.addEventListener('resize', updatePosition);
        window.addEventListener('orientationchange', updatePosition);
        
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('orientationchange', updatePosition);
        };
    }, [updatePosition, anchorRef]);

    // Close on escape key
    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleCopyJSON = () => {
        if (!report) {
            error('التقرير غير متوفر');
            return;
        }
        
        // ✅ FIX: Convert all Date and Firestore Timestamp objects to ISO strings for proper JSON serialization
        const convertDatesToISO = (obj: any): any => {
            if (obj === null || obj === undefined) {
                return obj;
            }
            
            // Handle Firestore Timestamp
            if (obj && typeof obj.toDate === 'function') {
                return obj.toDate().toISOString();
            }
            
            // Handle Date objects
            if (obj instanceof Date) {
                return obj.toISOString();
            }
            
            // Handle objects with seconds property (Firestore Timestamp)
            if (obj && typeof obj.seconds === 'number') {
                return new Date(obj.seconds * 1000).toISOString();
            }
            
            // Handle arrays
            if (Array.isArray(obj)) {
                return obj.map(item => convertDatesToISO(item));
            }
            
            // Handle objects
            if (typeof obj === 'object') {
                const converted: any = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        converted[key] = convertDatesToISO(obj[key]);
                    }
                }
                return converted;
            }
            
            // Return primitive values as-is
            return obj;
        };
        
        // Convert the entire report to JSON-serializable format
        const serializableReport = convertDatesToISO(report);
        
        // Create formatted JSON string
        const jsonString = JSON.stringify(serializableReport, null, 2);
        
        navigator.clipboard.writeText(jsonString).then(() => {
            setCopied(true);
            success('تم نسخ التقرير الكامل إلى الحافظة');
            setTimeout(() => setCopied(false), 2000);
        }).catch((err) => {
            console.error('Failed to copy to clipboard:', err);
            error('فشل نسخ التقرير - يرجى المحاولة مرة أخرى');
        });
    };

    const handleDownloadJSON = () => {
        if (!report || !report.reportPeriod) {
            error('التقرير غير متوفر');
            return;
        }
        const jsonString = JSON.stringify(report, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // ✅ FIX: Safe date conversion for filename
        const startDate = report.reportPeriod?.start 
            ? (report.reportPeriod.start instanceof Date 
                ? report.reportPeriod.start 
                : (report.reportPeriod.start?.toDate ? report.reportPeriod.start.toDate() : new Date()))
            : new Date();
        a.download = `health-report-${startDate.toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        success('تم تحميل التقرير');
    };

    const handleExportExcel = () => {
        try {
            if (!report || !report.reportPeriod) {
                error('التقرير غير متوفر');
                return;
            }
            const { exportToExcel } = require('../../utils/exportUtils');
            // Prepare data for Excel export
            const exportData = {
                reportPeriod: {
                    from: formatDate(report.reportPeriod.start),
                    to: formatDate(report.reportPeriod.end)
                },
                overallHealth: report.overallHealth,
                totalIssues: report.totalIssues,
                resolvedIssues: report.resolvedIssues,
                criticalIssues: report.criticalIssues,
                errorAnalysis: report.errorAnalysis,
                performanceAnalysis: report.performanceAnalysis,
                userActivity: report.userActivity,
                requestStatistics: report.requestStatistics,
                databaseStatistics: report.databaseStatistics,
                systemResources: report.systemResources,
                consoleErrors: {
                    total: report.consoleErrors?.total || 0,
                    errorsByLevel: report.consoleErrors?.errorsByLevel || {}
                },
                systemInfo: report.systemInfo,
                firebaseStatus: report.firebaseStatus
            };
            // ✅ FIX: Safe date conversion for filename
            const startDate = report.reportPeriod?.start 
                ? (report.reportPeriod.start instanceof Date 
                    ? report.reportPeriod.start 
                    : (report.reportPeriod.start?.toDate ? report.reportPeriod.start.toDate() : new Date()))
                : new Date();
            exportToExcel(exportData, `health-report-${startDate.toISOString().split('T')[0]}.xlsx`);
            success('تم تصدير التقرير إلى Excel بنجاح');
        } catch (err: any) {
            console.error('Excel export failed:', err);
            error('فشل تصدير Excel: ' + (err?.message || 'خطأ غير معروف'));
        }
    };


    const formatDate = (date: Date | any) => {
        // ✅ Safe date conversion: Handle Firestore Timestamp, Date, or string
        let dateObj: Date;
        
        if (date instanceof Date) {
            dateObj = date;
        } else if (date?.toDate && typeof date.toDate === 'function') {
            // Firestore Timestamp
            dateObj = date.toDate();
        } else if (date?.seconds) {
            // Firestore Timestamp (seconds property)
            dateObj = new Date(date.seconds * 1000);
        } else if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            // Fallback: return error message instead of crashing
            return 'تاريخ غير صحيح';
        }
        
        // Validate date
        if (isNaN(dateObj.getTime())) {
            return 'تاريخ غير صحيح';
        }
        
        // ✅ Format: Day Name, Day/Month/Year (Gregorian) - Full Hijri
        const dayName = dateObj.toLocaleDateString('ar-SA', { weekday: 'long' });
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('ar-SA', { month: 'long' });
        const year = dateObj.getFullYear();
        
        const gregorianDate = `${dayName} ${day} ${month} ${year}`;
        
        const hijriDate = formatHijriDate(dateObj);
        
        return `${gregorianDate} (ميلادي) | ${hijriDate} (هجري)`;
    };
    
    const formatDateTime = (date: Date | any) => {
        // ✅ Safe date conversion: Handle Firestore Timestamp, Date, or string
        let dateObj: Date;
        
        if (date instanceof Date) {
            dateObj = date;
        } else if (date?.toDate && typeof date.toDate === 'function') {
            // Firestore Timestamp
            dateObj = date.toDate();
        } else if (date?.seconds) {
            // Firestore Timestamp (seconds property)
            dateObj = new Date(date.seconds * 1000);
        } else if (typeof date === 'string') {
            dateObj = new Date(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
            // Fallback: return error message instead of crashing
            return 'تاريخ غير صحيح';
        }
        
        // Validate date
        if (isNaN(dateObj.getTime())) {
            return 'تاريخ غير صحيح';
        }
        
        // ✅ Format with time: Day Name, Day/Month/Year HH:MM (Gregorian) - Full Hijri
        const dayName = dateObj.toLocaleDateString('ar-SA', { weekday: 'long' });
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('ar-SA', { month: 'long' });
        const year = dateObj.getFullYear();
        
        const time = dateObj.toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const gregorianDate = `${dayName} ${day} ${month} ${year} الساعة ${time}`;
        
        const hijriDate = formatHijriDate(dateObj);
        
        return `${gregorianDate} (ميلادي) | ${hijriDate} (هجري)`;
    };

    // ✅ MOBILE-FIRST: Detect mobile screen
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    // ✅ FIX: Ensure position is calculated - use actual position values
    const hasValidPosition = position.top > 0 || position.left > 0 || isMobile;
    
    return (
        <>
            {/* ✅ FIX: Backdrop that allows scrolling - only on mobile */}
            {isMobile && (
                <div 
                    className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm"
                    onClick={onClose}
                    style={{ 
                        pointerEvents: 'auto'
                    }}
                />
            )}
            <div 
                ref={popupRef}
                className={`fixed z-[100] ${isMobile ? 'inset-0 w-full h-full' : 'max-w-6xl max-h-[90vh] rounded-2xl'} overflow-hidden shadow-2xl animate-fade-in`}
                style={{ 
                    background: 'var(--theme-bg-secondary)',
                    top: isMobile ? '0' : (hasValidPosition && position.top > 0 ? `${position.top}px` : '50%'),
                    left: isMobile ? '0' : (hasValidPosition && position.left > 0 ? `${position.left}px` : '50%'),
                    transform: isMobile ? 'none' : (hasValidPosition && position.top > 0 ? 'none' : 'translate(-50%, -50%)'),
                    width: isMobile ? '100%' : 'min(1200px, calc(100vw - 40px))',
                    height: isMobile ? '100%' : 'auto',
                    maxHeight: isMobile ? '100vh' : 'calc(100vh - 40px)',
                    border: isMobile ? 'none' : '1px solid var(--theme-border-primary)',
                    borderRadius: isMobile ? '0' : '1rem',
                    pointerEvents: 'auto' // ✅ FIX: Allow interaction with popup
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Mobile Responsive */}
                <div className={`${isMobile ? 'p-3 sm:p-4' : 'p-6'} border-b`} style={{ borderColor: 'var(--theme-border-primary)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0`}>
                                <FileText className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-teal-400`} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className={`${isMobile ? 'text-base' : 'text-xl'} font-bold truncate`} style={{ color: 'var(--theme-text-primary)' }}>
                                    📊 تقرير صحة البيانات الكامل - للمبرمج
                                </h2>
                                <div className={`${isMobile ? 'text-xs' : 'text-sm'} space-y-0.5 sm:space-y-1`} style={{ color: 'var(--theme-text-tertiary)' }}>
                                    <p className="truncate">
                                        <span className="font-medium">من:</span> {formatDate(report.reportPeriod.start)}
                                    </p>
                                    <p className="truncate">
                                        <span className="font-medium">إلى:</span> {formatDate(report.reportPeriod.end)}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'} flex-shrink-0`}>
                            {/* Copy JSON Button - Mobile Responsive */}
                            <button
                                onClick={handleCopyJSON}
                                className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-lg hover:bg-white/10 transition-colors`}
                                style={{ color: 'var(--theme-text-secondary)' }}
                                title="نسخ JSON"
                            >
                                <Copy className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: copied ? '#4ade80' : undefined }} />
                            </button>
                            
                            {/* Download JSON Button - Mobile Responsive */}
                            <button
                                onClick={handleDownloadJSON}
                                className={`${isMobile ? 'p-1.5' : 'p-2'} rounded-lg hover:bg-white/10 transition-colors`}
                                style={{ color: 'var(--theme-text-secondary)' }}
                                title="تحميل JSON"
                            >
                                <Download className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                            </button>
                            
                            {/* Close Button - X Icon - Mobile Responsive */}
                            <button
                                onClick={onClose}
                                className={`flex items-center justify-center ${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md`}
                                title="إغلاق"
                            >
                                <X className={isMobile ? 'w-4 h-4' : 'w-5 h-5'} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs - Mobile Responsive */}
                <div className={`flex gap-1 sm:gap-2 ${isMobile ? 'p-2 sm:p-3' : 'p-4'} border-b overflow-x-auto`} style={{ borderColor: 'var(--theme-border-primary)' }}>
                    {[
                        { id: 'errors', label: '🔴 تحليل الأخطاء', icon: AlertTriangle },
                        { id: 'performance', label: '⚡ الأداء', icon: BarChart3 },
                        { id: 'userActivity', label: '👥 نشاط المستخدمين', icon: Activity },
                        { id: 'requestStats', label: '📝 إحصائيات الطلبات', icon: FileText },
                        { id: 'database', label: '🗄️ قاعدة البيانات', icon: Database },
                        { id: 'timeline', label: '📅 خط زمني', icon: History },
                        { id: 'console', label: '🖥️ أخطاء الكونسول', icon: Terminal },
                        { id: 'system', label: '⚙️ معلومات النظام', icon: Wifi },
                        { id: 'raw', label: '💻 JSON Raw', icon: Code }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-1.5 text-xs'} rounded-lg font-medium transition-colors flex items-center ${isMobile ? 'gap-1' : 'gap-1.5'} whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'bg-teal-500/20 text-teal-400'
                                        : 'hover:bg-white/5'
                                }`}
                                style={{ color: activeTab === tab.id ? undefined : 'var(--theme-text-secondary)' }}
                            >
                                <Icon className={isMobile ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
                                <span className="truncate max-w-[120px]">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content - Mobile Responsive */}
                <div className={`${isMobile ? 'p-3 sm:p-4' : 'p-6'} overflow-y-auto`} style={{ 
                    maxHeight: isMobile ? 'calc(100vh - 200px)' : 'calc(100vh - 300px)',
                    height: isMobile ? 'calc(100vh - 200px)' : 'auto',
                    WebkitOverflowScrolling: 'touch' // ✅ FIX: Smooth scrolling on mobile
                }}>
                    {activeTab === 'errors' && (
                        <div className="space-y-3 sm:space-y-4">
                            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-2 sm:gap-4`}>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي الأخطاء</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.errorAnalysis.totalErrors}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>غير محلولة</p>
                                    <p className={`text-2xl font-bold ${report.errorAnalysis.unresolvedErrors > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {report.errorAnalysis.unresolvedErrors}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>أنواع الأخطاء</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {Object.keys(report.errorAnalysis.errorsByType).length}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>الخدمات المتأثرة</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {Object.keys(report.errorAnalysis.errorsByService).length}
                                    </p>
                                </div>
                            </div>

                            {/* Errors by Type */}
                            <div>
                                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                    الأخطاء حسب النوع
                                </h3>
                                <div className="space-y-2">
                                    {Object.entries(report.errorAnalysis.errorsByType)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([type, count]) => (
                                            <div key={type} className="flex items-center justify-between p-3 rounded-xl"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <code className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{type}</code>
                                                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Errors by Service */}
                            <div>
                                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                    الأخطاء حسب الخدمة
                                </h3>
                                <div className="space-y-2">
                                    {Object.entries(report.errorAnalysis.errorsByService)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([service, count]) => (
                                            <div key={service} className="flex items-center justify-between p-3 rounded-xl"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <code className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{service}</code>
                                                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>

                            {/* Top Errors */}
                            <div>
                                <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                    أكثر الأخطاء تكراراً
                                </h3>
                                <div className="space-y-3">
                                    {report.errorAnalysis.topErrors.map((error, idx) => (
                                        <div key={idx} className="p-4 rounded-xl border"
                                            style={{ 
                                                background: 'var(--theme-bg-tertiary)',
                                                borderColor: 'var(--theme-border-primary)'
                                            }}>
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {error.message}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        آخر حدوث: {formatDateTime(error.lastOccurrence)} | التكرار: {error.count}x
                                                    </p>
                                                </div>
                                            </div>
                                            {error.stackTrace && (
                                                <details className="mt-2">
                                                    <summary className="text-xs cursor-pointer" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        Stack Trace
                                                    </summary>
                                                    <pre className="mt-2 p-3 rounded text-xs overflow-x-auto"
                                                        style={{ 
                                                            background: 'var(--theme-bg-primary)',
                                                            color: 'var(--theme-text-secondary)'
                                                        }}>
                                                        {error.stackTrace}
                                                    </pre>
                                                </details>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'performance' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>متوسط وقت الاستجابة</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.performanceAnalysis.averageResponseTime}s
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>استعلامات بطيئة</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.performanceAnalysis.slowQueries}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>مكالمات API</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.performanceAnalysis.apiCallsCount}
                                    </p>
                                </div>
                            </div>

                            {report.performanceAnalysis.slowestEndpoints.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        أبطأ Endpoints
                                    </h3>
                                    <div className="space-y-2">
                                        {report.performanceAnalysis.slowestEndpoints.map((endpoint, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <code className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    {endpoint.endpoint}
                                                </code>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        {endpoint.count}x
                                                    </span>
                                                    <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {endpoint.avgTime}ms
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'console' && (
                        <div className="space-y-4">
                            {report.consoleErrors ? (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي الأخطاء</p>
                                            <p className="text-2xl font-bold text-red-400">{report.consoleErrors?.total || 0}</p>
                                        </div>
                                        <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>Errors</p>
                                            <p className="text-2xl font-bold text-red-400">{report.consoleErrors?.errorsByLevel?.error || 0}</p>
                                        </div>
                                        <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>Warnings</p>
                                            <p className="text-2xl font-bold text-yellow-400">{report.consoleErrors?.errorsByLevel?.warn || 0}</p>
                                        </div>
                                        <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>Info</p>
                                            <p className="text-2xl font-bold text-blue-400">{report.consoleErrors?.errorsByLevel?.info || 0}</p>
                                        </div>
                                    </div>

                                    {/* Full Console Output */}
                                    {report.consoleErrors?.fullConsoleOutput && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                    📋 نسخة كاملة من أخطاء الكونسول
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(report.consoleErrors?.fullConsoleOutput || '');
                                                        success('تم نسخ أخطاء الكونسول إلى الحافظة');
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                                    style={{ 
                                                        background: 'var(--theme-bg-tertiary)',
                                                        color: 'var(--theme-text-primary)'
                                                    }}
                                                >
                                                    <Copy className="w-4 h-4 inline mr-1" />
                                                    نسخ الكل
                                                </button>
                                            </div>
                                            <pre 
                                                className="p-4 rounded-xl overflow-auto text-xs font-mono max-h-[600px]"
                                                style={{ 
                                                    background: 'var(--theme-bg-tertiary)',
                                                    color: 'var(--theme-text-secondary)',
                                                    border: '1px solid var(--theme-border-primary)'
                                                }}
                                            >
                                                {report.consoleErrors.fullConsoleOutput}
                                            </pre>
                                        </div>
                                    )}

                                    {/* Individual Errors List */}
                                    {report.consoleErrors?.errors && report.consoleErrors.errors.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                                قائمة الأخطاء التفصيلية ({report.consoleErrors.errors.length})
                                            </h3>
                                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                                {report.consoleErrors.errors.map((err, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className="p-3 rounded-xl border-l-4"
                                                        style={{ 
                                                            background: 'var(--theme-bg-tertiary)',
                                                            borderLeftColor: err.level === 'error' ? '#EF4444' : 
                                                                           err.level === 'warn' ? '#F59E0B' : 
                                                                           '#3B82F6'
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                                                    err.level === 'error' ? 'bg-red-500/20 text-red-400' :
                                                                    err.level === 'warn' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                    'bg-blue-500/20 text-blue-400'
                                                                }`}>
                                                                    {err.level.toUpperCase()}
                                                                </span>
                                                                {err.source && (
                                                                    <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                                        {err.source}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                                {formatDateTime(err.timestamp)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                                                            {err.message}
                                                        </p>
                                                        {err.stack && (
                                                            <details className="mt-2">
                                                                <summary className="text-xs cursor-pointer" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                                    Stack Trace
                                                                </summary>
                                                                <pre className="mt-2 text-xs font-mono p-2 rounded" style={{ 
                                                                    background: 'var(--theme-bg-primary)',
                                                                    color: 'var(--theme-text-secondary)'
                                                                }}>
                                                                    {err.stack}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p className="text-sm text-center py-8" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    لا توجد أخطاء في الكونسول
                                </p>
                            )}
                        </div>
                    )}

                    {activeTab === 'timeline' && (
                        <div className="space-y-2">
                            {report.activityTimeline.map((event, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-xl"
                                    style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                        event.type === 'error' ? 'bg-red-400' :
                                        event.type === 'warning' ? 'bg-yellow-400' :
                                        event.type === 'info' ? 'bg-blue-400' : 'bg-green-400'
                                    }`} />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                                            {event.event}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            {formatDateTime(event.timestamp)}
                                        </p>
                                        {event.details && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                {event.details}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'system' && (
                        <div className="space-y-4">
                            {/* System Info */}
                            {report.systemInfo && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        🌐 معلومات البيئة
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>المتصفح</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.browser} {report.systemInfo.browserVersion}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>نظام التشغيل</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.os}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>حجم الشاشة</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.screenSize}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>حجم النافذة</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.viewportSize}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>اللغة</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.language}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>المنطقة الزمنية</p>
                                            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                {report.systemInfo.timezone}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>الاتصال بالإنترنت</p>
                                            <p className={`text-sm font-medium ${report.systemInfo.online ? 'text-green-400' : 'text-red-400'}`}>
                                                {report.systemInfo.online ? '✅ متصل' : '❌ غير متصل'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>PWA مثبت</p>
                                            <p className={`text-sm font-medium ${report.systemInfo.pwaInstalled ? 'text-green-400' : 'text-gray-400'}`}>
                                                {report.systemInfo.pwaInstalled ? '✅ نعم' : '❌ لا'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Memory Info */}
                                    {report.systemInfo.memoryInfo && (
                                        <div className="mt-4">
                                            <h4 className="text-base font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                                                💾 معلومات الذاكرة
                                            </h4>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>المستخدم</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {(report.systemInfo.memoryInfo.usedJSHeapSize! / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>الإجمالي</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {(report.systemInfo.memoryInfo.totalJSHeapSize! / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>الحد الأقصى</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {(report.systemInfo.memoryInfo.jsHeapSizeLimit! / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Connection Info */}
                                    {report.systemInfo.connectionInfo && (
                                        <div className="mt-4">
                                            <h4 className="text-base font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                                                📡 معلومات الاتصال
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>نوع الاتصال</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {report.systemInfo.connectionInfo.effectiveType || 'Unknown'}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>السرعة (Mbps)</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {report.systemInfo.connectionInfo.downlink || 'Unknown'}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>RTT (ms)</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {report.systemInfo.connectionInfo.rtt || 'Unknown'}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>توفير البيانات</p>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {report.systemInfo.connectionInfo.saveData ? '✅ مفعل' : '❌ معطل'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Firebase Status */}
                            {report.firebaseStatus && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        🔥 حالة Firebase
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>الاتصال</p>
                                            <p className={`text-sm font-medium ${report.firebaseStatus.connected ? 'text-green-400' : 'text-red-400'}`}>
                                                {report.firebaseStatus.connected ? '✅ متصل' : '❌ غير متصل'}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>أخطاء القراءة</p>
                                            <p className="text-sm font-medium text-red-400">
                                                {report.firebaseStatus.readErrors}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>أخطاء الكتابة</p>
                                            <p className="text-sm font-medium text-red-400">
                                                {report.firebaseStatus.writeErrors}
                                            </p>
                                        </div>
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                            <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>تحذيرات Index</p>
                                            <p className={`text-sm font-medium ${report.firebaseStatus.indexWarnings > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                {report.firebaseStatus.indexWarnings}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Missing Indexes List */}
                                    {report.firebaseStatus.missingIndexes && report.firebaseStatus.missingIndexes.length > 0 && (
                                        <div>
                                            <h4 className="text-base font-bold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                                                ⚠️ Indexes المفقودة ({report.firebaseStatus.missingIndexes.length})
                                            </h4>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {report.firebaseStatus.missingIndexes.map((idx, idxIndex) => (
                                                    <div 
                                                        key={idxIndex}
                                                        className="p-3 rounded-xl border-l-4"
                                                        style={{ 
                                                            background: 'var(--theme-bg-tertiary)',
                                                            borderLeftColor: '#F59E0B'
                                                        }}
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <div>
                                                                <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                                    Collection: <code className="text-xs">{idx.collection}</code>
                                                                </p>
                                                                <p className="text-xs mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                                                    Query: {idx.query}
                                                                </p>
                                                            </div>
                                                            <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                                {formatDateTime(idx.timestamp)}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs mt-1" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                            Error: {idx.error}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'raw' && (
                        <div>
                            <pre className="p-4 rounded-xl overflow-x-auto text-xs"
                                style={{ 
                                    background: 'var(--theme-bg-primary)',
                                    color: 'var(--theme-text-secondary)'
                                }}>
                                {JSON.stringify(report, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* User Activity Tab */}
                    {activeTab === 'userActivity' && report.userActivity && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي المستخدمين</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.userActivity.totalUsers}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>المستخدمين النشطين</p>
                                    <p className="text-2xl font-bold text-teal-400">{report.userActivity.activeUsers}</p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>متوسط الطلبات/مستخدم</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.userActivity.requestsPerUser}
                                    </p>
                                </div>
                            </div>

                            {report.userActivity.mostActiveUsers.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        أكثر المستخدمين نشاطاً
                                    </h3>
                                    <div className="space-y-2">
                                        {report.userActivity.mostActiveUsers.map((user, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <div>
                                                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                                        {user.userName}
                                                    </p>
                                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        {user.userId}
                                                    </p>
                                                </div>
                                                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                    {user.requestCount} طلب
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Request Statistics Tab */}
                    {activeTab === 'requestStats' && report.requestStatistics && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي الطلبات</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.requestStatistics.totalRequests}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>متوسط وقت الإتمام</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.requestStatistics.averageCompletionTime} دقيقة
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>أسرع طلب</p>
                                    <p className="text-2xl font-bold text-green-400">
                                        {report.requestStatistics.fastestRequest} دقيقة
                                    </p>
                                </div>
                            </div>

                            {Object.keys(report.requestStatistics.requestsByType).length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        الطلبات حسب النوع
                                    </h3>
                                    <div className="space-y-2">
                                        {Object.entries(report.requestStatistics.requestsByType)
                                            .sort(([, a], [, b]) => b - a)
                                            .map(([type, count]) => (
                                                <div key={type} className="flex items-center justify-between p-3 rounded-xl"
                                                    style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{type}</span>
                                                    <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>{count}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {report.requestStatistics.peakHours.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        ساعات الذروة
                                    </h3>
                                    <div className="space-y-2">
                                        {report.requestStatistics.peakHours.map((peak, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    {peak.hour}:00
                                                </span>
                                                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                    {peak.count} طلب
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Database Statistics Tab */}
                    {activeTab === 'database' && report.databaseStatistics && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>إجمالي المستندات</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.databaseStatistics.totalDocuments.toLocaleString()}
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>التخزين المقدر</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.systemResources.estimatedStorage} MB
                                    </p>
                                </div>
                                <div className="p-4 rounded-xl" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                    <p className="text-xs mb-1" style={{ color: 'var(--theme-text-tertiary)' }}>القراءات المقدرة</p>
                                    <p className="text-2xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                        {report.systemResources.estimatedReads.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {Object.keys(report.databaseStatistics.collections).length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--theme-text-primary)' }}>
                                        Collections
                                    </h3>
                                    <div className="space-y-2">
                                        {Object.entries(report.databaseStatistics.collections)
                                            .sort(([, a], [, b]) => b.count - a.count)
                                            .map(([name, data]) => (
                                                <div key={name} className="flex items-center justify-between p-3 rounded-xl"
                                                    style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                    <code className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{name}</code>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                            {data.growth > 0 ? `+${data.growth}%` : data.growth < 0 ? `${data.growth}%` : '0%'}
                                                        </span>
                                                        <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>
                                                            {data.count.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default DataHealthReportCard;
