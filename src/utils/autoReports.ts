/**
 * Auto Reports System
 * Automatic daily and shift reports
 * Adora Hotel Management System V2
 */

import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// ============================================================
// TYPES
// ============================================================

export interface ReportStats {
    cleanedRooms: number;
    checkouts: number;
    stayovers: number;
    activeRooms: number;
    lateRooms: number;
    activeRequests: number;
    activeMaintenance: number;
    pendingProcurement: number;
    completedProcurement: number;
}

export interface ShiftData {
    startTime?: string;
    completedRequests?: number;
    completedMaintenance?: number;
}

// ============================================================
// STATS COLLECTION
// ============================================================

/**
 * Get report statistics from Firebase (tenant-scoped when tenantId provided)
 */
export const getReportStats = async (tenantId?: string): Promise<ReportStats> => {
    const stats: ReportStats = {
        cleanedRooms: 0,
        checkouts: 0,
        stayovers: 0,
        activeRooms: 0,
        lateRooms: 0,
        activeRequests: 0,
        activeMaintenance: 0,
        pendingProcurement: 0,
        completedProcurement: 0,
    };

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfDay = Timestamp.fromDate(today);

        // ✅ Tenant-scoped: pass tenantId for production (root 'requests' is read-disallowed in rules)
        const requestsRef = tenantId
            ? collection(db, 'tenants', tenantId, 'requests')
            : collection(db, 'requests');
        const completedQuery = query(
            requestsRef,
            where('status', '==', 'COMPLETED'),
            where('timeline.completed', '>=', startOfDay)
        );
        const completedSnapshot = await getDocs(completedQuery);

        completedSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.type === 'cleaning') {
                stats.cleanedRooms++;
                if (data.details?.cleaningType === 'checkout') {
                    stats.checkouts++;
                } else {
                    stats.stayovers++;
                }
            } else if (data.type === 'maintenance') {
                stats.activeMaintenance++;
            }
        });

        // Get active requests
        const activeQuery = query(
            requestsRef,
            where('status', 'in', ['CONFIRMED', 'IN_PROGRESS'])
        );
        const activeSnapshot = await getDocs(activeQuery);
        stats.activeRequests = activeSnapshot.size;

        // Get procurement stats
        const procRef = collection(db, 'procurement');
        const pendingProcQuery = query(procRef, where('status', '==', 'PENDING'));
        const pendingProcSnapshot = await getDocs(pendingProcQuery);
        stats.pendingProcurement = pendingProcSnapshot.size;

        const completedProcQuery = query(
            procRef,
            where('status', '==', 'RECEIVED'),
            where('receivedAt', '>=', startOfDay)
        );
        const completedProcSnapshot = await getDocs(completedProcQuery);
        stats.completedProcurement = completedProcSnapshot.size;

    } catch (error) {
        console.error('Failed to get report stats:', error);
    }

    return stats;
};

// ============================================================
// REPORT GENERATION
// ============================================================

/**
 * Generate 8PM daily report
 */
export const generate8PMReport = async (branchName = 'الفندق', tenantId?: string): Promise<string> => {
    const stats = await getReportStats(tenantId);
    const today = new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return `📊 *تقرير يومي - الساعة 8 مساءً*
🏨 ${branchName}
📅 ${today}
➖➖➖➖➖➖➖➖➖➖

✅ *الإنجاز اليومي:*
   🧹 غرف منظفة: ${stats.cleanedRooms}
   🚨 خروج: ${stats.checkouts}
   🏠 ساكن: ${stats.stayovers}

⚠️ *الحالة النشطة:*
   🔵 غرف نشطة: ${stats.activeRooms}
   🔴 غرف متأخرة: ${stats.lateRooms}
   🛎️ طلبات نشطة: ${stats.activeRequests}
   🛠️ صيانة نشطة: ${stats.activeMaintenance}

📈 *المشتريات:*
   📤 طلبات معلقة: ${stats.pendingProcurement}
   ✅ مشتريات مكتملة: ${stats.completedProcurement}

➖➖➖➖➖➖➖➖➖➖
#تقرير_يومي #Adora`;
};

/**
 * Generate shift report
 */
