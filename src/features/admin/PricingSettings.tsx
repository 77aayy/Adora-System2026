/**
 * Pricing Settings Dashboard
 * Phase 8: Dynamic Pricing Engine
 */

import React, { useState, useEffect } from 'react';
import {
    LayoutGrid,
    CalendarDays,
    Table,
    Plus,
    Trash2,
    Edit,
    Check,
    X,
    Save,
    AlertCircle,
    Loader2,
    Printer,
    RefreshCw,
    Sparkles,
    Users,
    ArrowLeft,
    CheckCircle,
    Cloud,
    Download,
    Trophy,
    Gift
} from 'lucide-react';
import {
    getRoomTypes,
    getSeasons,
    getSeasonalPrices,
    addRoomType,
    updateRoomType,
    deleteRoomType,
    addSeason,
    deleteSeason,
    setSeasonalPrice,
    RoomTypeConfig,
    Season,
    SeasonalPrice
} from '../../services/pricingRulesService';
import { syncSeasonsFromSources, ParsedSeason } from '../../services/calendarSyncService';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { Timestamp } from 'firebase/firestore';

// ============================================================
// COMPONENTS
// ============================================================

const Tabs: React.FC<{ active: string; onSelect: (id: string) => void }> = ({ active, onSelect }) => {
    const tabs = [
        { id: 'seasons', label: 'التقويم والمواسم', icon: CalendarDays },
        { id: 'matrix', label: 'مصفوفة الأسعار', icon: Table },
    ];

    return (
        <div className="flex gap-2 p-1 rounded-xl mb-6 transition-colors duration-300" style={{ background: 'var(--theme-bg-tertiary)' }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onSelect(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${active === tab.id
                        ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

// ============================================================
// MAIN PAGE
// ============================================================

const PricingSettings: React.FC = () => {
    const { user, branchId } = useAuth();
    const { success, error: showError } = useUX();
    const tenantId = (user as any)?.tenantId;

    const [activeTab, setActiveTab] = useState('seasons');
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [types, setTypes] = useState<RoomTypeConfig[]>([]);
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [prices, setPrices] = useState<SeasonalPrice[]>([]);
    const [editingPrice, setEditingPrice] = useState<{
        roomTypeId: string,
        roomTypeName: string,
        seasonId: string,
        seasonName: string,
        price: number
    } | null>(null);

    // Load Data
    const loadAll = async () => {
        if (!tenantId || !branchId) return;
        setLoading(true);
        try {
            const [t, s, p] = await Promise.all([
                getRoomTypes(tenantId, branchId),
                getSeasons(tenantId, branchId),
                getSeasonalPrices(tenantId, branchId)
            ]);
            setTypes(t);
            setSeasons(s);
            setPrices(p);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, [tenantId, branchId]);

    // ------------------------------------------------------------
    // ROOM TYPES logic moved to RoomsManager
    // ------------------------------------------------------------

    // ------------------------------------------------------------
    // RENDER: SEASONS
    // ------------------------------------------------------------
    const [newSeason, setNewSeason] = useState({ name: '', start: '', end: '', priority: 5 });
    const handleAddSeason = async () => {
        if (!tenantId || !branchId || !newSeason.name || !newSeason.start || !newSeason.end) return;
        await addSeason(tenantId, branchId, {
            name: newSeason.name,
            startDate: Timestamp.fromDate(new Date(newSeason.start)),
            endDate: Timestamp.fromDate(new Date(newSeason.end)),
            priority: newSeason.priority
        });
        setNewSeason({ name: '', start: '', end: '', priority: 5 });
        loadAll();
    };

    const handleDeleteSeason = async (id: string) => {
        if (!confirm('حذف هذا الموسم؟')) return;
        if (!tenantId || !branchId) return;
        await deleteSeason(tenantId, branchId, id);
        success('تم حذف الموسم');
        loadAll();
    };

    // Sync seasons from external sources
    const handleSyncSeasons = async () => {
        if (!tenantId || !branchId) return;
        setSyncing(true);
        try {
            const existingNames = seasons.map(s => s.name);
            const result = await syncSeasonsFromSources(tenantId, existingNames);

            if (!result.success) {
                showError(result.errors[0] || 'فشل في المزامنة');
                return;
            }

            // Add new seasons
            for (const season of result.seasons) {
                await addSeason(tenantId, branchId, {
                    name: season.nameAr,
                    startDate: Timestamp.fromDate(season.startDate),
                    endDate: Timestamp.fromDate(season.endDate),
                    priority: 5
                });
            }

            if (result.added > 0) {
                success(`تمت إضافة ${result.added} موسم جديد`);
            } else {
                success('لا توجد مواسم جديدة للإضافة');
            }

            loadAll();
        } catch (err) {
            showError('حدث خطأ أثناء المزامنة');
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveSeasonalPrice = async () => {
        if (!tenantId || !branchId || !editingPrice) return;
        try {
            await setSeasonalPrice(
                tenantId,
                branchId,
                editingPrice.seasonId,
                editingPrice.roomTypeId,
                editingPrice.price
            );
            success('تم تحديث السعر الموسمي');
            setEditingPrice(null);
            loadAll();
        } catch (err) {
            showError('فشل التحديث');
        }
    };


    const renderSeasons = () => (
        <div className="space-y-6">
            <div className="rounded-2xl transition-colors duration-300 p-6 border-b transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-secondary)' }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="card-title text-xl font-bold flex items-center gap-2">
                        <CalendarDays className="text-orange-400" />
                        تقويم المواسم
                    </h3>
                    <button
                        onClick={handleSyncSeasons}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {syncing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Cloud className="w-4 h-4" />
                        )}
                        <span className="text-sm font-medium">مزامنة المواسم</span>
                    </button>
                </div>
                <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-slate-400 mb-1 block">اسم الموسم (مثال: رأس السنة)</label>
                        <input
                            type="text"
                            value={newSeason.name}
                            onChange={e => setNewSeason({ ...newSeason, name: e.target.value })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <div className="w-40">
                        <label className="text-xs text-slate-400 mb-1 block">يبدأ من</label>
                        <input
                            type="date"
                            value={newSeason.start}
                            onChange={e => setNewSeason({ ...newSeason, start: e.target.value })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <div className="w-40">
                        <label className="text-xs text-slate-400 mb-1 block">ينتهي في</label>
                        <input
                            type="date"
                            value={newSeason.end}
                            onChange={e => setNewSeason({ ...newSeason, end: e.target.value })}
                            className="w-full rounded-lg p-2 transition-colors duration-300"
                            style={{ background: 'var(--theme-bg-tertiary)', borderColor: 'var(--theme-border-primary)', color: 'var(--theme-text-primary)' }}
                        />
                    </div>
                    <button
                        onClick={handleAddSeason}
                        className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-lg mb-0.5"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {seasons.map(season => {
                    const startDate = season.startDate.toDate();
                    const endDate = season.endDate.toDate();
                    const now = new Date();

                    // Calculate duration
                    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                    // Calculate days until start or remaining
                    const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

                    // Status
                    const isActive = now >= startDate && now <= endDate;
                    const isPast = now > endDate;
                    const isUpcoming = daysUntilStart > 0 && daysUntilStart <= 30;

                    // Format dates
                    const startStr = startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
                    const endStr = endDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' });

                    return (
                        <div
                            key={season.id}
                            className={`rounded-2xl transition-colors duration-300 p-4 flex items-center justify-between transition transition-colors duration-300 border-r-4 ${isActive ? 'border-green-500' : isPast ? '' : isUpcoming ? 'border-orange-500' : 'border-purple-500'
                                }`}
                        >
                            <div className="flex items-center gap-4 flex-1">
                                {/* Icon with duration */}
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex flex-col items-center justify-center text-orange-400 border border-orange-500/20">
                                    <span className="text-lg font-bold">{duration}</span>
                                    <span className="text-[10px] opacity-70">يوم</span>
                                </div>

                                {/* Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-white">{season.name}</h4>
                                        {/* Status Badge */}
                                        {isActive && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                                                🔥 نشط الآن
                                            </span>
                                        )}
                                        {isUpcoming && !isActive && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                                                ⏳ بعد {daysUntilStart} يوم
                                            </span>
                                        )}
                                        {isPast && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 font-medium">
                                                انتهى
                                            </span>
                                        )}
                                        {!isActive && !isPast && !isUpcoming && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                                                📅 بعد {daysUntilStart} يوم
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 mt-1">
                                        {startStr} → {endStr}
                                    </p>
                                    {isActive && (
                                        <p className="text-xs text-green-400 mt-1">
                                            متبقي {daysUntilEnd} يوم على الانتهاء
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDeleteSeason(season.id)}
                                className="text-red-400 hover:bg-red-500/10 p-2 rounded-lg"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    );
                })}
                {seasons.length === 0 && (
                    <div className="text-center p-8 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                        لا توجد مواسم مضافة حالياً
                    </div>
                )}
            </div>
        </div>
    );

    // ------------------------------------------------------------
    // RENDER: PRICING MATRIX
    // ------------------------------------------------------------
    // ------------------------------------------------------------
    // RENDER: SMART PRICING TIMELINE (THE GENIUS MATRIX)
    // ------------------------------------------------------------
    const renderPricingTimeline = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper: Generate Timeline Segments
        const generateSegments = (type: any) => {
            const segments: any[] = [];
            let cursorDate = new Date(today);

            // Limit to next 3 stages or 1 year
            for (let i = 0; i < 3; i++) {
                // Find if cursor is inside a season
                const activeSeason = seasons.find(s => {
                    const start = s.startDate.toDate();
                    const end = s.endDate.toDate();
                    return cursorDate >= start && cursorDate <= end;
                });

                if (activeSeason) {
                    // SEASON SEGMENT
                    const endDate = activeSeason.endDate.toDate();
                    const daysDuration = Math.ceil((endDate.getTime() - cursorDate.getTime()) / (1000 * 60 * 60 * 24));

                    // Price
                    let price = type.seasonalPrice || type.basePrice;
                    const override = prices.find(p => p.seasonId === activeSeason.id && p.roomTypeId === type.id);
                    if (override && override.price > 0) price = override.price;

                    segments.push({
                        type: 'season',
                        name: activeSeason.name,
                        price,
                        startDate: new Date(cursorDate),
                        endDate: endDate,
                        daysDuration,
                        color: 'orange',
                        seasonId: activeSeason.id
                    });

                    // Move cursor
                    cursorDate = new Date(endDate);
                    cursorDate.setDate(cursorDate.getDate() + 1);

                } else {
                    // NORMAL SEGMENT (GAP)
                    // Find NEXT season start
                    const futureSeasons = seasons.filter(s => s.startDate.toDate() > cursorDate);
                    futureSeasons.sort((a, b) => a.startDate.toDate().getTime() - b.startDate.toDate().getTime());
                    const nextSeason = futureSeasons[0];

                    let endDate;
                    let name = "أيام عادية";

                    if (nextSeason) {
                        const nextStart = nextSeason.startDate.toDate();
                        const gapEndDate = new Date(nextStart);
                        gapEndDate.setDate(gapEndDate.getDate() - 1); // Day before season starts
                        endDate = gapEndDate;
                    } else {
                        // No more seasons -> Long term normal
                        const future = new Date(cursorDate);
                        future.setMonth(future.getMonth() + 3); // Show next 3 months
                        endDate = future;
                        name = "مستقر (أيام عادية)";
                    }

                    const daysDuration = Math.ceil((endDate.getTime() - cursorDate.getTime()) / (1000 * 60 * 60 * 24));

                    // If duration is negative (edge case where seasons overlap or adjacent), skip or adjust
                    if (daysDuration < 0) {
                        cursorDate.setDate(cursorDate.getDate() + 1);
                        continue;
                    }

                    segments.push({
                        type: 'normal',
                        name: name,
                        price: type.basePrice,
                        startDate: new Date(cursorDate),
                        endDate: endDate,
                        daysDuration: daysDuration + 1, // Include current day
                        color: 'teal'
                    });

                    // Move cursor
                    cursorDate = new Date(endDate);
                    cursorDate.setDate(cursorDate.getDate() + 1);
                }
            }
            return segments;
        };

        // 🖨️ Print Report Generator (Price Matrix)
        const handlePrintReport = () => {
            // Build matrix data for all room types
            const matrixRows = types.map((type, idx) => {
                // Find if there's any active season price (use first season's price as reference)
                let seasonPrice = type.seasonalPrice || type.basePrice;
                if (seasons.length > 0) {
                    const firstSeason = seasons[0];
                    const override = prices.find(p => p.seasonId === firstSeason.id && p.roomTypeId === type.id);
                    if (override && override.price > 0) {
                        seasonPrice = override.price;
                    }
                }

                return {
                    rowNum: idx + 1,
                    name: type.name,
                    capacity: type.maxOccupancy || 2,
                    dailyNormal: type.basePrice,
                    dailySeason: seasonPrice,
                    monthlyNormal: type.basePrice * 20, // 20 nights
                    monthlySeason: seasonPrice * 23 // 23 nights
                };
            });

            // Build seasons data
            const now = new Date();
            const seasonsData = seasons.map((s, idx) => {
                const start = s.startDate.toDate();
                const end = s.endDate.toDate();
                const daysUntil = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isActive = now >= start && now <= end;
                const isUpcoming = daysUntil > 0 && daysUntil <= 30;

                return {
                    num: idx + 1,
                    name: s.name,
                    startDate: start.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }),
                    endDate: end.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }),
                    daysUntil,
                    isActive,
                    isUpcoming
                };
            });

            // Smart Tips
            const activeSeason = seasonsData.find(s => s.isActive);
            const upcomingSeason = seasonsData.find(s => s.isUpcoming);

            let smartTip = '';
            if (activeSeason) {
                smartTip = `⚡ أنت حالياً في موسم "${activeSeason.name}" - تأكد من تطبيق أسعار الموسم على جميع الحجوزات الجديدة.`;
            } else if (upcomingSeason) {
                smartTip = `📅 تنبيه: موسم "${upcomingSeason.name}" يبدأ بعد ${upcomingSeason.daysUntil} يوم فقط! جهّز فريقك للأسعار الجديدة.`;
            } else if (seasons.length === 0) {
                smartTip = `💡 نصيحة: لم يتم تعريف أي مواسم بعد. أضف مواسم من تبويب "التقويم والمواسم" لتفعيل التسعير الموسمي.`;
            } else {
                smartTip = `✅ لا توجد مواسم نشطة حالياً. الأسعار العادية مطبقة.`;
            }

            // Build HTML Report
            const reportHTML = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>جدول أسعار الغرف - ${branchId || 'الفرع'}</title>
    <style>
        @page { size: A4; margin: 10mm; }
        * { font-family: 'Segoe UI', 'Cairo', 'Tajawal', sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #fff; padding: 10px; color: #1e293b; direction: rtl; font-size: 11px; }
        .header { text-align: center; margin-bottom: 10px; background: #0891b2; color: white; padding: 10px; }
        .header h1 { margin: 0; font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; border: 1px solid #0891b2; margin-bottom: 10px; }
        th { padding: 6px 4px; text-align: center; font-weight: 700; font-size: 10px; border: 1px solid #cbd5e1; }
        th.header-main { background: #0891b2; color: white; font-size: 11px; }
        th.header-normal { background: #f0fdfa; color: #0f766e; }
        th.header-season { background: #fef3c7; color: #b45309; }
        th.header-monthly { background: #e0e7ff; color: #4338ca; }
        td { padding: 5px 4px; text-align: center; border: 1px solid #e2e8f0; font-size: 10px; }
        tr:nth-child(even) { background: #f8fafc; }
        .room-name { font-weight: 600; color: #1e293b; text-align: right; padding-right: 8px; background: #f8fafc; }
        .price-normal { color: #0f766e; font-weight: 600; }
        .price-season { color: #b45309; font-weight: 700; }
        .price-monthly { color: #4338ca; font-weight: 600; }
        .sub-header { font-size: 8px; font-weight: 400; display: block; margin-top: 2px; opacity: 0.8; }
        
        /* Seasons Section */
        .section-title { background: #f59e0b; color: white; padding: 6px 10px; font-size: 11px; font-weight: 700; margin-top: 10px; }
        .seasons-table { border: 1px solid #f59e0b; }
        .seasons-table th { background: #fef3c7; color: #92400e; font-size: 9px; padding: 5px; }
        .seasons-table td { font-size: 9px; padding: 4px; }
        .active-badge { background: #22c55e; color: white; padding: 1px 5px; border-radius: 8px; font-size: 8px; }
        .upcoming-badge { background: #f59e0b; color: white; padding: 1px 5px; border-radius: 8px; font-size: 8px; }
        
        /* Smart Tip */
        .smart-tip { background: #fef3c7; border: 1px solid #f59e0b; padding: 8px 10px; margin: 10px 0; font-size: 10px; color: #92400e; }
        .smart-tip strong { color: #b45309; }
        
        /* Footer */
        .footer { text-align: center; margin-top: 15px; padding-top: 10px; border-top: 2px solid #0891b2; }
        .footer .date { font-size: 9px; color: #64748b; margin-bottom: 8px; }
        .developer { background: linear-gradient(135deg, #f0fdfa, #e0f2fe); border: 1px solid #0891b2; padding: 10px 20px; display: inline-block; border-radius: 8px; }
        .developer .name { font-size: 11px; font-weight: 700; color: #0f766e; margin-bottom: 3px; }
        .developer .contact { font-size: 9px; color: #64748b; }
        .developer .system { font-size: 8px; color: #0891b2; margin-top: 5px; font-weight: 600; }
        
        @media print {
            body { padding: 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .header, .section-title, .developer, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📋 ${branchId || 'الفرع الرئيسي'}</h1>
    </div>

    <!-- Price Matrix Table -->
    <table>
        <thead>
            <tr>
                <th class="header-main" rowspan="2" style="width: 150px;">مكونات الوحدة</th>
                <th class="header-normal" colspan="2">الأسعار اليومية</th>
                <th class="header-monthly" colspan="2">الأسعار الشهرية</th>
            </tr>
            <tr>
                <th class="header-normal" style="width: 100px;">أيام عادية</th>
                <th class="header-season" style="width: 100px;">موسم</th>
                <th class="header-monthly" style="width: 120px;">
                    الشهري أيام العادية
                    <span class="sub-header">السعر × 20 ليلة</span>
                </th>
                <th class="header-monthly" style="width: 120px;">
                    الشهري بالموسم
                    <span class="sub-header">السعر × 23 ليلة</span>
                </th>
            </tr>
        </thead>
        <tbody>
            ${matrixRows.map(row => `
                <tr>
                    <td class="room-name">${row.name}</td>
                    <td class="price-normal">${row.dailyNormal.toLocaleString('ar-EG')}</td>
                    <td class="price-season">${row.dailySeason.toLocaleString('ar-EG')}</td>
                    <td class="price-monthly">${row.monthlyNormal.toLocaleString('ar-EG')}</td>
                    <td class="price-monthly">${row.monthlySeason.toLocaleString('ar-EG')}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <!-- Smart Tip -->
    <div class="smart-tip">
        <strong>💡 نصيحة ذكية:</strong> ${smartTip}
    </div>

    <!-- Seasons Calendar -->
    ${seasons.length > 0 ? `
    <div class="section-title">📅 تقويم المواسم</div>
    <table class="seasons-table">
        <thead>
            <tr>
                <th style="width: 40px;">#</th>
                <th style="width: 150px;">اسم الموسم</th>
                <th style="width: 120px;">تاريخ البداية</th>
                <th style="width: 120px;">تاريخ النهاية</th>
                <th style="width: 100px;">الحالة</th>
            </tr>
        </thead>
        <tbody>
            ${seasonsData.map(s => `
                <tr>
                    <td>${s.num}</td>
                    <td style="font-weight: 600;">${s.name}</td>
                    <td>${s.startDate}</td>
                    <td>${s.endDate}</td>
                    <td>
                        ${s.isActive
                    ? '<span class="active-badge">🔥 نشط الآن</span>'
                    : s.isUpcoming
                        ? `<span class="upcoming-badge">⏳ بعد ${s.daysUntil} يوم</span>`
                        : s.daysUntil < 0
                            ? '<span style="color:#94a3b8;font-size:11px;">انتهى</span>'
                            : '<span style="color:#64748b;font-size:11px;">قادم</span>'
                }
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ` : '<p style="text-align:center;color:#94a3b8;padding:20px;">لم يتم تعريف أي مواسم بعد</p>'}

    <!-- Footer -->
    <div class="footer" style="margin-top: 30px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px;">
        <p style="font-size: 9px; color: #94a3b8; font-family: sans-serif;">Dev by Ayman Abu Wardeh</p>
    </div>

    <script>
        window.onload = function() { window.print(); };
    </script>
</body>
</html>
            `;

            // Open in new window for printing
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(reportHTML);
                printWindow.document.close();
            }
        };

        return (
            <div className="space-y-6">
                {/* Header Info */}
                <div className="rounded-2xl transition-colors duration-300 p-6 border-b border-white/5" style={{ background: 'var(--theme-bg-secondary)' }}>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
                                <Sparkles className="text-purple-400" />
                                المخطط الزمني للأسعار (Smart Forecast)
                            </h3>
                            <p className="text-sm text-slate-400">
                                نظرة مستقبلية ذكية تعرض تسلسل تغير الأسعار من اليوم وحتى المواسم القادمة.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Print Button */}
                            <button
                                onClick={handlePrintReport}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all active:scale-95"
                            >
                                <Printer className="w-4 h-4" />
                                <span className="text-sm font-medium">طباعة التقرير</span>
                            </button>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                <span className="text-xs text-teal-400 font-bold">أيام عادية</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className="text-xs text-orange-400 font-bold">موسم</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline Rows */}
                <div className="grid grid-cols-1 gap-6">
                    {types.map(type => {
                        const segments = generateSegments(type);
                        const firstSegment = segments[0];
                        const isUrgent = firstSegment.daysDuration <= 7 && segments.length > 1;

                        return (
                            <div key={type.id} className="rounded-2xl transition-colors duration-300 p-0 overflow-hidden group relative transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}>
                                {/* Room Name Header (Vertical on Desktop) */}
                                <div className="absolute right-0 top-0 bottom-0 w-12 bg-slate-800/50 hidden md:flex items-center justify-center border-l border-white/5 z-10">
                                    <h4 className="text-white font-bold -rotate-90 whitespace-nowrap tracking-wider text-sm">{type.name}</h4>
                                </div>

                                {/* Mobile Header */}
                                <div className="md:hidden p-4 bg-slate-800/50 border-b border-white/5 font-bold text-white flex justify-between">
                                    <span>{type.name}</span>
                                    <span className="text-xs text-slate-400 flex items-center gap-1"><Users className="w-3 h-3" /> {type.maxOccupancy}</span>
                                </div>

                                <div className="p-6 md:pr-20 overflow-x-auto">
                                    <div className="flex items-stretch gap-0 min-w-max pb-4">

                                        {/* Render Segments */}
                                        {segments.map((seg, idx) => {
                                            const isLast = idx === segments.length - 1;
                                            const isCurrent = idx === 0;

                                            // Connector Line (if not last)
                                            // Calculate urgency for connector
                                            const isNextSoon = seg.daysDuration <= 5;

                                            return (
                                                <div key={idx} className="flex items-center">

                                                    {/* The Card */}
                                                    <div className={`relative flex flex-col p-4 rounded-2xl border transition-all hover:scale-105 duration-300 w-64 ${isCurrent
                                                        ? (seg.type === 'season' ? 'bg-orange-500/10 border-orange-500/30' : 'bg-teal-500/10 border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.1)]')
                                                        : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'
                                                        }`}>
                                                        {isCurrent && (
                                                            <div className="absolute -top-3 right-4 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-white/20 text-white shadow-sm">
                                                                أنت هنا (اليوم)
                                                            </div>
                                                        )}

                                                        <div className="flex justify-between items-start mb-3">
                                                            <div className={`text-xs font-bold px-2 py-1 rounded-lg ${seg.type === 'season' ? 'text-orange-400 bg-orange-400/10' : 'text-teal-400 bg-teal-400/10'
                                                                }`}>
                                                                {seg.name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {seg.daysDuration} يوم
                                                            </div>
                                                            {seg.type === 'season' && (
                                                                <button
                                                                    onClick={() => setEditingPrice({
                                                                        roomTypeId: type.id,
                                                                        roomTypeName: type.name,
                                                                        seasonId: seg.seasonId,
                                                                        seasonName: seg.name,
                                                                        price: seg.price
                                                                    })}
                                                                    className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-all ml-1"
                                                                >
                                                                    <Edit className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="mt-auto">
                                                            <div className="flex justify-between items-end mb-2">
                                                                <div>
                                                                    <div className="text-[10px] text-slate-400 mb-0.5">سعر الاستقبال</div>
                                                                    <div className="flex items-baseline gap-1">
                                                                        <span className={`text-xl font-bold ${seg.type === 'season' ? 'text-orange-400' : 'text-teal-400'}`}>
                                                                            {seg.price}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500">SAR</span>
                                                                    </div>
                                                                </div>

                                                                <div className="text-left">
                                                                    <div className="text-[10px] text-blue-300/70 mb-0.5">Booking.com</div>
                                                                    <div className="flex items-baseline gap-1 justify-end">
                                                                        <span className="text-lg font-bold text-blue-400">
                                                                            {Math.round(seg.price * (1 + Number(type.bookingRate || 0) / 100))}
                                                                        </span>
                                                                        <span className="text-[10px] text-blue-500/70">SAR</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 flex items-center gap-1">
                                                                <CalendarDays className="w-3 h-3" />
                                                                {seg.startDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} - {seg.endDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Connector */}
                                                    {!isLast && (
                                                        <div className="flex flex-col items-center justify-center px-2 relative -mx-2 z-0 w-32 min-w-[5rem]">
                                                            {/* Line */}
                                                            <div className="w-full h-0.5 bg-gradient-to-l from-white/5 via-white/20 to-white/5" />

                                                            {/* Arrow Head */}
                                                            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-[#0f172a] p-1.5 rounded-full border border-white/10">
                                                                <ArrowLeft className="w-3 h-3 text-white/50" />
                                                            </div>

                                                            {/* Duration Label on Line */}
                                                            <div className="absolute -top-9 text-[11px] text-slate-400 font-medium text-center w-full whitespace-nowrap">
                                                                بعد {seg.daysDuration} يوم
                                                            </div>

                                                            {/* Urgency Alert on Connector */}
                                                            {isCurrent && isUrgent && (
                                                                <div className="absolute -bottom-8 animate-bounce">
                                                                    <div className="bg-red-500/90 text-white text-[10px] px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1" style={{ backdropFilter: 'none' }}>
                                                                        <AlertCircle className="w-3 h-3" />
                                                                        تغيير قريب
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Future Infinite Fade */}
                                        <div className="w-32 flex items-center justify-center opacity-30 px-4">
                                            <div className="text-center">
                                                <div className="w-12 h-12 rounded-full border border-dashed border-white/30 flex items-center justify-center mx-auto mb-2">
                                                    <ArrowLeft className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-[10px] text-white">المستقبل...</span>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {types.length === 0 && (
                    <div className="p-12 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">
                        لا توجد أنواع غرف لعرضها
                    </div>
                )}
            </div>
        );
    };

    // ------------------------------------------------------------
    // RENDER: CHALLENGE REWARDS (MOVED TO POINTS CONFIG)
    // ------------------------------------------------------------
    // Logic moved to src/features/admin/PointsConfiguration.tsx

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto min-h-screen">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
                    <LayoutGrid className="text-teal-500" />
                    إعدادات التسعير
                </h1>
                <p className="text-slate-400 font-medium">إدارة المواسم، مصفوفة التكاليف والتسعير الذكي</p>
            </header>

            <div className="flex bg-slate-900/50 p-1 rounded-xl mb-6 w-fit border border-white/5">
                {[
                    { id: 'seasons', label: 'المواسم والفترات', icon: <CalendarDays className="w-4 h-4" /> },
                    { id: 'matrix', label: 'مصفوفة الأسعار', icon: <Table className="w-4 h-4" /> }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold transition-all relative overflow-hidden ${activeTab === tab.id
                            ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-24 gap-4">
                    <Loader2 className="w-10 h-10 text-teal-500 animate-spin" />
                    <p className="text-slate-400 font-bold animate-pulse">جاري تحميل البيانات...</p>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === 'seasons' && renderSeasons()}
                    {activeTab === 'matrix' && renderPricingTimeline()}
                </div>
            )}

            {/* Editing Price Modal */}
            {editingPrice && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90" onClick={() => setEditingPrice(null)} style={{ backdropFilter: 'none' }} />
                    <div className="relative w-full max-w-sm rounded-3xl p-6 border border-white/10 animate-slide-up" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}>
                        <h3 className="text-xl font-bold text-white mb-2">تعديل سعر الموسم</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            تحديث سعر <span className="text-teal-400 font-bold">{editingPrice.roomTypeName}</span> خلال <span className="text-orange-400 font-bold">{editingPrice.seasonName}</span>
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">السعر الجديد (SAR)</label>
                                <input
                                    type="number"
                                    value={editingPrice.price}
                                    onChange={(e) => setEditingPrice({ ...editingPrice, price: Number(e.target.value) })}
                                    className="input text-center text-2xl font-bold text-teal-400"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={() => setEditingPrice(null)}
                                    className="py-3 rounded-xl text-white font-bold hover:bg-white/5 transition-all"
                                    style={{ background: 'var(--theme-bg-tertiary)' }}
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={handleSaveSeasonalPrice}
                                    className="py-3 rounded-xl bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition-all"
                                >
                                    حفظ التعديل
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PricingSettings;
