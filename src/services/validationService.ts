/**
 * Input Validator Service
 * Migrated from input-validator.js
 * Adora Hotel Management System V2
 * 
 * Validation utilities for:
 * - Room numbers
 * - Descriptions
 * - Names
 * - Phone numbers
 * - Scheduled times
 * - XSS prevention
 */

// ============================================================
// TYPES
// ============================================================

export interface ValidationResult {
    valid: boolean;
    error: string | null;
}

// ============================================================
// VALIDATORS
// ============================================================

/**
 * Validate room number
 */
export const validateRoomNumber = (room: string | number | null | undefined): ValidationResult => {
    if (!room) {
        return { valid: false, error: 'رقم الغرفة مطلوب' };
    }

    const roomNum = typeof room === 'string' ? parseInt(room.trim()) : room;

    if (isNaN(roomNum) || roomNum <= 0) {
        return { valid: false, error: 'رقم الغرفة يجب أن يكون رقماً صحيحاً' };
    }

    if (roomNum < 100 || roomNum > 9999) {
        return { valid: false, error: 'رقم الغرفة يجب أن يكون بين 100 و 9999' };
    }

    return { valid: true, error: null };
};

/**
 * Validate description
 */
export const validateDescription = (
    desc: string | null | undefined,
    minLength: number = 3,
    maxLength: number = 1000
): ValidationResult => {
    if (!desc || typeof desc !== 'string') {
        return { valid: false, error: 'الوصف مطلوب' };
    }

    const trimmed = desc.trim();

    if (trimmed.length < minLength) {
        return { valid: false, error: `الوصف يجب أن يكون ${minLength} أحرف على الأقل` };
    }

    if (trimmed.length > maxLength) {
        return { valid: false, error: `الوصف يجب أن يكون أقل من ${maxLength} حرف` };
    }

    return { valid: true, error: null };
};

/**
 * Validate name
 */
export const validateName = (
    name: string | null | undefined,
    minLength: number = 2
): ValidationResult => {
    if (!name || typeof name !== 'string') {
        return { valid: false, error: 'الاسم مطلوب' };
    }

    const trimmed = name.trim();

    if (trimmed.length < minLength) {
        return { valid: false, error: `الاسم يجب أن يكون ${minLength} أحرف على الأقل` };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'الاسم طويل جداً' };
    }

    // Allow Arabic, English, and common characters
    const namePattern = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\s\-\.]+$/;
    if (!namePattern.test(trimmed)) {
        return { valid: false, error: 'الاسم يحتوي على أحرف غير مسموحة' };
    }

    return { valid: true, error: null };
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string | null | undefined): ValidationResult => {
    if (!phone || typeof phone !== 'string') {
        return { valid: false, error: 'رقم الجوال مطلوب' };
    }

    const cleaned = phone.replace(/\s+/g, '').replace(/[-\+\(\)]/g, '');

    // Allow digits only, 8-15 digits
    if (!/^\d{8,15}$/.test(cleaned)) {
        return { valid: false, error: 'رقم الجوال يجب أن يكون بين 8 و 15 رقماً' };
    }

    return { valid: true, error: null };
};

/**
 * Validate scheduled time
 */
export const validateScheduledTime = (
    scheduledTime: string | null | undefined,
    minMinutesFromNow: number = 30
): ValidationResult => {
    if (!scheduledTime) {
        return { valid: false, error: 'وقت الجدولة مطلوب' };
    }

    const scheduledDate = new Date(scheduledTime);
    const now = new Date();

    if (isNaN(scheduledDate.getTime())) {
        return { valid: false, error: 'وقت الجدولة غير صحيح' };
    }

    if (scheduledDate <= now) {
        return { valid: false, error: 'لا يمكن جدولة طلب بوقت في الماضي' };
    }

    const minTime = new Date(now.getTime() + minMinutesFromNow * 60 * 1000);
    if (scheduledDate < minTime) {
        return { valid: false, error: `يجب أن يكون وقت الجدولة بعد ${minMinutesFromNow} دقيقة على الأقل من الآن` };
    }

    return { valid: true, error: null };
};

/**
 * Validate floor number
 */
export const validateFloor = (
    floor: string | number | null | undefined,
    maxFloor: number = 20
): ValidationResult => {
    if (floor === null || floor === undefined || floor === '') {
        return { valid: false, error: 'رقم الدور مطلوب' };
    }

    const floorNum = typeof floor === 'string' ? parseInt(floor.trim()) : floor;

    if (isNaN(floorNum) || floorNum <= 0) {
        return { valid: false, error: 'رقم الدور يجب أن يكون رقماً صحيحاً' };
    }

    if (floorNum > maxFloor) {
        return { valid: false, error: `رقم الدور يجب أن يكون أقل من ${maxFloor}` };
    }

    return { valid: true, error: null };
};

