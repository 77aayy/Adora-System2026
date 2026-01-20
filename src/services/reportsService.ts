/**
 * Reports Service
 * Migrated from reports.js and reports-enhanced.js with TypeScript
 * Adora Hotel Management System V2
 */

import { db } from './firebase';
import {
    collection, getDocs, query, where, orderBy, Timestamp
} from 'firebase/firestore';
import { logger } from './loggerService';

// ============================================================
// TYPES
// ============================================================

export interface ReportRecord {
    id: string;
    serviceType: string;
    department: string;
    roomNumber?: string;
    status: string;
    description?: string;
    createdBy?: { id: string; name: string };
    assignedTo?: { id: string; name: string };
    completedBy?: { id: string; name: string };
    createdAt?: any;
    confirmedAt?: any;
    completedAt?: any;
    createdDate: Date;
    timeline?: Record<string, any>;
}

export interface ReportFilter {
    dateFrom: Date | null;
    dateTo: Date | null;
    department: string;
    serviceType: string;
    status: string;
    room: string;
    employee: string;
}

export interface ReportStatistics {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    cancelled: number;
    avgResponseTime?: number;
    byDepartment: Record<string, number>;
    byService: Record<string, number>;
    byStatus: Record<string, number>;
    byHour: number[];
}

export type SortBy = 'newest' | 'oldest' | 'room' | 'status' | 'department';

// ============================================================
// CONSTANTS
// ============================================================

export const SERVICE_TYPE_NAMES: Record<string, string> = {
    cleaning: 'تنظيف',
    maintenance: 'صيانة',
    bellman: 'بيلمان',
    coffee: 'كافي شوب',
    inspection: 'فحص',
    room_service: 'خدمة غرف',
    vip_service: 'خدمة VIP',
    procurement: 'مشتريات'
};

export const DEPARTMENT_NAMES: Record<string, string> = {
    reception: 'الاستقبال',
    housekeeping: 'النظافة',
    maintenance: 'الصيانة',
    bellman: 'البيلمان',
    procurement: 'المشتريات',
    manager: 'الإدارة'
};

export const STATUS_NAMES: Record<string, string> = {
    PENDING: 'قيد الانتظار',
    PENDING_APPROVAL: 'بانتظار الموافقة',
    CONFIRMED: 'قيد التنفيذ',
    IN_PROGRESS: 'قيد التنفيذ',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي',
    REJECTED: 'مرفوض'
};

export const getServiceTypeName = (type: string): string => SERVICE_TYPE_NAMES[type] || type;
export const getDepartmentName = (dept: string): string => DEPARTMENT_NAMES[dept] || dept;
export const getStatusName = (status: string): string => STATUS_NAMES[status] || status;

/**
 * Get department from service type
 */
export const getDepartmentFromServiceType = (serviceType: string): string => {
    switch (serviceType) {
        case 'cleaning':
        case 'inspection':
            return 'housekeeping';
        case 'maintenance':
            return 'maintenance';
        case 'bellman':
            return 'bellman';
        case 'procurement':
            return 'procurement';
        default:
            return 'reception';
    }
};

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Load all records from Firestore
 * ✅ SaaS: Added tenantId filter for data isolation
 */
export const loadAllRecords = async (branchId: string, tenantId: string): Promise<ReportRecord[]> => {
    try {
        const requestsQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId)
        );

        const snapshot = await getDocs(requestsQuery);
        const records: ReportRecord[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            records.push({
                id: doc.id,
                ...data,
                department: getDepartmentFromServiceType(data.serviceType),
                createdDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0)
            } as ReportRecord);
        });

        logger.info(`Loaded ${records.length} records`, undefined, 'reportsService');
        return records;
    } catch (error) {
        logger.error('Error loading records', error, 'reportsService');
        return [];
    }
};

/**
 * Load records for date range
 * ✅ SaaS: Added tenantId filter for data isolation
 */
