/**
 * Coffee Shop Dashboard
 * Manage coffee shop orders from QR codes and reception
 * Adora Hotel Management System V2
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    Coffee, Clock, CheckCircle2, AlertCircle,
    Package, Search, Filter, X, User, Building2, ShoppingCart,
    QrCode, Check, Eye, LogOut, MessageSquare, BookOpen
} from 'lucide-react';
import { HeaderButton } from '../../components/common/HeaderButton';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTenant } from '../../context/TenantContext';
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
import { ProcurementCart } from '../../components/shared/ProcurementCart'; // ✅ Procurement cart
import { PointsTracker } from '../../components/shared/PointsTracker'; // ✅ Points tracker
import { SupportTicketModal } from '../../components/shared/SupportTicketModal'; // ✅ Support ticket modal
import { ManagerAnnouncementBanner } from '../../components/shared/ManagerAnnouncementBanner'; // ✅ Manager announcements banner
import { GeneralInstructionsView } from '../../components/shared/GeneralInstructionsView'; // ✅ General instructions view
import { TransferNotificationBadge } from '../../components/guest/TransferNotificationBadge'; // ✅ Room transfer notifications
import { useBrandName } from '../../hooks/useBrandName';
import { ChallengeTimeline } from '../../components/features/ChallengeTimeline'; // ✅ Challenge Timeline

// ============================================================
// TYPES
// ============================================================

type TabType = 'pending' | 'in_progress' | 'completed';

// ============================================================
// MAIN COMPONENT
// ============================================================

export const CoffeeShopDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { success, error } = useUX();
    const { tenantId } = useTenant();
    const brandName = useBrandName();

    const branchId = useMemo(() => (user as any)?.branch || (user as any)?.branchId || 'default', [user]);

    // State
    const [orders, setOrders] = useState<CoffeeShopOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState<TabType>('pending');
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

    // Group orders
    const groupedOrders = useMemo(() => {
        return {
            pending: orders.filter(o => o.status === 'pending' || o.status === 'confirmed'),
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
            error('يجب تسجيل الدخول أولاً');
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

            success('تم إكمال الطلب بنجاح');
        } catch (err: any) {
            console.error('Error completing order:', err);
            error('فشل إكمال الطلب: ' + (err.message || 'خطأ غير معروف'));
        } finally {
            setCompleting(false);
        }
    };

    // Calculate time elapsed
    const getTimeElapsed = (timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const diff = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diff < 1) return 'الآن';
        if (diff < 60) return `${diff} د`;
        if (diff < 1440) return `${Math.floor(diff / 60)} س`;
        return `${Math.floor(diff / 1440)} ي`;
    };

    // Format date
    const formatDate = (timestamp: any): string => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short'
        });
    };

    if (loading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center min-h-screen theme-page">
                    <AdoraLoader size="lg" message="جاري تحميل البيانات..." />
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition>
            {/* Manager Announcement Banner */}
            <ManagerAnnouncementBanner department="coffee_shop" />
            
            <div className="min-h-screen p-2 xs:p-3 sm:p-4 md:p-5 lg:p-6 pb-16 sm:pb-20 md:pb-24 overflow-x-hidden transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                {/* Header */}
                <FlexibleHeader
                    title="كوفي شوب"
                    showGreeting={true}
                    brandName={brandName}
                    subtitle={<PointsTracker employeeId={user?.id || ''} inline showHistory />}
                    actions={[
                        {
                            id: 'instructions',
                            icon: <BookOpen className="w-5 h-5" />,
                            label: 'تعليمات عامة',
                            onClick: () => setShowGeneralInstructions(true),
                            variant: 'primary'
                        },
                        {
                            id: 'procurement',
                            icon: <ShoppingCart className="w-5 h-5" />,
                            label: 'المشتريات',
                            onClick: () => setShowProcurement(true)
                        },
                        {
                            id: 'support',
                            icon: <MessageSquare className="w-5 h-5" />,
                            label: 'دعم فني',
                            onClick: () => setShowSupportTicket(true),
                            variant: 'warning'
                        },
                        {
                            id: 'logout',
                            icon: <LogOut className="w-5 h-5" />,
                            label: 'تسجيل خروج',
                            onClick: logout,
                            variant: 'danger'
                        }
                    ]}
                />

                {/* ✅ Room Transfer Notifications */}
                <div className="flex justify-end mb-3">
                    <TransferNotificationBadge department="coffee_shop" />
                </div>

                {/* Stats - الكروت الإحصائية */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                    <StatCard
                        count={groupedOrders.pending.length}
                        label="⏳ في الانتظار"
                        icon={<AlertCircle />}
                        iconColor="orange"
                        status={groupedOrders.pending.length > 10 ? 'warning' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                        trend="—"
                    />
                    <StatCard
                        count={groupedOrders.in_progress.length}
                        label="☕ قيد التحضير"
                        icon={<Clock />}
                        iconColor="blue"
                        status={groupedOrders.in_progress.length > 15 ? 'warning' : 'normal'}
                        lastUpdate="تم التحديث الآن"
                        trend="—"
                    />
                    <StatCard
                        count={groupedOrders.completed.length}
                        label="✅ مكتمل"
                        icon={<CheckCircle2 />}
                        iconColor="green"
                        status="success"
                        lastUpdate="تم التحديث الآن"
                        trend="—"
                    />
                </div>

                {/* ✅ تايم لاين الالتزام - تصميم H Rewards */}
                <div className="mb-4">
                    <ChallengeTimeline />
                </div>

                {/* Search */}
                <div className="relative mb-4">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 adora-text-tertiary" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="adora-input w-full pr-12 pl-4 py-3 rounded-xl"
                        placeholder="بحث بالغرفة أو النزيل..."
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                        { key: 'pending', label: 'في الانتظار', count: groupedOrders.pending.length },
                        { key: 'in_progress', label: 'قيد التحضير', count: groupedOrders.in_progress.length },
                        { key: 'completed', label: 'مكتمل', count: groupedOrders.completed.length }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setCurrentTab(tab.key as TabType)}
                            className={`flex-shrink-0 px-4 py-2.5 rounded-xl font-medium transition-all ${currentTab === tab.key
                                ? 'bg-teal-500 text-white shadow-lg'
                                : 'adora-btn-ghost'
                                }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Orders List */}
                <div className="space-y-3">
                    {currentOrders.length === 0 ? (
                        <div className="adora-card rounded-2xl transition-colors duration-300 p-12 text-center">
                            <Coffee className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                            <p className="adora-text-tertiary">لا توجد طلبات في هذه القائمة</p>
                        </div>
                    ) : (
                        currentOrders.map(order => (
                            <div
                                key={order.id}
                                className="rounded-2xl transition-colors duration-300 p-4 hover:scale-[1.01] transition-all"
                                style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-primary)' }}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                            {order.source === 'qr' ? (
                                                <QrCode className="w-6 h-6 text-amber-400" />
                                            ) : (
                                                <ShoppingCart className="w-6 h-6 text-amber-400" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-lg">غرفة {order.roomNumber}</p>
                                            {order.guestName && (
                                                <p className="text-white/60 text-sm">{order.guestName}</p>
                                            )}
                                            <p className="adora-text-tertiary text-xs flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3" />
                                                {formatDate(order.createdAt)} • {getTimeElapsed(order.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-teal-400 font-bold text-lg">{order.totalAmount} ر.س</p>
                                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                            order.status === 'pending' || order.status === 'confirmed' ? 'bg-yellow-500/20 text-yellow-400' :
                                            order.status === 'preparing' || order.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                                            order.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                            {order.status === 'pending' ? 'في الانتظار' :
                                             order.status === 'confirmed' ? 'مؤكد' :
                                             order.status === 'preparing' ? 'قيد التحضير' :
                                             order.status === 'ready' ? 'جاهز' :
                                             order.status === 'delivered' ? 'تم التسليم' :
                                             'ملغى'}
                                        </span>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="space-y-2 mb-3">
                                    {order.items.map((item, idx) => (
                                        <div key={idx} className="adora-card flex items-center justify-between p-2 rounded-lg">
                                            <div>
                                                <p className="text-white text-sm font-medium">{item.productName}</p>
                                                <p className="text-white/50 text-xs">الكمية: {item.quantity} × {item.unitPrice} ر.س</p>
                                            </div>
                                            <p className="text-teal-400 font-bold">{item.totalPrice} ر.س</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                    <div className="flex gap-2 pt-3 border-t border-white/10">
                                        {(order.status === 'pending' || order.status === 'confirmed') && (
                                            <button
                                                onClick={() => updateOrderStatus(order.id, 'preparing')}
                                                className="flex-1 py-2 rounded-xl bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 transition-all"
                                            >
                                                بدء التحضير
                                            </button>
                                        )}
                                        {(order.status === 'preparing' || order.status === 'ready') && (
                                            <button
                                                onClick={() => handleComplete(order)}
                                                disabled={completing}
                                                className="flex-1 py-2 rounded-xl bg-green-500 text-white font-bold hover:bg-primary-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {completing ? (
                                                    <AdoraLoaderInline size={16} />
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        تم الإنهاء
                                                    </>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* Notes */}
                                {order.notes && (
                                    <div className="mt-3 p-2 adora-card rounded-lg">
                                        <p className="adora-text-secondary text-xs">ملاحظات:</p>
                                        <p className="text-white/80 text-sm">{order.notes}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Procurement Cart Modal */}
                <ProcurementCart
                    isOpen={showProcurement}
                    onClose={() => setShowProcurement(false)}
                    department="coffee_shop"
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
