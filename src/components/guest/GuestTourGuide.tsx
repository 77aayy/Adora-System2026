/**
 * Guest Tour Guide Component
 * Interactive tour for first-time guests (shown only 2 times)
 * 
 * Adora Hotel Management System V3
 */

import React from 'react';
import { X, ChevronLeft, ChevronRight, SkipForward, Check } from 'lucide-react';
import { useGuestTour, TourStep } from '../../services/guestTourService';

// ============================================================
// TYPES
// ============================================================

interface GuestTourGuideProps {
    roomNumber: string;
    branchId: string;
    onClose?: () => void;
}

// ============================================================
// TOUR STEP CARD COMPONENT
// ============================================================

const TourStepCard: React.FC<{
    step: TourStep;
    isActive: boolean;
    currentIndex: number;
    totalSteps: number;
    onNext: () => void;
    onPrev: () => void;
    onSkip: () => void;
    onComplete: () => void;
    remainingViews: number;
}> = ({
    step,
    isActive,
    currentIndex,
    totalSteps,
    onNext,
    onPrev,
    onSkip,
    onComplete,
    remainingViews
}) => {
    if (!isActive) return null;

    const isLastStep = currentIndex === totalSteps - 1;
    const isFirstStep = currentIndex === 0;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Tour Card */}
            <div className="relative w-full max-w-sm animate-in zoom-in-95 fade-in duration-300">
                {/* Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with gradient */}
                    <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-6 text-center relative">
                        {/* Skip Button */}
                        <button
                            onClick={onSkip}
                            className="absolute top-4 left-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>

                        {/* Icon */}
                        <div className="w-20 h-20 mx-auto mb-4 bg-white/20 rounded-2xl flex items-center justify-center text-4xl backdrop-blur-sm">
                            {step.icon}
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-bold text-white mb-1">
                            {step.title}
                        </h2>

                        {/* Progress dots */}
                        <div className="flex items-center justify-center gap-2 mt-4">
                            {Array.from({ length: totalSteps }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                        idx === currentIndex
                                            ? 'w-6 bg-white'
                                            : idx < currentIndex
                                            ? 'bg-white/70'
                                            : 'bg-white/30'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <p className="text-gray-600 text-center leading-relaxed">
                            {step.description}
                        </p>

                        {/* Remaining views hint */}
                        {remainingViews > 0 && currentIndex === 0 && (
                            <p className="text-xs text-gray-400 text-center mt-4">
                                💡 ستظهر هذه الجولة {remainingViews === 1 ? 'مرة واحدة فقط بعد هذه' : `${remainingViews} مرات`}
                            </p>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="px-6 pb-6 flex items-center gap-3">
                        {/* Previous Button */}
                        {!isFirstStep && (
                            <button
                                onClick={onPrev}
                                className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        )}

                        {/* Skip Button */}
                        <button
                            onClick={onSkip}
                            className="flex-1 py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <SkipForward className="w-4 h-4" />
                            تخطي
                        </button>

                        {/* Next/Complete Button */}
                        <button
                            onClick={isLastStep ? onComplete : onNext}
                            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold transition-all hover:shadow-lg hover:scale-105 flex items-center justify-center gap-2"
                        >
                            {isLastStep ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    فهمت!
                                </>
                            ) : (
                                <>
                                    التالي
                                    <ChevronLeft className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Step Counter */}
                <div className="text-center mt-4">
                    <span className="text-white/70 text-sm">
                        {currentIndex + 1} / {totalSteps}
                    </span>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const GuestTourGuide: React.FC<GuestTourGuideProps> = ({
    roomNumber,
    branchId,
    onClose
}) => {
    const {
        showTour,
        currentStep,
        totalSteps,
        remainingViews,
        nextStep,
        prevStep,
        skipTour,
        completeTour,
        steps
    } = useGuestTour(roomNumber, branchId);

    const handleSkip = () => {
        skipTour();
        onClose?.();
    };

    const handleComplete = () => {
        completeTour();
        onClose?.();
    };

    if (!showTour) return null;

    const currentStepData = steps[currentStep];

    return (
        <TourStepCard
            step={currentStepData}
            isActive={true}
            currentIndex={currentStep}
            totalSteps={totalSteps}
            onNext={nextStep}
            onPrev={prevStep}
            onSkip={handleSkip}
            onComplete={handleComplete}
            remainingViews={remainingViews}
        />
    );
};

export default GuestTourGuide;
