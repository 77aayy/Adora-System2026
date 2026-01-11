/**
 * Language Switcher Component
 * Adora Hotel Management System V2
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { LANGUAGES, changeLanguage, getCurrentLanguage } from '../../i18n/index';

// Language type
interface Language {
    code: string;
    name: string;
    nativeName: string;
    dir: string;
}

// ============================================================
// STYLES
// ============================================================

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        position: 'relative',
        display: 'inline-block',
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s ease',
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '4px',
        background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        zIndex: 1000,
        minWidth: '150px',
    },
    option: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        color: 'var(--text-primary, #f8fafc)',
    },
    optionActive: {
        background: 'rgba(13, 148, 136, 0.2)',
    },
    nativeName: {
        fontWeight: 500,
    },
    checkmark: {
        color: '#0D9488',
    },
};

// ============================================================
// COMPONENT
// ============================================================

export const LanguageSwitcher: React.FC = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);
    const currentLang = getCurrentLanguage();

    const handleChange = async (langCode: string) => {
        await changeLanguage(langCode);
        setIsOpen(false);
    };

    const currentLanguage = LANGUAGES.find((l: Language) => l.code === currentLang);

    return (
        <div style={styles.container}>
            <button
                style={styles.button}
                onClick={() => setIsOpen(!isOpen)}
                title={t('settings.language')}
            >
                <Globe size={18} />
                <span>{currentLanguage?.nativeName || 'العربية'}</span>
            </button>

            {isOpen && (
                <div style={styles.dropdown}>
                    {LANGUAGES.map((lang: Language) => (
                        <div
                            key={lang.code}
                            style={{
                                ...styles.option,
                                ...(lang.code === currentLang ? styles.optionActive : {}),
                            }}
                            onClick={() => handleChange(lang.code)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = lang.code === currentLang
                                    ? 'rgba(13, 148, 136, 0.2)'
                                    : 'transparent';
                            }}
                        >
                            <span style={styles.nativeName}>{lang.nativeName}</span>
                            {lang.code === currentLang && (
                                <span style={styles.checkmark}>✓</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
