/**
 * Export Utilities
 * PDF and Excel export functions - Enhanced to handle various data types
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Convert any data object to a flat key-value array for export
 */
const flattenDataForExport = (data: any): Array<[string, any]> => {
    const result: Array<[string, any]> = [];
    
    // Handle different data structures
    if (Array.isArray(data)) {
        // If it's an array of objects, extract keys from first object
        if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
            // This will be handled differently in PDF/Excel export
            return [];
        }
        // If it's a simple array, export as table
        return data.map((item, index) => [`عنصر ${index + 1}`, formatValue(item)]);
    }
    
    if (typeof data === 'object' && data !== null) {
        // Handle nested objects
        const keys = Object.keys(data);
        
        keys.forEach(key => {
            const value = data[key];
            
            // Skip functions and undefined
            if (typeof value === 'function' || value === undefined) {
                return;
            }
            
            // Handle nested objects
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const nestedKeys = Object.keys(value);
                nestedKeys.forEach(nestedKey => {
                    const nestedValue = value[nestedKey];
                    if (typeof nestedValue !== 'function' && nestedValue !== undefined) {
                        result.push([`${key}.${nestedKey}`, formatValue(nestedValue)]);
                    }
                });
            } else {
                result.push([key, formatValue(value)]);
            }
        });
    } else {
        result.push(['القيمة', formatValue(data)]);
    }
    
    return result;
};

/**
 * Format value for display
 */
