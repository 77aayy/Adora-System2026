/**
 * Error Toast Service
 * Integrates Arabic error messages with Toast notifications
 * 
 * ✅ Features:
 * - Arabic Firebase error translations
 * - User-friendly error messages
 * - Action suggestions
 * 
 * Adora Hotel Management System V3
 */

import { toast } from '../components/common/ToastManager';

// ============================================================
// ARABIC ERROR MESSAGES
// ============================================================

const FIREBASE_AUTH_ERRORS: Record<string, string> = {
    'auth/invalid-api-key': '❌ مفتاح API غير صالح - تواصل مع الدعم الفني',
    'auth/app-deleted': '❌ تم حذف التطبيق',
    'auth/invalid-user-token': '⚠️ انتهت صلاحية الجلسة - سجل دخول مرة أخرى',
    'auth/network-request-failed': '🌐 فشل الاتصال بالشبكة - تحقق من الإنترنت',
    'auth/operation-not-allowed': '🚫 هذه العملية غير مسموحة',
    'auth/requires-recent-login': '🔐 يتطلب تسجيل دخول حديث - سجل خروج ودخول مرة أخرى',
    'auth/too-many-requests': '⏳ عدد محاولات كثيرة - انتظر دقيقة وحاول مرة أخرى',
    'auth/user-disabled': '🚷 هذا الحساب معطل - تواصل مع المدير',
    'auth/user-not-found': '❓ المستخدم غير موجود',
    'auth/wrong-password': '🔑 كلمة المرور خاطئة',
    'auth/invalid-email': '📧 البريد الإلكتروني غير صالح',
    'auth/email-already-in-use': '📧 البريد الإلكتروني مستخدم بالفعل',
    'auth/weak-password': '🔐 كلمة المرور ضعيفة - استخدم 6 أحرف على الأقل',
    'auth/credential-already-in-use': '⚠️ بيانات الدخول مستخدمة بالفعل',
    'auth/invalid-credential': '❌ بيانات الدخول غير صالحة',
    'auth/popup-closed-by-user': '🪟 تم إغلاق نافذة تسجيل الدخول',
};

const FIRESTORE_ERRORS: Record<string, string> = {
    'permission-denied': '🔒 صلاحيات غير كافية - تواصل مع المدير',
    'unavailable': '🌐 الخدمة غير متاحة حالياً - حاول لاحقاً',
    'cancelled': '🚫 تم إلغاء العملية',
    'unknown': '❓ حدث خطأ غير معروف',
    'invalid-argument': '⚠️ قيمة غير صالحة - تحقق من البيانات المدخلة',
    'deadline-exceeded': '⏱️ انتهت مهلة الطلب - حاول مرة أخرى',
    'not-found': '🔍 البيانات المطلوبة غير موجودة',
    'already-exists': '⚠️ هذا العنصر موجود بالفعل',
    'resource-exhausted': '📊 تم تجاوز حد الاستخدام',
    'failed-precondition': '⚠️ شرط مسبق غير متحقق',
    'aborted': '🚫 تم إلغاء العملية',
    'out-of-range': '📏 القيمة خارج النطاق المسموح',
    'unimplemented': '🔧 هذه الميزة غير متاحة حالياً',
    'internal': '⚙️ خطأ داخلي - تواصل مع الدعم الفني',
    'data-loss': '💾 فقدان في البيانات - تواصل مع الدعم',
    'unauthenticated': '🔐 غير مصادق عليه - سجل دخول أولاً',
};

const STORAGE_ERRORS: Record<string, string> = {
    'storage/unauthorized': '🔒 غير مصرح برفع الملفات',
    'storage/canceled': '🚫 تم إلغاء الرفع',
    'storage/unknown': '❓ خطأ غير معروف في التخزين',
    'storage/object-not-found': '🔍 الملف غير موجود',
    'storage/bucket-not-found': '📦 مساحة التخزين غير موجودة',
    'storage/project-not-found': '🏗️ المشروع غير موجود',
    'storage/quota-exceeded': '📊 تم تجاوز مساحة التخزين المسموحة',
    'storage/unauthenticated': '🔐 سجل دخول أولاً للرفع',
    'storage/invalid-checksum': '⚠️ الملف تالف - حاول مرة أخرى',
    'storage/retry-limit-exceeded': '⏳ فشل الرفع بعد عدة محاولات',
    'storage/invalid-url': '🔗 رابط غير صالح',
    'storage/server-file-wrong-size': '📏 حجم الملف غير متطابق',
};

