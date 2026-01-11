/**
 * Multi-Language Service
 * نظام الترجمة للمنيو والخدمات
 * 
 * ✅ Features:
 * - Dynamic language detection
 * - Manager can add translations
 * - Fallback to Arabic
 * - RTL/LTR support
 * 
 * Adora Hotel Management System V3
 */

import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';

// ============================================================
// TYPES
// ============================================================

export type SupportedLanguage = 'ar' | 'en' | 'fr' | 'de' | 'es' | 'ru' | 'zh' | 'tr';

export interface TranslationEntry {
    ar: string; // Arabic (default/required)
    en?: string;
    fr?: string;
    de?: string;
    es?: string;
    ru?: string;
    zh?: string;
    tr?: string;
}

export interface TranslatableItem {
    id: string;
    type: 'service' | 'menu_item' | 'category' | 'quick_option' | 'status' | 'general';
    key: string;
    translations: TranslationEntry;
    updatedAt?: any;
}

export interface MenuItemTranslation {
    id: string;
    name: TranslationEntry;
    description?: TranslationEntry;
    category?: string;
    price: number;
    isActive: boolean;
}

export interface LanguageConfig {
    code: SupportedLanguage;
    name: string;
    nativeName: string;
    direction: 'rtl' | 'ltr';
    flag: string;
}

// ============================================================
// CONSTANTS
// ============================================================

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇬🇧' },
    { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flag: '🇷🇺' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', direction: 'ltr', flag: '🇹🇷' }
];

// Default translations for common items
export const DEFAULT_TRANSLATIONS: Record<string, TranslationEntry> = {
    // Services
    'service_cleaning': {
        ar: 'تنظيف الغرفة',
        en: 'Room Cleaning',
        fr: 'Nettoyage de chambre',
        de: 'Zimmerreinigung',
        es: 'Limpieza de habitación',
        ru: 'Уборка номера',
        zh: '房间清洁',
        tr: 'Oda temizliği'
    },
    'service_maintenance': {
        ar: 'صيانة',
        en: 'Maintenance',
        fr: 'Maintenance',
        de: 'Wartung',
        es: 'Mantenimiento',
        ru: 'Техническое обслуживание',
        zh: '维护',
        tr: 'Bakım'
    },
    'service_bellman': {
        ar: 'بيلمان',
        en: 'Bellman',
        fr: 'Bagagiste',
        de: 'Gepäckträger',
        es: 'Botones',
        ru: 'Портье',
        zh: '行李员',
        tr: 'Bellboy'
    },
    'service_room_service': {
        ar: 'خدمة الغرف',
        en: 'Room Service',
        fr: 'Service en chambre',
        de: 'Zimmerservice',
        es: 'Servicio de habitaciones',
        ru: 'Обслуживание номеров',
        zh: '客房服务',
        tr: 'Oda servisi'
    },
    'service_laundry': {
        ar: 'غسيل الملابس',
        en: 'Laundry',
        fr: 'Blanchisserie',
        de: 'Wäscherei',
        es: 'Lavandería',
        ru: 'Прачечная',
        zh: '洗衣服务',
        tr: 'Çamaşırhane'
    },

    // Statuses
    'status_pending': {
        ar: 'قيد الانتظار',
        en: 'Pending',
        fr: 'En attente',
        de: 'Ausstehend',
        es: 'Pendiente',
        ru: 'Ожидание',
        zh: '待处理',
        tr: 'Beklemede'
    },
    'status_in_progress': {
        ar: 'جاري التنفيذ',
        en: 'In Progress',
        fr: 'En cours',
        de: 'In Bearbeitung',
        es: 'En progreso',
        ru: 'В процессе',
        zh: '进行中',
        tr: 'Devam ediyor'
    },
    'status_completed': {
        ar: 'مكتمل',
        en: 'Completed',
        fr: 'Terminé',
        de: 'Abgeschlossen',
        es: 'Completado',
        ru: 'Завершено',
        zh: '已完成',
        tr: 'Tamamlandı'
    },

    // Common UI
    'btn_submit': {
        ar: 'إرسال',
        en: 'Submit',
        fr: 'Soumettre',
        de: 'Absenden',
        es: 'Enviar',
        ru: 'Отправить',
        zh: '提交',
        tr: 'Gönder'
    },
    'btn_cancel': {
        ar: 'إلغاء',
        en: 'Cancel',
        fr: 'Annuler',
        de: 'Abbrechen',
        es: 'Cancelar',
        ru: 'Отмена',
        zh: '取消',
        tr: 'İptal'
    },
    'welcome_message': {
        ar: 'مرحباً بك في الفندق',
        en: 'Welcome to our hotel',
        fr: 'Bienvenue à notre hôtel',
        de: 'Willkommen in unserem Hotel',
        es: 'Bienvenido a nuestro hotel',
        ru: 'Добро пожаловать в наш отель',
        zh: '欢迎来到我们的酒店',
        tr: 'Otelimize hoş geldiniz'
    }
};

// ============================================================
// LANGUAGE DETECTION
// ============================================================

