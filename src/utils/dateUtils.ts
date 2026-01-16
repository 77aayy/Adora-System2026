/**
 * 📅 Date Utilities
 * ==================
 * أدوات تنسيق التاريخ - الميلادي والهجري معاً
 * 
 * @author Adora System
 * @version 1.0
 */

/**
 * 📅 تنسيق التاريخ مع الميلادي والهجري
 * @param date التاريخ
 * @param options خيارات التنسيق
 */
export function formatDualDate(
    date: Date | string | number | { toDate: () => Date },
    options: {
        showGregorian?: boolean;
        showHijri?: boolean;
        dateStyle?: 'full' | 'long' | 'medium' | 'short';
        separator?: string;
    } = {}
): string {
    const {
        showGregorian = true,
        showHijri = true,
        dateStyle = 'medium',
        separator = ' | ',
    } = options;
    
    // تحويل التاريخ إلى Date object
    let dateObj: Date;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
    } else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
    } else {
        return '—';
    }
    
    // التحقق من صحة التاريخ
    if (isNaN(dateObj.getTime())) {
        return '—';
    }
    
    const parts: string[] = [];
    
    // التاريخ الميلادي
    if (showGregorian) {
        const gregorianOptions: Intl.DateTimeFormatOptions = dateStyle === 'full'
            ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
            : dateStyle === 'long'
            ? { year: 'numeric', month: 'long', day: 'numeric' }
            : dateStyle === 'short'
            ? { year: '2-digit', month: 'numeric', day: 'numeric' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
        
        parts.push(dateObj.toLocaleDateString('ar-EG', gregorianOptions));
    }
    
    // التاريخ الهجري
    if (showHijri) {
        const hijriOptions: Intl.DateTimeFormatOptions = dateStyle === 'full'
            ? { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
            : dateStyle === 'long'
            ? { year: 'numeric', month: 'long', day: 'numeric' }
            : dateStyle === 'short'
            ? { year: '2-digit', month: 'numeric', day: 'numeric' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
        
        const hijriDate = dateObj.toLocaleDateString('ar-SA-u-ca-islamic', hijriOptions);
        parts.push(hijriDate + ' هـ');
    }
    
    return parts.join(separator);
}

/**
 * 📅 تنسيق التاريخ الميلادي فقط
 */
export function formatGregorianDate(
    date: Date | string | number | { toDate: () => Date },
    style: 'full' | 'long' | 'medium' | 'short' = 'medium'
): string {
    return formatDualDate(date, { showGregorian: true, showHijri: false, dateStyle: style });
}

/**
 * 📅 تنسيق التاريخ الهجري فقط
 */
export function formatHijriDate(
    date: Date | string | number | { toDate: () => Date },
    style: 'full' | 'long' | 'medium' | 'short' = 'medium'
): string {
    return formatDualDate(date, { showGregorian: false, showHijri: true, dateStyle: style });
}

/**
 * 📅 تنسيق الوقت
 * Enhanced version with locale support for i18n
 */
export function formatTime(
    date: Date | string | number | { toDate: () => Date } | any,
    options: { 
        showSeconds?: boolean; 
        use24Hour?: boolean;
        locale?: string;
        t?: (key: string) => string;
    } = {}
): string {
    const { showSeconds = false, use24Hour = false, locale, t } = options;
    
    // Handle null/undefined
    if (!date) {
        return t ? t('reception.notSpecifiedTime') : '—';
    }
    
    // تحويل التاريخ
    let dateObj: Date;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
    } else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
    } else {
        return t ? t('reception.notSpecifiedTime') : '—';
    }
    
    if (isNaN(dateObj.getTime())) {
        return t ? t('reception.notSpecifiedTime') : '—';
    }
    
    // Determine locale
    const finalLocale = locale || 'ar-SA';
    
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: !use24Hour,
    };
    
    return dateObj.toLocaleTimeString(finalLocale, timeOptions);
}

/**
 * 📅 تنسيق التاريخ والوقت مع locale support
 * Enhanced version for i18n compatibility
 */
export function formatDateTimeWithLocale(
    timestamp: any,
    currentLanguage: string,
    t?: (key: string) => string
): string {
    if (!timestamp) {
        return t ? t('reception.notSpecifiedTime') : '—';
    }
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const locale = currentLanguage === 'ar' ? 'ar-SA' : 
                   currentLanguage === 'hi' ? 'hi-IN' : 
                   currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
    
    return date.toLocaleString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * ⏰ Get time ago with i18n support
 */
export function getTimeAgo(
    timestamp: any,
    t: (key: string, options?: any) => string
): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    
    if (diff < 1) return t('reception.nowTime');
    if (diff < 60) return t('reception.minutesAgo', { minutes: diff });
    if (diff < 1440) return t('reception.hoursAgo', { hours: Math.floor(diff / 60) });
    return t('reception.daysAgo', { days: Math.floor(diff / 1440) });
}

/**
 * 📅 تنسيق التاريخ والوقت معاً
 */
export function formatDateTime(
    date: Date | string | number | { toDate: () => Date },
    options: {
        dateStyle?: 'full' | 'long' | 'medium' | 'short';
        showHijri?: boolean;
        showSeconds?: boolean;
    } = {}
): string {
    const { dateStyle = 'short', showHijri = true, showSeconds = false } = options;
    
    const dateStr = formatDualDate(date, { 
        showGregorian: true, 
        showHijri, 
        dateStyle,
        separator: showHijri ? ' | ' : '',
    });
    const timeStr = formatTime(date, { showSeconds });
    
    return `${dateStr} - ${timeStr}`;
}

/**
 * ⏰ الوقت النسبي (منذ كذا...)
 */
export function formatRelativeTime(
    date: Date | string | number | { toDate: () => Date }
): string {
    // تحويل التاريخ
    let dateObj: Date;
    
    if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        dateObj = new Date(date);
    } else if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
    } else {
        return 'غير محدد';
    }
    
    if (isNaN(dateObj.getTime())) {
        return 'غير محدد';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    
    // المستقبل
    if (diffMs < 0) {
        const futureDiff = Math.abs(diffMs);
        const futureMinutes = Math.floor(futureDiff / 60000);
        const futureHours = Math.floor(futureMinutes / 60);
        const futureDays = Math.floor(futureHours / 24);
        
        if (futureMinutes < 60) return `بعد ${futureMinutes} دقيقة`;
        if (futureHours < 24) return `بعد ${futureHours} ساعة`;
        if (futureDays === 1) return 'غداً';
        return `بعد ${futureDays} يوم`;
    }
    
    // الماضي
    if (diffSeconds < 60) return 'الآن';
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays === 1) return 'أمس';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffWeeks === 1) return 'منذ أسبوع';
    if (diffWeeks < 4) return `منذ ${diffWeeks} أسابيع`;
    if (diffMonths === 1) return 'منذ شهر';
    if (diffMonths < 12) return `منذ ${diffMonths} أشهر`;
    
    // أكثر من سنة
    const years = Math.floor(diffMonths / 12);
    return `منذ ${years} سنة`;
}

/**
 * 📅 تحويل Timestamp إلى Date
 */
export function timestampToDate(timestamp: any): Date | null {
    if (!timestamp) return null;
    
    if (timestamp instanceof Date) return timestamp;
    
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    
    if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000);
    }
    
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        return new Date(timestamp);
    }
    
    return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default {
    formatDualDate,
    formatGregorianDate,
    formatHijriDate,
    formatTime,
    formatDateTime,
    formatRelativeTime,
    timestampToDate,
};