const NETWORK_ERRORS: Record<string, string> = {
    'ERR_NETWORK': '🌐 فشل الاتصال بالشبكة',
    'ERR_CONNECTION_REFUSED': '🚫 تم رفض الاتصال بالخادم',
    'ERR_CONNECTION_RESET': '🔄 تم إعادة تعيين الاتصال',
    'ERR_INTERNET_DISCONNECTED': '📴 لا يوجد اتصال بالإنترنت',
    'ERR_NAME_NOT_RESOLVED': '🔍 تعذر العثور على الخادم',
    'ERR_TIMED_OUT': '⏱️ انتهت مهلة الاتصال',
    'ECONNABORTED': '🚫 تم إلغاء الاتصال',
};

// ============================================================
// ERROR PARSING
// ============================================================

/**
 * Parse any error and return Arabic message
 */
export const parseError = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    
    // String error
    if (typeof error === 'string') {
        return error;
    }
    
    // Firebase error code
    const code = error.code || error.name || '';
    const message = error.message || '';
    
    // Check Firebase Auth errors
    if (FIREBASE_AUTH_ERRORS[code]) {
        return FIREBASE_AUTH_ERRORS[code];
    }
    
    // Check Firestore errors
    const firestoreCode = code.replace('firestore/', '');
    if (FIRESTORE_ERRORS[firestoreCode]) {
        return FIRESTORE_ERRORS[firestoreCode];
    }
    
    // Check Storage errors
    if (STORAGE_ERRORS[code]) {
        return STORAGE_ERRORS[code];
    }
    
    // Check Network errors
    if (NETWORK_ERRORS[code]) {
        return NETWORK_ERRORS[code];
    }
    
    // Check for common patterns in message
    if (message.includes('permission')) {
        return '🔒 صلاحيات غير كافية - تواصل مع المدير';
    }
    if (message.includes('network') || message.includes('offline')) {
        return '🌐 فشل الاتصال بالشبكة - تحقق من الإنترنت';
    }
    if (message.includes('timeout')) {
        return '⏱️ انتهت مهلة الطلب - حاول مرة أخرى';
    }
    if (message.includes('quota')) {
        return '📊 تم تجاوز حد الاستخدام';
    }
    if (message.includes('invalid')) {
        return '⚠️ بيانات غير صالحة - تحقق من المدخلات';
    }
    
    // Fallback
    return error.message || 'حدث خطأ غير متوقع';
};

// ============================================================
// TOAST HELPERS
// ============================================================

/**
 * Show error toast with Arabic message
 */
export const showErrorToast = (error: any, duration: number = 5000): void => {
    const message = parseError(error);
    toast.error(message, duration);
};

/**
 * Show success toast
 */
export const showSuccessToast = (message: string, duration: number = 3000): void => {
    toast.success(message, duration);
};

/**
 * Show warning toast
 */
export const showWarningToast = (message: string, duration: number = 4000): void => {
    toast.warning(message, duration);
};

/**
 * Show info toast
 */
export const showInfoToast = (message: string, duration: number = 3000): void => {
    toast.info(message, duration);
};

// ============================================================
// SPECIFIC ERROR HANDLERS
// ============================================================

/**
 * Handle Firebase connection errors
 */
export const handleFirebaseError = (error: any): void => {
    console.error('Firebase Error:', error);
    showErrorToast(error);
};

/**
 * Handle form validation errors
 */
export const handleValidationError = (field: string, issue: string): void => {
    showWarningToast(`⚠️ ${field}: ${issue}`);
};

/**
 * Handle API errors with retry suggestion
 */
export const handleApiError = (error: any, actionName: string = 'العملية'): void => {
    const message = parseError(error);
    toast.error(`فشل ${actionName}: ${message}`, 6000);
};

/**
 * Handle offline errors
 */
export const handleOfflineError = (): void => {
    toast.warning('📴 أنت غير متصل بالإنترنت - سيتم حفظ التغييرات محلياً', 4000);
};

/**
 * Handle permission errors
 */
export const handlePermissionError = (): void => {
    toast.error('🔒 ليس لديك صلاحية لهذه العملية - تواصل مع المدير', 5000);
};

// ============================================================
// OPERATION WRAPPERS
// ============================================================

/**
 * Wrap async operation with automatic error handling
 */
export const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    options: {
        successMessage?: string;
        errorPrefix?: string;
        showSuccess?: boolean;
    } = {}
): Promise<T | null> => {
    try {
        const result = await operation();
        
        if (options.showSuccess && options.successMessage) {
            showSuccessToast(options.successMessage);
        }
        
        return result;
    } catch (error) {
        const prefix = options.errorPrefix ? `${options.errorPrefix}: ` : '';
        const message = parseError(error);
        showErrorToast(`${prefix}${message}`);
        return null;
    }
};

export default {
    parseError,
    showErrorToast,
    showSuccessToast,
    showWarningToast,
    showInfoToast,
    handleFirebaseError,
    handleValidationError,
    handleApiError,
    handleOfflineError,
    handlePermissionError,
    withErrorHandling
};
