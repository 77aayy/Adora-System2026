import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SwipeableRowProps {
    children: React.ReactNode;
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    rightLabel?: string;
    leftLabel?: string;
    rightColor?: string;
    leftColor?: string;
    rightIcon?: React.ReactNode;
    leftIcon?: React.ReactNode;
    threshold?: number;
    disabled?: boolean;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
    children,
    onSwipeRight,
    onSwipeLeft,
    rightLabel,
    leftLabel,
    rightColor = 'bg-green-500',
    leftColor = 'bg-red-500',
    rightIcon = <Check className="w-6 h-6 text-white" />,
    leftIcon = <X className="w-6 h-6 text-white" />,
    threshold = 100,
    disabled = false
}) => {
    const { t } = useTranslation();
    const finalRightLabel = rightLabel || t('common.complete');
    const finalLeftLabel = leftLabel || t('common.delete');
    const [offsetX, setOffsetX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startX = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        startX.current = e.touches[0].clientX;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || disabled) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;

        // Limit swipe logic
        if ((diff > 0 && !onSwipeRight) || (diff < 0 && !onSwipeLeft)) {
            return; // Don't allow swipe if no action
        }

        setOffsetX(diff);
    };

    const handleTouchEnd = () => {
        if (!isDragging || disabled) return;
        setIsDragging(false);

        if (offsetX > threshold && onSwipeRight) {
            onSwipeRight();
            setOffsetX(1000); // Animate out
        } else if (offsetX < -threshold && onSwipeLeft) {
            onSwipeLeft();
            setOffsetX(-1000); // Animate out
        } else {
            setOffsetX(0); // Reset
        }
    };

    const handleReset = () => {
        setOffsetX(0);
    };

    useEffect(() => {
        // If animated out, reset after delay (simulating item removal or action complete)
        if (Math.abs(offsetX) > 500) {
            const timer = setTimeout(() => {
                // In a real list, the item might be removed by parent
                // If not removed, we should snap back? 
                // Usually the parent removes the item. If not, we snap back manually.
                handleReset();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [offsetX]);

    const style = {
        transform: `translateX(${offsetX}px)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out'
    };

    return (
        <div className="relative overflow-hidden rounded-xl touch-pan-y select-none" ref={containerRef}>
            {/* Right Background (Swipe Right) */}
            <div className={`absolute inset-y-0 left-0 w-full flex items-center justify-start px-8 ${rightColor} ${offsetX > 0 ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-2 transform translate-x-[-20%]">
                    {rightIcon}
                    <span className="text-white font-bold">{finalRightLabel}</span>
                </div>
            </div>

            {/* Left Background (Swipe Left) */}
            <div className={`absolute inset-y-0 right-0 w-full flex items-center justify-end px-8 ${leftColor} ${offsetX < 0 ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-2 transform translate-x-[20%]">
                    <span className="text-white font-bold">{finalLeftLabel}</span>
                    {leftIcon}
                </div>
            </div>

            {/* Content */}
            <div
                className="relative bg-transparent"
                style={style}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {children}
            </div>
        </div>
    );
};
