import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useUX } from '../../context/UXContext';

export interface TourStep {
    target: string; // CSS Selector (e.g., '#sidebar', '.stats-card')
    title: string;
    description: string;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourGuideProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

// ✅ FIXED: Get absolute position of element (accounting for all scroll containers)
const getAbsoluteRect = (element: HTMLElement): DOMRect => {
    const rect = element.getBoundingClientRect();
    return rect;
};

export const TourGuide: React.FC<TourGuideProps> = ({ steps, isOpen, onClose, onComplete }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const frameRef = useRef<number>(0);
    const { playSound } = useUX();

    // ✅ FIXED: Continuously update position using requestAnimationFrame
    const updateTargetPosition = useCallback(() => {
        const step = steps[currentStepIndex];
        if (!step) return;
        
        const element = document.querySelector(step.target) as HTMLElement;
        if (element) {
            const rect = getAbsoluteRect(element);
            setTargetRect(rect);
        }
    }, [currentStepIndex, steps]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setCurrentStepIndex(0);
            playSound('success');
        }
    }, [isOpen]);

    // ✅ FIXED: Use RAF for smooth tracking
    useEffect(() => {
        if (!isOpen) return;

        const step = steps[currentStepIndex];
        if (!step) return;

        const element = document.querySelector(step.target) as HTMLElement;
        if (!element) {
            console.warn(`Tour target not found: ${step.target}`);
            return;
        }

        // Scroll element into view first
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Start tracking after scroll
        const startTracking = () => {
            const track = () => {
                updateTargetPosition();
                frameRef.current = requestAnimationFrame(track);
            };
            frameRef.current = requestAnimationFrame(track);
        };

        const scrollTimer = setTimeout(startTracking, 400);

        return () => {
            clearTimeout(scrollTimer);
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [currentStepIndex, isOpen, steps, updateTargetPosition]);

    if (!isOpen || !targetRect) return null;

    const currentStep = steps[currentStepIndex];

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            playSound('click');
        } else {
            onClose();
            onComplete?.();
            playSound('success');
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
            playSound('click');
        }
    };

    // ✅ Mobile-first popover positioning
    const getPopoverStyle = () => {
        const isMobile = window.innerWidth < 640;
        const popoverWidth = isMobile ? Math.min(300, window.innerWidth - 32) : 320;
        const gap = 12;

        let top = 0;
        let left = 0;

        // On mobile, always show at bottom center of screen
        if (isMobile) {
            top = Math.min(targetRect.bottom + gap, window.innerHeight - 220);
            left = (window.innerWidth - popoverWidth) / 2;
        } else {
            switch (currentStep.placement) {
                case 'bottom':
                    top = targetRect.bottom + gap;
                    left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                    break;
                case 'top':
                    top = targetRect.top - gap - 180;
                    left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                    break;
                case 'right':
                    top = targetRect.top;
                    left = targetRect.right + gap;
                    break;
                case 'left':
                    top = targetRect.top;
                    left = targetRect.left - gap - popoverWidth;
                    break;
                case 'center':
                    top = window.innerHeight / 2 - 100;
                    left = window.innerWidth / 2 - (popoverWidth / 2);
                    break;
                default:
                    top = targetRect.bottom + gap;
                    left = targetRect.left;
            }
        }

        // Boundary checks
        left = Math.max(16, Math.min(left, window.innerWidth - popoverWidth - 16));
        top = Math.max(16, Math.min(top, window.innerHeight - 200));

        return { top, left, width: popoverWidth };
    };

    const popoverStyle = getPopoverStyle();

    return (
        <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-none">
            {/* ✅ FIXED: SVG-based overlay with cutout - pixel perfect */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ zIndex: 1 }}>
                <defs>
                    <mask id="tour-mask">
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        <rect 
                            x={targetRect.left - 4} 
                            y={targetRect.top - 4} 
                            width={targetRect.width + 8} 
                            height={targetRect.height + 8} 
                            rx="12"
                            fill="black" 
                        />
                    </mask>
                </defs>
                <rect 
                    x="0" y="0" 
                    width="100%" height="100%" 
                    fill="rgba(0,0,0,0.7)" 
                    mask="url(#tour-mask)" 
                />
            </svg>

            {/* ✅ Highlight Border - follows element exactly - Turquoise (#20B2AA) */}
            <div
                className="absolute border-2 border-white rounded-xl pointer-events-none"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                    boxShadow: '0 0 0 4px rgba(32,178,170,0.5), 0 0 20px rgba(32,178,170,0.3)',
                    zIndex: 2,
                    transition: 'all 0.15s ease-out'
                }}
            />

            {/* ✅ Tooltip Card - Mobile Responsive */}
            <div
                className="absolute pointer-events-auto"
                style={{
                    top: popoverStyle.top,
                    left: popoverStyle.left,
                    width: popoverStyle.width,
                    zIndex: 3,
                    transition: 'all 0.2s ease-out'
                }}
            >
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-white/10">
                    <div className="flex justify-between items-start mb-2 sm:mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#20B2AA' }}>
                            خطوة {currentStepIndex + 1} من {steps.length}
                        </span>
                        <button 
                            onClick={onClose} 
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--theme-text-tertiary)' }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                        {currentStep.title}
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5" style={{ color: 'var(--theme-text-secondary)' }}>
                        {currentStep.description}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                        <button
                            onClick={handlePrev}
                            disabled={currentStepIndex === 0}
                            className="p-2 rounded-lg disabled:opacity-30 transition-all"
                            style={{ 
                                background: 'var(--theme-bg-tertiary)',
                                color: 'var(--theme-text-secondary)'
                            }}
                        >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
                        </button>

                        <div className="flex gap-1 sm:gap-1.5">
                            {steps.map((_, idx) => (
                                <div
                                    key={idx}
                                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors"
                                    style={{ 
                                        background: idx === currentStepIndex 
                                            ? '#20B2AA' 
                                            : 'var(--theme-border-primary)' 
                                    }}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm text-white transition-all"
                            style={{ background: '#20B2AA' }}
                        >
                            {currentStepIndex === steps.length - 1 ? 'إنهاء' : 'التالي'}
                            {currentStepIndex !== steps.length - 1 && <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
