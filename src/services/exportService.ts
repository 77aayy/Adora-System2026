/**
 * Export Service
 * Export data to Excel, PDF, CSV
 * Adora Hotel Management System V2
 */

import { formatDateTimeGregorianEn } from '../utils/dateUtils';

// ============================================================
// TYPES
// ============================================================

interface ExportColumn {
    key: string;
    header: string;
    width?: number;
    formatter?: (value: any) => string;
}

interface ExportOptions {
    filename: string;
    sheetName?: string;
    title?: string;
    author?: string;
}

// ============================================================
// CSV EXPORT
// ============================================================

/**
 * Export data to CSV
 */
export const exportToCSV = (
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions
): void => {
    // Build header row
    const headers = columns.map(col => `"${col.header}"`).join(',');

    // Build data rows
    const rows = data.map(item => {
        return columns.map(col => {
            let value = item[col.key];
            if (col.formatter) {
                value = col.formatter(value);
            }
            // Escape quotes and wrap in quotes
            return `"${String(value ?? '').replace(/"/g, '""')}"`;
        }).join(',');
    });

    // Combine with BOM for Arabic support
    const csv = '\ufeff' + [headers, ...rows].join('\n');

    // Download
    downloadFile(csv, `${options.filename}.csv`, 'text/csv;charset=utf-8');
};

// ============================================================
// EXCEL EXPORT (Simple HTML-based)
// ============================================================

/**
 * Export data to Excel (HTML format)
 */
