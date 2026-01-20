/**
 * Advanced Log Viewer Component
 * Comprehensive log viewing with filtering, export, and analytics
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    X, Filter, Calendar, History, RefreshCw, Printer, Download,
    Clock, User, MapPin, ChevronDown, ChevronUp, Search, BarChart3,
    FileText, FileSpreadsheet, AlertTriangle, CheckCircle, Info,
    Shield, Users, Package, DollarSign, Settings, Lock, Zap,
    TrendingUp, Activity, ChevronLeft, ChevronRight, Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader } from '../common/AdoraLoader';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { useTenantData, useTenantBranches } from '../../hooks/useTenantData';
import {
    getLogs, getLogStats, subscribeToLogs, downloadCSV, printLogs,
    AdvancedLogEntry, LogFilter, LogStats, LogCategory, LogSeverity, LogAction,
    CATEGORY_CONFIG, SEVERITY_CONFIG, ACTION_CONFIG, formatTimeAgo
} from '../../services/advancedLogService';

// ============================================================
// TYPES
// ============================================================

interface AdvancedLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    defaultCategory?: LogCategory;
    defaultDepartment?: string;
}

type ViewMode = 'list' | 'timeline' | 'stats';
type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

// ============================================================
// CATEGORY ICONS
// ============================================================

const CategoryIcon: React.FC<{ category: LogCategory; className?: string }> = ({ category, className = "w-5 h-5" }) => {
    const icons: Record<LogCategory, React.ReactNode> = {
        all: <History className={className} />,
        authentication: <Lock className={className} />,
        requests: <Zap className={className} />,
        rooms: <Building2 className={className} />,
        employees: <Users className={className} />,
        guests: <User className={className} />,
        inventory: <Package className={className} />,
        financial: <DollarSign className={className} />,
        system: <Settings className={className} />,
        security: <Shield className={className} />,
    };
    return <>{icons[category]}</>;
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AdvancedLogViewer: React.FC<AdvancedLogViewerProps> = ({
    isOpen,
    onClose,
    defaultCategory = 'all',
    defaultDepartment,
}) => {
    const { user } = useAuth();
    const { haptic, success } = useUX();
    const { activeTenant } = useTenantData();
    const { branches } = useTenantBranches();
    const { t } = useTranslation();
    
    const tenantId = (user as any)?.tenantId || '';
    const branchId = (user as any)?.branch || '';
    
    // State
    const [logs, setLogs] = useState<AdvancedLogEntry[]>([]);
    const [stats, setStats] = useState<LogStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [showFilters, setShowFilters] = useState(false);
    
    // Filter state
    const [period, setPeriod] = useState<PeriodType>('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<LogCategory[]>(
        defaultCategory === 'all' ? [] : [defaultCategory]
    );
    const [selectedSeverities, setSelectedSeverities] = useState<LogSeverity[]>([]);
    const [searchText, setSearchText] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState<string>(defaultDepartment || '');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [selectedBranch, setSelectedBranch] = useState(branchId);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const PAGE_SIZE = 50;
    
    // Expanded item
    const [expandedLog, setExpandedLog] = useState<string | null>(null);
    
    // ============================================================
    // DATE RANGE
    // ============================================================
    
    const getDateRange = useCallback((p: PeriodType): { start: Date; end: Date } => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (p) {
            case 'today':
                return { start: today, end: now };
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return { start: yesterday, end: today };
            case 'week':
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return { start: weekAgo, end: now };
            case 'month':
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                return { start: monthAgo, end: now };
            case 'custom':
                return {
                    start: customStartDate ? new Date(customStartDate) : today,
                    end: customEndDate ? new Date(customEndDate + 'T23:59:59') : now,
                };
            default:
                return { start: today, end: now };
        }
    }, [customStartDate, customEndDate]);
    
    // ============================================================
    // REAL-TIME DATA LOADING (onSnapshot)
    // ============================================================
    
    // ✅ FIX: Use onSnapshot for real-time updates (no refresh needed)
    useEffect(() => {
        if (!isOpen || !tenantId) return;
        
        setLoading(true);
        
        const { start, end } = getDateRange(period);
        
        const filter: LogFilter = {
            startDate: start,
            endDate: end,
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            severities: selectedSeverities.length > 0 ? selectedSeverities : undefined,
            actorDepartment: selectedDepartment || undefined,
            roomNumber: selectedRoom || undefined,
            searchText: searchText || undefined,
            limit: PAGE_SIZE,
        };
        
        // ✅ Subscribe to real-time updates
        const unsubscribe = subscribeToLogs(
            tenantId,
            selectedBranch || branchId,
            filter,
            (fetchedLogs) => {
                setLogs(fetchedLogs);
                setHasMore(fetchedLogs.length >= PAGE_SIZE);
                setLoading(false);
                
                // Load stats if on stats view (async, doesn't block)
                if (viewMode === 'stats') {
                    getLogStats(tenantId, selectedBranch || branchId, start, end).then(statsData => {
                        setStats(statsData);
                    }).catch(err => {
                        console.error('Error loading stats:', err);
                    });
                }
            }
        );
        
        // ✅ Cleanup function
        return () => {
            unsubscribe();
        };
    }, [isOpen, tenantId, branchId, period, selectedCategories, selectedSeverities, selectedDepartment, selectedRoom, searchText, selectedBranch, getDateRange, viewMode]);
    
    // ============================================================
    // HANDLERS
    // ============================================================
    
    const toggleCategory = (cat: LogCategory) => {
        setSelectedCategories(prev => 
            prev.includes(cat) 
                ? prev.filter(c => c !== cat)
                : [...prev, cat]
        );
    };
    
    const toggleSeverity = (sev: LogSeverity) => {
        setSelectedSeverities(prev =>
            prev.includes(sev)
                ? prev.filter(s => s !== sev)
                : [...prev, sev]
        );
    };
    
    const handleExportCSV = () => {
        downloadCSV(logs, `سجل_العمليات_${activeTenant?.name || 'فندق'}`);
        haptic('success');
        success('تم تصدير السجل بنجاح');
    };
    
    const handlePrint = () => {
        const { start, end } = getDateRange(period);
        const dateRange = `من ${start.toLocaleDateString('ar-SA')} إلى ${end.toLocaleDateString('ar-SA')}`;
        
        const hotelName = activeTenant?.name || 'فندق أدورا';
        const branchName = branches.find(b => b.id === selectedBranch)?.name;
        const fullName = branchName ? `${hotelName} - ${branchName}` : hotelName;
        
        printLogs(logs, fullName, dateRange);
        haptic('success');
        success('جاري الطباعة...');
    };
    
    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedSeverities([]);
        setSearchText('');
        setSelectedDepartment('');
        setSelectedRoom('');
        setPeriod('today');
    };
    
    // ============================================================
    // COMPUTED
    // ============================================================
    
    const filteredLogs = useMemo(() => logs, [logs]);
    
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (selectedCategories.length > 0) count++;
        if (selectedSeverities.length > 0) count++;
        if (selectedDepartment) count++;
        if (selectedRoom) count++;
        if (searchText) count++;
        return count;
    }, [selectedCategories, selectedSeverities, selectedDepartment, selectedRoom, searchText]);
    
    // ============================================================
    // RENDER
    // ============================================================
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4" dir="rtl">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 w-full max-w-md sm:max-w-lg lg:max-w-2xl xl:max-w-3xl max-h-[95vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
                
                {/* Header */}
                <div className="flex-shrink-0 p-4 md:p-6 border-b border-white/10 bg-slate-900/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30">
                                <History className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-white">سجل العمليات المتقدم</h2>
                                <p className="text-white/50 text-sm">{filteredLogs.length} عملية</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {/* View Mode Toggle */}
                            <div className="flex rounded-xl bg-white/5 p-1">
                                {(['list', 'timeline', 'stats'] as ViewMode[]).map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setViewMode(mode)}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                            viewMode === mode
                                                ? 'bg-teal-500 text-white'
                                                : 'text-white/60 hover:text-white'
                                        }`}
                                    >
                                        {mode === 'list' ? (t('common.list') || 'قائمة') : mode === 'timeline' ? (t('common.timeline') || 'خط زمني') : (t('common.statistics') || 'إحصائيات')}
                                    </button>
                                ))}
                            </div>
                            
                            {/* Actions */}
                            <button
                                onClick={handleExportCSV}
                                className="p-2.5 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                title={t('common.exportExcel') || 'تصدير Excel'}
                            >
                                <FileSpreadsheet className="w-5 h-5" />
                            </button>
                            
                            <button
                                onClick={handlePrint}
                                className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                                title={t('common.print') || 'طباعة'}
                            >
                                <Printer className="w-5 h-5" />
                            </button>
                            
                            <button
                                onClick={loadData}
                                className="p-2.5 rounded-xl bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                                title={t('common.refresh') || 'تحديث'}
                            >
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-xl bg-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Filters Bar */}
                <div className="flex-shrink-0 p-4 border-b border-white/10 space-y-3">
                    {/* Search & Quick Filters */}
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="بحث في السجل..."
                                className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-teal-500 focus:outline-none"
                            />
                        </div>
                        
                        {/* Period */}
                        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                            {(['today', 'yesterday', 'week', 'month', 'custom'] as PeriodType[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                                        period === p
                                            ? 'bg-teal-500 text-white'
                                            : 'text-white/60 hover:text-white'
                                    }`}
                                >
                                    {p === 'today' ? (t('common.today') || 'اليوم') :
                                     p === 'yesterday' ? (t('common.yesterday') || 'أمس') :
                                     p === 'week' ? (t('common.week') || 'أسبوع') :
                                     p === 'month' ? (t('common.month') || 'شهر') : (t('common.custom') || 'مخصص')}
                                </button>
                            ))}
                        </div>
                        
                        {/* Filter Toggle */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${
                                showFilters || activeFiltersCount > 0
                                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                            }`}
                        >
                            <Filter className="w-4 h-4" />
                            <span>فلترة</span>
                            {activeFiltersCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-teal-500 text-white text-xs">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </button>
                    </div>
                    
                    {/* Custom Date Range */}
                    {period === 'custom' && (
                        <div className="flex gap-3 items-end">
                            <div className="flex-1">
                                <label className="text-xs text-white/40 mb-1 block">من تاريخ</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 focus:border-teal-500 focus:outline-none"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-white/40 mb-1 block">إلى تاريخ</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 focus:border-teal-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={loadData}
                                className="px-4 py-2 rounded-xl bg-teal-500 text-white font-medium hover:bg-teal-400 transition-colors"
                            >
                                تطبيق
                            </button>
                        </div>
                    )}
                    
                    {/* Advanced Filters */}
                    {showFilters && (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                            {/* Categories */}
                            <div>
                                <label className="text-sm text-white/60 mb-2 block">الفئات</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(CATEGORY_CONFIG).filter(([key]) => key !== 'all').map(([key, config]) => (
                                        <button
                                            key={key}
                                            onClick={() => toggleCategory(key as LogCategory)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                                selectedCategories.includes(key as LogCategory)
                                                    ? `bg-${config.color}-500/20 text-${config.color}-400 border border-${config.color}-500/30`
                                                    : 'bg-white/5 text-white/60 hover:text-white border border-transparent'
                                            }`}
                                        >
                                            <span>{config.icon}</span>
                                            <span>{config.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Severities */}
                            <div>
                                <label className="text-sm text-white/60 mb-2 block">مستوى الأهمية</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                                        <button
                                            key={key}
                                            onClick={() => toggleSeverity(key as LogSeverity)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                                                selectedSeverities.includes(key as LogSeverity)
                                                    ? `bg-${config.color}-500/20 text-${config.color}-400 border border-${config.color}-500/30`
                                                    : 'bg-white/5 text-white/60 hover:text-white border border-transparent'
                                            }`}
                                        >
                                            <span>{config.icon}</span>
                                            <span>{config.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Department & Room */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-sm text-white/60 mb-2 block">القسم</label>
                                    <select
                                        value={selectedDepartment}
                                        onChange={(e) => setSelectedDepartment(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 focus:border-teal-500 focus:outline-none"
                                    >
                                        <option value="">كل الأقسام</option>
                                        <option value="reception">الاستقبال</option>
                                        <option value="housekeeping">النظافة</option>
                                        <option value="bellman">البيلمان</option>
                                        <option value="maintenance">الصيانة</option>
                                        <option value="admin">الإدارة</option>
                                    </select>
                                </div>
                                
                                <div className="flex-1">
                                    <label className="text-sm text-white/60 mb-2 block">رقم الغرفة</label>
                                    <input
                                        type="text"
                                        value={selectedRoom}
                                        onChange={(e) => setSelectedRoom(e.target.value)}
                                        placeholder={t('common.exampleRoomNumber') || 'مثال: 101'}
                                        className="w-full px-3 py-2 rounded-xl bg-white/5 text-white placeholder-white/40 border border-white/10 focus:border-teal-500 focus:outline-none"
                                    />
                                </div>
                                
                                {branches.length > 1 && (
                                    <div className="flex-1">
                                        <label className="text-sm text-white/60 mb-2 block">الفرع</label>
                                        <select
                                            value={selectedBranch}
                                            onChange={(e) => setSelectedBranch(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 focus:border-teal-500 focus:outline-none"
                                        >
                                            <option value="">كل الفروع</option>
                                            {branches.map(branch => (
                                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            {/* Clear Filters */}
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                                >
                                    مسح كل الفلاتر
                                </button>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <AdoraLoader size="lg" message="جاري تحميل السجل..." />
                        </div>
                    ) : viewMode === 'stats' ? (
                        // Stats View
                        <StatsView stats={stats} logs={filteredLogs} />
                    ) : viewMode === 'timeline' ? (
                        // Timeline View
                        <TimelineView logs={filteredLogs} />
                    ) : (
                        // List View
                        <div className="space-y-2">
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-20 text-white/40">
                                    <History className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p className="text-lg">لا توجد عمليات في هذه الفترة</p>
                                    <p className="text-sm mt-2">جرب تغيير الفترة الزمنية أو الفلاتر</p>
                                </div>
                            ) : (
                                filteredLogs.map(log => (
                                    <LogItem
                                        key={log.id}
                                        log={log}
                                        isExpanded={expandedLog === log.id}
                                        onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id!)}
                                    />
                                ))
                            )}
                            
                            {/* Load More */}
                            {hasMore && (
                                <div className="text-center py-4">
                                    <button
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-6 py-2 rounded-xl bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                                    >
                                        تحميل المزيد
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// LOG ITEM COMPONENT
// ============================================================

const LogItem: React.FC<{
    log: AdvancedLogEntry;
    isExpanded: boolean;
    onToggle: () => void;
}> = ({ log, isExpanded, onToggle }) => {
    const categoryConfig = CATEGORY_CONFIG[log.category];
    const severityConfig = SEVERITY_CONFIG[log.severity];
    
    const severityColors: Record<LogSeverity, string> = {
        info: 'border-l-blue-400',
        success: 'border-l-green-400',
        warning: 'border-l-yellow-400',
        error: 'border-l-red-400',
        critical: 'border-l-red-600',
    };
    
    return (
        <div
            className={`rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer overflow-hidden border-r-4 ${severityColors[log.severity]}`}
            onClick={onToggle}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Category Icon */}
                    <div className={`w-10 h-10 rounded-xl bg-${categoryConfig.color}-500/20 flex items-center justify-center flex-shrink-0`}>
                        <CategoryIcon category={log.category} className={`w-5 h-5 text-${categoryConfig.color}-400`} />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium">{log.title}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs bg-${categoryConfig.color}-500/20 text-${categoryConfig.color}-400`}>
                                {categoryConfig.label}
                            </span>
                            {log.roomNumber && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {log.roomNumber}
                                </span>
                            )}
                        </div>
                        
                        <p className="text-white/60 text-sm mt-1 line-clamp-1">{log.description}</p>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-white/40">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTimeAgo(log.timestamp)}
                            </span>
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.actorName}
                            </span>
                            <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {log.actorDepartment}
                            </span>
                        </div>
                    </div>
                    
                    {/* Severity & Expand */}
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{severityConfig.icon}</span>
                        {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-white/40" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-white/40" />
                        )}
                    </div>
                </div>
            </div>
            
            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 border-t border-white/10 pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                            <span className="text-white/40 text-xs">التاريخ والوقت</span>
                            <p className="text-white">{log.timestamp.toLocaleString('ar-SA')}</p>
                        </div>
                        <div>
                            <span className="text-white/40 text-xs">نوع الهدف</span>
                            <p className="text-white">{log.targetType}</p>
                        </div>
                        <div>
                            <span className="text-white/40 text-xs">معرف الهدف</span>
                            <p className="text-white font-mono text-xs">{log.targetId}</p>
                        </div>
                        {log.duration && (
                            <div>
                                <span className="text-white/40 text-xs">المدة</span>
                                <p className="text-white">{log.duration} ثانية</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Metadata */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-3 p-3 rounded-xl bg-black/20">
                            <span className="text-white/40 text-xs block mb-2">بيانات إضافية</span>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                {Object.entries(log.metadata).map(([key, value]) => (
                                    value !== undefined && value !== null && (
                                        <div key={key}>
                                            <span className="text-white/50">{key}:</span>
                                            <span className="text-white mr-2">{String(value)}</span>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Before/After Values */}
                    {(log.previousValue || log.newValue) && (
                        <div className="mt-3 flex gap-3">
                            {log.previousValue && (
                                <div className="flex-1 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <span className="text-red-400 text-xs block mb-1">القيمة السابقة</span>
                                    <p className="text-white text-sm">{JSON.stringify(log.previousValue)}</p>
                                </div>
                            )}
                            {log.newValue && (
                                <div className="flex-1 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <span className="text-green-400 text-xs block mb-1">القيمة الجديدة</span>
                                    <p className="text-white text-sm">{JSON.stringify(log.newValue)}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================================
// TIMELINE VIEW
// ============================================================

const TimelineView: React.FC<{ logs: AdvancedLogEntry[] }> = ({ logs }) => {
    // Group logs by date
    const groupedLogs = useMemo(() => {
        const groups: Record<string, AdvancedLogEntry[]> = {};
        logs.forEach(log => {
            const dateKey = log.timestamp.toLocaleDateString('ar-SA');
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(log);
        });
        return groups;
    }, [logs]);
    
    return (
        <div className="space-y-6">
            {Object.entries(groupedLogs).map(([date, dayLogs]) => (
                <div key={date}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                        <h3 className="text-white font-bold">{date}</h3>
                        <span className="text-white/40 text-sm">({dayLogs.length} عملية)</span>
                    </div>
                    
                    <div className="mr-1.5 border-r-2 border-white/10 pr-6 space-y-3">
                        {dayLogs.map(log => (
                            <div key={log.id} className="relative">
                                <div className="absolute -right-[1.85rem] top-2 w-2 h-2 rounded-full bg-white/30"></div>
                                <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <span>{SEVERITY_CONFIG[log.severity].icon}</span>
                                        <span className="text-white font-medium">{log.title}</span>
                                        <span className="text-white/40 text-xs">
                                            {log.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-white/60 text-sm mt-1">{log.description}</p>
                                    <p className="text-white/40 text-xs mt-1">{log.actorName} - {log.actorDepartment}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================================
// STATS VIEW
// ============================================================

const StatsView: React.FC<{ stats: LogStats | null; logs: AdvancedLogEntry[] }> = ({ stats, logs }) => {
    if (!stats) return <AdoraLoader size="lg" message="جاري تحميل الإحصائيات..." />;
    
    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Activity className="w-5 h-5" />
                        <span className="text-sm">إجمالي العمليات</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm">ناجحة</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.bySeverity.success}</p>
                </div>
                
                <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm">تحذيرات</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.bySeverity.warning}</p>
                </div>
                
                <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <X className="w-5 h-5" />
                        <span className="text-sm">أخطاء</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.bySeverity.error + stats.bySeverity.critical}</p>
                </div>
            </div>
            
            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* By Category */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-teal-400" />
                        حسب الفئة
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(stats.byCategory)
                            .filter(([key, count]) => key !== 'all' && count > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([category, count]) => {
                                const config = CATEGORY_CONFIG[category as LogCategory];
                                const percentage = (count / stats.total) * 100;
                                return (
                                    <div key={category}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-white/70 flex items-center gap-2">
                                                <span>{config.icon}</span>
                                                {config.label}
                                            </span>
                                            <span className="text-white">{count}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                            <div 
                                                className={`h-full bg-${config.color}-500 transition-all`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
                
                {/* Top Actors */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-teal-400" />
                        أكثر الموظفين نشاطاً
                    </h3>
                    <div className="space-y-3">
                        {stats.topActors.slice(0, 5).map((actor, idx) => (
                            <div key={actor.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                        idx === 0 ? 'bg-yellow-500 text-yellow-900' :
                                        idx === 1 ? 'bg-gray-300 text-gray-700' :
                                        idx === 2 ? 'bg-amber-600 text-amber-100' :
                                        'bg-white/10 text-white/60'
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-white">{actor.name}</span>
                                </div>
                                <span className="text-teal-400 font-bold">{actor.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Activity by Hour */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-400" />
                    النشاط حسب الساعة
                </h3>
                <div className="flex items-end gap-1 h-32">
                    {Array.from({ length: 24 }, (_, hour) => {
                        const count = stats.byHour[hour] || 0;
                        const maxCount = Math.max(...Object.values(stats.byHour), 1);
                        const height = (count / maxCount) * 100;
                        
                        return (
                            <div 
                                key={hour}
                                className="flex-1 flex flex-col items-center gap-1"
                            >
                                <div 
                                    className="w-full rounded-t bg-gradient-to-t from-teal-600 to-teal-400 transition-all hover:from-teal-500 hover:to-teal-300"
                                    style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}
                                    title={`${hour}:00 - ${count} عملية`}
                                />
                                <span className="text-white/30 text-[8px]">{hour}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AdvancedLogViewer;
