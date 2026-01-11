/**
 * Translation Audit Service
 * Identifies missing translations and hardcoded text
 * Adora Hotel Management System V3 - SaaS
 */

import ar from '../locales/ar.json';
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import bn from '../locales/bn.json';

// ============================================================
// TYPES
// ============================================================

export type Language = 'ar' | 'en' | 'hi' | 'bn';

export interface TranslationKey {
    path: string;
    ar: string;
    en: string | null;
    hi: string | null;
    bn: string | null;
}

export interface AuditResult {
    totalKeys: number;
    missingByLanguage: Record<Language, number>;
    missingKeys: {
        language: Language;
        keys: string[];
    }[];
    completionPercentage: Record<Language, number>;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Flatten nested object to dot-notation keys
 */
function flattenObject(obj: any, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const key of Object.keys(obj)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            Object.assign(result, flattenObject(obj[key], newKey));
        } else {
            result[newKey] = obj[key];
        }
    }
    
    return result;
}

/**
 * Get value from nested object using dot notation
 */
function getNestedValue(obj: any, path: string): string | undefined {
    return path.split('.').reduce((current, key) => {
        return current?.[key];
    }, obj);
}

// ============================================================
// AUDIT FUNCTIONS
// ============================================================

/**
 * Audit all translations for missing keys
 */
export function auditTranslations(): AuditResult {
    const translations = { ar, en, hi, bn };
    const arKeys = flattenObject(ar);
    const allKeys = Object.keys(arKeys);
    
    const result: AuditResult = {
        totalKeys: allKeys.length,
        missingByLanguage: { ar: 0, en: 0, hi: 0, bn: 0 },
        missingKeys: [],
        completionPercentage: { ar: 100, en: 0, hi: 0, bn: 0 },
    };
    
    const languages: Language[] = ['en', 'hi', 'bn'];
    
    for (const lang of languages) {
        const missing: string[] = [];
        
        for (const key of allKeys) {
            const value = getNestedValue(translations[lang], key);
            if (!value) {
                missing.push(key);
            }
        }
        
        result.missingByLanguage[lang] = missing.length;
        result.missingKeys.push({ language: lang, keys: missing });
        result.completionPercentage[lang] = Math.round(
            ((allKeys.length - missing.length) / allKeys.length) * 100
        );
    }
    
    return result;
}

/**
 * Get all translation keys with their values
 */
export function getAllTranslationKeys(): TranslationKey[] {
    const translations = { ar, en, hi, bn };
    const arKeys = flattenObject(ar);
    
    return Object.entries(arKeys).map(([path, arValue]) => ({
        path,
        ar: arValue,
        en: getNestedValue(en, path) || null,
        hi: getNestedValue(hi, path) || null,
        bn: getNestedValue(bn, path) || null,
    }));
}

/**
 * Check if a specific key exists in all languages
 */
export function isKeyTranslated(key: string): Record<Language, boolean> {
    return {
        ar: !!getNestedValue(ar, key),
        en: !!getNestedValue(en, key),
        hi: !!getNestedValue(hi, key),
        bn: !!getNestedValue(bn, key),
    };
}

// ============================================================
// COMMON HARDCODED STRINGS (to be translated)
// ============================================================