export const loadRecordsForDateRange = async (
    branchId: string,
    tenantId: string,
    dateFrom: Date,
    dateTo: Date
): Promise<ReportRecord[]> => {
    try {
        const fromTimestamp = Timestamp.fromDate(dateFrom);
        const toTimestamp = Timestamp.fromDate(dateTo);

        const requestsQuery = query(
            collection(db, 'requests'),
            where('branch', '==', branchId),
            where('tenantId', '==', tenantId),
            where('createdAt', '>=', fromTimestamp),
            where('createdAt', '<=', toTimestamp),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(requestsQuery);
        const records: ReportRecord[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            records.push({
                id: doc.id,
                ...data,
                department: getDepartmentFromServiceType(data.serviceType),
                createdDate: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0)
            } as ReportRecord);
        });

        return records;
    } catch (error) {
        logger.error('Error loading records for date range', error, 'reportsService');
        return [];
    }
};

// ============================================================
// FILTERING
// ============================================================

/**
 * Apply filters to records
 */
export const applyFilters = (
    records: ReportRecord[],
    filter: Partial<ReportFilter>
): ReportRecord[] => {
    return records.filter(record => {
        // Date filter
        if (filter.dateFrom && record.createdDate < filter.dateFrom) return false;
        if (filter.dateTo) {
            const endDate = new Date(filter.dateTo);
            endDate.setHours(23, 59, 59, 999);
            if (record.createdDate > endDate) return false;
        }

        // Department filter
        if (filter.department && record.department !== filter.department) return false;

        // Service filter
        if (filter.serviceType && record.serviceType !== filter.serviceType) return false;

        // Status filter
        if (filter.status && record.status !== filter.status) return false;

        // Room filter
        if (filter.room && !record.roomNumber?.toString().includes(filter.room)) return false;

        // Employee filter
        if (filter.employee) {
            const employeeName = (record.createdBy?.name || record.assignedTo?.name || '').toLowerCase();
            if (!employeeName.includes(filter.employee.toLowerCase())) return false;
        }

        return true;
    });
};

// ============================================================
// SORTING
// ============================================================

/**
 * Sort records
 */
export const sortRecords = (records: ReportRecord[], sortBy: SortBy): ReportRecord[] => {
    const sorted = [...records];

    switch (sortBy) {
        case 'newest':
            sorted.sort((a, b) => b.createdDate.getTime() - a.createdDate.getTime());
            break;
        case 'oldest':
            sorted.sort((a, b) => a.createdDate.getTime() - b.createdDate.getTime());
            break;
        case 'room':
            sorted.sort((a, b) => {
                const roomA = parseInt(a.roomNumber || '0') || 0;
                const roomB = parseInt(b.roomNumber || '0') || 0;
                return roomA - roomB;
            });
            break;
        case 'status':
            sorted.sort((a, b) => a.status.localeCompare(b.status));
            break;
        case 'department':
            sorted.sort((a, b) => a.department.localeCompare(b.department));
            break;
    }

    return sorted;
};

// ============================================================
// STATISTICS
// ============================================================

/**
 * Calculate statistics from records
 */
