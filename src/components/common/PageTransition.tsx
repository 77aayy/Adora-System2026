/**
 * Page Transition Component
 * Smooth animations when navigating between routes
 * Adora Hotel Management System V2
 */

import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
    const location = useLocation();
    const [isEntering, setIsEntering] = useState(true);

    // ✅ صفحات الشاشة الكاملة (دخول، ضيف، معالج Firebase، إعداد): بدون أنيميشن + خلفية صلبة حتى لا تظهر "صفحة شبح" (مثل معالج إعداد Firebase) خلف صفحة الدخول
    const isFullScreenRoute = location.pathname === '/login' || location.pathname.startsWith('/guest') || location.pathname === '/firebase-setup' || location.pathname === '/setup';

    useEffect(() => {
        if (isFullScreenRoute) return;
        setIsEntering(false);
        const timer = setTimeout(() => setIsEntering(true), 10);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return () => clearTimeout(timer);
    }, [location.pathname, isFullScreenRoute]);

    // صفحات الشاشة الكاملة: طبقة معزولة ومن فوق أي محتوى سابق (لا صفحة شبح خلفها)
    if (isFullScreenRoute) {
        return (
            <div
                key={location.pathname}
                className="min-h-screen w-full opacity-100 bg-slate-950 relative z-[100] isolate"
                style={{ contain: 'layout paint' }}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            key={location.pathname}
            className={`
                min-h-screen
                transition-all duration-800 ease-out
                ${isEntering ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                page-enter
                animate-fadeInSlow
            `}
            style={{
                animation: isEntering ? 'fadeInSlow 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
        >
            {children}
        </div>
    );
};

// Add custom animation to global CSS if not already present
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        @keyframes fadeInSlow {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .animate-fadeInSlow {
            animation: fadeInSlow 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
    `;
    if (!document.head.querySelector('style[data-page-transition]')) {
        style.setAttribute('data-page-transition', 'true');
        document.head.appendChild(style);
    }
}
