/**
 * Unified History Modal Component
 * View and filter history across all departments
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    X, Filter, Calendar, History, RefreshCw, Printer, Download,
    Clock, User, MapPin, ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdoraLoader } from '../common/AdoraLoader';
import { useUX } from '../../context/UXContext';
import {
    UnifiedHistoryItem, DepartmentType, HistoryFilter,
    getUnifiedHistory, getHistorySummary, formatDisplayDate,
    ACTION_LABELS, STATUS_LABELS
} from '../../services/unifiedHistoryService';
import { useTenantData, useTenantBranches } from '../../hooks/useTenantData';

// ============================================================
// TYPES
// ============================================================

interface UnifiedHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultDepartment?: DepartmentType;
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
    all: 'جميع الأقسام',
    reception: 'الاستقبال',
    bellman: 'البيلمان',
    housekeeping: 'الهاوس كيبنج',
    maintenance: 'الصيانة',
    procurement: 'المشتريات',
    laundry: 'المغسلة', // Keep for type safety but we might filter it out or keep it if needed later
};

const DEPARTMENT_ICONS: Record<DepartmentType, string> = {
    all: '📋',
    reception: '🛎️',
    bellman: '🧳',
    housekeeping: '🧹',
    maintenance: '🔧',
    procurement: '🛒',
    laundry: '🧺',
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const UnifiedHistoryModal: React.FC<UnifiedHistoryModalProps> = ({
    isOpen,
    onClose,
    defaultDepartment = 'all'
}) => {
    const { user } = useAuth();
    const { haptic, playSound, success } = useUX();
    const branchId = (user as any)?.branch || 'default';
    const tenantId = (user as any)?.tenantId || 'default';

    // State
    const [items, setItems] = useState<UnifiedHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    // Filter state
    const [period, setPeriod] = useState<PeriodType>('today');
    const [department, setDepartment] = useState<DepartmentType>(defaultDepartment);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [roomFilter, setRoomFilter] = useState<string>('');
    const [sortBy, setSortBy] = useState<'timestamp' | 'department' | 'status'>('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Get date range based on period
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
                    end: customEndDate ? new Date(customEndDate) : now,
                };
            default:
                return { start: today, end: now };
        }
    }, [customStartDate, customEndDate]);

    // Load data
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRange(period);
            const filter: HistoryFilter = {
                startDate: start,
                endDate: end,
                department: department === 'all' ? undefined : department,
                status: statusFilter || undefined,
                roomNumber: roomFilter || undefined,
                maxResults: 500, // ✅ Increased for better filtering
            };

            let data = await getUnifiedHistory(branchId, tenantId, filter);
            
            // ✅ Apply client-side search filter
            if (searchText.trim()) {
                const query = searchText.toLowerCase();
                data = data.filter(item =>
                    item.description.toLowerCase().includes(query) ||
                    item.employeeName?.toLowerCase().includes(query) ||
                    item.roomNumber?.toLowerCase().includes(query) ||
                    item.action.toLowerCase().includes(query)
                );
            }

            // ✅ Apply sorting
            data.sort((a, b) => {
                let comparison = 0;
                switch (sortBy) {
                    case 'timestamp':
                        comparison = a.timestamp.getTime() - b.timestamp.getTime();
                        break;
                    case 'department':
                        comparison = a.type.localeCompare(b.type);
                        break;
                    case 'status':
                        comparison = (a.status || '').localeCompare(b.status || '');
                        break;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });

            setItems(data);
        } catch (err: any) {
            // ✅ Handle Firestore internal errors gracefully
            if (err?.message?.includes('INTERNAL ASSERTION FAILED')) {
                console.warn('Firestore internal error in loadData (likely cache issue)', err);
            } else {
                console.error('Error loading history:', err);
            }
        }
        setLoading(false);
    }, [branchId, tenantId, period, department, searchText, statusFilter, roomFilter, sortBy, sortOrder, getDateRange]);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, loadData]);

    // Summary stats
    const summary = useMemo(() => getHistorySummary(items), [items]);

    // Get Tenant Data for Report Header
    const { activeTenant } = useTenantData();
    const { branches } = useTenantBranches();

    // Print accounting report
    const handlePrint = () => {
        const { start, end } = getDateRange(period);
        const dateStr = `من ${start.toLocaleDateString('ar')} إلى ${end.toLocaleDateString('ar')}`;

        // ✅ Get chain name and branch name
        const chainName = activeTenant?.name || 'فندق أدورا';
        const currentBranch = branches.find(b => b.id === branchId);
        const branchName = currentBranch?.name || '';
        const fullName = branchName ? `${chainName} - ${branchName}` : chainName;

        const printContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>تقرير العمليات - ${fullName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            font-size: 10pt;
            padding: 15mm;
            color: #000;
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #000; 
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .header h1 { font-size: 16pt; margin-bottom: 5px; }
        .header p { font-size: 10pt; color: #333; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 9pt;
            margin-bottom: 15px;
        }
        th, td { 
            border: 1px solid #000; 
            padding: 4px 6px; 
            text-align: right;
        }
        th { 
            background: #f0f0f0; 
            font-weight: bold;
        }
        .summary {
            display: flex;
            justify-content: space-between;
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 20px;
        }
        .summary-item { text-align: center; }
        .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature {
            border-top: 1px solid #000;
            width: 150px;
            text-align: center;
            padding-top: 5px;
        }
        @media print {
            body { padding: 5mm; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${fullName}</h1>
        <p>تقرير العمليات</p>
        <p>${dateStr}</p>
        <p>القسم: ${DEPARTMENT_LABELS[department]}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th style="width: 60px">الوقت</th>
                <th style="width: 80px">القسم</th>
                <th>العملية</th>
                <th style="width: 50px">الغرفة</th>
                <th style="width: 80px">الموظف</th>
                <th style="width: 60px">الحالة</th>
            </tr>
        </thead>
        <tbody>
            ${items.map(item => `
                <tr>
                    <td>${item.timestamp.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${DEPARTMENT_LABELS[item.type]}</td>
                    <td>${item.description}</td>
                    <td>${item.roomNumber || '-'}</td>
                    <td>${item.employeeName || '-'}</td>
                    <td>${STATUS_LABELS[item.status || ''] || item.status || '-'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="summary">
        <div class="summary-item">
            <strong>إجمالي العمليات:</strong> ${items.length}
        </div>
        <div class="summary-item">
            <strong>البيلمان:</strong> ${summary.byDepartment.bellman}
        </div>
        <div class="summary-item">
            <strong>الهاوس كيبنج:</strong> ${summary.byDepartment.housekeeping}
        </div>
        <div class="summary-item">
            <strong>الصيانة:</strong> ${summary.byDepartment.maintenance}
        </div>
    </div>
    
    <div class="footer">
        <div class="signature">التوقيع</div>
        <div class="signature">التاريخ</div>
    </div>
</body>
</html>
        `;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(printContent);
            win.document.close();

            // ✅ Auto-close after print
            win.onafterprint = () => {
                win.close();
            };

            // Wait for content to load then print
            setTimeout(() => {
                win.print();
            }, 500);
        }

        haptic('success');
        success('جاري الطباعة...');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-card w-full max-w-md sm:max-w-lg lg:max-w-2xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-3xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <History className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">{t('common.operationsHistory') || 'سجل العمليات'}</h3>
                            <p className="text-sm text-white/60">{summary.totalItems} {t('common.operation') || 'عملية'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrint}
                            className="px-3 py-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4" />
                            {t('common.print') || 'طباعة'}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 border-b border-white/10 space-y-3">
                    {/* Search Bar */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder={t('common.searchInLogs') || 'بحث في السجل...'}
                            className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-blue-500 focus:outline-none"
                        />
                        {searchText && (
                            <button
                                onClick={() => setSearchText('')}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Period Pills */}
                    <div className="flex flex-wrap gap-2">
                        {(['today', 'yesterday', 'week', 'month', 'custom'] as PeriodType[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${period === p
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                                    }`}
                            >
                                {p === 'today' ? 'اليوم' :
                                    p === 'yesterday' ? 'أمس' :
                                        p === 'week' ? 'هذا الأسبوع' :
                                            p === 'month' ? 'هذا الشهر' : 'مخصص'}
                            </button>
                        ))}
                    </div>

                    {/* Custom Date Range */}
                    {period === 'custom' && (
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-white/40 mb-1 block">{t('common.fromDate') || 'من تاريخ'}</label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={e => setCustomStartDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-white/40 mb-1 block">إلى تاريخ</label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={e => setCustomEndDate(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white/10 text-white border border-white/10"
                                />
                            </div>
                            <button
                                onClick={loadData}
                                className="self-end px-4 py-2 rounded-xl bg-blue-500 text-white"
                            >
                                {t('common.apply') || 'تطبيق'}
                            </button>
                        </div>
                    )}

                    {/* Department Pills */}
                    <div className="flex flex-wrap gap-2">
                        {(['all', 'reception', 'bellman', 'housekeeping', 'maintenance'] as DepartmentType[]).map(dept => (
                            <button
                                key={dept}
                                onClick={() => {
                                    setDepartment(dept);
                                    setTimeout(loadData, 100);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-all ${department === dept
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                                    }`}
                            >
                                <span>{DEPARTMENT_ICONS[dept]}</span>
                                {DEPARTMENT_LABELS[dept]}
                                {dept !== 'all' && (
                                    <span className="text-xs opacity-70">
                                        ({summary.byDepartment[dept]})
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-white/40">
                            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>لا توجد عمليات في هذه الفترة</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl">{DEPARTMENT_ICONS[item.type]}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-white font-medium truncate">
                                                    {item.description}
                                                </span>
                                                {item.roomNumber && (
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {item.roomNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 mt-1 text-sm text-white/50">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {formatDisplayDate(item.timestamp)}
                                                </span>
                                                {item.employeeName && (
                                                    <span className="flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {item.employeeName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {item.status && (
                                                <span className={`px-2 py-1 rounded-lg text-xs ${item.status === 'COMPLETED' || item.status === 'received'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : item.status === 'IN_PROGRESS' || item.status === 'delivered'
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-white/10 text-white/60'
                                                    }`}>
                                                    {STATUS_LABELS[item.status] || item.status}
                                                </span>
                                            )}
                                            {expandedItem === item.id ? (
                                                <ChevronUp className="w-4 h-4 text-white/40" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-white/40" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedItem === item.id && item.metadata && (
                                        <div className="mt-3 pt-3 border-t border-white/10 text-sm text-white/60">
                                            {Object.entries(item.metadata).map(([key, value]) => (
                                                value && (
                                                    <div key={key} className="flex justify-between py-1">
                                                        <span>{key}:</span>
                                                        <span className="text-white/80">{String(value)}</span>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedHistoryModal;
