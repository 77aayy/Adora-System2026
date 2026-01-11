import React, { useState, useEffect } from 'react';
import { X, ArrowLeft, Building2 } from 'lucide-react';

interface FloorRoomSelectorProps {
    rooms: string[];
    selectedRoom: string | null;
    onSelect: (room: string) => void;
    isOpen: boolean;
    onClose: () => void;
    blockedRooms?: string[]; // Rooms to hide
}

export const FloorRoomSelector: React.FC<FloorRoomSelectorProps> = ({
    rooms,
    selectedRoom,
    onSelect,
    isOpen,
    onClose,
    blockedRooms = []
}) => {
    const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
    const [roomsByFloor, setRoomsByFloor] = useState<Record<number, string[]>>({});

    useEffect(() => {
        // Group rooms by floor
        const grouped: Record<number, string[]> = {};
        rooms.forEach(room => {
            // Skip blocked rooms
            if (blockedRooms.includes(room)) return;

            const roomNum = parseInt(room);
            if (isNaN(roomNum)) return;

            // Hotel Pattern: 101 -> Floor 1, 205 -> Floor 2, 10 -> Floor 0 (G)
            const floor = Math.floor(roomNum / 100);
            if (!grouped[floor]) grouped[floor] = [];
            grouped[floor].push(room);
        });

        // Sort rooms in each floor
        Object.keys(grouped).forEach(floor => {
            grouped[parseInt(floor)].sort((a, b) => parseInt(a) - parseInt(b));
        });

        setRoomsByFloor(grouped);
    }, [rooms, blockedRooms]);

    const handleSelectFloor = (floor: number) => {
        setSelectedFloor(floor);
    };

    const handleSelectRoom = (room: string) => {
        onSelect(room);
        onClose();
        setSelectedFloor(null);
    };

    const handleBack = () => {
        setSelectedFloor(null);
    };

    const handleClose = () => {
        setSelectedFloor(null);
        onClose();
    };

    if (!isOpen) return null;

    const floors = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60"
                onClick={handleClose}
            />
            <div 
                className="relative w-full max-w-2xl rounded-3xl p-6 animate-slide-up bg-white dark:bg-slate-800 shadow-2xl"
                style={{ border: '1px solid #e2e8f0' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    {selectedFloor !== null ? (
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>رجوع</span>
                        </button>
                    ) : (
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">اختر الدور</h3>
                    )}
                    <button
                        onClick={handleClose}
                        className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-white/70 hover:text-slate-800 dark:hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                {selectedFloor === null ? (
                    // Floors Grid
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {floors.map(floor => (
                            <button
                                key={floor}
                                onClick={() => handleSelectFloor(floor)}
                                className="rounded-xl bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 hover:border-teal-400 hover:scale-105 transition-all flex flex-col items-center justify-center gap-2 p-3"
                            >
                                <Building2 className="w-5 h-5 text-teal-500" />
                                <div className="text-center">
                                    <div className="text-lg font-bold text-slate-800 dark:text-white">
                                        {floor === 0 ? 'G' : floor}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-white/60">
                                        {roomsByFloor[floor].length} غرف
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    // Rooms Grid
                    <div>
                        <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
                            {selectedFloor === 0 ? 'الدور الأرضي' : `الدور ${selectedFloor}`}
                        </h4>
                        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-96 overflow-y-auto">
                            {roomsByFloor[selectedFloor]?.map(room => (
                                <button
                                    key={room}
                                    onClick={() => handleSelectRoom(room)}
                                    className={`
                                        py-2 px-1 rounded-lg flex items-center justify-center text-sm font-semibold
                                        transition-all hover:scale-105
                                        ${selectedRoom === room
                                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                                            : 'bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white hover:border-teal-400'
                                        }
                                    `}
                                >
                                    {room}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
