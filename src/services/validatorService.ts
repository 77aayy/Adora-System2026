/**
 * Input Validator Service
 * Form validation utilities
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

interface ValidationResult {
    valid: boolean;
    message?: string;
}

interface ValidationRule {
    validate: (value: any) => boolean;
    message: string;
}

// ============================================================
// VALIDATORS
// ============================================================

/**
 * Check if value is not empty
 */
export const required = (value: any): ValidationResult => {
    const valid = value !== undefined && value !== null && value !== '';
    return { valid, message: valid ? undefined : 'هذا الحقل مطلوب' };
};

/**
 * Check minimum length
 */
export const minLength = (min: number) => (value: string): ValidationResult => {
    const valid = value.length >= min;
    return { valid, message: valid ? undefined : `الحد الأدنى ${min} أحرف` };
};

/**
 * Check maximum length
 */
export const maxLength = (max: number) => (value: string): ValidationResult => {
    const valid = value.length <= max;
    return { valid, message: valid ? undefined : `الحد الأقصى ${max} أحرف` };
};

/**
 * Check if value is a valid email
 */
export const email = (value: string): ValidationResult => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : 'البريد الإلكتروني غير صحيح' };
};

/**
 * Check if value is a valid phone number
 */
export const phone = (value: string): ValidationResult => {
    const cleaned = value.replace(/\D/g, '');
    const valid = cleaned.length >= 9 && cleaned.length <= 15;
    return { valid, message: valid ? undefined : 'رقم الهاتف غير صحيح' };
};

/**
 * Check if value is a valid Saudi phone number
 */
export const saudiPhone = (value: string): ValidationResult => {
    const cleaned = value.replace(/\D/g, '');
    const regex = /^(05|5|9665|00966)/;
    const valid = regex.test(cleaned) && cleaned.length >= 9;
    return { valid, message: valid ? undefined : 'رقم الجوال السعودي غير صحيح' };
};

/**
 * Check if value is a valid Saudi ID
 */
export const saudiId = (value: string): ValidationResult => {
    const cleaned = value.replace(/\D/g, '');
    const valid = (cleaned.startsWith('1') || cleaned.startsWith('2')) && cleaned.length === 10;
    return { valid, message: valid ? undefined : 'رقم الهوية غير صحيح' };
};

/**
 * Check if value is a valid room number
 */
export const roomNumber = (value: string): ValidationResult => {
    const regex = /^\d{1,4}$/;
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : 'رقم الغرفة غير صحيح' };
};

/**
 * Check if value is a valid employee code
 */
export const employeeCode = (value: string): ValidationResult => {
    const regex = /^\d{4}$/;
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : 'رمز الموظف يجب أن يكون 4 أرقام' };
};

/**
 * Check if value is a valid number
 */
export const isNumber = (value: any): ValidationResult => {
    const valid = !isNaN(Number(value)) && value !== '';
    return { valid, message: valid ? undefined : 'يجب أن يكون رقم' };
};

/**
 * Check if value is positive number
 */
export const positiveNumber = (value: any): ValidationResult => {
    const num = Number(value);
    const valid = !isNaN(num) && num > 0;
    return { valid, message: valid ? undefined : 'يجب أن يكون رقم موجب' };
};

/**
 * Check if value is in range
 */
export const inRange = (min: number, max: number) => (value: any): ValidationResult => {
    const num = Number(value);
    const valid = !isNaN(num) && num >= min && num <= max;
    return { valid, message: valid ? undefined : `يجب أن يكون بين ${min} و ${max}` };
};

/**
 * Check if value matches regex
 */
export const pattern = (regex: RegExp, message: string) => (value: string): ValidationResult => {
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : message };
};

/**
 * Check if two values match
 */
export const matches = (otherValue: any, fieldName: string) => (value: any): ValidationResult => {
    const valid = value === otherValue;
    return { valid, message: valid ? undefined : `يجب أن يطابق ${fieldName}` };
};

/**
 * Check Arabic text only
 */
export const arabicOnly = (value: string): ValidationResult => {
    const regex = /^[\u0600-\u06FF\s]+$/;
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : 'يجب أن يكون نص عربي فقط' };
};

/**
 * Check English text only
 */
export const englishOnly = (value: string): ValidationResult => {
    const regex = /^[a-zA-Z\s]+$/;
    const valid = regex.test(value);
    return { valid, message: valid ? undefined : 'يجب أن يكون نص إنجليزي فقط' };
};

