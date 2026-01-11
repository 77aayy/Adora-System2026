/**
 * Bottleneck Alert Component
 * تنبيه الاستقبال عندما تتراكم الطلبات في قسم معين
 * 
 * ✅ Features:
 * - Flash alert when 3+ requests unaccepted in 5 minutes
 * - Auto-dismiss after acknowledgment
 * - Sound alert option
 * 
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Phone, Clock, ChevronRight } from 'lucide-react';
import { db } from '../../services/firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { playSound, haptic } from '../../utils/uxEffects';

// ============================================================
// TYPES
// ============================================================

interface BottleneckAlertProps {
    tenantId: string;
    branchId: string;
    onDepartmentClick?: (department: string) => void;
}

interface DepartmentBottleneck {
    department: string;
    departmentName: string;
    count: number;
    oldestRequestTime: Date;
    icon: string;
    color: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const BOTTLENECK_THRESHOLD = 3; // 3 requests
const TIME_THRESHOLD_MINUTES = 5; // 5 minutes

const DEPARTMENT_INFO: Record<string, { name: string; icon: string; color: string }> = {
    housekeeping: { name: 'النظافة', icon: '🧹', color: 'bg-blue-500' },
    maintenance: { name: 'الصيانة', icon: '🔧', color: 'bg-orange-500' },
    bellman: { name: 'البيلمان', icon: '🛎️', color: 'bg-purple-500' },
    coffee: { name: 'الكوفي شوب', icon: '☕', color: 'bg-amber-500' },
    room_service: { name: 'خدمة الغرف', icon: '🍽️', color: 'bg-green-500' }
};

// ============================================================
// COMPONENT
// ============================================================

export const BottleneckAlert: React.FC<BottleneckAlertProps> = ({
    tenantId,
    branchId,
    onDepartmentClick
}) => {
    const [bottlenecks, setBottlenecks] = useState<DepartmentBottleneck[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [isExpanded, setIsExpanded] = useState(true);

    // ============================================================
    // REAL-TIME LISTENER
    // ============================================================

    useEffect(() => {
        if (!tenantId || !branchId) return;

        const requestsRef = collection(db, `tenants/${tenantId}/branches/${branchId}/requests`);
        const q = query(
            requestsRef,
            where('status', 'in', ['pending', 'PENDING', 'PENDING_RECEPTION'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = new Date();
            const cutoffTime = new Date(now.getTime() - TIME_THRESHOLD_MINUTES * 60 * 1000);

            // Group requests by department/type
            const departmentCounts: Record<string, { count: number; oldest: Date }> = {};

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const createdAt = data.createdAt?.toDate() || new Date();
                const dept = data.type || data.requestType || 'other';

                // Only count requests older than threshold
                if (createdAt < cutoffTime) {
                    if (!departmentCounts[dept]) {
                        departmentCounts[dept] = { count: 0, oldest: createdAt };
                    }
                    departmentCounts[dept].count++;
                    if (createdAt < departmentCounts[dept].oldest) {
                        departmentCounts[dept].oldest = createdAt;
                    }
                }
            });

            // Find bottlenecks
            const newBottlenecks: DepartmentBottleneck[] = [];

            Object.entries(departmentCounts).forEach(([dept, data]) => {
                if (data.count >= BOTTLENECK_THRESHOLD && !dismissed.has(dept)) {
                    const info = DEPARTMENT_INFO[dept] || { name: dept, icon: '📋', color: 'bg-gray-500' };
                    newBottlenecks.push({
                        department: dept,
                        departmentName: info.name,
                        count: data.count,
                        oldestRequestTime: data.oldest,
                        icon: info.icon,
                        color: info.color
                    });
                }
            });

            // Play alert sound if new bottleneck detected
            if (newBottlenecks.length > bottlenecks.length) {
                playSound('alert');
                haptic('heavy');
            }

            setBottlenecks(newBottlenecks);
        });

        return () => unsubscribe();
    }, [tenantId, branchId, dismissed]);

    // ============================================================
    // ACTIONS
    // ============================================================

    const dismissBottleneck = useCallback((department: string) => {
        setDismissed(prev => new Set([...prev, department]));
        
        // Auto-clear dismissal after 10 minutes
        setTimeout(() => {
            setDismissed(prev => {
                const newSet = new Set(prev);
                newSet.delete(department);
                return newSet;
            });
        }, 10 * 60 * 1000);
    }, []);

    const getElapsedMinutes = (date: Date): number => {
        return Math.floor((Date.now() - date.getTime()) / 60000);
    };

    // ============================================================
    // RENDER
    // ============================================================

    if (bottlenecks.length === 0) return null;

    return (
        <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50">
            <div className={`
                bg-gradient-to-r from-orange-600 to-red-600 
                rounded-2xl shadow-2xl shadow-red-500/30
                overflow-hidden animate-pulse-slow
                border border-orange-400/30
            `}>
                {/* Header */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full p-4 flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-right">
                            <h3 className="text-white font-bold">⚠️ تنبيه تراكم!</h3>
                            <p className="text-white/80 text-sm">
                                {bottlenecks.length} قسم يحتاج تدخل فوري
                            </p>
                        </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-white/60 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Bottleneck List */}
                {isExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                        {bottlenecks.map(bottleneck => (
                            <div
                                key={bottleneck.department}
                                className="bg-white/10 rounded-xl p-3 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{bottleneck.icon}</span>
                                    <div>
                                        <p className="text-white font-medium">
                                            {bottleneck.departmentName}
                                        </p>
                                        <div className="flex items-center gap-2 text-white/70 text-xs">
                                            <span className="font-bold text-white">
                                                {bottleneck.count} طلب معلق
                                            </span>
                                            <span>•</span>
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {getElapsedMinutes(bottleneck.oldestRequestTime)} دقيقة
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Call Department */}
                                    <button
                                        onClick={() => onDepartmentClick?.(bottleneck.department)}
                                        className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                                        title="اتصل بالقسم"
                                    >
                                        <Phone className="w-4 h-4 text-white" />
                                    </button>
                                    
                                    {/* Dismiss */}
                                    <button
                                        onClick={() => dismissBottleneck(bottleneck.department)}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        title="تجاهل"
                                    >
                                        <X className="w-4 h-4 text-white/60" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Quick Action */}
                        <p className="text-center text-white/60 text-xs pt-2">
                            💡 تواصل مع القسم المعني لتسريع قبول الطلبات
                        </p>
                    </div>
                )}
            </div>

            {/* Animation Styles */}
            <style>{`
                @keyframes pulse-slow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default BottleneckAlert;
