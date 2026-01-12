/**
 * Analytics Dashboard
 * Interactive charts and analytics for owner
 * Adora Hotel Management System V3
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Users, Building2, DollarSign, Activity, Download, FileText, ArrowLeft } from 'lucide-react';
import { getSystemAnalytics, getTenantAnalytics } from '../../services/analyticsService';
import { LineChart, BarChart, DoughnutChart } from '../../components/analytics/ChartComponents';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';
import { useAllBranchesForOwner } from '../../hooks/useTenantData'; // ✅ SaaS Integration
import { StatCard } from '../../components/common/StatCard'; // ✅ Use project StatCard
import { useUX } from '../../context/UXContext';

export const AnalyticsDashboard: React.FC = () => {
    const navigate = useNavigate();
    // ✅ SaaS Integration: Get all branches dynamically
    const { branches: allBranches, loading: branchesLoading } = useAllBranchesForOwner();
    const { success, error } = useUX();
    
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

    useEffect(() => {
        loadAnalytics();
    }, [selectedPeriod]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const data = await getSystemAnalytics();
            setAnalytics(data);
        } catch (error) {
            console.error('Error loading analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || branchesLoading) {
        return (
            <PageTransition>
                <div className="min-h-screen flex items-center justify-center theme-page">
                    <div className="text-center">
                        <Activity className="w-12 h-12 text-teal-400 animate-spin mx-auto mb-4" />
                        <p className="text-white/60">جاري تحميل الإحصائيات...</p>
                    </div>
                </div>
            </PageTransition>
        );
    }

    if (!analytics) {
        return (
            <PageTransition>
                <div className="min-h-screen flex items-center justify-center theme-page">
                    <div className="text-center">
                        <p className="text-white/60">فشل تحميل الإحصائيات</p>
                    </div>
                </div>
            </PageTransition>
        );
    }

    // Prepare chart data
    const revenueData = {
        labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
        datasets: [{
            label: 'الإيرادات (ر.س)',
            data: [5000, 7500, 6000, 9000, 8500, 10000],
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)'
        }]
    };

    const tenantDistributionData = {
        labels: ['Basic', 'Pro', 'Enterprise'],
        datasets: [{
            data: [
                analytics.planDistribution?.basic || 0,
                analytics.planDistribution?.pro || 0,
                analytics.planDistribution?.enterprise || 0
            ],
            backgroundColor: [
                'rgba(59, 130, 246, 0.8)',
                'rgba(20, 184, 166, 0.8)',
                'rgba(251, 191, 36, 0.8)'
            ]
        }]
    };

    const usageData = {
        labels: ['الطلبات', 'المستخدمين', 'الفروع', 'الغرف'],
        datasets: [{
            label: 'الاستخدام',
            data: [
                analytics.totalRequests || 0,
                analytics.totalUsers || 0,
                analytics.totalBranches || 0,
                analytics.totalRooms || 0
            ],
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
                    title="لوحة التحليلات"
                    titleIcon={<TrendingUp className="w-6 h-6" />}
                    subtitle={`${allBranches.length} فرع نشط • إحصائيات شاملة للنظام`}
                    actions={[
                        {
                            id: 'back',
                            icon: <ArrowLeft className="w-5 h-5" />,
                            label: 'العودة',
                            onClick: () => navigate('/owner-dashboard'),
                            variant: 'default' as const,
                            showOnMobile: true
                        },
                        {
                            id: 'export-pdf',
                            icon: <FileText className="w-4 h-4" />,
                            label: 'PDF',
                            onClick: () => {
                                try {
                                    exportToPDF(analytics, 'analytics-report.pdf');
                                    success('تم تصدير التقرير PDF بنجاح');
                                } catch (err) {
                                    console.error('PDF export failed:', err);
                                    error('فشل تصدير PDF');
                                }
                            },
                            variant: 'default' as const
                        },
                        {
                            id: 'export-excel',
                            icon: <Download className="w-4 h-4" />,
                            label: 'Excel',
                            onClick: () => {
                                try {
                                    exportToExcel(analytics, 'analytics-report.xlsx');
                                    success('تم تصدير التقرير Excel بنجاح');
                                } catch (err) {
                                    console.error('Excel export failed:', err);
                                    error('فشل تصدير Excel');
                                }
                            },
                            variant: 'default' as const
                        }
                    ]}
                />
                
                {/* Period Selector - Below Header */}
                <div className="max-w-7xl mx-auto px-6 mb-4">
                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value as any)}
                        className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                    >
                        <option value="day">اليوم</option>
                        <option value="week">الأسبوع</option>
                        <option value="month">الشهر</option>
                        <option value="year">السنة</option>
                    </select>
                </div>

                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* Quick Stats - ✅ Using project StatCard */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            icon={Building2}
                            iconColor="purple"
                            label="🏢 إجمالي الفروع"
                            count={allBranches.length}
                            lastUpdate="تم التحديث الآن"
                            trend={`+${analytics.newTenantsThisMonth || 0} هذا الشهر`}
                        />
                        <StatCard
                            icon={Users}
                            iconColor="blue"
                            label="👥 إجمالي المستخدمين"
                            count={analytics.totalUsers || 0}
                            lastUpdate="تم التحديث الآن"
                            trend="—"
                        />
                        <StatCard
                            icon={DollarSign}
                            iconColor="green"
                            label="💰 الإيرادات الشهرية"
                            value={`${(analytics.monthlyRecurringRevenue || 0).toLocaleString()} ر.س`}
                            lastUpdate="تم التحديث الآن"
                            trend="—"
                        />
                        <StatCard
                            icon={Activity}
                            iconColor="orange"
                            label="📋 الطلبات اليوم"
                            count={analytics.totalRequestsToday || 0}
                            lastUpdate="تم التحديث الآن"
                            trend="—"
                        />
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass rounded-2xl p-6">
                            <LineChart
                                data={revenueData}
                                title="الإيرادات الشهرية"
                                height="300px"
                            />
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <DoughnutChart
                                data={tenantDistributionData}
                                title="توزيع الخطط"
                                height="300px"
                            />
                        </div>

                        <div className="glass rounded-2xl p-6 lg:col-span-2">
                            <BarChart
                                data={usageData}
                                title="مقارنة الاستخدام"
                                height="300px"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PageTransition>
    );
};

export default AnalyticsDashboard;