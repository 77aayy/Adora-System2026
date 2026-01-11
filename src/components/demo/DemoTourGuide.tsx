/**
 * Demo Tour Guide Component
 * Interactive walkthrough for demo users
 * Features: Step-by-step navigation, highlighting, progress tracking
 * Adora Hotel Management System V3 - SaaS
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    X, ChevronRight, ChevronLeft, Play, Pause, SkipForward, 
    CheckCircle, Circle, Sparkles, BookOpen, Volume2, VolumeX,
    Maximize2, Minimize2, RotateCcw
} from 'lucide-react';
import { 
    TourStep, getTourSteps, updateSessionProgress, 
    getCurrentDemoSession, DemoSession 
} from '../../services/demoLinkService';
import { useNavigate, useLocation } from 'react-router-dom';

// ============================================================
// TYPES
// ============================================================

interface DemoTourGuideProps {
    session: DemoSession;
    onComplete: () => void;
    onSkip: () => void;
    language?: 'ar' | 'en';
}

interface TooltipPosition {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
}

// ============================================================
// SECTION ROUTES
// ============================================================

const SECTION_ROUTES: Record<string, string> = {
    'reception': '/reception',
    'housekeeping': '/housekeeping',
    'bellman': '/bellman',
    'maintenance': '/maintenance',
    'admin': '/admin',
    'owner': '/owner-dashboard',
    'all': '/',
};

// ============================================================
// COMPONENT
// ============================================================

export const DemoTourGuide: React.FC<DemoTourGuideProps> = ({
    session,
    onComplete,
    onSkip,
    language = 'ar'
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // State
    const [currentStepIndex, setCurrentStepIndex] = useState(session.currentStep || 0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({});
    
    // Get tour steps
    const steps = useMemo(() => 
        getTourSteps(session.permissions.scopes, language),
        [session.permissions.scopes, language]
    );
    
    const currentStep = steps[currentStepIndex];
    const progress = ((currentStepIndex + 1) / steps.length) * 100;
    
    // ============================================================
    // EFFECTS
    // ============================================================
    
    // Highlight current element
    useEffect(() => {
        if (!currentStep || isMinimized) {
            setHighlightedElement(null);
            return;
        }
        
        const element = document.querySelector(currentStep.targetSelector) as HTMLElement;
        
        if (element && currentStep.highlight) {
            setHighlightedElement(element);
            
            // Calculate tooltip position
            const rect = element.getBoundingClientRect();
            const newPosition: TooltipPosition = {};
            
            switch (currentStep.position) {
                case 'top':
                    newPosition.left = rect.left + rect.width / 2;
                    newPosition.bottom = window.innerHeight - rect.top + 20;
                    break;
                case 'bottom':
                    newPosition.left = rect.left + rect.width / 2;
                    newPosition.top = rect.bottom + 20;
                    break;
                case 'left':
                    newPosition.right = window.innerWidth - rect.left + 20;
                    newPosition.top = rect.top + rect.height / 2;
                    break;
                case 'right':
                    newPosition.left = rect.right + 20;
                    newPosition.top = rect.top + rect.height / 2;
                    break;
                case 'center':
                default:
                    newPosition.left = window.innerWidth / 2;
                    newPosition.top = window.innerHeight / 2;
            }
            
            setTooltipPosition(newPosition);
            
            // Scroll to element
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setHighlightedElement(null);
            // Center position for 'center' or missing elements
            setTooltipPosition({
                left: window.innerWidth / 2,
                top: window.innerHeight / 2
            });
        }
    }, [currentStep, isMinimized]);
    
    // Navigate to correct section
    useEffect(() => {
        if (!currentStep || isMinimized) return;
        
        const sectionRoute = SECTION_ROUTES[currentStep.section];
        if (sectionRoute && sectionRoute !== '/' && !location.pathname.startsWith(sectionRoute)) {
            navigate(sectionRoute);
        }
    }, [currentStep, navigate, location.pathname, isMinimized]);
    
    // Auto-play
    useEffect(() => {
        if (!isPlaying || isMinimized) return;
        
        const timer = setTimeout(() => {
            // Only auto-advance if not waiting for interaction
            if (!currentStep?.waitForAction) {
                // Don't auto-advance, wait for user
            }
        }, 5000);
        
        return () => clearTimeout(timer);
    }, [currentStepIndex, isPlaying, currentStep, isMinimized]);
    
    // Play sound
    const playSound = useCallback((type: 'next' | 'complete' | 'skip') => {
        if (!soundEnabled) return;
        
        const audio = new Audio();
        switch (type) {
            case 'next':
                audio.src = '/sounds/pop.mp3';
                break;
            case 'complete':
                audio.src = '/sounds/success.mp3';
                break;
            case 'skip':
                audio.src = '/sounds/skip.mp3';
                break;
        }
        audio.volume = 0.3;
        audio.play().catch(() => {});
    }, [soundEnabled]);
    
    // ============================================================
    // HANDLERS
    // ============================================================
    
    const handleNext = async () => {
        if (currentStepIndex < steps.length - 1) {
            playSound('next');
            const newIndex = currentStepIndex + 1;
            setCurrentStepIndex(newIndex);
            
            // Update session progress
            await updateSessionProgress(session.id, {
                currentStep: newIndex,
                visitedSection: currentStep?.section,
            });
        } else {
            handleComplete();
        }
    };
    
    const handlePrevious = () => {
        if (currentStepIndex > 0) {
            playSound('next');
            setCurrentStepIndex(currentStepIndex - 1);
        }
    };
    
    const handleComplete = async () => {
        playSound('complete');
        await updateSessionProgress(session.id, {
            tourCompleted: true,
            currentStep: steps.length - 1,
        });
        onComplete();
    };
    
    const handleSkip = async () => {
        playSound('skip');
        await updateSessionProgress(session.id, {
            tourCompleted: true,
            actionPerformed: 'tour_skipped',
        });
        onSkip();
    };
    
    const handleRestart = () => {
        setCurrentStepIndex(0);
    };
    
    const goToStep = (index: number) => {
        setCurrentStepIndex(index);
    };
    
    // ============================================================
    // RENDER
    // ============================================================
    
    if (!currentStep) return null;
    
    const isArabic = language === 'ar';
    const title = isArabic ? currentStep.title : currentStep.titleEn;
    const description = isArabic ? currentStep.description : currentStep.descriptionEn;
    
    return (
        <>
            {/* Overlay */}
            {!isMinimized && (
                <div className="fixed inset-0 z-[9998] pointer-events-none">
                    {/* Dark overlay with cutout for highlighted element */}
                    <div className="absolute inset-0 bg-black/60 transition-all duration-300" />
                    
                    {/* Highlight ring */}
                    {highlightedElement && (
                        <div 
                            className="absolute border-4 border-teal-400 rounded-xl shadow-[0_0_30px_rgba(20,184,166,0.5)] pointer-events-auto transition-all duration-300"
                            style={{
                                top: highlightedElement.getBoundingClientRect().top - 8,
                                left: highlightedElement.getBoundingClientRect().left - 8,
                                width: highlightedElement.getBoundingClientRect().width + 16,
                                height: highlightedElement.getBoundingClientRect().height + 16,
                            }}
                        />
                    )}
                </div>
            )}
            
            {/* Tour Tooltip */}
            <div 
                className={`fixed z-[9999] transition-all duration-500 ${
                    isMinimized 
                        ? 'bottom-4 right-4 w-auto' 
                        : 'transform -translate-x-1/2'
                }`}
                style={isMinimized ? {} : {
                    top: tooltipPosition.top,
                    left: tooltipPosition.left,
                    bottom: tooltipPosition.bottom,
                    right: tooltipPosition.right,
                }}
                dir={isArabic ? 'rtl' : 'ltr'}
            >
                {isMinimized ? (
                    // Minimized View
                    <button
                        onClick={() => setIsMinimized(false)}
                        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-2xl shadow-2xl hover:shadow-teal-500/50 transition-all"
                    >
                        <BookOpen className="w-5 h-5" />
                        <span className="font-bold">{isArabic ? 'متابعة الجولة' : 'Continue Tour'}</span>
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
                            {currentStepIndex + 1}/{steps.length}
                        </span>
                        <Maximize2 className="w-4 h-4" />
                    </button>
                ) : (
                    // Full Tooltip
                    <div className="w-[400px] max-w-[90vw] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl border border-teal-500/30 overflow-hidden">
                        {/* Progress Bar */}
                        <div className="h-1 bg-slate-700">
                            <div 
                                className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        
                        {/* Header */}
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center">
                                    <span className="text-2xl">{currentStep.icon || '🎯'}</span>
                                </div>
                                <div>
                                    <p className="text-xs text-teal-400 font-medium">
                                        {isArabic ? `الخطوة ${currentStepIndex + 1} من ${steps.length}` : `Step ${currentStepIndex + 1} of ${steps.length}`}
                                    </p>
                                    <h3 className="text-white font-bold text-lg">{title}</h3>
                                </div>
                            </div>
                            
                            {/* Controls */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setSoundEnabled(!soundEnabled)}
                                    className="p-2 text-white/50 hover:text-white transition-colors"
                                    title={soundEnabled ? 'Mute' : 'Unmute'}
                                >
                                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => setIsMinimized(true)}
                                    className="p-2 text-white/50 hover:text-white transition-colors"
                                    title="Minimize"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSkip}
                                    className="p-2 text-white/50 hover:text-red-400 transition-colors"
                                    title={isArabic ? 'تخطي الجولة' : 'Skip Tour'}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5">
                            <p className="text-white/80 text-base leading-relaxed mb-4">
                                {description}
                            </p>
                            
                            {/* Video Preview (if available) */}
                            {currentStep.videoUrl && (
                                <div className="mb-4 rounded-xl overflow-hidden bg-black/50">
                                    <video 
                                        src={currentStep.videoUrl}
                                        className="w-full"
                                        controls
                                        muted
                                    />
                                </div>
                            )}
                            
                            {/* Interaction Hint */}
                            {currentStep.allowInteraction && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-sm">
                                    <Sparkles className="w-4 h-4" />
                                    <span>{isArabic ? 'يمكنك التفاعل مع هذا العنصر!' : 'You can interact with this element!'}</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Step Indicators */}
                        <div className="px-5 pb-3">
                            <div className="flex justify-center gap-1.5 flex-wrap">
                                {steps.map((step, idx) => (
                                    <button
                                        key={step.id}
                                        onClick={() => goToStep(idx)}
                                        className={`w-2.5 h-2.5 rounded-full transition-all ${
                                            idx === currentStepIndex
                                                ? 'bg-teal-400 scale-125'
                                                : idx < currentStepIndex
                                                    ? 'bg-teal-600'
                                                    : 'bg-slate-600 hover:bg-slate-500'
                                        }`}
                                        title={isArabic ? step.title : step.titleEn}
                                    />
                                ))}
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3">
                            <button
                                onClick={handlePrevious}
                                disabled={currentStepIndex === 0}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className={`w-4 h-4 ${!isArabic && 'rotate-180'}`} />
                                <span>{isArabic ? 'السابق' : 'Previous'}</span>
                            </button>
                            
                            <button
                                onClick={handleRestart}
                                className="p-2.5 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
                                title={isArabic ? 'إعادة الجولة' : 'Restart Tour'}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            
                            {currentStepIndex < steps.length - 1 ? (
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold hover:from-teal-400 hover:to-cyan-500 shadow-lg shadow-teal-500/25 transition-all"
                                >
                                    <span>{isArabic ? 'التالي' : 'Next'}</span>
                                    <ChevronLeft className={`w-4 h-4 ${!isArabic && 'rotate-180'}`} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleComplete}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/25 transition-all"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    <span>{isArabic ? 'إنهاء الجولة' : 'Finish Tour'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default DemoTourGuide;
