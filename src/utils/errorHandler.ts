/**
 * Enhanced Error Handler - Human-Readable Error Messages
 * Adora Hotel Management System
 * 
 * FEATURES:
 * - Translates Firebase errors to Arabic
 * - Provides context-specific error messages
 * - Logs errors for debugging while showing user-friendly messages
 * - Handles network errors gracefully
 */

import { FirebaseError } from 'firebase/app';

// ============================================================
// ERROR MESSAGE MAPPINGS
// ============================================================

const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'auth/user-not-found': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل',
  'auth/weak-password': 'كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل',
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/user-disabled': 'هذا الحساب معطل. يرجى التواصل مع الإدارة',
  'auth/too-many-requests': 'محاولات كثيرة. يرجى المحاولة لاحقاً',
  'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت',

  // Firestore errors
  'permission-denied': 'ليس لديك صلاحية لتنفيذ هذا الإجراء',
  'not-found': 'البيانات المطلوبة غير موجودة',
  'already-exists': 'هذا العنصر موجود بالفعل',
  'cancelled': 'تم إلغاء العملية',
  'unknown': 'حدث خطأ غير متوقع',
  'invalid-argument': 'البيانات المدخلة غير صحيحة',
  'deadline-exceeded': 'انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى',
  'unauthenticated': 'يجب تسجيل الدخول أولاً',
  'resource-exhausted': 'تم تجاوز الحد المسموح. يرجى التواصل مع الإدارة',
  'failed-precondition': 'لا يمكن تنفيذ هذا الإجراء في الوقت الحالي',
  'aborted': 'تم إيقاف العملية بسبب تضارب. يرجى المحاولة مرة أخرى',
  'out-of-range': 'القيمة المدخلة خارج النطاق المسموح',
  'unimplemented': 'هذه الميزة غير متوفرة حالياً',
  'internal': 'خطأ داخلي في الخادم. يرجى التواصل مع الدعم الفني',
  'unavailable': 'الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً',
  'data-loss': 'فقدان البيانات. يرجى التواصل مع الدعم الفني فوراً',

  // Storage errors
  'storage/unauthorized': 'ليس لديك صلاحية للوصول إلى هذا الملف',
  'storage/canceled': 'تم إلغاء رفع الملف',
  'storage/unknown': 'حدث خطأ أثناء رفع الملف',
  'storage/object-not-found': 'الملف غير موجود',
  'storage/bucket-not-found': 'مساحة التخزين غير موجودة',
  'storage/project-not-found': 'المشروع غير موجود',
  'storage/quota-exceeded': 'تم تجاوز حد التخزين المسموح',
  'storage/unauthenticated': 'يجب تسجيل الدخول لرفع الملفات',
  'storage/retry-limit-exceeded': 'فشل رفع الملف بعد عدة محاولات',
  'storage/invalid-checksum': 'الملف تالف. يرجى المحاولة مرة أخرى',
  'storage/invalid-event-name': 'خطأ في نظام رفع الملفات',
  'storage/invalid-url': 'رابط الملف غير صحيح',
  'storage/invalid-argument': 'معلومات الملف غير صحيحة',
  'storage/no-default-bucket': 'لم يتم تكوين مساحة التخزين',
  'storage/cannot-slice-blob': 'خطأ في قراءة الملف',
  'storage/server-file-wrong-size': 'حجم الملف غير متطابق',
};

// Context-specific error messages
const OPERATION_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  'check-in': {
    'permission-denied': 'ليس لديك صلاحية لتسجيل دخول النزلاء',
    'already-exists': 'هذه الغرفة مشغولة بالفعل',
    'not-found': 'الغرفة غير موجودة في النظام',
    'invalid-argument': 'بيانات النزيل غير كاملة أو غير صحيحة',
  },
  'check-out': {
    'permission-denied': 'ليس لديك صلاحية لتسجيل خروج النزلاء',
    'not-found': 'بيانات الحجز غير موجودة',
    'failed-precondition': 'لا يمكن تسجيل الخروج. الغرفة قيد التنظيف',
  },
  'request': {
    'permission-denied': 'ليس لديك صلاحية لإنشاء طلبات',
    'invalid-argument': 'معلومات الطلب غير كاملة',
    'not-found': 'الطلب غير موجود أو تم حذفه',
  },
  'inspection': {
    'permission-denied': 'ليس لديك صلاحية للفحص',
    'failed-precondition': 'لا يمكن إتمام الفحص. التنظيف غير مكتمل',
  },
  'cleaning': {
    'permission-denied': 'ليس لديك صلاحية لإدارة التنظيف',
    'failed-precondition': 'لا يمكن بدء التنظيف. الغرفة غير جاهزة',
  },
  'maintenance': {
    'permission-denied': 'ليس لديك صلاحية لإدارة الصيانة',
    'not-found': 'طلب الصيانة غير موجود',
  },
};

