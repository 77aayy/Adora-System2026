/**
 * Billing & Subscriptions Dashboard
 * Complete billing management for owner
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, CreditCard, FileText, AlertTriangle, CheckCircle,
    Clock, Calendar, RefreshCw, Plus, Eye, Download, ArrowLeft,
    Printer, Filter, ChevronDown, X, Check, Trash2, TrendingUp,
    TrendingDown, Users, Building2, Activity, Percent, BarChart3
} from 'lucide-react';
import {
    getSubscription,
    getInvoices,
    getAllInvoices,
    getPayments,
    getExpiringSubscriptions,
    getOverdueInvoices,
    renewSubscription,
    createInvoice,
    recordPayment,
    markInvoiceAsPaid,
    getAllReceiptVouchers,
    deleteReceiptVouchers,
    deleteInvoices,
    getAllExpenseVouchers,
    createExpenseVoucher,
    deleteExpenseVouchers,
    calculateAnnualRecurringRevenue,
    calculateMonthlyRenewalRevenue,
    type ExpenseVoucher
} from '../../services/billingService';
import { getAllManagers } from '../../services/ownerService';
import { getSystemSettings } from '../../services/systemSettingsService';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { PageTransition } from '../../components/common/PageTransition';
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';
import {
    generateQRCodeURL,
    generateInvoiceQRData,
    getWatermarkStyles,
    getPaidStampHTML,
    getSecurityPatternCSS,
    getDocumentTypeColors,
    numberToArabicWords,
    formatHijriDate,
    formatGregorianDate,
    formatDateTime
} from '../../utils/printUtils';
import type { Subscription, Invoice, Payment, ReceiptVoucher } from '../../services/billingService';
import { getAllSubscriptions, calculateTotalRevenue, calculateMonthlyRecurringRevenue } from '../../services/billingService';
import { useAllBranchesForOwner } from '../../hooks/useTenantData'; // ✅ SaaS Integration
import { StatCard } from '../../components/common/StatCard'; // ✅ Use project StatCard
import { AdoraLoader } from '../../components/common/AdoraLoader'; // ✅ Custom loader
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { AdminSidebar } from '../../components/admin/AdminSidebar';

interface BillingDashboardProps {
    embedded?: boolean; // ✅ When true, hides header and transitions (for tab embedding)
}

export const BillingDashboard: React.FC<BillingDashboardProps> = ({ embedded = false }) => {
    const navigate = useNavigate();
    // ✅ SaaS Integration: Get all branches dynamically
    const { branches: allBranches, loading: branchesLoading } = useAllBranchesForOwner();
    const { success, error } = useUX();
    const { user } = useAuth();
    const { t } = useTranslation();
    const isOwner = user?.role === 'owner';
    
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [receiptVouchers, setReceiptVouchers] = useState<ReceiptVoucher[]>([]); // ✅ سندات القبض
    const [expenseVouchers, setExpenseVouchers] = useState<ExpenseVoucher[]>([]); // ✅ سندات الصرف
    const [expiring, setExpiring] = useState<Subscription[]>([]);
    const [overdue, setOverdue] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'receiptVouchers' | 'invoices' | 'expenseVouchers'>('receiptVouchers');
    
    // ✅ REAL DATA: Calculate total revenue from actual billing data - MOVED BEFORE EARLY RETURN
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [mrr, setMrr] = useState(0);
    const [arr, setArr] = useState(0);
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [netProfit, setNetProfit] = useState(0);
    const [monthlyRenewalRevenue, setMonthlyRenewalRevenue] = useState(0);
    const [newManagersThisMonth, setNewManagersThisMonth] = useState(0);
    const [renewalsThisMonth, setRenewalsThisMonth] = useState(0);
    const [collectionRate, setCollectionRate] = useState(0);
    const [averageVoucherAmount, setAverageVoucherAmount] = useState(0);
    const [todayRevenue, setTodayRevenue] = useState(0);
    const [weekRevenue, setWeekRevenue] = useState(0);
    const [monthRevenue, setMonthRevenue] = useState(0);
    const [systemSettings, setSystemSettings] = useState<any>(null);
    // ✅ State for filtered/selected vouchers (for stats)
    const [statsVouchers, setStatsVouchers] = useState<ReceiptVoucher[]>([]);
    const [statsSelectedVouchers, setStatsSelectedVouchers] = useState<Set<string>>(new Set());
    // ✅ State for filtered/selected expense vouchers (for stats)
    const [statsExpenseVouchers, setStatsExpenseVouchers] = useState<ExpenseVoucher[]>([]);
    const [statsSelectedExpenseVouchers, setStatsSelectedExpenseVouchers] = useState<Set<string>>(new Set());
    
    // ✅ FIXED: Use useCallback to prevent infinite loop in ReceiptVouchersTab
    const handleReceiptVouchersStatsUpdate = React.useCallback((filtered: ReceiptVoucher[], selected: Set<string>) => {
        setStatsVouchers(filtered);
        setStatsSelectedVouchers(selected);
    }, []);
    
    // ✅ FIXED: Use useCallback to prevent infinite loop in ExpenseVouchersTab
    const handleExpenseVouchersStatsUpdate = React.useCallback((filtered: ExpenseVoucher[], selected: Set<string>) => {
        setStatsExpenseVouchers(filtered);
        setStatsSelectedExpenseVouchers(selected);
    }, []);

    useEffect(() => {
        loadData();
        loadSystemSettings();
    }, []);
    
    const loadSystemSettings = async () => {
        try {
            const settings = await getSystemSettings();
            setSystemSettings(settings);
        } catch (error) {
            console.error('Error loading system settings:', error);
        }
    };

    useEffect(() => {
        const loadFinancialStats = async () => {
            try {
                const [
                    totalRev,
                    monthlyRev,
                    annualRev,
                    monthlyRenewalRev,
                    expenses
                ] = await Promise.all([
                    calculateTotalRevenue(),
                    calculateMonthlyRecurringRevenue(),
                    calculateAnnualRecurringRevenue(),
                    calculateMonthlyRenewalRevenue(),
                    calculateTotalExpenses()
                ]);
                
                setTotalRevenue(totalRev);
                setMrr(monthlyRev);
                setArr(annualRev);
                setMonthlyRenewalRevenue(monthlyRenewalRev);
                setTotalExpenses(expenses);
                setNetProfit(totalRev - expenses);
            } catch (error) {
                console.error('Error loading financial stats:', error);
            }
        };
        loadFinancialStats();
    }, []);

    // ✅ Calculate period-based revenue
    useEffect(() => {
        const calculatePeriodRevenue = () => {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 7);
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const todayVouchers = receiptVouchers.filter(v => {
                const voucherDate = v.createdAt instanceof Date ? v.createdAt : v.createdAt?.toDate?.() || new Date();
                return voucherDate >= todayStart && !v.isDeleted;
            });
            const weekVouchers = receiptVouchers.filter(v => {
                const voucherDate = v.createdAt instanceof Date ? v.createdAt : v.createdAt?.toDate?.() || new Date();
                return voucherDate >= weekStart && !v.isDeleted;
            });
            const monthVouchers = receiptVouchers.filter(v => {
                const voucherDate = v.createdAt instanceof Date ? v.createdAt : v.createdAt?.toDate?.() || new Date();
                return voucherDate >= monthStart && !v.isDeleted;
            });

            setTodayRevenue(todayVouchers.reduce((sum, v) => sum + v.totalAmount, 0));
            setWeekRevenue(weekVouchers.reduce((sum, v) => sum + v.totalAmount, 0));
            setMonthRevenue(monthVouchers.reduce((sum, v) => sum + v.totalAmount, 0));
        };

        if (receiptVouchers.length > 0) {
            calculatePeriodRevenue();
        }
    }, [receiptVouchers]);

    // ✅ Calculate additional stats
    useEffect(() => {
        const calculateAdditionalStats = async () => {
            try {
                // Count new managers this month
                const now = new Date();
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const managers = await getAllManagers();
                const newManagers = managers.filter(m => {
                    const createdDate = m.createdAt instanceof Date ? m.createdAt : m.createdAt?.toDate?.() || new Date();
                    return createdDate >= monthStart;
                });
                setNewManagersThisMonth(newManagers.length);

                // Count renewals this month (from receipt vouchers with renewal notes)
                const renewals = receiptVouchers.filter(v => {
                    const voucherDate = v.createdAt instanceof Date ? v.createdAt : v.createdAt?.toDate?.() || new Date();
                    const isRenewal = v.notes?.includes('تجديد') || v.notes?.includes('renewal');
                    return voucherDate >= monthStart && isRenewal && !v.isDeleted;
                });
                setRenewalsThisMonth(renewals.length);

                // Calculate collection rate (paid invoices / total invoices)
                const allInvoices = await getAllInvoices();
                const paidInvoices = allInvoices.filter(inv => inv.status === 'paid');
                const collectionRateValue = allInvoices.length > 0 
                    ? (paidInvoices.length / allInvoices.length) * 100 
                    : 0;
                setCollectionRate(collectionRateValue);

                // Calculate average voucher amount
                const activeVouchers = receiptVouchers.filter(v => !v.isDeleted);
                const avgAmount = activeVouchers.length > 0
                    ? activeVouchers.reduce((sum, v) => sum + v.totalAmount, 0) / activeVouchers.length
                    : 0;
                setAverageVoucherAmount(avgAmount);
            } catch (error) {
                console.error('Error calculating additional stats:', error);
            }
        };

        if (receiptVouchers.length > 0) {
            calculateAdditionalStats();
        }
    }, [receiptVouchers]);

    const loadData = async () => {
        setLoading(true);
        try {
            // ✅ REAL DATA: Load all subscriptions directly
            const allSubs = await getAllSubscriptions();
            setSubscriptions(allSubs);

            // ✅ Load receipt vouchers (سندات القبض)
            const vouchers = await getAllReceiptVouchers();
            setReceiptVouchers(vouchers);

            // ✅ Load expense vouchers (سندات الصرف)
            const expenseVouchersData = await getAllExpenseVouchers();
            setExpenseVouchers(expenseVouchersData);

            // ✅ Load all invoices
            const allInvs = await getAllInvoices();
            setInvoices(allInvs);

            // Load expiring subscriptions
            const expiringSubs = await getExpiringSubscriptions(7);
            setExpiring(expiringSubs);

            // Load overdue invoices
            const overdueInvs = await getOverdueInvoices();
            setOverdue(overdueInvs);
        } catch (error) {
            console.error('Error loading billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || branchesLoading) {
        // ✅ Embedded mode: simpler loading
        if (embedded) {
            return (
                <div className="flex items-center justify-center py-12">
                    <AdoraLoader size="md" message="جاري تحميل البيانات..." />
                </div>
            );
        }
        return (
            <PageTransition>
                <div className="min-h-screen flex items-center justify-center theme-page">
                    <AdoraLoader size="lg" message="جاري تحميل البيانات..." />
                </div>
            </PageTransition>
        );
    }

    const totalOverdue = overdue.reduce((sum, inv) => sum + inv.amount, 0);

    // ✅ Helper function to calculate total expenses
    const calculateTotalExpenses = async (): Promise<number> => {
        try {
            const allExpenseVouchers = await getAllExpenseVouchers();
            return allExpenseVouchers
                .filter(v => !v.isDeleted)
                .reduce((sum, v) => sum + (v.amount || 0), 0);
        } catch (error) {
            console.error('Error calculating total expenses:', error);
            return 0;
        }
    };

    // ✅ Main content - shared between embedded and standalone modes
    const mainContent = (
        <div className={embedded ? "space-y-4" : "max-w-7xl mx-auto p-6 space-y-6"}>
            {/* ✅ Comprehensive Financial Overview Cards - Always Visible */}
            <ComprehensiveFinancialStats
                totalRevenue={totalRevenue}
                totalExpenses={totalExpenses}
                netProfit={netProfit}
                mrr={mrr}
                arr={arr}
                receiptVouchers={receiptVouchers}
                expenseVouchers={expenseVouchers}
                invoices={invoices}
                overdue={overdue}
                monthlyRenewalRevenue={monthlyRenewalRevenue}
                newManagersThisMonth={newManagersThisMonth}
                renewalsThisMonth={renewalsThisMonth}
                collectionRate={collectionRate}
                averageVoucherAmount={averageVoucherAmount}
                todayRevenue={todayRevenue}
                weekRevenue={weekRevenue}
                monthRevenue={monthRevenue}
            />

            {/* ✅ Dynamic Stats - Based on active tab */}
            {activeTab === 'receiptVouchers' && (
                <ReceiptVouchersStats 
                    receiptVouchers={statsVouchers.length > 0 ? statsVouchers : receiptVouchers}
                    selectedVouchers={statsSelectedVouchers}
                />
            )}
            {activeTab === 'expenseVouchers' && (
                <ExpenseVouchersStats 
                    expenseVouchers={statsExpenseVouchers.length > 0 ? statsExpenseVouchers : expenseVouchers}
                    selectedVouchers={statsSelectedExpenseVouchers}
                />
            )}

            {/* Tabs */}
            <div className="glass rounded-2xl p-2 flex gap-2 overflow-x-auto">
                {[
                    { id: 'receiptVouchers' as const, label: 'سندات قبض', icon: CreditCard },
                    { id: 'invoices' as const, label: 'الفواتير', icon: FileText },
                    { id: 'expenseVouchers' as const, label: 'سندات الصرف', icon: DollarSign }
                ].map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-teal-500/20 text-teal-400'
                                    : 'text-white/60 hover:bg-white/5'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <div className="glass rounded-2xl p-6">
                {activeTab === 'receiptVouchers' && (
                    <ReceiptVouchersTab 
                        receiptVouchers={receiptVouchers} 
                        systemSettings={systemSettings}
                        onStatsUpdate={handleReceiptVouchersStatsUpdate}
                    />
                )}
                {activeTab === 'invoices' && (
                    <InvoicesTab invoices={invoices} overdue={overdue} />
                )}
                {activeTab === 'expenseVouchers' && (
                    <ExpenseVouchersTab 
                        expenseVouchers={expenseVouchers} 
                        systemSettings={systemSettings}
                        onRefresh={loadData}
                        onStatsUpdate={handleExpenseVouchersStatsUpdate}
                    />
                )}
            </div>
        </div>
    );

    // ✅ Embedded mode: return content directly without wrapper
    if (embedded) {
        return mainContent;
    }

    // ✅ Standalone mode: full page with header + sidebar
    return (
        <PageTransition>
            <div className="flex min-h-screen transition-colors duration-300" style={{ background: 'var(--theme-gradient-page)' }}>
                {/* ✅ ALWAYS VISIBLE SIDEBAR - Premium Professional Design */}
                <div className="desktop-sidebar-container flex-shrink-0 fixed top-0 right-0 h-screen z-30">
                    <aside id="admin-sidebar" className="h-full">
                        <AdminSidebar
                            isOwner={isOwner}
                        />
                    </aside>
                </div>

                {/* Main Content Area - Adjusted for fixed sidebar */}
                <main className="flex-1 p-4 pb-24 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col" style={{ marginRight: '280px' }}>
                    <div className="flex-1">
                        {/* Header */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                                        <DollarSign className="w-6 h-6 text-teal-400" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-white">إدارة الفواتير والاشتراكات</h1>
                                        <p className="text-sm text-white/60">{allBranches.length} فرع نشط • إدارة كاملة للفواتير والمدفوعات</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            try {
                                                exportToPDF({ subscriptions, invoices, payments }, 'billing-report.pdf');
                                                success('تم تصدير التقرير PDF بنجاح');
                                            } catch (err) {
                                                console.error('PDF export failed:', err);
                                                error('فشل تصدير PDF');
                                            }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span className="text-sm font-medium">PDF</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            try {
                                                exportToExcel({ subscriptions, invoices, payments }, 'billing-report.xlsx');
                                                success('تم تصدير التقرير Excel بنجاح');
                                            } catch (err) {
                                                console.error('Excel export failed:', err);
                                                error('فشل تصدير Excel');
                                            }
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="text-sm font-medium">Excel</span>
                                    </button>
                                    <button
                                        onClick={() => navigate('/owner-dashboard')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="text-sm font-medium">العودة</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        {mainContent}
                    </div>
                </main>
            </div>
        </PageTransition>
    );
};

// ============================================================
// STATS COMPONENTS
// ============================================================

// ✅ Simplified Financial Stats Component - Only Essential Cards
const ComprehensiveFinancialStats: React.FC<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    mrr: number;
    arr: number;
    receiptVouchers: ReceiptVoucher[];
    expenseVouchers: ExpenseVoucher[];
    invoices: Invoice[];
    overdue: Invoice[];
    monthlyRenewalRevenue: number;
    newManagersThisMonth: number;
    renewalsThisMonth: number;
    collectionRate: number;
    averageVoucherAmount: number;
    todayRevenue: number;
    weekRevenue: number;
    monthRevenue: number;
}> = ({
    totalRevenue,
    totalExpenses,
    netProfit,
    receiptVouchers,
    expenseVouchers,
    overdue
}) => {
    const totalReceiptVouchers = receiptVouchers.filter(v => !v.isDeleted).length;
    const totalExpenseVouchers = expenseVouchers.filter(v => !v.isDeleted).length;
    const totalOverdueAmount = overdue.reduce((sum, inv) => sum + inv.amount, 0);
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // ✅ Calculate receipt vouchers total
    const totalReceiptAmount = receiptVouchers
        .filter(v => !v.isDeleted)
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    // ✅ Calculate expense vouchers total
    const totalExpenseAmount = expenseVouchers
        .filter(v => !v.isDeleted)
        .reduce((sum, v) => sum + v.amount, 0);

    return (
        <div className="space-y-4">
            {/* ✅ Essential Financial KPIs - Single Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. إجمالي الإيرادات */}
                <StatCard
                    icon={TrendingUp}
                    iconColor="green"
                    label={t('admin.totalRevenue')}
                    value={`${totalRevenue.toLocaleString()} ${t('common.rs')}`}
                />
                
                {/* 2. إجمالي المصروفات */}
                <StatCard
                    icon={TrendingDown}
                    iconColor="red"
                    label={t('admin.totalExpenses')}
                    value={`${totalExpenses.toLocaleString()} ${t('common.rs')}`}
                />
                
                {/* 3. صافي الربح */}
                <StatCard
                    icon={netProfit >= 0 ? TrendingUp : TrendingDown}
                    iconColor={netProfit >= 0 ? "teal" : "orange"}
                    label={t('admin.netProfit')}
                    value={`${netProfit.toLocaleString()} ${t('common.rs')}`}
                    lastUpdate={`${profitMargin.toFixed(0)}%`}
                />

                {/* 4. سندات القبض */}
                <StatCard
                    icon={CreditCard}
                    iconColor="blue"
                    label={t('admin.receiptVouchers')}
                    count={totalReceiptVouchers}
                    lastUpdate={`${totalReceiptAmount.toLocaleString()} ${t('common.rs')}`}
                />
                
                {/* 5. سندات الصرف */}
                <StatCard
                    icon={DollarSign}
                    iconColor="purple"
                    label={t('admin.expenseVouchers')}
                    count={totalExpenseVouchers}
                    lastUpdate={`${totalExpenseAmount.toLocaleString()} ${t('common.rs')}`}
                />
                
                {/* 6. مستحقات متأخرة - Only show if there are overdue */}
                {overdue.length > 0 && (
                    <StatCard
                        icon={AlertTriangle}
                        iconColor="orange"
                        label={t('admin.overdue')}
                        value={`${totalOverdueAmount.toLocaleString()} ${t('common.rs')}`}
                        lastUpdate={`${overdue.length} ${t('admin.invoice')}`}
                    />
                )}
            </div>
        </div>
    );
};