export const generateShiftReport = async (
    employeeName: string,
    branchName: string,
    shiftData: ShiftData = {},
    tenantId?: string
): Promise<string> => {
    const stats = await getReportStats(tenantId);
    const now = new Date();

    return `📋 *تقرير نهاية الشفت*
🏨 ${branchName}
👤 ${employeeName}
🕐 ${now.toLocaleTimeString('ar-EG')}
➖➖➖➖➖➖➖➖➖➖

✅ *الإنجاز:*
   🧹 غرف منظفة: ${stats.cleanedRooms}
   🛎️ طلبات منفذة: ${shiftData.completedRequests || 0}
   🛠️ صيانة مكتملة: ${shiftData.completedMaintenance || 0}

⏱️ *الوقت:*
   ⏰ بداية الشفت: ${shiftData.startTime || 'غير محدد'}
   ⏰ نهاية الشفت: ${now.toLocaleTimeString('ar-EG')}

➖➖➖➖➖➖➖➖➖➖
#تقرير_شفت #Adora`;
};

/**
 * Generate room report
 */
export const generateRoomReport = (roomData: {
    roomNumber: string;
    status?: string;
    startTime?: string;
    endTime?: string;
    duration?: string;
    notes?: string;
}): string => {
    return `🏠 *تقرير غرفة ${roomData.roomNumber}*
📅 ${new Date().toLocaleDateString('ar-EG')}
➖➖➖➖➖➖➖➖➖➖

📊 *الحالة:* ${roomData.status || 'غير محدد'}
⏱️ *وقت البدء:* ${roomData.startTime || 'غير محدد'}
⏱️ *وقت الانتهاء:* ${roomData.endTime || 'غير محدد'}
⏰ *المدة:* ${roomData.duration || 'غير محدد'}

📝 *ملاحظات:* ${roomData.notes || 'لا توجد'}

#تقرير_غرفة #Adora`;
};

// ============================================================
// WHATSAPP INTEGRATION
// ============================================================

/**
 * Send report via WhatsApp
 */
export const sendReportViaWhatsApp = (report: string): void => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(whatsappUrl, '_blank');
};

/**
 * Send 8PM report via WhatsApp
 */
export const sendAutoReport8PM = async (branchName?: string): Promise<void> => {
    const report = await generate8PMReport(branchName);
    sendReportViaWhatsApp(report);
};

// ============================================================
// SCHEDULING
// ============================================================

let scheduledTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule automatic 8PM report
 */
export const scheduleAutoReport = (): void => {
    if (scheduledTimeout) {
        clearTimeout(scheduledTimeout);
    }

    const now = new Date();
    const report8PM = new Date();
    report8PM.setHours(20, 0, 0, 0); // 8:00 PM

    // If past 8PM, schedule for next day
    if (now > report8PM) {
        report8PM.setDate(report8PM.getDate() + 1);
    }

    const msUntilReport = report8PM.getTime() - now.getTime();

    console.log(`⏰ التقرير التلقائي مجدول بعد ${Math.round(msUntilReport / 60000)} دقيقة`);

    scheduledTimeout = setTimeout(async () => {
        const autoSend = localStorage.getItem('adora_auto_report') !== 'false';

        if (autoSend) {
            await sendAutoReport8PM();
        }

        // Reschedule for next day
        scheduleAutoReport();
    }, msUntilReport);
};

/**
 * Cancel scheduled report
 */
export const cancelScheduledReport = (): void => {
    if (scheduledTimeout) {
        clearTimeout(scheduledTimeout);
        scheduledTimeout = null;
    }
};

// ============================================================
// TEMPLATES
// ============================================================

const DEFAULT_TEMPLATES: Record<string, string> = {
    addRoom: `🏠 *تم إضافة غرفة*
📍 رقم الغرفة: {roomNumber}
📋 النوع: {type}
⏰ الوقت: {time}`,

    finishRoom: `✅ *تم إنهاء الغرفة*
📍 رقم الغرفة: {roomNumber}
⏱️ المدة: {duration}
👤 الموظف: {employee}`,
};

/**
 * Get WhatsApp template
 */
export const getWhatsAppTemplate = (templateName: string): string => {
    const customTemplates = JSON.parse(localStorage.getItem('whatsappTemplates') || '{}');
    return customTemplates[templateName] || DEFAULT_TEMPLATES[templateName] || '';
};

/**
 * Save WhatsApp templates
 */
export const saveWhatsAppTemplates = (templates: Record<string, string>): void => {
    localStorage.setItem('whatsappTemplates', JSON.stringify(templates));
};

/**
 * Apply template with data
 */
export const applyTemplate = (template: string, data: Record<string, string>): string => {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
        result = result.replace(new RegExp(`{${key}}`, 'g'), value || '');
    }

    return result;
};
