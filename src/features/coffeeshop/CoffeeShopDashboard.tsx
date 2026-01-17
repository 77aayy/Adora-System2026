/**
 * @license Property of Ayman Ahmed - Adora Hotels Management System
 * Coffee Shop Dashboard
 * Manage coffee shop orders from QR codes and reception
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Coffee, Clock, CheckCircle2, AlertCircle,
    Package, Search, Filter, X, User, Building2, ShoppingCart,
    QrCode, Check, Eye, LogOut, MessageSquare, BookOpen, Play,
    Headphones // ✅ Support ticket icon
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
import { useTranslation } from 'react-i18next';
import {
    subscribeToOrders,
    completeOrder,
    updateOrderStatus,
    CoffeeShopOrder,
} from '../../services/coffeeShopService';
import { getPointsConfig, awardPoints } from '../../services/pointsService';
import { StatCard } from '../../components/common/StatCard';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { useOnboardingTour } from '../../hooks/useOnboardingTour'; // ✅ Onboarding tour
import { TourGuide } from '../../components/shared/TourGuide'; // ✅ Tour guide component
// DeveloperSignature is now in GlobalFooter (App.tsx)
import { ProcurementCartWizard } from '../../components/shared/ProcurementCartWizard'; // ✅ Procurement cart wizard
import { PointsTracker } from '../../components/shared/PointsTracker'; // ✅ Points tracker
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications
import { useBrandName } from '../../hooks/useBrandName';
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline'; // ✅ Challenge Timeline
import { UnifiedRequestTabs } from '../../components/shared/UnifiedRequestTabs'; // ✅ Unified tabs

// ============================================================
// TYPES
// ============================================================

type TabType = 'new' | 'in_progress' | 'completed'; // ✅ Unified tabs

// ============================================================
// MAIN COMPONENT
// ============================================================

export const CoffeeShopDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { success, error } = useUX();
    const { t, i18n } = useTranslation();
    const { tenantId } = useTenant();
    const brandName = useBrandName();
    const currentLanguage = i18n.language;

    const branchId = useMemo(() => (user as any)?.branch || (user as any)?.branchId || 'default', [user]);

    // State
    const [orders, setOrders] = useState<CoffeeShopOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('new');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<CoffeeShopOrder | null>(null);
    const [completing, setCompleting] = useState(false);
    const [showProcurement, setShowProcurement] = useState(false); // ✅ Procurement cart modal
    const [showSupportTicket, setShowSupportTicket] = useState(false); // ✅ Support ticket modal
    const [showGeneralInstructions, setShowGeneralInstructions] = useState(false); // ✅ General instructions modal
    
    // ✅ FAST UI: Force show page after 2 seconds max
    useEffect(() => {
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing CoffeeShop page now');
                setLoading(false);
            }
        }, 2000);
        return () => clearTimeout(fastUITimeout);
    }, [loading]);
    
    // ✅ Onboarding Tour
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('coffeeshop');

    // Load orders
    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = subscribeToOrders(
            branchId,
            tenantId,
            undefined,
            (data) => {
                setOrders(data);
                setLoading(false);
            }
        );

        return unsubscribe;
    }, [branchId, tenantId]);

    // Group orders - ✅ Unified tabs (new, in_progress, completed)
    const groupedOrders = useMemo(() => {
        return {
            new: orders.filter(o => o.status === 'pending' || o.status === 'confirmed'),
            in_progress: orders.filter(o => o.status === 'preparing' || o.status === 'ready'),
            completed: orders.filter(o => o.status === 'delivered' || o.status === 'cancelled')
        };
    }, [orders]);

    // Current tab orders
    const currentOrders = useMemo(() => {
        let filtered = groupedOrders[currentTab];
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(order =>
                order.roomNumber.toLowerCase().includes(query) ||
                order.guestName?.toLowerCase().includes(query) ||
                order.items.some(item => item.productName.toLowerCase().includes(query))
            );
        }

        return filtered;
    }, [groupedOrders, currentTab, searchQuery]);

    // Handle complete order
    const handleComplete = async (order: CoffeeShopOrder) => {
        if (!user?.id || !user?.name) {
            error(t('common.pleaseLogin'));
            return;
        }

        setCompleting(true);
        try {
            await completeOrder(order.id, user.id, user.name);
            
            // Award points if configured
            if (tenantId) {
                try {
                    const config = await getPointsConfig(tenantId, branchId);
                    const coffeeConfig = (config as any).coffeeShop;
                    
                    if (coffeeConfig?.pointsPerOrder && tenantId) {
                        await awardPoints(
                            tenantId,
                            user.id,
                            coffeeConfig.pointsPerOrder,
                            `إكمال طلب كوفي شوب - غرفة ${order.roomNumber}`
                        );
                    }
                } catch (err) {
                    console.warn('Failed to award points:', err);
                }

                // ✅ Auto-check daily attendance when employee completes an order
                try {
                    const { checkDailyAttendance } = await import('../../services/challengeService');
                    checkDailyAttendance(tenantId, user.id).catch(err => {
                        console.warn('Failed to check daily attendance:', err);
                    });
                } catch (err) {
                    console.warn('Could not load challengeService:', err);
                }
            }

            success(t('coffeeshop.orderCompletedSuccess'));
        } catch (err: any) {
            console.error('Error completing order:', err);
            error(t('coffeeshop.orderCompletedFailed', { error: err.message || t('common.error') }));
        } finally {
            setCompleting(false);
        }
    };

    // Calculate time elapsed
    const getTimeElapsed = useCallback((timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return t('common.now');
        if (diff < 60) return `${diff} ${t('common.minutes')}`;
        if (diff < 1440) return `${Math.floor(diff / 60)} ${t('common.hours')}`;
        return `${Math.floor(diff / 1440)} ${t('common.days')}`;
    }, [t]);

    // Format date
    const formatDate = useCallback((timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'hi' ? 'hi-IN' : currentLanguage === 'bn' ? 'bn-BD' : 'en-US';
        return date.toLocaleString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
        });
    }, [currentLanguage]);

    if (loading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center min-h-screen theme-page">
                    <AdoraLoader size="lg" message={t('coffeeshop.loadingData')} />
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="coffee_shop" />
            
            {/* Spacer for UnifiedManagerHeader */}
            <div className="h-[88px] sm:h-[96px] lg:h-[92px]" />
            
            <div className="min-h-screen pb-4 sm:pb-0 relative overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
            {/* Flexible Header - Actions Only (Greeting in UnifiedManagerHeader) */}
                <FlexibleHeader
                    title={t('coffeeshop.title') || 'كوفي شوب'}
                    showGreeting={false}
                    brandName={brandName}
                    subtitle={undefined}
                    actions={[
                        {
                            id: 'procurement',
                            icon: <ShoppingCart className="w-5 h-5" />,
                            label: t('coffeeshop.procurement'),
                            onClick: () => setShowProcurement(true)
                        },
                        {
                            id: 'instructions',
                            icon: <BookOpen className="w-5 h-5" />,
                            label: 'تعليمات عامة',
                            onClick: () => setShowGeneralInstructions(true),
                            variant: 'primary'
                        },
                        {
                            id: 'support',
                            icon: <Headphones className="w-5 h-5" />,
                            label: t('coffeeshop.technicalSupport'),
                            onClick: () => setShowSupportTicket(true)
                        }
                    ]}
                />

                {/* ✅ Room Transfer Notifications */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto">
                    <div className="flex justify-end mb-3">
                        <TransferNotificationBadge department="coffee_shop" />
                    </div>
                </div>

                {/* Stats - الكروت الإحصائية */}
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
                    <StatCard
                        count={groupedOrders.new.length}
                        label="🆕 جديد"
                        icon={<AlertCircle />}
                        iconColor="orange"
                        status={groupedOrders.new.length > 10 ? 'warning' : 'normal'}
                        lastUpdate={t('coffeeshop.lastUpdate')}
                        trend="—"
                    />
                    <StatCard
                        count={groupedOrders.in_progress.length}
                        label={t('coffeeshop.inProgress')}
                        icon={<Clock />}
                        iconColor="blue"
                        status={groupedOrders.in_progress.length > 15 ? 'warning' : 'normal'}
                        lastUpdate={t('coffeeshop.lastUpdate')}
                        trend="—"
                    />
                    <StatCard
                        count={groupedOrders.completed.length}
                        label="✅ مكتمل"
                        icon={<CheckCircle2 />}
                        iconColor="green"
                        status="success"
                        lastUpdate={t('coffeeshop.lastUpdate')}
                        trend="—"
                    />
                    </div>
                </div>

                {/* ✅ تايم لاين الالتزام - تصميم H Rewards */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-3 sm:mb-4">
                    <ChallengeTimeline />
                </div>

                {/* Search */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                    <div className="relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 adora-text-tertiary" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="adora-input w-full pr-12 pl-4 py-3 rounded-xl"
                            placeholder={t('coffeeshop.searchPlaceholder')}
                        />
                    </div>
                </div>

                {/* ✅ Unified Tabs - Same as Reception */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto mb-4">
                    <UnifiedRequestTabs
                        currentTab={currentTab}
                        onTabChange={(tab) => setCurrentTab(tab)}
                        newCount={groupedOrders.new.length}
                        inProgressCount={groupedOrders.in_progress.length}
                        completedCount={groupedOrders.completed.length}
                    />
                </div>

                {/* Orders List */}
                <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-3">
                    {currentOrders.length === 0 ? (
                        <div className="adora-card rounded-2xl transition-colors duration-300 p-12 text-center">
                            <Coffee className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                            <p className="adora-text-tertiary">{t('coffeeshop.noOrdersInList')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                        {currentOrders.map(order => (
                            <div key={order.id} className="p-3 rounded-xl adora-card border adora-border shadow-sm hover:scale-[1.01] transition-all">
                                {/* Row 1: Room + Items Count + Status */}
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-10 h-10 rounded-lg flex-shrink-0 bg-amber-500/20 flex items-center justify-center">
                                        {order.source === 'qr' ? <QrCode className="w-4 h-4 text-amber-400" /> : <Coffee className="w-4 h-4 text-amber-400" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold adora-text-primary">غ.{order.roomNumber}</p>
                                        <p className="text-[10px] adora-text-tertiary truncate">{order.guestName || 'نزيل'} • {order.items.length} صنف</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                                        <span className="text-xs font-bold text-teal-500">{order.totalAmount} {t('common.rs')}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            order.status === 'pending' || order.status === 'confirmed' ? 'bg-yellow-500/20 text-yellow-500' :
                                            order.status === 'preparing' || order.status === 'ready' ? 'bg-blue-500/20 text-blue-500' :
                                            order.status === 'delivered' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {order.status === 'pending' ? t('coffeeshop.statusLabels.pending') : 
                                             order.status === 'confirmed' ? t('coffeeshop.statusLabels.confirmed') :
                                             order.status === 'preparing' ? t('coffeeshop.statusLabels.preparing') : 
                                             order.status === 'ready' ? t('coffeeshop.statusLabels.ready') :
                                             order.status === 'delivered' ? t('coffeeshop.statusLabels.delivered') : 
                                             t('coffeeshop.statusLabels.cancelled')}
                                        </span>
                                    </div>
                                </div>

                                {/* Row 2: Items Summary (First 2) */}
                                <div className="text-[10px] adora-text-secondary mb-2 px-2 py-1 rounded adora-bg-tertiary line-clamp-2">
                                    {order.items.slice(0, 2).map(i => `${i.productName} (${i.quantity})`).join(' • ')}
                                    {order.items.length > 2 && ` +${order.items.length - 2}`}
                                </div>

                                {/* Row 3: Notes */}
                                {order.notes && (
                                    <p className="text-[10px] adora-text-secondary line-clamp-1 mb-2">💬 {order.notes}</p>
                                )}

                                {/* Row 4: Actions */}
                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                    <div className="flex gap-2 pt-2 border-t adora-border">
                                        {(order.status === 'pending' || order.status === 'confirmed') && (
                                            <button onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                className="flex-1 py-1.5 px-2 rounded-lg bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1">
                                                <Play className="w-3 h-3" /> تحضير
                                            </button>
                                        )}
                                        {(order.status === 'preparing' || order.status === 'ready') && (
                                            <button onClick={() => handleComplete(order)} disabled={completing}
                                                className="flex-1 py-1.5 px-2 rounded-lg bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                                                {completing ? <AdoraLoaderInline size={12} /> : <><Check className="w-3 h-3" /> {t('coffeeshop.completeOrder')}</>}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        </div>
                    )}
                </div>

                {/* Procurement Cart Modal */}
                <ProcurementCartWizard
                    isOpen={showProcurement}
                    onClose={() => setShowProcurement(false)}
                    department="coffee_shop"
                    tenantId={tenantId || ''}
                />

                {/* Support Ticket Modal */}
                {showSupportTicket && branchId && (
                    <SupportTicketModal
                        isOpen={showSupportTicket}
                        onClose={() => setShowSupportTicket(false)}
                        branchId={branchId}
                        branchName={branchId}
                    />
                )}

                {/* General Instructions Modal */}
                <GeneralInstructionsView
                    department="coffee_shop"
                    isOpen={showGeneralInstructions}
                    onClose={() => setShowGeneralInstructions(false)}
                />

                {/* ✅ Onboarding Tour */}
                <TourGuide
                    steps={tourSteps}
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

export default CoffeeShopDashboard;
