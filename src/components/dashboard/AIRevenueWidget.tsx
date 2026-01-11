import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { getRoomStatsByType } from '../../services/roomService';
import { getPricingRecommendation, PricingRecommendation } from '../../services/ai/pricingService';
import { getRoomTypes, updateRoomType, getEffectiveBasePrice } from '../../services/pricingRulesService';

interface AIRevenueWidgetProps {
    tenantId: string;
    branchId: string;
}

interface RoomTypeAnalysis {
    typeId: string;
    typeName: string;
    basePrice: number;
    effectivePrice: number;
    seasonName?: string;
    occupancy: number; // Percentage
    totalRooms: number;
    occupiedRooms: number;
    recommendation: PricingRecommendation | null;
}

export const AIRevenueWidget: React.FC<AIRevenueWidgetProps> = ({ tenantId, branchId }) => {
    const [loading, setLoading] = useState(true);
    const [analyzedTypes, setAnalyzedTypes] = useState<RoomTypeAnalysis[]>([]);
    const [applyingId, setApplyingId] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Types & Stats in Parallel
            const [types, statsByType] = await Promise.all([
                getRoomTypes(tenantId, branchId),
                getRoomStatsByType(branchId, tenantId)
            ]);

            // 2. Analyze Each Type
            const analysisPromises = types.map(async (type) => {
                const typeStats = statsByType[type.id] || { total: 0, occupied: 0 };
                const occupancyRate = typeStats.total > 0 ? (typeStats.occupied / typeStats.total) * 100 : 0;

                // Get Price Info
                const priceData = await getEffectiveBasePrice(tenantId, branchId, type.id);

                // Get AI Recommendation
                const rec = await getPricingRecommendation({
                    occupancyRate: occupancyRate,
                    maintenanceLoad: 0, // Simplified for per-type
                    basePrice: priceData.price
                });

                return {
                    typeId: type.id,
                    typeName: type.name,
                    basePrice: type.basePrice || priceData.price, // Config base price
                    effectivePrice: priceData.price, // Current selling price (seasonal)
                    seasonName: priceData.seasonName,
                    occupancy: Math.round(occupancyRate),
                    totalRooms: typeStats.total,
                    occupiedRooms: typeStats.occupied,
                    recommendation: rec
                } as RoomTypeAnalysis;
            });

            const results = await Promise.all(analysisPromises);
            setAnalyzedTypes(results);

        } catch (err) {
            console.error('Revenue Widget Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (tenantId && branchId) {
            loadData();
        }
    }, [tenantId, branchId]);

    const handleApply = async (item: RoomTypeAnalysis) => {
        if (!item.recommendation || !tenantId || !branchId) return;

        setApplyingId(item.typeId);
        try {
            // Update Base Price for this room type
            await updateRoomType(tenantId, branchId, item.typeId, {
                basePrice: item.recommendation.suggestedPrice
            });

            // Optimistic Update
            setAnalyzedTypes(prev => prev.map(t => {
                if (t.typeId === item.typeId && item.recommendation) {
                    return {
                        ...t,
                        basePrice: item.recommendation.suggestedPrice,
                        effectivePrice: item.recommendation.suggestedPrice, // Assuming immediate effect if no season override
                        recommendation: { ...item.recommendation, suggestedPrice: item.recommendation.suggestedPrice, percentageChange: 0 } // Reset diff
                    };
                }
                return t;
            }));

            // alert('تم تحديث السعر لهذه الفئة بنجاح');
        } catch (err) {
            console.error('Apply Price Error:', err);
            alert('فشل تحديث السعر');
        } finally {
            setApplyingId(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 animate-pulse transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--theme-border-primary)' }}>
                <div className="flex items-center gap-3">
                    <AdoraLoaderInline size={20} />
                    <span className="transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>ذكاء الأسعار يحلل {analyzedTypes.length || '...'} أنواع الغرف...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border flex flex-col max-h-[600px] transition-colors duration-300" style={{ background: 'var(--theme-bg-primary)', borderRadius: 'var(--radius-lg)', borderColor: 'var(--theme-border-primary)' }}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0 transition-colors duration-300" style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-tertiary)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                        <h4 className="font-semibold transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>مرشد الأسعار الذكي</h4>
                        <p className="text-[10px] transition-colors duration-300" style={{ color: 'var(--theme-text-secondary)' }}>تحليل وتوصيات لكل نوع غرفة</p>
                    </div>
                </div>
                <button
                    onClick={loadData}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300"
                    style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-text-secondary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-text-secondary)'; }}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {analyzedTypes.length === 0 ? (
                    <div className="text-center py-8 transition-colors duration-300" style={{ color: 'var(--theme-text-tertiary)' }}>لا توجد أنواع غرف معرفة</div>
                ) : (
                    analyzedTypes.map((item) => {
                        const rec = item.recommendation;
                        const isPriceChanged = rec && rec.suggestedPrice !== item.effectivePrice;
                        const isApplyLoading = applyingId === item.typeId;

                        return (
                            <div key={item.typeId} className="p-3 rounded-xl border transition-all group transition-colors duration-300" style={{ background: 'var(--theme-bg-secondary)', borderColor: 'var(--theme-border-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--theme-primary-500)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--theme-border-primary)'}>
                                {/* Top Row: Name & Occupancy */}
                                <div className="flex items-center justify-between mb-3">
                                    <h5 className="font-bold text-sm transition-colors duration-300" style={{ color: 'var(--theme-text-primary)' }}>{item.typeName}</h5>
                                    <div className="flex items-center gap-2">
                                        <div className="text-[10px] text-white/40">
                                            {item.occupiedRooms}/{item.totalRooms} مشغولة
                                        </div>
                                        <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${item.occupancy >= 80 ? 'bg-purple-500/20 text-purple-400' : 'bg-white/10 text-white/60'}`}>
                                            {item.occupancy}%
                                        </div>
                                    </div>
                                </div>

                                {/* Middle Row: Prices & Recommendation */}
                                <div className="flex items-center justify-between bg-black/20 rounded-lg p-2 mb-3">
                                    {/* Current */}
                                    <div className="text-right">
                                        <div className="text-[10px] text-white/40">الحالي</div>
                                        <div className="font-mono text-white/70 line-through decoration-white/20 text-sm">{item.effectivePrice}</div>
                                    </div>

                                    <ArrowRight className="w-4 h-4 text-white/20" />

                                    {/* Suggested */}
                                    <div>
                                        <div className="text-[10px] text-primary-300">المقترح</div>
                                        <div className="font-bold text-primary-400 text-lg flex items-center gap-1">
                                            {rec ? rec.suggestedPrice : '...'}
                                            {rec && rec.percentageChange !== 0 && (
                                                <span className={`text-[10px] ${rec.percentageChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    ({rec.percentageChange > 0 ? '+' : ''}{rec.percentageChange}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Action Row - Removed Apply Button based on user feedback */}
                                {isPriceChanged && rec && (
                                    <div className="text-[10px] text-white/50 bg-white/5 px-2 py-1 rounded-lg">
                                        💡 {rec.reasoning}
                                    </div>
                                )}
                                {!isPriceChanged && (
                                    <div className="w-full text-center text-[10px] text-green-400/60 bg-green-500/5 py-1 rounded-lg flex items-center justify-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        السعر الحالي مثالي حسب معطيات السوق
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer Summary */}
            <div className="p-3 border-t border-white/10 bg-white/5 text-[10px] text-center text-white/40">
                مؤشر ذكي لمساعدتك في اتخاذ القرار (لا يقوم بأي تعديل تلقائي)
            </div>
        </div>
    );
};
