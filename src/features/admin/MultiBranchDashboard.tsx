/**
 * Multi-Branch Dashboard
 * View statistics and operations across all branches
 */

import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, Users, Activity, ArrowRight, MapPin, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenantBranches, useAllBranchesForOwner } from '../../hooks/useTenantData';
import { detectClosestBranch } from '../../services/smartBranchService';
import { useNavigate } from 'react-router-dom';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { StatCard } from '../../components/common/StatCard';
import { LineChart, BarChart, DoughnutChart } from '../../components/analytics/ChartComponents';
import { collection, query, where, getCountFromServer, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getAllManagers } from '../../services/ownerService';
import { calculateTenantRevenue, calculateMonthlyRecurringRevenue } from '../../services/billingService';
import { logger } from '../../services/loggerService';

export const MultiBranchDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, setBranch } = useAuth();
    const isOwner = user?.role === 'owner';
    
    // ✅ SaaS Integration: Use different hooks based on role
    const { branches: managerBranches, loading: managerBranchesLoading } = useTenantBranches();
    const { branches: ownerBranches, loading: ownerBranchesLoading } = useAllBranchesForOwner();
    
    // ✅ Use appropriate branches based on role
    const rawBranches = isOwner ? ownerBranches : managerBranches;
    const branchesLoading = isOwner ? ownerBranchesLoading : managerBranchesLoading;
    const branches = Array.isArray(rawBranches) ? rawBranches : [];
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [closestBranch, setClosestBranch] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState<any>(null);

    useEffect(() => {
        if (!branchesLoading) {
            loadData();
        }
    }, [branches, branchesLoading]);

    const loadData = async () => {
        // ✅ Owner: Show all branches from all managers
        if (isOwner) {
            setLoading(true);
            try {
                // ✅ REAL DATA: Aggregate from all tenants
                let totalUsers = 0;
                let totalRequests = 0;
                let totalRooms = 0;
                let totalRevenue = 0;

                // Get all managers/tenants
                const managers = await getAllManagers();
                
                // Aggregate data from all tenants
                for (const manager of managers) {
                    const tenantId = manager.tenantId;
                    if (!tenantId) continue;

                    try {
                        // Count users for this tenant
                        const usersQuery = query(
                            collection(db, 'users'),
                            where('tenantId', '==', tenantId)
                        );
                        const usersCount = await getCountFromServer(usersQuery);
                        totalUsers += usersCount.data().count;

                        // Count requests for this tenant (from all branches)
                        const requestsQuery = query(
                            collection(db, 'requests'),
                            where('tenantId', '==', tenantId)
                        );
                        const requestsCount = await getCountFromServer(requestsQuery);
                        totalRequests += requestsCount.data().count;

                        // Count rooms for this tenant (aggregate from all branches)
                        const branchesQuery = query(
                            collection(db, `tenants/${tenantId}/branches`)
                        );
                        const branchesSnapshot = await getDocs(branchesQuery);
                        
                        for (const branchDoc of branchesSnapshot.docs) {
                            const branchId = branchDoc.id;
                            const roomsQuery = query(
                                collection(db, `tenants/${tenantId}/rooms`),
                                where('branchId', '==', branchId)
                            );
                            const roomsCount = await getCountFromServer(roomsQuery);
                            totalRooms += roomsCount.data().count;
                        }

                        // ✅ REAL DATA: Calculate revenue from billing
                        const tenantRev = await calculateTenantRevenue(tenantId);
                        totalRevenue += tenantRev;
                    } catch (err) {
                        logger.error(`Error aggregating data for tenant ${tenantId}`, err, 'MultiBranchDashboard');
                        // Continue with other tenants even if one fails
                    }
                }

                setComparisonData({
                    totalRequests,
                    totalUsers,
                    totalRooms,
                    revenue: totalRevenue
                });
            } catch (error) {
                logger.error('Error loading owner multi-branch data', error, 'MultiBranchDashboard');
                // Set to 0 on error
                setComparisonData({
                    totalRequests: 0,
                    totalUsers: 0,
                    totalRooms: 0,
                    revenue: 0
                });
            } finally {
                setLoading(false);
            }
            return;
        }

        // ✅ Manager: Use tenant-specific logic
        if (!user?.tenantId || !user?.branches) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Detect closest branch
            const closest = await detectClosestBranch(user.tenantId, user.branches);
            setClosestBranch(closest);

            // ✅ REAL DATA: Aggregate from all branches of this tenant
            let totalUsers = 0;
            let totalRequests = 0;
            let totalRooms = 0;

            // Count users for this tenant
            const usersQuery = query(
                collection(db, 'users'),
                where('tenantId', '==', user.tenantId)
            );
            const usersCount = await getCountFromServer(usersQuery);
            totalUsers = usersCount.data().count;

            // Count requests for this tenant
            const requestsQuery = query(
                collection(db, 'requests'),
                where('tenantId', '==', user.tenantId)
            );
            const requestsCount = await getCountFromServer(requestsQuery);
            totalRequests = requestsCount.data().count;

            // Count rooms for all branches of this tenant
            for (const branch of branches) {
                const branchId = branch.id;
                const roomsQuery = query(
                    collection(db, `tenants/${user.tenantId}/rooms`),
                    where('branchId', '==', branchId)
                );
                const roomsCount = await getCountFromServer(roomsQuery);
                totalRooms += roomsCount.data().count;
            }

            // ✅ REAL DATA: Calculate revenue from billing
            const tenantRevenue = await calculateTenantRevenue(user.tenantId);

            setComparisonData({
                totalRequests,
                totalUsers,
                totalRooms,
                revenue: tenantRevenue
            });
        } catch (error) {
            logger.error('Error loading multi-branch data', error, 'MultiBranchDashboard');
            // Set to 0 on error
            setComparisonData({
                totalRequests: 0,
                totalUsers: 0,
                totalRooms: 0,
                revenue: 0
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading || branchesLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center theme-page">
                <Activity className="w-12 h-12 text-teal-400 animate-spin" />
            </div>
        );
    }

    // Prepare chart data
    const branchComparisonData = {
        labels: branches.map(b => b.name || b.id),
        datasets: [{
            label: 'الطلبات',
            data: [45, 52, 38, 60], // Example data
            backgroundColor: [
                'rgba(20, 184, 166, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(168, 85, 247, 0.8)',
                'rgba(236, 72, 153, 0.8)'
            ]
        }]
    };

    return (
        <PageTransition>
            <div className="min-h-screen transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                <FlexibleHeader
                    title={isOwner ? "جميع الفروع (من جميع المشتركين)" : "لوحة متعددة الفروع"}
                    titleIcon={<Building2 className="w-6 h-6" />}
                    subtitle={isOwner 
                        ? `${branches.length} فرع نشط من جميع المشتركين • نظرة شاملة`
                        : "مقارنة وإحصائيات جميع الفروع"
                    }
                    actions={[
                        {
                            id: 'back',
                            icon: <ArrowLeft className="w-5 h-5" />,
                            label: 'العودة',
                            onClick: () => navigate(isOwner ? '/owner-dashboard' : '/admin'),
                            variant: 'default' as const,
                            showOnMobile: true
                        }
                    ]}
                />

                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* Closest Branch Alert - Only for Managers */}
                    {!isOwner && closestBranch && (
                        <div className="glass rounded-2xl p-4 border border-teal-500/30 bg-teal-500/10">
                            <div className="flex items-center gap-3">
                                <MapPin className="w-6 h-6 text-teal-400" />
                                <div className="flex-1">
                                    <h4 className="font-bold text-white mb-1">
                                        الفرع الأقرب: {closestBranch.branchName}
                                    </h4>
                                    <p className="text-sm text-white/60">
                                        المسافة: {Math.round(closestBranch.distance)} متر
                                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                            closestBranch.confidence === 'high' ? 'bg-green-500/20 text-green-400' :
                                            closestBranch.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-orange-500/20 text-orange-400'
                                        }`}>
                                            {closestBranch.confidence === 'high' ? 'ثقة عالية' :
                                             closestBranch.confidence === 'medium' ? 'ثقة متوسطة' :
                                             'ثقة منخفضة'}
                                        </span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        // Switch to closest branch
                                        setBranch(closestBranch.branchId);
                                        navigate('/admin');
                                    }}
                                    className="px-4 py-2 bg-teal-500/20 text-teal-400 rounded-xl hover:bg-teal-500/30 transition-colors flex items-center gap-2 border border-teal-500/20"
                                >
                                    <ArrowRight className="w-4 h-4" />
                                    <span>الانتقال</span>
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Owner Info Banner */}
                    {isOwner && branches.length === 0 && (
                        <div className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/10 text-center">
                            <Building2 className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-white mb-2">لا توجد فروع بعد</h3>
                            <p className="text-white/60 mb-4">
                                لم يتم إنشاء أي فروع من قبل المشتركين بعد.
                                <br />
                                يرجى إنشاء مدير أولاً من صفحة <strong>إدارة الملاك</strong>.
                            </p>
                            <button
                                onClick={() => navigate('/owner')}
                                className="px-6 py-3 bg-yellow-500/20 text-yellow-400 rounded-xl hover:bg-yellow-500/30 transition-colors border border-yellow-500/20"
                            >
                                الذهاب إلى إدارة الملاك
                            </button>
                        </div>
                    )}

                    {/* Quick Stats - Unified Style like Owner Dashboard */}
                    <div 
                        className="grid"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                            gap: '24px',
                            padding: '24px',
                        }}
                    >
                        <div className="stat-card-pro-compact">
                            <StatCard
                                icon={Building2}
                                iconColor="purple"
                                label="🏢 إجمالي الفروع"
                                count={branches.length}
                                lastUpdate="تم التحديث الآن"
                            />
                        </div>
                        <div className="stat-card-pro-compact">
                            <StatCard
                                icon={Users}
                                iconColor="blue"
                                label="👥 إجمالي المستخدمين"
                                count={comparisonData?.totalUsers || 0}
                                lastUpdate="تم التحديث الآن"
                            />
                        </div>
                        <div className="stat-card-pro-compact">
                            <StatCard
                                icon={Activity}
                                iconColor="orange"
                                label="📋 إجمالي الطلبات"
                                count={comparisonData?.totalRequests || 0}
                                lastUpdate="تم التحديث الآن"
                            />
                        </div>
                        <div className="stat-card-pro-compact">
                            <StatCard
                                icon={TrendingUp}
                                iconColor="green"
                                label="💰 الإيرادات"
                                value={`${(comparisonData?.revenue || 0).toLocaleString()} ر.س`}
                                lastUpdate="تم التحديث الآن"
                            />
                        </div>
                    </div>

                    {/* Branch Comparison Chart */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">مقارنة الفروع</h3>
                        <BarChart
                            data={branchComparisonData}
                            title="الطلبات حسب الفرع"
                            height="300px"
                        />
                    </div>

                    {/* Branch List */}
                    {branches.length > 0 && (
                        <div className="glass rounded-2xl p-6 border border-white/5">
                            <h3 className="text-xl font-bold text-white mb-4">
                                {isOwner ? 'جميع الفروع من جميع المشتركين' : 'قائمة الفروع'}
                            </h3>
                            <div className="space-y-3">
                                {branches.map((branch: any) => (
                                    <div
                                        key={branch.id || `${branch.tenantId}_${branch.id}`}
                                        className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-all border border-white/5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Building2 className="w-6 h-6 text-blue-400" />
                                                <div>
                                                    <h4 className="font-bold text-white">{branch.name || branch.id}</h4>
                                                    <p className="text-sm text-white/60">
                                                        {branch.address || 'لا يوجد عنوان'}
                                                        {isOwner && branch.managerName && (
                                                            <span className="mr-2 text-blue-400">• المدير: {branch.managerName}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            {!isOwner && (
                                                <button
                                                    onClick={() => {
                                                        setBranch(branch.id);
                                                        navigate('/admin');
                                                    }}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <ArrowRight className="w-5 h-5 text-white/40" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

export default MultiBranchDashboard;