/**
 * Unified Room Selector Modal
 * Shared component for room selection across all departments
 * Adora Hotel Management System V2
 */

/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Building, DoorOpen, ChevronRight } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { haptic } from '../../utils/uxEffects';
import { getRooms } from '../../services/roomService';

// ============================================================
// TYPES
// ============================================================

interface Room {
    id: string;
    roomNumber: string;
    floor: number;
    type?: string;
    isOccupied?: boolean;
}

interface RoomSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (roomNumber: string) => void;
    showOccupiedOnly?: boolean;
    title?: string;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const RoomSelector: React.FC<RoomSelectorProps> = ({
    isOpen,
    onClose,
    onSelect,
    showOccupiedOnly = false,
    title
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { tenantId } = useTenant();
    
    // ✅ i18n: Use translated default title
    const displayTitle = title || t('roomSelector.defaultTitle');

    const [rooms, setRooms] = useState<Room[]>([]);
    const [roomsByFloor, setRoomsByFloor] = useState<Record<number, Room[]>>({});
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // ✅ Get branchId from user
    const branchId = (user as any)?.branchId || (user as any)?.branch;

    // Load rooms
    useEffect(() => {
        if (isOpen && user && branchId && tenantId) {
            loadRooms();
        }
    }, [isOpen, user, branchId, tenantId]);

    const loadRooms = async () => {
        if (!tenantId || !branchId) {
            console.warn('RoomSelector: Missing tenantId or branchId');
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // ✅ SECURITY: Use tenant/branch-isolated room service
            const tenantRooms = await getRooms(branchId, tenantId);
            
            // ✅ Load active room cards (occupied rooms) - tenant/branch isolated
            const activeCardsRef = collection(db, `tenants/${tenantId}/roomCards`);
            const activeQuery = query(
                activeCardsRef,
                where('branchId', '==', branchId),
                where('status', '==', 'active')
            );
            const activeSnapshot = await getDocs(activeQuery);

            const activeRoomNumbers = new Set<string>();
            activeSnapshot.forEach((doc) => {
                const data = doc.data();
                activeRoomNumbers.add(data.roomNumber || data.number);
            });

            // ✅ Map tenant rooms to Room interface
            const loadedRooms: Room[] = tenantRooms
                .map((room) => ({
                    id: `${branchId}_${room.number}`,
                    roomNumber: room.number, // ✅ Map 'number' to 'roomNumber' for component compatibility
                    floor: room.floor,
                    type: room.type || 'standard',
                    isOccupied: activeRoomNumbers.has(room.number) || room.status === 'occupied'
                }))
                .filter((room) => {
                    // Filter based on showOccupiedOnly
                    return !showOccupiedOnly || room.isOccupied;
                });

            // Group by floor
            const grouped: Record<number, Room[]> = {};
            loadedRooms.forEach(room => {
                const floor = room.floor || 0;
                if (!grouped[floor]) grouped[floor] = [];
                grouped[floor].push(room);
            });

            // Sort rooms within each floor
            Object.keys(grouped).forEach(floorKey => {
                const floor = Number(floorKey);
                grouped[floor].sort((a, b) => {
                    const numA = parseInt(a.roomNumber) || 0;
                    const numB = parseInt(b.roomNumber) || 0;
                    return numA - numB;
                });
            });

            setRooms(loadedRooms);
            setRoomsByFloor(grouped);
        } catch (error) {
            console.error('Failed to load rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFloor = (floor: number) => {
        setSelectedFloor(floor);
        haptic('light');
    };

    const handleSelectRoom = (roomNumber: string) => {
        onSelect(roomNumber);
        haptic('medium');
        onClose();
    };

    const handleBack = () => {
        setSelectedFloor(null);
        haptic('light');
    };

    if (!isOpen) return null;

    const floors = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b);

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="glass-card w-full max-w-md max-h-[80vh] flex flex-col rounded-3xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
                    {selectedFloor !== null ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-white/70 hover:text-white"
                        >
                            <ChevronRight className="w-5 h-5" />
                            <span>{t('common.back')}</span>
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                                <Building className="w-5 h-5 text-primary-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">{displayTitle}</h3>
                        </div>
                    )}
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                    ) : selectedFloor === null ? (
                        // Floors list
                        <div className="grid grid-cols-2 gap-3">
                            {floors.length === 0 ? (
                                <div className="col-span-2 text-center py-8 text-white/50">
                                    لا توجد غرف متاحة
                                </div>
                            ) : (
                                floors.map((floor) => (
                                    <button
                                        key={floor}
                                        onClick={() => handleSelectFloor(floor)}
                                        className="p-4 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        <Building className="w-8 h-8 mx-auto mb-2 text-primary-400" />
                                        <div className="text-white font-semibold">الدور {floor}</div>
                                        <div className="text-sm text-white/60">
                                            {roomsByFloor[floor].length} غرفة
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    ) : (
                        // Rooms list
                        <div className="grid grid-cols-3 gap-3">
                            {roomsByFloor[selectedFloor]?.map((room) => (
                                <button
                                    key={room.id}
                                    onClick={() => handleSelectRoom(room.roomNumber)}
                                    className={`p-4 rounded-xl transition-all ${room.isOccupied
                                            ? 'bg-green-500/20 border-2 border-green-500/50 hover:bg-green-500/30'
                                            : 'bg-white/10 hover:bg-white/20'
                                        }`}
                                >
                                    <DoorOpen className={`w-6 h-6 mx-auto mb-2 ${room.isOccupied ? 'text-green-400' : 'text-white/70'
                                        }`} />
                                    <div className="text-white font-semibold">{room.roomNumber}</div>
                                    {room.isOccupied && (
                                        <div className="text-xs text-green-400 mt-1">مشغولة</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomSelector;
