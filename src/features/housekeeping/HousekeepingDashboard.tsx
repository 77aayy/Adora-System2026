/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Modern Housekeeping Dashboard V2
 * Built from scratch with best UX practices
 * Adora Hotel Management System
 * Last Verified: 2026-01-04
 * 
 * Features:
 * - Room status grid with color coding
 * - Quick status updates with swipe
 * - Inspection workflow integration
 * - Real-time sync with Reception
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Clock, CheckCircle2, AlertCircle,
    Play, Eye, Camera, Star, History, Users, ShoppingCart,
    MessageSquare, DoorOpen, Zap, Filter, Search,
    CheckSquare, XCircle, ArrowRight, Clipboard, X, User, LogOut, Building2, Settings,
    QrCode, // ✅ QR icon for QR requests
    Smartphone, // ✅ Alternative QR icon
    Package, // ✅ Package icon for missing items
    BookOpen, // ✅ General instructions icon
    Headphones // ✅ Support ticket icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { db } from '../../services/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    addDoc, Timestamp, orderBy, getDocs, increment, getDoc, arrayUnion
} from 'firebase/firestore';
import { useSmartAgent } from '../../hooks/useSmartAgent';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import VoiceInputButton from '../../components/shared/VoiceInputButton';
import { loadMinibarProducts, calculateMinibarTotal } from '../../services/minibarService';
import { useTenant } from '../../context/TenantContext';
import { MinibarProduct, MinibarConsumption } from '../../types/minibar';
import { uploadInspectionPhoto } from '../../services/storageService';
import { PhotoUpload } from '../../components/shared/PhotoUpload';
import { updateRoomStatus } from '../../services/roomService';
import { useTranslation } from 'react-i18next';
import { useBrandName } from '../../hooks/useBrandName';

// Shared Components
import { ShiftNotes } from '../../components/shared/ShiftNotes';
import { PointsTracker } from '../../components/shared/PointsTracker';
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard';
import { TeamMembers } from '../../components/shared/TeamMembers';
import { HousekeepingTeamManager } from './HousekeepingTeamManager';
import { RoomHistoryModal } from '../../components/shared/RoomHistoryModal';
import { LaundryInventory } from '../../components/shared/LaundryInventory';
import { UnifiedHistoryModal } from '../../components/shared/UnifiedHistoryModal';
import { ReadReceipt } from '../../components/shared/ReadReceipt';
import { UnifiedRequestTabs } from '../../components/shared/UnifiedRequestTabs'; // ✅ Unified tabs
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline';
import { GoldenAlertDisplay } from '../../components/shared/GoldenAlert';
import { awardPoints, awardPerformancePoints } from '../../services/pointsService';
import { markAsViewed } from '../../services/requestService';
import { useLoadingState } from '../../hooks/useLoadingState';
import { UndoToast } from '../../components/common/UndoToast';
import { MobileMenu } from '../../components/common/MobileMenu';
import { StatCard } from '../../components/common/StatCard';
import { PointsNotification } from '../../components/shared/PointsNotification';
import { BranchLocationWarning } from '../../components/auth/BranchLocationWarning';
import { checkBranchLocation } from '../../services/branchLocationService';
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications

// Creative Dashboard Components
import { DepartmentStats, TaskProgress } from '../../components/dashboard';
import { SwipeableRow } from '../../components/common/SwipeableRow'; // ✅ Swipe Gestures
import { logEvent } from '../../services/analyticsService'; // ✅ Analytics


// ============================================================
// TYPES
// ============================================================

interface CleaningRequest {
    id: string;
    type: 'cleaning' | 'inspection' | 'maintenance'; // ⭐ Added maintenance
    status: 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_INSPECTION';
    roomNumber: string;
    guestName?: string;
    cleaningType: 'occupied' | 'checkout' | 'post_inspection' | 'maintenance_check'; // ⭐ Added maintenance_check
    priority: 'normal' | 'urgent';
    notes?: string;
    description?: string; // For maintenance requests
    createdAt: any;
    startedAt?: any;
    completedAt?: any;
    assignedTo?: { id: string; name: string };
    inspectionResult?: 'clean' | 'damages' | 'missing_items' | 'needs_cleaning' | 'needs_maintenance'; // ✅ Supports new inspection results
    // Department tracking
    currentDepartment?: 'housekeeping' | 'reception' | 'maintenance';
}

type TabType = 'new' | 'in_progress' | 'completed'; // ✅ Unified tabs
type RoomFilter = 'all' | 'occupied' | 'checkout';

// ============================================================
// CONSTANTS
// ============================================================

// STATUS_CONFIG will be created inside component to use t()

// CLEANING_TYPE_CONFIG will be created inside component to use t()

// ============================================================
// HELPER COMPONENTS
// ============================================================

// Stat Card - MOVED TO: components/common/StatCard.tsx
// Using centralized version for consistency across dashboards

// ✅ COMPACT Cleaning Task Card - Mobile-First
const TaskCard: React.FC<{
    task: CleaningRequest;
    onStart?: () => void;
    onComplete?: () => void;
    onView?: () => void;
    userId?: string;
    userName?: string;
    tenantId?: string; // ✅ Add tenantId prop
    statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }>;
    cleaningTypeConfig: Record<string, { label: string; color: string; bg: string }>;
}> = ({ task, onStart, onComplete, onView, userId, userName, tenantId, statusConfig, cleaningTypeConfig }) => {
    const { t } = useTranslation();
    const config = statusConfig[task.status] || statusConfig.CONFIRMED;
    const typeConfig = cleaningTypeConfig[task.cleaningType] || cleaningTypeConfig.occupied;

    const timeAgo = useMemo(() => {
        if (!task.createdAt) return '';
        const date = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('common.now');
        if (diff < 60) return `${diff}${t('housekeeping.timeAgo.minutes')}`;
        if (diff < 1440) return `${Math.floor(diff / 60)}${t('housekeeping.timeAgo.hours')}`;
        return `${Math.floor(diff / 1440)}${t('housekeeping.timeAgo.days')}`;
    }, [task.createdAt, t]);

    const elapsedTime = useMemo(() => {
        if (!task.startedAt) return null;
        const started = task.startedAt.toDate ? task.startedAt.toDate() : new Date(task.startedAt);
        return Math.floor((Date.now() - started.getTime()) / 60000);
    }, [task.startedAt]);

    const isDelayed = task.status === 'IN_PROGRESS' && elapsedTime && elapsedTime > 45;
    const isUrgent = task.priority === 'urgent';
    const isQR = (task as any).source === 'QR';

    const handleClick = async () => {
        if (userId && userName && task.id && tenantId) {
            try { await markAsViewed(task.id, tenantId, userId, userName, 'housekeeping'); } catch {}
        }
        if (onView) onView();
    };

    return (
        <div
            onClick={handleClick}
            className={`
                p-3 rounded-xl cursor-pointer transition-all duration-200 
                hover:scale-[1.01] active:scale-[0.99] adora-card border shadow-sm
                ${isUrgent ? 'border-red-500/50 ring-1 ring-red-500/30' : 'adora-border'}
                ${isDelayed ? 'border-orange-500/50 ring-1 ring-orange-500/30' : ''}
            `}
        >
            {/* Row 1: Room + Type + Status */}
            <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" 
                     style={{ background: 'linear-gradient(135deg, var(--theme-accent-cyan) 0%, var(--theme-accent-blue) 100%)' }}>
                    <span className="text-sm font-bold text-white">{task.roomNumber}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                            {typeConfig.label}
                        </span>
                        {isUrgent && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                        {isQR && <QrCode className="w-3 h-3 text-teal-500" />}
                    </div>
                    <p className="text-[10px] adora-text-secondary truncate">{task.guestName || t('common.guest')}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${config.bg} ${config.color}`}>
                        {config.label}
                    </div>
                    <span className="text-[10px] adora-text-disabled">{timeAgo}</span>
                </div>
            </div>

            {/* Row 2: Progress Bar (if in progress) */}
            {task.status === 'IN_PROGRESS' && elapsedTime !== null && (
                <div className="mb-2">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] adora-text-tertiary">{t('common.time')}</span>
                        <span className={`text-[9px] font-bold ${isDelayed ? 'text-orange-500' : 'adora-text-primary'}`}>
                            {elapsedTime}{t('housekeeping.timeAgo.minutes')}
                        </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden adora-bg-tertiary">
                        <div className={`h-full transition-all ${isDelayed ? 'bg-orange-500' : 'bg-blue-500'}`}
                             style={{ width: `${Math.min(100, (elapsedTime / 45) * 100)}%` }} />
                    </div>
                </div>
            )}

            {/* Row 3: Notes (truncated) */}
            {task.notes && (
                <p className="text-[10px] adora-text-secondary line-clamp-1 mb-2 px-2 py-1 rounded adora-bg-tertiary">
                    💬 {task.notes}
                </p>
            )}

            {/* Row 4: Actions */}
            <div className="flex gap-2 pt-2 border-t adora-border">
                {task.status === 'CONFIRMED' && onStart && (
                    <button onClick={(e) => { e.stopPropagation(); onStart(); }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <Play className="w-3 h-3" /> {t('common.start')}
                    </button>
                )}
                {task.status === 'IN_PROGRESS' && onComplete && (
                    <button onClick={(e) => { e.stopPropagation(); onComplete(); }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {t('common.complete')}
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onView?.(); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium adora-bg-tertiary adora-text-secondary ${
                        task.status === 'COMPLETED' ? 'flex-1 justify-center' : ''
                    } flex items-center gap-1`}>
                    <Eye className="w-3 h-3" /> {t('common.details')}
                </button>
            </div>
        </div>
    );
};