// ============================================================
// FORM VALIDATION
// ============================================================

type ValidatorFn = (value: any) => ValidationResult;

/**
 * Validate a single field
 */
export const validateField = (value: any, validators: ValidatorFn[]): ValidationResult => {
    for (const validator of validators) {
        const result = validator(value);
        if (!result.valid) {
            return result;
        }
    }
    return { valid: true };
};

/**
 * Validate entire form
 */
export const validateForm = <T extends Record<string, any>>(
    data: T,
    rules: Partial<Record<keyof T, ValidatorFn[]>>
): { valid: boolean; errors: Partial<Record<keyof T, string>> } => {
    const errors: Partial<Record<keyof T, string>> = {};
    let valid = true;

    for (const [field, validators] of Object.entries(rules) as [keyof T, ValidatorFn[]][]) {
        if (validators) {
            const result = validateField(data[field], validators);
            if (!result.valid) {
                valid = false;
                errors[field] = result.message;
            }
        }
    }

    return { valid, errors };
};

// ============================================================
// SANITIZATION
// ============================================================

/**
 * Trim whitespace
 */
export const trim = (value: string): string => value.trim();

/**
 * Remove extra spaces
 */
export const normalizeSpaces = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Remove non-numeric characters
 */
export const numbersOnly = (value: string): string => value.replace(/\D/g, '');

/**
 * Format Saudi phone number
 */
export const formatSaudiPhone = (value: string): string => {
    let cleaned = numbersOnly(value);

    if (cleaned.startsWith('00966')) {
        cleaned = cleaned.substring(5);
    } else if (cleaned.startsWith('966')) {
        cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('05')) {
        cleaned = cleaned.substring(1);
    }

    if (cleaned.startsWith('5') && cleaned.length === 9) {
        return `05${cleaned.substring(1)}`;
    }

    return value;
};

/**
 * Format Saudi ID
 */
export const formatSaudiId = (value: string): string => {
    const cleaned = numbersOnly(value);
    return cleaned.substring(0, 10);
};

/**
 * Sanitize HTML
 */
export const sanitizeHtml = (value: string): string => {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
};

/**
 * Escape special characters
 */
export const escapeSpecialChars = (value: string): string => {
    return value.replace(/[&<>"']/g, (char) => {
        const entities: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return entities[char];
    });
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export const useFormValidation = <T extends Record<string, any>>(
    initialData: T,
    rules: Partial<Record<keyof T, ValidatorFn[]>>
) => {
    const [data, setData] = useState<T>(initialData);
    const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
    const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

    const validateSingle = useCallback((field: keyof T, value: any) => {
        const validators = rules[field];
        if (validators) {
            const result = validateField(value, validators);
            setErrors(prev => ({
                ...prev,
                [field]: result.valid ? undefined : result.message
            }));
            return result.valid;
        }
        return true;
    }, [rules]);

    const setValue = useCallback((field: keyof T, value: any) => {
        setData(prev => ({ ...prev, [field]: value }));
        if (touched[field]) {
            validateSingle(field, value);
        }
    }, [touched, validateSingle]);

    const setFieldTouched = useCallback((field: keyof T) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        validateSingle(field, data[field]);
    }, [data, validateSingle]);

    const validate = useCallback(() => {
        const result = validateForm(data, rules);
        setErrors(result.errors);
        setTouched(
            Object.keys(rules).reduce((acc, key) => ({ ...acc, [key]: true }), {})
        );
        return result.valid;
    }, [data, rules]);

    const reset = useCallback(() => {
        setData(initialData);
        setErrors({});
        setTouched({});
    }, [initialData]);

    return {
        data,
        errors,
        touched,
        setValue,
        setFieldTouched,
        validate,
        reset,
        isValid: Object.keys(errors).length === 0
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Validators
    required,
    minLength,
    maxLength,
    email,
    phone,
    saudiPhone,
    saudiId,
    roomNumber,
    employeeCode,
    isNumber,
    positiveNumber,
    inRange,
    pattern,
    matches,
    arabicOnly,
    englishOnly,

    // Form validation
    validateField,
    validateForm,

    // Sanitization
    trim,
    normalizeSpaces,
    numbersOnly,
    formatSaudiPhone,
    formatSaudiId,
    sanitizeHtml,
    escapeSpecialChars,

    // Hook
    useFormValidation
};
