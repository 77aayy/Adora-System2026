/**
 * i18n Context
 * Lightweight language management (no heavy dependencies)
 * Translations handled by react-i18next, this is just for locale state
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface I18nContextType {
    locale: string;
    setLocale: (lang: string) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [locale, setLocale] = useState('ar');
    return (
        <I18nContext.Provider value={{ locale, setLocale }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) throw new Error('useI18n must be used within I18nProvider');
    return context;
};

// ✅ Backward compatibility
export const usei18n = useI18n;

export default I18nProvider;