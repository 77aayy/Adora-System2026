/**
 * Print Service
 * Report printing and PDF export
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

interface PrintOptions {
    title?: string;
    subtitle?: string;
    organization?: string;
    branch?: string;
    logo?: boolean;
    footer?: string;
    orientation?: 'portrait' | 'landscape';
    pageSize?: 'A4' | 'A5' | 'Letter';
    margins?: { top: number; right: number; bottom: number; left: number };
}

interface ReportData {
    title: string;
    date: string;
    branch?: string;
    sections: {
        title: string;
        content: string | HTMLElement;
    }[];
    summary?: Record<string, string | number>;
}

// ============================================================
// PRINT WINDOW
// ============================================================

/**
 * Open print window with content
 */
export const printContent = (content: string | HTMLElement, options: PrintOptions = {}): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Please allow popups for printing');
        return;
    }

    const html = typeof content === 'string' ? content : content.outerHTML;
    const orgName = options.organization || localStorage.getItem('adora_org_name') || 'نظام أدورا';

    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>${options.title || 'طباعة - أدورا'}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page {
                    size: ${options.pageSize || 'A4'} ${options.orientation || 'portrait'};
                    margin: ${options.margins?.top || 15}mm ${options.margins?.right || 15}mm ${options.margins?.bottom || 15}mm ${options.margins?.left || 15}mm;
                }
                
                body {
                    font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                    font-size: 12pt;
                    line-height: 1.6;
                    color: #333;
                    direction: rtl;
                }
                
                .print-header {
                    text-align: center;
                    border-bottom: 2px solid #1a1a2e;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                
                .org-name {
                    font-size: 14pt;
                    font-weight: bold;
                    color: #666;
                    margin-bottom: 5px;
                }

                .print-header h1 {
                    font-size: 24pt;
                    color: #1a1a2e;
                    margin-bottom: 5px;
                }
                
                .print-header .subtitle {
                    color: #666;
                    font-size: 12pt;
                }
                
                .print-logo {
                    width: 80px;
                    height: 80px;
                    margin: 0 auto 10px;
                    font-size: 50px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f5f5f5;
                    border-radius: 50%;
                }
                
                .print-content {
                    padding: 20px 0;
                }
                
                .print-section {
                    margin-bottom: 25px;
                }
                
                .print-section h2 {
                    font-size: 16pt;
                    color: #1a1a2e;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 8px;
                    margin-bottom: 15px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0;
                }
                
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: right;
                }
                
                th {
                    background: #f5f5f5;
                    font-weight: bold;
                }
                
                tr:nth-child(even) {
                    background: #fafafa;
                }
                
                .summary-box {
                    background: #f5f5f5;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 20px 0;
                }
                
                .summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #ddd;
                }
                
                .summary-row:last-child {
                    border-bottom: none;
                    font-weight: bold;
                }
                
                .print-footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    text-align: center;
                    font-size: 10pt;
                    color: #999;
                    padding: 10px;
                    border-top: 1px solid #ddd;
                }
                
                .badge {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 10pt;
                }
                
                .badge-success { background: #d4edda; color: #155724; }
                .badge-warning { background: #fff3cd; color: #856404; }
                .badge-danger { background: #f8d7da; color: #721c24; }
                .badge-info { background: #d1ecf1; color: #0c5460; }
                
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                ${options.logo ? '<div class="print-logo">🏨</div>' : ''}
                <div class="org-name">${orgName}</div>
                <h1>${options.title || 'تقرير'}</h1>
                <div class="subtitle">
                    ${options.branch ? `<strong>${options.branch}</strong><br>` : ''}
                    ${options.subtitle || ''}
                </div>
            </div>
            
            <div class="print-content">
                ${html}
            </div>
            
            ${options.footer ? `<div class="print-footer">${options.footer}</div>` : ''}
            
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `);

    printWindow.document.close();
};

// ============================================================
// REPORT PRINTING
// ============================================================

/**
 * Print a structured report
 */
export const printReport = (data: ReportData, options: PrintOptions = {}): void => {
    let content = '';

    // Add date context (Branch is now in header)
    content += `<div style="text-align: center; margin-bottom: 20px;">`;
    content += `<div style="color: #666;">التاريخ: ${data.date}</div>`;
    content += `</div>`;

    // Add sections
    data.sections.forEach(section => {
        content += `<div class="print-section">`;
        content += `<h2>${section.title}</h2>`;
        content += typeof section.content === 'string' ? section.content : section.content.outerHTML;
        content += `</div>`;
    });

    // Add summary if exists
    if (data.summary) {
        content += `<div class="summary-box">`;
        content += `<h3 style="margin-bottom: 15px;">ملخص</h3>`;
        Object.entries(data.summary).forEach(([key, value]) => {
            content += `<div class="summary-row"><span>${key}</span><span>${value}</span></div>`;
        });
        content += `</div>`;
    }

    printContent(content, {
        title: data.title,
        subtitle: `التاريخ: ${data.date}`, // Date acts as main subtitle
        branch: data.branch, // Pass branch to header
        logo: true,
        footer: `طُبع بواسطة نظام أدورا - ${new Date().toLocaleString('ar-SA')}`,
        ...options
    });
};

// ============================================================
// SPECIFIC REPORTS
// ============================================================

/**
 * Print daily summary report
 */
export const printDailySummary = (date: string, stats: {
    totalRequests: number;
    completed: number;
    pending: number;
    avgResponseTime: number;
    topEmployee?: string;
}, requests: any[]): void => {
    const tableRows = requests.slice(0, 20).map(r => `
        <tr>
            <td>${r.roomNumber}</td>
            <td>${r.serviceType}</td>
            <td><span class="badge badge-${r.status === 'COMPLETED' ? 'success' : 'info'}">${r.status}</span></td>
            <td>${r.assignedToName || '-'}</td>
        </tr>
    `).join('');

    printReport({
        title: 'التقرير اليومي',
        date,
        sections: [
            {
                title: 'الطلبات',
                content: `
                    <table>
                        <thead>
                            <tr>
                                <th>الغرفة</th>
                                <th>نوع الخدمة</th>
                                <th>الحالة</th>
                                <th>المسؤول</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                `
            }
        ],
        summary: {
            'إجمالي الطلبات': stats.totalRequests,
            'المكتملة': stats.completed,
            'قيد الانتظار': stats.pending,
            'متوسط وقت الاستجابة': `${stats.avgResponseTime} دقيقة`,
            'أفضل موظف': stats.topEmployee || '-'
        }
    });
};

/**
 * Print shift handover report
 */
export const printShiftHandover = (shiftData: {
    shift: string;
    employee: string;
    date: string;
    pending: any[];
    notes: string[];
}): void => {
    const pendingList = shiftData.pending.map(r =>
        `<li>غرفة ${r.roomNumber} - ${r.serviceType} (${r.status})</li>`
    ).join('');

    const notesList = shiftData.notes.map(n => `<li>${n}</li>`).join('');

    printReport({
        title: 'تسليم الوردية',
        date: shiftData.date,
        sections: [
            {
                title: `الوردية: ${shiftData.shift}`,
                content: `<p>الموظف: <strong>${shiftData.employee}</strong></p>`
            },
            {
                title: 'الطلبات المعلقة',
                content: pendingList ? `<ul>${pendingList}</ul>` : '<p>لا توجد طلبات معلقة</p>'
            },
            {
                title: 'ملاحظات',
                content: notesList ? `<ul>${notesList}</ul>` : '<p>لا توجد ملاحظات</p>'
            }
        ]
    });
};

/**
 * Print receipt/bill
 */
export const printReceipt = (receipt: {
    roomNumber: string;
    guestName: string;
    items: { name: string; qty: number; price: number }[];
    subtotal: number;
    tax: number;
    total: number;
}): void => {
    const itemsHtml = receipt.items.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.qty}</td>
            <td>${item.price.toFixed(2)} ر.س</td>
            <td>${(item.qty * item.price).toFixed(2)} ر.س</td>
        </tr>
    `).join('');

    printContent(`
        <div style="max-width: 300px; margin: 0 auto; font-size: 11pt;">
            <table style="width: 100%;">
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
            </table>
            
            <div style="margin-top: 20px; border-top: 2px dashed #333; padding-top: 15px;">
                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                    <span>المجموع الفرعي:</span>
                    <span>${receipt.subtotal.toFixed(2)} ر.س</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                    <span>ضريبة القيمة المضافة (15%):</span>
                    <span>${receipt.tax.toFixed(2)} ر.س</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 14pt; font-weight: bold;">
                    <span>الإجمالي:</span>
                    <span>${receipt.total.toFixed(2)} ر.س</span>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #666;">
                <p>غرفة: ${receipt.roomNumber}</p>
                <p>الضيف: ${receipt.guestName}</p>
                <p>شكراً لاختياركم أدورا</p>
            </div>
        </div>
    `, {
        title: 'فاتورة',
        pageSize: 'A5',
        orientation: 'portrait'
    });
};

// ============================================================
// ELEMENT PRINTING
// ============================================================

/**
 * Print specific element
 */
export const printElement = (elementId: string, options: PrintOptions = {}): void => {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element ${elementId} not found`);
        return;
    }

    printContent(element.cloneNode(true) as HTMLElement, options);
};

/**
 * Print table with data
 */
export const printTable = (
    headers: string[],
    rows: (string | number)[][],
    title?: string
): void => {
    const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
    const rowsHtml = rows.map(row =>
        `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
    ).join('');

    printContent(`
        <table>
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `, { title: title || 'جدول', logo: true });
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    printContent,
    printReport,
    printDailySummary,
    printShiftHandover,
    printReceipt,
    printElement,
    printTable
};