export const calculateStatistics = (records: ReportRecord[]): ReportStatistics => {
    const stats: ReportStatistics = {
        total: records.length,
        completed: 0,
        inProgress: 0,
        pending: 0,
        cancelled: 0,
        byDepartment: {},
        byService: {},
        byStatus: {},
        byHour: new Array(24).fill(0)
    };

    let totalResponseTime = 0;
    let responseTimeCount = 0;

    records.forEach(record => {
        // Status counts
        switch (record.status) {
            case 'COMPLETED':
                stats.completed++;
                break;
            case 'CONFIRMED':
            case 'IN_PROGRESS':
                stats.inProgress++;
                break;
            case 'PENDING':
            case 'PENDING_APPROVAL':
                stats.pending++;
                break;
            case 'CANCELLED':
            case 'REJECTED':
                stats.cancelled++;
                break;
        }

        // By department
        const dept = record.department || 'other';
        stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;

        // By service
        const service = record.serviceType || 'other';
        stats.byService[service] = (stats.byService[service] || 0) + 1;

        // By status
        stats.byStatus[record.status] = (stats.byStatus[record.status] || 0) + 1;

        // By hour
        const hour = record.createdDate.getHours();
        stats.byHour[hour]++;

        // Response time calculation
        if (record.completedAt && record.createdAt) {
            const created = record.createdAt?.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
            const completed = record.completedAt?.toDate ? record.completedAt.toDate() : new Date(record.completedAt);
            const diffMinutes = (completed.getTime() - created.getTime()) / (1000 * 60);
            if (diffMinutes > 0 && diffMinutes < 1440) { // Max 24 hours
                totalResponseTime += diffMinutes;
                responseTimeCount++;
            }
        }
    });

    if (responseTimeCount > 0) {
        stats.avgResponseTime = Math.round(totalResponseTime / responseTimeCount);
    }

    return stats;
};

/**
 * Get peak hours
 */
export const getPeakHours = (stats: ReportStatistics): { hour: number; count: number }[] => {
    return stats.byHour
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
};

// ============================================================
// CHART DATA
// ============================================================

/**
 * Prepare chart data for departments
 */
export const getDepartmentChartData = (stats: ReportStatistics): { labels: string[]; data: number[] } => {
    const labels: string[] = [];
    const data: number[] = [];

    Object.entries(stats.byDepartment).forEach(([dept, count]) => {
        labels.push(getDepartmentName(dept));
        data.push(count);
    });

    return { labels, data };
};

/**
 * Prepare chart data for services
 */
export const getServiceChartData = (stats: ReportStatistics): { labels: string[]; data: number[] } => {
    const labels: string[] = [];
    const data: number[] = [];

    Object.entries(stats.byService).forEach(([service, count]) => {
        labels.push(getServiceTypeName(service));
        data.push(count);
    });

    return { labels, data };
};

/**
 * Prepare hourly chart data
 */
