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

    useEffect(() => {
        // Reset animation on route change
        setIsEntering(false);
        const timer = setTimeout(() => {
            setIsEntering(true);
        }, 10);

        // Scroll to top on route change
        window.scrollTo({ top: 0, behavior: 'smooth' });

        return () => clearTimeout(timer);
    }, [location.pathname]);

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
