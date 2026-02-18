/**
 * Language list for UI (login, settings, etc.)
 * Does NOT import i18n to avoid re-initializing or loading wrong locale files.
 */

export const LANGUAGES = [
  { code: 'ar', name: 'العربية', nativeName: 'العربية', dir: 'rtl' as const },
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
  { code: 'hi', name: 'हिंदी', nativeName: 'हिंदी', dir: 'ltr' as const },
  { code: 'bn', name: 'বাংলা', nativeName: 'বাংলা', dir: 'ltr' as const },
] as const;
