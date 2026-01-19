/**
 * Developer Signature Component
 * EXACT COPY of LoginScreen.tsx signature
 * Adora Hotel Management System V3 - SaaS
 */

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// SIGNATURE CONFIG FROM LOCALSTORAGE + FIREBASE
// ============================================================

const getConfig = () => {
    try {
        return {
            devName: localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda',
            phoneSA: localStorage.getItem('adora_dev_phone_sa') || '966570707121',
            phoneEG: localStorage.getItem('adora_dev_phone_eg') || '201500000162',
            email: localStorage.getItem('adora_dev_email') || '77aayy@gmail.com',
        };
    } catch {
        return {
            devName: 'Ayman Abo Warda',
            phoneSA: '966570707121',
            phoneEG: '201500000162',
            email: '77aayy@gmail.com',
        };
    }
};

const getWhatsAppGreeting = () => {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 12 
        ? 'صباح الخير، أنا مهتم بمشروعك' 
        : 'مساء الخير، أنا مهتم بمشروعك';
};

// ============================================================
// DEVELOPER SIGNATURE COMPONENT
// EXACT MATCH TO LoginScreen.tsx
// ============================================================

interface DeveloperSignatureProps {
    className?: string;
}

export const DeveloperSignature: React.FC<DeveloperSignatureProps> = ({
    className = ''
}) => {
    const { isDark } = useTheme();
    // ✅ FIX: State to force re-render when settings update
    const [config, setConfig] = React.useState(getConfig());
    const greeting = encodeURIComponent(getWhatsAppGreeting());
    
    // ✅ FIX: Load from Firebase on mount (with localStorage as fallback)
    React.useEffect(() => {
        const loadDeveloperSettings = async () => {
            try {
                const { getSystemSettings } = await import('../../services/systemSettingsService');
                const settings = await getSystemSettings();
                if (settings?.developerBranding) {
                    const branding = settings.developerBranding;
                    const newConfig = {
                        devName: branding.devName || config.devName,
                        phoneSA: branding.devPhoneSA || config.phoneSA,
                        phoneEG: branding.devPhoneEG || config.phoneEG,
                        email: branding.devEmail || config.email,
                    };
                    
                    // Update state
                    setConfig(newConfig);
                    
                    // Sync to localStorage for backward compatibility
                    if (branding.devName) localStorage.setItem('adora_dev_name', branding.devName);
                    if (branding.devPhoneSA) localStorage.setItem('adora_dev_phone_sa', branding.devPhoneSA);
                    if (branding.devPhoneEG) localStorage.setItem('adora_dev_phone_eg', branding.devPhoneEG);
                    if (branding.devEmail) localStorage.setItem('adora_dev_email', branding.devEmail);
                    if (branding.devSignature) localStorage.setItem('adora_dev_signature', branding.devSignature);
                }
            } catch (err) {
                console.warn('Failed to load developer settings from Firebase, using localStorage:', err);
            }
        };
        
        loadDeveloperSettings();
    }, []);
    
    // ✅ FIX: Listen for settings updates from owner dashboard
    React.useEffect(() => {
        const handleSettingsUpdate = (event: CustomEvent) => {
            const newConfig = event.detail;
            // Update state
            setConfig(newConfig);
            // Also update localStorage to ensure persistence
            if (newConfig.devName) localStorage.setItem('adora_dev_name', newConfig.devName);
            if (newConfig.phoneSA) localStorage.setItem('adora_dev_phone_sa', newConfig.phoneSA);
            if (newConfig.phoneEG) localStorage.setItem('adora_dev_phone_eg', newConfig.phoneEG);
            if (newConfig.email) localStorage.setItem('adora_dev_email', newConfig.email);
            if (newConfig.signature) localStorage.setItem('adora_dev_signature', newConfig.signature);
        };
        
        window.addEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
        
        return () => {
            window.removeEventListener('adora_dev_settings_updated', handleSettingsUpdate as EventListener);
        };
    }, []);

    return (
        <footer 
            className={`w-full py-2 text-center pointer-events-auto relative z-20 ${className}`}
            dir="ltr"
        >
            <p 
                className="text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap"
                style={{ fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif" }}
            >
                {/* Copyright */}
                <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
                    © {new Date().getFullYear()}
                </span>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Developer Name */}
                <span className={`font-semibold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
                    {config.devName}
                </span>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Saudi Phone */}
                <a 
                    href={`https://wa.me/${config.phoneSA}?text=${greeting}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    +{config.phoneSA}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Egypt Phone */}
                <a 
                    href={`https://wa.me/${config.phoneEG}?text=${greeting}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    +{config.phoneEG}
                </a>
                <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                
                {/* Developer Email */}
                <a 
                    href={`mailto:${config.email}`}
                    className={`hover:underline transition-colors ${
                        isDark 
                            ? 'text-slate-300 hover:text-teal-400' 
                            : 'text-slate-600 hover:text-teal-600'
                    }`}
                >
                    {config.email}
                </a>
            </p>
        </footer>
    );
};

export default DeveloperSignature;
