/**
 * Splash Screen Component
 * Beautiful animated loading screen with Adora branding
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
    onComplete: () => void;
    minDuration?: number; // Minimum time to show splash in ms
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
    onComplete, 
    minDuration = 2500 
}) => {
    const [progress, setProgress] = useState(0);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Animate progress bar
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressInterval);
                    return 100;
                }
                return prev + 2;
            });
        }, minDuration / 50);

        // Start fade out animation
        const fadeTimer = setTimeout(() => {
            setFadeOut(true);
        }, minDuration - 300);

        // Complete splash
        const completeTimer = setTimeout(() => {
            onComplete();
        }, minDuration);

        return () => {
            clearInterval(progressInterval);
            clearTimeout(fadeTimer);
            clearTimeout(completeTimer);
        };
    }, [minDuration, onComplete]);

    return (
        <div 
            className={`fixed inset-0 z-[9999] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 ${
                fadeOut ? 'opacity-0' : 'opacity-100'
            }`}
        >
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Teal glow */}
                <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-teal-500/20 rounded-full blur-3xl animate-pulse-glow" />
                {/* Amber glow */}
                <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
                
                {/* Floating particles */}
                <div className="absolute inset-0">
                    {[...Array(20)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-1 bg-teal-400/30 rounded-full animate-float-particle"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animationDelay: `${Math.random() * 3}s`,
                                animationDuration: `${3 + Math.random() * 2}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Logo Container */}
            <div className="relative z-10 flex flex-col items-center">
                {/* Logo with animation */}
                <div className="relative animate-logo-entrance">
                    {/* Glow behind logo */}
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400/40 to-amber-400/20 blur-3xl rounded-full scale-150 animate-pulse-glow" />
                    
                    {/* Logo image */}
                    <img 
                        src="/adora-logo.png" 
                        alt="Adora" 
                        className="relative w-56 h-56 object-contain drop-shadow-2xl animate-logo-float"
                        style={{ 
                            filter: 'drop-shadow(0 0 40px rgba(45, 212, 191, 0.5))'
                        }}
                    />
                </div>

                {/* Tagline */}
                <div className="mt-8 text-center animate-fade-up" style={{ animationDelay: '0.5s' }}>
                    <h2 className="text-2xl font-light text-white/90 tracking-wider mb-2">
                        منظومة إدارة الفنادق
                    </h2>
                    <p className="text-teal-400/80 text-sm tracking-widest">
                        HOTEL MANAGEMENT SYSTEM
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mt-12 w-64 animate-fade-up" style={{ animationDelay: '0.8s' }}>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-100 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-center text-white/70 text-xs mt-3 tracking-wider"> {/* ✅ Improved contrast (was 40%) */}
                        جاري التحميل...
                    </p>
                </div>
            </div>

            {/* Version */}
            <div className="absolute bottom-8 text-center animate-fade-up" style={{ animationDelay: '1s' }}>
                <p className="text-white/20 text-xs">
                    الإصدار 2.0
                </p>
            </div>

            {/* Custom Styles */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { opacity: 0.5; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.1); }
                }
                .animate-pulse-glow {
                    animation: pulse-glow 3s ease-in-out infinite;
                }

                @keyframes logo-entrance {
                    0% { opacity: 0; transform: scale(0.8) translateY(20px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-logo-entrance {
                    animation: logo-entrance 0.8s ease-out forwards;
                }

                @keyframes logo-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }
                .animate-logo-float {
                    animation: logo-float 3s ease-in-out infinite;
                    animation-delay: 0.8s;
                }

                @keyframes fade-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-up {
                    opacity: 0;
                    animation: fade-up 0.6s ease-out forwards;
                }

                @keyframes float-particle {
                    0%, 100% { 
                        transform: translateY(0) translateX(0); 
                        opacity: 0.3;
                    }
                    50% { 
                        transform: translateY(-30px) translateX(10px); 
                        opacity: 0.6;
                    }
                }
                .animate-float-particle {
                    animation: float-particle 4s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default SplashScreen;
