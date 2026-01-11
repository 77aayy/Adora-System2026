/**
 * PDF Rulebook Generator Service V2
 * Generates comprehensive PDF reports for Points, Ranks & Commitment rules
 * 
 * ✅ Features:
 * - Arabic text support (RTL)
 * - Dynamic data from manager settings
 * - Professional hotel branding with logo
 * - Execution departments table
 * - Management (Reception) table
 * - Ranks table with levels
 * - Commitment/Streak rewards table
 * - Manager signature section
 * - Quality warning about suspicious speed
 * 
 * Adora Hotel Management System V3
 */

import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { FullPointsConfig } from '../features/admin/PointsConfiguration';

// Extend jsPDF type for autotable
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

// ============================================================
// TYPES
// ============================================================

interface RankData {
    id: string;
    name: string;
    minPoints: number;
    icon?: string;
    description?: string;
}

interface CommitmentMilestone {
    day: number;
    rewardPoints: number;
    label: string;
}

interface HotelInfo {
    name: string;
    logo?: string;
    managerName?: string;
    generatedDate: string;
    commitmentMilestones?: CommitmentMilestone[];
}

// ============================================================
// ARABIC TEXT HELPERS
// ============================================================

// Reverse Arabic text for PDF (jsPDF doesn't support RTL natively)
const reverseArabic = (text: string): string => {
    // Split by spaces, reverse each word, then reverse the entire array
    return text.split(' ').reverse().join(' ');
};

// Format number for Arabic display
const formatArabicNumber = (num: number): string => {
    if (num > 0) return `+${num}`;
    return String(num);
};

// ============================================================
// PDF GENERATION
// ============================================================

/**
 * Generate Points & Ranks Rulebook PDF
 */
