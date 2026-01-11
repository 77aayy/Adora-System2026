/**
 * Enhanced Reports Utility
 * Print-ready report generation
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

export interface ReportItem {
    id: string;
    type: string;
    roomNumber?: string;
    date: Date;
    status: 'completed' | 'confirmed' | 'pending' | 'cancelled';
    assignee?: string;
    notes?: string;
}

export interface ReportStats {
    total: number;
    completed: number;
    confirmed: number;
    pending: number;
    cancelled: number;
}

export interface ReportConfig {
    title: string;
    branchName: string;
    employeeName: string;
    period: string;
    filterType?: string;
}

// ============================================================
// STATISTICS
// ============================================================

/**
 * Calculate report statistics
 */
export const calculateStats = (items: ReportItem[]): ReportStats => {
    return {
        total: items.length,
        completed: items.filter(i => i.status === 'completed').length,
        confirmed: items.filter(i => i.status === 'confirmed').length,
        pending: items.filter(i => i.status === 'pending').length,
        cancelled: items.filter(i => i.status === 'cancelled').length,
    };
};

// ============================================================
// STATUS HELPERS
// ============================================================

/**
 * Get status label in Arabic
 */
export const getStatusLabelAr = (status: string): string => {
    const labels: Record<string, string> = {
        completed: 'مكتمل',
        confirmed: 'قيد التنفيذ',
        pending: 'قيد الانتظار',
        cancelled: 'ملغي',
    };
    return labels[status] || status;
};

/**
 * Get status CSS class
 */
export const getStatusClass = (status: string): string => {
    const classes: Record<string, string> = {
        completed: 'status-completed',
        confirmed: 'status-confirmed',
        pending: 'status-pending',
        cancelled: 'status-cancelled',
    };
    return classes[status] || '';
};

// ============================================================
// SERVICE TYPE HELPERS
// ============================================================

/**
 * Get service type label in Arabic
 */
export const getServiceTypeLabelAr = (type: string): string => {
    const labels: Record<string, string> = {
        cleaning: 'تنظيف',
        maintenance: 'صيانة',
        bellman: 'بيلمان',
        laundry: 'غسيل',
        minibar: 'ميني بار',
        coffee: 'كوفي شوب',
        other: 'أخرى',
    };
    return labels[type] || type;
};

// ============================================================
// PRINT REPORT GENERATION
// ============================================================

/**
 * Generate printable HTML report
 */
export const generatePrintableReport = (
    items: ReportItem[],
    config: ReportConfig
): string => {
    const stats = calculateStats(items);
    const now = new Date();
    const printDate = now.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const printTime = now.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const tableRows = items.map((item, index) => {
        const roomNum = item.roomNumber || '--';
        const serviceType = getServiceTypeLabelAr(item.type);
        const date = item.date.toLocaleString('ar-SA', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
        const statusLabel = getStatusLabelAr(item.status);
        const statusClass = getStatusClass(item.status);

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${serviceType}</td>
                <td>${roomNum}</td>
                <td>${date}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
            </tr>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>${config.title} - ${printDate}</title>
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
        
        .header-logo {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .logo {
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #10B981, #059669);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            font-weight: 800;
        }
        
        .header-title h1 {
            font-size: 24px;
            font-weight: 800;
            color: #1F2937;
            margin: 0 0 5px 0;
        }
        
        .header-title p {
            font-size: 14px;
            color: #6B7280;
            margin: 0;
        }
        
        .header-info {
            text-align: left;
            font-size: 13px;
            color: #4B5563;
            line-height: 1.8;
        }
        
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
        
        .stat-value {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 5px;
        }
        
        .stat-label {
            font-size: 13px;
            color: #6B7280;
            font-weight: 600;
        }
        
        .stat-card.total .stat-value { color: #3B82F6; }
        .stat-card.completed .stat-value { color: #10B981; }
        .stat-card.confirmed .stat-value { color: #F59E0B; }
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
        
        thead {
            background: linear-gradient(135deg, #10B981, #059669);
        }
        
        th {
            padding: 14px 12px;
            text-align: right;
            font-weight: 700;
            font-size: 14px;
            color: white;
        }
        
        tbody tr {
            border-bottom: 1px solid #E5E7EB;
        }
        
        tbody tr:nth-child(even) {
            background: #F9FAFB;
        }
        
        td {
            padding: 12px;
            text-align: right;
            font-size: 13px;
            color: #374151;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
        }
        
        .status-completed {
            background: rgba(16, 185, 129, 0.15);
            color: #059669;
        }
        
        .status-confirmed {
            background: rgba(245, 158, 11, 0.15);
            color: #D97706;
        }
        
        .status-pending {
            background: rgba(239, 68, 68, 0.15);
            color: #DC2626;
        }
        
        .status-cancelled {
            background: rgba(107, 114, 128, 0.15);
            color: #4B5563;
        }
        
        .report-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #E5E7EB;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        
        .footer-info {
            font-size: 12px;
            color: #6B7280;
        }
        
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
                <h1>نظام إدارة Adora</h1>
                <p>${config.title}</p>
            </div>
        </div>
        <div class="header-info">
            <strong>التاريخ:</strong> ${printDate}<br>
            <strong>الوقت:</strong> ${printTime}<br>
            <strong>الفرع:</strong> ${config.branchName}<br>
            <strong>المسؤول:</strong> ${config.employeeName}
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
        <div class="stat-card confirmed">
            <div class="stat-value">${stats.confirmed}</div>
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
                <th>نوع الخدمة</th>
                <th>رقم الغرفة</th>
                <th>التاريخ والوقت</th>
                <th>الحالة</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    
    <div class="report-footer">
        <div class="footer-info">
            <strong>طُبع بواسطة:</strong> ${config.employeeName}<br>
            <strong>التوقيت:</strong> ${printDate} - ${printTime}
        </div>
        <div class="signature-section">
            <div class="signature-line">توقيع المسؤول</div>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Open print window with report
 */
export const printReport = (
    items: ReportItem[],
    config: ReportConfig
): void => {
    const html = generatePrintableReport(items, config);
    const printWindow = window.open('', '_blank');

    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
    }
};

/**
 * Export report data as CSV
 */
export const exportReportAsCSV = (
    items: ReportItem[],
    filename = 'report.csv'
): void => {
    const headers = ['#', 'نوع الخدمة', 'رقم الغرفة', 'التاريخ', 'الحالة'];
    const rows = items.map((item, index) => [
        index + 1,
        getServiceTypeLabelAr(item.type),
        item.roomNumber || '--',
        item.date.toLocaleString('ar-SA'),
        getStatusLabelAr(item.status),
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
};
