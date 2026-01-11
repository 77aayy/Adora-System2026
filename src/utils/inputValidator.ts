/**
 * Input Validator
 * Form validation utilities
 * Adora Hotel Management System V2
 */

// ============================================================
// TYPES
// ============================================================

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export interface ValidationRule {
    validate: (value: any) => boolean;
    message: string;
}

// ============================================================
// BUILT-IN RULES
// ============================================================

export const rules = {
    required: (message = 'هذا الحقل مطلوب'): ValidationRule => ({
        validate: (value) => value !== null && value !== undefined && value !== '',
        message,
    }),

    minLength: (min: number, message?: string): ValidationRule => ({
        validate: (value) => typeof value === 'string' && value.length >= min,
        message: message || `يجب أن يكون ${min} أحرف على الأقل`,
    }),

    maxLength: (max: number, message?: string): ValidationRule => ({
        validate: (value) => typeof value === 'string' && value.length <= max,
        message: message || `يجب ألا يتجاوز ${max} حرف`,
    }),

    email: (message = 'البريد الإلكتروني غير صحيح'): ValidationRule => ({
        validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message,
    }),

    phone: (message = 'رقم الهاتف غير صحيح'): ValidationRule => ({
        validate: (value) => /^[\d\s+()-]{8,}$/.test(value),
        message,
    }),

    numeric: (message = 'يجب أن يكون رقماً'): ValidationRule => ({
        validate: (value) => !isNaN(Number(value)),
        message,
    }),

    min: (minValue: number, message?: string): ValidationRule => ({
        validate: (value) => Number(value) >= minValue,
        message: message || `يجب أن يكون ${minValue} على الأقل`,
    }),

    max: (maxValue: number, message?: string): ValidationRule => ({
        validate: (value) => Number(value) <= maxValue,
        message: message || `يجب ألا يتجاوز ${maxValue}`,
    }),

    pin: (message = 'رمز PIN يجب أن يكون 4 أرقام'): ValidationRule => ({
        validate: (value) => /^\d{4}$/.test(value),
        message,
    }),

    roomNumber: (message = 'رقم الغرفة غير صحيح'): ValidationRule => ({
        validate: (value) => /^\d{3,4}$/.test(value),
        message,
    }),

    arabicText: (message = 'يجب أن يحتوي على نص عربي'): ValidationRule => ({
        validate: (value) => /[\u0600-\u06FF]/.test(value),
        message,
    }),

    noSpecialChars: (message = 'لا يسمح بالرموز الخاصة'): ValidationRule => ({
        validate: (value) => /^[\w\s\u0600-\u06FF]+$/.test(value),
        message,
    }),
};

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate a single value against multiple rules
 */
export const validate = (value: any, validationRules: ValidationRule[]): ValidationResult => {
    for (const rule of validationRules) {
        if (!rule.validate(value)) {
            return { isValid: false, error: rule.message };
        }
    }
    return { isValid: true };
};

/**
 * Validate an object against a schema
 */
export const validateObject = <T extends Record<string, any>>(
    obj: T,
    schema: Record<keyof T, ValidationRule[]>
): Record<keyof T, ValidationResult> => {
    const results = {} as Record<keyof T, ValidationResult>;

    for (const key in schema) {
        results[key] = validate(obj[key], schema[key]);
    }

    return results;
};

/**
 * Check if all validations passed
 */
export const isFormValid = (results: Record<string, ValidationResult>): boolean => {
    return Object.values(results).every(r => r.isValid);
};

/**
 * Get first error message
 */
export const getFirstError = (results: Record<string, ValidationResult>): string | null => {
    for (const key in results) {
        if (!results[key].isValid && results[key].error) {
            return results[key].error!;
        }
    }
    return null;
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

export const useValidation = <T extends Record<string, any>>(
    schema: Record<keyof T, ValidationRule[]>
) => {
    const [errors, setErrors] = useState<Record<string, string | undefined>>({});

    const validateField = useCallback((field: keyof T, value: any): boolean => {
        const rules = schema[field];
        if (!rules) return true;

        const result = validate(value, rules);
        setErrors(prev => ({ ...prev, [field]: result.error }));
        return result.isValid;
    }, [schema]);

    const validateAll = useCallback((data: T): boolean => {
        const results = validateObject(data, schema);
        const newErrors: Record<string, string | undefined> = {};

        for (const key in results) {
            newErrors[key] = results[key].error;
        }

        setErrors(newErrors);
        return isFormValid(results);
    }, [schema]);

    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    return { errors, validateField, validateAll, clearErrors };
};
