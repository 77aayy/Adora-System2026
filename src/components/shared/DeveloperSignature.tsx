/**
 * Developer Signature Component
 * EXACT COPY of LoginScreen.tsx signature
 * Adora Hotel Management System V3 - SaaS
 */

import React from 'react';
import { useTheme } from '../../context/ThemeContext';

// ============================================================
// SIGNATURE CONFIG FROM LOCALSTORAGE
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
    const config = getConfig();
    const greeting = encodeURIComponent(getWhatsAppGreeting());

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