export const exportToExcel = (
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions
): void => {
    // Build HTML table
    const headerRow = columns.map(col =>
        `<th style="background:#1a1a2e;color:white;padding:10px;border:1px solid #ddd;font-weight:bold;">${col.header}</th>`
    ).join('');

    const dataRows = data.map((item, index) => {
        const cells = columns.map(col => {
            let value = item[col.key];
            if (col.formatter) {
                value = col.formatter(value);
            }
            return `<td style="padding:8px;border:1px solid #ddd;${index % 2 === 0 ? 'background:#f9f9f9;' : ''}">${value ?? ''}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const html = `
        <html xmlns:o="urn:schemas-microsoft-office:office" xmlns:x="urn:schemas-microsoft-office:excel">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>${options.sheetName || 'Sheet1'}</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayRightToLeft/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
                table { border-collapse: collapse; direction: rtl; }
                th, td { mso-number-format: "@"; }
            </style>
        </head>
        <body>
            ${options.title ? `<h2 style="text-align:center;">${options.title}</h2>` : ''}
            <table>
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${dataRows}</tbody>
            </table>
        </body>
        </html>
    `;

    downloadFile(html, `${options.filename}.xls`, 'application/vnd.ms-excel');
};

// ============================================================
// PDF EXPORT (Using print)
// ============================================================

/**
 * Export data to PDF (using print dialog)
 */
export const exportToPDF = (
    data: Record<string, any>[],
    columns: ExportColumn[],
    options: ExportOptions
): void => {
    const headerRow = columns.map(col => `<th>${col.header}</th>`).join('');

    const dataRows = data.map(item => {
        const cells = columns.map(col => {
            let value = item[col.key];
            if (col.formatter) {
                value = col.formatter(value);
            }
            return `<td>${value ?? ''}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>${options.title || options.filename}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                    padding: 20px;
                    direction: rtl;
                }
                h1 {
                    text-align: center;
                    color: #1a1a2e;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th {
                    background: #1a1a2e;
                    color: white;
                    padding: 12px;
                    text-align: right;
                }
                td {
                    padding: 10px;
                    border: 1px solid #ddd;
                }
                tr:nth-child(even) {
                    background: #f5f5f5;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    color: #888;
                    font-size: 12px;
                }
                @media print {
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>${options.title || options.filename}</h1>
            <table>
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${dataRows}</tbody>
            </table>
            <div class="footer">
                تم التصدير بواسطة نظام أدورا - ${formatDateTimeGregorianEn(new Date(), { showSeconds: false })}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() { window.close(); };
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

// ============================================================
// JSON EXPORT
// ============================================================

/**
 * Export data to JSON
 */
export const exportToJSON = (
    data: Record<string, any>[],
    options: ExportOptions
): void => {
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${options.filename}.json`, 'application/json');
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Download file helper
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
};

// ============================================================
// PREDEFINED EXPORTS
// ============================================================

/**
 * Export requests report
 */
export const exportRequestsReport = (requests: any[], format: 'csv' | 'excel' | 'pdf' = 'excel'): void => {
    const columns: ExportColumn[] = [
        { key: 'roomNumber', header: 'رقم الغرفة' },
        { key: 'serviceType', header: 'نوع الخدمة' },
        { key: 'status', header: 'الحالة', formatter: formatStatus },
        { key: 'assignedToName', header: 'المسؤول' },
        { key: 'createdAt', header: 'تاريخ الإنشاء', formatter: formatDate },
        { key: 'completedAt', header: 'تاريخ الإكمال', formatter: formatDate }
    ];

    const options: ExportOptions = {
        filename: `تقرير_الطلبات_${formatDateFilename(new Date())}`,
        title: 'تقرير الطلبات',
        sheetName: 'الطلبات'
    };

    switch (format) {
        case 'csv': exportToCSV(requests, columns, options); break;
        case 'excel': exportToExcel(requests, columns, options); break;
        case 'pdf': exportToPDF(requests, columns, options); break;
    }
};

/**
 * Export employees report
 */
export const exportEmployeesReport = (employees: any[], format: 'csv' | 'excel' | 'pdf' = 'excel'): void => {
    const columns: ExportColumn[] = [
        { key: 'name', header: 'الاسم' },
        { key: 'code', header: 'الكود' },
        { key: 'department', header: 'القسم' },
        { key: 'points', header: 'النقاط' },
        { key: 'tasksCompleted', header: 'المهام المكتملة' }
    ];

    const options: ExportOptions = {
        filename: `تقرير_الموظفين_${formatDateFilename(new Date())}`,
        title: 'تقرير الموظفين',
        sheetName: 'الموظفين'
    };

    switch (format) {
        case 'csv': exportToCSV(employees, columns, options); break;
        case 'excel': exportToExcel(employees, columns, options); break;
        case 'pdf': exportToPDF(employees, columns, options); break;
    }
};

/**
 * Export rooms report
 */
export const exportRoomsReport = (rooms: any[], format: 'csv' | 'excel' | 'pdf' = 'excel'): void => {
    const columns: ExportColumn[] = [
        { key: 'number', header: 'رقم الغرفة' },
        { key: 'floor', header: 'الدور' },
        { key: 'status', header: 'الحالة', formatter: formatRoomStatus },
        { key: 'type', header: 'النوع' },
        { key: 'guestName', header: 'اسم الضيف' }
    ];

    const options: ExportOptions = {
        filename: `تقرير_الغرف_${formatDateFilename(new Date())}`,
        title: 'تقرير الغرف',
        sheetName: 'الغرف'
    };

    switch (format) {
        case 'csv': exportToCSV(rooms, columns, options); break;
        case 'excel': exportToExcel(rooms, columns, options); break;
        case 'pdf': exportToPDF(rooms, columns, options); break;
    }
};

// ============================================================
// FORMATTERS
// ============================================================

const formatStatus = (status: string): string => {
    const map: Record<string, string> = {
        'PENDING': 'قيد الانتظار',
        'CONFIRMED': 'مؤكد',
        'IN_PROGRESS': 'جاري التنفيذ',
        'COMPLETED': 'مكتمل',
        'CANCELLED': 'ملغي'
    };
    return map[status] || status;
};

const formatRoomStatus = (status: string): string => {
    const map: Record<string, string> = {
        'available': 'متاحة',
        'occupied': 'مشغولة',
        'cleaning': 'تنظيف',
        'maintenance': 'صيانة',
        'checkout': 'مغادرة'
    };
    return map[status] || status;
};

const formatDate = (date: any): string => {
    if (!date) return '-';
    const d = date.toDate ? date.toDate() : new Date(date);
    return formatDateTimeGregorianEn(d, { showSeconds: false });
};

const formatDateFilename = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export const useExport = () => {
    const [exporting, setExporting] = useState(false);

    const exportData = useCallback(async (
        data: Record<string, any>[],
        columns: ExportColumn[],
        format: 'csv' | 'excel' | 'pdf' | 'json',
        options: ExportOptions
    ) => {
        setExporting(true);

        try {
            switch (format) {
                case 'csv': exportToCSV(data, columns, options); break;
                case 'excel': exportToExcel(data, columns, options); break;
                case 'pdf': exportToPDF(data, columns, options); break;
                case 'json': exportToJSON(data, options); break;
            }
        } finally {
            setExporting(false);
        }
    }, []);

    return {
        exporting,
        exportData,
        exportRequests: exportRequestsReport,
        exportEmployees: exportEmployeesReport,
        exportRooms: exportRoomsReport
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    exportToCSV,
    exportToExcel,
    exportToPDF,
    exportToJSON,
    exportRequestsReport,
    exportEmployeesReport,
    exportRoomsReport,
    useExport
};
