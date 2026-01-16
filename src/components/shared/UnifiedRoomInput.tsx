/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Unified Room Input Component
 * Standardized room number input across all dashboards
 * Adora Hotel Management System V2
 * 
 * Features:
 * - Direct room number input
 * - Floor-based room selector button
 * - Real-time validation
 * - Active card warnings
 * - i18n support
 * - Theme-aware styling
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Building2, AlertCircle, CheckCircle } from 'lucide-react';
import { FloorRoomSelector } from './FloorRoomSelector';
import { haptic } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

export interface UnifiedRoomInputProps {
    /** Current room number value */
    value: string;
    /** Callback when room number changes */
    onChange: (roomNumber: string) => void;
    /** Callback when room is selected/confirmed */
    onConfirm?: (roomNumber: string) => void;
    /** Available rooms list (from rooms service) */
    availableRooms: string[];
    /** Rooms with active cards (cannot be selected) */
    activeRoomNumbers?: Set<string> | string[];
    /** Blocked rooms (e.g., rooms with active requests) */
    blockedRooms?: string[];
    /** Show floor selector button */
    showFloorSelector?: boolean;
    /** Show confirm button */
    showConfirmButton?: boolean;
    /** Placeholder text */
    placeholder?: string;
    /** Label text */
    label?: string;
    /** Error message to display */
    error?: string | null;
    /** Disabled state */
    disabled?: boolean;
    /** Auto-confirm on Enter key */
    autoConfirmOnEnter?: boolean;
    /** Custom validation function */
    validateRoom?: (room: string) => { valid: boolean; message?: string };
    /** Show last request info */
    showLastRequestInfo?: boolean;
    /** Custom className */
    className?: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const UnifiedRoomInput: React.FC<UnifiedRoomInputProps> = ({
    value,
    onChange,
    onConfirm,
    availableRooms = [],
    activeRoomNumbers = [],
    blockedRooms = [],
    showFloorSelector = true,
    showConfirmButton = true,
    placeholder,
    label,
    error,
    disabled = false,
    autoConfirmOnEnter = true,
    validateRoom,
    showLastRequestInfo = false,
    className = ''
}) => {
    const { t } = useTranslation();
    
    const [showFloorSelectorModal, setShowFloorSelectorModal] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Convert activeRoomNumbers to Set if it's an array
    const activeRoomsSet = useMemo(() => {
        if (Array.isArray(activeRoomNumbers)) {
            return new Set(activeRoomNumbers);
        }
        return activeRoomNumbers;
    }, [activeRoomNumbers]);

    // Check if current room has active card
    const roomHasActiveCard = useMemo(() => {
        return value ? activeRoomsSet.has(value) : false;
    }, [value, activeRoomsSet]);

    // Check if current room is blocked
    const roomIsBlocked = useMemo(() => {
        return value ? blockedRooms.includes(value) : false;
    }, [value, blockedRooms]);

    // Check if room exists in available rooms
    const roomExists = useMemo(() => {
        if (!value) return true; // Allow empty
        return availableRooms.length === 0 || availableRooms.includes(value);
    }, [value, availableRooms]);

    // Combined validation
    const validationState = useMemo(() => {
        if (!value) {
            return { valid: false, message: null };
        }

        // Custom validation first
        if (validateRoom) {
            const customResult = validateRoom(value);
            if (!customResult.valid) {
                return { valid: false, message: customResult.message || null };
            }
        }

        // Check if room has active card
        if (roomHasActiveCard) {
            return {
                valid: false,
                message: t('bellman.roomHasActiveCardDesc', { room: value }) || 
                         `Room ${value} has an active card - must check out first.`
            };
        }

        // Check if room is blocked
        if (roomIsBlocked) {
            return {
                valid: false,
                message: t('reception.roomNotFoundInBranch', { room: value }) || 
                         `Room ${value} is blocked.`
            };
        }

        // Check if room exists in branch
        if (!roomExists && availableRooms.length > 0) {
            return {
                valid: false,
                message: t('reception.roomNotFoundInBranch', { room: value }) || 
                         `Room ${value} does not exist in this branch. Please select a room from the list.`
            };
        }

        return { valid: true, message: null };
    }, [value, roomHasActiveCard, roomIsBlocked, roomExists, availableRooms, validateRoom, t]);

    // Handle room input change
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onChange(newValue);
        setLocalError(null);
    }, [onChange]);

    // ✅ NEW: Handle onBlur - validate when user finishes typing
    const handleBlur = useCallback(() => {
        if (!value || value.trim() === '') {
            setLocalError(null);
            return;
        }

        // Validate room exists in branch
        if (availableRooms.length > 0 && !availableRooms.includes(value)) {
            setLocalError(
                t('reception.roomNotFoundInBranch', { room: value }) || 
                `الغرفة رقم ${value} غير موجودة في هذا الفرع. يرجى إدخال رقم غرفة صحيح.`
            );
            haptic('error');
        } else {
            setLocalError(null);
        }
    }, [value, availableRooms, t]);

    // Handle Enter key
    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && autoConfirmOnEnter && validationState.valid && onConfirm) {
            haptic('light');
            onConfirm(value);
        }
    }, [autoConfirmOnEnter, validationState.valid, onConfirm, value]);

    // Handle room selection from floor selector
    const handleRoomSelect = useCallback((room: string) => {
        onChange(room);
        setShowFloorSelectorModal(false);
        
        // Auto-confirm if callback provided
        if (onConfirm && validationState.valid) {
            setTimeout(() => {
                onConfirm(room);
            }, 100);
        }
    }, [onChange, onConfirm, validationState.valid]);

    // Handle confirm button click
    const handleConfirm = useCallback(() => {
        if (!validationState.valid) {
            haptic('error');
            setLocalError(validationState.message || t('reception.enterRoomNumber') || 'Please enter a valid room number');
            return;
        }
        
        haptic('light');
        if (onConfirm) {
            onConfirm(value);
        }
    }, [validationState, value, onConfirm, t]);

    // Determine error message to show
    const displayError = error || localError || validationState.message;
    const isInvalid = !validationState.valid && value.length > 0;

    // Filter available rooms (exclude blocked and active)
    const filteredAvailableRooms = useMemo(() => {
        return availableRooms.filter(room => 
            !blockedRooms.includes(room) && !activeRoomsSet.has(room)
        );
    }, [availableRooms, blockedRooms, activeRoomsSet]);

    return (
        <div className={`space-y-3 ${className}`}>
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                    {label}
                </label>
            )}

            {/* Input Container */}
            <div className="flex gap-2">
                {/* Room Number Input */}
                <div className="flex-1 relative">
                    <input
                        type="text"
                        inputMode="numeric"
                        value={value}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        onKeyPress={handleKeyPress}
                        placeholder={placeholder || t('reception.enterRoomNumber') || 'Enter room number'}
                        disabled={disabled}
                        className={`
                            w-full px-4 py-3 rounded-xl
                            bg-white/10 dark:bg-white/5
                            border-2 transition-all
                            text-center text-lg font-medium
                            focus:outline-none focus:ring-2
                            ${isInvalid || roomHasActiveCard
                                ? 'border-red-500/50 focus:ring-red-500/30'
                                : 'border-white/10 focus:border-primary-500/50 focus:ring-primary-500/30'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                        style={{ color: 'var(--theme-text-primary)' }}
                    />
                    
                    {/* Input Icon */}
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <DoorOpen className={`w-5 h-5 ${isInvalid || roomHasActiveCard ? 'text-red-400' : 'text-white/40'}`} />
                    </div>
                </div>

                {/* Floor Selector Button */}
                {showFloorSelector && filteredAvailableRooms.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            haptic('light');
                            setShowFloorSelectorModal(true);
                        }}
                        disabled={disabled}
                        className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        title={t('reception.selectRoomByFloor') || 'Select room by floor'}
                    >
                        <Building2 className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm font-medium">
                            {t('reception.selectRoomByFloor') || 'Select Floor'}
                        </span>
                    </button>
                )}

                {/* Confirm Button */}
                {showConfirmButton && (
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={disabled || !value || !validationState.valid}
                        className={`
                            px-4 py-3 rounded-xl font-medium
                            flex items-center justify-center gap-2
                            transition-all
                            ${validationState.valid && value
                                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                                : 'bg-white/10 text-white/40 cursor-not-allowed'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                    >
                        <CheckCircle className="w-5 h-5" />
                        <span className="hidden sm:inline text-sm">
                            {t('reception.confirmRoomNumber') || 'Confirm'}
                        </span>
                    </button>
                )}
            </div>

            {/* Error/Warning Messages */}
            {displayError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-2 text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">{displayError}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Card Warning */}
            {roomHasActiveCard && !displayError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 animate-in slide-in-from-top-2">
                    <div className="flex items-start gap-2 text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-bold">{t('bellman.roomHasActiveCard') || 'Room has active card!'}</p>
                            <p className="text-xs text-red-300 mt-1">
                                {t('bellman.roomHasActiveCardDesc', { room: value }) || 
                                 `Room ${value} has an active card - must check out first.`}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Rooms Not Loaded Warning */}
            {availableRooms.length === 0 && (
                <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/50">
                    <div className="flex items-start gap-2 text-yellow-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm">
                                {t('reception.roomsNotLoaded') || 'Rooms data not loaded yet'}
                            </p>
                            <p className="text-xs text-yellow-300 mt-1">
                                {t('reception.pleaseWaitForRooms') || 'Please wait for rooms data to load...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Floor Room Selector Modal */}
            {showFloorSelector && (
                <FloorRoomSelector
                    rooms={filteredAvailableRooms}
                    selectedRoom={value}
                    onSelect={handleRoomSelect}
                    isOpen={showFloorSelectorModal}
                    onClose={() => setShowFloorSelectorModal(false)}
                    blockedRooms={blockedRooms}
                />
            )}
        </div>
    );
};

export default UnifiedRoomInput;
