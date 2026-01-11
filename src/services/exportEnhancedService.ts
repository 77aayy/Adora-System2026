/**
 * Enhanced Export Service
 * PDF and Excel export functionality
 * Adora Hotel Management System V2
 */

import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// ============================================================
// TYPES
// ============================================================

export interface ExportColumn {
    key: string;
    header: string;
    width?: number;
}

export interface ExportOptions {
    filename: string;
    title?: string;
    subtitle?: string;
    columns: ExportColumn[];
    data: Record<string, any>[];
    logo?: string;
    rtl?: boolean;
}

// ============================================================
// PDF EXPORT
// ============================================================

/**
 * Export data to PDF
 */
export const exportToPDF = async (options: ExportOptions): Promise<void> => {
    const { filename, title, subtitle, columns, data, rtl = true } = options;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
    });

    // Set RTL if needed
    if (rtl) {
        doc.setR2L(true);
    }

    // Add title
    let yPos = 20;
    if (title) {
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(title, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
        yPos += 10;
    }

    // Add subtitle
    if (subtitle) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(subtitle, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
        yPos += 10;
    }

    // Add date
    doc.setFontSize(10);
    doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-SA')}`, 20, yPos);
    yPos += 15;

    // Table settings
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const tableWidth = pageWidth - 2 * margin;
    const colWidth = tableWidth / columns.length;
    const rowHeight = 10;

    // Draw header
    doc.setFillColor(13, 148, 136); // Teal color
    doc.rect(margin, yPos, tableWidth, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    columns.forEach((col, index) => {
        const x = margin + index * colWidth + colWidth / 2;
        doc.text(col.header, x, yPos + 6.5, { align: 'center' });
    });

    yPos += rowHeight;

    // Draw data rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    data.forEach((row, rowIndex) => {
        // Alternating row colors
        if (rowIndex % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, yPos, tableWidth, rowHeight, 'F');
        }

        columns.forEach((col, colIndex) => {
            const x = margin + colIndex * colWidth + colWidth / 2;
            const value = String(row[col.key] ?? '');
            doc.text(value, x, yPos + 6.5, { align: 'center' });
        });

        yPos += rowHeight;

        // New page if needed
        if (yPos > doc.internal.pageSize.height - 20) {
            doc.addPage();
            yPos = 20;
        }
    });

    // Draw table border
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, 35 + (title ? 10 : 0) + (subtitle ? 10 : 0), tableWidth, yPos - 35);

    // Save
    doc.save(`${filename}.pdf`);
};

// ============================================================
// EXCEL EXPORT
// ============================================================

/**
 * Export data to Excel
 */
export const exportToExcel = (options: ExportOptions): void => {
    const { filename, title, columns, data } = options;

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();

    // Prepare data with headers
    const headers = columns.map(col => col.header);
    const rows = data.map(row => columns.map(col => row[col.key] ?? ''));

    // Add title row if provided
    const sheetData: any[][] = [];
    if (title) {
        sheetData.push([title]);
        sheetData.push([]); // Empty row
    }
    sheetData.push(headers);
    sheetData.push(...rows);

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Set column widths
    const colWidths = columns.map(col => ({ wch: col.width || 15 }));
    ws['!cols'] = colWidths;

    // Style title row
    if (title) {
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }];
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير');

    // Save
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

// ============================================================
// CSV EXPORT
// ============================================================

/**
 * Export data to CSV
 */
export const exportToCSV = (options: ExportOptions): void => {
    const { filename, columns, data } = options;

    // Create CSV content
    const headers = columns.map(col => col.header).join(',');
    const rows = data.map(row =>
        columns.map(col => {
            const value = row[col.key] ?? '';
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(value).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
    );

    const csvContent = [headers, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Format date for export
 */
export const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

/**
 * Format currency for export
 */
export const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString('ar-SA')} ريال`;
};

// ============================================================
// REACT HOOK
// ============================================================

import { useCallback } from 'react';

export const useExport = () => {
    const toPDF = useCallback((options: ExportOptions) => {
        return exportToPDF(options);
    }, []);

    const toExcel = useCallback((options: ExportOptions) => {
        exportToExcel(options);
    }, []);

    const toCSV = useCallback((options: ExportOptions) => {
        exportToCSV(options);
    }, []);

    return { toPDF, toExcel, toCSV };
};

export default {
    exportToPDF,
    exportToExcel,
    exportToCSV,
    formatDate,
    formatCurrency,
    useExport,
};