/**
 * Validate quantity
 */
export const validateQuantity = (
    quantity: string | number | null | undefined,
    min: number = 1,
    max: number = 1000
): ValidationResult => {
    if (quantity === null || quantity === undefined || quantity === '') {
        return { valid: false, error: 'الكمية مطلوبة' };
    }

    const qty = typeof quantity === 'string' ? parseInt(quantity.trim()) : quantity;

    if (isNaN(qty) || qty < min) {
        return { valid: false, error: `الكمية يجب أن تكون ${min} على الأقل` };
    }

    if (qty > max) {
        return { valid: false, error: `الكمية يجب أن تكون أقل من ${max}` };
    }

    return { valid: true, error: null };
};

/**
 * Validate email
 */
export const validateEmail = (email: string | null | undefined): ValidationResult => {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'البريد الإلكتروني مطلوب' };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email.trim())) {
        return { valid: false, error: 'البريد الإلكتروني غير صحيح' };
    }

    return { valid: true, error: null };
};

/**
 * Validate price/amount
 */
export const validatePrice = (
    price: string | number | null | undefined,
    min: number = 0,
    max: number = 1000000
): ValidationResult => {
    if (price === null || price === undefined || price === '') {
        return { valid: false, error: 'المبلغ مطلوب' };
    }

    const amount = typeof price === 'string' ? parseFloat(price.trim()) : price;

    if (isNaN(amount) || amount < min) {
        return { valid: false, error: `المبلغ يجب أن يكون ${min} على الأقل` };
    }

    if (amount > max) {
        return { valid: false, error: `المبلغ يجب أن يكون أقل من ${max}` };
    }

    return { valid: true, error: null };
};

// ============================================================
// SANITIZERS
// ============================================================

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input: any): string => {
    if (typeof input !== 'string') {
        return String(input || '');
    }

    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, '');

    // Escape special characters
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');

    return sanitized.trim();
};

/**
 * Sanitize HTML (allows basic formatting)
 */
export const sanitizeHtml = (html: string): string => {
    if (typeof html !== 'string') return '';

    // Allow only basic tags
    const allowedTags = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'span'];
    const tagPattern = /<\/?([a-zA-Z]+)[^>]*>/g;

    return html.replace(tagPattern, (match, tag) => {
        if (allowedTags.includes(tag.toLowerCase())) {
            return match;
        }
        return '';
    });
};

/**
 * Clean phone number (remove non-digits except +)
 */
export const cleanPhoneNumber = (phone: string): string => {
    return phone.replace(/[^\d+]/g, '');
};

/**
 * Clean room number (extract digits)
 */
export const cleanRoomNumber = (room: string | number): string => {
    if (typeof room === 'number') return String(room);
    return room.replace(/\D/g, '');
};

// ============================================================
// FORM VALIDATION HELPER
// ============================================================

export interface FormField {
    name: string;
    value: any;
    validator: (value: any) => ValidationResult;
}

/**
 * Validate multiple form fields
 */
export const validateForm = (fields: FormField[]): {
    valid: boolean;
    errors: Record<string, string>;
} => {
    const errors: Record<string, string> = {};
    let valid = true;

    for (const field of fields) {
        const result = field.validator(field.value);
        if (!result.valid) {
            valid = false;
            if (result.error) {
                errors[field.name] = result.error;
            }
        }
    }

    return { valid, errors };
};

// ============================================================
// REACT HOOK
// ============================================================

import { useState, useCallback } from 'react';

interface UseValidationReturn {
    errors: Record<string, string>;
    validate: (fields: FormField[]) => boolean;
    validateField: (name: string, value: any, validator: (v: any) => ValidationResult) => boolean;
    clearErrors: () => void;
    getError: (name: string) => string | undefined;
}

export const useValidation = (): UseValidationReturn => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = useCallback((fields: FormField[]): boolean => {
        const result = validateForm(fields);
        setErrors(result.errors);
        return result.valid;
    }, []);

    const validateField = useCallback((
        name: string,
        value: any,
        validator: (v: any) => ValidationResult
    ): boolean => {
        const result = validator(value);

        setErrors(prev => {
            if (result.valid) {
                const { [name]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [name]: result.error || '' };
        });

        return result.valid;
    }, []);

    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    const getError = useCallback((name: string): string | undefined => {
        return errors[name];
    }, [errors]);

    return {
        errors,
        validate,
        validateField,
        clearErrors,
        getError
    };
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Validators
    validateRoomNumber,
    validateDescription,
    validateName,
    validatePhone,
    validateScheduledTime,
    validateFloor,
    validateQuantity,
    validateEmail,
    validatePrice,

    // Sanitizers
    sanitizeInput,
    sanitizeHtml,
    cleanPhoneNumber,
    cleanRoomNumber,

    // Form helper
    validateForm,

    // Hook
    useValidation
};
