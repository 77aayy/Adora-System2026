/**
 * Print Utilities - Enhanced Print Templates
 * ✅ QR Code Generation
 * ✅ Watermark
 * ✅ Bilingual Support (Arabic/English)
 * ✅ Dynamic Company Info
 * ✅ Paid/Unpaid Status Stamps
 */

// ============================================================
// QR CODE GENERATION (Using free API - no library needed)
// ============================================================

/**
 * Generate QR Code URL for verification
 * Uses free QR Server API
 */
export const generateQRCodeURL = (data: string, size: number = 150): string => {
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=svg`;
};

/**
 * Generate verification QR data for invoices/vouchers
 */
export const generateInvoiceQRData = (invoice: {
    invoiceNumber: string | number;
    totalAmount: number;
    issueDate: Date | string;
    companyTaxNumber?: string;
    companyName?: string;
}): string => {
    // ZATCA-compliant format (simplified)
    const data = {
        sellerName: invoice.companyName || 'Adora',
        vatNumber: invoice.companyTaxNumber || '',
        invoiceNumber: String(invoice.invoiceNumber),
        total: invoice.totalAmount.toFixed(2),
        date: new Date(invoice.issueDate).toISOString().split('T')[0]
    };
    
    // Create a verification URL or JSON string
    return JSON.stringify(data);
};

// ============================================================
// WATERMARK STYLES
// ============================================================

export const getWatermarkStyles = (text: string = 'فاتورة ضريبية معتمدة'): string => `
    .watermark {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 80pt;
        color: rgba(0, 0, 0, 0.03);
        font-weight: bold;
        white-space: nowrap;
        z-index: -1;
        pointer-events: none;
        font-family: 'Tajawal', sans-serif;
    }
    .watermark-container {
        position: relative;
    }
    .watermark-container::before {
        content: "${text}";
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 60pt;
        color: rgba(13, 148, 136, 0.05);
        font-weight: bold;
        white-space: nowrap;
        z-index: 0;
        pointer-events: none;
        font-family: 'Tajawal', sans-serif;
    }
`;

// ============================================================
// STATUS STAMPS
// ============================================================

export const getPaidStampHTML = (isPaid: boolean = true): string => {
    if (isPaid) {
        return `
            <div style="
                position: absolute;
                top: 120px;
                left: 30px;
                transform: rotate(-15deg);
                border: 4px solid #10b981;
                border-radius: 12px;
                padding: 8px 20px;
                color: #10b981;
                font-size: 18pt;
                font-weight: bold;
                opacity: 0.8;
                font-family: 'Tajawal', sans-serif;
            ">
                <div style="text-align: center;">
                    <div>✓ مدفوعة</div>
                    <div style="font-size: 10pt; margin-top: 2px;">PAID</div>
                </div>
            </div>
        `;
    }
    return `
        <div style="
            position: absolute;
            top: 120px;
            left: 30px;
            transform: rotate(-15deg);
            border: 4px solid #ef4444;
            border-radius: 12px;
            padding: 8px 20px;
            color: #ef4444;
            font-size: 18pt;
            font-weight: bold;
            opacity: 0.8;
            font-family: 'Tajawal', sans-serif;
        ">
            <div style="text-align: center;">
                <div>⏳ غير مدفوعة</div>
                <div style="font-size: 10pt; margin-top: 2px;">UNPAID</div>
            </div>
        </div>
    `;
};

// ============================================================
// SECURITY PATTERN
// ============================================================

export const getSecurityPatternCSS = (): string => `
    .security-pattern {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image: 
            repeating-linear-gradient(
                45deg,
                transparent,
                transparent 20px,
                rgba(13, 148, 136, 0.02) 20px,
                rgba(13, 148, 136, 0.02) 40px
            );
        pointer-events: none;
        z-index: -1;
    }
    .border-security {
        border: 2px solid #0d9488;
        border-image: repeating-linear-gradient(
            45deg,
            #0d9488,
            #0d9488 10px,
            transparent 10px,
            transparent 20px
        ) 1;
    }
`;

// ============================================================
// DOCUMENT TYPE COLORS
// ============================================================

export const getDocumentTypeColors = (type: 'invoice' | 'receipt' | 'expense'): {
    primary: string;
    secondary: string;
    gradient: string;
    name: { ar: string; en: string };
} => {
    switch (type) {
        case 'invoice':
            return {
                primary: '#0D9488',
                secondary: '#059669',
                gradient: 'linear-gradient(135deg, #0D9488 0%, #059669 100%)',
                name: { ar: 'فاتورة ضريبية', en: 'TAX INVOICE' }
            };
        case 'receipt':
            return {
                primary: '#10b981',
                secondary: '#059669',
                gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                name: { ar: 'سند قبض', en: 'RECEIPT VOUCHER' }
            };
        case 'expense':
            return {
                primary: '#f59e0b',
                secondary: '#d97706',
                gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                name: { ar: 'سند صرف', en: 'EXPENSE VOUCHER' }
            };
        default:
            return {
                primary: '#0D9488',
                secondary: '#059669',
                gradient: 'linear-gradient(135deg, #0D9488 0%, #059669 100%)',
                name: { ar: 'مستند', en: 'DOCUMENT' }
            };
    }
};

// ============================================================
// NUMBER TO ARABIC WORDS
// ============================================================

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
const thousands = ['', 'ألف', 'ألفان', 'ثلاثة آلاف', 'أربعة آلاف', 'خمسة آلاف', 'ستة آلاف', 'سبعة آلاف', 'ثمانية آلاف', 'تسعة آلاف'];

export const numberToArabicWords = (num: number): string => {
    if (num === 0) return 'صفر';
    if (num < 0) return 'سالب ' + numberToArabicWords(Math.abs(num));
    
    const intPart = Math.floor(num);
    const decimalPart = Math.round((num - intPart) * 100);
    
    let result = '';
    
    // Handle thousands
    if (intPart >= 1000) {
        const thousandDigit = Math.floor(intPart / 1000);
        if (thousandDigit === 1) {
            result += 'ألف';
        } else if (thousandDigit === 2) {
            result += 'ألفان';
        } else if (thousandDigit <= 10) {
            result += ones[thousandDigit] + ' آلاف';
        } else {
            result += numberToArabicWords(thousandDigit) + ' ألف';
        }
    }
    
    // Handle hundreds
    const remainder = intPart % 1000;
    if (remainder >= 100) {
        const hundredDigit = Math.floor(remainder / 100);
        if (result) result += ' و';
        result += hundreds[hundredDigit];
    }
    
    // Handle tens and ones
    const tensRemainder = remainder % 100;
    if (tensRemainder > 0) {
        if (result) result += ' و';
        if (tensRemainder < 10) {
            result += ones[tensRemainder];
        } else if (tensRemainder < 20) {
            result += teens[tensRemainder - 10];
        } else {
            const oneDigit = tensRemainder % 10;
            const tenDigit = Math.floor(tensRemainder / 10);
            if (oneDigit > 0) {
                result += ones[oneDigit] + ' و';
            }
            result += tens[tenDigit];
        }
    }
    
    result += ' ريال سعودي';
    
    // Handle decimals (halalas)
    if (decimalPart > 0) {
        result += ' و' + decimalPart + ' هللة';
    }
    
    return result;
};

// ============================================================
// DATE FORMATTERS
// ============================================================

export const formatHijriDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('ar-SA-u-ca-islamic', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export const formatGregorianDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

export const formatDateTime = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// ============================================================
// PRINT TEMPLATE GENERATOR
// ============================================================

export interface PrintTemplateOptions {
    documentType: 'invoice' | 'receipt' | 'expense';
    showQRCode: boolean;
    showWatermark: boolean;
    showPaidStamp: boolean;
    isPaid: boolean;
    bilingual: boolean;
    showSecurityPattern: boolean;
    companyInfo: {
        name?: string;
        taxNumber?: string;
        commercialRegistration?: string;
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
        logo?: string;
    };
}

export const getBasePrintStyles = (options: PrintTemplateOptions): string => {
    const colors = getDocumentTypeColors(options.documentType);
    
    return `
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
            padding: 0;
            direction: rtl;
            background: #ffffff;
            color: #1f2937;
        }
        
        @page { 
            size: A4; 
            margin: 10mm;
        }
        
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        
        .print-page {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            position: relative;
            min-height: 297mm;
        }
        
        .header-gradient {
            background: ${colors.gradient};
            color: white;
            padding: 25px 30px;
            position: relative;
        }
        
        .logo-box {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 90px;
            height: 90px;
            background: white;
            border-radius: 12px;
            padding: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
        
        .qr-box {
            position: absolute;
            top: 20px;
            left: 20px;
            width: 80px;
            height: 80px;
            background: white;
            border-radius: 8px;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .qr-box img {
            width: 100%;
            height: 100%;
        }
        
        .document-title {
            text-align: center;
            padding-top: 10px;
        }
        
        .document-title h1 {
            font-size: 28pt;
            font-weight: 800;
            margin-bottom: 5px;
            letter-spacing: 1px;
        }
        
        .document-title .subtitle {
            font-size: 12pt;
            opacity: 0.9;
            letter-spacing: 2px;
        }
        
        .document-number {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255,255,255,0.3);
            font-size: 12pt;
        }
        
        .content-section {
            padding: 25px 30px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .info-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            padding: 15px;
        }
        
        .info-box h4 {
            font-size: 10pt;
            color: #6b7280;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .info-box p {
            font-size: 11pt;
            color: #1f2937;
            font-weight: 600;
        }
        
        .info-box .secondary {
            font-size: 9pt;
            color: #6b7280;
            margin-top: 3px;
        }
        
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .items-table th {
            background: ${colors.gradient};
            color: white;
            padding: 12px;
            font-size: 10pt;
            font-weight: 700;
            text-align: right;
            border: 1px solid rgba(255,255,255,0.2);
        }
        
        .items-table td {
            padding: 12px;
            font-size: 10pt;
            border: 1px solid #e5e7eb;
            text-align: right;
        }
        
        .items-table tr:nth-child(even) {
            background: #f9fafb;
        }
        
        .totals-section {
            display: flex;
            justify-content: flex-end;
            margin: 20px 0;
        }
        
        .totals-box {
            width: 300px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .total-row.grand-total {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 2px solid #10b981;
            border-radius: 8px;
            padding: 15px;
            margin-top: 10px;
        }
        
        .total-row.grand-total .label {
            font-size: 12pt;
            color: #047857;
            font-weight: 700;
        }
        
        .total-row.grand-total .value {
            font-size: 16pt;
            color: #047857;
            font-weight: 800;
        }
        
        .amount-words {
            background: #f0f9ff;
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            padding: 12px;
            margin: 15px 0;
            text-align: center;
        }
        
        .amount-words .label {
            font-size: 9pt;
            color: #0369a1;
            margin-bottom: 5px;
        }
        
        .amount-words .value {
            font-size: 11pt;
            color: #1e293b;
            font-weight: 600;
        }
        
        .signature-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px dashed #e5e7eb;
        }
        
        .signature-box {
            text-align: center;
        }
        
        .signature-box .label {
            font-size: 10pt;
            color: #6b7280;
            margin-bottom: 40px;
        }
        
        .signature-line {
            border-top: 1px solid #1f2937;
            width: 150px;
            margin: 0 auto;
        }
        
        .footer-section {
            background: #f9fafb;
            border-top: 2px solid #e5e7eb;
            padding: 15px 30px;
            margin-top: auto;
            text-align: center;
        }
        
        .footer-contact {
            display: flex;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
            margin-bottom: 10px;
        }
        
        .footer-contact span {
            font-size: 9pt;
            color: #6b7280;
        }
        
        .footer-thanks {
            font-size: 11pt;
            color: ${colors.primary};
            font-weight: 600;
            margin-top: 10px;
        }
        
        ${options.showWatermark ? getWatermarkStyles() : ''}
        ${options.showSecurityPattern ? getSecurityPatternCSS() : ''}
    `;
};

// ============================================================
// ENHANCED INVOICE TEMPLATE
// ============================================================

export interface InvoiceData {
    invoiceNumber: string | number;
    issueDate: Date | string;
    dueDate?: Date | string;
    status: 'paid' | 'pending' | 'overdue';
    customer: {
        name: string;
        code?: string;
        address?: string;
        taxNumber?: string;
    };
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }>;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    paymentMethod?: string;
    notes?: string;
}

export const generateEnhancedInvoiceHTML = (
    invoice: InvoiceData,
    options: PrintTemplateOptions
): string => {
    const colors = getDocumentTypeColors('invoice');
    const qrData = generateInvoiceQRData({
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.total,
        issueDate: invoice.issueDate,
        companyTaxNumber: options.companyInfo.taxNumber,
        companyName: options.companyInfo.name
    });
    const qrCodeURL = options.showQRCode ? generateQRCodeURL(qrData, 150) : '';
    
    return `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة ضريبية - ${invoice.invoiceNumber}</title>
            <style>${getBasePrintStyles(options)}</style>
        </head>
        <body>
            <div class="print-page ${options.showWatermark ? 'watermark-container' : ''} ${options.showSecurityPattern ? 'security-pattern' : ''}">
                
                <!-- Header -->
                <div class="header-gradient">
                    <!-- Logo -->
                    <div class="logo-box">
                        <img src="${options.companyInfo.logo || '/adora-logo.png'}" alt="Logo" />
                    </div>
                    
                    <!-- QR Code -->
                    ${options.showQRCode ? `
                    <div class="qr-box">
                        <img src="${qrCodeURL}" alt="QR Code" />
                    </div>
                    ` : ''}
                    
                    <!-- Paid Stamp -->
                    ${options.showPaidStamp ? getPaidStampHTML(invoice.status === 'paid') : ''}
                    
                    <!-- Company Info -->
                    ${options.companyInfo.name ? `
                    <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                        <div style="font-size: 18pt; font-weight: bold; margin-bottom: 5px;">${options.companyInfo.name}</div>
                        ${options.companyInfo.commercialRegistration ? `
                        <div style="font-size: 9pt; opacity: 0.9;">السجل التجاري: ${options.companyInfo.commercialRegistration}</div>
                        ` : ''}
                        ${options.companyInfo.taxNumber ? `
                        <div style="font-size: 9pt; opacity: 0.9;">الرقم الضريبي: ${options.companyInfo.taxNumber}</div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <!-- Document Title -->
                    <div class="document-title">
                        <h1>${colors.name.ar}</h1>
                        ${options.bilingual ? `<div class="subtitle">${colors.name.en}</div>` : ''}
                        <div class="document-number">
                            رقم الفاتورة: <strong>#${String(invoice.invoiceNumber).padStart(6, '0')}</strong>
                            ${options.bilingual ? `<span style="margin-right: 10px;">Invoice No.</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Content -->
                <div class="content-section">
                    <!-- Info Grid -->
                    <div class="info-grid">
                        <div class="info-box">
                            <h4>${options.bilingual ? 'معلومات الشركة / Company Info' : 'معلومات الشركة'}</h4>
                            <p>${options.companyInfo.name || 'شركة أدورا'}</p>
                            ${options.companyInfo.address ? `<p class="secondary">${options.companyInfo.address}</p>` : ''}
                            ${options.companyInfo.taxNumber ? `<p class="secondary">الرقم الضريبي: ${options.companyInfo.taxNumber}</p>` : ''}
                        </div>
                        <div class="info-box">
                            <h4>${options.bilingual ? 'معلومات العميل / Customer Info' : 'معلومات العميل'}</h4>
                            <p>${invoice.customer.name}</p>
                            ${invoice.customer.code ? `<p class="secondary">الكود: ${invoice.customer.code}</p>` : ''}
                            ${invoice.customer.taxNumber ? `<p class="secondary">الرقم الضريبي: ${invoice.customer.taxNumber}</p>` : ''}
                        </div>
                    </div>
                    
                    <!-- Dates -->
                    <div class="info-grid">
                        <div class="info-box">
                            <h4>${options.bilingual ? 'تاريخ الإصدار / Issue Date' : 'تاريخ الإصدار'}</h4>
                            <p>${formatGregorianDate(invoice.issueDate)}</p>
                            <p class="secondary">${formatHijriDate(invoice.issueDate)} هـ</p>
                        </div>
                        <div class="info-box">
                            <h4>${options.bilingual ? 'طريقة الدفع / Payment Method' : 'طريقة الدفع'}</h4>
                            <p>${invoice.paymentMethod || 'غير محدد'}</p>
                        </div>
                    </div>
                    
                    <!-- Items Table -->
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">${options.bilingual ? 'الوصف / Description' : 'الوصف'}</th>
                                <th style="width: 15%;">${options.bilingual ? 'الكمية / Qty' : 'الكمية'}</th>
                                <th style="width: 15%;">${options.bilingual ? 'السعر / Price' : 'السعر'}</th>
                                <th style="width: 20%;">${options.bilingual ? 'الإجمالي / Total' : 'الإجمالي'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${invoice.items.map(item => `
                            <tr>
                                <td>${item.description}</td>
                                <td style="text-align: center;">${item.quantity}</td>
                                <td style="text-align: center;">${item.unitPrice.toLocaleString()} ر.س</td>
                                <td style="text-align: center; font-weight: 600;">${item.total.toLocaleString()} ر.س</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <!-- Totals -->
                    <div class="totals-section">
                        <div class="totals-box">
                            <div class="total-row">
                                <span class="label">${options.bilingual ? 'المجموع قبل الضريبة / Subtotal' : 'المجموع قبل الضريبة'}</span>
                                <span class="value">${invoice.subtotal.toFixed(2)} ر.س</span>
                            </div>
                            <div class="total-row">
                                <span class="label">${options.bilingual ? `ضريبة القيمة المضافة (${invoice.taxRate}%) / VAT` : `ضريبة القيمة المضافة (${invoice.taxRate}%)`}</span>
                                <span class="value">${invoice.taxAmount.toFixed(2)} ر.س</span>
                            </div>
                            <div class="total-row grand-total">
                                <span class="label">${options.bilingual ? 'المبلغ الإجمالي / Grand Total' : 'المبلغ الإجمالي'}</span>
                                <span class="value">${invoice.total.toLocaleString()} ر.س</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Amount in Words -->
                    <div class="amount-words">
                        <div class="label">${options.bilingual ? 'المبلغ كتابةً / Amount in Words' : 'المبلغ كتابةً'}</div>
                        <div class="value">${numberToArabicWords(invoice.total)}</div>
                    </div>
                    
                    <!-- Signature Section -->
                    <div class="signature-section">
                        <div class="signature-box">
                            <div class="label">${options.bilingual ? 'توقيع المستلم / Receiver Signature' : 'توقيع المستلم'}</div>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-box">
                            <div class="label">${options.bilingual ? 'الختم الرسمي / Official Stamp' : 'الختم الرسمي'}</div>
                            <div class="signature-line"></div>
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer-section">
                    <div class="footer-contact">
                        ${options.companyInfo.phone ? `<span>📞 ${options.companyInfo.phone}</span>` : ''}
                        ${options.companyInfo.email ? `<span>📧 ${options.companyInfo.email}</span>` : ''}
                        ${options.companyInfo.website ? `<span>🌐 ${options.companyInfo.website}</span>` : ''}
                    </div>
                    <div class="footer-thanks">شكراً لتعاملكم معنا ✨</div>
                </div>
            </div>
        </body>
        </html>
    `;
};
