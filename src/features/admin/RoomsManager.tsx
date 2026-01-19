/**
 * Rooms Manager
 * Admin interface for managing hotel rooms
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    DoorOpen,
    Plus,
    X,
    Trash2,
    Edit2,
    RefreshCw,
    Layers,
    CheckCircle,
    Wrench,
    Sparkles,
    AlertTriangle,
    ArrowRight,
    LayoutGrid, // Added
    List, // Added
    CalendarDays, // Added
    Save, // Added
    Loader2 // Added
} from 'lucide-react';
import { Room, RoomType, RoomStatus } from '../../types';
import {
    subscribeToRooms,
    addRoom,
    deleteRoom,
    createRoomBatch,
    updateRoom,
    migrateLegacyRoom
} from '../../services/roomService';
import {
    getRoomTypes,
    addRoomType,
    updateRoomType,
    deleteRoomType,
    RoomTypeConfig
} from '../../services/pricingRulesService'; // Added imports
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches } from '../../hooks/useTenantData';
import { Building2, ChevronDown } from 'lucide-react';
import { PremiumSelect } from '../../components/ui/PremiumSelect';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { RoomsManagerHelp } from '../../components/common/ContextualHelp'; // ✅ Contextual Help
import { logger } from '../../services/loggerService';
import { updateBranch } from '../../services/branchService';
import { useTranslation } from 'react-i18next';

// ✅ i18n: Status colors - Labels will be set dynamically using t()
const getStatusColors = (t: (key: string) => string): Record<RoomStatus, { bg: string; text: string; label: string }> => ({
    available: { bg: 'bg-green-500/20', text: 'text-green-400', label: t('rooms.status.available') },
    occupied: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: t('rooms.status.occupied') },
    cleaning: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: t('rooms.status.cleaning') },
    maintenance: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: t('rooms.status.maintenance') },
    out_of_order: { bg: 'bg-red-500/20', text: 'text-red-400', label: t('rooms.status.outOfOrder') },
});

// ✅ REMOVED: Hardcoded ROOM_TYPES - Now uses approvedRoomTypes from branch

// ============================================================
// ADD ROOM MODAL
// ============================================================

interface AddRoomModalProps {
    isOpen: boolean;
    onClose: () => void;
    branchId: string;
    tenantId?: string;
    availableBranches?: Array<{ id: string; name?: string; code?: string }>;
}

const AddRoomModal: React.FC<AddRoomModalProps> = ({ isOpen, onClose, branchId, tenantId, availableBranches = [] }) => {
    const { t } = useTranslation();
    const [selectedBranchId, setSelectedBranchId] = useState(branchId);
    
    // ✅ Get current branch name for display (updates when branch changes)
    const targetBranchId = availableBranches.length > 1 ? selectedBranchId : branchId;
    const currentBranch = availableBranches.find(b => b.id === targetBranchId) || availableBranches[0];
    
    // ✅ Build room types options from approvedRoomTypes (replaces hardcoded ROOM_TYPES)
    const roomTypesOptions = React.useMemo(() => {
        const approved = (currentBranch as any)?.approvedRoomTypes as string[] | undefined;
        if (!approved || approved.length === 0) {
            // Fallback: Empty array if no approved types yet
            return [{ value: 'other', label: t('rooms.addModal.manualEntry') }];
        }
        // Convert approvedRoomTypes to { value, label } format + add "other" option
        return [
            ...approved.map(type => ({ value: type, label: type })),
            { value: 'other', label: t('rooms.addModal.manualEntry') }
        ];
    }, [currentBranch, t]);
    
    // ✅ FIX: Format branch name properly (e.g., "فرع 1 - الكورنيش" or "فرع 2 - الأندلس")
    const currentBranchName = useMemo(() => {
        if (!currentBranch) {
            return branchId ? `الفرع ${branchId}` : 'الفرع المحدد';
        }
        
        const branchName = (currentBranch as any).name || '';
        const branchCode = (currentBranch as any).code || '';
        
        // If name exists and contains meaningful text (not just "branch-xxx")
        if (branchName && !branchName.startsWith('branch-')) {
            // If code exists, format as "فرع {code} - {name}"
            if (branchCode) {
                return `فرع ${branchCode} - ${branchName}`;
            }
            // Otherwise just use the name
            return branchName;
        }
        
        // Fallback: Use code if available
        if (branchCode) {
            return `فرع ${branchCode}`;
        }
        
        // Last resort: Extract number from ID if it's like "branch-1"
        const idMatch = currentBranch.id.match(/branch-(\d+)/);
        if (idMatch) {
            return `فرع ${idMatch[1]}`;
        }
        
        return `فرع ${currentBranch.id}`;
    }, [currentBranch, branchId, selectedBranchId, availableBranches]);
    const [mode, setMode] = useState<'single' | 'batch'>('single');
    const [formData, setFormData] = useState({
        number: '',
        floor: 1,
        type: 'standard',
        customType: '', // For manual entry
        startNumber: 101,
        endNumber: 110,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Determine final type
            const finalType = formData.type === 'other' ? formData.customType : formData.type;
            if (!finalType) {
                alert('يرجى تحديد نوع الغرفة');
                return;
            }

            // ✅ Use selected branch instead of prop branchId
            const targetBranchId = availableBranches.length > 1 ? selectedBranchId : branchId;
            
            // ✅ AUTO-UPDATE approvedRoomTypes: If custom type was added, update branch document
            let isNewTypeAdded = false;
            if (formData.type === 'other' && formData.customType.trim() && tenantId && targetBranchId) {
                const currentBranch = availableBranches.find(b => b.id === targetBranchId);
                const currentApproved = ((currentBranch as any)?.approvedRoomTypes as string[]) || [];
                
                // ✅ Check if type already exists (case-insensitive)
                const typeExists = currentApproved.some(t => t.toLowerCase() === finalType.toLowerCase());
                
                if (!typeExists) {
                    // ✅ Add new type to approvedRoomTypes
                    const updatedApproved = [...currentApproved, finalType.trim()];
                    await updateBranch(tenantId, targetBranchId, {
                        approvedRoomTypes: updatedApproved
                    } as any);
                    logger.info('Auto-updated approvedRoomTypes', { tenantId, branchId: targetBranchId, newType: finalType }, 'RoomsManager');
                    isNewTypeAdded = true;
                }
            }
            
            if (mode === 'single') {
                await addRoom({
                    number: formData.number,
                    floor: formData.floor,
                    type: finalType as any,
                    status: 'available',
                    branchId: targetBranchId || '',
                    tenantId
                });
            } else {
                await createRoomBatch(
                    formData.floor,
                    formData.startNumber,
                    formData.endNumber,
                    finalType as any,
                    targetBranchId || '',
                    tenantId || ''
                );
            }

            // ✅ FINANCIAL LINKING: Check if new type has basePrice set
            // ✅ Alert manager to set price for newly added room type
            if (isNewTypeAdded && tenantId && targetBranchId) {
                try {
                    // Check if room type document exists and has basePrice
                    const existingTypes = await getRoomTypes(tenantId, targetBranchId);
                    const typeDoc = existingTypes.find(t => t.name.toLowerCase() === finalType.toLowerCase());
                    
                    // ✅ Show alert if type exists but has no basePrice (or basePrice is 0)
                    if (!typeDoc || !typeDoc.basePrice || typeDoc.basePrice === 0) {
                        const shouldNavigate = window.confirm(
                            `⚠️ تم إضافة نوع جديد: "${finalType}"\n\n` +
                            `💡 هذا النوع يحتاج إلى تحديد "السعر الأساسي" ليعمل بشكل صحيح في جميع الأقسام.\n\n` +
                            `هل تريد الذهاب إلى صفحة الأسعار الآن لتحديد السعر؟`
                        );
                        
                        if (shouldNavigate) {
                            // Navigate to pricing settings - route is /admin/prices
                            window.location.href = '/admin/prices';
                        }
                    }
                } catch (err) {
                    logger.warn('Could not check room type pricing', err, 'RoomsManager');
                }
            }
            
            onClose();
        } catch (err) {
            logger.error('Error adding room', err, 'RoomsManager');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} style={{ backdropFilter: 'none' }} />
            <div className="relative w-full max-w-md rounded-3xl p-6 animate-slide-up bg-white dark:bg-slate-800" style={{ border: '1px solid #e2e8f0' }}>
                <button onClick={onClose} className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white transition-colors duration-300 bg-slate-100 dark:bg-slate-700">
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t('rooms.addModal.title')}</h2>
                    {/* ✅ Branch Indicator - Shows which branch rooms will be added to */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                        <Building2 className="w-4 h-4 text-primary-400 shrink-0" />
                        <span className="text-sm text-primary-300">
                            {t('rooms.addModal.branchIndicator', { branchName: currentBranchName })}
                        </span>
                    </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setMode('single')}
                        className={`flex-1 py-2 rounded-xl transition-all font-medium ${mode === 'single' ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-lg' : 'text-slate-600 dark:text-white/70 bg-slate-100 dark:bg-slate-700'
                            }`}
                    >
                        {t('rooms.addModal.singleRoom')}
                    </button>
                    <button
                        onClick={() => setMode('batch')}
                        className={`flex-1 py-2 rounded-xl transition-all font-medium ${mode === 'batch' ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-lg' : 'text-slate-600 dark:text-white/70 bg-slate-100 dark:bg-slate-700'
                            }`}
                    >
                        {t('rooms.addModal.batchRooms')}
                    </button>
                </div>

                <div className="space-y-4">
                    {mode === 'single' ? (
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">{t('rooms.addModal.roomNumber')}</label>
                            <input
                                type="text"
                                value={formData.number}
                                onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
                                placeholder="101"
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">من</label>
                                <input
                                    type="number"
                                    value={formData.startNumber}
                                    onChange={(e) => setFormData({ ...formData, startNumber: parseInt(e.target.value) })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">إلى</label>
                                <input
                                    type="number"
                                    value={formData.endNumber}
                                    onChange={(e) => setFormData({ ...formData, endNumber: parseInt(e.target.value) })}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">{t('rooms.addModal.floor')}</label>
                        <input
                            type="number"
                            min="1"
                            value={formData.floor}
                            onChange={(e) => setFormData({ ...formData, floor: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
                        />
                    </div>

                    {/* ✅ Branch Selector - Only show if manager has multiple branches */}
                    {availableBranches.length > 1 && (
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">{t('rooms.addModal.branch')}</label>
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50 focus:border-teal-400"
                            >
                                {availableBranches.map(b => (
                                    <option key={b.id} value={b.id} className="bg-white dark:bg-slate-800">
                                        {(b as any).name || `فرع ${(b as any).code || b.id}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <PremiumSelect
                            label="النوع"
                            value={formData.type}
                            onChange={(val) => setFormData({ ...formData, type: val })}
                            options={roomTypesOptions}
                            placeholder="اختر نوع الغرفة"
                        />

                        {/* Custom Type Input */}
                        {formData.type === 'other' && (
                            <input
                                type="text"
                                value={formData.customType}
                                onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                                className="input mt-2"
                                placeholder="اكتب نوع الغرفة..."
                                autoFocus
                            />
                        )}
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="btn-primary w-full py-4"
                    >
                        {isSubmitting ? (
                            <AdoraLoaderInline size={20} />
                        ) : (
                            <>
                                <Plus className="w-5 h-5" />
                                {mode === 'single' ? 'إضافة الغرفة' : `إضافة ${formData.endNumber - formData.startNumber + 1} غرفة`}
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

export const RoomsManager: React.FC = () => {
    const { t } = useTranslation();
    const { user, branchId, setBranch } = useAuth();
    const tenantId = (user as any)?.tenantId;
    const { branches } = useTenantBranches();
    
    // ✅ i18n: Get STATUS_COLORS with translations
    const STATUS_COLORS = useMemo(() => getStatusColors(t), [t]);
    
    // ✅ Filter branches for manager (only assigned branches)
    const availableBranches = React.useMemo(() => {
        if (!branches || !user) return [];
        
        // Owner: Access all branches
        if (user.role === 'owner') return branches;
        
        // Manager: Access assigned branches only
        if (user.role === 'manager') {
            const assignedCodes = (user as any).branchCodes || [];
            return branches.filter(b => {
                const branchCode = (b as any).code || '';
                return assignedCodes.includes(branchCode);
            });
        }
        
        // Employee: Current branch only
        return branches.filter(b => b.id === branchId);
    }, [branches, user, branchId]);

    // Tabs State
    const [activeTab, setActiveTab] = useState<'rooms' | 'types'>('rooms');

    // Rooms State
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');

    // Room Types State
    const [types, setTypes] = useState<RoomTypeConfig[]>([]);
    const [newType, setNewType] = useState({ name: '', basePrice: 0, seasonalPrice: 0, maxOccupancy: 2, bookingRate: 45 });

    // Modals & Tools
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showGhostModal, setShowGhostModal] = useState(false);
    const [ghostRooms, setGhostRooms] = useState<Room[]>([]);
    const [migrating, setMigrating] = useState<string | null>(null);

    // Load Rooms
    useEffect(() => {
        if (!user || !branchId) return;

        // branchId is first argument
        const unsubscribe = subscribeToRooms(
            branchId,
            (updatedRooms) => {
                setRooms(updatedRooms);
                setLoading(false);

                // Check for Ghost Rooms
                const ghosts = updatedRooms.filter(r => !r.floor || !r.type);
                if (ghosts.length > 0) {
                    setGhostRooms(ghosts);
                }
            },
            tenantId
        );

        return () => unsubscribe();
    }, [user, branchId, tenantId]);

    // Load Types when tab changes
    useEffect(() => {
        if (activeTab === 'types' && tenantId && branchId) {
            loadTypes();
        }
    }, [activeTab, tenantId, branchId]);

    const loadTypes = async () => {
        if (!tenantId || !branchId) return;
        const t = await getRoomTypes(tenantId, branchId);
        setTypes(t);
    };

    // Room Types Actions
    const handleAddType = async () => {
        if (!tenantId || !branchId || !newType.name) return;
        await addRoomType(tenantId, branchId, { ...newType, active: true });
        setNewType({ name: '', basePrice: 0, seasonalPrice: 0, maxOccupancy: 2, bookingRate: 45 });
        loadTypes();
    };

    const handleUpdateType = async (id: string, updates: Partial<RoomTypeConfig>) => {
        if (!tenantId || !branchId) return;
        await updateRoomType(tenantId, branchId, id, updates);
        setTypes(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm(t('rooms.addModal.deleteTypeConfirm'))) return;
        if (!tenantId || !branchId) return;
        await deleteRoomType(tenantId, branchId, id);
        loadTypes();
    };

    const handleSyncTypes = async () => {
        // Simplified sync logic
        if (!tenantId || !branchId) return;
        const uniqueTypes = Array.from(new Set(rooms.map(r => r.type))).filter(Boolean);
        let added = 0;
        for (const tName of uniqueTypes) {
            if (!types.find(t => t.name === tName)) {
                await addRoomType(tenantId, branchId, { name: tName!, basePrice: 0, maxOccupancy: 2, active: true });
                added++;
            }
        }
        if (added > 0) {
            alert(t('rooms.addModal.addedNewTypes', { count: added }));
            loadTypes();
        } else {
            alert(t('rooms.addModal.allTypesExist'));
        }
    };

    // Derived State for Rooms
    const floors = Array.from(new Set(rooms.map(r => r.floor))).sort((a, b) => a - b);
    const filteredRooms = selectedFloor === 'all'
        ? rooms.sort((a, b) => a.floor - b.floor || parseInt(a.number) - parseInt(b.number))
        : rooms.filter(r => r.floor === selectedFloor).sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const stats = {
        total: rooms.length,
        available: rooms.filter(r => r.status === 'available').length,
        occupied: rooms.filter(r => r.status === 'occupied').length,
        cleaning: rooms.filter(r => r.status === 'cleaning').length,
        maintenance: rooms.filter(r => r.status === 'maintenance').length,
    };

    // Render Methods
    const renderRoomTypesManager = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="rounded-2xl transition-colors duration-300 p-6 border-b" style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-secondary)' }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <LayoutGrid className="text-teal-400" />
                        إعداد أنواع الغرف
                    </h3>
                    <button
                        onClick={handleSyncTypes}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        مزامنة من الغرف
                    </button>
                </div>
                <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-slate-400 mb-1 block">اسم النوع</label>
                        <input
                            type="text"
                            value={newType.name}
                            onChange={e => setNewType({ ...newType, name: e.target.value })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                            placeholder="مثال: كينج"
                        />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-slate-400 mb-1 block">الاستيعاب</label>
                        <input
                            type="number"
                            value={newType.maxOccupancy}
                            onChange={e => setNewType({ ...newType, maxOccupancy: Number(e.target.value) })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-slate-400 mb-1 block">سعر أساسي</label>
                        <input
                            type="number"
                            value={newType.basePrice}
                            onChange={e => setNewType({ ...newType, basePrice: Number(e.target.value) })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-slate-400 mb-1 block">سعر موسم</label>
                        <input
                            type="number"
                            value={newType.seasonalPrice}
                            onChange={e => setNewType({ ...newType, seasonalPrice: Number(e.target.value) })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-slate-400 mb-1 block">بوكينج %</label>
                        <input
                            type="number"
                            value={newType.bookingRate}
                            onChange={e => setNewType({ ...newType, bookingRate: Number(e.target.value) })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <button
                        onClick={handleAddType}
                        className="bg-teal-500 hover:bg-teal-600 text-white p-2.5 rounded-lg mb-0.5"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {types.map(type => (
                    <div key={type.id} className="rounded-2xl transition-colors duration-300 p-4 relative group hover:border-teal-500/30 transition-all" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                        <button
                            onClick={() => handleDeleteType(type.id)}
                            className="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <h4 className="font-bold text-lg text-white mb-2">{type.name}</h4>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">السعر الأساسي</label>
                                <input
                                    type="number"
                                    defaultValue={type.basePrice}
                                    onBlur={(e) => handleUpdateType(type.id, { basePrice: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono text-teal-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-orange-400 block mb-1">سعر المواسم</label>
                                <input
                                    type="number"
                                    defaultValue={type.seasonalPrice || type.basePrice}
                                    onBlur={(e) => handleUpdateType(type.id, { seasonalPrice: Number(e.target.value) })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono text-orange-400"
                                />
                            </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-400">الاستيعاب</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={type.maxOccupancy}
                                        onBlur={(e) => handleUpdateType(type.id, { maxOccupancy: Number(e.target.value) })}
                                        className="w-16 bg-slate-800 border border-slate-700 rounded p-1 text-center text-xs text-white"
                                    />
                                    <span className="text-xs text-slate-500">أفراد</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <label className="text-xs text-slate-400">نسبة بوكينج</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={type.bookingRate || 45}
                                        onBlur={(e) => handleUpdateType(type.id, { bookingRate: Number(e.target.value) })}
                                        className="w-16 bg-slate-800 border border-slate-700 rounded p-1 text-center text-xs text-white"
                                    />
                                    <span className="text-xs text-slate-500">%</span>
                                </div>
                            </div>
                            <div className="mt-2 text-center">
                                <span className="text-xs text-slate-500">سعر بوكينج التقريبي: </span>
                                <span className="font-bold text-blue-400">
                                    {Math.round((type.basePrice || 0) * (1 + (type.bookingRate || 45) / 100))}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    const handleDeleteRoom = async (roomNumber: string) => {
        if (!tenantId) return;
        if (confirm(`هل تريد حذف الغرفة ${roomNumber}؟`)) {
            await deleteRoom(tenantId, branchId || '', roomNumber);
        }
    };

    // ✅ Migration Handler
    const handleMigrate = async (room: Room) => {
        if (!branchId || !tenantId) return;
        setMigrating(room.id);
        try {
            await migrateLegacyRoom(room.id, room, branchId, tenantId);
        } catch (err) {
            alert('فشل في إصلاح الغرفة. التفاصيل في وحدة التحكم.');
        } finally {
            setMigrating(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <AdoraLoader size="md" message={t('rooms.management.loading')} />
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 📍 Contextual Help */}
            <RoomsManagerHelp />

            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{t('rooms.management.title')}</h1>
                    <p className="text-white/60">
                        {activeTab === 'rooms'
                            ? `${stats.total} ${t('common.rooms')} • ${stats.available} ${t('rooms.status.available')} • ${stats.occupied} ${t('rooms.status.occupied')}`
                            : t('rooms.addModal.settings')}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* ✅ Branch Switcher - Only show if manager has multiple branches */}
                    {availableBranches.length > 1 && (
                        <div className="rounded-xl transition-colors duration-300 p-2 border border-white/10" style={{ background: 'var(--theme-bg-tertiary)' }}>
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-primary-400" />
                                <select
                                    value={branchId || ''}
                                    onChange={(e) => {
                                        setBranch(e.target.value);
                                        // Reset floor filter when switching branches
                                        setSelectedFloor('all');
                                    }}
                                    className="bg-transparent text-white text-sm outline-none cursor-pointer appearance-none pr-2"
                                >
                                    {availableBranches.map(b => (
                                        <option key={b.id} value={b.id} style={{ background: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)' }}>
                                            {(b as any).name || `فرع ${(b as any).code || b.id}`}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-white/40" />
                            </div>
                        </div>
                    )}

                    {/* Apps-like Tab Switcher */}
                    <div className="flex p-1 rounded-xl border transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)' }}>
                    <button
                        onClick={() => setActiveTab('rooms')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-medium ${activeTab === 'rooms'
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <DoorOpen className="w-4 h-4" />
                        الغرف
                    </button>
                    <button
                        onClick={() => setActiveTab('types')}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all font-medium ${activeTab === 'types'
                            ? 'bg-teal-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white'
                            }`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                        أنواع الغرف
                    </button>
                    </div>
                </div>
            </div>

            {/* TAB CONTENT: ROOM TYPES */}
            {activeTab === 'types' && renderRoomTypesManager()}

            {/* TAB CONTENT: ROOMS LIST */}
            {activeTab === 'rooms' && (
                <div className="animate-fade-in">
                    {/* Controls Row */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        {/* Floor Filter */}
                        <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                            <div className="flex gap-2 min-w-max">
                                <button
                                    onClick={() => setSelectedFloor('all')}
                                    className={`px-4 py-2 rounded-xl transition-all border text-sm font-medium ${selectedFloor === 'all'
                                        ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                                        : ''
                                        }`}
                                >
                                    <Layers className="w-4 h-4 inline mr-1" />
                                    كل الأدوار
                                </button>
                                {floors.map((floor) => (
                                    <button
                                        key={floor}
                                        onClick={() => setSelectedFloor(floor)}
                                        className={`px-4 py-2 rounded-xl transition-all border text-sm font-medium ${selectedFloor === floor
                                            ? 'bg-primary-600/20 border-primary-500 text-primary-400'
                                            : ''
                                            }`}
                                    >
                                        الدور {floor}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            {/* Ghost Room Alert Button */}
                            {ghostRooms.length > 0 && (
                                <button
                                    onClick={() => setShowGhostModal(true)}
                                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 animate-pulse flex items-center justify-center gap-2 text-sm font-bold"
                                >
                                    <AlertTriangle className="w-5 h-5" />
                                    <span>{ghostRooms.length} أخطاء</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                            >
                                <Plus className="w-5 h-5" />
                                <span>إضافة غرفة</span>
                            </button>
                        </div>
                    </div>

                    {/* Rooms Grid */}
                    {filteredRooms.length === 0 ? (
                        <div className="rounded-2xl transition-colors duration-300 p-12 text-center border-dashed border-2" style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-tertiary)' }}>
                            <DoorOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">{t('rooms.addModal.noRoomsTitle')}</h3>
                            <p className="text-slate-400 mb-6">{t('rooms.addModal.noRoomsMessage')}</p>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="btn-primary"
                            >
                                {t('rooms.addModal.addFirstRoom')}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {filteredRooms.map((room) => {
                                const statusInfo = STATUS_COLORS[room.status];
                                return (
                                    <div key={room.number} className="rounded-2xl transition-colors duration-300 group relative p-4 hover:-translate-y-1 transition-transform duration-300" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className={`w-10 h-10 rounded-xl ${statusInfo.bg} flex items-center justify-center`}>
                                                <DoorOpen className={`w-5 h-5 ${statusInfo.text}`} />
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRoom(room.number)}
                                                className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-1">{room.number}</h3>
                                        <p className="text-xs text-slate-400 mb-3 flex items-center gap-1">
                                            {room.type}
                                        </p>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${statusInfo.bg.replace('/20', '/10')} border-white/5 ${statusInfo.text}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.text.replace('text-', 'bg-')}`} />
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <AddRoomModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                branchId={branchId || ''}
                tenantId={(user as any)?.tenantId}
                availableBranches={availableBranches}
            />

            {/* Ghost Room Modal */}
            {showGhostModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90" onClick={() => setShowGhostModal(false)} style={{ backdropFilter: 'none' }} />
                    <div className="relative w-full max-w-2xl rounded-3xl p-0 animate-slide-up max-h-[80vh] overflow-hidden flex flex-col border transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <AlertTriangle className="w-6 h-6 text-red-400" />
                                    <span>كاشف الأخطاء (Ghost Rooms)</span>
                                </h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    تم اكتشاف {ghostRooms.length} غرفة بنظام قديم.
                                </p>
                            </div>
                            <button onClick={() => setShowGhostModal(false)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                            {ghostRooms.map(room => (
                                <div key={room.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-red-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                                            <DoorOpen className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">غرفة {room.number}</h3>
                                            <p className="text-xs text-red-400 font-mono">ID: {room.id}</p>
                                        </div>
                                    </div>
                                    {/* ✅ Migration button now connected */}
                                    <button
                                        onClick={() => handleMigrate(room)}
                                        disabled={migrating === room.id}
                                        className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-all text-sm font-medium flex items-center gap-2"
                                    >
                                        {migrating === room.id ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                جاري الإصلاح...
                                            </>
                                        ) : (
                                            <>
                                                <Wrench className="w-4 h-4" />
                                                إصلاح
                                            </>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RoomsManager;