export const HARDCODED_STRINGS_MAP: Record<string, Record<Language, string>> = {
    // Common UI
    'نزيل': { ar: 'نزيل', en: 'Guest', hi: 'अतिथि', bn: 'অতিথি' },
    'غرفة': { ar: 'غرفة', en: 'Room', hi: 'कमरा', bn: 'রুম' },
    'طلب': { ar: 'طلب', en: 'Request', hi: 'अनुरोध', bn: 'অনুরোধ' },
    'جديد': { ar: 'جديد', en: 'New', hi: 'नया', bn: 'নতুন' },
    'قيد التنفيذ': { ar: 'قيد التنفيذ', en: 'In Progress', hi: 'प्रगति में', bn: 'চলমান' },
    'مكتمل': { ar: 'مكتمل', en: 'Completed', hi: 'पूर्ण', bn: 'সম্পন্ন' },
    'ملغي': { ar: 'ملغي', en: 'Cancelled', hi: 'रद्द', bn: 'বাতিল' },
    'عاجل': { ar: 'عاجل', en: 'Urgent', hi: 'तत्काल', bn: 'জরুরি' },
    'عادي': { ar: 'عادي', en: 'Normal', hi: 'सामान्य', bn: 'সাধারণ' },
    
    // Departments
    'الاستقبال': { ar: 'الاستقبال', en: 'Reception', hi: 'रिसेप्शन', bn: 'রিসেপশন' },
    'النظافة': { ar: 'النظافة', en: 'Housekeeping', hi: 'हाउसकीपिंग', bn: 'হাউসকিপিং' },
    'الصيانة': { ar: 'الصيانة', en: 'Maintenance', hi: 'रखरखाव', bn: 'রক্ষণাবেক্ষণ' },
    'البيلمان': { ar: 'البيلمان', en: 'Bellman', hi: 'बेलमैन', bn: 'বেলম্যান' },
    'المشتريات': { ar: 'المشتريات', en: 'Procurement', hi: 'खरीद', bn: 'সংগ্রহ' },
    'الكافي شوب': { ar: 'الكافي شوب', en: 'Coffee Shop', hi: 'कॉफी शॉप', bn: 'কফি শপ' },
    
    // Actions
    'تأكيد': { ar: 'تأكيد', en: 'Confirm', hi: 'पुष्टि करें', bn: 'নিশ্চিত করুন' },
    'إلغاء': { ar: 'إلغاء', en: 'Cancel', hi: 'रद्द करें', bn: 'বাতিল' },
    'حفظ': { ar: 'حفظ', en: 'Save', hi: 'सहेजें', bn: 'সংরক্ষণ' },
    'حذف': { ar: 'حذف', en: 'Delete', hi: 'हटाएं', bn: 'মুছুন' },
    'تعديل': { ar: 'تعديل', en: 'Edit', hi: 'संपादित करें', bn: 'সম্পাদনা' },
    'إضافة': { ar: 'إضافة', en: 'Add', hi: 'जोड़ें', bn: 'যোগ করুন' },
    'بحث': { ar: 'بحث', en: 'Search', hi: 'खोजें', bn: 'অনুসন্ধান' },
    'فلتر': { ar: 'فلتر', en: 'Filter', hi: 'फ़िल्टर', bn: 'ফিল্টার' },
    'طباعة': { ar: 'طباعة', en: 'Print', hi: 'प्रिंट', bn: 'প্রিন্ট' },
    'تصدير': { ar: 'تصدير', en: 'Export', hi: 'निर्यात', bn: 'রপ্তানি' },
    'رجوع': { ar: 'رجوع', en: 'Back', hi: 'वापस', bn: 'পিছনে' },
    'التالي': { ar: 'التالي', en: 'Next', hi: 'अगला', bn: 'পরবর্তী' },
    'إغلاق': { ar: 'إغلاق', en: 'Close', hi: 'बंद करें', bn: 'বন্ধ' },
    
    // Time
    'اليوم': { ar: 'اليوم', en: 'Today', hi: 'आज', bn: 'আজ' },
    'أمس': { ar: 'أمس', en: 'Yesterday', hi: 'कल', bn: 'গতকাল' },
    'هذا الأسبوع': { ar: 'هذا الأسبوع', en: 'This Week', hi: 'इस सप्ताह', bn: 'এই সপ্তাহ' },
    'هذا الشهر': { ar: 'هذا الشهر', en: 'This Month', hi: 'इस महीने', bn: 'এই মাস' },
    'دقيقة': { ar: 'دقيقة', en: 'minute', hi: 'मिनट', bn: 'মিনিট' },
    'دقائق': { ar: 'دقائق', en: 'minutes', hi: 'मिनट', bn: 'মিনিট' },
    'ساعة': { ar: 'ساعة', en: 'hour', hi: 'घंटा', bn: 'ঘন্টা' },
    'ساعات': { ar: 'ساعات', en: 'hours', hi: 'घंटे', bn: 'ঘন্টা' },
    
    // Status messages
    'تم بنجاح': { ar: 'تم بنجاح', en: 'Success', hi: 'सफल', bn: 'সফল' },
    'حدث خطأ': { ar: 'حدث خطأ', en: 'Error occurred', hi: 'त्रुटि हुई', bn: 'ত্রুটি ঘটেছে' },
    'جاري التحميل': { ar: 'جاري التحميل', en: 'Loading', hi: 'लोड हो रहा है', bn: 'লোড হচ্ছে' },
    'لا توجد بيانات': { ar: 'لا توجد بيانات', en: 'No data', hi: 'कोई डेटा नहीं', bn: 'কোন তথ্য নেই' },
    
    // Room status
    'متاحة': { ar: 'متاحة', en: 'Available', hi: 'उपलब्ध', bn: 'উপলব্ধ' },
    'مشغولة': { ar: 'مشغولة', en: 'Occupied', hi: 'व्यस्त', bn: 'দখল' },
    'قيد التنظيف': { ar: 'قيد التنظيف', en: 'Being Cleaned', hi: 'सफाई हो रही है', bn: 'পরিষ্কার হচ্ছে' },
    'جاهزة': { ar: 'جاهزة', en: 'Ready', hi: 'तैयार', bn: 'প্রস্তুত' },
    'صيانة': { ar: 'صيانة', en: 'Maintenance', hi: 'रखरखाव', bn: 'রক্ষণাবেক্ষণ' },
    
    // Employee
    'موظف': { ar: 'موظف', en: 'Employee', hi: 'कर्मचारी', bn: 'কর্মচারী' },
    'موظفين': { ar: 'موظفين', en: 'Employees', hi: 'कर्मचारी', bn: 'কর্মচারীরা' },
    'المدير': { ar: 'المدير', en: 'Manager', hi: 'प्रबंधक', bn: 'ম্যানেজার' },
    'نشط': { ar: 'نشط', en: 'Active', hi: 'सक्रिय', bn: 'সক্রিয়' },
    'غير نشط': { ar: 'غير نشط', en: 'Inactive', hi: 'निष्क्रिय', bn: 'নিষ্ক্রিয়' },
    
    // Points
    'نقطة': { ar: 'نقطة', en: 'point', hi: 'अंक', bn: 'পয়েন্ট' },
    'نقاط': { ar: 'نقاط', en: 'points', hi: 'अंक', bn: 'পয়েন্ট' },
    'مكافأة': { ar: 'مكافأة', en: 'Reward', hi: 'इनाम', bn: 'পুরস্কার' },
    'خصم': { ar: 'خصم', en: 'Penalty', hi: 'जुर्माना', bn: 'জরিমানা' },
    
    // Forms
    'الاسم': { ar: 'الاسم', en: 'Name', hi: 'नाम', bn: 'নাম' },
    'رقم الجوال': { ar: 'رقم الجوال', en: 'Phone Number', hi: 'फोन नंबर', bn: 'ফোন নম্বর' },
    'البريد الإلكتروني': { ar: 'البريد الإلكتروني', en: 'Email', hi: 'ईमेल', bn: 'ইমেইল' },
    'كلمة المرور': { ar: 'كلمة المرور', en: 'Password', hi: 'पासवर्ड', bn: 'পাসওয়ার্ড' },
    'ملاحظات': { ar: 'ملاحظات', en: 'Notes', hi: 'टिप्पणियाँ', bn: 'মন্তব্য' },
    'الوصف': { ar: 'الوصف', en: 'Description', hi: 'विवरण', bn: 'বিবরণ' },
    
    // Housekeeping specific
    'تنظيف': { ar: 'تنظيف', en: 'Cleaning', hi: 'सफाई', bn: 'পরিষ্কার' },
    'فحص': { ar: 'فحص', en: 'Inspection', hi: 'निरीक्षण', bn: 'পরিদর্শন' },
    'ميني بار': { ar: 'ميني بار', en: 'Minibar', hi: 'मिनीबार', bn: 'মিনিবার' },
    'غرفة مشغولة': { ar: 'غرفة مشغولة', en: 'Occupied Room', hi: 'व्यस्त कमरा', bn: 'দখলকৃত রুম' },
    'غرفة مغادرة': { ar: 'غرفة مغادرة', en: 'Checkout Room', hi: 'चेकआउट कमरा', bn: 'চেকআউট রুম' },
    
    // Bellman specific
    'تسجيل دخول': { ar: 'تسجيل دخول', en: 'Check In', hi: 'चेक इन', bn: 'চেক ইন' },
    'تسجيل خروج': { ar: 'تسجيل خروج', en: 'Check Out', hi: 'चेक आउट', bn: 'চেক আউট' },
    'أمتعة': { ar: 'أمتعة', en: 'Luggage', hi: 'सामान', bn: 'লাগেজ' },
    'عربة': { ar: 'عربة', en: 'Cart', hi: 'गाड़ी', bn: 'কার্ট' },
    
    // Maintenance specific
    'كهرباء': { ar: 'كهرباء', en: 'Electrical', hi: 'बिजली', bn: 'বৈদ্যুতিক' },
    'سباكة': { ar: 'سباكة', en: 'Plumbing', hi: 'प्लंबिंग', bn: 'প্লাম্বিং' },
    'تكييف': { ar: 'تكييف', en: 'AC', hi: 'एसी', bn: 'এসি' },
    'أثاث': { ar: 'أثاث', en: 'Furniture', hi: 'फर्नीचर', bn: 'আসবাবপত্র' },
    
    // Procurement specific
    'طلب شراء': { ar: 'طلب شراء', en: 'Purchase Request', hi: 'खरीद अनुरोध', bn: 'ক্রয় অনুরোধ' },
    'بانتظار الموافقة': { ar: 'بانتظار الموافقة', en: 'Pending Approval', hi: 'अनुमोदन लंबित', bn: 'অনুমোদনের অপেক্ষায়' },
    'تمت الموافقة': { ar: 'تمت الموافقة', en: 'Approved', hi: 'स्वीकृत', bn: 'অনুমোদিত' },
    'مرفوض': { ar: 'مرفوض', en: 'Rejected', hi: 'अस्वीकृत', bn: 'প্রত্যাখ্যাত' },
    'استلام': { ar: 'استلام', en: 'Receive', hi: 'प्राप्त करें', bn: 'গ্রহণ করুন' },
    
    // Reports
    'تقرير': { ar: 'تقرير', en: 'Report', hi: 'रिपोर्ट', bn: 'রিপোর্ট' },
    'إحصائيات': { ar: 'إحصائيات', en: 'Statistics', hi: 'आँकड़े', bn: 'পরিসংখ্যান' },
    'أداء': { ar: 'أداء', en: 'Performance', hi: 'प्रदर्शन', bn: 'কর্মক্ষমতা' },
    
    // Currency
    'ر.س': { ar: 'ر.س', en: 'SAR', hi: 'SAR', bn: 'SAR' },
    'ريال': { ar: 'ريال', en: 'Riyal', hi: 'रियाल', bn: 'রিয়াল' },
};

/**
 * Get translated string (helper function)
 */
export function getHardcodedTranslation(text: string, lang: Language): string {
    return HARDCODED_STRINGS_MAP[text]?.[lang] || text;
}

export default {
    auditTranslations,
    getAllTranslationKeys,
    isKeyTranslated,
    getHardcodedTranslation,
    HARDCODED_STRINGS_MAP,
};