const formatValue = (value: any): string => {
    if (value === null) return 'غير محدد';
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
    if (typeof value === 'number') {
        // Check if it's a currency value
        if (value > 1000) {
            return `${value.toLocaleString('ar-SA')} ر.س`;
        }
        return value.toString();
    }
    if (Array.isArray(value)) return `${value.length} عنصر`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/**
 * Get Arabic labels for common fields
 */
const getArabicLabel = (key: string): string => {
    const labels: Record<string, string> = {
        totalTenants: 'إجمالي المستأجرين',
        activeTenants: 'المستأجرون النشطون',
        totalUsers: 'إجمالي المستخدمين',
        totalBranches: 'إجمالي الفروع',
        totalRooms: 'إجمالي الغرف',
        totalRequests: 'إجمالي الطلبات',
        totalRequestsToday: 'الطلبات اليوم',
        monthlyRecurringRevenue: 'الإيرادات الشهرية المتكررة (MRR)',
        annualRecurringRevenue: 'الإيرادات السنوية المتكررة (ARR)',
        monthlyRenewalRevenue: 'إيرادات التجديد الشهرية',
        subscriptions: 'الاشتراكات',
        invoices: 'الفواتير',
        payments: 'المدفوعات',
        receiptVouchers: 'سندات القبض',
        expenseVouchers: 'سندات الصرف'
    };
    
    return labels[key] || key;
};

// ============================================================
// PDF EXPORT
// ============================================================

export const exportToPDF = (data: any, filename: string = 'report.pdf') => {
    try {
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Add title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('تقرير Adora Hotel Management System', 105, 20, { align: 'center' });
        
        // Add date
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        const dateStr = new Date().toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`تاريخ التقرير: ${dateStr}`, 105, 30, { align: 'center' });
        
        let startY = 40;
        
        // Handle array of objects (table format)
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
            const keys = Object.keys(data[0]);
            const head = keys.map(key => getArabicLabel(key));
            const body = data.map(item => keys.map(key => formatValue(item[key])));
            
            (doc as any).autoTable({
                head: [head],
                body: body,
                startY: startY,
                theme: 'striped',
                styles: {
                    font: 'helvetica',
                    fontSize: 9,
                    cellPadding: 2,
                    textColor: [0, 0, 0]
                },
                headStyles: {
                    fillColor: [20, 184, 166],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                },
                margin: { top: startY, left: 10, right: 10 }
            });
        } else if (typeof data === 'object' && data !== null) {
            // Handle object (key-value format) - Enhanced for complex nested objects
            const tableData = flattenDataForExport(data);
            
            if (tableData.length === 0) {
                // ✅ FIX: Handle complex nested objects (like DataHealthReport)
                // Try to create a summary table from main fields
                const summaryData: Array<[string, string]> = [];
                
                // Extract main summary fields
                if (data.overallHealth !== undefined) {
                    summaryData.push(['الحالة العامة', `${data.overallHealth}%`]);
                }
                if (data.totalIssues !== undefined) {
                    summaryData.push(['إجمالي الحالات', String(data.totalIssues)]);
                }
                if (data.resolvedIssues !== undefined) {
                    summaryData.push(['تم حلها', String(data.resolvedIssues)]);
                }
                if (data.criticalIssues !== undefined) {
                    summaryData.push(['حرجة', String(data.criticalIssues)]);
                }
                if (data.errorAnalysis?.totalErrors !== undefined) {
                    summaryData.push(['إجمالي الأخطاء', String(data.errorAnalysis.totalErrors)]);
                }
                if (data.consoleErrors?.total !== undefined) {
                    summaryData.push(['أخطاء الكونسول', String(data.consoleErrors.total)]);
                }
                if (data.reportPeriod?.start) {
                    const startDate = data.reportPeriod.start instanceof Date 
                        ? data.reportPeriod.start 
                        : new Date(data.reportPeriod.start);
                    summaryData.push(['من', startDate.toLocaleDateString('ar-SA')]);
                }
                if (data.reportPeriod?.end) {
                    const endDate = data.reportPeriod.end instanceof Date 
                        ? data.reportPeriod.end 
                        : new Date(data.reportPeriod.end);
                    summaryData.push(['إلى', endDate.toLocaleDateString('ar-SA')]);
                }
                
                if (summaryData.length > 0) {
                    const bodyData = summaryData.map(([key, value]) => [key, value]);
                    
                    (doc as any).autoTable({
                        head: [['المقياس', 'القيمة']],
                        body: bodyData,
                        startY: startY,
                        theme: 'striped',
                        styles: {
                            font: 'helvetica',
                            fontSize: 10,
                            cellPadding: 3,
                            textColor: [0, 0, 0]
                        },
                        headStyles: {
                            fillColor: [20, 184, 166],
                            textColor: [255, 255, 255],
                            fontStyle: 'bold'
                        },
                        alternateRowStyles: {
                            fillColor: [245, 247, 250]
                        },
                        margin: { top: startY, left: 10, right: 10 }
                    });
                } else {
                    throw new Error('لا توجد بيانات للتصدير');
                }
            } else {
                // Convert to autoTable format
                const bodyData = tableData.map(([key, value]) => [
                    getArabicLabel(key),
                    formatValue(value)
                ]);
                
                // Add table
                (doc as any).autoTable({
                    head: [['المقياس', 'القيمة']],
                    body: bodyData,
                    startY: startY,
                    theme: 'striped',
                    styles: {
                        font: 'helvetica',
                        fontSize: 10,
                        cellPadding: 3,
                        textColor: [0, 0, 0]
                    },
                    headStyles: {
                        fillColor: [20, 184, 166],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold'
                    },
                    alternateRowStyles: {
                        fillColor: [245, 247, 250]
                    },
                    margin: { top: startY, left: 10, right: 10 }
                });
            }
        } else {
            throw new Error('لا توجد بيانات للتصدير');
        }
        
        // Save file
        doc.save(filename);
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        alert('حدث خطأ أثناء تصدير PDF. يرجى المحاولة مرة أخرى.');
    }
};

// ============================================================
// EXCEL EXPORT
// ============================================================

