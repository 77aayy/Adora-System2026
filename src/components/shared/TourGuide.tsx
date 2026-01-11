import React, { useState, useEffect, useRef } from 'react';
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

export const TourGuide: React.FC<TourGuideProps> = ({ steps, isOpen, onClose, onComplete }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const { playSound } = useUX();

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setCurrentStepIndex(0);
            playSound('success');
        }
    }, [isOpen]);

    // Check target element position
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            const step = steps[currentStepIndex];
            const element = document.querySelector(step.target);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTargetRect(element.getBoundingClientRect());
            } else {
                // If element not found, skip or close (simple handling)
                console.warn(`Tour target not found: ${step.target}`);
            }
        }, 300); // Delay for scroll/render

        return () => clearTimeout(timer);
    }, [currentStepIndex, isOpen, steps]);

    // Handle Resize
    useEffect(() => {
        const handleResize = () => {
            const step = steps[currentStepIndex];
            const element = document.querySelector(step.target);
            if (element) setTargetRect(element.getBoundingClientRect());
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [currentStepIndex, steps]);

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

    // Calculate Popover Position
    const getPopoverStyle = () => {
        const gap = 12;
        const popoverWidth = 320;

        let top = 0;
        let left = 0;

        // Simple positioning logic
        switch (currentStep.placement) {
            case 'bottom':
                top = targetRect.bottom + gap;
                left = targetRect.left + (targetRect.width / 2) - (popoverWidth / 2);
                break;
            case 'top':
                top = targetRect.top - gap - 200; // Approx height
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
                left = window.innerWidth / 2 - 150;
                break;
            default: // Default to bottom
                top = targetRect.bottom + gap;
                left = targetRect.left;
        }

        // Boundary checks (keep on screen)
        if (left < 10) left = 10;
        if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - 10;
        if (top < 10) top = 10;
        if (top + 200 > window.innerHeight) top = window.innerHeight - 200 - 10;

        return { top, left, width: popoverWidth };
    };

    const popoverStyle = getPopoverStyle();

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            {/* Dark Overlay with "Hole" using clip-path technically hard, so we use simpler 4-div approach or svg mask. 
                For simplicity in React without big libs, we'll use a semi-transparent overlay 
                and z-index trick or just a highlight box. */}

            {/* We will use a mixed approach: A huge border around a transparent box */}
            <div
                className="absolute transition-all duration-300 ease-out border-black/70 pointer-events-none"
                style={{
                    borderWidth: '2000px', // Massive border to cover screen
                    top: targetRect.top - 2000 - 4, // -4 for padding
                    left: targetRect.left - 2000 - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                    borderRadius: '12px'
                }}
            />

            {/* The Highlight Box Border (Active Focus) */}
            <div
                className="absolute border-2 border-white rounded-xl shadow-[0_0_0_4px_rgba(13,148,136,0.5)] transition-all duration-300 ease-out pointer-events-none animate-pulse"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                }}
            />

            {/* The Tooltip Card */}
            <div
                className="absolute bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl transition-all duration-300 transform animate-in fade-in zoom-in-95"
                style={{
                    top: popoverStyle.top,
                    left: popoverStyle.left,
                    width: popoverStyle.width
                }}
            >
                {/* Arrow if needed (skipped for simplicity) */}

                <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                        خطوة {currentStepIndex + 1} من {steps.length}
                    </span>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{currentStep.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    {currentStep.description}
                </p>

                <div className="flex items-center justify-between">
                    <button
                        onClick={handlePrev}
                        disabled={currentStepIndex === 0}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/60 disabled:opacity-30 transition-colors"
                    >
                        <ChevronRight className="w-5 h-5 rotate-180" /> {/* RTL flip if needed, but ChevronRight usually points > */}
                    </button>

                    <div className="flex gap-1.5">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-2 h-2 rounded-full transition-colors ${idx === currentStepIndex ? 'bg-primary-500' : 'bg-white/20'}`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleNext}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium text-sm transition-all"
                    >
                        {currentStepIndex === steps.length - 1 ? 'إنهاء' : 'التالي'}
                        {currentStepIndex !== steps.length - 1 && <ChevronLeft className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
