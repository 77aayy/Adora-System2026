/**
 * Export Utilities
 * PDF and Excel export functions
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ============================================================
// PDF EXPORT
// ============================================================

export const exportToPDF = (data: any, filename: string = 'report.pdf') => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('تقرير Adora Hotel Management System', 105, 20, { align: 'center' });
    
    // Add date
    doc.setFontSize(12);
    doc.text(`تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}`, 105, 30, { align: 'center' });
    
    // Add data table
    const tableData = [
        ['إجمالي المستأجرين', data.totalTenants || 0],
        ['المستأجرون النشطون', data.activeTenants || 0],
        ['إجمالي المستخدمين', data.totalUsers || 0],
        ['الإيرادات الشهرية', `${(data.monthlyRecurringRevenue || 0).toLocaleString()} ر.س`],
        ['الطلبات اليوم', data.totalRequestsToday || 0]
    ];
    
    (doc as any).autoTable({
        head: [['المقياس', 'القيمة']],
        body: tableData,
        startY: 40,
        theme: 'striped',
        styles: { font: 'Tajawal', fontSize: 10 },
        headStyles: { fillColor: [20, 184, 166] }
    });
    
    doc.save(filename);
};

// ============================================================
// EXCEL EXPORT
// ============================================================

export const exportToExcel = (data: any, filename: string = 'report.xlsx') => {
    const workbook = XLSX.utils.book_new();
    
    // Create data sheet
    const sheetData = [
        ['المقياس', 'القيمة'],
        ['إجمالي المستأجرين', data.totalTenants || 0],
        ['المستأجرون النشطون', data.activeTenants || 0],
        ['إجمالي المستخدمين', data.totalUsers || 0],
        ['الإيرادات الشهرية', data.monthlyRecurringRevenue || 0],
        ['الطلبات اليوم', data.totalRequestsToday || 0]
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'الإحصائيات');
    
    XLSX.writeFile(workbook, filename);
};