/**
 * Detect user's preferred language from browser
 */
export function detectUserLanguage(): SupportedLanguage {
    const browserLang = navigator.language.split('-')[0].toLowerCase();
    const supported = SUPPORTED_LANGUAGES.find(l => l.code === browserLang);
    return supported?.code || 'en';
}

/**
 * Get language config
 */
export function getLanguageConfig(code: SupportedLanguage): LanguageConfig {
    return SUPPORTED_LANGUAGES.find(l => l.code === code) || SUPPORTED_LANGUAGES[0];
}

/**
 * Check if language is RTL
 */
export function isRTL(code: SupportedLanguage): boolean {
    return getLanguageConfig(code).direction === 'rtl';
}

// ============================================================
// TRANSLATION FUNCTIONS
// ============================================================

/**
 * Get translation for a key
 */
export function translate(
    key: string,
    language: SupportedLanguage,
    customTranslations?: Record<string, TranslationEntry>
): string {
    // Check custom translations first
    if (customTranslations?.[key]) {
        return customTranslations[key][language] || customTranslations[key].ar || key;
    }

    // Check default translations
    if (DEFAULT_TRANSLATIONS[key]) {
        return DEFAULT_TRANSLATIONS[key][language] || DEFAULT_TRANSLATIONS[key].ar || key;
    }

    // Return key if no translation found
    return key;
}

/**
 * Get translation entry (all languages)
 */
export function getTranslationEntry(key: string): TranslationEntry | null {
    return DEFAULT_TRANSLATIONS[key] || null;
}

// ============================================================
// FIRESTORE OPERATIONS
// ============================================================

/**
 * Get tenant's custom translations
 */
export async function getTenantTranslations(
    tenantId: string
): Promise<Record<string, TranslationEntry>> {
    const translationsRef = collection(db, `tenants/${tenantId}/translations`);
    const snapshot = await getDocs(translationsRef);
    
    const translations: Record<string, TranslationEntry> = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        translations[doc.id] = data.translations || data;
    });
    
    return translations;
}

/**
 * Save/Update translation
 */
export async function saveTranslation(
    tenantId: string,
    key: string,
    translations: TranslationEntry,
    type: TranslatableItem['type'] = 'general'
): Promise<void> {
    const translationRef = doc(db, `tenants/${tenantId}/translations/${key}`);
    await setDoc(translationRef, {
        key,
        type,
        translations,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

/**
 * Get menu items with translations
 */
export async function getTranslatedMenuItems(
    tenantId: string,
    branchId: string,
    language: SupportedLanguage
): Promise<MenuItemTranslation[]> {
    const menuRef = collection(db, `tenants/${tenantId}/branches/${branchId}/menu_items`);
    const snapshot = await getDocs(menuRef);
    
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || { ar: data.nameAr || 'Unknown' },
            description: data.description,
            category: data.category,
            price: data.price || 0,
            isActive: data.isActive !== false
        };
    });
}

/**
 * Save menu item with translations
 */
export async function saveMenuItemTranslation(
    tenantId: string,
    branchId: string,
    itemId: string,
    data: Partial<MenuItemTranslation>
): Promise<void> {
    const itemRef = doc(db, `tenants/${tenantId}/branches/${branchId}/menu_items/${itemId}`);
    await updateDoc(itemRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

// ============================================================
// HELPER HOOK DATA
// ============================================================

/**
 * Create translation context value
 */
export function createTranslationContext(
    language: SupportedLanguage,
    customTranslations: Record<string, TranslationEntry> = {}
) {
    return {
        language,
        config: getLanguageConfig(language),
        isRTL: isRTL(language),
        t: (key: string) => translate(key, language, customTranslations),
        setLanguage: (_lang: SupportedLanguage) => {
            // This would be handled by the context provider
        }
    };
}

// ============================================================
// GUEST LANGUAGE PREFERENCE
// ============================================================

const GUEST_LANG_KEY = 'adora_guest_language';

/**
 * Save guest language preference
 */
export function saveGuestLanguage(language: SupportedLanguage): void {
    localStorage.setItem(GUEST_LANG_KEY, language);
}

/**
 * Get guest language preference
 */
export function getGuestLanguage(): SupportedLanguage {
    const saved = localStorage.getItem(GUEST_LANG_KEY);
    if (saved && SUPPORTED_LANGUAGES.find(l => l.code === saved)) {
        return saved as SupportedLanguage;
    }
    return detectUserLanguage();
}

// ============================================================
// EXPORTS
// ============================================================

export default {
    // Constants
    SUPPORTED_LANGUAGES,
    DEFAULT_TRANSLATIONS,
    // Detection
    detectUserLanguage,
    getLanguageConfig,
    isRTL,
    // Translation
    translate,
    getTranslationEntry,
    // Firestore
    getTenantTranslations,
    saveTranslation,
    getTranslatedMenuItems,
    saveMenuItemTranslation,
    // Context
    createTranslationContext,
    // Guest
    saveGuestLanguage,
    getGuestLanguage
};
