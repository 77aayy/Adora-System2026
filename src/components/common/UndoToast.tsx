/**
 * Undo Toast Component
 * Shows undo action for critical operations (e.g., housekeeping status changes)
 * Adora Hotel Management System V2
 */

import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

interface UndoToastProps {
    message: string;
    onUndo: () => void;
    onDismiss?: () => void;
    duration?: number; // Duration in milliseconds (default: 5000)
}

export const UndoToast: React.FC<UndoToastProps> = ({
    message,
    onUndo,
    onDismiss,
    duration = 5000
}) => {
    const [isVisible, setIsVisible] = useState(true);
    const [timeLeft, setTimeLeft] = useState(duration);

    useEffect(() => {
        if (!isVisible) return;

        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    setIsVisible(false);
                    if (onDismiss) onDismiss();
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => clearInterval(interval);
    }, [isVisible, onDismiss]);

    const handleUndo = () => {
        setIsVisible(false);
        onUndo();
    };

    const handleDismiss = () => {
        setIsVisible(false);
        if (onDismiss) onDismiss();
    };

    if (!isVisible) return null;

    const progress = (timeLeft / duration) * 100;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="glass-card p-4 rounded-2xl border border-blue-500/30 shadow-2xl min-w-[320px] max-w-md">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <RotateCcw className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{message}</p>
                        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-400 transition-all duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleUndo}
                            className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                        >
                            تراجع
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