export const getHourlyChartData = (stats: ReportStatistics): { labels: string[]; data: number[] } => {
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    return { labels, data: stats.byHour };
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

/**
 * Export to CSV
 */
export const exportToCSV = (records: ReportRecord[], filename?: string): void => {
    if (records.length === 0) return;

    let csv = 'رقم السجل,القسم,نوع الخدمة,الغرفة,الموظف,التاريخ,الحالة\n';

    records.forEach((record, index) => {
        const date = record.createdDate.toLocaleDateString('ar-SA');
        const deptName = getDepartmentName(record.department);
        const serviceName = getServiceTypeName(record.serviceType);
        const statusName = getStatusName(record.status);
        const empName = record.createdBy?.name || record.assignedTo?.name || '--';

        csv += `${index + 1},"${deptName}","${serviceName}",${record.roomNumber || '--'},"${empName}","${date}","${statusName}"\n`;
    });

    // Create download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = filename || `تقرير_السجلات_${new Date().toLocaleDateString('ar-SA')}.csv`;
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Export to JSON
 */
export const exportToJSON = (records: ReportRecord[], filename?: string): void => {
    if (records.length === 0) return;

    const exportData = records.map(record => ({
        id: record.id,
        department: record.department,
        serviceType: record.serviceType,
        roomNumber: record.roomNumber,
        status: record.status,
        createdBy: record.createdBy?.name,
        createdAt: record.createdDate.toISOString()
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.href = url;
    link.download = filename || `report_${new Date().toISOString().split('T')[0]}.json`;
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ============================================================
// PRINT REPORT
// ============================================================

interface PrintOptions {
    hotelName?: string;
    branchName?: string;
    employeeName?: string;
    periodText?: string;
    filterText?: string;
}

/**
 * Print enhanced report
 */
export const printReport = (
    records: ReportRecord[],
    stats: ReportStatistics,
    options: PrintOptions = {}
): void => {
    if (records.length === 0) return;

    const currentDate = new Date();
    const printDate = currentDate.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const printTime = currentDate.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const printContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير السجلات - ${printDate}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Tajawal', Arial, sans-serif;
                    padding: 20mm;
                    background: white;
                    color: #1F2937;
                    line-height: 1.6;
                }
                .report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    border-bottom: 4px solid #10B981;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header-logo { display: flex; align-items: center; gap: 15px; }
                .logo {
                    width: 60px; height: 60px;
                    background: linear-gradient(135deg, #10B981, #059669);
                    border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 28px; color: white; font-weight: 800;
                }
                .header-title h1 { font-size: 24px; font-weight: 800; color: #1F2937; margin: 0 0 5px 0; }
                .header-title p { font-size: 14px; color: #6B7280; margin: 0; }
                .header-info { text-align: left; font-size: 13px; color: #4B5563; line-height: 1.8; }
                .statistics {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: white;
                    border: 2px solid #E5E7EB;
                    border-radius: 10px;
                    padding: 15px;
                    text-align: center;
                }
                .stat-value { font-size: 32px; font-weight: 800; margin-bottom: 5px; }
                .stat-label { font-size: 13px; color: #6B7280; font-weight: 600; }
                .stat-card.total .stat-value { color: #3B82F6; }
                .stat-card.completed .stat-value { color: #10B981; }
                .stat-card.inprogress .stat-value { color: #F59E0B; }
                .stat-card.pending .stat-value { color: #EF4444; }
                table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin-bottom: 30px;
                    border: 2px solid #E5E7EB;
                    border-radius: 10px;
                    overflow: hidden;
                }
                thead { background: linear-gradient(135deg, #10B981, #059669); }
                th { padding: 14px 12px; text-align: right; font-weight: 700; font-size: 14px; color: white; }
                tbody tr { border-bottom: 1px solid #E5E7EB; }
                tbody tr:nth-child(even) { background: #F9FAFB; }
                td { padding: 12px; text-align: right; font-size: 13px; color: #374151; }
                .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
                .COMPLETED { background: rgba(16, 185, 129, 0.15); color: #059669; }
                .CONFIRMED, .IN_PROGRESS { background: rgba(245, 158, 11, 0.15); color: #D97706; }
                .PENDING { background: rgba(239, 68, 68, 0.15); color: #DC2626; }
                .report-footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid #E5E7EB;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                }
                .footer-info { font-size: 12px; color: #6B7280; }
                .signature-line {
                    width: 200px;
                    border-top: 2px solid #1F2937;
                    margin-top: 40px;
                    padding-top: 8px;
                    font-size: 12px;
                    color: #6B7280;
                    font-weight: 600;
                    text-align: center;
                }
                @media print {
                    body { padding: 10mm; }
                    @page { size: A4; margin: 15mm; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div class="header-logo">
                    <div class="logo">A</div>
                    <div class="header-title">
                        <h1>${options.hotelName || 'نظام إدارة Adora'}</h1>
                        <p>تقرير السجلات</p>
                    </div>
                </div>
                <div class="header-info">
                    <strong>التاريخ:</strong> ${printDate}<br>
                    <strong>الوقت:</strong> ${printTime}<br>
                    <strong>الفرع:</strong> ${options.branchName || 'غير محدد'}<br>
                    <strong>المسؤول:</strong> ${options.employeeName || 'غير محدد'}
                </div>
            </div>

            <div class="statistics">
                <div class="stat-card total">
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">إجمالي الطلبات</div>
                </div>
                <div class="stat-card completed">
                    <div class="stat-value">${stats.completed}</div>
                    <div class="stat-label">مكتمل</div>
                </div>
                <div class="stat-card inprogress">
                    <div class="stat-value">${stats.inProgress}</div>
                    <div class="stat-label">قيد التنفيذ</div>
                </div>
                <div class="stat-card pending">
                    <div class="stat-value">${stats.pending}</div>
                    <div class="stat-label">قيد الانتظار</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>القسم</th>
                        <th>نوع الخدمة</th>
                        <th>الغرفة</th>
                        <th>الموظف</th>
                        <th>التاريخ</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map((record, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${getDepartmentName(record.department)}</td>
                            <td>${getServiceTypeName(record.serviceType)}</td>
                            <td>${record.roomNumber || '--'}</td>
                            <td>${record.createdBy?.name || record.assignedTo?.name || '--'}</td>
                            <td>${record.createdDate.toLocaleDateString('ar-SA')}</td>
                            <td><span class="status-badge ${record.status}">${getStatusName(record.status)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="report-footer">
                <div class="footer-info">
                    <strong>طُبع بواسطة:</strong> ${options.employeeName || 'غير محدد'}<br>
                    <strong>التوقيت:</strong> ${printDate} - ${printTime}
                </div>
                <div class="signature-section">
                    <div class="signature-line">توقيع المسؤول</div>
                </div>
            </div>
        </body>
        </html>
    `;


    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();

        // ✅ Auto-close after print
        printWindow.onafterprint = () => {
            printWindow.close();
        };

        printWindow.print();
    }
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback, useEffect, useMemo } from 'react';

interface UseReportsReturn {
    records: ReportRecord[];
    filteredRecords: ReportRecord[];
    statistics: ReportStatistics;
    loading: boolean;
    error: string | null;
    filter: Partial<ReportFilter>;
    sortBy: SortBy;
    setFilter: (filter: Partial<ReportFilter>) => void;
    setSortBy: (sortBy: SortBy) => void;
    refresh: () => Promise<void>;
    exportCSV: () => void;
    print: (options?: PrintOptions) => void;
}

export const useReports = (branchId: string, tenantId: string): UseReportsReturn => {
    const [records, setRecords] = useState<ReportRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Partial<ReportFilter>>({});
    const [sortBy, setSortBy] = useState<SortBy>('newest');

    const loadRecords = useCallback(async () => {
        if (!branchId || !tenantId) return;

        setLoading(true);
        setError(null);

        try {
            const data = await loadAllRecords(branchId, tenantId);
            setRecords(data);
        } catch (err: any) {
            setError(err.message || 'حدث خطأ في تحميل السجلات');
        } finally {
            setLoading(false);
        }
    }, [branchId, tenantId]);

    useEffect(() => {
        loadRecords();
    }, [loadRecords]);

    const filteredRecords = useMemo(() => {
        const filtered = applyFilters(records, filter);
        return sortRecords(filtered, sortBy);
    }, [records, filter, sortBy]);

    const statistics = useMemo(() =>
        calculateStatistics(filteredRecords),
        [filteredRecords]
    );

    const exportCSV = useCallback(() => {
        exportToCSV(filteredRecords);
    }, [filteredRecords]);

    const print = useCallback((options?: PrintOptions) => {
        printReport(filteredRecords, statistics, options);
    }, [filteredRecords, statistics]);

    return {
        records,
        filteredRecords,
        statistics,
        loading,
        error,
        filter,
        sortBy,
        setFilter,
        setSortBy,
        refresh: loadRecords,
        exportCSV,
        print
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Constants
    SERVICE_TYPE_NAMES,
    DEPARTMENT_NAMES,
    STATUS_NAMES,
    getServiceTypeName,
    getDepartmentName,
    getStatusName,
    getDepartmentFromServiceType,

    // Data
    loadAllRecords,
    loadRecordsForDateRange,

    // Filtering & Sorting
    applyFilters,
    sortRecords,

    // Statistics
    calculateStatistics,
    getPeakHours,

    // Chart data
    getDepartmentChartData,
    getServiceChartData,
    getHourlyChartData,

    // Export
    exportToCSV,
    exportToJSON,
    printReport,

    // Hook
    useReports
};