export const exportToExcel = (data: any, filename: string = 'report.xlsx') => {
    try {
        const workbook = XLSX.utils.book_new();
        
        // Handle array of objects (table format)
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
            // Convert array to worksheet directly
            const worksheet = XLSX.utils.json_to_sheet(data);
            
            // Set column widths
            const maxWidth = 30;
            const colWidths = Object.keys(data[0]).map(() => ({ wch: maxWidth }));
            worksheet['!cols'] = colWidths;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(workbook, worksheet, 'البيانات');
        } else if (typeof data === 'object' && data !== null) {
            // ✅ Enhanced: Handle complex nested objects (like DataHealthReport)
            const tableData = flattenDataForExport(data);
            
            if (tableData.length > 0) {
                // Create sheet data with headers
                const sheetData = [
                    ['المقياس', 'القيمة'],
                    ...tableData.map(([key, value]) => [
                        getArabicLabel(key),
                        formatValue(value)
                    ])
                ];
                
                // Create worksheet
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                
                // Set column widths
                worksheet['!cols'] = [
                    { wch: 40 }, // Column 1 width
                    { wch: 30 }  // Column 2 width
                ];
                
                // Add worksheet to workbook
                XLSX.utils.book_append_sheet(workbook, worksheet, 'الإحصائيات');
            } else {
                // ✅ FIX: Handle complex nested objects that flattenDataForExport returns empty
                // Create summary sheet from main fields
                const summaryData: Array<[string, string]> = [];
                
                if (data.overallHealth !== undefined) {
                    summaryData.push(['الحالة العامة', `${data.overallHealth}%`]);
                }
                if (data.totalIssues !== undefined) {
                    summaryData.push(['إجمالي الحالات', String(data.totalIssues)]);
                }
                if (data.resolvedIssues !== undefined) {
                    summaryData.push(['تم حلها', String(data.resolvedIssues)]);
                }
                if (data.criticalIssues !== undefined) {
                    summaryData.push(['حرجة', String(data.criticalIssues)]);
                }
                if (data.errorAnalysis?.totalErrors !== undefined) {
                    summaryData.push(['إجمالي الأخطاء', String(data.errorAnalysis.totalErrors)]);
                }
                if (data.consoleErrors?.total !== undefined) {
                    summaryData.push(['أخطاء الكونسول', String(data.consoleErrors.total)]);
                }
                if (data.reportPeriod?.start) {
                    const startDate = data.reportPeriod.start instanceof Date 
                        ? data.reportPeriod.start 
                        : new Date(data.reportPeriod.start);
                    summaryData.push(['من', startDate.toLocaleDateString('ar-SA')]);
                }
                if (data.reportPeriod?.end) {
                    const endDate = data.reportPeriod.end instanceof Date 
                        ? data.reportPeriod.end 
                        : new Date(data.reportPeriod.end);
                    summaryData.push(['إلى', endDate.toLocaleDateString('ar-SA')]);
                }
                
                if (summaryData.length > 0) {
                    const sheetData = [
                        ['المقياس', 'القيمة'],
                        ...summaryData
                    ];
                    
                    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                    worksheet['!cols'] = [{ wch: 40 }, { wch: 30 }];
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'الإحصائيات');
                }
            }
            
            // Handle multiple sheets if data contains arrays
            if (data.subscriptions && Array.isArray(data.subscriptions) && data.subscriptions.length > 0) {
                const subscriptionsSheet = XLSX.utils.json_to_sheet(data.subscriptions);
                XLSX.utils.book_append_sheet(workbook, subscriptionsSheet, 'الاشتراكات');
            }
            
            if (data.invoices && Array.isArray(data.invoices) && data.invoices.length > 0) {
                const invoicesSheet = XLSX.utils.json_to_sheet(data.invoices);
                XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'الفواتير');
            }
            
            if (data.payments && Array.isArray(data.payments) && data.payments.length > 0) {
                const paymentsSheet = XLSX.utils.json_to_sheet(data.payments);
                XLSX.utils.book_append_sheet(workbook, paymentsSheet, 'المدفوعات');
            }
            
            // ✅ Add error analysis sheet if available
            if (data.errorAnalysis && data.errorAnalysis.topErrors && Array.isArray(data.errorAnalysis.topErrors)) {
                const errorSheet = XLSX.utils.json_to_sheet(data.errorAnalysis.topErrors.map((err: any) => ({
                    'الرسالة': err.message || '',
                    'التكرار': err.count || 0,
                    'آخر حدوث': err.lastOccurrence instanceof Date 
                        ? err.lastOccurrence.toLocaleDateString('ar-SA')
                        : new Date(err.lastOccurrence).toLocaleDateString('ar-SA')
                })));
                XLSX.utils.book_append_sheet(workbook, errorSheet, 'الأخطاء');
            }
        } else {
            throw new Error('لا توجد بيانات للتصدير');
        }
        
        // Save file
        XLSX.writeFile(workbook, filename);
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        alert('حدث خطأ أثناء تصدير Excel. يرجى المحاولة مرة أخرى.');
    }
};