// Network error detection
const NETWORK_ERROR_KEYWORDS = [
  'network',
  'offline',
  'internet',
  'connection',
  'timeout',
  'failed to fetch',
  'networkerror',
];

// ============================================================
// ERROR HANDLER CLASS
// ============================================================

export class AppError extends Error {
  public readonly code?: string;
  public readonly operation?: string;
  public readonly userMessage: string;
  public readonly technicalMessage: string;

  constructor(
    message: string,
    code?: string,
    operation?: string,
    technicalDetails?: string
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.operation = operation;
    this.userMessage = message;
    this.technicalMessage = technicalDetails || message;
  }
}

// ============================================================
// ERROR PARSING FUNCTIONS
// ============================================================

/**
 * Check if error is network-related
 */
function isNetworkError(error: any): boolean {
  const errorString = error?.message?.toLowerCase() || '';
  return NETWORK_ERROR_KEYWORDS.some(keyword => errorString.includes(keyword));
}

/**
 * Extract Firebase error code
 */
function getFirebaseErrorCode(error: any): string | undefined {
  if (error instanceof FirebaseError) {
    return error.code;
  }
  if (error?.code && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

/**
 * Get human-readable error message
 */
export function getErrorMessage(
  error: any,
  operation?: string,
  fallbackMessage: string = 'حدث خطأ غير متوقع'
): string {
  // Network errors
  if (isNetworkError(error)) {
    return 'لا يوجد اتصال بالإنترنت. سيتم حفظ العملية وتنفيذها تلقائياً عند العودة';
  }

  // Firebase errors
  const errorCode = getFirebaseErrorCode(error);
  if (errorCode) {
    // Check operation-specific message first
    if (operation && OPERATION_ERROR_MESSAGES[operation]?.[errorCode]) {
      return OPERATION_ERROR_MESSAGES[operation][errorCode];
    }

    // Check generic Firebase message
    if (FIREBASE_ERROR_MESSAGES[errorCode]) {
      return FIREBASE_ERROR_MESSAGES[errorCode];
    }
  }

  // Custom AppError
  if (error instanceof AppError) {
    return error.userMessage;
  }

  // Error with message property
  if (error?.message && typeof error.message === 'string') {
    // Remove Request ID from error message (Firebase technical info)
    const cleanMessage = error.message.replace(/Request ID: [a-f0-9-]+/gi, '').trim();
    // If message is in Arabic, return it directly
    if (/[\u0600-\u06FF]/.test(cleanMessage)) {
      return cleanMessage;
    }
  }

  // Fallback
  return fallbackMessage;
}

/**
 * Handle and log error with context
 */
export function handleError(
  error: any,
  operation: string,
  context?: Record<string, any>
): AppError {
  // Log technical details for debugging (without Request ID)
  const cleanMessage = error?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || '';
  console.error(`[${operation}] Error:`, {
    code: getFirebaseErrorCode(error),
    message: cleanMessage,
    stack: error?.stack,
    context,
  });

  // Get user-friendly message (without Request ID)
  const userMessage = getErrorMessage(error, operation);
  const technicalMessage = cleanMessage || error?.toString() || 'Unknown error';

  return new AppError(
    userMessage,
    getFirebaseErrorCode(error),
    operation,
    technicalMessage
  );
}

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  fallbackMessage?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw handleError(error, operation);
  }
}

/**
 * Extract validation errors from Zod
 */
export function getValidationErrorMessage(errors: Record<string, string>): string {
  const firstError = Object.values(errors)[0];
  return firstError || 'بيانات غير صحيحة';
}

// ============================================================
// OFFLINE QUEUE HELPERS
// ============================================================

/**
 * Check if error is recoverable (can be queued for offline retry)
 */
export function isRecoverableError(error: any): boolean {
  return isNetworkError(error);
}

/**
 * Get retry delay based on error type
 */
export function getRetryDelay(error: any, attemptCount: number): number {
  if (isNetworkError(error)) {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, attemptCount), 30000);
  }

  const errorCode = getFirebaseErrorCode(error);
  if (errorCode === 'deadline-exceeded' || errorCode === 'unavailable') {
    return 5000; // 5 seconds for timeout/unavailable
  }

  return 0; // Don't retry other errors
}
