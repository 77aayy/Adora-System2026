/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * URL Parameter Validation Service
 * 
 * 🔐 SECURITY: Validates and sanitizes all URL parameters to prevent:
 * - XSS Injection attacks
 * - SQL/NoSQL Injection
 * - Path Traversal attacks
 * - Type confusion attacks
 * - Physics Engine manipulation
 * 
 * Usage:
 * ```tsx
 * const { room, branch, tenant } = useValidatedURLParams(['room', 'branch', 'tenant']);
 * ```
 */

// ============================================================
// TYPES
// ============================================================

export interface ValidatedParam {
    value: string | null;
    isValid: boolean;
    error?: string;
}

export interface ValidatedURLParams {
    [key: string]: ValidatedParam;
}

// ============================================================
// XSS & INJECTION PATTERNS
// ============================================================

const XSS_PATTERNS = [
    /<script[^>]*>/gi,
    /<\/script>/gi,
    /javascript:/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onload\s*=/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /expression\(/gi,
];

const SQL_INJECTION_PATTERNS = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/gi,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
];

const PATH_TRAVERSAL_PATTERNS = [
    /\.\./g,
    /\/\.\./g,
    /\.\.\//g,
];

// ============================================================
// SANITIZATION FUNCTIONS
// ============================================================

/**
 * Sanitize a URL parameter value
 * Removes all dangerous patterns
 */
export const sanitizeURLParam = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    // Trim whitespace
    let sanitized = value.trim();

    // Remove XSS patterns
    XSS_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // Remove SQL injection patterns
    SQL_INJECTION_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // Remove path traversal patterns
    PATH_TRAVERSAL_PATTERNS.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '');
    });

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Limit length (prevent DoS)
    if (sanitized.length > 500) {
        sanitized = sanitized.substring(0, 500);
    }

    return sanitized || null;
};

/**
 * Validate room number format (2-4 digits only)
 */
export const validateRoomNumber = (room: string | null): ValidatedParam => {
    const sanitized = sanitizeURLParam(room);
    
    if (!sanitized) {
        return { value: null, isValid: false, error: 'Room number is required' };
    }

    // Only digits, 2-4 characters
    if (!/^\d{2,4}$/.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: 'Room number must be 2-4 digits only' 
        };
    }

    const roomNum = parseInt(sanitized, 10);
    
    // Range validation
    if (roomNum < 100 || roomNum > 9999) {
        return { 
            value: null, 
            isValid: false, 
            error: 'Room number must be between 100 and 9999' 
        };
    }

    return { value: sanitized, isValid: true };
};

/**
 * Validate Firestore document ID format
 * Firestore IDs: alphanumeric, max 1500 chars, no special chars
 */
export const validateDocumentID = (id: string | null, paramName: string = 'ID'): ValidatedParam => {
    const sanitized = sanitizeURLParam(id);
    
    if (!sanitized) {
        return { value: null, isValid: false, error: `${paramName} is required` };
    }

    // Firestore ID format: alphanumeric + underscore + hyphen
    // Max 1500 characters
    if (!/^[a-zA-Z0-9_-]{1,1500}$/.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: `${paramName} contains invalid characters` 
        };
    }

    // Prevent dangerous IDs
    const dangerousPatterns = ['admin', 'root', 'system', '__proto__', 'constructor'];
    const lowerId = sanitized.toLowerCase();
    
    if (dangerousPatterns.some(pattern => lowerId.includes(pattern))) {
        return { 
            value: null, 
            isValid: false, 
            error: `${paramName} contains forbidden pattern` 
        };
    }

    return { value: sanitized, isValid: true };
};

/**
 * Validate token format (JWT-like: base64url encoded)
 */
export const validateToken = (token: string | null): ValidatedParam => {
    const sanitized = sanitizeURLParam(token);
    
    if (!sanitized) {
        return { value: null, isValid: false };
    }

    // Token format: base64url (alphanumeric + - + _)
    // Typical length: 100-500 chars
    if (!/^[A-Za-z0-9_-]{50,1000}$/.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: 'Invalid token format' 
        };
    }

    return { value: sanitized, isValid: true };
};

/**
 * Validate tab parameter (must be alphanumeric + hyphen/underscore)
 */
export const validateTab = (tab: string | null): ValidatedParam => {
    const sanitized = sanitizeURLParam(tab);
    
    if (!sanitized) {
        return { value: null, isValid: false };
    }

    // Tab names: alphanumeric + hyphen/underscore, max 50 chars
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: 'Invalid tab name' 
        };
    }

    return { value: sanitized, isValid: true };
};

/**
 * Validate demo key format
 */
export const validateDemoKey = (key: string | null): ValidatedParam => {
    const sanitized = sanitizeURLParam(key);
    
    if (!sanitized) {
        return { value: null, isValid: false, error: 'Demo key is required' };
    }

    // Demo key format: alphanumeric + hyphen, 20-50 chars
    if (!/^[a-zA-Z0-9-]{20,50}$/.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: 'Invalid demo key format' 
        };
    }

    return { value: sanitized, isValid: true };
};

/**
 * Validate safe string (alphanumeric + Arabic + basic punctuation)
 */
export const validateSafeString = (
    str: string | null, 
    maxLength: number = 200,
    allowArabic: boolean = true
): ValidatedParam => {
    const sanitized = sanitizeURLParam(str);
    
    if (!sanitized) {
        return { value: null, isValid: false };
    }

    if (sanitized.length > maxLength) {
        return { 
            value: null, 
            isValid: false, 
            error: `String exceeds maximum length of ${maxLength}` 
        };
    }

    // Pattern: alphanumeric + Arabic + space + basic punctuation
    const pattern = allowArabic 
        ? /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s\-\._,]+$/
        : /^[a-zA-Z0-9\s\-\._,]+$/;

    if (!pattern.test(sanitized)) {
        return { 
            value: null, 
            isValid: false, 
            error: 'String contains invalid characters' 
        };
    }

    return { value: sanitized, isValid: true };
};

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate multiple URL parameters at once
 * Returns validated params object
 */
export const validateURLParams = (
    searchParams: URLSearchParams,
    validations: {
        [key: string]: (value: string | null) => ValidatedParam;
    }
): ValidatedURLParams => {
    const result: ValidatedURLParams = {};

    for (const [paramName, validator] of Object.entries(validations)) {
        const rawValue = searchParams.get(paramName);
        result[paramName] = validator(rawValue);
    }

    return result;
};

/**
 * Check if URL params contain any suspicious patterns
 * Returns true if suspicious activity detected
 */
export const detectSuspiciousURLActivity = (searchParams: URLSearchParams): boolean => {
    const paramValues = Array.from(searchParams.values()).join(' ').toLowerCase();
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
        'script',
        'javascript:',
        'onerror=',
        'onclick=',
        'eval(',
        'function(',
        'constructor',
        '__proto__',
        'document.cookie',
        'localStorage',
        'sessionStorage',
    ];

    return suspiciousPatterns.some(pattern => paramValues.includes(pattern));
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    sanitizeURLParam,
    validateRoomNumber,
    validateDocumentID,
    validateToken,
    validateTab,
    validateDemoKey,
    validateSafeString,
    validateURLParams,
    detectSuspiciousURLActivity,
};