// Wrapper for Swipeable Task Card
const SwipeableTaskCard: React.FC<{
    task: CleaningRequest;
    onStart?: () => void;
    onComplete?: () => void;
    onView?: () => void;
    userId?: string;
    tenantId?: string; // ✅ Add tenantId prop
    userName?: string;
    statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }>;
    cleaningTypeConfig: Record<string, { label: string; color: string; bg: string }>;
}> = (props) => {
    const { t } = useTranslation();
    const { task, onStart, onComplete, statusConfig, cleaningTypeConfig } = props;

    // Only enable swipe for actionable states
    const canSwipeComplete = task.status === 'IN_PROGRESS';
    const canSwipeStart = task.status === 'CONFIRMED';

    return (
        <SwipeableRow
            disabled={!canSwipeComplete && !canSwipeStart}
            onSwipeRight={canSwipeComplete ? onComplete : (canSwipeStart ? onStart : undefined)}
            rightLabel={canSwipeComplete ? t('common.complete') : t('common.start')}
            rightColor={canSwipeComplete ? 'bg-green-500' : 'bg-blue-500'}
            rightIcon={canSwipeComplete ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
            // Disable left swipe for now or use for something else
            onSwipeLeft={undefined}
            leftLabel=""
            leftColor="bg-transparent"
        >
            <TaskCard {...props} />
        </SwipeableRow>
    );
};

// Inspection Modal
const InspectionModal: React.FC<{
    isOpen: boolean;
    task: CleaningRequest | null;
    onClose: () => void;
    onSubmit: (result: 'clean' | 'damages' | 'missing_items', notes: string, minibarConsumption?: MinibarConsumption[], photoUrl?: string) => void;
    isSubmitting?: boolean; // ✅ UX: Loading state
    tenantId?: string; // Tenant ID for loading minibar products
}> = ({ isOpen, task, onClose, onSubmit, isSubmitting: externalIsSubmitting = false, tenantId }) => {
    const { t } = useTranslation();
    const [selectedResult, setSelectedResult] = useState<'clean' | 'damages' | 'missing_items' | null>(null);
    const [notes, setNotes] = useState('');
    const [minibarProducts, setMinibarProducts] = useState<MinibarProduct[]>([]);
    const [minibarConsumption, setMinibarConsumption] = useState<Record<string, number>>({});
    const [inspectionPhoto, setInspectionPhoto] = useState<File | null>(null);
    const [inspectionPhotoPreview, setInspectionPhotoPreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);

    // Load minibar products when modal opens
    useEffect(() => {
        if (isOpen && task?.cleaningType === 'checkout') {
            loadMinibarProducts(tenantId).then(products => {
                setMinibarProducts(products);
            });
        } else {
            setMinibarProducts([]);
            setMinibarConsumption({});
        }
    }, [isOpen, task, tenantId]);

    if (!isOpen || !task) return null;

    // Adjust minibar quantity
    const adjustMinibar = (productId: string, delta: number) => {
        setMinibarConsumption(prev => ({
            ...prev,
            [productId]: Math.max(0, (prev[productId] || 0) + delta)
        }));
    };

    // Calculate total
    const minibarTotal = calculateMinibarTotal(minibarConsumption, minibarProducts);

    const handleSubmit = async () => {
        if (!selectedResult || !task) return;

        // ✅ Validate: Photo required for damages and missing_items
        if ((selectedResult === 'damages' || selectedResult === 'missing_items') && !inspectionPhoto) {
                alert(t('housekeeping.photoMustAttach'));
            return;
        }

        // Prepare minibar consumption data
        const consumption: MinibarConsumption[] = minibarProducts
            .filter(p => minibarConsumption[p.id] > 0)
            .map(p => ({
                productId: p.id,
                productName: p.name,
                quantity: minibarConsumption[p.id],
                pricePerUnit: p.price,
                total: minibarConsumption[p.id] * p.price
            }));

        // Upload inspection photo if exists (required for damages/missing_items)
        let photoUrl = '';
        if (inspectionPhoto && (selectedResult === 'damages' || selectedResult === 'missing_items')) {
            setUploading(true);
            try {
                const result = await uploadInspectionPhoto(inspectionPhoto, task.id);
                if (result.success && result.url) {
                    photoUrl = result.url;
                } else {
                    alert(t('housekeeping.photoUploadFailed'));
                    setUploading(false);
                    return;
                }
            } catch (error) {
                alert(t('housekeeping.photoUploadFailed'));
                setUploading(false);
                return;
            }
            setUploading(false);
        }

        // ✅ FIX: Await the async onSubmit before resetting state
        try {
            await onSubmit(
                selectedResult,
                notes,
                consumption.length > 0 ? consumption : undefined,
                photoUrl || undefined
            );
        } catch (err) {
            console.error('Error during inspection submit:', err);
        }

        // Reset state after successful submission
        setSelectedResult(null);
        setNotes('');
        setMinibarConsumption({});
        setInspectionPhoto(null);
        setInspectionPhotoPreview('');
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="adora-modal w-full max-w-md rounded-3xl overflow-hidden">
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                            <Clipboard className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">{t('housekeeping.inspectionTitle')} {task.roomNumber}</h3>
                        <p className="text-white/50 mt-1">{t('housekeeping.selectInspectionResult')}</p>
                    </div>

                    {/* Result Options */}
                    <div className="space-y-3 mb-6">
                        <button
                            onClick={() => setSelectedResult('clean')}
                            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${selectedResult === 'clean'
                                ? 'bg-green-500 text-white'
                                : 'adora-btn-ghost'
                                }`}
                        >
                            <CheckCircle2 className="w-6 h-6" />
                            <div className="text-right">
                                <p className="font-bold">{t('housekeeping.roomComplete')}</p>
                                <p className="text-sm opacity-70">{t('housekeeping.roomReadyDesc')}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setSelectedResult('damages')}
                            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${selectedResult === 'damages'
                                ? 'bg-orange-500 text-white'
                                : 'adora-btn-ghost'
                                }`}
                        >
                            <AlertCircle className="w-6 h-6" />
                            <div className="text-right">
                                <p className="font-bold">{t('housekeeping.roomWithDamage')}</p>
                                <p className="text-sm opacity-70">{t('housekeeping.photoRequiredDesc')}</p>
                            </div>
                        </button>

                        <button
                            onClick={() => setSelectedResult('missing_items')}
                            className={`w-full p-4 rounded-xl flex items-center gap-3 transition-all ${selectedResult === 'missing_items'
                                ? 'bg-red-500 text-white'
                                : 'adora-btn-ghost'
                                }`}
                        >
                            <Package className="w-6 h-6" />
                            <div className="text-right">
                                <p className="font-bold">{t('housekeeping.roomWithLost')}</p>
                                <p className="text-sm opacity-70">{t('housekeeping.photoRequiredDesc')}</p>
                            </div>
                        </button>
                    </div>

                    {/* Notes */}
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={selectedResult === 'damages' || selectedResult === 'missing_items' ? t('housekeeping.damageDescriptionPlaceholder') : t('housekeeping.inspectionNotesPlaceholder')}
                        className="adora-input w-full p-3 rounded-xl resize-none mb-4"
                        rows={3}
                    />

                    {/* Photo Upload (Required for damages/missing_items) */}
                    {(selectedResult === 'damages' || selectedResult === 'missing_items') && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                <Camera className="w-4 h-4" />
                                {selectedResult === 'damages' ? t('housekeeping.damagePhoto') : t('housekeeping.lostPhoto')}
                                <span className="text-red-400 text-xs">{t('housekeeping.required')}</span>
                            </label>
                            <PhotoUpload
                                preview={inspectionPhotoPreview}
                                onPhotoSelect={(file) => {
                                    setInspectionPhoto(file);
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setInspectionPhotoPreview(reader.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                }}
                                onPhotoRemove={() => {
                                    setInspectionPhoto(null);
                                    setInspectionPhotoPreview('');
                                }}
                            />
                        </div>
                    )}

                    {/* Minibar Section (Always available for checkout inspections) */}
                    {(task.cleaningType === 'checkout' || (task as any).serviceType === 'inspection') && minibarProducts.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                                <ShoppingCart className="w-4 h-4" />
                                {t('housekeeping.minibarConsumption')}
                            </label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {minibarProducts.map(product => (
                                    <div key={product.id} className="adora-card flex items-center justify-between p-3 rounded-xl">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-white">{product.name}</p>
                                            <p className="text-xs text-white/60">{product.price} {t('common.rs')}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => adjustMinibar(product.id, -1)}
                                                className="adora-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                disabled={!minibarConsumption[product.id]}
                                            >
                                                -
                                            </button>
                                            <span className="text-lg font-bold text-white min-w-[2rem] text-center">
                                                {minibarConsumption[product.id] || 0}
                                            </span>
                                            <button
                                                onClick={() => adjustMinibar(product.id, 1)}
                                                className="adora-btn-ghost w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {minibarTotal > 0 && (
                                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-primary-500/20 border border-green-500/30">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-white/80">{t('common.total')}:</span>
                                        <span className="text-lg font-bold text-green-400">{minibarTotal} {t('common.rs')}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="adora-btn-ghost flex-1 py-3 rounded-xl font-medium transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedResult || uploading || ((selectedResult === 'damages' || selectedResult === 'missing_items') && !inspectionPhoto)}
                            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <AdoraLoaderInline size={20} />
                                    {t('common.uploading')}
                                </>
                            ) : (
                                t('housekeeping.confirmInspection')
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// START CLEANING MODAL - With Room Assignment Grid
// ============================================================

interface StartCleaningModalProps {
    isOpen: boolean;
    task: CleaningRequest | null;
    onClose: () => void;
    onSubmit: (data: {
        cleaningType: 'occupied' | 'checkout';
        guestStatus: 'in' | 'out';
        roomAssignments: Record<string, { id: string; name: string }>;
    }) => Promise<void> | void;
    teamMembers: Array<{ id: string; name: string }>;
}

const StartCleaningModal: React.FC<StartCleaningModalProps> = ({
    isOpen, task, onClose, onSubmit, teamMembers
}) => {
    const { t } = useTranslation();
    const [cleaningType, setCleaningType] = useState<'occupied' | 'checkout'>('occupied');
    const [guestStatus, setGuestStatus] = useState<'in' | 'out'>('out');
    const [roomAssignments, setRoomAssignments] = useState<Record<string, { id: string; name: string }>>({});
    const [selectingRoom, setSelectingRoom] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Room sections
    const roomSections = useMemo(() => [
        { id: 'bedroom1', name: t('housekeeping.roomSections.bedroom1'), icon: '🛏️' },
        { id: 'bedroom2', name: t('housekeeping.roomSections.bedroom2'), icon: '🛏️' },
        { id: 'living', name: t('housekeeping.roomSections.living'), icon: '🛋️' },
        { id: 'kitchen', name: t('housekeeping.roomSections.kitchen'), icon: '🍳' },
        { id: 'bathroom', name: t('housekeeping.roomSections.bathroom'), icon: '🚿' }
    ], [t]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setCleaningType('occupied');
            setGuestStatus('out');
            setRoomAssignments({});
            setSelectingRoom(null);
        }
    }, [isOpen]);

    const assignEmployee = (employeeId: string, employeeName: string) => {
        if (selectingRoom) {
            setRoomAssignments(prev => ({
                ...prev,
                [selectingRoom]: { id: employeeId, name: employeeName }
            }));
            setSelectingRoom(null);
        }
    };

    const handleSubmit = () => {
        onSubmit({ cleaningType, guestStatus, roomAssignments });
    };

    if (!isOpen || !task) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" style={{ backdropFilter: 'none' }}>
            <div className="glass rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                        🧹 {t('housekeeping.startCleaningForRoom', { room: task.roomNumber })}
                    </h3>
                    <button onClick={onClose} className="text-white/50 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Cleaning type and guest status */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Cleaning Type */}
                        <div>
                            <label className="text-sm text-white/60 mb-2 block">{t('housekeeping.cleaningTypeLabel')}</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCleaningType('occupied')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-1 transition-all ${cleaningType === 'occupied'
                                        ? 'bg-blue-500/30 border border-blue-500/50 text-blue-400'
                                        : 'adora-btn-ghost'
                                        }`}
                                >
                                    🏠 {t('housekeeping.filterOccupied')}
                                </button>
                                <button
                                    onClick={() => setCleaningType('checkout')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-1 transition-all ${cleaningType === 'checkout'
                                        ? 'bg-orange-500/30 border border-orange-500/50 text-orange-400'
                                        : 'adora-btn-ghost'
                                        }`}
                                >
                                    🚪 {t('housekeeping.filterCheckout')}
                                </button>
                            </div>
                        </div>

                        {/* Guest Status */}
                        <div>
                            <label className="text-sm text-white/60 mb-2 block">{t('housekeeping.guestStatus')}</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setGuestStatus('out')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-1 transition-all ${guestStatus === 'out'
                                        ? 'bg-green-500/30 border border-green-500/50 text-green-400'
                                        : 'adora-btn-ghost'
                                        }`}
                                >
                                    🚶 {t('housekeeping.guestOut')}
                                </button>
                                <button
                                    onClick={() => setGuestStatus('in')}
                                    className={`flex-1 py-2 px-3 rounded-xl text-sm flex items-center justify-center gap-1 transition-all ${guestStatus === 'in'
                                        ? 'bg-yellow-500/30 border border-yellow-500/50 text-yellow-400'
                                        : 'adora-btn-ghost'
                                        }`}
                                >
                                    🏠 {t('housekeeping.guestIn')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Room Assignment Grid */}
                    <div>
                        <label className="text-sm text-white/60 mb-2 block">{t('housekeeping.roomAssignment')}</label>
                        <div className="grid grid-cols-5 gap-2">
                            {roomSections.map(section => (
                                <button
                                    key={section.id}
                                    onClick={() => setSelectingRoom(section.id)}
                                    className={`p-2 rounded-xl text-center transition-all ${roomAssignments[section.id]
                                        ? 'bg-green-500/20 border border-green-500/50'
                                        : selectingRoom === section.id
                                            ? 'bg-blue-500/30 border border-blue-500/50'
                                            : 'adora-card border hover:opacity-80'
                                        }`}
                                >
                                    <span className="text-lg">{section.icon}</span>
                                    <p className="text-[10px] text-white/80 mt-0.5">{section.name}</p>
                                    {roomAssignments[section.id] ? (
                                        <p className="text-[9px] text-green-400 mt-0.5 truncate">
                                            ✓ {roomAssignments[section.id].name.split(' ')[0]}
                                        </p>
                                    ) : (
                                        <p className="text-[9px] adora-text-tertiary mt-0.5">{t('common.select')}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Employee Selection (when selecting a room) */}
                    {selectingRoom && (
                        <div className="adora-card rounded-xl p-3">
                            <p className="text-sm adora-text-secondary mb-2">
                                {t('housekeeping.selectEmployeeForRoom', { room: roomSections.find(s => s.id === selectingRoom)?.name || '' })}:
                            </p>
                            {teamMembers.length === 0 ? (
                                <div className="text-center py-4 adora-text-secondary">
                                    <p className="text-sm mb-2">{t('housekeeping.noTeamSaved')}</p>
                                    <p className="text-xs adora-text-tertiary">{t('housekeeping.addTeamFromHeader')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                                    {teamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            onClick={() => assignEmployee(member.id, member.name)}
                                            className="adora-card p-1.5 rounded-lg text-xs hover:opacity-80 transition-all flex flex-col items-center gap-1 text-center"
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                <User className="w-4 h-4 adora-text-secondary" />
                                            </div>
                                            <span className="truncate w-full">{member.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setSelectingRoom(null)}
                                className="mt-2 text-xs adora-text-tertiary hover:opacity-70"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="adora-btn-ghost flex-1 py-3 rounded-xl transition-all"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={async () => {
                            if (isSubmitting) return;
                            setIsSubmitting(true);
                            try {
                                await onSubmit({ cleaningType, guestStatus, roomAssignments });
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        disabled={isSubmitting}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                {t('housekeeping.startCleaningNote')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================================
// MAIN COMPONENT

// ============================================================

export const HousekeepingDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const tenantContext = useTenant();
    const tenantId = tenantContext.tenantId;
    const { success, error, haptic, playSound } = useUX();
    const { t } = useTranslation();
    const brandName = useBrandName();

    // State
    const [tasks, setTasks] = useState<CleaningRequest[]>([]);
    const [loading, setLoading] = useState(true);
    // ✅ UX: Loading state for inspection submission
    const { isLoading: isSubmitting, execute } = useLoadingState();
    // ✅ UX: Undo state for status changes
    const [undoState, setUndoState] = useState<{
        show: boolean;
        message: string;
        onUndo: () => void;
    } | null>(null);
    const [currentTab, setCurrentTab] = useState<TabType>('new');
    const [roomFilter, setRoomFilter] = useState<RoomFilter>('all');
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing Housekeeping page now');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);
    const [showShiftNotes, setShowShiftNotes] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false);
    const [showLaundryInventory, setShowLaundryInventory] = useState(false);
    const [showTeam, setShowTeam] = useState(false);
    const [showTeamManager, setShowTeamManager] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
    const [showSupportTicket, setShowSupportTicket] = useState(false); // ✅ Support ticket modal
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('housekeeping');
    
    const [inspectionTask, setInspectionTask] = useState<CleaningRequest | null>(null);

    // ✅ STATUS_CONFIG and CLEANING_TYPE_CONFIG using t()
    const STATUS_CONFIG = useMemo(() => ({
        CONFIRMED: { label: t('housekeeping.statusLabels.confirmed'), color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertCircle },
        IN_PROGRESS: { label: t('housekeeping.statusLabels.inProgress'), color: 'text-blue-400', bg: 'bg-blue-500/20', icon: Play },
        COMPLETED: { label: t('housekeeping.statusLabels.completed'), color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle2 },
        NEEDS_INSPECTION: { label: t('housekeeping.statusLabels.needsInspection'), color: 'text-purple-400', bg: 'bg-purple-500/20', icon: Eye }
    }), [t]);

    const CLEANING_TYPE_CONFIG = useMemo(() => ({
        occupied: { label: t('housekeeping.cleaningTypes.occupied'), color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
        checkout: { label: t('housekeeping.cleaningTypes.checkout'), color: 'text-orange-400', bg: 'bg-orange-500/20' },
        post_inspection: { label: t('housekeeping.cleaningTypes.postInspection'), color: 'text-purple-400', bg: 'bg-purple-500/20' },
        maintenance_check: { label: t('housekeeping.cleaningTypes.maintenanceCheck'), color: 'text-red-400', bg: 'bg-red-500/20' },
        undefined: { label: t('housekeeping.cleaningTypes.maintenanceCheck'), color: 'text-red-400', bg: 'bg-red-500/20' }
    }), [t]);
    const [roomHistoryRoom, setRoomHistoryRoom] = useState<string | null>(null);
    const [startCleaningTask, setStartCleaningTask] = useState<CleaningRequest | null>(null);
    const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([]);
    // Floor filter (0 = all floors)
    const [floorFilter, setFloorFilter] = useState<number>(0);
    
    // ✅ Points Notification State
    const [activeNotifications, setActiveNotifications] = useState<Set<string>>(new Set());
    const [notificationTask, setNotificationTask] = useState<CleaningRequest | null>(null);
    
    // ✅ Branch Location Warning State
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    const [locationWarningData, setLocationWarningData] = useState<any>(null);

    // ✅ Read tab from URL query (?tab=assigned|in_progress|completed)
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { useSearchParams } = require('react-router-dom');
        const [searchParams] = useSearchParams();
        useEffect(() => {
            const tab = (searchParams.get('tab') || '').toLowerCase();
            if (tab === 'new' || tab === 'in_progress' || tab === 'completed') {
                setCurrentTab(tab as TabType);
            }
        }, [searchParams]);
    } catch {}


    // ✅ FIX: Use branchId from AuthContext (updates when manager switches branches)
    const { branchId: authBranchId } = useAuth();
    const branchId = authBranchId || (user as any)?.branchId || (user as any)?.branch;

    // ✅ Check branch location on mount and branch change
    useEffect(() => {
        const checkLocation = async () => {
            if (!tenantId || !branchId || !user?.branches) return;
            
            try {
                const check = await checkBranchLocation(
                    tenantId,
                    branchId,
                    user.branches
                );
                
                if (!check.isAtBranch) {
                    setLocationWarningData(check);
                    setShowLocationWarning(true);
                }
            } catch (err) {
                console.error('Location check error:', err);
                // Fail open - allow access
            }
        };
        
        checkLocation();
    }, [tenantId, branchId, user?.branches]);

    // ============================================================
    // VOICE AGENT INTEGRATION
    // ============================================================
    const {
        isActive: isAgentActive,
        status: agentStatus,
        transcript,
        feedback,
        processCommand,
        // 🛡️ Error Recovery
        errorCount,
        isFallbackMode,
        lastError,
        retryLastCommand,
        resetErrors
    } = useSmartAgent({
        context: 'housekeeping',
        schema: {
            action: "UPDATE_STATUS",
            description: "Update room status, cleaning state, or record laundry inventory",
            properties: {
                // UPDATE_STATUS params
                roomId: { type: "string", description: "The room number or ID" },
                status: { type: "string", enum: ["start", "complete", "approve"], description: "The action to perform" },
                // RECORD_LAUNDRY_INVENTORY params
                items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            itemId: { type: "string" },
                            itemName: { type: "string" },
                            count: { type: "number" }
                        }
                    }
                }
            }
        },
        onSuccess: async (action, params) => {
            console.log("AI Action Success (Housekeeping):", action, params);
            haptic('success');

            if (action === 'UPDATE_STATUS') {
                const targetTask = tasks.find(t => t.roomNumber === params.roomId);
                if (!targetTask) {
                    error(t('housekeeping.taskNotFound', { room: params.roomId }));
                    return;
                }

                if (params.status === 'start') {
                    // Direct start if possible, or open modal
                    setStartCleaningTask(targetTask);
                } else if (params.status === 'complete') {
                    await handleCompleteCleaning(targetTask.id);
                } else if (params.status === 'approve' && targetTask.status === 'NEEDS_INSPECTION') {
                    setInspectionTask(targetTask);
                    // AI could also auto-approve if we trust it, but modal is safer for now
                    // For now, let's just open the modal to let user confirm
                }
            } else if (action === 'RECORD_LAUNDRY_INVENTORY') {
                // This would normally call a laundry service
                success(t('housekeeping.laundryInventoryRecorded'));
            }
        }
    });

    // Grouped tasks - filter to show only housekeeping requests
    const groupedTasks = useMemo(() => {
        const now = new Date();
        
        // ✅ Helper: Check if scheduled request should be shown (only if scheduledDate <= now)
        const isScheduledRequestVisible = (t: any): boolean => {
            const scheduledDateTime = t.scheduledDate || t.scheduledAt;
            if (!scheduledDateTime) return true; // Not scheduled - always visible
            
            const scheduledTime = scheduledDateTime?.toDate?.() || new Date(scheduledDateTime);
            // Show only if scheduled time has passed (including now)
            return scheduledTime <= now;
        };
        
        // Filter to only show requests visible to housekeeping
        const visibleTasks = tasks.filter(t => {
            // ✅ Scheduled requests: Show only if scheduledDate <= now
            if (!isScheduledRequestVisible(t)) return false;
            
            // Show if currently owned by housekeeping
            if (t.currentDepartment === 'housekeeping') return true;

            // For legacy requests without currentDepartment, show all cleaning/inspection
            if (!t.currentDepartment) return true;

            return false;
        });

        let filtered = [...visibleTasks];

        // Apply room filter
        if (roomFilter !== 'all') {
            filtered = filtered.filter(t => t.cleaningType === roomFilter);
        }

        // Apply floor filter
        if (floorFilter > 0) {
            filtered = filtered.filter(t => {
                // Extract floor from room number (e.g., 201 -> 2, 105 -> 1)
                const roomNum = parseInt(t.roomNumber || '0');
                const floor = Math.floor(roomNum / 100);
                return floor === floorFilter;
            });
        }

        const newTasks = filtered.filter(t => t.status === 'CONFIRMED');
        const inProgress = filtered.filter(t => t.status === 'IN_PROGRESS' || t.status === 'NEEDS_INSPECTION');
        const completed = filtered.filter(t => t.status === 'COMPLETED');

        return { new: newTasks, inProgress, completed };
    }, [tasks, roomFilter, floorFilter]);

    // Current list
    const currentTasks = useMemo(() => {
        switch (currentTab) {
            case 'new': return groupedTasks.new;
            case 'in_progress': return groupedTasks.inProgress;
            case 'completed': return groupedTasks.completed;
            default: return [];
        }
    }, [currentTab, groupedTasks]);

    // ✅ Show Points Notification for new CONFIRMED tasks
    useEffect(() => {
        // Find first CONFIRMED task that hasn't been notified yet
        const firstConfirmed = groupedTasks.new.find(
            task => task.status === 'CONFIRMED' && !activeNotifications.has(task.id)
        );

        if (firstConfirmed && tenantId) {
            // Mark as notified
            setActiveNotifications(prev => new Set(prev).add(firstConfirmed.id));
            // Show notification
            setNotificationTask(firstConfirmed);
            
            // Auto-dismiss after 3 seconds
            const timer = setTimeout(() => {
                setNotificationTask(null);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [groupedTasks.new, activeNotifications, tenantId]);

    // Calculate available floors dynamically from tasks
    const availableFloors = useMemo(() => {
        const floors = new Set<number>([0]); // Always include 0 (All)
        tasks.forEach(t => {
            const roomNum = parseInt(t.roomNumber || '0');
            if (!isNaN(roomNum) && roomNum > 0) {
                floors.add(Math.floor(roomNum / 100));
            }
        });
        return Array.from(floors).sort((a, b) => a - b);
    }, [tasks]);

    // ============================================================
    // DATA LOADING
    // ============================================================

    // ✅ Load team members on mount (persistent for the shift)
    useEffect(() => {
        const loadTeam = async () => {
            try {
                const docRef = doc(db, 'settings', 'housekeeping');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().teamMembers) {
                    const members = docSnap.data().teamMembers;
                    setTeamMembers(members);
                } else {
                    // Fallback to current user if list is empty
                    setTeamMembers([{ id: user?.id || '', name: user?.name || t('common.me') }]);
                }
            } catch (e) {
                console.error('Error loading team settings:', e);
                // Fallback to current user
                setTeamMembers([{ id: user?.id || '', name: user?.name || t('common.me') }]);
            }
        };
        loadTeam();
    }, [user]);

    useEffect(() => {
        if (!user || !branchId) return;

        // ✅ FIX: Use tenant-scoped collection (tenants/${tenantId}/requests)
        if (!tenantId) {
            console.warn('⚠️ [HousekeepingDashboard] Cannot subscribe to requests: tenantId is missing');
            setLoading(false);
            return;
        }
        
        const requestsRef = collection(db, `tenants/${tenantId}/requests`);
        // ✅ FIX: Remove orderBy with 'in' query (requires composite index)
        // We'll sort manually after fetching
        const constraints = [
            where('branch', '==', branchId),
            where('type', 'in', ['cleaning', 'inspection', 'maintenance'])
        ];

        const q = query(requestsRef, ...constraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedTasks: CleaningRequest[] = [];
            snapshot.forEach(doc => {
                loadedTasks.push({ id: doc.id, ...doc.data() } as CleaningRequest);
            });
            // ✅ Manual sorting by createdAt (descending)
            loadedTasks.sort((a, b) => {
                const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
                const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
                return bTime - aTime;
            });
            setTasks(loadedTasks);
            setLoading(false);
        }, (error: any) => {
            // ✅ Error handling - Log technical details but don't show Request ID to user
            console.error('Error loading housekeeping tasks:', {
                code: error?.code,
                message: error?.message?.replace(/Request ID: [a-f0-9-]+/gi, ''),
                stack: error?.stack
            });
            // Don't show Firebase Request ID to user - it's technical info
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, branchId]);

    // ============================================================
    // ACTIONS
    // ============================================================

    // ⭐ Open Start Cleaning Modal (instead of direct start)
    // ✅ Team members are already loaded on mount, no need to reload
    const openStartCleaningModal = (task: CleaningRequest) => {
        setStartCleaningTask(task);
    };

    // ⭐ Handle Start Cleaning Submit (from Modal)
    const handleStartCleaningSubmit = async (data: {
        cleaningType: 'occupied' | 'checkout';
        guestStatus: 'in' | 'out';
        roomAssignments: Record<string, { id: string; name: string }>;
    }) => {
        if (!startCleaningTask) return;

        // ✅ MANDATORY: Check if at least one room assigned (or main assignment exists)
        // Since we are starting the task, we must assign at least the main room
        const currentAssignment = data.roomAssignments[startCleaningTask.roomNumber];
        if (!currentAssignment && Object.keys(data.roomAssignments).length === 0) {
            alert(t('housekeeping.assignEmployeeRequired'));
            throw new Error('Assignment required');
        }

        try {
            const now = Timestamp.now();
            await updateDoc(doc(db, 'requests', startCleaningTask.id), {
                status: 'IN_PROGRESS',
                startedAt: now,
                cleaningType: data.cleaningType,
                guestStatus: data.guestStatus,
                roomAssignments: data.roomAssignments,
                assignedTo: { id: user?.id, name: user?.name },
                
                // ✅ Workflow: Update status and add journey entry
                'workflow.workflowStatus': 'IN_PROGRESS',
                'workflow.startedAt': now,
                'workflow.journey': arrayUnion({
                    department: 'housekeeping',
                    action: 'started',
                    timestamp: now,
                    userId: user?.id || '',
                    userName: user?.name || '',
                    notes: t('housekeeping.startCleaningNote')
                })
            });

            // Award points for starting - Non-blocking
            if (user?.id) {
                try {
                    await awardPoints('default', user.id, 2, t('housekeeping.startTask'));
                } catch (e) {
                    console.warn('Failed to award points:', e);
                }
            }

            haptic('success');
            playSound('notification');
            setStartCleaningTask(null);
        } catch (error: any) {
            console.error('Error starting cleaning:', {
                code: error?.code,
                message: error?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || error?.message
            });
            haptic('error');
        }
    };


    const handleCompleteCleaning = async (taskId: string) => {
        try {
            const task = tasks.find(t => t.id === taskId);
            const now = Timestamp.now();

            // If checkout room, needs inspection
            if (task?.cleaningType === 'checkout') {
                await updateDoc(doc(db, 'requests', taskId), {
                    status: 'NEEDS_INSPECTION',
                    completedAt: now
                });
            } else if (task?.cleaningType === 'post_inspection') {
                // ⭐ Post-inspection cleaning → needs RE-inspection to check for maintenance
                setInspectionTask(task);
            } else {
                // Occupied room - complete directly, return to reception
                await updateDoc(doc(db, 'requests', taskId), {
                    status: 'COMPLETED',
                    completedAt: now,
                    currentDepartment: 'reception', // Return to reception
                    
                    // ✅ Workflow: Complete and return to origin
                    'workflow.workflowStatus': 'COMPLETED',
                    'workflow.completedAt': now,
                    'workflow.returnedAt': now,
                    'workflow.currentHolder': 'reception',
                    'workflow.isLocked': false,
                    'workflow.lockedBy': null,
                    'workflow.journey': arrayUnion({
                        department: 'housekeeping',
                        action: 'completed',
                        timestamp: now,
                        userId: user?.id || '',
                        userName: user?.name || '',
                        notes: t('housekeeping.cleaningCompletedNote')
                    }, {
                        department: 'housekeeping',
                        action: 'returned',
                        timestamp: now,
                        userId: user?.id || '',
                        userName: user?.name || '',
                        notes: t('housekeeping.returnedToReceptionNote')
                    })
                });
            }

            // Award points for completion - Dynamic based on time
            if (user?.id) {
                try {
                    const startTime = task?.startedAt || task?.createdAt;
                    const startMs = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
                    const durationMinutes = Math.floor((Date.now() - startMs) / (1000 * 60));

                    const actionKey = task?.cleaningType === 'checkout' ? 'completeCheckout' : 'completeOccupied';

                    await awardPerformancePoints(
                        tenantId || 'default',
                        user.id,
                        'housekeeping',
                        actionKey,
                        durationMinutes
                    );
                } catch (e) {
                    console.warn('Failed to award completion points:', e);
                }
            }

            success(t('housekeeping.cleaningCompletedSuccess'));
        } catch (err: any) {
            console.error('Error completing cleaning:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(t('housekeeping.cleaningCompletedFailed'));
        }
    };

    // ⭐ Team Assignment
    const handleAssignTask = async (taskId: string, employeeId: string, employeeName: string) => {
        try {
            await updateDoc(doc(db, 'requests', taskId), {
                assignedTo: { id: employeeId, name: employeeName },
                assignedAt: Timestamp.now()
            });

            success(t('housekeeping.taskAssignedSuccess'));
        } catch (err: any) {
            console.error('Error assigning task:', {
                code: err?.code,
                message: err?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || err?.message
            });
            error(t('housekeeping.taskAssignedFailed'));
        }
    };

    const handleInspectionSubmit = async (
        result: 'clean' | 'damages' | 'missing_items',
        notes: string,
        minibarConsumption?: MinibarConsumption[],
        photoUrl?: string
    ) => {
        if (!inspectionTask) return;

        // ✅ UX: Save previous state for undo
        const previousState = {
            status: inspectionTask.status,
            inspectionResult: inspectionTask.inspectionResult,
            roomNumber: inspectionTask.roomNumber
        };

        // ✅ UX: Execute with loading state
        const executionResult = await execute(
            async () => {
                const taskRef = doc(db, 'requests', inspectionTask.id);

                // Calculate minibar total
                const minibarTotal = minibarConsumption?.reduce((sum, item) => sum + item.total, 0) || 0;

                // ⭐ Check if this is a RE-INSPECTION (after post-inspection cleaning)
                if (inspectionTask.cleaningType === 'post_inspection') {
                    // ... (Existing post_inspection logic) ...
                }

                // ⭐ Check if this is a MAINTENANCE VERIFICATION
                // Tasks coming from maintenance have type='maintenance' and status='NEEDS_INSPECTION' and maintenanceCompleted=true
                if (inspectionTask.type === 'maintenance' && (inspectionTask as any).maintenanceCompleted === true && inspectionTask.status === 'NEEDS_INSPECTION') {
                    // ✅ Import transferRequestToDepartment for proper tracking
                    const { transferRequestToDepartment } = await import('../../services/requestService');

                    if (result === 'clean') {
                        // ✅ Approve: Maintenance is good -> Send to Reception as COMPLETED
                        await transferRequestToDepartment(
                            inspectionTask.id,
                            'housekeeping',
                            'reception',
                            user?.id || '',
                            user?.name || '',
                            'COMPLETED' as any,
                            t('housekeeping.maintenanceApprovedNoteWithNotes', { notes: notes || t('common.noDescription') })
                        );

                        await updateDoc(taskRef, {
                            status: 'COMPLETED',
                            completedAt: Timestamp.now(),
                            inspectionResult: 'clean',
                            inspectionNotes: notes || null,
                            inspectedBy: { id: user?.id || '', name: user?.name || '' },
                            minibarConsumption: minibarConsumption || [],
                            minibarTotal: minibarConsumption?.reduce((sum, item) => sum + item.total, 0) || 0
                        });

                        // Update Room Status to ready
                        await updateRoomStatus(tenantId, branchId, inspectionTask.roomNumber, 'ready' as any);

                        success(t('housekeeping.maintenanceApprovedSent'));
                    } else if (result === 'damages' || result === 'missing_items') {
                        // ❌ Reject: Maintenance has issues -> Send back to Maintenance with photo and notes
                        await transferRequestToDepartment(
                            inspectionTask.id,
                            'housekeeping',
                            'maintenance',
                            user?.id || '',
                            user?.name || '',
                            'IN_PROGRESS' as any,
                            t('housekeeping.maintenanceRejectedNoteWithReason', { reason: notes || t('housekeeping.damagesInRoom') })
                        );

                        await updateDoc(taskRef, {
                            status: 'IN_PROGRESS', // Active again
                            priority: 'urgent', // Escalate
                            inspectionResult: result, // 'damages' or 'missing_items'
                            inspectionNotes: notes || null,
                            inspectionPhoto: photoUrl || null, // ✅ Photo from inspection
                            inspectedBy: { id: user?.id || '', name: user?.name || '' },
                            maintenanceCompleted: false, // Re-open
                            rejectionReason: notes || null,
                            rejectedBy: { id: user?.id || '', name: user?.name || '' }
                        });

                        // Room stays in maintenance status
                        await updateRoomStatus(tenantId, branchId, inspectionTask.roomNumber, 'maintenance' as any);

                        error(t('housekeeping.maintenanceRejectedReturned'));
                    }

                    setInspectionTask(null);
                    return;
                }

                // ⭐ Check if this is a RE-INSPECTION (after post-inspection cleaning)
                if (inspectionTask.cleaningType === 'post_inspection') {
                    if (result === 'clean') {
                        // ✅ Room is ready - complete cleaning and set room to READY
                        await updateDoc(taskRef, {
                            status: 'COMPLETED',
                            completedAt: Timestamp.now(),
                            reInspectionResult: result,
                            reInspectionNotes: notes,
                            currentDepartment: 'reception'
                        });

                        // ⭐ Update room status to READY
                        await updateRoomStatus(tenantId, branchId, inspectionTask.roomNumber, 'ready' as any);

                        // Award bonus points (updates both personal and team points)
                        if (user?.id) {
                            await awardPoints('default', user.id, 15, t('housekeeping.cleanInspectionPoints'));
                        }
                    } else if (result === 'needs_maintenance') {
                        // 🔄 Needs maintenance → create maintenance request and LOOP
                        await addDoc(collection(db, 'requests'), {
                            type: 'maintenance',
                            roomNumber: inspectionTask.roomNumber,
                            status: 'CONFIRMED',
                            notes: notes,
                            damagePhoto: photoUrl || null,
                            priority: 'urgent' as const,
                            currentDepartment: 'maintenance',
                            originDepartment: 'housekeeping',
                            createdAt: Timestamp.now(),
                            createdBy: { id: user?.id, name: user?.name },
                            linkedCleaningId: inspectionTask.id,
                            requiresReinspection: true, // ⭐ Flag for loop
                            tenantId: tenantId // ✅ Add tenantId
                        });
                        
                        // ✅ FIX: Auto-check daily attendance when employee creates a request
                        if (tenantId && user?.id) {
                            try {
                                const { checkDailyAttendance } = await import('../../services/challengeService');
                                checkDailyAttendance(tenantId, user.id).catch(err => {
                                    console.warn('Failed to check daily attendance:', err);
                                });
                            } catch (err) {
                                console.warn('Could not load challengeService:', err);
                            }
                        }

                        // Mark cleaning as waiting for maintenance
                        await updateDoc(taskRef, {
                            status: 'IN_PROGRESS', // Keep it active
                            reInspectionResult: result,
                            reInspectionNotes: notes,
                            damagePhoto: photoUrl || null,
                            currentDepartment: 'maintenance', // Transfer to maintenance
                            waitingForMaintenance: true
                        });

                        // Room stays in maintenance status
                        await updateRoomStatus(tenantId, branchId, inspectionTask.roomNumber, 'maintenance' as any);
                    }

                    setInspectionTask(null);
                    success(t('housekeeping.inspectionSuccess'));
                    return;
                }

                // ✅ FIX #2: Deduct minibar consumption from inventory
                if (minibarConsumption && minibarConsumption.length > 0) {
                    try {
                        const { findInventoryItemByName, updateItemQuantity } = await import('../../services/inventoryService');
                        const branchId = (user as any)?.branch || 'default';

                        for (const consumedItem of minibarConsumption) {
                            if (consumedItem.quantity > 0) {
                                const inventoryItem = await findInventoryItemByName(consumedItem.productName, branchId);

                                if (inventoryItem) {
                                    await updateItemQuantity(
                                        inventoryItem.id,
                                        consumedItem.quantity,
                                        'out',
                                        t('housekeeping.minibarConsumptionNote', { room: inspectionTask.roomNumber }),
                                        user?.id || '',
                                        user?.name || '',
                                        branchId,
                                        undefined,
                                        t('housekeeping.productNote', { product: consumedItem.productName }),
                                        tenantId || undefined // ✅ Pass tenantId
                                    );
                                    console.log(`✅ Deducted inventory: ${consumedItem.productName} -${consumedItem.quantity}`);
                                } else {
                                    console.warn(`⚠️ Inventory item "${consumedItem.productName}" not found. Minibar consumption recorded but inventory not updated.`);
                                }
                            }
                        }
                    } catch (error: any) {
                        // Don't fail inspection if inventory update fails - log and continue
                        console.error('Error updating inventory for minibar consumption:', {
                            code: error?.code,
                            message: error?.message?.replace(/Request ID: [a-f0-9-]+/gi, '') || error?.message
                        });
                    }
                }

                // ⭐ NEW INSPECTION LOGIC (checkout inspection)
                // All results return to reception after inspection
                
                if (result === 'clean') {
                    // ✅ Room is ready - return to reception
                    await updateDoc(taskRef, {
                        status: 'COMPLETED',
                        completedAt: Timestamp.now(),
                        inspectionResult: 'clean',
                        inspectionNotes: notes,
                        inspectedBy: { id: user?.id || '', name: user?.name || '' },
                        minibarConsumption: minibarConsumption || [],
                        minibarTotal: minibarConsumption?.reduce((sum, item) => sum + item.total, 0) || 0,
                        currentDepartment: 'reception' // Always return to reception
                    });

                    // Award bonus points
                    if (user?.id) {
                        try {
                            const startTime = inspectionTask.startedAt || inspectionTask.createdAt;
                            const startMs = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
                            const durationMinutes = Math.floor((Date.now() - startMs) / (1000 * 60));

                            await awardPerformancePoints(
                                tenantId || 'default',
                                user.id,
                                'housekeeping',
                                'inspection',
                                durationMinutes
                            );
                        } catch (e) {
                            console.warn('Failed to award inspection points:', e);
                        }
                    }
                } else if (result === 'damages') {
                    // ✅ Room has damages - return to reception with photo and notes
                    await updateDoc(taskRef, {
                        status: 'COMPLETED',
                        completedAt: Timestamp.now(),
                        inspectionResult: 'damages',
                        inspectionNotes: notes,
                        inspectedBy: { id: user?.id || '', name: user?.name || '' },
                        inspectionPhoto: photoUrl, // ⭐ Photo of damages
                        minibarConsumption: minibarConsumption || [],
                        minibarTotal: minibarConsumption?.reduce((sum, item) => sum + item.total, 0) || 0,
                        currentDepartment: 'reception' // Return to reception
                    });

                    // Award points
                    if (user?.id) {
                        try {
                            const startTime = inspectionTask.startedAt || inspectionTask.createdAt;
                            const startMs = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
                            const durationMinutes = Math.floor((Date.now() - startMs) / (1000 * 60));

                            await awardPerformancePoints(
                                tenantId || 'default',
                                user.id,
                                'housekeeping',
                                'inspection',
                                durationMinutes
                            );
                        } catch (e) {
                            console.warn('Failed to award inspection points:', e);
                        }
                    }
                } else if (result === 'missing_items') {
                    // ✅ Room has missing items - create a "Lost Items" card in Reception
                    // This card will have a button to "Archive" (transfer to Lost & Found)
                    await updateDoc(taskRef, {
                        status: 'COMPLETED',
                        completedAt: Timestamp.now(),
                        inspectionResult: 'missing_items',
                        inspectionNotes: notes,
                        inspectedBy: { id: user?.id || '', name: user?.name || '' },
                        inspectionPhoto: photoUrl, // ⭐ Photo of missing items
                        minibarConsumption: minibarConsumption || [],
                        minibarTotal: minibarConsumption?.reduce((sum, item) => sum + item.total, 0) || 0,
                        currentDepartment: 'reception', // Return to reception
                        isLostItemsCard: true, // ✅ Flag to identify as "Lost Items" card
                        lostItemsStatus: 'open' // ✅ Status: 'open' (in reception) | 'archived' (in Lost & Found)
                    });

                    // ✅ Create Live Feed entry for dashboard
                    try {
                        await addDoc(collection(db, 'live_feed'), {
                            type: 'missing_items_found',
                            branchId: branchId,
                            tenantId: tenantId,
                            roomNumber: inspectionTask.roomNumber,
                            description: t('housekeeping.roomInspectedWithMissingItems', { room: inspectionTask.roomNumber, notes: notes || t('housekeeping.noDescription') }),
                            photoUrl: photoUrl || null,
                            foundBy: { id: user?.id || '', name: user?.name || '' },
                            inspectedBy: { id: user?.id || '', name: user?.name || '' },
                            createdAt: Timestamp.now(),
                            status: 'open',
                            requestId: inspectionTask.id // Link to original request
                        });
                    } catch (e) {
                        console.warn('Failed to create live feed entry:', e);
                    }

                    // Award points
                    if (user?.id) {
                        try {
                            const startTime = inspectionTask.startedAt || inspectionTask.createdAt;
                            const startMs = startTime?.toDate ? startTime.toDate().getTime() : new Date(startTime).getTime();
                            const durationMinutes = Math.floor((Date.now() - startMs) / (1000 * 60));

                            await awardPerformancePoints(
                                tenantId || 'default',
                                user.id,
                                'housekeeping',
                                'inspection',
                                durationMinutes
                            );
                        } catch (e) {
                            console.warn('Failed to award inspection points:', e);
                        }
                    }
                }

                setInspectionTask(null);


                // 👻 GHOST MODE: Smart Speed Detection
                if (result === 'clean' && inspectionTask.startedAt) {
                    const startTime = inspectionTask.startedAt.toDate();
                    const endTime = new Date();
                    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

                    if (durationMinutes < 10) { // Threshold: 10 minutes
                        // Don't block, just WARN (Advisory)
                        try {
                            await addDoc(collection(db, 'smart_alerts'), {
                                type: 'ghost_anomaly',
                                branchId: (user as any)?.branchId || 'default',
                                tenantId: tenantId,
                                roomId: inspectionTask.roomNumber,
                                severity: 'medium',
                                message: t('housekeeping.veryFastCleaningWarning', { minutes: Math.round(durationMinutes), room: inspectionTask.roomNumber }),
                                createdAt: Timestamp.now(),
                                createdBy: { id: user?.id, name: user?.name },
                                status: 'active'
                            });
                        } catch (e) {
                            console.warn('Failed to log ghost anomaly:', e);
                        }
                    }
                }

                // ✅ UX: Show Undo Toast for critical status changes
                if (result === 'clean') {
                    setUndoState({
                        show: true,
                        message: t('housekeeping.roomStatusUpdatedToClean', { room: inspectionTask.roomNumber }),
                        onUndo: async () => {
                            try {
                                // Revert status
                                await updateDoc(doc(db, 'requests', inspectionTask.id), {
                                    status: previousState.status,
                                    inspectionResult: previousState.inspectionResult,
                                    completedAt: null
                                });
                                success(t('housekeeping.changeReverted'));
                            } catch (err) {
                                error(t('housekeeping.changeRevertFailed'));
                            }
                        }
                    });
                }
            },
            {
                successMessage: t('housekeeping.inspectionResultSent'),
                operation: 'inspection-submit'
            }
        );
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center theme-page">
                <AdoraLoader size="lg" message={t('common.loadingData')} />
            </div>
        );
    }

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="housekeeping" />
            
            {/* Spacer for UnifiedManagerHeader */}
            <div className="h-[88px] sm:h-[96px] lg:h-[92px]" />
            
            <div className="min-h-screen pb-4 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                {/* Flexible Header - Actions Only (Greeting in UnifiedManagerHeader) */}
                <FlexibleHeader
                    title={t('housekeeping.title')}
                    titleIcon={<Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 flex-shrink-0" />}
                    showGreeting={false}
                    brandName={brandName}
                    subtitle={undefined}
                    actions={[
                    {
                        id: 'history',
                        icon: <History className="w-5 h-5" />,
                        label: t('housekeeping.operationsHistory'),
                        onClick: () => setShowHistory(true),
                        variant: 'primary'
                    },
                    {
                        id: 'shiftNotes',
                        icon: <MessageSquare className="w-5 h-5" />,
                        label: t('housekeeping.roomNotes'),
                        onClick: () => setShowShiftNotes(true)
                    },
                    {
                        id: 'procurement',
                        icon: <ShoppingCart className="w-5 h-5" />,
                        label: t('housekeeping.procurement'),
                        onClick: () => setShowProcurement(true)
                    },
                    {
                        id: 'laundry',
                        icon: <Clock className="w-5 h-5" />,
                        label: t('housekeeping.laundryInventory'),
                        onClick: () => setShowLaundryInventory(true)
                    },
                    {
                        id: 'instructions',
                        icon: <BookOpen className="w-5 h-5" />,
                        label: t('housekeeping.generalInstructions'),
                        onClick: () => setShowGeneralInstructions(true),
                        variant: 'primary'
                    },
                    {
                        id: 'support',
                        icon: <Headphones className="w-5 h-5" />,
                        label: t('housekeeping.technicalSupport'),
                        onClick: () => setShowSupportTicket(true)
                    }
                    ]}
                />

                {/* Challenge Timeline */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <ChallengeTimeline />
                </div>

                {/* Golden Alert - Broadcast Messages */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <GoldenAlertDisplay department="housekeeping" />
                </div>

                {/* ✅ Room Transfer Notifications */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <div className="flex justify-end">
                        <TransferNotificationBadge department="housekeeping" />
                    </div>
                </div>

                {/* ✅ Points Notification - Show for active CONFIRMED tasks */}
                {notificationTask && tenantId && (
                    <PointsNotification
                        requestId={notificationTask.id}
                        requestType={notificationTask.type || 'cleaning'}
                        department="housekeeping"
                        createdAt={notificationTask.createdAt}
                        tenantId={tenantId}
                        onDismiss={() => setNotificationTask(null)}
                    />
                )}

                {/* Stats - Unified Style - ✅ ADORA PREMIUM COMPACT DESIGN */}
                <div 
                    className="max-w-7xl mx-auto mb-4"
                    style={{ padding: '24px' }}
                >
                    <div 
                        className="grid"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '24px',
                        }}
                    >
                        <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedTasks.new.length}
                        label={t('housekeeping.statusLabels.confirmed')}
                        icon={AlertCircle}
                        iconColor="orange"
                        status={groupedTasks.new.length > 10 ? 'warning' : 'normal'}
                        lastUpdate={t('common.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedTasks.inProgress.length}
                        label={t('housekeeping.statusLabels.inProgress')}
                        icon={Play}
                        iconColor="blue"
                        status={groupedTasks.inProgress.length > 15 ? 'warning' : 'normal'}
                        lastUpdate={t('common.lastUpdate')}
                    />
                </div>
                <div className="stat-card-pro-compact">
                    <StatCard
                        count={groupedTasks.completed.length}
                        label={t('housekeeping.statusLabels.completed')}
                        icon={CheckCircle2}
                        iconColor="green"
                        status="success"
                        lastUpdate={t('common.lastUpdate')}
                    />
                        </div>
                    </div>
                </div>

                {/* Room Type Filter - Segmented Control Style */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                    <div className="adora-card p-1 rounded-2xl flex relative z-0">
                        {[
                    { key: 'all', label: t('housekeeping.filterAll'), icon: <DoorOpen className="w-4 h-4" /> },
                    { key: 'occupied', label: t('housekeeping.filterOccupied'), icon: <span>🏠</span> },
                    { key: 'checkout', label: t('housekeeping.filterCheckout'), icon: <span>🚪</span> }
                ].map((filter) => (
                    <button
                        key={filter.key}
                        onClick={() => {
                            setRoomFilter(filter.key as RoomFilter);
                            haptic('light');
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all relative z-10 ${roomFilter === filter.key
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                            : 'adora-text-secondary hover:opacity-70'
                            }`}
                    >
                        {filter.icon}
                        <span>{filter.label}</span>
                        </button>
                        ))}
                    </div>
                </div>

                {/* Floor Filter */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <span className="adora-text-tertiary text-sm flex-shrink-0">{t('housekeeping.floorFilter')}:</span>
                {availableFloors.map((floor) => (
                    <button
                        key={floor}
                        onClick={() => {
                            setFloorFilter(floor);
                            haptic('light');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${floorFilter === floor
                            ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                            : 'adora-card adora-text-secondary hover:opacity-80'
                            }`}
                        >
                            {floor === 0 ? t('housekeeping.filterAll') : floor}
                        </button>
                        ))}
                    </div>
                </div>

                {/* ✅ Unified Tabs - Same as Reception */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                    <UnifiedRequestTabs
                        currentTab={currentTab}
                onTabChange={(tab) => {
                    setCurrentTab(tab);
                    haptic('light');
                }}
                newCount={groupedTasks.new.length}
                inProgressCount={groupedTasks.inProgress.length}
                        completedCount={groupedTasks.completed.length}
                    />
                </div>

                {/* Tasks List - Grid for Mobile */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {currentTasks.length === 0 ? (
                    <div className="col-span-full adora-card p-8 text-center">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 adora-bg-tertiary">
                            <Sparkles className="w-6 h-6 adora-text-disabled" />
                        </div>
                        <p className="text-sm adora-text-secondary">{t('housekeeping.noTasksInList')}</p>
                    </div>
                ) : (
                    currentTasks.map(task => (
                        <SwipeableTaskCard
                            key={task.id}
                            task={task}
                            userId={user?.id}
                            userName={user?.name}
                            tenantId={tenantId} // ✅ Pass tenantId
                            statusConfig={STATUS_CONFIG}
                            cleaningTypeConfig={CLEANING_TYPE_CONFIG}
                            onStart={() => {
                                if (task.status === 'CONFIRMED') {
                                    setStartCleaningTask(task);
                                    logEvent({
                                        eventName: 'task_start_click',
                                        category: 'task',
                                        branchId: branchId,
                                        userId: user?.id,
                                        metadata: { taskId: task.id, room: task.roomNumber }
                                    });
                                }
                            }}
                            onComplete={() => {
                                if (task.status === 'IN_PROGRESS') {
                                    handleCompleteCleaning(task.id);
                                    logEvent({
                                        eventName: 'task_complete_click',
                                        category: 'task',
                                        branchId: branchId,
                                        userId: user?.id,
                                        metadata: { taskId: task.id, room: task.roomNumber }
                                    });
                                }
                            }}
                            onView={() => {
                                // ✅ Open inspection modal for inspection tasks (CONFIRMED) or tasks needing inspection
                                if ((task.type === 'inspection' && task.status === 'CONFIRMED') || task.status === 'NEEDS_INSPECTION') {
                                    setInspectionTask(task);
                                }
                            }}
                            />
                        ))
                        )}
                    </div>
                </div>

                {/* ✅ UX: Undo Toast */}
                {undoState?.show && (
                    <UndoToast
                        message={undoState.message}
                        onUndo={() => {
                            undoState.onUndo();
                            setUndoState(null);
                        }}
                        onDismiss={() => setUndoState(null)}
                    />
                )}

                {/* Modals */}
                <InspectionModal
                isOpen={!!inspectionTask}
                task={inspectionTask}
                onClose={() => setInspectionTask(null)}
                onSubmit={handleInspectionSubmit}
                    isSubmitting={isSubmitting}
                    tenantId={tenantId || undefined}
                />

                {/* ⭐ Start Cleaning Modal with Room Assignment */}
                <StartCleaningModal
                    isOpen={!!startCleaningTask}
                    task={startCleaningTask}
                    onClose={() => setStartCleaningTask(null)}
                    onSubmit={handleStartCleaningSubmit}
                    teamMembers={teamMembers}
                />

                <ShiftNotes isOpen={showShiftNotes} onClose={() => setShowShiftNotes(false)} />
                <ProcurementCartWizard isOpen={showProcurement} onClose={() => setShowProcurement(false)} department="housekeeping" tenantId={tenantContext?.tenantId || ''} />
                <LaundryInventory isOpen={showLaundryInventory} onClose={() => setShowLaundryInventory(false)} />
                <TeamMembers isOpen={showTeam} onClose={() => setShowTeam(false)} department="housekeeping" />
                <HousekeepingTeamManager
                isOpen={showTeamManager}
                onClose={() => {
                    setShowTeamManager(false);
                    // ✅ Reload team members after closing TeamManager to reflect updates
                    const reloadTeam = async () => {
                        try {
                            const docRef = doc(db, 'settings', 'housekeeping');
                            const docSnap = await getDoc(docRef);

                            if (docSnap.exists() && docSnap.data().teamMembers) {
                                const members = docSnap.data().teamMembers;
                                setTeamMembers(members);
                            } else {
                                setTeamMembers([{ id: user?.id || '', name: user?.name || t('common.me') }]);
                            }
                        } catch (e) {
                            console.error('Error reloading team after update:', e);
                        }
                    };
                    reloadTeam();
                }}
                onUpdate={() => {
                    // ✅ Reload team members immediately when team is updated
                    const reloadTeam = async () => {
                        try {
                            const docRef = doc(db, 'settings', 'housekeeping');
                            const docSnap = await getDoc(docRef);

                            if (docSnap.exists() && docSnap.data().teamMembers) {
                                const members = docSnap.data().teamMembers;
                                setTeamMembers(members);
                            } else {
                                setTeamMembers([{ id: user?.id || '', name: user?.name || t('common.me') }]);
                            }
                        } catch (e) {
                            console.error('Error reloading team after update:', e);
                        }
                    };
                    reloadTeam();
                }}
            />
            <UnifiedHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} defaultDepartment="housekeeping" />

            {/* 🎤 Smart Voice FAB (No Overlay) - Verified Fix */}
            <VoiceInputButton
                onResult={processCommand}
                isFallbackMode={isFallbackMode}
                errorCount={errorCount}
                lastError={lastError}
                onRetry={retryLastCommand}
                onResetErrors={resetErrors}
            />

            {/* Mobile Menu */}
            <MobileMenu
                isOpen={showMobileMenu}
                onClose={() => setShowMobileMenu(false)}
                user={user || undefined}
                onLogout={logout}
                items={[
                    {
                        id: 'history',
                        label: t('housekeeping.operationsHistory'),
                        icon: <History className="w-5 h-5" />,
                        onClick: () => setShowHistory(true),
                        color: 'text-blue-400'
                    },
                    {
                        id: 'shift-notes',
                        label: t('housekeeping.roomNotes'),
                        icon: <MessageSquare className="w-5 h-5" />,
                        onClick: () => setShowShiftNotes(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'team',
                        label: t('housekeeping.team'),
                        icon: <Users className="w-5 h-5" />,
                        onClick: () => {
                            if (user?.role === 'manager' || user?.role === 'owner') {
                                setShowTeamManager(true);
                            } else {
                                setShowTeam(true);
                            }
                        },
                        color: 'text-white/60'
                    },
                    {
                        id: 'procurement',
                        label: t('housekeeping.procurement'),
                        icon: <ShoppingCart className="w-5 h-5" />,
                        onClick: () => setShowProcurement(true),
                        color: 'text-white/60'
                    },
                    {
                        id: 'laundry',
                        label: t('housekeeping.laundryInventory'),
                        icon: <span className="text-xl">🧺</span>,
                        onClick: () => setShowLaundryInventory(true),
                        color: 'text-purple-400'
                    }
                ]}
            />

            {/* Room History Modal */}
            <RoomHistoryModal
                hotelId="default"
                branchId={branchId}
                roomNumber={roomHistoryRoom || ''}
                isOpen={!!roomHistoryRoom}
                onClose={() => setRoomHistoryRoom(null)}
            />

            {/* General Instructions Modal */}
            <GeneralInstructionsView
                department="housekeeping"
                isOpen={showGeneralInstructions}
                onClose={() => setShowGeneralInstructions(false)}
            />

            {/* Support Ticket Modal */}
            {showSupportTicket && (
                <SupportTicketModal
                    isOpen={showSupportTicket}
                    onClose={() => setShowSupportTicket(false)}
                    department="housekeeping"
                />
                )}

                {/* ✅ Branch Location Warning */}
                {showLocationWarning && locationWarningData && branchId && (
                    <BranchLocationWarning
                        branchId={branchId}
                        onConfirm={() => {
                            setShowLocationWarning(false);
                            // Continue anyway
                        }}
                        onCancel={() => {
                            setShowLocationWarning(false);
                            navigate('/admin');
                        }}
                    />
                )}

                {/* ✅ Onboarding Tour */}
                <TourGuide
                    steps={tourSteps && tourSteps.length > 0 ? tourSteps : []}
                    isOpen={showTour}
                    onClose={closeTour}
                    onComplete={completeTour}
                />

                {/* 📝 Developer Signature */}
                {/* Developer Signature is in GlobalFooter (App.tsx) */}
            </div>
        </PageTransition>
    );
};


export default HousekeepingDashboard;