// ✅ Receipt Vouchers Stats (إحصائيات سندات القبض)
// ✅ سندات القبض - المبلغ الإجمالي فقط بدون تفاصيل الضريبة
const ReceiptVouchersStats: React.FC<{
    receiptVouchers: ReceiptVoucher[];
    selectedVouchers?: Set<string>;
}> = ({ receiptVouchers, selectedVouchers }) => {
    // ✅ Use selected vouchers if provided, otherwise use all
    const vouchersToCalculate = React.useMemo(() => {
        if (selectedVouchers && selectedVouchers.size > 0) {
            return receiptVouchers.filter(v => selectedVouchers.has(v.id) && !v.isDeleted);
        }
        return receiptVouchers.filter(v => !v.isDeleted);
    }, [receiptVouchers, selectedVouchers]);
    
    // Calculate by payment method
    const cashAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'cash')
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    const creditAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'credit')
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    const bankTransferAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'bank_transfer')
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    const deferredAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'deferred')
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    // ✅ Calculate total only (no tax breakdown for vouchers)
    const totalAmount = vouchersToCalculate
        .reduce((sum, v) => sum + v.totalAmount, 0);
    
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={DollarSign}
                    iconColor="green"
                    label="💵 كاش"
                    value={`${cashAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={CreditCard}
                    iconColor="blue"
                    label="💳 كريديت"
                    value={`${creditAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={FileText}
                    iconColor="purple"
                    label="🏦 تحويل بنكي"
                    value={`${bankTransferAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={Clock}
                    iconColor="orange"
                    label="⏰ مؤجل الدفع"
                    value={`${deferredAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={CheckCircle}
                    iconColor="teal"
                    label="✅ الإجمالي"
                    value={`${totalAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
        </div>
    );
};

// ✅ Expense Vouchers Stats (إحصائيات سندات الصرف)
const ExpenseVouchersStats: React.FC<{
    expenseVouchers: ExpenseVoucher[];
    selectedVouchers?: Set<string>;
}> = ({ expenseVouchers, selectedVouchers }) => {
    // ✅ Use selected vouchers if provided, otherwise use all
    const vouchersToCalculate = React.useMemo(() => {
        if (selectedVouchers && selectedVouchers.size > 0) {
            return expenseVouchers.filter(v => selectedVouchers.has(v.id) && !v.isDeleted);
        }
        return expenseVouchers.filter(v => !v.isDeleted);
    }, [expenseVouchers, selectedVouchers]);
    
    // Calculate by payment method
    const cashAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'cash')
        .reduce((sum, v) => sum + v.amount, 0);
    
    const creditAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'credit')
        .reduce((sum, v) => sum + v.amount, 0);
    
    const bankTransferAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'bank_transfer')
        .reduce((sum, v) => sum + v.amount, 0);
    
    const deferredAmount = vouchersToCalculate
        .filter(v => v.paymentMethod === 'deferred')
        .reduce((sum, v) => sum + v.amount, 0);
    
    // Calculate total
    const totalAmount = vouchersToCalculate
        .reduce((sum, v) => sum + v.amount, 0);
    
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={DollarSign}
                    iconColor="green"
                    label="💵 كاش"
                    value={`${cashAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={CreditCard}
                    iconColor="blue"
                    label="💳 كريديت"
                    value={`${creditAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={FileText}
                    iconColor="purple"
                    label="🏦 تحويل بنكي"
                    value={`${bankTransferAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={Clock}
                    iconColor="orange"
                    label="⏰ مؤجل الدفع"
                    value={`${deferredAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
            <div className="stat-card-pro-compact stat-card-billing">
                <StatCard
                    icon={CheckCircle}
                    iconColor="teal"
                    label="✅ الإجمالي"
                    value={`${totalAmount.toLocaleString()} ر.س`}
                    lastUpdate="تم التحديث الآن"
                />
            </div>
        </div>
    );
};

// ============================================================
// TAB COMPONENTS
// ============================================================

// ✅ Receipt Vouchers Tab (سندات القبض)
const ReceiptVouchersTab: React.FC<{
    receiptVouchers: ReceiptVoucher[];
    systemSettings?: any;
    onStatsUpdate?: (filtered: ReceiptVoucher[], selected: Set<string>) => void;
}> = ({ receiptVouchers, systemSettings, onStatsUpdate }) => {
    const { success, error } = useUX();
    const { user } = useAuth();
    
    // ✅ Handle delete selected vouchers
    const handleDelete = async () => {
        if (selectedVouchers.size === 0) {
            error('يرجى تحديد سند واحد على الأقل للحذف');
            return;
        }
        
        const confirmed = await customConfirm({
            type: 'danger',
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد من حذف ${selectedVouchers.size} سند${selectedVouchers.size > 1 ? 'ات' : ''}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
            confirmText: 'حذف',
            cancelText: 'إلغاء'
        });
        
        if (!confirmed) {
            return;
        }
        
        setDeleting(true);
        try {
            await deleteReceiptVouchers(Array.from(selectedVouchers), user?.id);
            success(`تم حذف ${selectedVouchers.size} سند بنجاح`);
            setSelectedVouchers(new Set());
            // Reload data
            window.location.reload();
        } catch (err: any) {
            error('فشل حذف السندات');
            console.error('Error deleting vouchers:', err);
        } finally {
            setDeleting(false);
        }
    };
    
    // ✅ Filters State
    const [voucherNumberSearch, setVoucherNumberSearch] = useState(''); // ✅ البحث برقم السند
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [sortBy, setSortBy] = useState<'highest' | 'lowest' | 'date' | 'payment' | 'duration'>('date');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'credit' | 'bank_transfer' | 'deferred'>('all');
    const [durationFilter, setDurationFilter] = useState<'all' | '1' | '2'>('all');
    const [deletedFilter, setDeletedFilter] = useState<'all' | 'deleted' | 'not_deleted'>('not_deleted'); // ✅ فلتر السندات المحذوفة
    const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [previewVoucher, setPreviewVoucher] = useState<ReceiptVoucher | null>(null);
    
    
    // ✅ Filtered and sorted vouchers
    const filteredVouchers = React.useMemo(() => {
        let filtered = [...receiptVouchers];
        
        // ✅ Voucher number search
        if (voucherNumberSearch.trim()) {
            const searchNum = parseInt(voucherNumberSearch.trim());
            if (!isNaN(searchNum)) {
                filtered = filtered.filter(v => v.voucherNumber === searchNum);
            }
        }
        
        // Date filter
        if (startDate && startTime) {
            const start = new Date(`${startDate}T${startTime}`);
            filtered = filtered.filter(v => new Date(v.createdAt) >= start);
        }
        if (endDate && endTime) {
            const end = new Date(`${endDate}T${endTime}`);
            filtered = filtered.filter(v => new Date(v.createdAt) <= end);
        }
        
        // Payment method filter
        if (paymentMethodFilter !== 'all') {
            filtered = filtered.filter(v => v.paymentMethod === paymentMethodFilter);
        }
        
        // Duration filter
        if (durationFilter !== 'all') {
            filtered = filtered.filter(v => v.subscriptionDuration === parseInt(durationFilter));
        }
        
        // ✅ Deleted filter
        if (deletedFilter === 'deleted') {
            filtered = filtered.filter(v => v.isDeleted === true);
        } else if (deletedFilter === 'not_deleted') {
            filtered = filtered.filter(v => !v.isDeleted);
        }
        // 'all' shows both deleted and not deleted
        
        // Sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'highest':
                    return b.totalAmount - a.totalAmount;
                case 'lowest':
                    return a.totalAmount - b.totalAmount;
                case 'date':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'payment':
                    const paymentOrder = { 'cash': 1, 'credit': 2, 'bank_transfer': 3, 'deferred': 4 };
                    const aOrder = paymentOrder[a.paymentMethod || 'deferred'] || 5;
                    const bOrder = paymentOrder[b.paymentMethod || 'deferred'] || 5;
                    return aOrder - bOrder;
                case 'duration':
                    return b.subscriptionDuration - a.subscriptionDuration;
                default:
                    return 0;
            }
        });
        
        return filtered;
    }, [receiptVouchers, voucherNumberSearch, startDate, startTime, endDate, endTime, sortBy, paymentMethodFilter, durationFilter, deletedFilter]);
    
    // ✅ Update stats when filtered vouchers or selection change
    React.useEffect(() => {
        if (onStatsUpdate) {
            // ✅ Exclude deleted vouchers
            const activeVouchers = filteredVouchers.filter(v => !v.isDeleted);
            const vouchersToUse = selectedVouchers.size > 0
                ? activeVouchers.filter(v => selectedVouchers.has(v.id))
                : activeVouchers;
            onStatsUpdate(vouchersToUse, selectedVouchers);
        }
    }, [filteredVouchers, selectedVouchers, onStatsUpdate]);
    
    // ✅ Toggle selection
    const toggleSelection = (voucherId: string) => {
        setSelectedVouchers(prev => {
            const next = new Set(prev);
            if (next.has(voucherId)) {
                next.delete(voucherId);
            } else {
                next.add(voucherId);
            }
            return next;
        });
    };
    
    // ✅ Toggle select all
    const toggleSelectAll = () => {
        if (selectedVouchers.size === filteredVouchers.length) {
            setSelectedVouchers(new Set());
        } else {
            setSelectedVouchers(new Set(filteredVouchers.map(v => v.id)));
        }
    };
    
    // ✅ Get vouchers to export/print (exclude deleted)
    const getVouchersToExport = () => {
        const vouchers = selectedVouchers.size > 0
            ? filteredVouchers.filter(v => selectedVouchers.has(v.id))
            : filteredVouchers;
        // ✅ Exclude deleted vouchers
        return vouchers.filter(v => !v.isDeleted);
    };
    
    // ✅ Generate report HTML content (same format as print)
    const generateReportHTML = (vouchersToPrint: ReceiptVoucher[]) => {
        if (vouchersToPrint.length === 0) return '';
        
        const paymentMethodLabels = {
            'cash': 'كاش',
            'credit': 'كريديت',
            'bank_transfer': 'تحويل بنكي',
            'deferred': 'مؤجل الدفع'
        };
        
        // ✅ If multiple vouchers, use table report format (سندات القبض - بدون تفاصيل الضريبة)
        if (vouchersToPrint.length > 1) {
            const totalAmount = vouchersToPrint.reduce((sum, v) => sum + v.totalAmount, 0);
            
            const tableRows = vouchersToPrint.map(voucher => {
                // ✅ التاريخ الهجري
                const hijriDate = new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                // ✅ التاريخ الميلادي
                const gregorianDate = new Date(voucher.createdAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                return `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937; font-weight: 600;">${voucher.voucherNumber || '-'}</td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;"><div>${gregorianDate} م</div><div style="color: #6b7280; font-size: 7pt;">${hijriDate} هـ</div></td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;">${voucher.managerName}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${voucher.managerCode}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${voucher.branchCode}</td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;">${voucher.branchName}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${voucher.numberOfBranches}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${voucher.subscriptionDuration === 1 ? 'سنة' : 'سنتين'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${voucher.paymentMethod ? paymentMethodLabels[voucher.paymentMethod] : '-'}</td>
                        <td style="padding: 8px 6px; text-align: left; font-size: 9pt; color: #047857; font-weight: 700;">${voucher.totalAmount.toLocaleString()} ر.س</td>
                    </tr>
                `;
            }).join('');
            
            return `
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>تقرير محاسبي - سندات القبض</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                            padding: 15mm;
                            direction: rtl;
                            background: #ffffff;
                        }
                        @page { 
                            size: A4 landscape; 
                            margin: 10mm;
                        }
                        table {
                            page-break-inside: auto;
                        }
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                    </style>
                </head>
                <body>
                    <!-- Report Header with Logo -->
                    <div style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); padding: 25px 20px; text-align: center; color: white; margin-bottom: 20px; position: relative;">
                        <div style="position: absolute; top: 20px; right: 20px; width: 80px; height: 80px; background: white; border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center;">
                            <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                        <div style="font-size: 24pt; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px;">تقرير محاسبي - سندات القبض</div>
                        <div style="font-size: 12pt; opacity: 0.95; margin-bottom: 10px;">ACCOUNTING REPORT - RECEIPT VOUCHERS</div>
                        <div style="font-size: 11pt; opacity: 0.9; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);">
                            <div style="margin-bottom: 5px;">عدد السندات: <strong>${vouchersToPrint.length}</strong></div>
                            <div>تاريخ التقرير: <strong>${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
                        </div>
                    </div>
                    
                    <!-- Report Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt;">
                        <thead>
                            <tr style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); color: white;">
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">رقم السند</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">التاريخ</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">اسم المدير</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">كود المدير</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">رقم الفرع</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">اسم الفرع</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">عدد الفروع</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">مدة الاشتراك</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">طريقة الدفع</th>
                                <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                            <!-- Total Row -->
                            <tr style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-top: 3px solid #10b981; border-bottom: 3px solid #10b981;">
                                <td colspan="9" style="padding: 12px 6px; text-align: left; font-size: 10pt; font-weight: 700; color: #047857;">المجموع الكلي:</td>
                                <td style="padding: 12px 6px; text-align: left; font-size: 11pt; font-weight: 800; color: #047857;">${totalAmount.toLocaleString()} ر.س</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <!-- ✅ Enhanced Report Footer with Contact Info -->
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; background: #f9fafb; padding: 20px; border-radius: 8px;">
                        ${systemSettings?.companyName ? `
                        <div style="font-size: 10pt; color: #1e293b; font-weight: 600; margin-bottom: 8px;">${systemSettings.companyName}</div>
                        ` : ''}
                        ${systemSettings?.contactPhone ? `
                        <div style="font-size: 9pt; color: #64748b; margin-bottom: 5px;">
                            للتواصل: <span style="color: #1e293b; font-weight: 600;">${systemSettings.contactPhone}</span>
                        </div>
                        ` : ''}
                        ${systemSettings?.contactEmail ? `
                        <div style="font-size: 9pt; color: #64748b; margin-bottom: 5px;">
                            البريد الإلكتروني: <span style="color: #1e293b; font-weight: 600;">${systemSettings.contactEmail}</span>
                        </div>
                        ` : ''}
                        <div style="font-size: 9pt; color: #6b7280; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e5e7eb;">
                            تم إنشاء هذا التقرير تلقائياً من ${systemSettings?.companyName || 'نظام إدارة أدورا'}
                        </div>
                        <div style="font-size: 10pt; color: #0D9488; font-weight: 600; margin-top: 5px;">شكراً لاستخدامكم</div>
                    </div>
                </body>
                </html>
            `;
        }
        
        // ✅ Single voucher - use detailed format with QR, Stamp, Watermark
        const printContent = vouchersToPrint.map(voucher => {
            // ✅ التاريخ الهجري
            const hijriDate = formatHijriDate(voucher.createdAt);
            // ✅ التاريخ الميلادي
            const gregorianDate = formatGregorianDate(voucher.createdAt);
            // ✅ الوقت
            const timeStr = new Date(voucher.createdAt).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // ✅ Generate QR Code for verification
            const qrData = generateInvoiceQRData({
                invoiceNumber: voucher.voucherNumber || voucher.id.slice(0, 8),
                totalAmount: voucher.totalAmount,
                issueDate: voucher.createdAt,
                companyTaxNumber: systemSettings?.companyTaxNumber,
                companyName: systemSettings?.companyName
            });
            const qrCodeURL = generateQRCodeURL(qrData, 120);
            
            // ✅ Generate amount in words
            const amountInWords = numberToArabicWords(voucher.totalAmount);
            
            // ✅ Get document colors
            const colors = getDocumentTypeColors('receipt');
            
            // ✅ Generate enhanced company header HTML
            const companyHeaderHTML = `
                <!-- ✅ Enhanced Header Section with Company Info, Logo & QR -->
                <div style="background: ${colors.gradient}; padding: 25px 20px; color: white; position: relative; border-bottom: 4px solid rgba(255,255,255,0.2);">
                    <!-- Logo -->
                    <div style="position: absolute; top: 20px; right: 20px; width: 90px; height: 90px; background: white; border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                    
                    <!-- QR Code for Verification -->
                    <div style="position: absolute; top: 20px; left: 20px; width: 80px; height: 80px; background: white; border-radius: 8px; padding: 5px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <img src="${qrCodeURL}" alt="QR Code" style="width: 100%; height: 100%;" onerror="this.style.display='none'" />
                    </div>
                    
                    <!-- ✅ PAID/UNPAID Stamp -->
                    ${!voucher.isDeleted ? `
                    <div style="position: absolute; top: 110px; left: 30px; transform: rotate(-15deg); border: 4px solid rgba(255,255,255,0.9); border-radius: 12px; padding: 8px 20px; color: rgba(255,255,255,0.95); font-size: 16pt; font-weight: bold;">
                        <div style="text-align: center;">
                            <div>✓ مدفوعة</div>
                            <div style="font-size: 10pt; margin-top: 2px;">PAID</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Company Name (if available) -->
                    ${systemSettings?.companyName ? `
                    <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                        <div style="font-size: 18pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">${systemSettings.companyName}</div>
                        ${systemSettings.commercialRegistrationNumber ? `
                        <div style="font-size: 9pt; opacity: 0.9;">السجل التجاري: ${systemSettings.commercialRegistrationNumber}</div>
                        ` : ''}
                        ${systemSettings.companyTaxNumber ? `
                        <div style="font-size: 9pt; opacity: 0.9;">الرقم الضريبي: ${systemSettings.companyTaxNumber}</div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <!-- Voucher Title -->
                    <div style="text-align: center;">
                        <div style="font-size: 26pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">${colors.name.ar}</div>
                        <div style="font-size: 11pt; opacity: 0.95; margin-bottom: 8px;">${colors.name.en}</div>
                        ${voucher.isDeleted ? `
                        <div style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; font-size: 11pt; font-weight: bold; margin: 10px auto; max-width: fit-content;">
                            ⚠️ محذوف ${voucher.deletedAt ? `بتاريخ ${new Date(voucher.deletedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
                        </div>
                        ` : ''}
                        <div style="font-size: 11pt; opacity: 0.9; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
                            رقم السند: <strong>#${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}</strong>
                        </div>
                    </div>
                </div>
            `;
            
            // ✅ Generate enhanced company info section HTML
            const companyInfoHTML = `
                <!-- ✅ Enhanced Company Information Section -->
                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #0ea5e9; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);">
                    <div style="font-size: 10pt; color: #0c4a6e; font-weight: 700; margin-bottom: 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                        معلومات الشركة
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">اسم الشركة:</div>
                            <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyName || '________________'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الرقم الضريبي:</div>
                            <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyTaxNumber || '________________'}</div>
                        </div>
                    </div>
                    ${systemSettings?.commercialRegistrationNumber ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">السجل التجاري:</div>
                            <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.commercialRegistrationNumber}</div>
                        </div>
                        ${systemSettings?.contactPhone ? `
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الهاتف:</div>
                            <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.contactPhone}</div>
                        </div>
                        ` : '<div></div>'}
                    </div>
                    ` : ''}
                    ${systemSettings?.companyAddress ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2);">
                        <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px; text-align: center;">العنوان:</div>
                        <div style="font-size: 10pt; color: #1e293b; font-weight: 500; text-align: center;">${systemSettings.companyAddress}</div>
                    </div>
                    ` : ''}
                    ${systemSettings?.contactEmail || systemSettings?.contactWebsite ? `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2); display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        ${systemSettings.contactEmail ? `
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">البريد الإلكتروني:</div>
                            <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactEmail}</div>
                        </div>
                        ` : '<div></div>'}
                        ${systemSettings.contactWebsite ? `
                        <div style="text-align: right;">
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الموقع الإلكتروني:</div>
                            <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactWebsite}</div>
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
                
                <!-- ✅ Fixed Text: استلمنا من شركة -->
                <div style="background: #fff7ed; padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #fb923c; text-align: center;">
                    <div style="font-size: 11pt; color: #9a3412; font-weight: 700; margin-bottom: 5px;">
                        استلمنا من شركة: <span style="color: #1f2937; border-bottom: 2px solid #fb923c; padding: 0 8px; display: inline-block; min-width: 200px;">${systemSettings?.companyName || '________________'}</span>
                    </div>
                    <div style="font-size: 10pt; color: #9a3412; font-weight: 600;">
                        رقم ضريبي: <span style="color: #1f2937; border-bottom: 2px solid #fb923c; padding: 0 8px; display: inline-block; min-width: 150px;">${systemSettings?.companyTaxNumber || '________________'}</span>
                    </div>
                    ${systemSettings?.companyAddress ? `
                    <div style="font-size: 9pt; color: #9a3412; margin-top: 5px;">
                        العنوان: <span style="color: #1f2937;">${systemSettings.companyAddress}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            
            return `
                <div style="page-break-after: always; padding: 0; margin: 0; max-width: 100%;">
                    ${companyHeaderHTML}
                    
                    <!-- Content Section -->
                    <div style="background: #ffffff; padding: 20px; border: 2px solid #e5e7eb; border-top: none;">
                        ${companyInfoHTML}
                        
                        <!-- Date & Info Row -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                            <div>
                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">تاريخ ووقت الإنشاء</div>
                                <div style="font-size: 11pt; color: #1f2937; font-weight: 600;">
                                    <div>${gregorianDate} م - ${timeStr}</div>
                                    <div style="color: #6b7280; font-size: 9pt;">${hijriDate} هـ</div>
                                </div>
                            </div>
                            <div style="text-align: left;">
                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">طريقة الدفع</div>
                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.paymentMethod ? paymentMethodLabels[voucher.paymentMethod] : 'غير محدد'}</div>
                            </div>
                        </div>
                        
                        <!-- Information Grid -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #0D9488;">
                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">اسم المدير</div>
                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.managerName}</div>
                            </div>
                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #0D9488;">
                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">كود المدير</div>
                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.managerCode}</div>
                            </div>
                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #0D9488;">
                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">رقم الفرع</div>
                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.branchCode}</div>
                            </div>
                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #0D9488;">
                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">اسم الفرع</div>
                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.branchName}</div>
                            </div>
                        </div>
                        
                        <!-- Calculation Details (بدون الضريبة) -->
                        <div style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                            <div style="font-size: 9pt; color: #6b7280; margin-bottom: 6px; font-weight: 600;">تفاصيل الحساب:</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                                <tr>
                                    <td style="padding: 3px 0; color: #4b5563;">سعر الاشتراك للفرع الواحد:</td>
                                    <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${voucher.subscriptionPrice.toLocaleString()} ر.س</td>
                                </tr>
                                <tr>
                                    <td style="padding: 3px 0; color: #4b5563;">عدد الفروع:</td>
                                    <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${voucher.numberOfBranches} فرع</td>
                                </tr>
                                <tr>
                                    <td style="padding: 3px 0; color: #4b5563;">مدة الاشتراك:</td>
                                    <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${voucher.subscriptionDuration === 1 ? 'سنة واحدة' : 'سنتين'}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <!-- Total Amount Section (بدون ذكر الضريبة) -->
                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 15px; border-radius: 10px; border: 3px solid #10b981; text-align: center; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);">
                            <div style="font-size: 9pt; color: #059669; margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">المبلغ الإجمالي / Total Amount</div>
                            <div style="font-size: 28pt; color: #047857; font-weight: bold; letter-spacing: 2px; margin-bottom: 8px;">
                                ${voucher.totalAmount.toLocaleString()} <span style="font-size: 14pt; font-weight: 500;">ر.س</span>
                            </div>
                            <div style="font-size: 9pt; color: #065f46; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; border: 1px solid #a7f3d0;">
                                <div style="color: #047857; font-weight: 600; margin-bottom: 2px;">المبلغ كتابةً:</div>
                                <div style="color: #1f2937; font-weight: 500;">${amountInWords}</div>
                            </div>
                        </div>
                        
                        <!-- Signature Section -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; padding: 15px 0; border-top: 2px dashed #e5e7eb; border-bottom: 2px dashed #e5e7eb;">
                            <div style="text-align: center;">
                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 30px;">توقيع المستلم / Receiver</div>
                                <div style="border-top: 1px solid #1f2937; width: 120px; margin: 0 auto;"></div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 30px;">الختم الرسمي / Stamp</div>
                                <div style="border-top: 1px solid #1f2937; width: 120px; margin: 0 auto;"></div>
                            </div>
                        </div>
                        
                        <!-- Footer with Contact Info -->
                        <div style="padding: 12px; background: #f9fafb; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb;">
                            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 8px;">
                                ${systemSettings?.contactPhone ? `<span style="font-size: 8pt; color: #6b7280;">📞 ${systemSettings.contactPhone}</span>` : ''}
                                ${systemSettings?.contactEmail ? `<span style="font-size: 8pt; color: #6b7280;">📧 ${systemSettings.contactEmail}</span>` : ''}
                                ${systemSettings?.contactWebsite ? `<span style="font-size: 8pt; color: #6b7280;">🌐 ${systemSettings.contactWebsite}</span>` : ''}
                            </div>
                            <div style="font-size: 9pt; color: #0D9488; font-weight: 600;">شكراً لتعاملكم معنا ✨</div>
                            <div style="font-size: 7pt; color: #9ca3af; margin-top: 4px;">Powered by Adora Hotel Management System</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>طباعة سندات القبض</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                        padding: 15mm;
                        direction: rtl;
                        background: #ffffff;
                    }
                    @page { 
                        size: A4; 
                        margin: 10mm;
                    }
                    @media print {
                        body { 
                            padding: 0;
                            background: white;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        div[style*="page-break"] {
                            page-break-after: always;
                            margin-bottom: 0;
                        }
                    }
                    /* Watermark */
                    .print-page {
                        position: relative;
                    }
                    .print-page::before {
                        content: "سند قبض";
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-30deg);
                        font-size: 60pt;
                        color: rgba(13, 148, 136, 0.04);
                        font-weight: bold;
                        white-space: nowrap;
                        z-index: 0;
                        pointer-events: none;
                        font-family: 'Tajawal', sans-serif;
                    }
                    /* Security Pattern */
                    .security-border {
                        position: relative;
                    }
                    .security-border::after {
                        content: "";
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background-image: 
                            repeating-linear-gradient(
                                45deg,
                                transparent,
                                transparent 25px,
                                rgba(13, 148, 136, 0.02) 25px,
                                rgba(13, 148, 136, 0.02) 50px
                            );
                        pointer-events: none;
                        z-index: 0;
                    }
                </style>
            </head>
            <body>
                <div class="print-page security-border">
                    ${printContent}
                </div>
            </body>
            </html>
        `;
    };
    
    // ✅ Export to PDF
    const handleExportPDF = async () => {
        const vouchersToExport = getVouchersToExport();
        
        if (vouchersToExport.length === 0) {
            error('لا توجد سندات للتصدير');
            return;
        }
        
        try {
            const htmlContent = generateReportHTML(vouchersToExport);
            if (!htmlContent) {
                error('فشل إنشاء المحتوى');
                return;
            }
            
            // Create a temporary window to render HTML
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                error('يرجى السماح بالنوافذ المنبثقة للتصدير');
                return;
            }
            
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            
            // Wait for content to load, then trigger print to PDF
            setTimeout(() => {
                printWindow.print();
            }, 500);
            
            success('تم فتح نافذة الطباعة. اختر "حفظ كـ PDF" من خيارات الطباعة.');
        } catch (err) {
            console.error('Error exporting to PDF:', err);
            error('فشل تصدير PDF');
        }
    };
    
    // ✅ Export to Excel (سندات القبض - بدون تفاصيل الضريبة)
    const handleExportExcel = () => {
        const vouchersToExport = getVouchersToExport();
        
        if (vouchersToExport.length === 0) {
            error('لا توجد سندات للتصدير');
            return;
        }
        
        try {
            const paymentMethodLabels = {
                'cash': 'كاش',
                'credit': 'كريديت',
                'bank_transfer': 'تحويل بنكي',
                'deferred': 'مؤجل الدفع'
            };
            
            // Prepare Excel data (بدون تفاصيل الضريبة)
            const excelData = vouchersToExport.map(voucher => {
                // ✅ التاريخ الهجري والميلادي معاً
                const hijriDate = new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const gregorianDate = new Date(voucher.createdAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                return {
                    'رقم السند': voucher.voucherNumber || '-',
                    'التاريخ الهجري': hijriDate,
                    'التاريخ الميلادي': gregorianDate,
                    'اسم المدير': voucher.managerName,
                    'كود المدير': voucher.managerCode,
                    'رقم الفرع': voucher.branchCode,
                    'اسم الفرع': voucher.branchName,
                    'عدد الفروع': voucher.numberOfBranches,
                    'مدة الاشتراك': voucher.subscriptionDuration === 1 ? 'سنة واحدة' : 'سنتين',
                    'طريقة الدفع': voucher.paymentMethod ? paymentMethodLabels[voucher.paymentMethod] : '-',
                    'المبلغ': voucher.totalAmount
                };
            });
            
            // Add totals row
            const totalAmount = vouchersToExport.reduce((sum, v) => sum + v.totalAmount, 0);
            
            excelData.push({
                'رقم السند': '',
                'التاريخ الهجري': '',
                'التاريخ الميلادي': '',
                'اسم المدير': '',
                'كود المدير': '',
                'رقم الفرع': '',
                'اسم الفرع': '',
                'عدد الفروع': '',
                'مدة الاشتراك': '',
                'طريقة الدفع': 'المجموع:',
                'المبلغ': totalAmount
            });
            
            // Create HTML table for Excel
            const headers = Object.keys(excelData[0]);
            const headerRow = headers.map(h => `<th style="background:#0D9488;color:white;padding:10px;border:1px solid #ddd;font-weight:bold;">${h}</th>`).join('');
            
            const dataRows = excelData.map((row, index) => {
                const isTotalRow = index === excelData.length - 1;
                const bgColor = isTotalRow ? '#f0fdf4' : (index % 2 === 0 ? '#ffffff' : '#f9fafb');
                const fontWeight = isTotalRow ? 'bold' : 'normal';
                const cells = headers.map(h => 
                    `<td style="padding:8px;border:1px solid #ddd;background:${bgColor};font-weight:${fontWeight};">${row[h] ?? ''}</td>`
                ).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            
            const html = `
                <html xmlns:o="urn:schemas-microsoft-office:office" xmlns:x="urn:schemas-microsoft-office:excel">
                <head>
                    <meta charset="UTF-8">
                    <!--[if gte mso 9]>
                    <xml>
                        <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                                <x:ExcelWorksheet>
                                    <x:Name>سندات القبض</x:Name>
                                    <x:WorksheetOptions>
                                        <x:DisplayGridlines/>
                                    </x:WorksheetOptions>
                                </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                        </x:ExcelWorkbook>
                    </xml>
                    <![endif]-->
                    <style>
                        table { border-collapse: collapse; width: 100%; direction: rtl; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
                    </style>
                </head>
                <body dir="rtl">
                    <table>
                        <thead>
                            <tr>${headerRow}</tr>
                        </thead>
                        <tbody>
                            ${dataRows}
                        </tbody>
                    </table>
                </body>
                </html>
            `;
            
            // Create blob and download
            const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `سندات_القبض_${new Date().toISOString().split('T')[0]}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            success('تم تصدير Excel بنجاح');
        } catch (err) {
            console.error('Error exporting to Excel:', err);
            error('فشل تصدير Excel');
        }
    };
    
    // ✅ Print selected/filtered vouchers
    const handlePrint = () => {
        const vouchersToPrint = getVouchersToExport();
        
        if (vouchersToPrint.length === 0) {
            error('لا توجد سندات للطباعة');
            return;
        }
        
        const htmlContent = generateReportHTML(vouchersToPrint);
        if (!htmlContent) {
            error('فشل إنشاء المحتوى');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            error('يرجى السماح بالنوافذ المنبثقة للطباعة');
            return;
        }
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };
    
    return (
        <div className="space-y-4">
            {/* Header with Filters Toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm flex items-center gap-2 border border-white/10"
                    >
                        <Filter className="w-4 h-4" />
                        {showFilters ? 'إخفاء' : 'إظهار'} الفلاتر والبحث
                    </button>
                    {filteredVouchers.filter(v => !v.isDeleted).length > 0 && (
                        <>
                            <button
                                onClick={handleDelete}
                                disabled={selectedVouchers.size === 0 || deleting}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                حذف ({selectedVouchers.size})
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                طباعة ({selectedVouchers.size > 0 ? selectedVouchers.size : filteredVouchers.filter(v => !v.isDeleted).length})
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                <span className="hidden lg:inline">PDF</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden lg:inline">Excel</span>
                            </button>
                        </>
                    )}
                </div>
                <div className="text-sm text-white/60">
                    عدد السندات: <span className="text-teal-400 font-medium">{filteredVouchers.filter(v => !v.isDeleted).length}</span>
                </div>
            </div>
            
            {/* Filters */}
            {showFilters && (
                <div className="glass rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Voucher Number Search */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">البحث برقم السند</label>
                            <input
                                type="number"
                                value={voucherNumberSearch}
                                onChange={(e) => setVoucherNumberSearch(e.target.value)}
                                placeholder="رقم السند"
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            />
                        </div>
                        
                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">من تاريخ</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>
                        </div>
                        
                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">إلى تاريخ</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>
                        </div>
                        
                        {/* Sort By */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">ترتيب حسب</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="date">التاريخ (الأحدث)</option>
                                <option value="highest">المبلغ (الأعلى)</option>
                                <option value="lowest">المبلغ (الأقل)</option>
                                <option value="payment">طريقة الدفع</option>
                                <option value="duration">المدة</option>
                            </select>
                        </div>
                        
                        {/* Payment Method Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">طريقة الدفع</label>
                            <select
                                value={paymentMethodFilter}
                                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="all">الكل</option>
                                <option value="cash">كاش</option>
                                <option value="credit">كريديت</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="deferred">مؤجل الدفع</option>
                            </select>
                        </div>
                        
                        {/* Duration Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">مدة الاشتراك</label>
                            <select
                                value={durationFilter}
                                onChange={(e) => setDurationFilter(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="all">الكل</option>
                                <option value="1">سنة واحدة</option>
                                <option value="2">سنتين</option>
                            </select>
                        </div>
                        
                        {/* Deleted Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">حالة السند</label>
                            <select
                                value={deletedFilter}
                                onChange={(e) => setDeletedFilter(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            >
                                <option value="not_deleted">النشطة فقط</option>
                                <option value="deleted">المحذوفة فقط</option>
                                <option value="all">الكل</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ✅ Grouped Vouchers - تجميع السندات حسب المشترك والتاريخ */}
            <div className="space-y-4">
                {filteredVouchers.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-white/40 py-8">لا توجد سندات قبض</p>
                ) : (
                    <>
                        {/* Select All */}
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                            <input
                                type="checkbox"
                                checked={selectedVouchers.size === filteredVouchers.length && filteredVouchers.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-teal-500 focus:ring-teal-500/50"
                            />
                            <span className="text-sm text-slate-600 dark:text-white/60">
                                تحديد الكل ({filteredVouchers.length})
                            </span>
                        </div>
                        
                        {/* ✅ Grouped Vouchers by Manager + Date */}
                        {(() => {
                            // Group vouchers by managerCode + date (same day)
                            const groups: { [key: string]: typeof filteredVouchers } = {};
                            filteredVouchers.forEach(voucher => {
                                const dateKey = new Date(voucher.createdAt).toISOString().split('T')[0];
                                const groupKey = `${voucher.managerCode}_${dateKey}`;
                                if (!groups[groupKey]) {
                                    groups[groupKey] = [];
                                }
                                groups[groupKey].push(voucher);
                            });
                            
                            // Sort groups by date (newest first)
                            const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
                                const dateA = new Date(groups[a][0].createdAt);
                                const dateB = new Date(groups[b][0].createdAt);
                                return dateB.getTime() - dateA.getTime();
                            });
                            
                            return sortedGroupKeys.map(groupKey => {
                                const groupVouchers = groups[groupKey];
                                const firstVoucher = groupVouchers[0];
                                const totalAmount = groupVouchers.reduce((sum, v) => sum + v.totalAmount, 0);
                                const allSelected = groupVouchers.every(v => selectedVouchers.has(v.id));
                                const someSelected = groupVouchers.some(v => selectedVouchers.has(v.id));
                                
                                // Toggle all vouchers in group
                                const toggleGroupSelection = () => {
                                    const newSelected = new Set(selectedVouchers);
                                    if (allSelected) {
                                        groupVouchers.forEach(v => newSelected.delete(v.id));
                                    } else {
                                        groupVouchers.forEach(v => {
                                            if (!v.isDeleted) newSelected.add(v.id);
                                        });
                                    }
                                    setSelectedVouchers(newSelected);
                                };
                                
                                // Print all vouchers in group
                                const printGroup = () => {
                                    const htmlContent = generateReportHTML(groupVouchers);
                                    if (!htmlContent) return;
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write(htmlContent);
                                        printWindow.document.close();
                                        setTimeout(() => printWindow.print(), 250);
                                    }
                                };
                                
                                return (
                                    <div
                                        key={groupKey}
                                        className="bg-white dark:bg-slate-800/90 dark:backdrop-blur-sm rounded-2xl border-2 border-slate-200 dark:border-white/10 shadow-lg overflow-hidden"
                                    >
                                        {/* ✅ Group Header - معلومات المشترك */}
                                        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 p-4 border-b border-slate-200 dark:border-white/10">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    {/* Group Checkbox */}
                                                    <label className="relative flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={allSelected}
                                                            onChange={toggleGroupSelection}
                                                            className="sr-only peer"
                                                        />
                                                        <div className={`
                                                            w-5 h-5 rounded-lg border-2 transition-all duration-200
                                                            ${allSelected ? 'bg-teal-500 border-teal-500' : someSelected ? 'bg-teal-200 border-teal-400' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}
                                                            flex items-center justify-center
                                                        `}>
                                                            {(allSelected || someSelected) && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                    </label>
                                                    
                                                    {/* Manager Info */}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-slate-800 dark:text-white text-lg">
                                                                {firstVoucher.managerName}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                                                كود: {firstVoucher.managerCode}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                                            <Calendar className="w-3.5 h-3.5" />
                                                            <span>
                                                                {new Date(firstVoucher.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                            </span>
                                                            <span className="text-slate-400">|</span>
                                                            <span className="text-xs">
                                                                {new Date(firstVoucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'short', day: 'numeric' })} هـ
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Group Total & Actions */}
                                                <div className="flex items-center gap-4">
                                                    <div className="text-left">
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي ({groupVouchers.length} {groupVouchers.length === 1 ? 'سند' : 'سندات'})</p>
                                                        <p className="text-xl font-bold text-teal-600 dark:text-teal-400">
                                                            {totalAmount.toLocaleString()} <span className="text-sm">ر.س</span>
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={printGroup}
                                                        className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                                                        title="طباعة كل السندات"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                        طباعة الكل
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* ✅ Individual Vouchers - السندات الفردية */}
                                        <div className="p-3 space-y-2">
                                            {groupVouchers.map((voucher, idx) => (
                                                <div
                                                    key={voucher.id}
                                                    className={`
                                                        relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                                                        ${voucher.isDeleted 
                                                            ? 'bg-red-50 dark:bg-red-900/10 opacity-60' 
                                                            : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                        }
                                                        ${selectedVouchers.has(voucher.id) ? 'ring-2 ring-teal-500' : ''}
                                                        border border-slate-200 dark:border-slate-700
                                                    `}
                                                >
                                                    {/* Checkbox */}
                                                    <label className="flex-shrink-0 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedVouchers.has(voucher.id)}
                                                            onChange={() => toggleSelection(voucher.id)}
                                                            className="sr-only peer"
                                                        />
                                                        <div className={`
                                                            w-4 h-4 rounded border-2 transition-all
                                                            ${selectedVouchers.has(voucher.id) ? 'bg-teal-500 border-teal-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500'}
                                                            flex items-center justify-center
                                                        `}>
                                                            {selectedVouchers.has(voucher.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                                        </div>
                                                    </label>
                                                    
                                                    {/* Voucher Number */}
                                                    <div className={`
                                                        flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center
                                                        ${voucher.paymentMethod === 'cash' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 
                                                          voucher.paymentMethod === 'credit' ? 'bg-blue-100 dark:bg-blue-900/30' :
                                                          voucher.paymentMethod === 'bank_transfer' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                                          'bg-amber-100 dark:bg-amber-900/30'}
                                                    `}>
                                                        <span className="text-[8px] text-slate-500 dark:text-slate-400">سند</span>
                                                        <span className={`text-sm font-bold ${
                                                            voucher.paymentMethod === 'cash' ? 'text-emerald-600 dark:text-emerald-400' :
                                                            voucher.paymentMethod === 'credit' ? 'text-blue-600 dark:text-blue-400' :
                                                            voucher.paymentMethod === 'bank_transfer' ? 'text-purple-600 dark:text-purple-400' :
                                                            'text-amber-600 dark:text-amber-400'
                                                        }`}>{voucher.voucherNumber || '-'}</span>
                                                    </div>
                                                    
                                                    {/* Branch Info - الأهم للمحاسب */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold text-slate-800 dark:text-white">
                                                                فرع: {voucher.branchName || '-'}
                                                            </span>
                                                            <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                                                #{voucher.branchCode || '-'}
                                                            </span>
                                                            {voucher.isDeleted && (
                                                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                                                    محذوف
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                            <span>{voucher.subscriptionDuration === 1 ? 'سنة' : 'سنتين'}</span>
                                                            <span>•</span>
                                                            <span className={`font-medium ${
                                                                voucher.paymentMethod === 'cash' ? 'text-emerald-600 dark:text-emerald-400' :
                                                                voucher.paymentMethod === 'credit' ? 'text-blue-600 dark:text-blue-400' :
                                                                voucher.paymentMethod === 'bank_transfer' ? 'text-purple-600 dark:text-purple-400' :
                                                                'text-amber-600 dark:text-amber-400'
                                                            }`}>
                                                                {voucher.paymentMethod === 'cash' ? 'كاش' :
                                                                 voucher.paymentMethod === 'credit' ? 'كريديت' :
                                                                 voucher.paymentMethod === 'bank_transfer' ? 'بنكي' : 'مؤجل'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Amount */}
                                                    <div className="flex-shrink-0 text-left">
                                                        <span className="text-base font-bold text-slate-800 dark:text-white">
                                                            {voucher.totalAmount.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1">ر.س</span>
                                                    </div>
                                                    
                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setPreviewVoucher(voucher)}
                                                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-all"
                                                            title="معاينة"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const htmlContent = generateReportHTML([voucher]);
                                                                if (!htmlContent) return;
                                                                const printWindow = window.open('', '_blank');
                                                                if (printWindow) {
                                                                    printWindow.document.write(htmlContent);
                                                                    printWindow.document.close();
                                                                    setTimeout(() => printWindow.print(), 250);
                                                                }
                                                            }}
                                                            className="p-1.5 rounded-lg bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 transition-all"
                                                            title="طباعة"
                                                        >
                                                            <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </>
                )}
            </div>
            
            {/* ✅ Preview Modal - معاينة السند - محسّن للوضوح */}
            {previewVoucher && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800/90 dark:backdrop-blur-sm rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">سند قبض #{previewVoucher.voucherNumber}</h3>
                            <button
                                onClick={() => setPreviewVoucher(null)}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            {/* التاريخ */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-transparent">
                                    <p className="text-xs text-slate-500 dark:text-white/50 mb-1 font-medium">التاريخ الميلادي</p>
                                    <p className="text-slate-800 dark:text-white font-semibold">{new Date(previewVoucher.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })} م</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-transparent">
                                    <p className="text-xs text-slate-500 dark:text-white/50 mb-1 font-medium">التاريخ الهجري</p>
                                    <p className="text-slate-800 dark:text-white font-semibold">{new Date(previewVoucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'short', day: 'numeric' })} هـ</p>
                                </div>
                            </div>
                            
                            {/* المشترك */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-transparent">
                                    <p className="text-xs text-slate-500 dark:text-white/50 mb-1 font-medium">اسم المشترك</p>
                                    <p className="text-slate-800 dark:text-white font-semibold">{previewVoucher.managerName}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-transparent">
                                    <p className="text-xs text-slate-500 dark:text-white/50 mb-1 font-medium">كود المشترك</p>
                                    <p className="text-slate-800 dark:text-white font-bold text-lg">{previewVoucher.managerCode}</p>
                                </div>
                            </div>
                            
                            {/* الفرع - السند الواحد لفرع واحد فقط! */}
                            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 border border-teal-200 dark:border-teal-700/30">
                                <p className="text-xs text-teal-600 dark:text-teal-400 mb-2 font-medium">بيانات الفرع</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-800 dark:text-white font-bold text-lg">{previewVoucher.branchName || 'الفرع الرئيسي'}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">كود الفرع: #{previewVoucher.branchCode}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-slate-500 dark:text-slate-400">مدة الاشتراك</p>
                                        <p className="text-teal-600 dark:text-teal-400 font-bold">{previewVoucher.subscriptionDuration === 1 ? 'سنة واحدة' : 'سنتين'}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* طريقة الدفع */}
                            <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-transparent">
                                <p className="text-xs text-slate-500 dark:text-white/50 mb-2 font-medium">طريقة الدفع</p>
                                <p className={`text-base font-bold ${
                                    previewVoucher.paymentMethod === 'cash' ? 'text-emerald-600 dark:text-emerald-400' :
                                    previewVoucher.paymentMethod === 'credit' ? 'text-blue-600 dark:text-blue-400' :
                                    previewVoucher.paymentMethod === 'bank_transfer' ? 'text-purple-600 dark:text-purple-400' :
                                    'text-amber-600 dark:text-amber-400'
                                }`}>
                                    {previewVoucher.paymentMethod === 'cash' ? '💵 كاش' :
                                     previewVoucher.paymentMethod === 'credit' ? '💳 كريديت' :
                                     previewVoucher.paymentMethod === 'bank_transfer' ? '🏦 تحويل بنكي' : '⏳ مؤجل الدفع'}
                                </p>
                            </div>
                            
                            {/* المبلغ */}
                            <div className="bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl p-4 text-center">
                                <p className="text-teal-100 text-sm mb-1">المبلغ الإجمالي</p>
                                <p className="text-3xl font-bold text-white">{previewVoucher.totalAmount.toLocaleString()} <span className="text-lg">ر.س</span></p>
                            </div>
                            
                            {previewVoucher.notes && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-700/30">
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-medium">ملاحظات</p>
                                    <p className="text-slate-700 dark:text-white/80">{previewVoucher.notes}</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => {
                                    const singleVoucher = [previewVoucher];
                                    const htmlContent = generateReportHTML(singleVoucher);
                                    if (!htmlContent) return;
                                    const printWindow = window.open('', '_blank');
                                    if (printWindow) {
                                        printWindow.document.write(htmlContent);
                                        printWindow.document.close();
                                        setTimeout(() => printWindow.print(), 250);
                                    }
                                }}
                                className="flex-1 py-3 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-teal-500/30 hover:shadow-xl"
                            >
                                <Printer className="w-5 h-5" />
                                طباعة
                            </button>
                            <button
                                onClick={() => setPreviewVoucher(null)}
                                className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white font-medium transition-colors"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// EXPENSE VOUCHERS TAB
// ============================================================

// ✅ Helper: Convert Gregorian to Hijri date
const toHijriDate = (date: Date): string => {
    // Simple conversion (approximate)
    // For production, use a proper library like 'hijri-date' or API
    const gregorianYear = date.getFullYear();
    const hijriYear = Math.floor((gregorianYear - 622) * 0.9702);
    const hijriMonth = date.getMonth() + 1;
    const hijriDay = date.getDate();
    
    const hijriMonths = ['محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني', 'جمادى الأولى', 'جمادى الثانية', 
                         'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'];
    
    return `${hijriDay}/${hijriMonth}/${hijriYear}`;
};

// ✅ Expense Vouchers Tab (سندات الصرف)
const ExpenseVouchersTab: React.FC<{
    expenseVouchers: ExpenseVoucher[];
    onRefresh: () => void;
    onStatsUpdate?: (filtered: ExpenseVoucher[], selected: Set<string>) => void;
}> = ({ expenseVouchers, onRefresh, onStatsUpdate }) => {
    const { success, error } = useUX();
    const { user } = useAuth();
    const [systemSettings, setSystemSettings] = useState<any>(null);
    
    // ✅ Filters State
    const [voucherNumberSearch, setVoucherNumberSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [sortBy, setSortBy] = useState<'highest' | 'lowest' | 'date' | 'payment' | 'name'>('date');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'credit' | 'bank_transfer' | 'deferred'>('all');
    const [paidToFilter, setPaidToFilter] = useState('');
    const [deletedFilter, setDeletedFilter] = useState<'all' | 'deleted' | 'not_deleted'>('not_deleted');
    const [selectedVouchers, setSelectedVouchers] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                setSystemSettings(settings);
            } catch (err) {
                console.error('Error loading system settings:', err);
            }
        };
        loadSettings();
    }, []);
    
    // ✅ Filtered and sorted vouchers
    const filteredVouchers = React.useMemo(() => {
        let filtered = [...expenseVouchers];
        
        // Voucher number search
        if (voucherNumberSearch.trim()) {
            const searchNum = parseInt(voucherNumberSearch.trim());
            if (!isNaN(searchNum)) {
                filtered = filtered.filter(v => v.voucherNumber === searchNum);
            }
        }
        
        // Date range filter
        if (startDate && endDate) {
            filtered = filtered.filter(v => {
                const vDate = new Date(v.createdAt);
                const start = new Date(`${startDate}T${startTime || '00:00'}`);
                const end = new Date(`${endDate}T${endTime || '23:59'}`);
                return vDate >= start && vDate <= end;
            });
        }
        
        // Payment method filter
        if (paymentMethodFilter !== 'all') {
            filtered = filtered.filter(v => v.paymentMethod === paymentMethodFilter);
        }
        
        // Paid to filter
        if (paidToFilter.trim()) {
            filtered = filtered.filter(v => 
                v.paidTo.toLowerCase().includes(paidToFilter.toLowerCase())
            );
        }
        
        // Deleted filter
        if (deletedFilter === 'deleted') {
            filtered = filtered.filter(v => v.isDeleted === true);
        } else if (deletedFilter === 'not_deleted') {
            filtered = filtered.filter(v => !v.isDeleted);
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'highest':
                    return b.amount - a.amount;
                case 'lowest':
                    return a.amount - b.amount;
                case 'date':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case 'payment':
                    return (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
                case 'name':
                    return a.paidTo.localeCompare(b.paidTo);
                default:
                    return 0;
            }
        });
        
        return filtered;
    }, [expenseVouchers, voucherNumberSearch, startDate, startTime, endDate, endTime, sortBy, paymentMethodFilter, paidToFilter, deletedFilter]);
    
    // ✅ Update stats when filtered vouchers or selection change
    React.useEffect(() => {
        if (onStatsUpdate) {
            // ✅ Exclude deleted vouchers
            const activeVouchers = filteredVouchers.filter(v => !v.isDeleted);
            const vouchersToUse = selectedVouchers.size > 0
                ? activeVouchers.filter(v => selectedVouchers.has(v.id))
                : activeVouchers;
            onStatsUpdate(vouchersToUse, selectedVouchers);
        }
    }, [filteredVouchers, selectedVouchers, onStatsUpdate]);
    
    // ✅ Toggle select voucher
    const toggleSelectVoucher = (voucherId: string) => {
        setSelectedVouchers(prev => {
            const next = new Set(prev);
            if (next.has(voucherId)) {
                next.delete(voucherId);
            } else {
                next.add(voucherId);
            }
            return next;
        });
    };
    
    // ✅ Toggle select all
    const toggleSelectAll = () => {
        if (selectedVouchers.size === filteredVouchers.filter(v => !v.isDeleted).length) {
            setSelectedVouchers(new Set());
        } else {
            setSelectedVouchers(new Set(filteredVouchers.filter(v => !v.isDeleted).map(v => v.id)));
        }
    };
    
    // ✅ Handle delete
    const handleDelete = async () => {
        if (selectedVouchers.size === 0) {
            error('يرجى تحديد سند واحد على الأقل للحذف');
            return;
        }
        
        const confirmed = await customConfirm({
            type: 'danger',
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد من حذف ${selectedVouchers.size} سند${selectedVouchers.size > 1 ? 'ات' : ''}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
            confirmText: 'حذف',
            cancelText: 'إلغاء'
        });
        
        if (!confirmed) {
            return;
        }
        
        setDeleting(true);
        try {
            await deleteExpenseVouchers(Array.from(selectedVouchers), user?.id);
            success(`تم حذف ${selectedVouchers.size} سند بنجاح`);
            setSelectedVouchers(new Set());
            onRefresh();
        } catch (err: any) {
            error('فشل حذف السندات');
            console.error('Error deleting vouchers:', err);
        } finally {
            setDeleting(false);
        }
    };
    
    // ✅ Print single voucher (including deleted)
    const handlePrintSingle = (voucher: ExpenseVoucher) => {
        const paymentMethodLabels = {
            'cash': 'نقداً',
            'credit': 'كريديت',
            'bank_transfer': 'تحويل بنكي',
            'deferred': 'مؤجل الدفع'
        };
        
        // ✅ التاريخ الهجري والميلادي
        const hijriDate = new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedDate = new Date(voucher.createdAt).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Convert amount to words
        const numberToWords = (num: number): string => {
            const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
            const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
            const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
            const thousands = ['', 'ألف', 'ألفان', 'ثلاثة آلاف', 'أربعة آلاف', 'خمسة آلاف', 'ستة آلاف', 'سبعة آلاف', 'ثمانية آلاف', 'تسعة آلاف'];
            
            if (num === 0) return 'صفر';
            if (num >= 10000) return num.toLocaleString('ar-SA') + ' ريال سعودي';
            
            const th = Math.floor(num / 1000);
            const h = Math.floor((num % 1000) / 100);
            const t = Math.floor((num % 100) / 10);
            const o = num % 10;
            
            let result = '';
            if (th > 0) result += thousands[th] + ' و';
            if (h > 0) result += hundreds[h] + ' و';
            if (t > 0) result += tens[t] + ' و';
            if (o > 0) result += ones[o];
            
            return result.replace(/و$/, '').trim() + ' ريال سعودي';
        };
        
        const amountInWords = numberToWords(Math.floor(voucher.amount));
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>سند صرف #${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Tajawal', Arial, sans-serif; padding: 20mm; direction: rtl; background: #f9fafb; }
                        @page { size: A4; margin: 10mm; }
                        @media print { body { padding: 0; background: white; } }
                    </style>
                </head>
                <body>
                    <div style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); padding: 25px 20px; color: white; position: relative; border-bottom: 4px solid rgba(255,255,255,0.2); margin-bottom: 30px;">
                        <div style="position: absolute; top: 20px; right: 20px; width: 100px; height: 100px; background: white; border-radius: 12px; padding: 10px; display: flex; align-items: center; justify-content: center;">
                            <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                        ${systemSettings?.companyName ? `
                        <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                            <div style="font-size: 20pt; font-weight: bold;">${systemSettings.companyName}</div>
                        </div>
                        ` : ''}
                        <div style="text-align: center;">
                            <div style="font-size: 24pt; font-weight: bold;">سند صرف</div>
                            ${voucher.isDeleted ? `
                            <div style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; font-size: 11pt; font-weight: bold; margin: 10px auto; max-width: fit-content;">
                                ⚠️ محذوف ${voucher.deletedAt ? `بتاريخ ${new Date(voucher.deletedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
                            </div>
                            ` : ''}
                            <div style="font-size: 11pt; opacity: 0.9; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
                                رقم السند: <strong>#${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="font-weight: 600; color: #475569;">رقم السند:</span>
                            <span style="color: #1e293b;">#${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="font-weight: 600; color: #475569;">التاريخ:</span>
                            <span style="color: #1e293b;">${formattedDate} (م)<br><span style="font-size: 10pt; color: #6b7280;">${hijriDate} (هـ)</span></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="font-weight: 600; color: #475569;">دفع لـ:</span>
                            <span style="color: #1e293b;">${voucher.paidTo}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <span style="font-weight: 600; color: #475569;">طريقة الدفع:</span>
                            <span style="color: #1e293b;">${paymentMethodLabels[voucher.paymentMethod] || '-'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding: 12px 0;">
                            <span style="font-weight: 600; color: #475569;">الغرض:</span>
                            <span style="color: #1e293b;">${voucher.purpose}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #0d9488; margin-bottom: 10px;">${voucher.amount.toLocaleString()} ر.س</div>
                        <div style="font-size: 16px; color: #475569;">${amountInWords}</div>
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                        تم إنشاء هذا السند من ${systemSettings?.companyName || 'نظام إدارة أدورا'}
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 250);
        }
    };
    
    // ✅ Print vouchers
    const handlePrint = () => {
        const vouchersToPrint = selectedVouchers.size > 0
            ? filteredVouchers.filter(v => selectedVouchers.has(v.id) && !v.isDeleted)
            : filteredVouchers.filter(v => !v.isDeleted);
        
        if (vouchersToPrint.length === 0) {
            error('لا توجد سندات للطباعة');
            return;
        }
        
        const paymentMethodLabels = {
            'cash': 'نقداً',
            'credit': 'كريديت',
            'bank_transfer': 'تحويل بنكي',
            'deferred': 'مؤجل الدفع'
        };
        
        // ✅ If multiple vouchers, use table report format
        if (vouchersToPrint.length > 1) {
            const totalAmount = vouchersToPrint.reduce((sum, v) => sum + v.amount, 0);
            
            const tableRows = vouchersToPrint.map(voucher => {
                // ✅ التاريخ الهجري والميلادي
                const hijriDate = new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const gregorianDate = new Date(voucher.createdAt).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${voucher.voucherNumber || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;"><div>${gregorianDate} م</div><div style="font-size: 10px; color: #666;">${hijriDate} هـ</div></td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${voucher.paidTo}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${paymentMethodLabels[voucher.paymentMethod] || '-'}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${voucher.purpose}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: left;">${voucher.amount.toLocaleString()} ر.س</td>
                    </tr>
                `;
            }).join('');
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="UTF-8">
                        <title>تقرير سندات الصرف</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body {
                                font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                                padding: 20mm;
                                direction: rtl;
                                background: #f9fafb;
                            }
                            @page {
                                size: A4 landscape;
                                margin: 10mm;
                            }
                            @media print {
                                body { padding: 0; background: white; }
                            }
                            h1 {
                                text-align: center;
                                margin-bottom: 20px;
                                color: #1e293b;
                                font-size: 24px;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-top: 20px;
                                font-size: 12px;
                            }
                            th {
                                background: #0d9488;
                                color: white;
                                padding: 10px;
                                border: 1px solid #ddd;
                                text-align: center;
                                font-weight: 600;
                            }
                            td {
                                padding: 8px;
                                border: 1px solid #ddd;
                            }
                            .total-row {
                                background: #f1f5f9;
                                font-weight: bold;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>تقرير سندات الصرف</h1>
                        <table>
                            <thead>
                                <tr>
                                    <th>رقم السند</th>
                                    <th>التاريخ</th>
                                    <th>دفع لـ</th>
                                    <th>طريقة الدفع</th>
                                    <th>الغرض</th>
                                    <th>المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                                <tr class="total-row">
                                    <td colspan="5" style="text-align: left; padding-right: 20px;">الإجمالي:</td>
                                    <td style="text-align: left;">${totalAmount.toLocaleString()} ر.س</td>
                                </tr>
                            </tbody>
                        </table>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.print();
                }, 250);
            }
        } else {
            // ✅ Single voucher print
            const voucher = vouchersToPrint[0];
            // ✅ التاريخ الهجري والميلادي
            const hijriDate = new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const gregorianDate = new Date(voucher.createdAt).toLocaleDateString('ar-EG', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeStr = new Date(voucher.createdAt).toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
            });
            const amountInWords = voucher.amountInWords || numberToArabicWords(voucher.amount);
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="UTF-8">
                        <title>سند صرف #${voucher.voucherNumber || voucher.id.slice(0, 8)}</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body {
                                font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                                padding: 20mm;
                                direction: rtl;
                                background: #f9fafb;
                            }
                            @page {
                                size: A4;
                                margin: 10mm;
                            }
                            @media print {
                                body { padding: 0; background: white; }
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                border-bottom: 2px solid #0d9488;
                                padding-bottom: 20px;
                            }
                            .company-name {
                                font-size: 20px;
                                font-weight: bold;
                                color: #1e293b;
                                margin-bottom: 10px;
                            }
                            .company-info {
                                font-size: 12px;
                                color: #64748b;
                                line-height: 1.8;
                            }
                            .voucher-title {
                                text-align: center;
                                font-size: 18px;
                                font-weight: bold;
                                margin: 30px 0;
                                color: #1e293b;
                            }
                            .voucher-details {
                                background: white;
                                border: 1px solid #e2e8f0;
                                border-radius: 8px;
                                padding: 20px;
                                margin-bottom: 20px;
                            }
                            .detail-row {
                                display: flex;
                                justify-content: space-between;
                                padding: 12px 0;
                                border-bottom: 1px solid #f1f5f9;
                            }
                            .detail-row:last-child {
                                border-bottom: none;
                            }
                            .detail-label {
                                font-weight: 600;
                                color: #475569;
                                min-width: 150px;
                            }
                            .detail-value {
                                color: #1e293b;
                                text-align: right;
                                flex: 1;
                            }
                            .amount-section {
                                background: #f8fafc;
                                padding: 20px;
                                border-radius: 8px;
                                margin-top: 20px;
                                text-align: center;
                            }
                            .amount-number {
                                font-size: 32px;
                                font-weight: bold;
                                color: #0d9488;
                                margin-bottom: 10px;
                            }
                            .amount-words {
                                font-size: 16px;
                                color: #475569;
                                margin-top: 10px;
                            }
                            .footer {
                                margin-top: 40px;
                                text-align: center;
                                font-size: 12px;
                                color: #64748b;
                                border-top: 1px solid #e2e8f0;
                                padding-top: 20px;
                            }
                        </style>
                    </head>
                    <body>
                        <!-- ✅ Enhanced Header with Logo and Company Info -->
                        <div style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); padding: 25px 20px; color: white; position: relative; border-bottom: 4px solid rgba(255,255,255,0.2); margin-bottom: 30px;">
                            <!-- Logo -->
                            <div style="position: absolute; top: 20px; right: 20px; width: 100px; height: 100px; background: white; border-radius: 12px; padding: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                                <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                            </div>
                            
                            <!-- Company Name (if available) -->
                            ${systemSettings?.companyName ? `
                            <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                                <div style="font-size: 20pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">${systemSettings.companyName}</div>
                                ${systemSettings.commercialRegistrationNumber ? `
                                <div style="font-size: 10pt; opacity: 0.9;">السجل التجاري: ${systemSettings.commercialRegistrationNumber}</div>
                                ` : ''}
                            </div>
                            ` : ''}
                            
                            <!-- Voucher Title -->
                            <div style="text-align: center;">
                                <div style="font-size: 24pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">سند صرف</div>
                                ${voucher.isDeleted ? `
                                <div style="background: #ef4444; color: white; padding: 8px 16px; border-radius: 6px; font-size: 11pt; font-weight: bold; margin: 10px auto; max-width: fit-content;">
                                    ⚠️ محذوف ${voucher.deletedAt ? `بتاريخ ${new Date(voucher.deletedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
                                </div>
                                ` : ''}
                                <div style="font-size: 11pt; opacity: 0.9; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
                                    رقم السند: <strong>#${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}</strong>
                                </div>
                            </div>
                        </div>
                        
                        <!-- ✅ Enhanced Company Information Section -->
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #0ea5e9; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);">
                            <div style="font-size: 10pt; color: #0c4a6e; font-weight: 700; margin-bottom: 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                                معلومات الشركة
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">اسم الشركة:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyName || '________________'}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الرقم الضريبي:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyTaxNumber || '________________'}</div>
                                </div>
                            </div>
                            ${systemSettings?.commercialRegistrationNumber ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">السجل التجاري:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.commercialRegistrationNumber}</div>
                                </div>
                                ${systemSettings?.contactPhone ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الهاتف:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.contactPhone}</div>
                                </div>
                                ` : '<div></div>'}
                            </div>
                            ` : ''}
                            ${systemSettings?.companyAddress ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2);">
                                <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px; text-align: center;">العنوان:</div>
                                <div style="font-size: 10pt; color: #1e293b; font-weight: 500; text-align: center;">${systemSettings.companyAddress}</div>
                            </div>
                            ` : ''}
                            ${systemSettings?.contactEmail || systemSettings?.contactWebsite ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2); display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                ${systemSettings.contactEmail ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">البريد الإلكتروني:</div>
                                    <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactEmail}</div>
                                </div>
                                ` : '<div></div>'}
                                ${systemSettings.contactWebsite ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الموقع الإلكتروني:</div>
                                    <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactWebsite}</div>
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="voucher-title">سند صرف</div>
                        ${voucher.isDeleted ? `
                        <div style="background: #ef4444; color: white; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin: 15px auto; max-width: fit-content; text-align: center;">
                            ⚠️ محذوف ${voucher.deletedAt ? `بتاريخ ${new Date(voucher.deletedAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
                        </div>
                        ` : ''}
                        
                        <div class="voucher-details">
                            <div class="detail-row">
                                <span class="detail-label">رقم السند:</span>
                                <span class="detail-value">${String(voucher.voucherNumber || voucher.id.slice(0, 8)).padStart(6, '0')}#</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">التاريخ / الوقت:</span>
                                <span class="detail-value">${gregorianDate} (الميلادي)<br>${hijriDate} (الهجري)</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">دفع لـ:</span>
                                <span class="detail-value">${voucher.paidTo}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">طريقة الدفع:</span>
                                <span class="detail-value">${paymentMethodLabels[voucher.paymentMethod] || '-'}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">الغرض:</span>
                                <span class="detail-value">${voucher.purpose}</span>
                            </div>
                            ${voucher.comments ? `
                            <div class="detail-row">
                                <span class="detail-label">تعليقات:</span>
                                <span class="detail-value">${voucher.comments}</span>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div class="amount-section">
                            <div class="amount-number">${voucher.amount.toLocaleString()} ر.س</div>
                            <div class="amount-words">المبلغ ${voucher.amount.toLocaleString()} (${amountInWords})</div>
                        </div>
                        
                        <!-- ✅ Enhanced Footer with Contact Info -->
                        <div style="padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; background: #f9fafb; margin-top: 20px; padding: 15px; border-radius: 8px;">
                            ${systemSettings?.contactPhone ? `
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 5px;">
                                للتواصل: <span style="color: #1e293b; font-weight: 600;">${systemSettings.contactPhone}</span>
                            </div>
                            ` : ''}
                            ${systemSettings?.contactEmail ? `
                            <div style="font-size: 9pt; color: #64748b; margin-bottom: 5px;">
                                البريد الإلكتروني: <span style="color: #1e293b; font-weight: 600;">${systemSettings.contactEmail}</span>
                            </div>
                            ` : ''}
                            <div style="font-size: 8pt; color: #9ca3af; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb;">
                                تم إنشاء هذا السند تلقائياً من ${systemSettings?.companyName || 'نظام إدارة أدورا'}
                            </div>
                        </div>
                    </body>
                    </html>
                `);
                printWindow.document.close();
                setTimeout(() => {
                    printWindow.print();
                }, 250);
            }
        }
    };
    
    // ✅ Export to PDF
    const handleExportPDF = async () => {
        const vouchersToExport = selectedVouchers.size > 0
            ? filteredVouchers.filter(v => selectedVouchers.has(v.id) && !v.isDeleted)
            : filteredVouchers.filter(v => !v.isDeleted);
        
        if (vouchersToExport.length === 0) {
            error('لا توجد سندات للتصدير');
            return;
        }
        
        try {
            await exportToPDF(vouchersToExport.map(v => ({
                'رقم السند': v.voucherNumber || '-',
                'التاريخ': new Date(v.createdAt).toLocaleDateString('ar-SA'),
                'دفع لـ': v.paidTo,
                'طريقة الدفع': v.paymentMethod === 'cash' ? 'نقداً' : v.paymentMethod === 'credit' ? 'كريديت' : v.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'مؤجل الدفع',
                'الغرض': v.purpose,
                'المبلغ': `${v.amount.toLocaleString()} ر.س`
            })), 'سندات_الصرف');
            success('تم تصدير الملف بنجاح');
        } catch (err) {
            error('فشل تصدير الملف');
            console.error('Error exporting PDF:', err);
        }
    };
    
    // ✅ Export to Excel
    const handleExportExcel = async () => {
        const vouchersToExport = selectedVouchers.size > 0
            ? filteredVouchers.filter(v => selectedVouchers.has(v.id) && !v.isDeleted)
            : filteredVouchers.filter(v => !v.isDeleted);
        
        if (vouchersToExport.length === 0) {
            error('لا توجد سندات للتصدير');
            return;
        }
        
        try {
            await exportToExcel(vouchersToExport.map(v => ({
                'رقم السند': v.voucherNumber || '-',
                'التاريخ': new Date(v.createdAt).toLocaleDateString('ar-SA'),
                'دفع لـ': v.paidTo,
                'طريقة الدفع': v.paymentMethod === 'cash' ? 'نقداً' : v.paymentMethod === 'credit' ? 'كريديت' : v.paymentMethod === 'bank_transfer' ? 'تحويل بنكي' : 'مؤجل الدفع',
                'الغرض': v.purpose,
                'المبلغ': v.amount
            })), 'سندات_الصرف');
            success('تم تصدير الملف بنجاح');
        } catch (err) {
            error('فشل تصدير الملف');
            console.error('Error exporting Excel:', err);
        }
    };
    
    return (
        <div className="space-y-4">
            {/* Header with Add Button */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        إضافة سند صرف
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm flex items-center gap-2 border border-white/10"
                    >
                        <Filter className="w-4 h-4" />
                        {showFilters ? 'إخفاء' : 'إظهار'} الفلاتر والبحث
                    </button>
                    {filteredVouchers.filter(v => !v.isDeleted).length > 0 && (
                        <>
                            <button
                                onClick={handleDelete}
                                disabled={selectedVouchers.size === 0 || deleting}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                حذف ({selectedVouchers.size})
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                طباعة ({selectedVouchers.size > 0 ? selectedVouchers.size : filteredVouchers.filter(v => !v.isDeleted).length})
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                <span className="hidden lg:inline">PDF</span>
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden lg:inline">Excel</span>
                            </button>
                        </>
                    )}
                </div>
                <div className="text-sm text-white/60">
                    عدد السندات: <span className="text-teal-400 font-medium">{filteredVouchers.filter(v => !v.isDeleted).length}</span>
                </div>
            </div>
            
            {/* Filters */}
            {showFilters && (
                <div className="glass rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Voucher Number Search */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">البحث برقم السند</label>
                            <input
                                type="number"
                                value={voucherNumberSearch}
                                onChange={(e) => setVoucherNumberSearch(e.target.value)}
                                placeholder="رقم السند"
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            />
                        </div>
                        
                        {/* Paid To Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">البحث بالاسم</label>
                            <input
                                type="text"
                                value={paidToFilter}
                                onChange={(e) => setPaidToFilter(e.target.value)}
                                placeholder="اسم المستلم"
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                            />
                        </div>
                        
                        {/* Start Date */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">من تاريخ</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>
                        </div>
                        
                        {/* End Date */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">إلى تاريخ</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                                />
                            </div>
                        </div>
                        
                        {/* Sort By */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">ترتيب حسب</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="date">التاريخ</option>
                                <option value="highest">الأعلى مبلغاً</option>
                                <option value="lowest">الأقل مبلغاً</option>
                                <option value="payment">طريقة الدفع</option>
                                <option value="name">الاسم</option>
                            </select>
                        </div>
                        
                        {/* Payment Method Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">طريقة الدفع</label>
                            <select
                                value={paymentMethodFilter}
                                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="all">الكل</option>
                                <option value="cash">نقداً</option>
                                <option value="credit">كريديت</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="deferred">مؤجل الدفع</option>
                            </select>
                        </div>
                        
                        {/* Deleted Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">الحالة</label>
                            <select
                                value={deletedFilter}
                                onChange={(e) => setDeletedFilter(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="not_deleted">النشطة</option>
                                <option value="deleted">المحذوفة</option>
                                <option value="all">الكل</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Clear Filters */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setVoucherNumberSearch('');
                                setStartDate('');
                                setStartTime('');
                                setEndDate('');
                                setEndTime('');
                                setSortBy('date');
                                setPaymentMethodFilter('all');
                                setPaidToFilter('');
                                setDeletedFilter('not_deleted');
                            }}
                            className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            مسح الفلاتر
                        </button>
                    </div>
                </div>
            )}
            
            {/* Select All */}
            {filteredVouchers.filter(v => !v.isDeleted).length > 0 && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleSelectAll}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
                    >
                        {selectedVouchers.size === filteredVouchers.filter(v => !v.isDeleted).length ? (
                            <>
                                <Check className="w-4 h-4" />
                                إلغاء تحديد الكل
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                تحديد الكل ({filteredVouchers.filter(v => !v.isDeleted).length})
                            </>
                        )}
                    </button>
                </div>
            )}
            
            {/* Vouchers List - ✅ Enhanced with better contrast like receipt vouchers */}
            <div className="space-y-3">
                {filteredVouchers.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-white/40 py-8">لا توجد سندات صرف</p>
                ) : (
                    filteredVouchers.map(voucher => {
                        const paymentMethodLabels = {
                            'cash': 'نقداً',
                            'credit': 'كريديت',
                            'bank_transfer': 'تحويل بنكي',
                            'deferred': 'مؤجل الدفع'
                        };
                        
                        return (
                            <div
                                key={voucher.id}
                                className={`
                                    group relative overflow-hidden rounded-xl transition-all duration-300
                                    ${voucher.isDeleted 
                                        ? 'bg-gradient-to-r from-red-50 via-gray-50 to-red-50 dark:from-red-950/20 dark:via-gray-900/40 dark:to-red-950/20 opacity-60' 
                                        : 'bg-white dark:bg-slate-800/90 dark:backdrop-blur-sm'
                                    }
                                    ${selectedVouchers.has(voucher.id) 
                                        ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20' 
                                        : 'shadow-[0_4px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.18)] dark:shadow-none'
                                    }
                                    border-2 border-slate-200 dark:border-white/10 hover:border-orange-400 dark:hover:border-orange-500/50
                                    hover:-translate-y-1
                                `}
                            >
                                {/* ✅ Orange Accent Line for Expense */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-red-500 to-orange-400" />
                                
                                <div className="p-4 flex items-center gap-4">
                                    {/* ✅ Enhanced Checkbox */}
                                        {!voucher.isDeleted && (
                                        <div className="flex-shrink-0">
                                            <label className="relative flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedVouchers.has(voucher.id)}
                                                onChange={() => toggleSelectVoucher(voucher.id)}
                                                    className="sr-only peer"
                                                />
                                                <div className={`
                                                    w-5 h-5 rounded-lg border-2 transition-all duration-200
                                                    ${selectedVouchers.has(voucher.id)
                                                        ? 'bg-orange-500 border-orange-500'
                                                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                                                    }
                                                    peer-hover:border-orange-400 peer-focus:ring-2 peer-focus:ring-orange-500/30
                                                    flex items-center justify-center
                                                `}>
                                                    {selectedVouchers.has(voucher.id) && (
                                                        <Check className="w-3 h-3 text-white" />
                                                    )}
                                            </div>
                                            </label>
                                                </div>
                                    )}
                                    
                                    {/* ✅ Voucher Number Badge */}
                                    <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center bg-gradient-to-br from-orange-100 to-red-50 dark:from-orange-900/30 dark:to-red-900/20 border border-orange-200 dark:border-orange-700/50">
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">صرف</span>
                                        <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                            {voucher.voucherNumber || '-'}
                                        </span>
                                                </div>
                                    
                                    {/* ✅ Main Info Section */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-slate-800 dark:text-white truncate">
                                                {voucher.paidTo}
                                            </span>
                                            {voucher.isDeleted && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700/50">
                                                    محذوف
                                                </span>
                                            )}
                                                </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-200 font-semibold">
                                            {/* Date - Gregorian + Hijri */}
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3 text-slate-500" />
                                                <span>
                                                    {new Date(voucher.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    <span className="text-slate-400 dark:text-slate-500 font-normal text-[10px] mx-1">|</span>
                                                    <span className="text-slate-400 dark:text-slate-500 font-normal text-[10px]">
                                                        {new Date(voucher.createdAt).toLocaleDateString('ar-SA-u-ca-islamic', { month: 'short', day: 'numeric' })} هـ
                                                    </span>
                                                </span>
                                            </span>
                                            {/* Payment Method */}
                                            <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-[10px] font-bold border border-orange-200 dark:border-orange-700/50">
                                                {paymentMethodLabels[voucher.paymentMethod] || '-'}
                                            </span>
                                                </div>
                                        {/* Purpose */}
                                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                                            {voucher.purpose}
                                            </div>
                                        </div>
                                    
                                    {/* ✅ Amount & Actions */}
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                                {voucher.amount.toLocaleString()} ر.س
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const voucherToPrint = expenseVouchers.find(v => v.id === voucher.id);
                                                if (voucherToPrint) {
                                                    handlePrintSingle(voucherToPrint);
                                                }
                                            }}
                                            className="p-2.5 rounded-lg bg-orange-100 hover:bg-orange-200 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 transition-all"
                                            title="طباعة"
                                        >
                                            <Printer className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            
            {/* Add Expense Voucher Modal */}
            {showAddModal && (
                <AddExpenseVoucherModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        onRefresh();
                    }}
                />
            )}
        </div>
    );
};

// ✅ Invoices Tab (الفواتير) - مع فلاتر وتصميم فاتورة ضريبية رسمية
const InvoicesTab: React.FC<{
    invoices: Invoice[];
    overdue: Invoice[];
}> = ({ invoices, overdue }) => {
    const { success, error } = useUX();
    const { user } = useAuth();
    const [systemSettings, setSystemSettings] = useState<any>(null);
    
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await getSystemSettings();
                setSystemSettings(settings);
            } catch (err) {
                console.error('Error loading system settings:', err);
            }
        };
        loadSettings();
    }, []);
    
    // ✅ Filters State (نفس فلاتر السندات)
    const [invoiceNumberSearch, setInvoiceNumberSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');
    const [sortBy, setSortBy] = useState<'highest' | 'lowest' | 'date' | 'payment' | 'duration'>('date');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'cash' | 'credit' | 'bank_transfer' | 'deferred'>('all');
    const [durationFilter, setDurationFilter] = useState<'all' | '1' | '2'>('all');
    const [deletedFilter, setDeletedFilter] = useState<'all' | 'deleted' | 'not_deleted'>('not_deleted');
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [deleting, setDeleting] = useState(false);
    
    // ✅ Handle delete selected invoices
    const handleDelete = async () => {
        if (selectedInvoices.size === 0) {
            error('يرجى تحديد فاتورة واحدة على الأقل للحذف');
            return;
        }
        
        const confirmed = await customConfirm({
            type: 'danger',
            title: 'تأكيد الحذف',
            message: `هل أنت متأكد من حذف ${selectedInvoices.size} فاتورة${selectedInvoices.size > 1 ? 'ات' : ''}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
            confirmText: 'حذف',
            cancelText: 'إلغاء'
        });
        
        if (!confirmed) {
            return;
        }
        
        setDeleting(true);
        try {
            await deleteInvoices(Array.from(selectedInvoices), user?.id);
            success(`تم حذف ${selectedInvoices.size} فاتورة بنجاح`);
            setSelectedInvoices(new Set());
            // Reload data
            window.location.reload();
        } catch (err: any) {
            error('فشل حذف الفواتير');
            console.error('Error deleting invoices:', err);
        } finally {
            setDeleting(false);
        }
    };
    
    // ✅ Filtered and sorted invoices
    const filteredInvoices = React.useMemo(() => {
        let filtered = [...invoices];
        
        // Invoice number search
        if (invoiceNumberSearch.trim()) {
            const searchNum = parseInt(invoiceNumberSearch.trim());
            if (!isNaN(searchNum)) {
                filtered = filtered.filter(inv => inv.invoiceNumber === searchNum);
            }
        }
        
        // Date range filter
        if (startDate && endDate) {
            filtered = filtered.filter(inv => {
                const invDate = new Date(inv.issueDate);
                const start = new Date(`${startDate}T${startTime || '00:00'}`);
                const end = new Date(`${endDate}T${endTime || '23:59'}`);
                return invDate >= start && invDate <= end;
            });
        }
        
        // Payment method filter
        if (paymentMethodFilter !== 'all') {
            filtered = filtered.filter(inv => inv.paymentMethod === paymentMethodFilter);
        }
        
        // Duration filter
        if (durationFilter !== 'all') {
            filtered = filtered.filter(inv => inv.subscriptionDuration === parseInt(durationFilter));
        }
        
        // Deleted filter
        if (deletedFilter === 'deleted') {
            filtered = filtered.filter(inv => inv.isDeleted === true);
        } else if (deletedFilter === 'not_deleted') {
            filtered = filtered.filter(inv => !inv.isDeleted);
        }
        
        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'highest':
                    return (b.totalAmount || b.amount) - (a.totalAmount || a.amount);
                case 'lowest':
                    return (a.totalAmount || a.amount) - (b.totalAmount || b.amount);
                case 'date':
                    return new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime();
                case 'payment':
                    return (a.paymentMethod || '').localeCompare(b.paymentMethod || '');
                case 'duration':
                    return (b.subscriptionDuration || 0) - (a.subscriptionDuration || 0);
                default:
                    return 0;
            }
        });
        
        return filtered;
    }, [invoices, invoiceNumberSearch, startDate, startTime, endDate, endTime, sortBy, paymentMethodFilter, durationFilter, deletedFilter]);
    
    // ✅ Toggle select invoice
    const toggleSelectInvoice = (invoiceId: string) => {
        setSelectedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceId)) {
                next.delete(invoiceId);
            } else {
                next.add(invoiceId);
            }
            return next;
        });
    };
    
    // ✅ Toggle select all
    const toggleSelectAll = () => {
        if (selectedInvoices.size === filteredInvoices.length) {
            setSelectedInvoices(new Set());
        } else {
            setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.id)));
        }
    };
    
    // ✅ Print invoices
    const handlePrint = () => {
        const invoicesToPrint = selectedInvoices.size > 0
            ? filteredInvoices.filter(inv => selectedInvoices.has(inv.id))
            : filteredInvoices;
        
        if (invoicesToPrint.length === 0) {
            error('لا توجد فواتير للطباعة');
            return;
        }
        
        const paymentMethodLabels = {
            'cash': 'كاش',
            'credit': 'كريديت',
            'bank_transfer': 'تحويل بنكي',
            'deferred': 'مؤجل الدفع'
        };
        
        // ✅ If multiple invoices, use table report format
        if (invoicesToPrint.length > 1) {
            const taxRate = 15;
            const totalAmount = invoicesToPrint.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0);
            const totalSubtotal = invoicesToPrint.reduce((sum, inv) => sum + (inv.subtotal || (inv.totalAmount || inv.amount) / (1 + taxRate / 100)), 0);
            const totalTax = totalAmount - totalSubtotal;
            
            const tableRows = invoicesToPrint.map(invoice => {
                // ✅ التاريخ الميلادي (أكبر) والهجري (أصغر)
                const gregorianDate = new Date(invoice.issueDate).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const hijriDate = new Date(invoice.issueDate).toLocaleDateString('ar-SA-u-ca-islamic', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                const subtotal = invoice.subtotal || (invoice.totalAmount || invoice.amount) / (1 + taxRate / 100);
                const taxAmount = invoice.taxAmount || (invoice.totalAmount || invoice.amount) - subtotal;
                
                return `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937; font-weight: 600;">${invoice.invoiceNumber || '-'}</td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;">${gregorianDate}<br><span style="font-size: 8pt; color: #6b7280;">${hijriDate}</span></td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;">${invoice.managerName || '-'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${invoice.managerCode || '-'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${invoice.branchCode || '-'}</td>
                        <td style="padding: 8px 6px; text-align: right; font-size: 9pt; color: #1f2937;">${invoice.branchName || '-'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${invoice.numberOfBranches || '-'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${invoice.subscriptionDuration === 1 ? 'سنة' : invoice.subscriptionDuration === 2 ? 'سنتين' : '-'}</td>
                        <td style="padding: 8px 6px; text-align: center; font-size: 9pt; color: #1f2937;">${invoice.paymentMethod ? paymentMethodLabels[invoice.paymentMethod as keyof typeof paymentMethodLabels] : '-'}</td>
                        <td style="padding: 8px 6px; text-align: left; font-size: 9pt; color: #1f2937; font-weight: 600;">${subtotal.toFixed(2)}</td>
                        <td style="padding: 8px 6px; text-align: left; font-size: 9pt; color: #1f2937; font-weight: 600;">${taxAmount.toFixed(2)}</td>
                        <td style="padding: 8px 6px; text-align: left; font-size: 9pt; color: #047857; font-weight: 700;">${(invoice.totalAmount || invoice.amount).toLocaleString()}</td>
                    </tr>
                `;
            }).join('');
            
            const printContent = `
                <!-- ✅ Enhanced Report Header with Company Info -->
                <div style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); padding: 25px 20px; color: white; margin-bottom: 20px; position: relative; border-bottom: 4px solid rgba(255,255,255,0.2);">
                    <div style="position: absolute; top: 20px; right: 20px; width: 80px; height: 80px; background: white; border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                    ${systemSettings?.companyName ? `
                    <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                        <div style="font-size: 18pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">${systemSettings.companyName}</div>
                        ${systemSettings.commercialRegistrationNumber ? `
                        <div style="font-size: 9pt; opacity: 0.9;">السجل التجاري: ${systemSettings.commercialRegistrationNumber}</div>
                        ` : ''}
                    </div>
                    ` : ''}
                    <div style="text-align: center;">
                        <div style="font-size: 24pt; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px;">تقرير محاسبي - الفواتير الضريبية</div>
                        <div style="font-size: 12pt; opacity: 0.95; margin-bottom: 10px;">ACCOUNTING REPORT - TAX INVOICES</div>
                        <div style="font-size: 11pt; opacity: 0.9; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);">
                            <div style="margin-bottom: 5px;">عدد الفواتير: <strong>${invoicesToPrint.length}</strong></div>
                            <div>تاريخ التقرير: <strong>${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
                        </div>
                    </div>
                </div>
                
                <!-- Report Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 9pt;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); color: white;">
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">رقم الفاتورة</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">التاريخ</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">اسم المدير</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">كود المدير</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">رقم الفرع</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">اسم الفرع</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">عدد الفروع</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">مدة الاشتراك</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">طريقة الدفع</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">قبل الضريبة</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">الضريبة (15%)</th>
                            <th style="padding: 12px 6px; text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid rgba(255,255,255,0.2);">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                        <!-- Total Row -->
                        <tr style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-top: 3px solid #10b981; border-bottom: 3px solid #10b981;">
                            <td colspan="9" style="padding: 12px 6px; text-align: left; font-size: 10pt; font-weight: 700; color: #047857;">المجموع الكلي:</td>
                            <td style="padding: 12px 6px; text-align: left; font-size: 10pt; font-weight: 700; color: #1f2937;">${totalSubtotal.toFixed(2)} ر.س</td>
                            <td style="padding: 12px 6px; text-align: left; font-size: 10pt; font-weight: 700; color: #1f2937;">${totalTax.toFixed(2)} ر.س</td>
                            <td style="padding: 12px 6px; text-align: left; font-size: 11pt; font-weight: 800; color: #047857;">${totalAmount.toLocaleString()} ر.س</td>
                        </tr>
                    </tbody>
                </table>
                
                <!-- Report Footer -->
                <div style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center;">
                    <div style="font-size: 9pt; color: #6b7280; margin-bottom: 5px;">تم إنشاء هذا التقرير تلقائياً من نظام إدارة أدورا</div>
                    <div style="font-size: 10pt; color: #0D9488; font-weight: 600;">شكراً لاستخدامكم</div>
                </div>
            `;
            
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                error('يرجى السماح بالنوافذ المنبثقة للطباعة');
                return;
            }
            
            printWindow.document.write(`
                <!DOCTYPE html>
                <html dir="rtl" lang="ar">
                <head>
                    <meta charset="UTF-8">
                    <title>تقرير محاسبي - الفواتير الضريبية</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                            padding: 15mm;
                            direction: rtl;
                            background: #ffffff;
                        }
                        @page { 
                            size: A4 landscape; 
                            margin: 10mm;
                        }
                        @media print {
                            body { 
                                padding: 0;
                                background: white;
                            }
                        }
                        table {
                            page-break-inside: auto;
                        }
                        tr {
                            page-break-inside: avoid;
                            page-break-after: auto;
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
                </html>
            `);
            
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 250);
            return;
        }
        
        // ✅ Single invoice - use detailed tax invoice format with QR & stamp
        const printContent = invoicesToPrint.map(invoice => {
            const formattedDate = formatDateTime(invoice.issueDate);
            const hijriDate = formatHijriDate(invoice.issueDate);
            const gregorianDate = formatGregorianDate(invoice.issueDate);
            
            const taxRate = 15;
            const subtotal = invoice.subtotal || (invoice.totalAmount || invoice.amount) / (1 + taxRate / 100);
            const taxAmount = invoice.taxAmount || (invoice.totalAmount || invoice.amount) - subtotal;
            const totalAmount = invoice.totalAmount || invoice.amount;
            
            // ✅ Generate QR Code for ZATCA compliance
            const qrData = generateInvoiceQRData({
                invoiceNumber: invoice.invoiceNumber || invoice.id.slice(0, 8),
                totalAmount: totalAmount,
                issueDate: invoice.issueDate,
                companyTaxNumber: systemSettings?.companyTaxNumber,
                companyName: systemSettings?.companyName
            });
            const qrCodeURL = generateQRCodeURL(qrData, 120);
            
            // ✅ Generate amount in words
            const amountInWords = numberToArabicWords(totalAmount);
            
            // ✅ Get document colors
            const colors = getDocumentTypeColors('invoice');
            
            return `
                <div style="page-break-after: always; padding: 0; margin: 0; max-width: 100%;">
                    <!-- Header Section with Logo & QR -->
                    <div style="background: ${colors.gradient}; padding: 25px 20px; text-align: center; color: white; position: relative;">
                        <!-- Logo -->
                        <div style="position: absolute; top: 20px; right: 20px; width: 90px; height: 90px; background: white; border-radius: 12px; padding: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <img src="/adora-logo.png" alt="Adora Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                        </div>
                        
                        <!-- QR Code for ZATCA compliance -->
                        <div style="position: absolute; top: 20px; left: 20px; width: 80px; height: 80px; background: white; border-radius: 8px; padding: 5px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                            <img src="${qrCodeURL}" alt="QR Code" style="width: 100%; height: 100%;" onerror="this.style.display='none'" />
                        </div>
                        
                        <!-- PAID Stamp -->
                        ${invoice.status === 'paid' ? `
                        <div style="position: absolute; top: 110px; left: 30px; transform: rotate(-15deg); border: 4px solid rgba(255,255,255,0.9); border-radius: 12px; padding: 8px 20px; color: rgba(255,255,255,0.95); font-size: 16pt; font-weight: bold;">
                            <div style="text-align: center;">
                                <div>✓ مدفوعة</div>
                                <div style="font-size: 10pt; margin-top: 2px;">PAID</div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${systemSettings?.companyName ? `
                        <div style="text-align: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                            <div style="font-size: 18pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">${systemSettings.companyName}</div>
                            ${systemSettings.commercialRegistrationNumber ? `
                            <div style="font-size: 9pt; opacity: 0.9;">السجل التجاري: ${systemSettings.commercialRegistrationNumber}</div>
                            ` : ''}
                            ${systemSettings.companyTaxNumber ? `
                            <div style="font-size: 9pt; opacity: 0.9;">الرقم الضريبي: ${systemSettings.companyTaxNumber}</div>
                            ` : ''}
                        </div>
                        ` : ''}
                        <div style="text-align: center;">
                            <div style="font-size: 28pt; font-weight: bold; margin-bottom: 8px; letter-spacing: 1px;">${colors.name.ar}</div>
                            <div style="font-size: 12pt; opacity: 0.95; margin-bottom: 10px;">${colors.name.en}</div>
                            <div style="font-size: 11pt; opacity: 0.9; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);">
                                رقم الفاتورة: <strong>#${String(invoice.invoiceNumber || invoice.id.slice(0, 8)).padStart(6, '0')}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <!-- ✅ Enhanced Company Info -->
                    <div style="background: #ffffff; padding: 20px; border: 2px solid #e5e7eb; border-top: none;">
                        <!-- ✅ Enhanced Company Information Section -->
                        <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 2px solid #0ea5e9; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);">
                            <div style="font-size: 10pt; color: #0c4a6e; font-weight: 700; margin-bottom: 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
                                معلومات الشركة
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">اسم الشركة:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyName || '________________'}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الرقم الضريبي:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings?.companyTaxNumber || '________________'}</div>
                                </div>
                            </div>
                            ${systemSettings?.commercialRegistrationNumber ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">السجل التجاري:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.commercialRegistrationNumber}</div>
                                </div>
                                ${systemSettings?.contactPhone ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الهاتف:</div>
                                    <div style="font-size: 11pt; color: #1e293b; font-weight: 600;">${systemSettings.contactPhone}</div>
                                </div>
                                ` : '<div></div>'}
                            </div>
                            ` : ''}
                            ${systemSettings?.companyAddress ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2);">
                                <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px; text-align: center;">العنوان:</div>
                                <div style="font-size: 10pt; color: #1e293b; font-weight: 500; text-align: center;">${systemSettings.companyAddress}</div>
                            </div>
                            ` : ''}
                            ${systemSettings?.contactEmail || systemSettings?.contactWebsite ? `
                            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(14, 165, 233, 0.2); display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                ${systemSettings.contactEmail ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">البريد الإلكتروني:</div>
                                    <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactEmail}</div>
                                </div>
                                ` : '<div></div>'}
                                ${systemSettings.contactWebsite ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 9pt; color: #64748b; margin-bottom: 3px;">الموقع الإلكتروني:</div>
                                    <div style="font-size: 10pt; color: #1e293b; font-weight: 500;">${systemSettings.contactWebsite}</div>
                                </div>
                                ` : ''}
                            </div>
                            ` : ''}
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb;">
                            <div>
                                <div style="font-size: 11pt; color: #6b7280; margin-bottom: 5px; font-weight: 600;">معلومات الشركة:</div>
                                <div style="font-size: 12pt; color: #1f2937; font-weight: 700; margin-bottom: 3px;">${systemSettings?.companyName || 'شركة أدورا لإدارة الفنادق'}</div>
                                ${systemSettings?.companyAddress ? `
                                <div style="font-size: 10pt; color: #4b5563;">${systemSettings.companyAddress}</div>
                                ` : '<div style="font-size: 10pt; color: #4b5563;">السعودية - الرياض</div>'}
                                <div style="font-size: 10pt; color: #4b5563;">الرقم الضريبي: ${systemSettings?.companyTaxNumber || '________________'}</div>
                                ${systemSettings?.commercialRegistrationNumber ? `
                                <div style="font-size: 10pt; color: #4b5563;">السجل التجاري: ${systemSettings.commercialRegistrationNumber}</div>
                                ` : ''}
                            </div>
                            <div style="text-align: left;">
                                <div style="font-size: 11pt; color: #6b7280; margin-bottom: 5px; font-weight: 600;">معلومات العميل:</div>
                                <div style="font-size: 12pt; color: #1f2937; font-weight: 700; margin-bottom: 3px;">${invoice.managerName || '-'}</div>
                                <div style="font-size: 10pt; color: #4b5563;">كود المدير: ${invoice.managerCode || '-'}</div>
                                <div style="font-size: 10pt; color: #4b5563;">الفرع: ${invoice.branchName || '-'} (${invoice.branchCode || '-'})</div>
                            </div>
                        </div>
                        
                        <!-- Invoice Details -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <div style="font-size: 10pt; color: #6b7280; margin-bottom: 3px;">تاريخ الإصدار</div>
                                <div style="font-size: 11pt; color: #1f2937; font-weight: 600;">${formattedDate}</div>
                            </div>
                            <div style="text-align: left;">
                                <div style="font-size: 10pt; color: #6b7280; margin-bottom: 3px;">طريقة الدفع</div>
                                <div style="font-size: 11pt; color: #1f2937; font-weight: 600;">${invoice.paymentMethod ? paymentMethodLabels[invoice.paymentMethod as keyof typeof paymentMethodLabels] : 'غير محدد'}</div>
                            </div>
                        </div>
                        
                        <!-- Items Table -->
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <thead>
                                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                    <th style="padding: 12px; text-align: right; font-size: 10pt; font-weight: 700; color: #1f2937; border-left: 1px solid #e5e7eb;">الوصف</th>
                                    <th style="padding: 12px; text-align: center; font-size: 10pt; font-weight: 700; color: #1f2937; border-left: 1px solid #e5e7eb;">الكمية</th>
                                    <th style="padding: 12px; text-align: left; font-size: 10pt; font-weight: 700; color: #1f2937; border-left: 1px solid #e5e7eb;">السعر</th>
                                    <th style="padding: 12px; text-align: left; font-size: 10pt; font-weight: 700; color: #1f2937;">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px; text-align: right; font-size: 10pt; color: #1f2937; border-left: 1px solid #e5e7eb;">
                                        اشتراك ${invoice.subscriptionDuration === 1 ? 'سنة واحدة' : invoice.subscriptionDuration === 2 ? 'سنتين' : 'غير محدد'} - ${invoice.branchName || '-'} (${invoice.branchCode || '-'})
                                    </td>
                                    <td style="padding: 12px; text-align: center; font-size: 10pt; color: #1f2937; border-left: 1px solid #e5e7eb;">${invoice.numberOfBranches || 1}</td>
                                    <td style="padding: 12px; text-align: left; font-size: 10pt; color: #1f2937; border-left: 1px solid #e5e7eb;">${(invoice.items?.[0]?.price || subtotal).toLocaleString()} ر.س</td>
                                    <td style="padding: 12px; text-align: left; font-size: 10pt; color: #1f2937; font-weight: 600;">${subtotal.toLocaleString()} ر.س</td>
                                </tr>
                            </tbody>
                        </table>
                        
                        <!-- Totals -->
                        <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
                            <div style="width: 320px;">
                                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                                    <span style="font-size: 10pt; color: #4b5563;">المجموع قبل الضريبة / Subtotal:</span>
                                    <span style="font-size: 11pt; color: #1f2937; font-weight: 600;">${subtotal.toFixed(2)} ر.س</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #e5e7eb;">
                                    <span style="font-size: 10pt; color: #4b5563;">ضريبة القيمة المضافة (15%) / VAT:</span>
                                    <span style="font-size: 11pt; color: #1f2937; font-weight: 600;">${taxAmount.toFixed(2)} ر.س</span>
                                </div>
                                <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 10px; padding: 15px; margin-top: 10px; border: 3px solid #10b981; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                        <span style="font-size: 11pt; color: #047857; font-weight: 700;">المبلغ الإجمالي / Total:</span>
                                        <span style="font-size: 18pt; color: #047857; font-weight: 800;">${totalAmount.toLocaleString()} ر.س</span>
                                    </div>
                                    <div style="font-size: 9pt; color: #065f46; padding: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; border: 1px solid #a7f3d0; text-align: center;">
                                        <div style="color: #047857; font-weight: 600; margin-bottom: 2px;">المبلغ كتابةً:</div>
                                        <div style="color: #1f2937; font-weight: 500;">${amountInWords}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Signature Section -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin: 20px 0; padding: 20px 0; border-top: 2px dashed #e5e7eb; border-bottom: 2px dashed #e5e7eb;">
                            <div style="text-align: center;">
                                <div style="font-size: 10pt; color: #6b7280; margin-bottom: 35px;">توقيع المستلم / Receiver</div>
                                <div style="border-top: 1px solid #1f2937; width: 140px; margin: 0 auto;"></div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 10pt; color: #6b7280; margin-bottom: 35px;">الختم الرسمي / Official Stamp</div>
                                <div style="border-top: 1px solid #1f2937; width: 140px; margin: 0 auto;"></div>
                            </div>
                        </div>
                        
                        <!-- ✅ Enhanced Footer with Contact Info -->
                        <div style="padding: 15px; background: #f9fafb; border-radius: 10px; text-align: center; border: 1px solid #e5e7eb;">
                            <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; margin-bottom: 10px;">
                                ${systemSettings?.contactPhone ? `<span style="font-size: 8pt; color: #6b7280;">📞 ${systemSettings.contactPhone}</span>` : ''}
                                ${systemSettings?.contactEmail ? `<span style="font-size: 8pt; color: #6b7280;">📧 ${systemSettings.contactEmail}</span>` : ''}
                                ${systemSettings?.contactWebsite ? `<span style="font-size: 8pt; color: #6b7280;">🌐 ${systemSettings.contactWebsite}</span>` : ''}
                            </div>
                            <div style="font-size: 10pt; color: #0D9488; font-weight: 600;">شكراً لتعاملكم معنا ✨</div>
                            <div style="font-size: 7pt; color: #9ca3af; margin-top: 4px;">Powered by Adora Hotel Management System</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            error('يرجى السماح بالنوافذ المنبثقة للطباعة');
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>فاتورة ضريبية</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                        padding: 20mm;
                        direction: rtl;
                        background: #f9fafb;
                    }
                    @page {
                        size: A4;
                        margin: 10mm;
                    }
                    @media print {
                        body {
                            padding: 0;
                            background: white;
                        }
                        div[style*="page-break"] {
                            page-break-after: always;
                            margin-bottom: 0;
                        }
                    }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };
    
    return (
        <div className="space-y-4">
            {/* Filters Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm flex items-center gap-2 border border-white/10"
                    >
                        <Filter className="w-4 h-4" />
                        {showFilters ? 'إخفاء' : 'إظهار'} الفلاتر والبحث
                    </button>
                    {filteredInvoices.length > 0 && (
                        <>
                            <button
                                onClick={handleDelete}
                                disabled={selectedInvoices.size === 0 || deleting}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                حذف ({selectedInvoices.size})
                            </button>
                            <button
                                onClick={handlePrint}
                                className="px-4 py-2 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm flex items-center gap-2"
                            >
                                <Printer className="w-4 h-4" />
                                طباعة
                            </button>
                        </>
                    )}
                </div>
                <div className="text-sm text-white/60">
                    عدد الفواتير: <span className="text-teal-400 font-medium">{filteredInvoices.length}</span>
                </div>
            </div>
            
            {/* Filters */}
            {showFilters && (
                <div className="glass rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Invoice Number Search */}
                    <div className="space-y-2">
                            <label className="text-xs text-white/60">البحث برقم الفاتورة</label>
                            <input
                                type="number"
                                value={invoiceNumberSearch}
                                onChange={(e) => setInvoiceNumberSearch(e.target.value)}
                                placeholder="رقم الفاتورة..."
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                            />
                            </div>
                        
                        {/* Date Range */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">من تاريخ</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">من وقت</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">إلى تاريخ</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">إلى وقت</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all"
                            />
                        </div>
                        
                        {/* Sort By */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">الترتيب حسب</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="date">تاريخ الإنشاء</option>
                                <option value="highest">الأعلى قيمة</option>
                                <option value="lowest">الأقل قيمة</option>
                                <option value="payment">طريقة الدفع</option>
                                <option value="duration">مدة الاشتراك</option>
                            </select>
                        </div>
                        
                        {/* Payment Method Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">طريقة الدفع</label>
                            <select
                                value={paymentMethodFilter}
                                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="all">الكل</option>
                                <option value="cash">كاش</option>
                                <option value="credit">كريديت</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="deferred">مؤجل الدفع</option>
                            </select>
                        </div>
                        
                        {/* Duration Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">مدة الاشتراك</label>
                            <select
                                value={durationFilter}
                                onChange={(e) => setDurationFilter(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="all">الكل</option>
                                <option value="1">سنة واحدة</option>
                                <option value="2">سنتين</option>
                            </select>
                        </div>
                        
                        {/* Deleted Filter */}
                        <div className="space-y-2">
                            <label className="text-xs text-white/60">حالة الفاتورة</label>
                            <select
                                value={deletedFilter}
                                onChange={(e) => setDeletedFilter(e.target.value as any)}
                                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                            >
                                <option value="not_deleted">النشطة</option>
                                <option value="deleted">المحذوفة</option>
                                <option value="all">الكل</option>
                            </select>
                        </div>
                        
                        {/* Clear Filters */}
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setInvoiceNumberSearch('');
                                    setStartDate('');
                                    setStartTime('');
                                    setEndDate('');
                                    setEndTime('');
                                    setSortBy('date');
                                    setPaymentMethodFilter('all');
                                    setDurationFilter('all');
                                    setDeletedFilter('not_deleted');
                                }}
                                className="w-full px-4 py-2.5 rounded-lg dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all text-sm font-medium flex items-center justify-center gap-2 shadow-sm shadow-red-500/10 hover:shadow-md hover:shadow-red-500/20"
                            >
                                <X className="w-4 h-4" />
                                مسح الفلاتر
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Select All */}
            {filteredInvoices.length > 0 && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleSelectAll}
                        className="px-4 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
                    >
                        {selectedInvoices.size === filteredInvoices.length ? (
                            <>
                                <Check className="w-4 h-4" />
                                إلغاء تحديد الكل
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                تحديد الكل ({filteredInvoices.length})
                            </>
                        )}
                    </button>
                </div>
            )}
            
            {/* ✅ Grouped Invoices - تجميع الفواتير حسب المشترك والتاريخ */}
            <div className="space-y-4">
                {filteredInvoices.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-white/40 py-8">لا توجد فواتير</p>
                ) : (
                    (() => {
                        const paymentMethodLabels = {
                            'cash': 'كاش',
                            'credit': 'كريديت',
                            'bank_transfer': 'تحويل بنكي',
                            'deferred': 'مؤجل'
                        };
                        
                        // Group invoices by managerCode + date (same day)
                        const groups: { [key: string]: typeof filteredInvoices } = {};
                        filteredInvoices.forEach(invoice => {
                            const dateKey = new Date(invoice.issueDate).toISOString().split('T')[0];
                            const groupKey = `${invoice.managerCode}_${dateKey}`;
                            if (!groups[groupKey]) {
                                groups[groupKey] = [];
                            }
                            groups[groupKey].push(invoice);
                        });
                        
                        // Sort groups by date (newest first)
                        const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
                            const dateA = new Date(groups[a][0].issueDate);
                            const dateB = new Date(groups[b][0].issueDate);
                            return dateB.getTime() - dateA.getTime();
                        });
                        
                        return sortedGroupKeys.map(groupKey => {
                            const groupInvoices = groups[groupKey];
                            const firstInvoice = groupInvoices[0];
                            const totalAmount = groupInvoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0);
                            const allSelected = groupInvoices.every(inv => selectedInvoices.has(inv.id));
                            const someSelected = groupInvoices.some(inv => selectedInvoices.has(inv.id));
                            
                            // Toggle all invoices in group
                            const toggleGroupSelection = () => {
                                const newSelected = new Set(selectedInvoices);
                                if (allSelected) {
                                    groupInvoices.forEach(inv => newSelected.delete(inv.id));
                                } else {
                                    groupInvoices.forEach(inv => {
                                        if (!inv.isDeleted) newSelected.add(inv.id);
                                    });
                                }
                                setSelectedInvoices(newSelected);
                            };
                            
                            // Print all invoices in group
                            const printGroup = () => {
                                const newSelected = new Set(groupInvoices.map(inv => inv.id));
                                setSelectedInvoices(newSelected);
                                setTimeout(() => handlePrint(), 100);
                            };
                            
                            return (
                                <div
                                    key={groupKey}
                                    className="bg-white dark:bg-slate-900/50 rounded-2xl border-2 border-slate-200 dark:border-white/10 shadow-lg overflow-hidden"
                                >
                                    {/* ✅ Group Header - معلومات المشترك */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 border-b border-slate-200 dark:border-white/10">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {/* Group Checkbox */}
                                                <label className="relative flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={allSelected}
                                                        onChange={toggleGroupSelection}
                                                        className="sr-only peer"
                                                    />
                                                    <div className={`
                                                        w-5 h-5 rounded-lg border-2 transition-all duration-200
                                                        ${allSelected ? 'bg-blue-500 border-blue-500' : someSelected ? 'bg-blue-200 border-blue-400' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'}
                                                        flex items-center justify-center
                                                    `}>
                                                        {(allSelected || someSelected) && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                </label>
                                                
                                                {/* Manager Info */}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-800 dark:text-white text-lg">
                                                            {firstInvoice.managerName || '-'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                                            كود: {firstInvoice.managerCode || '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-slate-400">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>
                                                            {new Date(firstInvoice.issueDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                        </span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-xs">
                                                            {new Date(firstInvoice.issueDate).toLocaleDateString('ar-SA-u-ca-islamic', { year: 'numeric', month: 'short', day: 'numeric' })} هـ
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Group Total & Actions */}
                                            <div className="flex items-center gap-4">
                                                <div className="text-left">
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">إجمالي ({groupInvoices.length} {groupInvoices.length === 1 ? 'فاتورة' : 'فواتير'})</p>
                                                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                        {totalAmount.toLocaleString()} <span className="text-sm">ر.س</span>
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={printGroup}
                                                    className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
                                                    title="طباعة كل الفواتير"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                    طباعة الكل
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* ✅ Individual Invoices - الفواتير الفردية */}
                                    <div className="p-3 space-y-2">
                                        {groupInvoices.map((invoice) => (
                                            <div
                                                key={invoice.id}
                                                className={`
                                                    relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                                                    ${invoice.isDeleted 
                                                        ? 'bg-red-50 dark:bg-red-900/10 opacity-60' 
                                                        : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }
                                                    ${selectedInvoices.has(invoice.id) ? 'ring-2 ring-blue-500' : ''}
                                                    border border-slate-200 dark:border-slate-700
                                                `}
                                            >
                                                {/* Checkbox */}
                                                <label className="flex-shrink-0 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedInvoices.has(invoice.id)}
                                                        onChange={() => toggleSelectInvoice(invoice.id)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className={`
                                                        w-4 h-4 rounded border-2 transition-all
                                                        ${selectedInvoices.has(invoice.id) ? 'bg-blue-500 border-blue-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-500'}
                                                        flex items-center justify-center
                                                    `}>
                                                        {selectedInvoices.has(invoice.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </div>
                                                </label>
                                                
                                                {/* Invoice Number */}
                                                <div className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center bg-blue-100 dark:bg-blue-900/30">
                                                    <span className="text-[8px] text-slate-500 dark:text-slate-400">فاتورة</span>
                                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{invoice.invoiceNumber || '-'}</span>
                                                </div>
                                                
                                                {/* Branch Info - الأهم للمحاسب */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-slate-800 dark:text-white">
                                                            فرع: {invoice.branchName || 'الفرع الرئيسي'}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                                                            #{invoice.branchCode || '-'}
                                                        </span>
                                                        {invoice.isDeleted && (
                                                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                                                ملغية
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                                        <span>{invoice.subscriptionDuration === 1 ? 'سنة' : 'سنتين'}</span>
                                                        <span>•</span>
                                                        <span className={`font-medium ${
                                                            invoice.paymentMethod === 'cash' ? 'text-emerald-600 dark:text-emerald-400' :
                                                            invoice.paymentMethod === 'credit' ? 'text-blue-600 dark:text-blue-400' :
                                                            invoice.paymentMethod === 'bank_transfer' ? 'text-purple-600 dark:text-purple-400' :
                                                            'text-amber-600 dark:text-amber-400'
                                                        }`}>
                                                            {paymentMethodLabels[invoice.paymentMethod as keyof typeof paymentMethodLabels] || '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Amount */}
                                                <div className="flex-shrink-0 text-left">
                                                    <span className="text-base font-bold text-slate-800 dark:text-white">
                                                        {(invoice.totalAmount || invoice.amount).toLocaleString()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mr-1">ر.س</span>
                                                </div>
                                                
                                                {/* Actions */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedInvoices(new Set([invoice.id]));
                                                        setTimeout(() => handlePrint(), 100);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 transition-all"
                                                    title="طباعة"
                                                >
                                                    <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        });
                    })()
                )}
            </div>
        </div>
    );
};

// ✅ Add Expense Voucher Modal
const AddExpenseVoucherModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
    const { success, error } = useUX();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [paidTo, setPaidTo] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'bank_transfer' | 'deferred'>('cash');
    const [purpose, setPurpose] = useState('');
    const [comments, setComments] = useState('');
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!paidTo.trim()) {
            error('يرجى إدخال اسم المستلم');
            return;
        }
        
        if (!amount || parseFloat(amount) <= 0) {
            error('يرجى إدخال مبلغ صحيح');
            return;
        }
        
        if (!purpose.trim()) {
            error('يرجى إدخال الغرض');
            return;
        }
        
        setLoading(true);
        try {
            const amountNum = parseFloat(amount);
            const amountInWords = numberToArabicWords(amountNum);
            
            await createExpenseVoucher({
                paidTo: paidTo.trim(),
                amount: amountNum,
                amountInWords,
                paymentMethod,
                purpose: purpose.trim(),
                comments: comments.trim() || undefined,
                currency: 'SAR',
                createdBy: user?.id
            });
            
            success('تم إنشاء سند الصرف بنجاح');
            onSuccess();
        } catch (err: any) {
            error('فشل إنشاء سند الصرف');
            console.error('Error creating expense voucher:', err);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white dark:bg-slate-900/95 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">إضافة سند صرف جديد</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-700 dark:text-white/80 font-medium">دفع لـ *</label>
                        <input
                            type="text"
                            value={paidTo}
                            onChange={(e) => setPaidTo(e.target.value)}
                            placeholder="اسم المستلم"
                            required
                            className="w-full px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400"
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-700 dark:text-white/80 font-medium">المبلغ (ر.س) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                required
                                className="w-full px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400"
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-sm text-slate-700 dark:text-white/80 font-medium">طريقة الدفع *</label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                required
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/10 rounded-lg text-slate-800 dark:text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all cursor-pointer hover:border-slate-400 dark:hover:border-white/20"
                            >
                                <option value="cash">نقداً</option>
                                <option value="credit">كريديت</option>
                                <option value="bank_transfer">تحويل بنكي</option>
                                <option value="deferred">مؤجل الدفع</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm text-slate-700 dark:text-white/80 font-medium">الغرض *</label>
                        <textarea
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="مثل: لأجل بدل التأمين للوحدات"
                            required
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 resize-none"
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-sm text-slate-700 dark:text-white/80 font-medium">تعليقات</label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="تعليقات إضافية (اختياري)"
                            rows={2}
                            className="w-full px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-400 resize-none"
                        />
                    </div>
                    
                    <div className="flex items-center gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'جاري الحفظ...' : 'حفظ سند الصرف'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BillingDashboard;
