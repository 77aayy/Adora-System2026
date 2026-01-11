/**
 * Unified History Filter Panel
 * Shared component for filtering history across departments
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect } from 'react';
import { Filter, Calendar, X } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// TYPES
// ============================================================

interface HistoryItem {
    id: string;
    [key: string]: any;
}

interface HistoryFilterProps {
    isOpen: boolean;
    onClose: () => void;
    onFilter: (items: HistoryItem[]) => void;
    collectionName: string;
    actions?: { value: string; label: string }[];
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

// ============================================================
// MAIN COMPONENT
// ============================================================

export const HistoryFilter: React.FC<HistoryFilterProps> = ({
    isOpen,
    onClose,
    onFilter,
    collectionName,
    actions = []
}) => {
    const { user } = useAuth();

    const [selectedAction, setSelectedAction] = useState('all');
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [loading, setLoading] = useState(false);

    const periods = [
        { value: 'today', label: 'اليوم' },
        { value: 'yesterday', label: 'أمس' },
        { value: 'week', label: 'آخر 7 أيام' },
        { value: 'month', label: 'آخر 30 يوم' },
        { value: 'custom', label: 'تاريخ محدد' }
    ];

    const getDateRange = (period: PeriodType): { from: Date; to: Date } => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let from: Date, to: Date;

        switch (period) {
            case 'today':
                from = new Date(today);
                to = new Date(today);
                to.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                from = new Date(today);
                from.setDate(from.getDate() - 1);
                to = new Date(today);
                to.setDate(to.getDate() - 1);
                to.setHours(23, 59, 59, 999);
                break;
            case 'week':
                from = new Date(today);
                from.setDate(from.getDate() - 7);
                to = new Date(today);
                to.setHours(23, 59, 59, 999);
                break;
            case 'month':
                from = new Date(today);
                from.setMonth(from.getMonth() - 1);
                to = new Date(today);
                to.setHours(23, 59, 59, 999);
                break;
            case 'custom':
                from = customFrom ? new Date(customFrom) : new Date(today);
                to = customTo ? new Date(customTo) : new Date(today);
                to.setHours(23, 59, 59, 999);
                break;
            default:
                from = new Date(today);
                to = new Date(today);
                to.setHours(23, 59, 59, 999);
        }

        return { from, to };
    };

    const applyFilter = async () => {
        setLoading(true);
        try {
            const { from, to } = getDateRange(selectedPeriod);

            const itemsRef = collection(db, collectionName);
            const constraints = [
                where('branch', '==', (user as any)?.branch || 'default'),
                where('createdAt', '>=', Timestamp.fromDate(from)),
                where('createdAt', '<=', Timestamp.fromDate(to))
            ];

            const q = query(itemsRef, ...constraints, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            const items: HistoryItem[] = [];
            snapshot.forEach((doc) => {
                const item = { id: doc.id, ...doc.data() };

                // Filter by action if specified
                if (selectedAction === 'all' || (item as any).type === selectedAction || (item as any).action === selectedAction) {
                    items.push(item);
                }
            });

            onFilter(items);
            onClose();
        } catch (error) {
            console.error('Failed to filter history:', error);
        } finally {
            setLoading(false);
        }
    };

    const resetFilter = () => {
        setSelectedAction('all');
        setSelectedPeriod('today');
        setCustomFrom('');
        setCustomTo('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl" style={{ border: '1px solid #e2e8f0' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                            <Filter className="w-5 h-5 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">فلترة السجل</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 dark:text-white/60 hover:text-slate-800 dark:hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Action Filter */}
                    {actions.length > 0 && (
                        <div>
                            <label className="block text-sm text-slate-600 dark:text-white/70 mb-2">نوع الإجراء</label>
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-lg text-slate-800 dark:text-white text-sm focus:outline-none focus:border-teal-400 transition-all appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-500 [&>option]:bg-white dark:[&>option]:bg-slate-700 [&>option]:text-slate-800 dark:[&>option]:text-white"
                            >
                                <option value="all">الكل</option>
                                {actions.map((action) => (
                                    <option key={action.value} value={action.value}>
                                        {action.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Period Filter */}
                    <div>
                        <label className="block text-sm text-slate-600 dark:text-white/70 mb-2">الفترة الزمنية</label>
                        <div className="grid grid-cols-2 gap-2">
                            {periods.map((period) => (
                                <button
                                    key={period.value}
                                    onClick={() => setSelectedPeriod(period.value as PeriodType)}
                                    className={`p-3 rounded-xl transition-colors ${selectedPeriod === period.value
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/20'
                                        }`}
                                >
                                    {period.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range */}
                    {selectedPeriod === 'custom' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">من تاريخ</label>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white focus:border-teal-400 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 dark:text-white/70 mb-1">إلى تاريخ</label>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-white focus:border-teal-400 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={resetFilter}
                            className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white font-medium"
                        >
                            إعادة تعيين
                        </button>
                        <button
                            onClick={applyFilter}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-medium disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                            ) : (
                                'تطبيق الفلتر'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryFilter;