export const generateRulebookPDF = async (
    config: FullPointsConfig,
    ranks: RankData[],
    hotelInfo: HotelInfo
): Promise<void> => {
    // Create PDF (A4 size)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let yPos = margin;

    // ============================================================
    // HEADER
    // ============================================================
    
    // Background header bar
    doc.setFillColor(13, 148, 136); // Teal
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Hotel Name (right-aligned for Arabic)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic(hotelInfo.name || 'فندق أدورا'), pageWidth - margin, 20, { align: 'right' });

    // Subtitle
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(reverseArabic('دليل النقاط والرتب'), pageWidth - margin, 30, { align: 'right' });

    // Date
    doc.setFontSize(10);
    doc.text(reverseArabic(`تاريخ الإصدار: ${hotelInfo.generatedDate}`), pageWidth - margin, 40, { align: 'right' });

    yPos = 55;

    // ============================================================
    // INTRODUCTION
    // ============================================================
    
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('مقدمة'), pageWidth - margin, yPos, { align: 'right' });
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const introText = 'هذا الدليل يوضح نظام النقاط والمكافآت المعتمد في الفندق. يرجى الالتزام بالأوقات المحددة للحصول على أفضل النتائج.';
    doc.text(reverseArabic(introText), pageWidth - margin, yPos, { align: 'right', maxWidth: pageWidth - (2 * margin) });

    yPos += 20;

    // ============================================================
    // HOUSEKEEPING SECTION
    // ============================================================
    
    doc.setFillColor(240, 253, 250);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🧹 قسم النظافة (Housekeeping)'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    // Housekeeping table
    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('الوقت'),
            reverseArabic('النقاط'),
            reverseArabic('الحدث')
        ]],
        body: [
            [
                reverseArabic(`خلال ${config.housekeeping.fastTime} دقيقة`),
                formatArabicNumber(config.housekeeping.fast),
                reverseArabic('إنجاز سريع ⚡')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.housekeeping.completeOccupied),
                reverseArabic('إكمال غرفة مشغولة ✅')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.housekeeping.completeCheckout),
                reverseArabic('إكمال غرفة checkout ✅')
            ],
            [
                reverseArabic('عند البدء'),
                formatArabicNumber(config.housekeeping.start),
                reverseArabic('بدء التنظيف 🚀')
            ],
            [
                reverseArabic('عند التفتيش'),
                formatArabicNumber(config.housekeeping.inspection),
                reverseArabic('اجتياز التفتيش 🔍')
            ],
            [
                reverseArabic(`بعد ${config.housekeeping.delayTime} دقيقة`),
                formatArabicNumber(config.housekeeping.delay),
                reverseArabic('تأخير ⚠️')
            ],
        ],
        theme: 'grid',
        styles: { 
            halign: 'center', 
            fontSize: 10,
            cellPadding: 4
        },
        headStyles: { 
            fillColor: [13, 148, 136],
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // ============================================================
    // BELLMAN SECTION
    // ============================================================
    
    doc.setFillColor(254, 252, 232);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(180, 83, 9);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🛎️ قسم البيلمان (Bellman)'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('الوقت'),
            reverseArabic('النقاط'),
            reverseArabic('الحدث')
        ]],
        body: [
            [
                reverseArabic(`خلال ${config.bellman.fastTime} دقيقة`),
                formatArabicNumber(config.bellman.fast),
                reverseArabic('إنجاز سريع ⚡')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.bellman.complete),
                reverseArabic('إكمال الخدمة ✅')
            ],
            [
                reverseArabic('عند Check-in'),
                formatArabicNumber(config.bellman.checkin),
                reverseArabic('استلام ضيف 🎒')
            ],
            [
                reverseArabic('عند Check-out'),
                formatArabicNumber(config.bellman.checkout),
                reverseArabic('توديع ضيف 👋')
            ],
            [
                reverseArabic(`بعد ${config.bellman.delayTime} دقيقة`),
                formatArabicNumber(config.bellman.delay),
                reverseArabic('تأخير ⚠️')
            ],
        ],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [254, 252, 232] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // ============================================================
    // MAINTENANCE SECTION
    // ============================================================
    
    doc.setFillColor(239, 246, 255);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🔧 قسم الصيانة (Maintenance)'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('الوقت'),
            reverseArabic('النقاط'),
            reverseArabic('الحدث')
        ]],
        body: [
            [
                reverseArabic(`خلال ${config.maintenance.fastTime} دقيقة`),
                formatArabicNumber(config.maintenance.fast),
                reverseArabic('إنجاز سريع ⚡')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.maintenance.complete),
                reverseArabic('إكمال الصيانة ✅')
            ],
            [
                reverseArabic(`بعد ${config.maintenance.delayTime} دقيقة`),
                formatArabicNumber(config.maintenance.delay),
                reverseArabic('تأخير ⚠️')
            ],
        ],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [239, 246, 255] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // ============================================================
    // COFFEE SHOP SECTION
    // ============================================================
    
    doc.setFillColor(255, 251, 235);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('☕ قسم الكوفي شوب'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('الوقت'),
            reverseArabic('النقاط'),
            reverseArabic('الحدث')
        ]],
        body: [
            [
                reverseArabic(`خلال ${config.coffeeShop.fastTime} دقيقة`),
                formatArabicNumber(config.coffeeShop.fast),
                reverseArabic('توصيل سريع ⚡')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.coffeeShop.complete),
                reverseArabic('إكمال الطلب ✅')
            ],
            [
                reverseArabic(`بعد ${config.coffeeShop.delayTime} دقيقة`),
                formatArabicNumber(config.coffeeShop.delay),
                reverseArabic('تأخير ⚠️')
            ],
        ],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [146, 64, 14], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Check if we need a new page
    if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = margin;
    }

    // ============================================================
    // RECEPTION SECTION
    // ============================================================
    
    doc.setFillColor(245, 243, 255);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(91, 33, 182);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🏨 قسم الاستقبال (Reception)'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('الوقت'),
            reverseArabic('النقاط'),
            reverseArabic('الحدث')
        ]],
        body: [
            [
                reverseArabic('عند الإنشاء'),
                formatArabicNumber(config.reception.create),
                reverseArabic('إنشاء طلب 📝')
            ],
            [
                reverseArabic(`خلال ${config.reception.targetConfirmationTime} دقائق`),
                formatArabicNumber(config.reception.confirm),
                reverseArabic('تأكيد سريع ✅')
            ],
            [
                reverseArabic('عند الإكمال'),
                formatArabicNumber(config.reception.complete),
                reverseArabic('إكمال الخدمة ✅')
            ],
            [
                reverseArabic(`بعد ${config.reception.lateConfirmationTime} دقائق`),
                formatArabicNumber(config.reception.lateConfirmationPenalty),
                reverseArabic('تأخير التأكيد ⚠️')
            ],
            [
                reverseArabic(`بعد ${config.reception.veryLateConfirmationTime} دقائق`),
                formatArabicNumber(config.reception.veryLateConfirmationPenalty),
                reverseArabic('تأخير شديد 🚨')
            ],
        ],
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [91, 33, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 243, 255] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 20;

    // ============================================================
    // RANKS SECTION
    // ============================================================
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(254, 242, 242);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🏆 سلم الرتب والترقيات'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    // Prepare ranks data
    const ranksTableData = ranks
        .sort((a, b) => a.minPoints - b.minPoints)
        .map((rank, index) => [
            rank.icon || '⭐',
            reverseArabic(rank.name),
            String(rank.minPoints),
            reverseArabic(rank.description || `المستوى ${index + 1}`)
        ]);

    if (ranksTableData.length > 0) {
        doc.autoTable({
            startY: yPos,
            head: [[
                reverseArabic('الوصف'),
                reverseArabic('النقاط المطلوبة'),
                reverseArabic('الرتبة'),
                reverseArabic('الأيقونة'),
            ]],
            body: ranksTableData,
            theme: 'grid',
            styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [254, 242, 242] },
            margin: { left: margin, right: margin },
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // ============================================================
    // FINANCIAL SECTION (if enabled)
    // ============================================================
    
    if (config.financial) {
        // Check if we need a new page
        if (yPos > pageHeight - 60) {
            doc.addPage();
            yPos = margin;
        }

        doc.setFillColor(236, 253, 245);
        doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
        doc.setTextColor(5, 150, 105);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(reverseArabic('💰 نظام الصرف المالي'), pageWidth - margin, yPos + 2, { align: 'right' });

        yPos += 15;

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.text(reverseArabic(`• سعر الصرف: ${config.financial.exchangeRate} ريال لكل نقطة`), pageWidth - margin, yPos, { align: 'right' });
        yPos += 7;
        doc.text(reverseArabic(`• الحد الأدنى للسحب: ${config.financial.minRedemption} نقطة`), pageWidth - margin, yPos, { align: 'right' });
        yPos += 7;
        doc.text(reverseArabic('• يتم مراجعة طلبات السحب من قبل الإدارة خلال 48 ساعة'), pageWidth - margin, yPos, { align: 'right' });
    }

    // ============================================================
    // COMMITMENT/STREAK REWARDS SECTION
    // ============================================================
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(255, 237, 213);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 10, 'F');
    doc.setTextColor(194, 65, 12);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('🔥 نظام مكافآت الالتزام (Daily Streaks)'), pageWidth - margin, yPos + 2, { align: 'right' });

    yPos += 15;

    // Default commitment milestones if not provided
    const commitmentMilestones = hotelInfo.commitmentMilestones || [
        { day: 1, rewardPoints: 1, label: 'بداية الرحلة' },
        { day: 3, rewardPoints: 50, label: 'المثابر' },
        { day: 7, rewardPoints: 150, label: 'أسبوع الانضباط' },
        { day: 15, rewardPoints: 400, label: 'خبير الالتزام' },
        { day: 30, rewardPoints: 1000, label: 'بطل Adora الذهبي' }
    ];

    const commitmentTableData = commitmentMilestones.map(m => [
        String(m.rewardPoints),
        reverseArabic(m.label),
        `${m.day} ${m.day === 1 ? reverseArabic('يوم') : reverseArabic('أيام')}`
    ]);

    doc.autoTable({
        startY: yPos,
        head: [[
            reverseArabic('النقاط'),
            reverseArabic('اللقب'),
            reverseArabic('أيام الالتزام')
        ]],
        body: commitmentTableData,
        theme: 'grid',
        styles: { halign: 'center', fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [194, 65, 12], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 237, 213] },
        margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Commitment explanation
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(reverseArabic('* يتم احتساب الالتزام بناءً على تسجيل الحضور اليومي وإنجاز المهام. يُسمح بيوم راحة واحد أسبوعياً دون فقدان السلسلة.'), pageWidth - margin, yPos, { align: 'right', maxWidth: pageWidth - (2 * margin) });

    yPos += 15;

    // ============================================================
    // QUALITY WARNING SECTION
    // ============================================================
    
    // Check if we need a new page
    if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(254, 226, 226);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 25, 'F');
    doc.setDrawColor(239, 68, 68);
    doc.rect(margin, yPos - 5, pageWidth - (2 * margin), 25, 'S');
    
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('⚠️ تنبيه هام - ضمان الجودة'), pageWidth - margin - 5, yPos + 3, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(127, 29, 29);
    doc.text(reverseArabic('السرعة الزائدة عن الحد (أقل من 50% من الوقت المتوقع) قد تؤدي لتعليق النقاط للمراجعة لضمان جودة الخدمة.'), pageWidth - margin - 5, yPos + 12, { align: 'right', maxWidth: pageWidth - (2 * margin) - 10 });

    yPos += 35;

    // ============================================================
    // MANAGER SIGNATURE SECTION
    // ============================================================
    
    // Check if we need a new page
    if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = margin;
    }

    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPos, pageWidth - (2 * margin), 40, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPos, pageWidth - (2 * margin), 40, 'S');

    // Signature lines
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    
    // Manager signature (right side)
    doc.text(reverseArabic('توقيع مدير الفندق'), pageWidth - margin - 40, yPos + 10, { align: 'center' });
    doc.line(pageWidth - margin - 70, yPos + 25, pageWidth - margin - 10, yPos + 25);
    if (hotelInfo.managerName) {
        doc.setFontSize(9);
        doc.text(reverseArabic(hotelInfo.managerName), pageWidth - margin - 40, yPos + 32, { align: 'center' });
    }

    // Date (left side)
    doc.setFontSize(10);
    doc.text(reverseArabic('التاريخ'), margin + 40, yPos + 10, { align: 'center' });
    doc.line(margin + 10, yPos + 25, margin + 70, yPos + 25);
    doc.setFontSize(9);
    doc.text(hotelInfo.generatedDate, margin + 40, yPos + 32, { align: 'center' });

    // Motivational quote in center
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic('✨ إتقانك للعمل هو سر نجاحنا ✨'), pageWidth / 2, yPos + 20, { align: 'center' });

    // ============================================================
    // FOOTER (All Pages)
    // ============================================================
    
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Footer line
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        // Footer text
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Adora Hotel Management System | Page ${i} of ${totalPages}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
        );
        
        // Watermark
        doc.text(
            reverseArabic('وثيقة رسمية - للاستخدام الداخلي فقط'),
            pageWidth / 2,
            pageHeight - 4,
            { align: 'center' }
        );
    }

    // ============================================================
    // SAVE PDF
    // ============================================================
    
    const fileName = `${hotelInfo.name || 'Adora'}_Points_Rulebook_${hotelInfo.generatedDate.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
};

/**
 * Generate simple summary card PDF (one page)
 */
export const generateQuickSummaryPDF = async (
    config: FullPointsConfig,
    hotelName: string
): Promise<void> => {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;
    const margin = 10;

    // Header
    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(reverseArabic(`${hotelName} - ملخص نظام النقاط`), pageWidth - margin, 16, { align: 'right' });

    // Quick reference table
    const summaryData = [
        [
            reverseArabic('النظافة'),
            `+${config.housekeeping.fast}`,
            `${config.housekeeping.fastTime}m`,
            `${config.housekeeping.delay}`,
            `${config.housekeeping.delayTime}m`
        ],
        [
            reverseArabic('البيلمان'),
            `+${config.bellman.fast}`,
            `${config.bellman.fastTime}m`,
            `${config.bellman.delay}`,
            `${config.bellman.delayTime}m`
        ],
        [
            reverseArabic('الصيانة'),
            `+${config.maintenance.fast}`,
            `${config.maintenance.fastTime}m`,
            `${config.maintenance.delay}`,
            `${config.maintenance.delayTime}m`
        ],
        [
            reverseArabic('الكوفي شوب'),
            `+${config.coffeeShop.fast}`,
            `${config.coffeeShop.fastTime}m`,
            `${config.coffeeShop.delay}`,
            `${config.coffeeShop.delayTime}m`
        ],
    ];

    doc.autoTable({
        startY: 35,
        head: [[
            reverseArabic('وقت التأخير'),
            reverseArabic('خصم التأخير'),
            reverseArabic('وقت السرعة'),
            reverseArabic('مكافأة السرعة'),
            reverseArabic('القسم')
        ]],
        body: summaryData,
        theme: 'grid',
        styles: { halign: 'center', fontSize: 12, cellPadding: 6 },
        headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 250] },
        margin: { left: margin, right: margin },
    });

    // Footer note
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(
        reverseArabic('* m = دقائق | الأرقام السالبة تعني خصم من النقاط'),
        pageWidth / 2,
        (doc as any).lastAutoTable.finalY + 15,
        { align: 'center' }
    );

    // Save
    const date = new Date().toLocaleDateString('ar-EG');
    doc.save(`Quick_Points_Summary_${date.replace(/\//g, '-')}.pdf`);
};

export default {
    generateRulebookPDF,
    generateQuickSummaryPDF
};
