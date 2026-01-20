/**
 * Enhanced Owner Dashboard
 * Professional SaaS control panel for system owner
 * Complete control over all system settings, features, and tenants
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Crown, Settings, TrendingUp, Users, Building2, Zap, Building,
    Bell, AlertTriangle, CheckCircle, MessageSquare, DollarSign,
    Activity, Shield, Database, RefreshCw, Save, Plus, X,
    Play, Pause, Eye, Edit2, Trash2, Upload, ChevronDown, Check, DoorOpen, Search, Calendar, Clock,
    LayoutDashboard, CreditCard, BarChart3, Menu, ChevronLeft, ChevronRight, LogOut, Globe, Server, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
import { useTranslation } from 'react-i18next';
import {
    getSystemSettings,
    updateSystemSettings,
    toggleFeature,
    setMaintenanceMode,
    addSystemUpdate,
    addBroadcastMessage,
    isFeatureEnabled,
    getActiveBroadcasts,
    isMaintenanceMode,
    cleanExpiredBroadcasts
} from '../../services/systemSettingsService';
import {
    getSystemAnalytics,
    getTenantAnalytics,
    TenantAnalytics
} from '../../services/analyticsService';
import { getAllManagers, createManager, isPinAvailable, suggestUniquePin, toggleLicenseStatus, renewLicense, softDeleteManager, restoreManager, getDeletedManagers, getDemoStats } from '../../services/ownerService';
import { getAllTrialRequests, markTrialRequestAsContacted, addFollowUpToTrialRequest, type TrialRequest } from '../../services/trialRequestService';
import type { SystemSettings } from '../../services/systemSettingsService';
import { PageTransition } from '../../components/common/PageTransition';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { UnifiedModal, ModalActions } from '../../components/common/UnifiedModal';
import { LineChart, BarChart, DoughnutChart } from '../../components/analytics/ChartComponents';
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';
import { FileText, AlertCircle, Download, Code2, Palette, Printer } from 'lucide-react';
import { useAllBranchesForOwner } from '../../hooks/useTenantData'; // ✅ SaaS Integration
import { clearAllCache as clearRequestCache } from '../../utils/requestCache'; // ✅ For force refresh
import { StatCard } from '../../components/common/StatCard'; // ✅ Use project StatCard
import { DataHealthReportCard } from '../../components/admin/DataHealthReportCard'; // ✅ Data Health Report
import {
    calculateMonthlyRecurringRevenue,
    calculateAnnualRecurringRevenue,
    calculateMonthlyRenewalRevenue,
    getNearestExpiringSubscription,
    getSubscription,
    renewSubscription,
    createInvoice,
    recordPayment,
    getDeletedBillingCount,
    calculateTotalRevenue
} from '../../services/billingService';
import { collection, query, where, getCountFromServer, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { calculateTenantRevenue } from '../../services/billingService';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
import { formatDualDate } from '../../utils/dateUtils';
import { LicenseNotificationWidget } from '../../components/dashboard/LicenseNotificationWidget';
import { BillingDashboard } from './BillingDashboard'; // ✅ Import for embedded billing tab
import {
    AuditLog,
    fetchActivityLogs,
    forceRefreshActivity,
    isCacheValid,
    getActionLabel,
    getActionIcon,
    getActionColor,
    formatTimeAgo
} from '../../utils/auditService';
import { TenantFirebaseConfig } from '../../components/admin/TenantFirebaseConfig';
import { CoreConfigTemplate } from '../../components/admin/CoreConfigTemplate';
import { FirebaseConfig } from '../../services/firebase';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { CreateManagerHelp } from '../../components/common/ContextualHelp'; // ✅ Contextual Help
// DeveloperSignature is now in GlobalFooter (App.tsx) - no need to import here
// ✅ Demo seeding is now handled automatically by demo links (demoLinkService.ts)
import { Sparkles, Share2 } from 'lucide-react';
// ✅ Demo Link Manager
import { DemoLinkManager } from '../../components/owner/DemoLinkManager';
// ✅ Onboarding Tour
import { useOnboardingTour } from '../../hooks/useOnboardingTour';
import { TourGuide } from '../../components/shared/TourGuide';
import { MobileMenu } from '../../components/common/MobileMenu';

// ============================================================
// TYPES
// ============================================================

type TabType = 'overview' | 'tenants' | 'settings' | 'billing' | 'core-config' | 'demo' | 'subscription-requests';

// ============================================================
// HELPER: Safe Date Conversion (handles Firestore Timestamps)
// ============================================================
/**
 * Safely convert any date-like value to a JavaScript Date
 * Handles: Firestore Timestamp, Date object, timestamp number, ISO string
 */
const toSafeDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    // Firestore Timestamp
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue?.toDate === 'function') return dateValue.toDate();
    // Already a Date
    if (dateValue instanceof Date) return dateValue;
    // Timestamp number or ISO string
    return new Date(dateValue);
};

// ============================================================
// LOCAL STORAGE CACHE - Persistent across page reloads
// ============================================================
const CACHE_KEY_PREFIX = 'adora_owner_cache_';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour - owner data doesn't need frequent updates

type CacheKey = 'analytics' | 'tenants' | 'multiBranch' | 'settings' | 'managerStats' | 'revenue';

/**
 * Get cached data from localStorage
 * Returns null if expired or not found
 */
const getCachedData = (key: CacheKey): any => {
    try {
        const cached = localStorage.getItem(CACHE_KEY_PREFIX + key);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                console.log(`📦 Cache HIT: ${key} (saved ${Math.round((Date.now() - timestamp) / 1000)}s ago)`);
                return data;
            }
            console.log(`📦 Cache EXPIRED: ${key}`);
        }
    } catch (e) {
        console.warn('Cache read error:', e);
    }
    return null;
};

/**
 * Save data to localStorage cache
 */
const setCachedData = (key: CacheKey, data: any): void => {
    try {
        localStorage.setItem(CACHE_KEY_PREFIX + key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
        console.log(`💾 Cache SAVED: ${key}`);
    } catch (e) {
        console.warn('Cache write error:', e);
    }
};

/**
 * Clear all owner dashboard cache (for logout or force refresh)
 */
const clearOwnerCache = (): void => {
    const keys: CacheKey[] = ['analytics', 'tenants', 'multiBranch', 'settings', 'managerStats', 'revenue'];
    keys.forEach(key => {
        localStorage.removeItem(CACHE_KEY_PREFIX + key);
    });
    console.log('🗑️ Owner cache cleared');
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const EnhancedOwnerDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { success, error } = useUX();
    const { t } = useTranslation();

    // ✅ SaaS Integration: Get all branches dynamically
    // ✅ Memoize to prevent unnecessary re-renders
    const { branches: allBranches, loading: branchesLoading } = useAllBranchesForOwner();
    const memoizedBranches = useMemo(() => allBranches, [allBranches.length]); // ✅ Only re-compute if length changes

    // ✅ Read active tab from URL (synced with navbar)
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = (searchParams.get('tab') || 'overview') as TabType;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingHeavyData, setLoadingHeavyData] = useState(false);
    
    // ✅ Mobile Menu State
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    // ✅ Close mobile menu when screen size changes to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024 && showMobileMenu) {
                setShowMobileMenu(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showMobileMenu]);

    // System Settings State
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    
    // ✅ Core Config Access Control
    const [showCoreConfigModal, setShowCoreConfigModal] = useState(false);
    const [coreConfigPassword, setCoreConfigPassword] = useState('');
    const [coreConfigAccessGranted, setCoreConfigAccessGranted] = useState(false);
    
    // ✅ Get visible tabs configuration (default: only show non-duplicated tabs)
    // ✅ CRITICAL: Must be defined AFTER systemSettings state
    const visibleTabs = systemSettings?.visibleTabs || {
        overview: true,      // الرئيسية - always visible
        tenants: false,      // المشتركين - in sidebar, hide by default
        billing: false,      // الفواتير - in sidebar, hide by default
        settings: false,     // الإعدادات - in sidebar, hide by default
        broadcasts: false,   // الرسائل - in sidebar, hide by default
        demo: true,          // روابط الديمو - not in sidebar, keep visible
        'core-config': false // التأسيس - in sidebar, hide by default
    };
    const [analytics, setAnalytics] = useState<any>(null);

    // ✅ Auto-show password modal when core-config tab is accessed
    useEffect(() => {
        if (activeTab === 'core-config' && !coreConfigAccessGranted && !showCoreConfigModal) {
            setShowCoreConfigModal(true);
            setCoreConfigPassword('');
        }
    }, [activeTab, coreConfigAccessGranted, showCoreConfigModal]);
    const [tenants, setTenants] = useState<TenantAnalytics[]>([]);

    // Revenue & Subscription Data
    const [mrr, setMrr] = useState(0);
    const [arr, setArr] = useState(0);
    const [monthlyRenewalRevenue, setMonthlyRenewalRevenue] = useState(0);
    const [nearestExpiring, setNearestExpiring] = useState<{
        subscription: any;
        daysUntilExpiry: number;
        branchName?: string;
        tenantName?: string;
    } | null>(null);

    // Multi-Branch Data (from MultiBranchDashboard)
    const [multiBranchData, setMultiBranchData] = useState<{
        totalUsers: number;
        totalRequests: number;
        totalRooms: number;
        revenue: number;
    } | null>(null);

    // ✅ Manager Status Stats (Active, Suspended, Deleted, Expired)
    const [managerStats, setManagerStats] = useState<{
        active: number;
        suspended: number;
        deleted: number;
        expired: number;
        total: number;
    }>({ active: 0, suspended: 0, deleted: 0, expired: 0, total: 0 });
    
    // ✅ Billing Deleted Count (invoices + vouchers)
    const [deletedBillingCount, setDeletedBillingCount] = useState(0);
    
    // ✅ Total Revenue (all invoices, not just paid)
    const [totalRevenue, setTotalRevenue] = useState(0);

    // ✅ Live Activity Feed (On-demand updates only)
    const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
    const [activityLoading, setActivityLoading] = useState(false);

    // ✅ Demo Stats (separate from main stats)
    const [demoStats, setDemoStats] = useState<{
        total: number;
        nearestExpiry: Date | null;
        farthestExpiry: Date | null;
    }>({ total: 0, nearestExpiry: null, farthestExpiry: null });

    // ✅ Progressive Loading: Show "data updated" indicator
    const [dataJustUpdated, setDataJustUpdated] = useState(false);
    const [backgroundLoading, setBackgroundLoading] = useState(false);

    // Modals
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [showFeatureModal, setShowFeatureModal] = useState(false);
    const [showAddManagerModal, setShowAddManagerModal] = useState(false);
    const [showManagerDetailsModal, setShowManagerDetailsModal] = useState(false);
    const [selectedManager, setSelectedManager] = useState<TenantAnalytics | null>(null);

    // Sidebar
    const [showSidebar, setShowSidebar] = useState(false);

    // ✅ Onboarding Tour for Owner Dashboard
    const { showTour, steps: tourSteps, closeTour, completeTour } = useOnboardingTour('owner');

    const loadDataRef = useRef(false); // ✅ Prevent multiple simultaneous loads
    const loadDataCalledRef = useRef(false); // ✅ Track if loadData was called

    useEffect(() => {
        // ✅ Only call loadData once on mount
        if (!loadDataCalledRef.current) {
            loadDataCalledRef.current = true;
            loadData();
        }

        // ✅ FAST UI: Force show page after 2 seconds max - rest loads in background
        const fastUITimeout = setTimeout(() => {
            if (loading) {
                console.log('⚡ Fast UI: Showing page now, continuing in background...');
                setLoading(false);
                setBackgroundLoading(true);
            }
        }, 2000); // ⚡ 2 seconds max wait

        // ✅ AUTO-STOP: Force stop background loading after 10 seconds (covers error cases)
        const bgLoadingTimeout = setTimeout(() => {
            setBackgroundLoading(false);
            setLoadingHeavyData(false);
        }, 10000); // ⚡ 10 seconds max for background loading

        return () => {
            clearTimeout(fastUITimeout);
            clearTimeout(bgLoadingTimeout);
        };
    }, []); // ✅ Empty deps - only run once

    // ✅ Auto-show password modal when core-config tab is accessed (from sidebar or URL)
    useEffect(() => {
        if (activeTab === 'core-config' && !coreConfigAccessGranted && !showCoreConfigModal) {
            setShowCoreConfigModal(true);
            setCoreConfigPassword('');
        }
    }, [activeTab, coreConfigAccessGranted, showCoreConfigModal]);

    // ✅ Fetch activity when entering overview tab (ON-DEMAND only, no real-time)
    // 🔥 SAVES FIREBASE QUOTA: Only fetches on page load/refresh, manual refresh button available
    useEffect(() => {
        if (activeTab === 'overview') {
            // ✅ Fetch once when opening overview tab (uses cache if available)
            fetchActivityLogs(false).then(({ logs }) => {
                setActivityLogs(logs);
            }).catch(err => {
                console.error('Failed to fetch activity logs:', err);
                setActivityLogs([]);
            });

            // ✅ Load demo stats separately (doesn't affect main calculations)
            loadDemoStats();
        }
    }, [activeTab]);

    // ✅ Load demo stats separately (doesn't affect main calculations)
    // ✅ FIX: Uses service function - follows architecture rules
    const loadDemoStats = async () => {
        try {
            const stats = await getDemoStats();
            setDemoStats(stats);
        } catch (err) {
            console.error('Failed to load demo stats:', err);
            setDemoStats({ total: 0, nearestExpiry: null, farthestExpiry: null });
        }
    };

    const loadData = async (forceRefresh: boolean = false) => {
        // ✅ Prevent multiple simultaneous loads
        if (loadDataRef.current) {
            console.log('⏸️ loadData already in progress, skipping...');
            return;
        }

        loadDataRef.current = true;
        console.log(forceRefresh ? '🔄 Force refresh requested' : '📦 Loading with cache...');

        // ✅ FIX: Clear ALL caches when force refresh requested
        if (forceRefresh) {
            console.log('🗑️ Clearing all cached data...');
            // Clear localStorage cache
            localStorage.removeItem(CACHE_KEY_PREFIX + 'settings');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'analytics');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'revenue');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'tenants');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'multiBranch');
            localStorage.removeItem(CACHE_KEY_PREFIX + 'managerStats');
            // Clear in-memory request cache
            clearRequestCache();
        }

        // ✅ PHASE 0: Show cached data IMMEDIATELY (instant UI)
        if (!forceRefresh) {
            const cachedSettings = getCachedData('settings');
            const cachedAnalytics = getCachedData('analytics');
            const cachedRevenue = getCachedData('revenue');
            const cachedTenants = getCachedData('tenants');
            const cachedMultiBranch = getCachedData('multiBranch');
            const cachedManagerStats = getCachedData('managerStats');

            // Apply cached data immediately - user sees page instantly!
            if (cachedSettings) setSystemSettings(cachedSettings);
            if (cachedAnalytics) setAnalytics(cachedAnalytics);
            if (cachedTenants) setTenants(cachedTenants);
            if (cachedMultiBranch) setMultiBranchData(cachedMultiBranch);
            if (cachedManagerStats) setManagerStats(cachedManagerStats);
            if (cachedRevenue) {
                setMrr(cachedRevenue.mrr || 0);
                setArr(cachedRevenue.arr || 0);
                setMonthlyRenewalRevenue(cachedRevenue.monthlyRenewal || 0);
                setNearestExpiring(cachedRevenue.nearestExpiring || null);
            }

            // If we have all cached data, stop loading immediately
            if (cachedSettings && cachedAnalytics && cachedTenants) {
                console.log('✅ All data from cache - showing page instantly');
                setLoading(false);
                loadDataRef.current = false;

                // Still fetch fresh data in background (silent update)
                setBackgroundLoading(true);
                fetchFreshDataInBackground();
                return;
            }
        }

        // ✅ PHASE 1: Fetch fresh data from Firebase (once per page load or refresh)
        try {
            const [settings, analyticsData] = await Promise.all([
                getSystemSettings().catch(() => null),
                getSystemAnalytics().catch(() => null)
            ]);

            if (settings) {
                setSystemSettings(settings);
                setCachedData('settings', settings);
            }
            if (analyticsData) {
                setAnalytics(analyticsData);
                setCachedData('analytics', analyticsData);
            }

            // ✅ PHASE 2: Load revenue data
            const [monthlyRev, annualRev, renewalRev, nearest, totalRev] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null),
                calculateTotalRevenue().catch(() => 0) // ✅ FIX: Calculate total revenue from ALL invoices
            ]);

            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            setTotalRevenue(totalRev); // ✅ FIX: Set total revenue

            // Cache revenue data
            setCachedData('revenue', {
                mrr: monthlyRev,
                arr: annualRev,
                monthlyRenewal: renewalRev,
                nearestExpiring: nearest
            });

        } catch (err: any) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
            loadDataRef.current = false;

            // Show "updated" indicator if this was a refresh
            if (forceRefresh || backgroundLoading) {
                setBackgroundLoading(false);
                setDataJustUpdated(true);
                setTimeout(() => setDataJustUpdated(false), 3000);
            }
        }

        // ✅ PHASE 3: Load heavy data in background
        if (!loadingHeavyData) {
            loadHeavyDataInBackground();
        }
    };

    // ✅ Background data fetcher - runs silently without blocking UI
    const fetchFreshDataInBackground = async () => {
        try {
            // Settings & Analytics
            const [settings, analyticsData] = await Promise.all([
                getSystemSettings().catch(() => null),
                getSystemAnalytics().catch(() => null)
            ]);

            if (settings) {
                setSystemSettings(settings);
                setCachedData('settings', settings);
            }
            if (analyticsData) {
                setAnalytics(analyticsData);
                setCachedData('analytics', analyticsData);
            }

            // Revenue
            const [monthlyRev, annualRev, renewalRev, nearest, totalRev] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null),
                calculateTotalRevenue().catch(() => 0) // ✅ FIX: Calculate total revenue
            ]);

            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            setTotalRevenue(totalRev); // ✅ FIX: Set total revenue
            setCachedData('revenue', { mrr: monthlyRev, arr: annualRev, monthlyRenewal: renewalRev, nearestExpiring: nearest, totalRevenue: totalRev });

            // Heavy data
            await loadHeavyDataInBackground();

        } catch (err) {
            console.warn('Background refresh error:', err);
        } finally {
            setBackgroundLoading(false);
            setDataJustUpdated(true);
            setTimeout(() => setDataJustUpdated(false), 3000);
        }
    };

    // ✅ Load manager status statistics
    const loadManagerStats = async () => {
        try {
            const managers = await getAllManagers();
            const deletedManagers = await getDeletedManagers().catch(() => []);

            let active = 0;
            let suspended = 0;
            let expired = 0;
            
            // ✅ DEBUG: Log manager details for troubleshooting
            console.log('📊 [ManagerStats] Total managers found:', managers.length);
            console.log('📊 [ManagerStats] Deleted managers:', deletedManagers.length);
            
            const managerDetails: any[] = [];
            
            managers.forEach((m: any) => {
                const status = m.status || 'active';
                const isDeleted = m.isDeleted === true || m.deletedAt;
                const hasTenantId = m.tenantId && typeof m.tenantId === 'string' && m.tenantId.trim();

                // ✅ DEBUG: Collect manager info for logging
                managerDetails.push({
                    id: m.id,
                    name: m.name,
                    code: m.code,
                    status,
                    isDeleted,
                    hasTenantId: !!hasTenantId,
                    tenantId: m.tenantId
                });

                if (isDeleted) {
                    console.warn(`⚠️ [ManagerStats] Manager ${m.name} (${m.code}) is marked as deleted but still in main list. Consider running softDeleteManager().`);
                    return; // Skip soft-deleted in main list
                }

                if (status === 'active') active++;
                else if (status === 'suspended') suspended++;
                else if (status === 'expired' || status === 'inactive') expired++;
            });
            
            // ✅ DEBUG: Log manager breakdown
            console.log('📊 [ManagerStats] Breakdown:', {
                active,
                suspended,
                expired,
                deleted: deletedManagers.length,
                totalInMainList: managers.length
            });
            console.log('📊 [ManagerStats] Manager details:', managerDetails);

            // ✅ FIX: Include deleted billing documents (invoices + vouchers) in deleted count
            const deletedBilling = await getDeletedBillingCount().catch(() => 0);
            const totalDeleted = deletedManagers.length + deletedBilling;

            const stats = {
                active,
                suspended,
                deleted: totalDeleted, // ✅ Now includes managers + billing documents
                expired,
                total: active + suspended + expired + totalDeleted
            };

            setManagerStats(stats);
            setDeletedBillingCount(deletedBilling);
            setCachedData('managerStats', stats); // ✅ Cache locally
        } catch (err) {
            console.warn('Error loading manager stats:', err);
        }
    };

    // ✅ Load heavy data in background (non-blocking) - WITH CACHING
    const loadHeavyDataInBackground = async () => {
        // ✅ PERFORMANCE: Check cache first
        const cachedTenants = getCachedData('tenants');
        const cachedMultiBranch = getCachedData('multiBranch');

        if (cachedTenants && cachedMultiBranch) {
            setTenants(cachedTenants);
            setMultiBranchData(cachedMultiBranch);
            loadManagerStats(); // ✅ Still load manager stats for accurate counts
            return; // Use cached data, skip Firebase
        }

        setLoadingHeavyData(true);
        try {
            // Load tenant analytics, multi-branch data, and manager stats in parallel - with error handling
            const [tenantAnalytics] = await Promise.all([
                !cachedTenants ? getTenantAnalytics().catch((err: any) => {
                    if (err?.code === 'resource-exhausted') return [];
                    return [];
                }) : Promise.resolve(cachedTenants),
                !cachedMultiBranch ? loadMultiBranchData().catch(() => { }) : Promise.resolve(),
                loadManagerStats() // ✅ Load manager statistics
            ]);

            if (tenantAnalytics && tenantAnalytics.length > 0) {
                setTenants(tenantAnalytics);
                setCachedData('tenants', tenantAnalytics);
            }
        } catch (err: any) {
            // Silent fail for background loading
        } finally {
            setLoadingHeavyData(false);

            // ✅ Show "data updated" pulse when background loading completes
            setDataJustUpdated(true);
            setTimeout(() => setDataJustUpdated(false), 3000);
        }
    };

    // ✅ Load multi-branch aggregated data - SIMPLIFIED & CACHED
    const loadMultiBranchData = async () => {
        // ✅ PERFORMANCE: Check cache first
        const cachedMultiBranch = getCachedData('multiBranch');
        if (cachedMultiBranch) {
            setMultiBranchData(cachedMultiBranch);
            return;
        }

        try {
            const managers = await getAllManagers();

            // ✅ FIX: Filter out deleted, suspended, and expired managers for accurate stats
            // Only count ACTIVE managers with valid licenses
            const activeManagers = managers.filter(m => {
                if (!m.tenantId) return false;
                if ((m as any).isDeleted === true || (m as any).deletedAt) return false;
                const status = (m as any).status || 'active';
                if (status === 'suspended' || status === 'inactive' || status === 'expired') return false;
                return true;
            });

            // ✅ PERFORMANCE: Use ESTIMATED counts from manager info instead of N queries
            // This avoids the heavy getCountFromServer calls that cause quota exhaustion
            const aggregated = activeManagers
                .reduce((acc, manager: any) => ({
                    totalUsers: acc.totalUsers + (manager.cachedStats?.totalUsers || 5), // Estimate
                    totalRequests: acc.totalRequests + (manager.cachedStats?.totalRequests || 0),
                    totalRooms: acc.totalRooms + (manager.cachedStats?.totalRooms || 10), // Estimate
                    revenue: acc.revenue + (manager.cachedStats?.revenue || 0)
                }), { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 });

            // Cache and set
            setCachedData('multiBranch', aggregated);
            setMultiBranchData(aggregated);

        } catch (error: any) {
            // Silent fail - use defaults
            const defaultData = { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 };
            setMultiBranchData(defaultData);
        }
    };

    // ✅ LEGACY: Heavy data loader (only called when explicitly refreshing)
    const loadMultiBranchDataHeavy = async () => {
        try {
            const managers = await getAllManagers();

            // ✅ Process in batches of 3 to avoid quota exhaustion
            const BATCH_SIZE = 3;
            let aggregated = { totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 };

            const validManagers = managers.filter(m => m.tenantId);
            for (let i = 0; i < validManagers.length; i += BATCH_SIZE) {
                const batch = validManagers.slice(i, i + BATCH_SIZE);

                const batchResults = await Promise.all(batch.map(async (manager) => {
                    const tenantId = manager.tenantId!;
                    try {
                        // Single batch of queries per tenant
                        if (!db) {
                            return { users: 0, requests: 0, rooms: 0, revenue: 0 };
                        }
                        const [usersCount, requestsCount] = await Promise.all([
                            getCountFromServer(query(collection(db, 'users'), where('tenantId', '==', tenantId))).catch(() => ({ data: () => ({ count: 0 }) })),
                            getCountFromServer(query(collection(db, 'requests'), where('tenantId', '==', tenantId))).catch(() => ({ data: () => ({ count: 0 }) }))
                        ]);

                        return {
                            users: usersCount.data().count,
                            requests: requestsCount.data().count,
                            rooms: 0, // Skip room queries to reduce load
                            revenue: 0
                        };
                    } catch {
                        return { users: 0, requests: 0, rooms: 0, revenue: 0 };
                    }
                }));

                batchResults.forEach(result => {
                    aggregated.totalUsers += result.users;
                    aggregated.totalRequests += result.requests;
                    aggregated.totalRooms += result.rooms;
                    aggregated.revenue += result.revenue;
                });

                // Small delay between batches to avoid rate limiting
                if (i + BATCH_SIZE < validManagers.length) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            setCachedData('multiBranch', aggregated);
            setMultiBranchData(aggregated);
        } catch {
            setMultiBranchData({ totalUsers: 0, totalRequests: 0, totalRooms: 0, revenue: 0 });
        }
    };


    const handleToggleFeature = async (featureKey: keyof SystemSettings['features'], enabled: boolean) => {
        setSaving(true);
        try {
            await toggleFeature(featureKey, enabled, user?.id || 'system');

            // ✅ Update local state immediately (no page reload needed)
            if (systemSettings) {
                setSystemSettings({
                    ...systemSettings,
                    features: {
                        ...systemSettings.features,
                        [featureKey]: enabled
                    }
                });
            }

            // ✅ Cleanup feature data when disabled
            if (!enabled) {
                try {
                    const { cleanupFeatureForAllTenants } = await import('../../services/featureCleanupService');
                    await cleanupFeatureForAllTenants(featureKey);
                    console.log(`✅ Cleaned up data for disabled feature: ${featureKey}`);
                } catch (cleanupError) {
                    console.warn(`⚠️ Cleanup failed for ${featureKey}:`, cleanupError);
                    // Don't block the toggle if cleanup fails
                }
            }

            // ✅ FIX: Invalidate cache first, then dispatch event
            try {
                const { invalidateCache } = await import('../../utils/requestCache');
                invalidateCache('settings:system');
            } catch (err) {
                console.warn('Could not invalidate cache:', err);
            }

            // ✅ FIX: Dispatch event to notify all components using useFeatureGate
            window.dispatchEvent(new CustomEvent('adora_feature_toggled', {
                detail: { featureKey, enabled }
            }));

            // ✅ No need to reload all data - just update the feature state
            // Components using useFeatureGate will automatically re-check and hide/show
            success(t('admin.featureEnabled', { 
                action: enabled ? t('admin.featureEnabledAction') : t('admin.featureDisabledAction'),
                hidden: !enabled ? t('admin.featureHiddenNote') : ''
            }));
        } catch (err: any) {
            error(t('admin.errorUpdatingFeature'));
            // ✅ Rollback on error
            if (systemSettings) {
                setSystemSettings({
                    ...systemSettings,
                    features: {
                        ...systemSettings.features,
                        [featureKey]: !enabled
                    }
                });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleMaintenanceMode = async (enabled: boolean, message?: string) => {
        setSaving(true);
        try {
            await setMaintenanceMode(enabled, message, user?.id);
            await loadData(true); // Force refresh after change
            success(enabled ? t('admin.maintenanceEnabled') : t('admin.maintenanceDisabled'));
        } catch (err: any) {
            error(t('admin.errorUpdatingMaintenance'));
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async (updates: Partial<SystemSettings>) => {
        setSaving(true);
        try {
            await updateSystemSettings(updates, user?.id || 'system');

            // ✅ Update local state immediately (no page reload needed)
            if (systemSettings) {
                const updatedSettings = {
                    ...systemSettings,
                    ...updates
                };
                setSystemSettings(updatedSettings);

                // ✅ FIX: Update BOTH caches so settings persist on refresh
                setCachedData('settings', updatedSettings);

                // ✅ Also update the system localStorage directly (synced with systemSettingsService)
                const localKey = 'adora_system_settings';
                const localData = localStorage.getItem(localKey);
                const existing = localData ? JSON.parse(localData) : {};
                localStorage.setItem(localKey, JSON.stringify({ ...existing, ...updates, updatedAt: new Date().toISOString() }));
            }

            success(t('admin.settingsSaved'));
        } catch (err: any) {
            error(t('admin.errorSavingSettings'));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div
                className="min-h-screen flex items-center justify-center transition-colors duration-300"
                style={{ background: 'var(--theme-gradient-page)' }}
            >
                <div className="text-center">
                    <AdoraLoader
                        size="xl"
                        message={t('admin.loadingBasicData')}
                        showMessage={true}
                    />
                    {loadingHeavyData && (
                        <p className="text-sm mt-4 animate-pulse" style={{ color: 'var(--theme-text-tertiary)' }}>
                            {t('admin.loadingAdditionalData')}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // ✅ Handle Core Config Access
    const handleCoreConfigAccess = () => {
        if (coreConfigPassword.trim().toLowerCase() === 'adora') {
            setCoreConfigAccessGranted(true);
            setShowCoreConfigModal(false);
            setCoreConfigPassword('');
            setSearchParams({ tab: 'core-config' });
            success(t('admin.configModeAccessGranted'));
        } else {
            error(t('admin.wrongPassword'));
        }
    };

    // ✅ Use default settings if not loaded yet (Progressive Loading)
    const effectiveSettings = (systemSettings || {
        systemVersion: '2.0.0',
        maintenanceMode: false,
        maintenanceMessage: '',
        enabledFeatures: {},
        defaultLanguage: 'ar',
        availableLanguages: ['ar', 'en'],
        defaultTheme: 'light',
        availableThemes: ['light', 'dark'],
        maxBranchesPerTenant: 10,
        subscriptionPrice: 5000,
        trialPeriodDays: 14,
        broadcastMessages: [],
    }) as SystemSettings;

    return (
        <PageTransition>
            {/* ✅ Schedulers are already in GlobalServicesProvider - no need to duplicate */}
            <div
                className="flex transition-colors duration-300"
                style={{ 
                    background: 'var(--theme-gradient-page)',
                    minHeight: '100vh',
                    width: '100%',
                    position: 'relative'
                }}
            >
                {/* ✅ DESKTOP SIDEBAR - Hidden on mobile (STRICT: Never show on mobile) */}
                <div className="hidden lg:block desktop-sidebar-container flex-shrink-0 fixed top-0 right-0 h-screen z-30">
                    <aside id="admin-sidebar" className="h-full">
                        <AdminSidebar 
                            isOwner={user?.role === 'owner'} 
                        />
                    </aside>
                </div>

                {/* ✅ MOBILE SIDEBAR DRAWER - Shows on mobile only (STRICT: Only on mobile) */}
                {showMobileMenu && (
                    <div className="lg:hidden fixed inset-0 z-[60]">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 transition-opacity duration-300"
                            style={{ 
                                background: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(4px)',
                                animation: 'fadeIn 0.3s ease-out'
                            }}
                            onClick={() => setShowMobileMenu(false)}
                        />
                        {/* Sidebar Container - Slides from right */}
                        <div 
                            className="absolute top-0 right-0 h-full w-80 max-w-[85vw] shadow-2xl"
                            style={{
                                background: 'var(--theme-bg-secondary)',
                                borderLeft: '1px solid var(--theme-border-primary)',
                                animation: 'slideInFromRight 0.3s ease-out',
                                transform: 'translateX(0)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AdminSidebar 
                                isOwner={user?.role === 'owner'}
                                onClose={() => setShowMobileMenu(false)}
                            />
                        </div>
                        <style>{`
                            @keyframes fadeIn {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                            @keyframes slideInFromRight {
                                from { transform: translateX(100%); }
                                to { transform: translateX(0); }
                            }
                        `}</style>
                    </div>
                )}

                {/* Main Content Area - Responsive margin for sidebar (NO margin on mobile) */}
                <main 
                    className="flex-1 p-3 sm:p-4 pb-24 lg:pb-32 lg:pt-4 pt-4 overflow-x-hidden min-w-0 flex flex-col w-full transition-all duration-300 lg:mr-[280px] mr-0" 
                    style={{ 
                        minHeight: '100vh',
                        paddingBottom: '6rem'
                    }}
                >
                    <div className="flex-1 w-full min-h-full">
                        {/* ✅ Header - Mobile Responsive */}
                        <div className="mb-3 sm:mb-4">
                            <div className="flex items-center justify-between mb-2 gap-2">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    {/* 📱 Mobile Menu Button - Always visible on mobile */}
                                    <button
                                        onClick={() => setShowMobileMenu(true)}
                                        className="lg:hidden w-10 h-10 rounded-xl bg-primary-500/20 hover:bg-primary-500/30 text-primary-500 border border-primary-500/30 flex items-center justify-center transition-all flex-shrink-0 shadow-lg"
                                        aria-label="فتح القائمة"
                                        style={{ zIndex: 50 }}
                                    >
                                        <Menu className="w-5 h-5" />
                                    </button>
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                                        <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h1 className="text-lg sm:text-2xl font-bold text-white truncate">{t('admin.mainDashboard')}</h1>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-white/60 truncate">{allBranches.length} {t('sidebar.branch')} {t('auth.activeLabel')} • {t('admin.appManagement')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => loadData(true)}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                    >
                                        {saving ? <AdoraLoaderInline size={16} /> : <RefreshCw className="w-4 h-4" />}
                                        <span className="hidden sm:inline text-sm font-medium">{t('admin.refresh')}</span>
                                    </button>
                                    <button
                                        onClick={logout}
                                        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/30 hover:border-teal-500/50 transition-all"
                                        title={t('admin.logoutTitle')}
                                    >
                                        <LogOut className="w-4 h-4 flip-rtl" />
                                        <span className="hidden sm:inline text-sm font-medium">{t('admin.logout')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ✅ Navigation Bar - Responsive */}
                        <div
                            className="solid-modal rounded-xl sm:rounded-2xl p-2 overflow-hidden md:overflow-x-auto scrollbar-hide mb-4"
                            style={{
                                background: 'var(--theme-bg-secondary)',
                                border: '1px solid var(--theme-border-primary)'
                            }}
                        >
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                            {/* ✅ Sidebar is always visible - No hamburger menu needed */}

                            {/* 📱 MOBILE: Show current tab name only (hamburger button is in header) */}
                            <div className="flex md:hidden items-center gap-2 flex-1 min-w-0">
                                {(() => {
                                    const tabs = [
                                        { id: 'overview', label: t('admin.overview'), icon: LayoutDashboard, key: 'overview' },
                                        { id: 'tenants', label: t('admin.createManager'), icon: Users, key: 'tenants' },
                                        { id: 'billing', label: t('admin.billing'), icon: CreditCard, key: 'billing' },
                                        { id: 'settings', label: t('admin.systemSettings'), icon: Settings, key: 'settings' },
                                        { id: 'demo', label: t('admin.demoLinks'), icon: Share2, key: 'demo' },
                                        { id: 'core-config', label: t('admin.coreSetup'), icon: Shield, key: 'core-config' },
                                    ]
                                    .filter(tab => {
                                        const tabKey = (tab as any).key;
                                        return visibleTabs[tabKey as keyof typeof visibleTabs] !== false;
                                    });
                                    const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
                                    const Icon = currentTab.icon;
                                    return (
                                        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-teal-500/20 min-w-0 flex-1">
                                            <Icon className="w-4 h-4 text-teal-400 flex-shrink-0" />
                                            <span className="text-xs sm:text-sm font-medium text-teal-400 truncate">{currentTab.label}</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 🖥️ DESKTOP: Show all tabs */}
                            <div className="hidden md:flex items-center gap-3 min-w-max">
                                {/* Divider */}
                                <div className="w-px h-8 bg-white/10"></div>

                                {/* Tabs */}
                                <div className="flex gap-1 sm:gap-2" data-tour="owner-tabs">
                                    {[
                                        { id: 'overview' as TabType, label: t('admin.overview'), icon: LayoutDashboard, key: 'overview' },
                                        { id: 'tenants' as TabType, label: t('admin.createManager'), icon: Users, key: 'tenants' },
                                        { id: 'billing' as TabType, label: t('admin.billing'), icon: CreditCard, key: 'billing' },
                                        { id: 'settings' as TabType, label: t('admin.systemSettings'), icon: Settings, key: 'settings' },
                                        { id: 'subscription-requests' as TabType, label: t('admin.subscriptionRequests'), icon: MessageSquare, key: 'subscription-requests' },
                                        { id: 'demo' as TabType, label: t('admin.demoLinks'), icon: Share2, key: 'demo' },
                                        { id: 'core-config' as TabType, label: t('admin.coreSetup'), icon: Shield, hidden: true, key: 'core-config' },
                                        // ✅ REMOVED: broadcasts (not owner's responsibility)
                                    ]
                                    .filter(tab => {
                                        // ✅ Filter: Only show tabs that are enabled in visibleTabs config
                                        const tabKey = (tab as any).key;
                                        return visibleTabs[tabKey as keyof typeof visibleTabs] !== false;
                                    })
                                    .map(tab => {
                                        const Icon = tab.icon;
                                        const isActive = activeTab === tab.id;
                                        const isHidden = (tab as any).hidden;

                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => {
                                                    if (tab.id === 'core-config') {
                                                        // ✅ Show password modal for core-config
                                                        setShowCoreConfigModal(true);
                                                        setCoreConfigPassword('');
                                                    } else {
                                                        setSearchParams({ tab: tab.id });
                                                    }
                                                }}
                                                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm font-medium ${isActive
                                                        ? isHidden
                                                            ? 'bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/30'
                                                            : 'bg-teal-500/20 text-teal-400 shadow-sm'
                                                        : isHidden
                                                            ? 'hover:bg-red-500/10 opacity-60 hover:opacity-100'
                                                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                                                    }`}
                                                style={{
                                                    color: isActive
                                                        ? isHidden
                                                            ? 'rgb(248, 113, 113)'
                                                            : 'var(--theme-primary-400, #2dd4bf)'
                                                        : 'var(--theme-text-secondary)',
                                                }}
                                                title={isHidden ? t('admin.hiddenPageOwnerOnly') : undefined}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ✅ Background Loading Indicator - Subtle, non-blocking */}
                    {(loadingHeavyData || backgroundLoading) && (
                        <div
                            className="solid-modal rounded-xl p-2 sm:p-3 flex items-center gap-2 sm:gap-3 animate-pulse"
                            style={{
                                border: '1px solid var(--theme-primary-500)',
                                background: 'var(--theme-bg-secondary)'
                            }}
                        >
                            <AdoraLoader size="sm" showMessage={false} />
                            <span className="text-xs sm:text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                ⏳ {t('admin.fetchingData')}
                            </span>
                        </div>
                    )}

                    {/* ✅ Data Updated Toast - Shows when background loading completes */}
                    {dataJustUpdated && !loadingHeavyData && !backgroundLoading && (
                        <div
                            className="solid-modal rounded-xl p-2 sm:p-3 flex items-center justify-between gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
                            style={{
                                border: '1px solid var(--theme-success-500, #22c55e)',
                                background: 'var(--theme-bg-secondary)'
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                                <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                                    ✅ {t('common.success')}
                                </span>
                            </div>
                            <button
                                onClick={() => setDataJustUpdated(false)}
                                className="p-1 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: 'var(--theme-text-tertiary)' }} />
                            </button>
                        </div>
                    )}

                    {/* ✅ TABS MOVED TO NAVBAR - More space for content */}

                    {/* License Notifications Widget - Always visible */}
                    <LicenseNotificationWidget forOwner={true} maxNotifications={5} />

                    {/* Tab Content */}
                    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                systemSettings={effectiveSettings}
                                analytics={analytics}
                                onMaintenanceToggle={handleMaintenanceMode}
                                allBranches={allBranches} // ✅ SaaS Integration
                                mrr={mrr}
                                arr={arr}
                                monthlyRenewalRevenue={monthlyRenewalRevenue}
                                totalRevenue={totalRevenue} // ✅ Pass totalRevenue to OverviewTab
                                nearestExpiring={nearestExpiring}
                                multiBranchData={multiBranchData}
                                managerStats={managerStats} // ✅ Manager status stats
                                activityLogs={activityLogs} // ✅ Activity feed (on-demand)
                                onActivityRefresh={setActivityLogs} // ✅ Callback for manual refresh
                                demoStats={demoStats} // ✅ Demo stats (separate from main stats)
                            />
                        )}

                        {activeTab === 'tenants' && (
                            <TenantsTab
                                tenants={tenants}
                                onRefresh={() => loadData(true)}  // ✅ FIX: Force refresh to clear cache
                                onAddManager={() => setShowAddManagerModal(true)}
                                onViewDetails={(tenant) => {
                                    console.log('👁️ View Details clicked:', tenant.tenantName, tenant.tenantId);
                                    console.log('👁️ Setting showManagerDetailsModal to true');
                                    setSelectedManager(tenant);
                                    setShowManagerDetailsModal(true);
                                    console.log('👁️ States should be set now');
                                }}
                            />
                        )}

                        {activeTab === 'settings' && (
                            <SettingsTab
                                systemSettings={effectiveSettings}
                                onSave={handleSaveSettings}
                                saving={saving}
                                features={effectiveSettings.features}
                                onToggleFeature={handleToggleFeature}
                            />
                        )}

                        {/* ✅ REMOVED: updates and broadcasts tabs - not owner's responsibility */}

                        {activeTab === 'billing' && (
                            <BillingDashboard embedded />
                        )}

                        {/* 🎯 Demo Links Management */}
                        {activeTab === 'demo' && (
                            <DemoLinkManager
                                tenantId={user?.tenantId || ''}
                                ownerId={user?.id || ''}
                                ownerName={user?.name || ''}
                            />
                        )}

                        {/* 🔐 Hidden Core Config Tab - Only for Super Admin */}
                        {activeTab === 'core-config' && coreConfigAccessGranted && (
                            <CoreConfigTemplate
                                onSave={() => success(t('admin.coreConfigSaved'))}
                            />
                        )}
                        {activeTab === 'core-config' && !coreConfigAccessGranted && (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="text-center">
                                    <Shield className="w-16 h-16 text-teal-400 mx-auto mb-4 opacity-50" />
                                    <p className="text-slate-600 dark:text-white/60">{t('admin.enterPasswordForConfigMode')}</p>
                                </div>
                            </div>
                        )}

                        {/* 📋 Subscription Requests Tab */}
                        {activeTab === 'subscription-requests' && (
                            <SubscriptionRequestsTab />
                        )}
                    </div>
                    </div>
                </main>

                {/* Modals - Rendered OUTSIDE main container */}
                {showUpdateModal && (
                    <UpdateModal
                        onClose={() => setShowUpdateModal(false)}
                        onSave={async (update) => {
                            await addSystemUpdate(update, user?.id || 'system');
                            await loadData(true); // Force refresh
                            setShowUpdateModal(false);
                            success(t('admin.updateAdded'));
                        }}
                    />
                )}

                {showBroadcastModal && (
                    <BroadcastModal
                        onClose={() => setShowBroadcastModal(false)}
                        onSave={async (message) => {
                            await addBroadcastMessage(message, user?.id || 'system');
                            await loadData(true); // Force refresh
                            setShowBroadcastModal(false);
                            success(t('admin.messageAdded'));
                        }}
                    />
                )}
            </div>

            {/* ✅ Core Config Password Modal - Theme Compatible */}
            {showCoreConfigModal && (
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'var(--theme-overlay-backdrop, rgba(0, 0, 0, 0.75))',
                        backdropFilter: 'blur(8px)',
                    }}
                    onClick={(e) => {
                        // Close only if clicking backdrop, not modal content
                        if (e.target === e.currentTarget) {
                            setShowCoreConfigModal(false);
                            setCoreConfigPassword('');
                        }
                    }}
                >

                    {/* Modal Content */}
                    <div
                        className="relative w-full max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 shadow-2xl glass-card mx-2 sm:mx-0"
                        style={{
                            background: 'var(--theme-bg-secondary)',
                            border: '2px solid var(--theme-primary-500)',
                            zIndex: 100000,
                            position: 'relative',
                            boxShadow: 'var(--theme-shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.3))',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{
                                    background: 'var(--theme-primary-500)',
                                    opacity: 0.2
                                }}
                            >
                                <Shield 
                                    className="w-6 h-6" 
                                    style={{ color: 'var(--theme-primary-400)' }}
                                />
                            </div>
                            <div className="flex-1">
                                <h3 
                                    className="text-xl font-bold"
                                    style={{ color: 'var(--theme-text-primary)' }}
                                >
                                    {t('admin.coreSetup')}
                                </h3>
                                <p 
                                    className="text-sm"
                                    style={{ color: 'var(--theme-text-secondary)' }}
                                >
                                    {t('admin.enterRequiredPassword')}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowCoreConfigModal(false);
                                    setCoreConfigPassword('');
                                }}
                                className="p-2 rounded-lg transition-colors hover:opacity-70"
                                style={{ 
                                    background: 'var(--theme-bg-tertiary)',
                                    color: 'var(--theme-text-secondary)'
                                }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="mb-6">
                            <label 
                                className="block text-sm font-medium mb-2"
                                style={{ color: 'var(--theme-text-primary)' }}
                            >
                                {t('admin.enterPassword')}
                            </label>
                            <input
                                type="password"
                                value={coreConfigPassword}
                                onChange={(e) => setCoreConfigPassword(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && coreConfigPassword.trim().toLowerCase() === 'adora') {
                                        handleCoreConfigAccess();
                                    }
                                }}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all text-center font-mono text-base sm:text-lg tracking-wider input"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                }}
                                placeholder="••••••••"
                                autoFocus
                            />
                            {coreConfigPassword && coreConfigPassword.trim().toLowerCase() !== 'adora' && (
                                <p 
                                    className="text-xs mt-2 flex items-center gap-1"
                                    style={{ color: 'var(--theme-error-500, #ef4444)' }}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    {t('admin.passwordIncorrect')}
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowCoreConfigModal(false);
                                    setCoreConfigPassword('');
                                }}
                                className="flex-1 px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 rounded-xl border font-medium transition-all text-sm sm:text-base"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    borderColor: 'var(--theme-border-primary)',
                                    color: 'var(--theme-text-primary)',
                                }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleCoreConfigAccess}
                                disabled={coreConfigPassword.trim().toLowerCase() !== 'adora'}
                                className="flex-1 px-6 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: coreConfigPassword.trim().toLowerCase() === 'adora' 
                                        ? 'var(--theme-primary-500)' 
                                        : 'var(--theme-bg-tertiary)',
                                    color: coreConfigPassword.trim().toLowerCase() === 'adora' 
                                        ? 'white' 
                                        : 'var(--theme-text-disabled)',
                                    borderColor: coreConfigPassword.trim().toLowerCase() === 'adora' 
                                        ? 'var(--theme-primary-500)' 
                                        : 'var(--theme-border-primary)',
                                    boxShadow: coreConfigPassword.trim().toLowerCase() === 'adora' 
                                        ? '0 10px 25px var(--theme-primary-500)' 
                                        : 'none',
                                    opacity: coreConfigPassword.trim().toLowerCase() === 'adora' ? 1 : 0.5,
                                }}
                            >
                                {t('admin.enter')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Add Manager Modal - Rendered OUTSIDE main container */}
            {showAddManagerModal && (
                <AddManagerModal
                    systemSettings={effectiveSettings}
                    onClose={() => setShowAddManagerModal(false)}
                    onSuccess={async () => {
                        setShowAddManagerModal(false);
                        await loadData(true); // Force refresh after adding manager
                        success(t('admin.managerAdded'));
                        // ✅ {t('admin.autoNavigateToBilling')}
                        setSearchParams({ tab: 'billing' });
                    }}
                />
            )}

            {/* ✅ Manager Details Modal - Enhanced for Light Mode + Print */}
            {showManagerDetailsModal && selectedManager && (
                <div className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/80 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white dark:bg-slate-800/90 dark:backdrop-blur-sm rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-white/10">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/20 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-transparent dark:to-transparent">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                {t('admin.managerDetails')}
                            </h3>
                            <div className="flex items-center gap-2">
                                {/* Print Button */}
                                <button
                                    onClick={() => {
                                        const printWindow = window.open('', '_blank');
                                        if (!printWindow) return;
                                        printWindow.document.write(`
                                            <!DOCTYPE html>
                                            <html dir="rtl" lang="ar">
                                            <head>
                                                <meta charset="UTF-8">
                                                <title>${t('admin.subscriptionReportTitle', { name: selectedManager.tenantName })}</title>
                                                <style>
                                                    * { font-family: 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box; }
                                                    body { padding: 40px; background: white; color: #1e293b; line-height: 1.6; }
                                                    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
                                                    .header h1 { color: #0d9488; margin: 0 0 10px 0; font-size: 28px; }
                                                    .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
                                                    .section h3 { color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin: 0 0 15px 0; }
                                                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                                                    .stat { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                                                    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
                                                    .stat-value { font-size: 18px; font-weight: bold; color: #1e293b; }
                                                    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                                                    .badge-green { background: #dcfce7; color: #166534; }
                                                    .badge-yellow { background: #fef3c7; color: #92400e; }
                                                    .badge-red { background: #fee2e2; color: #991b1b; }
                                                    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                                                    @media print { body { padding: 20px; } }
                                                </style>
                                            </head>
                                            <body>
                                                <div class="header">
                                                    <h1>${t('admin.adoraSubscriptionReport')}</h1>
                                                    <p><strong>${selectedManager.tenantName}</strong></p>
                                                    <p>${t('admin.managerCode')}: ${selectedManager.managerCode || t('admin.notSpecified')}</p>
                                                    <p>${t('admin.reportDate')}: ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                                </div>
                                                
                                                <div class="section">
                                                    <h3>${t('admin.subscriberInfo')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.hotelName')}</div>
                                                            <div class="stat-value">${selectedManager.tenantName}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.managerName')}</div>
                                                            <div class="stat-value">${selectedManager.managerName || t('admin.notSpecified')}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.managerCodeLabel')}</div>
                                                            <div class="stat-value">${selectedManager.managerCode || t('admin.notSpecified')}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.plan')}</div>
                                                            <div class="stat-value">${selectedManager.plan}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="section">
                                                    <h3>${t('admin.statistics')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalEmployees')}</div>
                                                            <div class="stat-value">${selectedManager.totalEmployees}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalBranches')}</div>
                                                            <div class="stat-value">${selectedManager.totalBranches}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalRooms')}</div>
                                                            <div class="stat-value">${selectedManager.totalRooms}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.totalRequests')}</div>
                                                            <div class="stat-value">${selectedManager.totalRequests}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="section">
                                                    <h3>${t('admin.licenseInfo')}</h3>
                                                    <div class="grid">
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.startDate')}</div>
                                                            <div class="stat-value">${toSafeDate(selectedManager.subscriptionStartDate).toLocaleDateString('ar-EG')}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.endDate')}</div>
                                                            <div class="stat-value">${toSafeDate(selectedManager.licenseExpiryDate).toLocaleDateString('ar-EG')}</div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.remainingDays')}</div>
                                                            <div class="stat-value">
                                                                <span class="badge ${selectedManager.daysUntilExpiry > 30 ? 'badge-green' : selectedManager.daysUntilExpiry > 7 ? 'badge-yellow' : 'badge-red'}">
                                                                    ${selectedManager.daysUntilExpiry} ${t('admin.days')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div class="stat">
                                                            <div class="stat-label">${t('admin.status')}</div>
                                                            <div class="stat-value">
                                                                <span class="badge ${selectedManager.status === 'active' ? 'badge-green' : selectedManager.status === 'suspended' ? 'badge-yellow' : 'badge-red'}">
                                                                    ${selectedManager.status === 'active' ? t('admin.active') : selectedManager.status === 'suspended' ? t('admin.suspended') : t('admin.expired')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="footer">
                                                    <p>{t('admin.reportGeneratedBy')}</p>
                                                    <p>© ${new Date().getFullYear()} Adora Hotel Management System</p>
                                                </div>
                                            </body>
                                            </html>
                                        `);
                                        printWindow.document.close();
                                        printWindow.print();
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors border border-teal-300 dark:border-teal-500/30"
                                    title={t('admin.printSubscriptionReport')}
                                >
                                    <Printer className="w-5 h-5" />
                                    <span className="hidden sm:inline">{t('admin.print')}</span>
                                </button>
                                {/* Close Button */}
                                <button
                                    onClick={() => {
                                        setShowManagerDetailsModal(false);
                                        setSelectedManager(null);
                                    }}
                                    className="p-2 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-600 dark:text-white" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6 bg-slate-50 dark:bg-transparent">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                    <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.hotelName')}</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedManager.tenantName}</p>
                                </div>
                                <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                    <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.managerName')}</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedManager.managerName || t('admin.notSpecified')}</p>
                                </div>
                                <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                    <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.managerCodeLabel')}</p>
                                    <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{selectedManager.managerCode || t('admin.notSpecified')}</p>
                                </div>
                                <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                    <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.plan')}</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-white capitalize">{selectedManager.plan}</p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-white/60 mb-2">{t('admin.status')}</p>
                                <div className="flex items-center gap-2">
                                    {selectedManager.status === 'active' && (
                                        <span className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-sm border border-green-300 dark:border-green-500/30 flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            {t('admin.activeStatus')}
                                        </span>
                                    )}
                                    {selectedManager.status === 'suspended' && (
                                        <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-full text-sm border border-yellow-300 dark:border-yellow-500/30 flex items-center gap-1">
                                            <Pause className="w-4 h-4" />
                                            {t('admin.suspendedStatus')}
                                        </span>
                                    )}
                                    {selectedManager.status === 'expired' && (
                                        <span className="px-3 py-1 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full text-sm border border-red-300 dark:border-red-500/30 flex items-center gap-1">
                                            <X className="w-4 h-4" />
                                            {t('admin.expiredLicense')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Statistics */}
                            <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-white/60 mb-3">{t('admin.statistics')}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 dark:bg-white/5 rounded-xl p-4 text-center border border-blue-200 dark:border-transparent">
                                        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{selectedManager.totalEmployees}</p>
                                        <p className="text-xs text-slate-500 dark:text-white/60">{t('common.employee')}</p>
                                    </div>
                                    <div className="bg-purple-50 dark:bg-white/5 rounded-xl p-4 text-center border border-purple-200 dark:border-transparent">
                                        <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{selectedManager.totalBranches}</p>
                                        <p className="text-xs text-slate-500 dark:text-white/60">{t('sidebar.branch')}</p>
                                    </div>
                                    <div className="bg-teal-50 dark:bg-white/5 rounded-xl p-4 text-center border border-teal-200 dark:border-transparent">
                                        <DoorOpen className="w-6 h-6 text-teal-600 dark:text-teal-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{selectedManager.totalRooms}</p>
                                        <p className="text-xs text-slate-500 dark:text-white/60">{t('common.room')}</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-white/5 rounded-xl p-4 text-center border border-green-200 dark:border-transparent">
                                        <Activity className="w-6 h-6 text-green-600 dark:text-green-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{selectedManager.totalRequests}</p>
                                        <p className="text-xs text-slate-500 dark:text-white/60">{t('common.request')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* License Info */}
                            <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-white/60 mb-3">{t('admin.licenseInfo')}</p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-slate-100 dark:bg-white/5 rounded-lg p-3">
                                        <span className="text-slate-700 dark:text-white/80">{t('admin.startDate')}</span>
                                        <span className="text-slate-800 dark:text-white font-medium">
                                            {toSafeDate(selectedManager.subscriptionStartDate).toLocaleDateString('ar-EG')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-100 dark:bg-white/5 rounded-lg p-3">
                                        <span className="text-slate-700 dark:text-white/80">{t('admin.endDate')}</span>
                                        <span className="text-slate-800 dark:text-white font-medium">
                                            {toSafeDate(selectedManager.licenseExpiryDate).toLocaleDateString('ar-EG')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-100 dark:bg-white/5 rounded-lg p-3">
                                        <span className="text-slate-700 dark:text-white/80">{t('admin.remainingDays')}</span>
                                        <span className={`font-bold ${selectedManager.daysUntilExpiry <= 7
                                                ? 'text-red-600 dark:text-red-400'
                                                : selectedManager.daysUntilExpiry <= 30
                                                    ? 'text-yellow-600 dark:text-yellow-400'
                                                    : 'text-green-600 dark:text-green-400'
                                            }`}>
                                            {selectedManager.daysUntilExpiry} {t('admin.days')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Last Activity - ✅ Human-readable format */}
                            <div className="bg-white dark:bg-white/5 rounded-xl p-4 border border-slate-200 dark:border-transparent shadow-sm">
                                <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.lastActivity')}</p>
                                <p className="text-slate-800 dark:text-white">
                                    {(() => {
                                        const lastDate = selectedManager.lastActivity instanceof Date
                                            ? selectedManager.lastActivity
                                            : new Date(selectedManager.lastActivity);
                                        const now = new Date();
                                        const diffMs = now.getTime() - lastDate.getTime();
                                        const diffMins = Math.floor(diffMs / (1000 * 60));
                                        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                                        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                                        if (diffMins < 1) return t('admin.now');
                                        if (diffMins < 60) return t('admin.minutesAgo', { minutes: diffMins });
                                        if (diffHours < 24) return t('admin.hoursAgo', { hours: diffHours });
                                        if (diffDays === 1) return t('admin.yesterday');
                                        if (diffDays < 7) return t('admin.daysAgo', { days: diffDays });
                                        if (diffDays < 30) return t('admin.weeksAgo', { weeks: Math.floor(diffDays / 7) });

                                        return lastDate.toLocaleDateString('ar-SA', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        });
                                    })()}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 sm:gap-3 p-3 sm:p-4 lg:p-6 border-t border-slate-200 dark:border-white/10">
                            <button
                                onClick={() => {
                                    setShowManagerDetailsModal(false);
                                    setSelectedManager(null);
                                }}
                                className="px-6 py-2 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white transition-colors"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageTransition>
    );
};

// ============================================================
// TAB COMPONENTS
// ============================================================

const OverviewTab: React.FC<{
    systemSettings: SystemSettings;
    analytics: any;
    onMaintenanceToggle: (enabled: boolean, message?: string) => void;
    allBranches?: any[]; // ✅ SaaS Integration
    mrr?: number;
    arr?: number;
    monthlyRenewalRevenue?: number;
    totalRevenue?: number; // ✅ Total revenue from all invoices
    nearestExpiring?: {
        subscription: any;
        daysUntilExpiry: number;
        branchName?: string;
        tenantName?: string;
    } | null;
    multiBranchData?: {
        totalUsers: number;
        totalRequests: number;
        totalRooms: number;
        revenue: number;
    } | null;
    managerStats?: {
        active: number;
        suspended: number;
        deleted: number;
        expired: number;
        total: number;
    };
    activityLogs?: AuditLog[]; // ✅ Activity feed (on-demand, no polling)
    onActivityRefresh?: (logs: AuditLog[]) => void; // ✅ Callback to update parent state
    demoStats?: {
        total: number;
        nearestExpiry: Date | null;
        farthestExpiry: Date | null;
    }; // ✅ Demo stats (separate from main stats)
}> = ({
    systemSettings,
    analytics,
    onMaintenanceToggle,
    allBranches = [],
    mrr = 0,
    arr = 0,
    monthlyRenewalRevenue = 0,
    totalRevenue = 0, // ✅ Default to 0 if not provided
    nearestExpiring = null,
    multiBranchData = null,
    managerStats = { active: 0, suspended: 0, deleted: 0, expired: 0, total: 0 },
    activityLogs = [],
    onActivityRefresh,
    demoStats = { total: 0, nearestExpiry: null, farthestExpiry: null }
}) => {
        const { user } = useAuth(); // ✅ Get user for DataHealthReportCard
        const { t } = useTranslation();
        const [isBranchesExpanded, setIsBranchesExpanded] = useState(false); // ✅ Collapsed by default, show 5 only
        const [isActivityExpanded, setIsActivityExpanded] = useState(false); // ✅ Activity feed collapsed by default (saves space)
        const [isStatsExpanded, setIsStatsExpanded] = useState(false); // ✅ Stats cards collapsed by default (saves space)
        const [refreshingActivity, setRefreshingActivity] = useState(false);
        const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

        // Manual refresh handler - ONLY way to fetch new data
        const handleRefreshActivity = async () => {
            setRefreshingActivity(true);
            try {
                const logs = await forceRefreshActivity();
                onActivityRefresh?.(logs);
                setLastRefreshTime(new Date());
            } catch (error) {
                console.error('Failed to refresh activity:', error);
            }
            setRefreshingActivity(false);
        };
        return (
            <div className="space-y-4 sm:space-y-6">
                {/* ✅ Export Buttons - Compact Design */}
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={() => {
                            if (!analytics || Object.keys(analytics).length === 0) {
                                alert(t('common.noData'));
                                return;
                            }
                            try {
                                // ✅ Prepare comprehensive export data
                                const exportData = {
                                    ...analytics,
                                    totalTenants: analytics.totalTenants || 0,
                                    activeTenants: analytics.activeTenants || 0,
                                    totalUsers: analytics.totalUsers || 0,
                                    totalBranches: analytics.totalBranches || 0,
                                    totalRooms: analytics.totalRooms || 0,
                                    totalRequests: analytics.totalRequests || 0,
                                    exportDate: new Date().toISOString()
                                };
                                exportToPDF(exportData, 'adora-dashboard-report.pdf');
                            } catch (err) {
                                console.error('PDF export failed:', err);
                                alert(t('admin.exportPdfFailed'));
                            }
                        }}
                        disabled={!analytics}
                        className={`px-2 py-1.5 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs ${!analytics ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={analytics ? t('admin.exportPdf') : t('admin.waitForData')}
                    >
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">PDF</span>
                    </button>
                    <button
                        onClick={() => {
                            if (!analytics || Object.keys(analytics).length === 0) {
                                alert(t('common.noData'));
                                return;
                            }
                            try {
                                // ✅ Prepare comprehensive export data
                                const exportData = {
                                    ...analytics,
                                    totalTenants: analytics.totalTenants || 0,
                                    activeTenants: analytics.activeTenants || 0,
                                    totalUsers: analytics.totalUsers || 0,
                                    totalBranches: analytics.totalBranches || 0,
                                    totalRooms: analytics.totalRooms || 0,
                                    totalRequests: analytics.totalRequests || 0,
                                    exportDate: new Date().toISOString()
                                };
                                exportToExcel(exportData, 'adora-dashboard-report.xlsx');
                            } catch (err) {
                                console.error('Excel export failed:', err);
                                alert(t('admin.exportExcelFailed'));
                            }
                        }}
                        disabled={!analytics}
                        className={`px-2 py-1.5 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs ${!analytics ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={analytics ? t('admin.exportExcel') : t('admin.waitForData')}
                    >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Excel</span>
                    </button>
                </div>

                {/* Critical Alerts - Mobile First */}
                {systemSettings.maintenanceMode && (
                    <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-yellow-500/30 bg-yellow-500/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-0">{t('admin.maintenanceModeEnabled')}</h3>
                                    <p className="text-sm sm:text-base text-white/60 leading-relaxed">{systemSettings.maintenanceMessage}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => onMaintenanceToggle(false)}
                                className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-lg sm:rounded-xl hover:bg-green-500/30 transition-colors border border-green-500/20 text-sm whitespace-nowrap"
                            >
                                {t('admin.cancelMaintenance')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Quick Stats - ✅ ADORA PREMIUM COMPACT DESIGN - Collapsible & Fully Responsive */}
                <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                    {/* Header - Clickable */}
                    <div
                        onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                        className="flex items-center justify-between p-2.5 sm:p-3 lg:p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/10 flex-shrink-0">
                                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-sm sm:text-base font-bold text-white mb-0.5 sm:mb-1">الإحصائيات السريعة</h3>
                                <p className="text-xs sm:text-sm text-white/50 hidden sm:block">
                                    إجمالي الفروع، المستخدمين، الطلبات، والغرف
                                </p>
                            </div>
                        </div>
                        <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isStatsExpanded ? '' : 'rotate-180'}`}>
                            <ChevronDown className="w-4 h-4 text-white/60" />
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isStatsExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                        <div className="p-3 sm:p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4" data-tour="owner-overview-stats">
                                <StatCard
                                    icon={Building2}
                                    iconColor="teal"
                                    label={t('admin.totalBranches')}
                                    count={allBranches.length}
                                />
                                <StatCard
                                    icon={Users}
                                    iconColor="blue"
                                    label={t('admin.totalUsers')}
                                    count={multiBranchData?.totalUsers || analytics?.totalUsers || 0}
                                />
                                <StatCard
                                    icon={Activity}
                                    iconColor="orange"
                                    label={t('admin.totalRequests')}
                                    count={multiBranchData?.totalRequests || analytics?.totalRequestsToday || 0}
                                />
                                <StatCard
                                    icon={DoorOpen}
                                    iconColor="green"
                                    label={t('admin.totalRooms')}
                                    count={multiBranchData?.totalRooms || 0}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ✅ Demo Stats Card - Separate from main stats */}
                {demoStats.total > 0 && (
                    <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-purple-500/30 bg-purple-500/10">
                        <div className="flex items-start gap-2 sm:gap-3 lg:gap-4">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                                    {t('admin.demoAccounts')}
                                </h3>
                                <p className="text-xl sm:text-2xl font-bold text-purple-400 mb-2">
                                    {demoStats.total} {t('admin.account')}
                                </p>
                                <div className="space-y-1 text-xs sm:text-sm text-white/60">
                                    {demoStats.nearestExpiry && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span>{t('admin.nearestExpiry')}: {demoStats.nearestExpiry.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                    {demoStats.farthestExpiry && demoStats.farthestExpiry.getTime() !== demoStats.nearestExpiry?.getTime() && (
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                            <span>{t('admin.farthestExpiry')}: {demoStats.farthestExpiry.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ Manager Status Cards - Unified Design & Fully Responsive with Enhanced Shadows */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                    <div 
                        className="solid-modal rounded-xl p-4 border border-green-500/30 bg-green-500/10 hover:border-green-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(34, 197, 94, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-green-400 truncate">{managerStats.active}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.activeLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-yellow-500/30 bg-yellow-500/10 hover:border-yellow-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(234, 179, 8, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                                <Pause className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-yellow-400 truncate">{managerStats.suspended}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.suspendedLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-red-500/30 bg-red-500/10 hover:border-red-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(239, 68, 68, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                <X className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-red-400 truncate">{managerStats.expired}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.expiredLicense')}</p>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="solid-modal rounded-xl p-4 border border-gray-500/30 bg-gray-500/10 hover:border-gray-500/50 transition-all"
                        style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 8px 16px rgba(107, 114, 128, 0.2), 0 4px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.12)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-500/20 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-5 h-5 text-gray-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xl font-bold text-gray-400 truncate">{managerStats.deleted}</p>
                                <p className="text-xs text-white/60 truncate">{t('admin.deletedLicense')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Revenue Cards - ✅ COMPACT PREMIUM DESIGN - Fully Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                    <StatCard
                        icon={DollarSign}
                        iconColor="purple"
                        label={t('admin.totalRevenue')}
                        value={`${(totalRevenue || 0).toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={TrendingUp}
                        iconColor="green"
                        label={t('admin.monthlyRecurringRevenue')}
                        value={`${mrr.toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={DollarSign}
                        iconColor="blue"
                        label={t('admin.annualRecurringRevenue')}
                        value={`${arr.toLocaleString()} ${t('common.rs')}`}
                    />
                    <StatCard
                        icon={Calendar}
                        iconColor="yellow"
                        label={t('admin.monthlyRenewals')}
                        value={`${monthlyRenewalRevenue.toLocaleString()} ${t('common.rs')}`}
                    />
                </div>

                {/* Expiring Subscription Alert - Mobile First */}
                {nearestExpiring && (
                    <div className="stat-card-pro-compact glass rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 border border-yellow-500/30 bg-yellow-500/10">
                        <div className="flex items-start gap-2 sm:gap-3">
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] sm:text-xs text-white/60 mb-1">{t('admin.nearestSubscriptionExpiring')}</div>
                                <div className="text-xs sm:text-sm font-bold text-white mb-1 truncate">
                                    {nearestExpiring.branchName || nearestExpiring.tenantName || t('admin.branch')}
                                </div>
                                <div className="text-[10px] sm:text-xs text-yellow-400">
                                    {t('admin.daysRemainingFor', { days: nearestExpiring.daysUntilExpiry })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* System Status - Mobile First */}
                <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold mb-2 sm:mb-3 lg:mb-4" style={{ color: 'var(--theme-text-primary)' }}>{t('admin.systemStatus')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                        <StatusItem
                            label={t('admin.version')}
                            value={systemSettings.systemVersion}
                            icon={Zap}
                            color="blue"
                        />
                        <StatusItem
                            label={t('admin.performanceRate')}
                            value={`${analytics?.uptime || 99.9}%`}
                            icon={CheckCircle}
                            color="green"
                        />
                        <StatusItem
                            label={t('admin.errorRate')}
                            value={`${analytics?.errorRate || 0}%`}
                            icon={AlertTriangle}
                            color={analytics?.errorRate > 1 ? 'red' : 'yellow'}
                        />
                    </div>
                </div>

                {/* Branches Summary - Compact from MultiBranchDashboard - Collapsible - Mobile First */}
                {allBranches.length > 0 && (
                    <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                        {/* Header - Clickable */}
                        <div
                            onClick={() => setIsBranchesExpanded(!isBranchesExpanded)}
                            className="flex items-center justify-between p-3 sm:p-4 lg:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/10 flex-shrink-0">
                                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">جميع الفروع ({allBranches.length})</h3>
                                    <p className="text-xs sm:text-sm text-white/50 hidden sm:block">
                                        عرض جميع فروع جميع المشتركين في النظام
                                    </p>
                                </div>
                            </div>
                            <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isBranchesExpanded ? '' : 'rotate-180'}`}>
                                <ChevronDown className="w-4 h-4 text-white/60" />
                            </div>
                        </div>

                        {/* Collapsible Content */}
                        <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isBranchesExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                            <div className="p-3 sm:p-4 lg:p-6">
                                <div className="space-y-2">
                                    {allBranches.slice(0, isBranchesExpanded ? allBranches.length : 5).map((branch: any) => (
                                        <div
                                            key={branch.id || `${branch.tenantId}_${branch.id}`}
                                            className="bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-all border border-white/5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Building2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-white text-sm truncate">{branch.name || branch.id}</h4>
                                                        {branch.managerName && (
                                                            <p className="text-xs text-white/50 truncate">
                                                                {t('admin.manager')}: {branch.managerName}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {!isBranchesExpanded && allBranches.length > 5 && (
                                    <div className="text-center pt-4 mt-4 border-t border-white/5">
                                        <p className="text-xs text-white/40">
                                            {t('admin.andMoreBranches', { count: allBranches.length - 5 })}
                                        </p>
                                    </div>
                                )}
                                {isBranchesExpanded && allBranches.length > 5 && (
                                    <div className="text-center pt-4 mt-4 border-t border-white/5">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsBranchesExpanded(false);
                                            }}
                                            className="text-xs text-white/60 hover:text-white transition-colors"
                                        >
                                            {t('admin.hide')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ✅ Data Health Report - Weekly System Health */}
                <DataHealthReportCard
                    tenantId={user?.role === 'owner' ? (user?.tenantId || 'system-owner' || 'owner') : (user?.id || '')}
                    onViewDetails={(report) => {
                        console.log('View report details:', report.id);
                        // Could open a detailed modal here
                    }}
                />

                {/* ✅ Live Activity Feed - Ultra-efficient polling (1 read/min max) */}
                <div className="solid-modal rounded-xl sm:rounded-2xl overflow-hidden">
                    {/* Header - Clickable */}
                    <div
                        onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base sm:text-xl font-bold mb-0.5 sm:mb-1" style={{ color: 'var(--theme-text-primary)' }}>
                                    {t('admin.liveActivityFeed')}
                                </h3>
                                <p className="text-xs sm:text-sm hidden sm:block" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {t('admin.logAllEvents')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Manual Refresh Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRefreshActivity();
                                }}
                                disabled={refreshingActivity}
                                className="p-2 rounded-lg transition-colors"
                                style={{
                                    background: 'var(--theme-bg-tertiary)',
                                    border: '1px solid var(--theme-border-primary)',
                                }}
                                title={t('admin.manualRefresh')}
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshingActivity ? 'animate-spin' : ''}`} style={{ color: 'var(--theme-text-secondary)' }} />
                            </button>
                            <div className={`p-2 rounded-lg transition-transform duration-300 flex-shrink-0 ${isActivityExpanded ? '' : 'rotate-180'}`}
                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                <ChevronDown className="w-4 h-4" style={{ color: 'var(--theme-text-secondary)' }} />
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    <div className={`transition-all duration-300 ease-in-out border-t ${isActivityExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
                        style={{ borderColor: 'var(--theme-border-primary)', background: 'var(--theme-bg-tertiary)' }}>
                        <div className="p-3 sm:p-4 lg:p-6">
                            {(!activityLogs || activityLogs.length === 0) ? (
                                <div className="text-center py-8">
                                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--theme-text-primary)' }} />
                                    <p style={{ color: 'var(--theme-text-secondary)' }}>لا يوجد نشاط حديث</p>
                                    <p className="text-xs mt-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        سيظهر هنا كل ما يحدث في النظام
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                    {(activityLogs || []).map((log, index) => (
                                        <div
                                            key={log.id || index}
                                            className="flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                                            style={{
                                                background: 'var(--theme-bg-secondary)',
                                                border: '1px solid var(--theme-border-primary)',
                                            }}
                                        >
                                            {/* Icon */}
                                            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                                                style={{ background: 'var(--theme-bg-tertiary)' }}>
                                                {getActionIcon(log.action)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-medium text-sm ${getActionColor(log.action)}`}>
                                                        {getActionLabel(log.action)}
                                                    </span>
                                                    {log.targetName && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full"
                                                            style={{
                                                                background: 'var(--theme-bg-tertiary)',
                                                                color: 'var(--theme-text-secondary)',
                                                            }}>
                                                            {log.targetName}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                                                        👤 {log.userName || t('admin.system')}
                                                    </span>
                                                    {log.department && log.department !== 'system' && (
                                                        <span className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                            • {log.department}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Details if available */}
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <div className="mt-1 text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                        {log.details.message && <span>{String(log.details.message)}</span>}
                                                        {log.details.oldValue !== undefined && log.details.newValue !== undefined && (
                                                            <span>
                                                                {String(log.details.oldValue)} → {String(log.details.newValue)}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Time */}
                                            <div className="flex-shrink-0 text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                                {formatTimeAgo(log.timestamp)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Footer info - Shows on-demand status */}
                            <div className="mt-4 pt-3 border-t flex items-center justify-between flex-wrap gap-2"
                                style={{ borderColor: 'var(--theme-border-primary)' }}>
                                <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    {t('admin.powerSavingMode')}
                                </p>
                                <div className="flex items-center gap-3">
                                    {lastRefreshTime && (
                                        <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                            {t('admin.lastUpdate')}: {formatTimeAgo(lastRefreshTime)}
                                        </p>
                                    )}
                                    <p className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                        {activityLogs?.length || 0} {t('admin.logs')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

type FilterType = 'all' | 'active' | 'suspended' | 'expired' | 'deleted' | 'expiring';

const TenantsTab: React.FC<{
    tenants: TenantAnalytics[];
    onRefresh: () => void;
    onAddManager: () => void;
    onViewDetails?: (tenant: TenantAnalytics) => void;
}> = ({ tenants, onRefresh, onAddManager, onViewDetails }) => {
    const [searchCode, setSearchCode] = useState('');
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [selectedTenant, setSelectedTenant] = useState<TenantAnalytics | null>(null);
    const [managerDetails, setManagerDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [deletedManagers, setDeletedManagers] = useState<any[]>([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const { success, error } = useUX();
    const { t } = useTranslation();
    const { user } = useAuth();

    // Load deleted managers on mount
    useEffect(() => {
        const loadDeleted = async () => {
            const deleted = await getDeletedManagers();
            setDeletedManagers(deleted);
        };
        loadDeleted();
    }, []);

    // ✅ Helper function to map deleted manager to TenantAnalytics format
    // Used in BOTH "deleted" and "all" filters to avoid code duplication
    const mapDeletedManagerToTenant = useCallback((manager: any): TenantAnalytics & { isDeleted: true } => {
        // Get license expiry date from various possible fields
        let licenseExpiryDate: Date;
        if (manager.licenseExpiry?.toDate) {
            licenseExpiryDate = manager.licenseExpiry.toDate();
        } else if (manager.licenseExpiry) {
            licenseExpiryDate = new Date(manager.licenseExpiry);
        } else if (manager.tenantBackup?.info?.licenseExpiry?.toDate) {
            licenseExpiryDate = manager.tenantBackup.info.licenseExpiry.toDate();
        } else if (manager.tenantBackup?.info?.licenseExpiry) {
            licenseExpiryDate = new Date(manager.tenantBackup.info.licenseExpiry);
        } else {
            licenseExpiryDate = new Date();
        }

        // Calculate days until expiry
        const now = new Date();
        const daysUntilExpiry = Math.ceil((licenseExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            tenantId: manager.tenantId || manager.id,
            tenantName: manager.hotelName || manager.tenantBackup?.info?.name || manager.name || t('admin.notSpecified'),
            managerName: manager.name,
            managerCode: manager.code,
            plan: (manager.plan || manager.tenantBackup?.info?.plan || 'basic') as 'basic' | 'pro' | 'enterprise',
            status: 'deleted' as const,
            isDeleted: true as const,
            totalEmployees: manager.cachedStats?.totalUsers || manager.tenantBackup?.info?.cachedStats?.totalUsers || 0,
            totalBranches: manager.maxBranches || manager.tenantBackup?.info?.maxBranches || 1,
            totalRooms: manager.cachedStats?.totalRooms || manager.tenantBackup?.info?.cachedStats?.totalRooms || 0,
            totalRequests: manager.cachedStats?.totalRequests || 0,
            totalRequestsToday: 0,
            lastActivity: manager.deletedAt || new Date(),
            activeEmployees: 0,
            activeSessions: 0,
            featuresUsed: {
                qrCode: 0,
                pointsSystem: 0,
                gamification: 0,
                scheduledTasks: 0
            },
            subscriptionStartDate: manager.createdAt?.toDate?.() || new Date(),
            licenseExpiryDate,
            daysUntilExpiry,
            paymentStatus: 'pending' as const,
            employeesGrowth: 0,
            requestsGrowth: 0
        };
    }, []);

    // Filter tenants by status, search, and expiry
    const filteredTenants = useMemo(() => {
        // ✅ FIX: Filter out deleted tenants from the main list to avoid duplicates
        // When we merge deleted managers later, we don't want them appearing twice
        let filtered = tenants
            .filter(t => t.status !== 'deleted')
            .map(t => ({ ...t })); // Create copies to avoid mutation

        // Apply status filter
        if (activeFilter === 'active') {
            filtered = filtered.filter(t => t.status === 'active');
        } else if (activeFilter === 'suspended') {
            filtered = filtered.filter(t => t.status === 'suspended');
        } else if (activeFilter === 'expired') {
            filtered = filtered.filter(t => {
                try {
                    // Use daysUntilExpiry if available (more reliable)
                    if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                        return t.daysUntilExpiry <= 0 || t.status === 'expired';
                    }

                    // Otherwise calculate from licenseExpiryDate
                    let expiry: Date;
                    if (t.licenseExpiryDate instanceof Date) {
                        expiry = t.licenseExpiryDate;
                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                        expiry = (t.licenseExpiryDate as any).toDate();
                    } else if (typeof t.licenseExpiryDate === 'string') {
                        expiry = new Date(t.licenseExpiryDate);
                    } else {
                        expiry = new Date(t.licenseExpiryDate);
                    }

                    // Check if date is valid
                    if (isNaN(expiry.getTime())) {
                        console.warn('Invalid expiry date for tenant:', t.tenantId, t.licenseExpiryDate);
                        return t.status === 'expired';
                    }

                    const now = new Date();
                    now.setHours(0, 0, 0, 0);
                    expiry.setHours(0, 0, 0, 0);
                    return expiry < now || t.status === 'expired';
                } catch (error) {
                    console.warn('Error filtering expired tenant:', t.tenantId, error);
                    return t.status === 'expired';
                }
            });
        } else if (activeFilter === 'expiring') {
            // Show ALL tenants sorted by expiry date (closest first)
            // ✅ FIX: {t('admin.excludeDeletedFromExpiring')}
            const deletedIds = new Set(deletedManagers.map((m: any) => m.tenantId || m.id));
            filtered = filtered.filter(t => {
                // ✅ {t('admin.excludeDeleted')}
                if ((t as any).isDeleted || deletedIds.has(t.tenantId)) {
                    return false;
                }
                // Only filter out invalid dates
                try {
                    if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                        return true; // Has valid daysUntilExpiry
                    }
                    let expiry: Date;
                    if (t.licenseExpiryDate instanceof Date) {
                        expiry = t.licenseExpiryDate;
                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                        expiry = (t.licenseExpiryDate as any).toDate();
                    } else if (typeof t.licenseExpiryDate === 'string') {
                        expiry = new Date(t.licenseExpiryDate);
                    } else {
                        expiry = new Date(t.licenseExpiryDate);
                    }
                    return !isNaN(expiry.getTime()); // Only filter invalid dates
                } catch {
                    return false; // Filter out errors
                }
            });

            // Sort by days until expiry (ascending - closest first)
            filtered.sort((a, b) => {
                // Helper function to get days until expiry
                const getDaysUntil = (tenant: TenantAnalytics): number => {
                    if (tenant.daysUntilExpiry !== undefined && tenant.daysUntilExpiry !== null) {
                        return tenant.daysUntilExpiry;
                    }
                    try {
                        let expiry: Date;
                        if (tenant.licenseExpiryDate instanceof Date) {
                            expiry = tenant.licenseExpiryDate;
                        } else if (tenant.licenseExpiryDate && typeof tenant.licenseExpiryDate === 'object' && 'toDate' in tenant.licenseExpiryDate) {
                            expiry = (tenant.licenseExpiryDate as any).toDate();
                        } else if (typeof tenant.licenseExpiryDate === 'string') {
                            expiry = new Date(tenant.licenseExpiryDate);
                        } else {
                            expiry = new Date(tenant.licenseExpiryDate);
                        }
                        if (isNaN(expiry.getTime())) return 999999; // Put invalid dates at the end
                        const now = new Date();
                        return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    } catch {
                        return 999999; // Put errors at the end
                    }
                };
                return getDaysUntil(a) - getDaysUntil(b);
            });
        } else if (activeFilter === 'deleted') {
            // ✅ REFACTORED: Use helper function to avoid code duplication
            return deletedManagers.map(mapDeletedManagerToTenant);
        }

        // ✅ REFACTORED: For "all" filter, include deleted managers with special marking
        // Uses the same helper function to ensure consistent data
        if (activeFilter === 'all' && deletedManagers.length > 0) {
            const existingTenantIds = new Set(filtered.map(t => t.tenantId));
            const deletedMapped = deletedManagers
                .filter(manager => !existingTenantIds.has(manager.tenantId || manager.id)) // ✅ Avoid duplicates
                .map(mapDeletedManagerToTenant); // ✅ Use same helper function
            filtered = [...filtered, ...deletedMapped];
        }

        // Apply search filter (by name or code)
        if (searchCode) {
            filtered = filtered.filter(tenant =>
                tenant.tenantId?.includes(searchCode) ||
                tenant.tenantName?.toLowerCase().includes(searchCode.toLowerCase()) ||
                tenant.managerName?.toLowerCase().includes(searchCode.toLowerCase())
            );
        }

        return filtered;
    }, [tenants, activeFilter, searchCode, deletedManagers, mapDeletedManagerToTenant]);

    // Load manager details with branches
    const loadManagerDetails = async (tenant: TenantAnalytics) => {
        setLoadingDetails(true);
        try {
            // Get manager user data
            const managers = await getAllManagers();
            const manager = managers.find(m => m.tenantId === tenant.tenantId);

            if (!manager) {
                error(t('admin.managerNotFound'));
                return;
            }

            // Get all branches for this tenant
            if (!db) {
                throw new Error('Database not initialized');
            }
            const branchesQuery = query(
                collection(db, `tenants/${tenant.tenantId}/branches`)
            );
            const branchesSnapshot = await getDocs(branchesQuery);
            const branches = branchesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Load details for each branch
            const branchesWithDetails = await Promise.all(
                branches.map(async (branch: any) => {
                    // Get employees count
                    const employeesQuery = query(
                        collection(db, 'users'),
                        where('tenantId', '==', tenant.tenantId),
                        where('branches', 'array-contains', branch.id)
                    );
                    const employeesCount = await getCountFromServer(employeesQuery);

                    // Get requests by department
                    const requestsQuery = query(
                        collection(db, 'requests'),
                        where('tenantId', '==', tenant.tenantId),
                        where('branch', '==', branch.id)
                    );
                    const requestsSnapshot = await getDocs(requestsQuery);
                    const requests = requestsSnapshot.docs.map(d => d.data());

                    // Count requests by department
                    const departmentCounts: Record<string, number> = {};
                    requests.forEach(req => {
                        const dept = req.department || t('admin.notSpecified');
                        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
                    });
                    const topDepartment = Object.entries(departmentCounts)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] || t('admin.noData');

                    // Get enabled features from branch settings
                    const settingsRef = doc(db, `tenants/${tenant.tenantId}/branches/${branch.id}/settings`, 'branch');
                    const settingsSnap = await getDoc(settingsRef);
                    const branchSettings = settingsSnap.exists() ? settingsSnap.data() : {};

                    // Get system settings for enabled features
                    const systemSettings = await getSystemSettings();
                    const enabledFeatures = Object.entries(systemSettings.features)
                        .filter(([_, enabled]) => enabled)
                        .map(([key, _]) => key);

                    return {
                        ...branch,
                        employeesCount: employeesCount.data().count,
                        totalRequests: requests.length,
                        topDepartment,
                        departmentCounts,
                        enabledFeatures,
                        createdAt: branch.createdAt || (manager as any).createdAt || Timestamp.now()
                    };
                })
            );

            setManagerDetails({
                manager,
                branches: branchesWithDetails,
                createdAt: (manager as any).createdAt || Timestamp.now()
            });
            setSelectedTenant(tenant);
        } catch (err: any) {
            console.error('Error loading manager details:', err);
            error(t('admin.errorLoadingManager'));
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <>
            {/* 📍 Contextual Help for Owner */}
            <CreateManagerHelp />

            <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{t('admin.tenantList')}</h3>
                    <button
                        onClick={onAddManager}
                        className="group relative w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 text-sm sm:text-base font-semibold overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.95) 0%, rgba(14, 165, 233, 0.95) 100%)',
                            border: '2px solid rgba(20, 184, 166, 0.4)',
                            color: '#ffffff',
                            boxShadow: '0 4px 16px rgba(20, 184, 166, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20, 184, 166, 1) 0%, rgba(14, 165, 233, 1) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.6)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(20, 184, 166, 0.4), 0 4px 12px rgba(0, 0, 0, 0.2)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(20, 184, 166, 0.95) 0%, rgba(14, 165, 233, 0.95) 100%)';
                            e.currentTarget.style.borderColor = 'rgba(20, 184, 166, 0.4)';
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(20, 184, 166, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        {/* Shine effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                        <Plus className="w-5 h-5 sm:w-5 sm:h-5 flex-shrink-0 relative z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))' }} />
                        <span className="relative z-10">{t('admin.addNewManager')}</span>
                    </button>
                </div>

                {/* Filters - Mobile First */}
                <div className="mb-4 space-y-3">
                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                        {[
                            { id: 'all' as FilterType, label: t('common.all'), icon: Activity },
                            { id: 'active' as FilterType, label: t('admin.active'), icon: CheckCircle },
                            { id: 'suspended' as FilterType, label: t('admin.suspended'), icon: Pause },
                            { id: 'expired' as FilterType, label: t('admin.expired'), icon: AlertTriangle },
                            { id: 'expiring' as FilterType, label: t('admin.nearingExpiry'), icon: Clock },
                            { id: 'deleted' as FilterType, label: t('admin.deleted'), icon: Trash2 }
                        ].map(filter => {
                            const Icon = filter.icon;
                            const isActive = activeFilter === filter.id;
                            // ✅ FIX: {t('admin.deletedIdsList')}
                            const deletedTenantIds = new Set(deletedManagers.map((m: any) => m.tenantId || m.id));
                            const count = filter.id === 'all'
                                ? tenants.length
                                : filter.id === 'deleted'
                                    ? deletedManagers.length
                                    : filter.id === 'expiring'
                                        ? tenants.filter(t =>
                                            t.status !== 'deleted' &&
                                            !(t as any).isDeleted &&
                                            !deletedTenantIds.has(t.tenantId)
                                        ).length // ✅ FIX: استثناء المحذوفين بكل الطرق
                                        : tenants.filter(t => {
                                            if (filter.id === 'active') return t.status === 'active';
                                            if (filter.id === 'suspended') return t.status === 'suspended';
                                            if (filter.id === 'expired') {
                                                // Use daysUntilExpiry if available
                                                if (t.daysUntilExpiry !== undefined && t.daysUntilExpiry !== null) {
                                                    return t.daysUntilExpiry <= 0 || t.status === 'expired';
                                                }
                                                // Otherwise calculate
                                                try {
                                                    let expiry: Date;
                                                    if (t.licenseExpiryDate instanceof Date) {
                                                        expiry = t.licenseExpiryDate;
                                                    } else if (t.licenseExpiryDate && typeof t.licenseExpiryDate === 'object' && 'toDate' in t.licenseExpiryDate) {
                                                        expiry = (t.licenseExpiryDate as any).toDate();
                                                    } else if (typeof t.licenseExpiryDate === 'string') {
                                                        expiry = new Date(t.licenseExpiryDate);
                                                    } else {
                                                        expiry = new Date(t.licenseExpiryDate);
                                                    }
                                                    if (isNaN(expiry.getTime())) return t.status === 'expired';
                                                    const now = new Date();
                                                    now.setHours(0, 0, 0, 0);
                                                    expiry.setHours(0, 0, 0, 0);
                                                    return expiry < now || t.status === 'expired';
                                                } catch {
                                                    return t.status === 'expired';
                                                }
                                            }
                                            return false;
                                        }).length;

                            return (
                                <button
                                    key={filter.id}
                                    onClick={() => setActiveFilter(filter.id)}
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm flex-shrink-0"
                                    style={isActive
                                        ? {
                                            background: 'rgba(20, 184, 166, 0.2)',
                                            color: 'rgba(20, 184, 166, 1)',
                                            border: '1px solid rgba(20, 184, 166, 0.4)',
                                            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.15)',
                                        }
                                        : {
                                            background: 'rgba(30, 41, 59, 0.6)',
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                        }}
                                    onMouseEnter={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isActive) {
                                            e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        }
                                    }}
                                >
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span>{filter.label}</span>
                                    {count > 0 && (
                                        <span 
                                            className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                                            style={isActive
                                                ? {
                                                    background: 'rgba(20, 184, 166, 0.3)',
                                                    color: 'rgba(20, 184, 166, 1)',
                                                }
                                                : {
                                                    background: 'rgba(255, 255, 255, 0.1)',
                                                    color: 'rgba(255, 255, 255, 0.8)',
                                                }}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search by Name/Code - Mobile First */}
                    <div className="relative">
                        <Search 
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5" 
                            style={{ color: 'rgba(255, 255, 255, 0.5)' }}
                        />
                        <input
                            type="text"
                            placeholder={t('admin.searchByNameOrCode')}
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base shadow-sm transition-all"
                            style={{
                                background: 'rgba(30, 41, 59, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255, 255, 255, 0.95)',
                                placeholder: 'rgba(255, 255, 255, 0.4)',
                            }}
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(32, 178, 170, 0.5)';
                                e.currentTarget.style.background = 'rgba(30, 41, 59, 1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)';
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-2 sm:space-y-3">
                    {filteredTenants.length === 0 ? (
                        <p className="text-center text-slate-500 dark:text-white/40 py-6 sm:py-8 text-sm sm:text-base">
                            {searchCode || activeFilter !== 'all'
                                ? t('admin.noResults')
                                : t('admin.noTenants')}
                        </p>
                    ) : (
                        filteredTenants.map((tenant: TenantAnalytics & { isDeleted?: boolean }) => {
                            // ✅ Check if this is a deleted manager
                            const isDeletedManager = (tenant as any).isDeleted === true ||
                                tenant.status === 'deleted' ||
                                activeFilter === 'deleted';

                            const statusLabel =
                                isDeletedManager
                                    ? t('admin.deletedLicense')
                                    : tenant.status === 'active'
                                        ? t('admin.activeStatus')
                                        : tenant.status === 'suspended'
                                            ? t('admin.suspendedStatus')
                                            : t('admin.expiredStatus');

                            const statusClasses =
                                isDeletedManager
                                    ? 'bg-gray-200 dark:bg-gray-500/20 text-gray-600 dark:text-gray-300 border-gray-400 dark:border-gray-500/50'
                                    : tenant.status === 'active'
                                        ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-500'
                                        : tenant.status === 'suspended'
                                            ? 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500'
                                            : 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-500';

                            // ✅ Special card styling for deleted managers
                            const cardClasses = isDeletedManager
                                ? 'bg-gradient-to-r from-red-100 via-gray-100 to-red-100 dark:from-red-950/30 dark:via-gray-900/40 dark:to-red-950/30 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all border-2 border-dashed border-red-400 dark:border-red-500/40 relative overflow-hidden opacity-80 hover:opacity-100'
                                : 'bg-white dark:bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 hover:bg-white dark:hover:bg-white/10 transition-all duration-300 border border-slate-200/80 dark:border-transparent shadow-[0_8px_30px_rgba(0,0,0,0.15),0_4px_10px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_50px_rgba(0,0,0,0.2),0_8px_20px_rgba(0,0,0,0.15)] hover:border-teal-400 dark:hover:border-teal-500/30 hover:-translate-y-1';

                            return (
                                <div
                                    key={tenant.tenantId}
                                    className={cardClasses}
                                >
                                    {/* ✅ Deleted indicator stripe */}
                                    {isDeletedManager && (
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-400" />
                                    )}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-1">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                                                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate w-full sm:w-auto">
                                                    {tenant.tenantName}
                                                </h4>
                                                {tenant.managerName && (
                                                    <span className="text-xs text-slate-600 dark:text-white/70 bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/15 rounded-full px-2 py-0.5 truncate self-start sm:self-auto flex items-center gap-1.5">
                                                        <span>المدير: {tenant.managerName}</span>
                                                        {tenant.managerCode && (
                                                            <span className="text-slate-500 dark:text-white/50 font-mono">({tenant.managerCode})</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap text-xs sm:text-sm text-slate-600 dark:text-white/60">
                                                <span className="flex flex-wrap gap-1.5">
                                                    <span>{tenant.totalBranches} فروع</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span>{tenant.totalEmployees} موظف</span>
                                                    <span className="hidden sm:inline">•</span>
                                                    <span>{tenant.plan}</span>
                                                </span>
                                                <span
                                                    className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border ${statusClasses} self-start sm:self-auto flex items-center gap-1`}
                                                >
                                                    {isDeletedManager && <Trash2 className="w-3 h-3" />}
                                                    {statusLabel}
                                                </span>
                                            </div>
                                            {/* ✅ Branches with codes */}
                                            {(() => {
                                                // Use branches if available, otherwise fallback to branchCodes
                                                const branchList = tenant.branches && tenant.branches.length > 0
                                                    ? tenant.branches
                                                    : ((tenant as any).branchCodes || []).map((code: string) => ({
                                                        id: `branch-${code}`,
                                                        name: `فرع ${code}`,
                                                        code: code
                                                    }));
                                                return branchList.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {branchList.map((branch: any) => (
                                                            <span
                                                                key={branch.id}
                                                                className="text-[10px] bg-teal-100 dark:bg-primary-500/15 text-teal-700 dark:text-primary-300 border border-teal-400 dark:border-primary-500/30 rounded-lg px-2 py-0.5 flex items-center gap-1"
                                                            >
                                                                <Building2 className="w-3 h-3" />
                                                                <span>{branch.name}</span>
                                                                <span className="text-teal-600 dark:text-primary-400/70 font-mono">({branch.code})</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null;
                                            })()}
                                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-white/40 mt-1 leading-relaxed">
                                                انتهاء الترخيص:{' '}
                                                <span className="block sm:inline">
                                                    {new Date(tenant.licenseExpiryDate).toLocaleDateString('ar-SA-u-ca-islamic', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                    {' - '}
                                                    {new Date(tenant.licenseExpiryDate).toLocaleDateString('ar-EG', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}م
                                                </span>
                                                <span className="hidden sm:inline"> • </span>
                                                <span className="block sm:inline">
                                                    ({tenant.daysUntilExpiry} يوم)
                                                </span>
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                                            {isDeletedManager ? (
                                                // Restore button for deleted managers (in any filter)
                                                <button
                                                    onClick={async () => {
                                                        const deletedManager = deletedManagers.find((m: any) =>
                                                            (m.tenantId || m.id) === tenant.tenantId
                                                        );
                                                        if (!deletedManager) {
                                                            error(t('admin.managerNotFound'));
                                                            return;
                                                        }
                                                        const confirmed = await customConfirm({
                                                            type: 'info',
                                                            title: t('admin.restoreConfirm'),
                                                            message: t('admin.restoreConfirmMessage'),
                                                            confirmText: t('admin.restore'),
                                                            cancelText: t('common.cancel')
                                                        });
                                                        if (!confirmed) {
                                                            return;
                                                        }
                                                        setProcessing(tenant.tenantId);
                                                        try {
                                                            await restoreManager(deletedManager.id);
                                                            success(t('admin.managerRestored'));
                                                            await onRefresh();
                                                            const updatedDeleted = await getDeletedManagers();
                                                            setDeletedManagers(updatedDeleted);
                                                        } catch (err: any) {
                                                            error(err.message || t('admin.errorRestoring'));
                                                        } finally {
                                                            setProcessing(null);
                                                        }
                                                    }}
                                                    disabled={processing === tenant.tenantId}
                                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                    title={t('admin.restoreManager')}
                                                >
                                                    {processing === tenant.tenantId ? (
                                                        <AdoraLoaderInline size={16} />
                                                    ) : (
                                                        <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                    )}
                                                    <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">{t('admin.restore')}</span>
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => onViewDetails?.(tenant)}
                                                        className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group"
                                                        title={t('common.viewFullDetails') || 'عرض التفاصيل الكاملة'}
                                                    >
                                                        <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                        <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">{t('common.view') || 'عرض'}</span>
                                                    </button>
                                                    {/* ✅ Check if manager is deleted before showing action buttons */}
                                                    {(() => {
                                                        const isDeleted = deletedManagers.some((m: any) =>
                                                            (m.tenantId || m.id) === tenant.tenantId
                                                        );

                                                        if (isDeleted) {
                                                            // Manager is deleted - show restore button instead
                                                            return (
                                                                <button
                                                                    onClick={async () => {
                                                                        const deletedManager = deletedManagers.find((m: any) =>
                                                                            (m.tenantId || m.id) === tenant.tenantId
                                                                        );
                                                                        if (!deletedManager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        const confirmed = await customConfirm({
                                                                            type: 'info',
                                                                            title: t('owner.confirmRestore'),
                                                                            message: t('owner.confirmRestoreMessage'),
                                                                            confirmText: t('owner.restore'),
                                                                            cancelText: t('common.cancel')
                                                                        });
                                                                        if (!confirmed) {
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await restoreManager(deletedManager.id);
                                                                            success(t('admin.managerRestored'));
                                                                            await onRefresh();
                                                                            const updatedDeleted = await getDeletedManagers();
                                                                            setDeletedManagers(updatedDeleted);
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.errorRestoring'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                    title={t('admin.restoreManager')}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={16} />
                                                                    ) : (
                                                                        <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                    )}
                                                                    <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">{t('admin.restore')}</span>
                                                                </button>
                                                            );
                                                        }

                                                        // Manager is not deleted - show normal action buttons
                                                        return (
                                                            <>
                                                                <button
                                                                    onClick={async () => {
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await toggleLicenseStatus(manager.id, tenant.tenantId, tenant.status === 'active');
                                                                            success(tenant.status === 'active' ? t('admin.managerSuspended') : t('admin.managerActivated'));
                                                                            // Refresh data to update statistics and cards
                                                                            await onRefresh();
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.addError'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                    title={tenant.status === 'active' ? t('owner.suspend') : t('owner.activate')}
                                                                >
                                                                    {tenant.status === 'active' ? (
                                                                        <Pause className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                    ) : (
                                                                        <Play className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                    )}
                                                                    <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">
                                                                        {tenant.status === 'active' ? t('owner.suspend') : t('owner.activate')}
                                                                    </span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            const systemSettings = await getSystemSettings();
                                                                            const defaultPrice = systemSettings.defaultSubscriptionPrice || 0;

                                                                            // Get current subscription price
                                                                            const subscription = await getSubscription(tenant.tenantId);
                                                                            const currentPrice = subscription?.pricePerMonth || 0;

                                                                            // Renew license and check for price warning
                                                                            const result = await renewLicense(manager.id, tenant.tenantId, 1, currentPrice, defaultPrice);

                                                                            // Show warning if price is below default
                                                                            if (result.warning) {
                                                                                await customConfirm({
                                                                                    title: t('common.warning'),
                                                                                    message: result.warning,
                                                                                    confirmText: t('common.ok'),
                                                                                    showCancel: false,
                                                                                    type: 'warning'
                                                                                });
                                                                            }

                                                                            // Use default price if set, otherwise use current price
                                                                            const renewalPrice = defaultPrice > 0 ? defaultPrice : currentPrice;

                                                                            // Renew subscription with price
                                                                            await renewSubscription(tenant.tenantId, 'yearly', renewalPrice);

                                                                            // Create invoice and payment if price > 0
                                                                            if (renewalPrice > 0 && subscription) {
                                                                                const invoiceId = await createInvoice({
                                                                                    tenantId: tenant.tenantId,
                                                                                    subscriptionId: subscription.id,
                                                                                    amount: renewalPrice,
                                                                                    currency: 'SAR',
                                                                                    status: 'paid',
                                                                                    issueDate: new Date(),
                                                                                    dueDate: new Date(),
                                                                                    paidDate: new Date(),
                                                                                    items: [{
                                                                                        description: 'تجديد اشتراك سنوي',
                                                                                        quantity: 1,
                                                                                        price: renewalPrice
                                                                                    }],
                                                                                    paymentMethod: 'cash',
                                                                                    notes: 'تجديد تلقائي من قبل المالك'
                                                                                });

                                                                                await recordPayment({
                                                                                    tenantId: tenant.tenantId,
                                                                                    invoiceId: invoiceId,
                                                                                    amount: renewalPrice,
                                                                                    currency: 'SAR',
                                                                                    method: 'cash',
                                                                                    status: 'completed',
                                                                                    paidAt: new Date(),
                                                                                    notes: 'تجديد تلقائي'
                                                                                });
                                                                            }

                                                                            success(t('admin.subscriptionRenewed'));
                                                                            // Refresh data to update statistics, billing cards, and revenue
                                                                            await onRefresh();
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.errorRenewing'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                    title={t('admin.renewSubscriptionYear') || 'تجديد الاشتراك (سنة)'}
                                                                >
                                                                    {processing === tenant.tenantId ? (
                                                                        <AdoraLoaderInline size={16} />
                                                                    ) : (
                                                                        <RefreshCw className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                    )}
                                                                    <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">تجديد</span>
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        const confirmed = await customConfirm({
                                                                            type: 'danger',
                                                                            title: t('admin.confirmDelete'),
                                                                            message: t('admin.deleteManagerConfirm', { name: tenant.managerName || tenant.tenantName }),
                                                                            confirmText: t('admin.delete'),
                                                                            cancelText: t('common.cancel')
                                                                        });
                                                                        if (!confirmed) {
                                                                            return;
                                                                        }
                                                                        const managers = await getAllManagers();
                                                                        const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                                        if (!manager) {
                                                                            error(t('admin.managerNotFound'));
                                                                            return;
                                                                        }
                                                                        setProcessing(tenant.tenantId);
                                                                        try {
                                                                            await softDeleteManager(manager.id, tenant.tenantId);
                                                                            success(t('admin.managerDeletedSuccess'));
                                                                            // Refresh data to update statistics
                                                                            await onRefresh();
                                                                            const deleted = await getDeletedManagers();
                                                                            setDeletedManagers(deleted);
                                                                        } catch (err: any) {
                                                                            error(err.message || t('admin.deleteError'));
                                                                        } finally {
                                                                            setProcessing(null);
                                                                        }
                                                                    }}
                                                                    disabled={processing === tenant.tenantId}
                                                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                    title={t('admin.deletePermanent')}
                                                                >
                                                                    <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                    <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">{t('admin.delete')}</span>
                                                                </button>
                                                            </>
                                                        );
                                                    })()}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>


            {/* Manager Details Modal */}
            {selectedTenant && managerDetails && (
                <ManagerDetailsModal
                    tenant={selectedTenant}
                    managerDetails={managerDetails}
                    loading={loadingDetails}
                    onClose={() => {
                        setSelectedTenant(null);
                        setManagerDetails(null);
                    }}
                />
            )}
        </>
    );
};

const SettingsTab: React.FC<{
    systemSettings: SystemSettings;
    onSave: (updates: Partial<SystemSettings>) => void;
    saving: boolean;
    features: SystemSettings['features'];
    onToggleFeature: (feature: keyof SystemSettings['features'], enabled: boolean) => void;
}> = ({ systemSettings, onSave, saving, features, onToggleFeature }) => {
    const { t } = useTranslation();
    const [isFeaturesCollapsed, setIsFeaturesCollapsed] = useState(true);
    const [isCompanyInfoCollapsed, setIsCompanyInfoCollapsed] = useState(true);
    const [isTabsConfigCollapsed, setIsTabsConfigCollapsed] = useState(true);
    
    // ✅ Visible Tabs Configuration
    const visibleTabs = systemSettings.visibleTabs || {
        overview: true,
        tenants: false,
        billing: false,
        settings: false,
        broadcasts: false,
        demo: true,
        'core-config': false
    };
    
    const handleToggleTab = (tabKey: keyof typeof visibleTabs) => {
        const updated = {
            ...visibleTabs,
            [tabKey]: !visibleTabs[tabKey]
        };
        onSave({ visibleTabs: updated });
    };

    // ✅ FIXED: Initialize from localStorage first, then systemSettings
    const [localPrice, setLocalPrice] = useState<number>(() => {
        // Check localStorage for cached settings
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.defaultSubscriptionPrice !== undefined) {
                    return parsed.defaultSubscriptionPrice;
                }
            } catch { }
        }
        return systemSettings.defaultSubscriptionPrice ?? 0;
    });
    const [localTax, setLocalTax] = useState<number>(() => {
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.defaultTaxRate !== undefined) {
                    return parsed.defaultTaxRate;
                }
            } catch { }
        }
        return systemSettings.defaultTaxRate ?? 15;
    });
    const [localTwoYearDiscount, setLocalTwoYearDiscount] = useState<number>(() => {
        const localData = localStorage.getItem('adora_system_settings');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (parsed.twoYearDiscountRate !== undefined) {
                    return parsed.twoYearDiscountRate;
                }
            } catch { }
        }
        return systemSettings.twoYearDiscountRate ?? 0;
    });

    // ✅ Display values are now directly from local state
    const displayPrice = localPrice;
    const displayTax = localTax;
    const displayTwoYearDiscount = localTwoYearDiscount;

    // ✅ Sync from systemSettings if it gets updated externally (but don't overwrite user edits)
    const prevSettingsRef = useRef({ price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate, discount: systemSettings.twoYearDiscountRate });
    useEffect(() => {
        const prevPrice = prevSettingsRef.current.price;
        const prevTax = prevSettingsRef.current.tax;
        const prevDiscount = prevSettingsRef.current.discount;

        // Only update if systemSettings actually changed (not on initial mount)
        if (systemSettings.defaultSubscriptionPrice !== prevPrice && systemSettings.defaultSubscriptionPrice !== undefined) {
            setLocalPrice(systemSettings.defaultSubscriptionPrice);
        }
        if (systemSettings.defaultTaxRate !== prevTax && systemSettings.defaultTaxRate !== undefined) {
            setLocalTax(systemSettings.defaultTaxRate);
        }
        if (systemSettings.twoYearDiscountRate !== prevDiscount && systemSettings.twoYearDiscountRate !== undefined) {
            setLocalTwoYearDiscount(systemSettings.twoYearDiscountRate);
        }

        prevSettingsRef.current = { price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate, discount: systemSettings.twoYearDiscountRate };
    }, [systemSettings.defaultSubscriptionPrice, systemSettings.defaultTaxRate, systemSettings.twoYearDiscountRate]);

    // ✅ Local state for company information
    const [localCompanyName, setLocalCompanyName] = useState(systemSettings.companyName ?? '');
    const [localCompanyTaxNumber, setLocalCompanyTaxNumber] = useState(systemSettings.companyTaxNumber ?? '');
    const [localCompanyAddress, setLocalCompanyAddress] = useState(systemSettings.companyAddress ?? '');
    const [localCommercialRegistration, setLocalCommercialRegistration] = useState(systemSettings.commercialRegistrationNumber ?? '');
    const [localContactPhone, setLocalContactPhone] = useState(systemSettings.contactPhone ?? '');
    const [localContactEmail, setLocalContactEmail] = useState(systemSettings.contactEmail ?? '');
    const [localContactWebsite, setLocalContactWebsite] = useState(systemSettings.contactWebsite ?? '');

    // Feature Labels
    const featureLabels: Record<string, string> = {
        qrCodeGuestPortal: 'بوابة النزيل (QR)',
        pointsSystem: 'نظام النقاط',
        gamification: 'الشارات والرتب',
        shiftNotes: 'ملاحظات الشيفت',
        scheduledTasks: 'المهام المجدولة',
        aiAssistant: 'المساعد الذكي',
        calendarSync: 'مزامنة التقويم',
        inventoryManagement: 'إدارة المخزون',
        procurementSystem: 'نظام المشتريات',
        laundryManagement: 'إدارة المغسلة',
        whatsappIntegration: 'تكامل واتساب',
        emailNotifications: 'إشعارات البريد',
        smsNotifications: 'إشعارات SMS'
    };

    const featureDescriptions: Record<string, string> = {
        qrCodeGuestPortal: t('admin.featureDescriptions.qrCodeGuestPortal'),
        pointsSystem: t('admin.featureDescriptions.pointsSystem'),
        gamification: t('admin.featureDescriptions.gamification'),
        shiftNotes: t('admin.featureDescriptions.shiftNotes'),
        scheduledTasks: t('admin.featureDescriptions.scheduledTasks'),
        aiAssistant: 'سوف يظهر زر المساعد الصوتي في المشروع للمشتركين. يمكن للموظفين التفاعل مع النظام عبر الأوامر الصوتية.',
        calendarSync: 'مزامنة التقويم مع أنظمة خارجية. يسمح بتنسيق الأحداث والمواعيد مع التقويمات الأخرى.',
        inventoryManagement: 'نظام إدارة المخزون الكامل. تتبع المنتجات، الكميات، والحركات المخزنية.',
        procurementSystem: 'نظام إدارة المشتريات. تتبع طلبات الشراء، الموافقات، والاستلام.',
        laundryManagement: 'نظام إدارة المغسلة. تتبع غسيل الملابس، التسليم، والاستلام.',
        whatsappIntegration: 'تكامل مع واتساب لإرسال الإشعارات والرسائل. يسمح بالتواصل مع العملاء والموظفين عبر واتساب.',
        emailNotifications: 'إرسال الإشعارات عبر البريد الإلكتروني. تنبيهات تلقائية للأحداث المهمة.',
        smsNotifications: 'إرسال الإشعارات عبر الرسائل النصية (SMS). تنبيهات فورية للأحداث الحرجة.'
    };

    // ✅ FIX: Fixed order to prevent reordering when toggling
    const featureOrder: (keyof SystemSettings['features'])[] = [
        'qrCodeGuestPortal',
        'pointsSystem',
        'gamification',
        'shiftNotes',
        'scheduledTasks',
        'aiAssistant',
        'calendarSync',
        'inventoryManagement',
        'procurementSystem',
        'laundryManagement',
        'whatsappIntegration',
        'emailNotifications',
        'smsNotifications'
    ];

    return (
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            {/* General Settings Section - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">{t('admin.generalSettings')}</h3>
                <div className="space-y-4 sm:space-y-6">
                    {/* Default Subscription Price */}
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                {t('admin.subscriptionPrice')}
                            </label>
                            <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                {t('admin.subscriptionPriceNote')}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 items-end">
                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        سعر الاشتراك (ر.س)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={displayPrice}
                                        onChange={(e) => {
                                            const newPrice = parseFloat(e.target.value) || 0;
                                            setLocalPrice(newPrice);
                                        }}
                                        onInput={(e) => {
                                            // ✅ Also handle onInput for browser automation compatibility
                                            const newPrice = parseFloat((e.target as HTMLInputElement).value) || 0;
                                            setLocalPrice(newPrice);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                        placeholder={t('common.examplePrice') || 'مثال: 1000'}
                                    />
                                </div>

                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        نسبة الضريبة (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={displayTax}
                                        onChange={(e) => {
                                            const newTax = parseFloat(e.target.value);
                                            setLocalTax(isNaN(newTax) ? 0 : newTax);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                        placeholder={t('admin.discountPlaceholder') || '15'}
                                    />
                                </div>

                                <div className="w-full">
                                    <label className="block text-xs font-medium text-white/70 mb-1.5">
                                        خصم السنتين (%)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={displayTwoYearDiscount}
                                        onChange={(e) => {
                                            const newDiscount = parseFloat(e.target.value);
                                            setLocalTwoYearDiscount(isNaN(newDiscount) ? 0 : newDiscount);
                                        }}
                                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                        placeholder={t('admin.discountPlaceholder2') || '5'}
                                    />
                                </div>
                            </div>
                            
                            {/* Helper text for discount */}
                            {displayTwoYearDiscount > 0 && (
                                <p className="text-xs text-white/50 mt-2 flex items-center gap-1.5">
                                    <span className="text-teal-400">ℹ️</span>
                                    سيتم تطبيق خصم {displayTwoYearDiscount}% تلقائياً عند اختيار اشتراك سنتين
                                </p>
                            )}

                            <div className="flex justify-end mt-4">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => {
                                        onSave({
                                            defaultSubscriptionPrice: displayPrice,
                                            defaultTaxRate: displayTax,
                                            twoYearDiscountRate: displayTwoYearDiscount
                                        });
                                    }}
                                    className="w-full sm:w-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl bg-blue-500 text-white text-xs sm:text-sm font-semibold hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <AdoraLoaderInline size={16} />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {t('common.save')}
                                </button>
                            </div>

                            {/* Calculated summary */}
                            {displayPrice > 0 && (
                                <div className="mt-3 text-xs text-white/60 space-y-1 bg-gradient-to-br from-blue-500/10 via-teal-500/10 to-purple-500/10 rounded-xl p-4 border-2 border-teal-500/30 shadow-lg shadow-teal-500/20 backdrop-blur-sm">
                                    {(() => {
                                        const total = displayPrice;
                                        const taxRate = displayTax / 100;
                                        // نفترض أن السعر شامل الضريبة
                                        const basePrice = taxRate > 0 ? total / (1 + taxRate) : total;
                                        const taxAmount = total - basePrice;
                                        
                                        // ✅ Calculate 2-year price with discount and tax
                                        const twoYearBase = total * 2;
                                        const twoYearDiscountAmount = displayTwoYearDiscount > 0 ? (twoYearBase * displayTwoYearDiscount) / 100 : 0;
                                        const twoYearAfterDiscount = twoYearBase - twoYearDiscountAmount;
                                        
                                        // Calculate tax on discounted price
                                        const twoYearBaseBeforeTax = taxRate > 0 ? twoYearAfterDiscount / (1 + taxRate) : twoYearAfterDiscount;
                                        const twoYearTaxAmount = twoYearAfterDiscount - twoYearBaseBeforeTax;
                                        
                                        return (
                                            <>
                                                <p className="text-[11px]">
                                                    السعر قبل الضريبة: <span className="text-white/90">{Math.round(basePrice).toLocaleString()} ر.س</span>
                                                </p>
                                                <p className="text-[11px]">
                                                    قيمة الضريبة ({systemSettings.defaultTaxRate ?? 15}%):{' '}
                                                    <span className="text-white/90">{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </p>
                                                <p className="text-[11px]">
                                                    إجمالي الاشتراك بعد الضريبة:{' '}
                                                    <span className="text-primary-500 font-semibold">
                                                        {Math.round(total).toLocaleString()} ر.س
                                                    </span>
                                                </p>
                                                {displayTwoYearDiscount > 0 && (
                                                    <>
                                                        <div className="border-t-2 border-primary-500/30 my-3 pt-3 mt-3 bg-primary-500/5 rounded-lg p-3 -mx-1">
                                                            <p className="text-primary-500 font-semibold mb-2 text-xs flex items-center gap-2">
                                                                <span className="text-base">✨</span>
                                                                الاشتراك لسنتين (بعد الخصم):
                                                            </p>
                                                            <p className="text-[11px]">
                                                                السعر الأصلي (سنتين): <span className="text-white/90">{Math.round(twoYearBase).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                خصم {displayTwoYearDiscount}%: <span className="text-red-400">-{Math.round(twoYearDiscountAmount).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                السعر بعد الخصم (قبل الضريبة): <span className="text-white/90">{Math.round(twoYearBaseBeforeTax).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                قيمة الضريبة ({systemSettings.defaultTaxRate ?? 15}%): <span className="text-white/90">{Math.round(twoYearTaxAmount).toLocaleString()} ر.س</span>
                                                            </p>
                                                            <p className="text-[11px]">
                                                                الإجمالي النهائي (بعد الخصم + الضريبة):{' '}
                                                                <span className="text-primary-500 font-semibold">
                                                                    {Math.round(twoYearAfterDiscount).toLocaleString()} ر.س
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Company Information Section - Collapsible - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Header - Clickable */}
                <div
                    onClick={() => setIsCompanyInfoCollapsed(!isCompanyInfoCollapsed)}
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-teal-500/20 flex items-center justify-center shadow-lg shadow-teal-500/10 flex-shrink-0">
                            <FileText className="w-4 h-4 text-teal-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">معلومات الشركة (للمطبوعات)</h3>
                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                                {t('admin.infoAppearsInAllPrints')}
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCompanyInfoCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCompanyInfoCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-3 sm:space-y-4">
                            {/* Company Name */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    اسم الشركة *
                                </label>
                                <input
                                    type="text"
                                    value={localCompanyName}
                                    onChange={(e) => setLocalCompanyName(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('common.exampleCompanyName') || 'مثال: شركة أدورا لإدارة الفنادق'}
                                />
                            </div>

                            {/* Tax Number */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    الرقم الضريبي *
                                </label>
                                <input
                                    type="text"
                                    value={localCompanyTaxNumber}
                                    onChange={(e) => setLocalCompanyTaxNumber(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('common.exampleTaxNumber') || 'مثال: 302003322600003'}
                                />
                            </div>

                            {/* Commercial Registration */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    {t('admin.commercialRegisterNumber')} *
                                </label>
                                <input
                                    type="text"
                                    value={localCommercialRegistration}
                                    onChange={(e) => setLocalCommercialRegistration(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('owner.exampleCommercialRegistration') || 'مثال: 4030284941'}
                                />
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    عنوان الشركة *
                                </label>
                                <textarea
                                    value={localCompanyAddress}
                                    onChange={(e) => setLocalCompanyAddress(e.target.value)}
                                    rows={2}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base resize-none"
                                    placeholder={t('owner.exampleCompanyAddress') || 'مثال: جدة - الرويس، شارع الجزيرة بجوار الأطباء المتحدون'}
                                />
                            </div>

                            {/* Contact Phone */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    أرقام التواصل (هاتف) *
                                </label>
                                <input
                                    type="text"
                                    value={localContactPhone}
                                    onChange={(e) => setLocalContactPhone(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('owner.exampleContactPhone') || 'مثال: +966 12 6076060، +966 570707121'}
                                />
                            </div>

                            {/* Contact Email */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    البريد الإلكتروني
                                </label>
                                <input
                                    type="email"
                                    value={localContactEmail}
                                    onChange={(e) => setLocalContactEmail(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('owner.exampleContactEmail') || 'مثال: info@adora.com'}
                                />
                            </div>

                            {/* Contact Website */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    الموقع الإلكتروني
                                </label>
                                <input
                                    type="url"
                                    value={localContactWebsite}
                                    onChange={(e) => setLocalContactWebsite(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder={t('owner.exampleWebsite') || 'مثال: https://www.adora.com'}
                                />
                            </div>

                            {/* Save Button */}
                            <button
                                type="button"
                                disabled={saving}
                                onClick={() => {
                                    onSave({
                                        companyName: localCompanyName,
                                        companyTaxNumber: localCompanyTaxNumber,
                                        companyAddress: localCompanyAddress,
                                        commercialRegistrationNumber: localCommercialRegistration,
                                        contactPhone: localContactPhone,
                                        contactEmail: localContactEmail,
                                        contactWebsite: localContactWebsite
                                    });
                                }}
                                className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-teal-500 text-white text-sm font-semibold hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <AdoraLoaderInline size={16} />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {t('admin.saveCompanyInfo')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Management Section - Collapsible - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
                {/* Header - Clickable */}
                <div
                    onClick={() => setIsFeaturesCollapsed(!isFeaturesCollapsed)}
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">إدارة الميزات</h3>
                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                                تفعيل أو إيقاف الميزات على مستوى النظام. عند إيقاف ميزة، ستختفي من جميع الفروع تلقائياً.
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isFeaturesCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isFeaturesCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-3 sm:space-y-4">
                            {featureOrder.map((key) => {
                                if (key === 'experimentalFeatures') return null;
                                const enabled = features[key] as boolean;
                                const description = featureDescriptions[key] || 'ميزة متاحة في النظام';
                                return (
                                    <div
                                        key={key}
                                        className="flex items-start justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl hover:bg-white/10 transition-all gap-3 sm:gap-4"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-1">
                                                <h4 className="font-medium text-white text-sm sm:text-base">{featureLabels[key] || key}</h4>
                                                <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${enabled
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                                                    }`}>
                                                    {enabled ? t('owner.enabled') : t('owner.disabled')}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-600 dark:text-white/50 leading-relaxed mt-2">{description}</p>
                                        </div>
                                        <button
                                            onClick={() => onToggleFeature(key, !enabled)}
                                            disabled={saving}
                                            className={`relative w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-600'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 left-0.5 sm:top-1 sm:left-1 w-6 h-6 bg-white rounded-full transition-transform ${enabled ? 'translate-x-5 sm:translate-x-6' : ''
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Visible Tabs Configuration Section */}
            <div className="glass rounded-xl sm:rounded-2xl overflow-hidden border border-white/10">
                <div
                    onClick={() => setIsTabsConfigCollapsed(!isTabsConfigCollapsed)}
                    className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                            <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">{t('admin.horizontalTabsSettings')}</h3>
                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                                {t('admin.selectTabsToShow')}
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isTabsConfigCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isTabsConfigCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                        <div className="p-3 sm:p-4 lg:p-6">
                        <div className="space-y-3 sm:space-y-4">
                            {[
                                { key: 'overview' as const, label: t('admin.overview') || 'Overview', description: t('admin.mainDashboardAlwaysVisible') || 'Main Dashboard (always visible)', alwaysVisible: true },
                                { key: 'tenants' as const, label: t('admin.createManager') || 'Create Manager', description: t('admin.tabDescriptions.tenants') || 'Create and manage managers (subscribers)', alwaysVisible: false },
                                { key: 'billing' as const, label: t('admin.billing') || 'Billing', description: t('admin.tabDescriptions.billing') || 'Manage invoices and subscriptions', alwaysVisible: false },
                                { key: 'settings' as const, label: t('admin.systemSettings') || 'System Settings', description: t('admin.tabDescriptions.settings') || 'Complete project settings', alwaysVisible: false },
                                { key: 'demo' as const, label: t('admin.demoLinks') || 'Demo Links', description: t('admin.tabDescriptions.demo') || 'Create and manage demo links', alwaysVisible: false },
                                { key: 'core-config' as const, label: t('admin.coreSetup') || '🔐 Core Setup', description: t('admin.tabDescriptions.coreConfig') || 'Advanced core settings (hidden by default)', alwaysVisible: false },
                            ].map(tab => {
                                const isEnabled = visibleTabs[tab.key] !== false;
                                const isDisabled = tab.alwaysVisible;
                                
                                return (
                                    <div
                                        key={tab.key}
                                        className="flex items-start justify-between p-3 sm:p-4 bg-white/5 rounded-lg sm:rounded-xl hover:bg-white/10 transition-all gap-3 sm:gap-4"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-1">
                                                <h4 className="font-medium text-white text-sm sm:text-base">
                                                    {tab.label}
                                                </h4>
                                                {isDisabled && (
                                                    <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                        دائماً مرئي
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
                                                {tab.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => !isDisabled && handleToggleTab(tab.key)}
                                                disabled={isDisabled || saving}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                                                    isEnabled
                                                        ? 'bg-teal-500'
                                                        : 'bg-white/20'
                                                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                title={isDisabled ? 'هذا التبويب دائماً مرئي' : isEnabled ? 'إخفاء التبويب' : 'إظهار التبويب'}
                                            >
                                                <span
                                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${
                                                        isEnabled ? 'translate-x-6' : 'translate-x-0'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Dynamic Platform Branding Section - Logo & Theme */}
            <DynamicBrandingSection />

            {/* ✅ Developer Branding Section - For Forgot Code & Support Links */}
            <DeveloperBrandingSection />
        </div>
    );
};

// ✅ Dynamic Platform Branding Component (Logo + Theme Color)
const DynamicBrandingSection: React.FC = () => {
    const { t } = useTranslation();
    const [isCollapsed, setIsCollapsed] = useState(true); // ✅ Collapsed by default
    const [logoUrl, setLogoUrl] = useState(localStorage.getItem('adora_platform_logo') || '/adora-logo.png');
    const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('adora_primary_color') || '#14b8a6');
    const [secondaryColor, setSecondaryColor] = useState(localStorage.getItem('adora_secondary_color') || '#06b6d4');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const presetColors = [
        { name: 'تركوازي (افتراضي)', primary: '#14b8a6', secondary: '#06b6d4' },
        { name: 'أزرق ملكي', primary: '#3b82f6', secondary: '#60a5fa' },
        { name: 'بنفسجي', primary: '#8b5cf6', secondary: '#a78bfa' },
        { name: 'أخضر زمردي', primary: '#10b981', secondary: '#34d399' },
        { name: 'ذهبي فاخر', primary: '#f59e0b', secondary: '#fbbf24' },
        { name: 'وردي', primary: '#ec4899', secondary: '#f472b6' },
    ];

    const handleSave = () => {
        setSaving(true);
        localStorage.setItem('adora_platform_logo', logoUrl);
        localStorage.setItem('adora_primary_color', primaryColor);
        localStorage.setItem('adora_secondary_color', secondaryColor);

        // Apply theme immediately via CSS variables
        document.documentElement.style.setProperty('--color-primary', primaryColor);
        document.documentElement.style.setProperty('--color-secondary', secondaryColor);

        setTimeout(() => {
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
            {/* Header - Clickable */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                        <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">الهوية البصرية</h3>
                        <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                            تخصيص شكل المنصة (اللوجو والألوان) - تظهر في صفحة الدخول وجميع الواجهات
                        </p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                <div className="p-4 sm:p-6 space-y-4">
                    <p className="text-xs text-white/60 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                        {t('admin.theseSettingsChangePlatform')}
                    </p>

                    {/* Logo URL */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            رابط اللوجو (Logo URL)
                        </label>
                        <input
                            type="url"
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-purple-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.exampleLogoUrl') || 'https://example.com/logo.png'}
                            dir="ltr"
                        />
                        {logoUrl && (
                            <div className="mt-2 p-3 bg-slate-800/50 rounded-xl flex items-center justify-center">
                                <img
                                    src={logoUrl}
                                    alt="معاينة اللوجو"
                                    className="max-h-20 max-w-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = '/adora-logo.png';
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Theme Colors */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-2">
                            ألوان الثيم
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2 sm:mb-3">
                            {presetColors.map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => {
                                        setPrimaryColor(preset.primary);
                                        setSecondaryColor(preset.secondary);
                                    }}
                                    className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${primaryColor === preset.primary
                                            ? 'border-white/30 bg-white/10'
                                            : 'border-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full shadow-lg"
                                        style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})` }}
                                    />
                                    <span className="text-white/60 text-xs flex-1 text-right">{preset.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Custom Color Picker */}
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <label className="block text-xs text-white/50 mb-1">اللون الأساسي</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        type="text"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs text-white/50 mb-1">اللون الثانوي</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                                    />
                                    <input
                                        type="text"
                                        value={secondaryColor}
                                        onChange={(e) => setSecondaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs font-mono"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="mt-3 p-4 rounded-xl border border-white/10" style={{
                            background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}10)`
                        }}>
                            <p className="text-white/60 text-xs mb-2">معاينة الألوان:</p>
                            <div className="flex gap-2">
                                <button
                                    className="px-4 py-2 rounded-lg text-white text-sm font-medium shadow-lg transition-transform hover:scale-105"
                                    style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                                >
                                    زرار رئيسي
                                </button>
                                <button
                                    className="px-4 py-2 rounded-lg text-sm font-medium"
                                    style={{
                                        background: `${primaryColor}20`,
                                        color: primaryColor,
                                        border: `1px solid ${primaryColor}40`
                                    }}
                                >
                                    زرار ثانوي
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                    >
                        {saving ? (
                            <AdoraLoaderInline size={16} />
                        ) : saved ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {t('admin.saveSuccess')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('admin.saveVisualIdentity')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ✅ Developer Branding Section Component
const DeveloperBrandingSection: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { success, error } = useUX();
    const [isCollapsed, setIsCollapsed] = useState(true); // ✅ Collapsed by default
    const [devPhoneSA, setDevPhoneSA] = useState(localStorage.getItem('adora_dev_phone_sa') || '966570707121');
    const [devPhoneEG, setDevPhoneEG] = useState(localStorage.getItem('adora_dev_phone_eg') || '201500000162');
    const [devEmail, setDevEmail] = useState(localStorage.getItem('adora_dev_email') || '77aayy@gmail.com');
    const [devName, setDevName] = useState(localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda');
    const [devSignature, setDevSignature] = useState(localStorage.getItem('adora_dev_signature') || 'Crafted by Ayman Abo Warda');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // ✅ Load from Firebase on mount (with localStorage as fallback)
    // ✅ CRITICAL: Only load on mount, never reload after save
    useEffect(() => {
        const loadDeveloperSettings = async () => {
            try {
                // ✅ CRITICAL: Force refresh to get latest data from Firebase
                const settings = await getSystemSettings(true); // forceRefresh = true
                if (settings?.developerBranding) {
                    const branding = settings.developerBranding;
                    // ✅ Always update state, even if value is empty (to clear old values)
                    setDevPhoneSA(branding.devPhoneSA || '');
                    setDevPhoneEG(branding.devPhoneEG || '');
                    setDevEmail(branding.devEmail || '');
                    setDevName(branding.devName || '');
                    setDevSignature(branding.devSignature || '');
                    
                    // ✅ CRITICAL: Sync to localStorage for backward compatibility (always, even if empty)
                    localStorage.setItem('adora_dev_phone_sa', branding.devPhoneSA || '');
                    localStorage.setItem('adora_dev_phone_eg', branding.devPhoneEG || '');
                    localStorage.setItem('adora_dev_email', branding.devEmail || '');
                    localStorage.setItem('adora_dev_name', branding.devName || '');
                    localStorage.setItem('adora_dev_signature', branding.devSignature || '');
                } else {
                    // ✅ If no Firebase data, use localStorage as fallback
                    const localName = localStorage.getItem('adora_dev_name');
                    const localPhoneSA = localStorage.getItem('adora_dev_phone_sa');
                    const localPhoneEG = localStorage.getItem('adora_dev_phone_eg');
                    const localEmail = localStorage.getItem('adora_dev_email');
                    const localSignature = localStorage.getItem('adora_dev_signature');
                    
                    if (localName) setDevName(localName);
                    if (localPhoneSA) setDevPhoneSA(localPhoneSA);
                    if (localPhoneEG) setDevPhoneEG(localPhoneEG);
                    if (localEmail) setDevEmail(localEmail);
                    if (localSignature) setDevSignature(localSignature);
                }
            } catch (err) {
                console.warn('Failed to load developer settings from Firebase, using localStorage:', err);
                // ✅ Fallback to localStorage
                const localName = localStorage.getItem('adora_dev_name');
                const localPhoneSA = localStorage.getItem('adora_dev_phone_sa');
                const localPhoneEG = localStorage.getItem('adora_dev_phone_eg');
                const localEmail = localStorage.getItem('adora_dev_email');
                const localSignature = localStorage.getItem('adora_dev_signature');
                
                if (localName) setDevName(localName);
                if (localPhoneSA) setDevPhoneSA(localPhoneSA);
                if (localPhoneEG) setDevPhoneEG(localPhoneEG);
                if (localEmail) setDevEmail(localEmail);
                if (localSignature) setDevSignature(localSignature);
            } finally {
                setLoading(false);
            }
        };
        
        loadDeveloperSettings();
    }, []); // ✅ Empty dependency array - only runs on mount, NEVER reloads after save

    const handleSave = async () => {
        setSaving(true);
        try {
            // ✅ Save to localStorage (for backward compatibility)
            localStorage.setItem('adora_dev_phone_sa', devPhoneSA);
            localStorage.setItem('adora_dev_phone_eg', devPhoneEG);
            localStorage.setItem('adora_dev_email', devEmail);
            localStorage.setItem('adora_dev_name', devName);
            localStorage.setItem('adora_dev_signature', devSignature);
            
            // ✅ CRITICAL: Save to Firebase for persistence across devices/browsers
            await updateSystemSettings({
                developerBranding: {
                    devPhoneSA,
                    devPhoneEG,
                    devEmail,
                    devName,
                    devSignature
                }
            }, user?.id || 'system');
            
            // ✅ CRITICAL: Invalidate cache to force refresh on next load
            try {
                const { invalidateCache } = await import('../../utils/requestCache');
                invalidateCache('settings:system');
            } catch (err) {
                console.warn('Could not invalidate cache:', err);
            }
            
            // ✅ CRITICAL: Also update localStorage system_settings to ensure consistency
            try {
                const localKey = 'adora_system_settings';
                const existing = localStorage.getItem(localKey);
                const currentLocal = existing ? JSON.parse(existing) : {};
                const updated = {
                    ...currentLocal,
                    developerBranding: {
                        devPhoneSA,
                        devPhoneEG,
                        devEmail,
                        devName,
                        devSignature
                    },
                    updatedAt: new Date().toISOString(),
                    updatedBy: user?.id || 'system'
                };
                localStorage.setItem(localKey, JSON.stringify(updated));
            } catch (err) {
                console.warn('Could not update localStorage system_settings:', err);
            }
            
            // ✅ CRITICAL: Update individual localStorage keys for backward compatibility
            localStorage.setItem('adora_dev_name', devName);
            localStorage.setItem('adora_dev_phone_sa', devPhoneSA);
            localStorage.setItem('adora_dev_phone_eg', devPhoneEG);
            localStorage.setItem('adora_dev_email', devEmail);
            localStorage.setItem('adora_dev_signature', devSignature);
            
            // ✅ CRITICAL: Dispatch event to update all components immediately (LoginScreen, DeveloperSignature, DeveloperFooter, etc.)
            const configData = {
                devName,
                phoneSA: devPhoneSA,
                phoneEG: devPhoneEG,
                email: devEmail,
                signature: devSignature
            };
            
            // Dispatch custom event for real-time updates
            window.dispatchEvent(new CustomEvent('adora_dev_settings_updated', { detail: configData }));
            
            setSaved(true);
            success(t('admin.saveSuccess') || 'تم حفظ الإعدادات بنجاح');
            
            // ✅ CRITICAL: Don't reload from Firebase immediately - use saved values
            // Firebase write may have delay, so we keep the current state values
            // The state is already updated with the saved values, no need to reload
            
            setTimeout(() => setSaved(false), 2000);
        } catch (err: any) {
            console.error('Error saving developer settings:', err);
            error(t('admin.errorSavingSettings') || 'خطأ في حفظ الإعدادات');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl overflow-hidden">
            {/* Header - Clickable */}
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 flex-shrink-0">
                        <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">{t('admin.developerSettings')}</h3>
                        <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                            {t('admin.technicalSupportAndCopyright')}
                        </p>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-4 h-4 text-white/60" />
                </div>
            </div>

            {/* Collapsible Content */}
            <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                <div className="p-4 sm:p-6 space-y-4">
                    <p className="text-xs text-white/60 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                        💡 هذه البيانات تُستخدم في رابط "نسيت الكود" وتوقيع حقوق الملكية في أسفل الصفحات.
                        يمكنك تغييرها في أي وقت.
                    </p>

                    {/* Developer Phone - Saudi */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            📱 رقم واتساب السعودية (+966)
                        </label>
                        <input
                            type="tel"
                            value={devPhoneSA}
                            onChange={(e) => setDevPhoneSA(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-amber-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.examplePhoneSA') || '966570707121'}
                            dir="ltr"
                        />
                        <p className="text-xs text-white/40 mt-1">{t('owner.enterPhoneWithCountryCode') || 'ادخل الرقم بالمفتاح الدولي بدون + (مثال: 966570707121)'}</p>
                    </div>

                    {/* Developer Phone - Egypt */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            📱 رقم واتساب مصر (+20)
                        </label>
                        <input
                            type="tel"
                            value={devPhoneEG}
                            onChange={(e) => setDevPhoneEG(e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-amber-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.examplePhoneEG') || '201500000162'}
                            dir="ltr"
                        />
                        <p className="text-xs text-white/40 mt-1">ادخل الرقم بالمفتاح الدولي بدون + (مثال: 201500000162)</p>
                    </div>

                    {/* Developer Email */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            البريد الإلكتروني للمطور
                        </label>
                        <input
                            type="email"
                            value={devEmail}
                            onChange={(e) => setDevEmail(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-amber-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.exampleEmail') || '77aayy@gmail.com'}
                            dir="ltr"
                        />
                        <p className="text-xs text-white/40 mt-1">{t('owner.appearsInDeveloperSignature') || 'يظهر في توقيع المطور أسفل الصفحات'}</p>
                    </div>

                    {/* Developer Name */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            اسم المطور / الشركة
                        </label>
                        <input
                            type="text"
                            value={devName}
                            onChange={(e) => setDevName(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-amber-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.exampleDeveloperName') || 'Ayman Abu Warda'}
                        />
                    </div>

                    {/* Developer Signature */}
                    <div>
                        <label className="block text-xs font-medium text-white/70 mb-1.5">
                            توقيع المطور (Copyright)
                        </label>
                        <input
                            type="text"
                            value={devSignature}
                            onChange={(e) => setDevSignature(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-amber-400 transition-colors text-sm sm:text-base"
                            placeholder={t('owner.exampleCraftedBy') || 'Crafted by Ayman Abu Warda'}
                        />
                        <p className="text-xs text-white/40 mt-1">يظهر في أسفل صفحات النظام</p>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {saving ? (
                            <AdoraLoaderInline size={16} />
                        ) : saved ? (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {t('admin.saveSuccess')}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {t('admin.saveDeveloperSettings')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const UpdatesTab: React.FC<{
    updates: SystemSettings['updates'];
    onAddUpdate: () => void;
}> = ({ updates, onAddUpdate }) => {
    const [broadcasting, setBroadcasting] = useState(false);
    const [broadcastSent, setBroadcastSent] = useState(false);

    // ✅ Global Update Broadcast - Send notification to ALL users
    const handleBroadcastUpdate = async () => {
        if (updates.length === 0) {
            await customConfirm({
                title: t('common.warning'),
                message: t('admin.noUpdatesToBroadcast'),
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'warning'
            });
            return;
        }

        const latestUpdate = updates[0];
        const confirmBroadcast = await customConfirm({
            title: t('admin.broadcastUpdate'),
            message: t('admin.sendNotificationToAllUsers', { version: latestUpdate.version }),
            confirmText: t('admin.broadcastNow'),
            cancelText: t('common.cancel'),
            type: 'info'
        });

        if (!confirmBroadcast) return;

        setBroadcasting(true);
        try {
            // Store broadcast notification in system_configs for all users to pick up
            const { doc: docRef, setDoc, serverTimestamp } = await import('firebase/firestore');
            if (db) {
                await setDoc(docRef(db, 'system_configs', 'latest_update_broadcast'), {
                    version: latestUpdate.version,
                    changelog: latestUpdate.changelog,
                    critical: latestUpdate.critical,
                    broadcastAt: serverTimestamp(),
                    message: t('admin.newUpdateAvailable', { version: latestUpdate.version, changelog: latestUpdate.changelog })
                });
            }

            setBroadcastSent(true);
            setTimeout(() => setBroadcastSent(false), 5000);
        } catch (error) {
            console.error('Error broadcasting update:', error);
            await customConfirm({
                title: t('admin.error'),
                message: t('admin.errorBroadcastingUpdate'),
                confirmText: t('common.ok'),
                showCancel: false,
                type: 'danger'
            });
        } finally {
            setBroadcasting(false);
        }
    };

    return (
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('admin.updates')}</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        {t('admin.manageSystemUpdates')}
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={onAddUpdate}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">{t('admin.addUpdate')}</span>
                    </button>
                    {/* ✅ Global Broadcast Button */}
                    <button
                        onClick={handleBroadcastUpdate}
                        disabled={broadcasting || updates.length === 0}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${broadcastSent
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                            }`}
                    >
                        {broadcasting ? (
                            <AdoraLoaderInline size={16} />
                        ) : broadcastSent ? (
                            <>
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">{t('admin.broadcastSent')}</span>
                            </>
                        ) : (
                            <>
                                <Bell className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">{t('admin.broadcastUpdateButton')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* ✅ Broadcast Info Banner */}
            <div className="mb-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <p className="text-purple-300 text-xs flex items-center gap-2">
                    <Bell className="w-4 h-4 flex-shrink-0" />
                    <span>
                        {t('admin.broadcastUpdateButtonDesc')}
                    </span>
                </p>
            </div>
            <div className="space-y-3">
                {updates.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <Activity className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">{t('admin.noUpdatesRecorded')}</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            {t('admin.addUpdateLogs')}
                            {t('admin.criticalUpdatesProminent')}
                        </p>
                    </div>
                ) : (
                    updates.map(update => (
                        <div key={update.version} className="bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white text-sm sm:text-base">الإصدار {update.version}</h4>
                                        {update.critical && (
                                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] sm:text-xs whitespace-nowrap">
                                                حرج
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs sm:text-sm text-white/60 leading-relaxed">{update.changelog}</p>
                                    <p className="text-[10px] sm:text-xs text-white/40 mt-1.5 sm:mt-1">
                                        {new Date(update.releaseDate).toLocaleDateString('ar-SA')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const BroadcastsTab: React.FC<{
    broadcasts: SystemSettings['broadcastMessages'];
    onAddBroadcast: () => void;
}> = ({ broadcasts, onAddBroadcast }) => {
    const { t } = useTranslation();
    return (
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('admin.generalMessages')}</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        {t('admin.sendGeneralMessages')}
                    </p>
                </div>
                <button
                    onClick={onAddBroadcast}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="sm:hidden">{t('admin.addMessage')}</span>
                </button>
            </div>
            <div className="space-y-3">
                {broadcasts.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">{t('admin.noGeneralMessages')}</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            {t('admin.addGeneralMessages')}
                            {t('admin.messagesWillAppear')}
                        </p>
                    </div>
                ) : (
                    broadcasts.map(broadcast => (
                        <div
                            key={broadcast.id}
                            className={`bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border-l-4 ${broadcast.type === 'error' ? 'border-red-500' :
                                    broadcast.type === 'warning' ? 'border-yellow-500' :
                                        broadcast.type === 'success' ? 'border-green-500' :
                                            'border-blue-500'
                                }`}
                        >
                            <h4 className="font-bold text-white text-sm sm:text-base">{broadcast.title}</h4>
                            <p className="text-xs sm:text-sm text-white/60 mt-1 leading-relaxed">{broadcast.message}</p>
                            <p className="text-[10px] sm:text-xs text-white/40 mt-2">
                                {new Date(broadcast.startDate).toLocaleDateString('ar-SA')} - {new Date(broadcast.endDate).toLocaleDateString('ar-SA')}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

const StatusItem: React.FC<{
    label: string;
    value: string;
    icon: React.ElementType;
    color: 'blue' | 'green' | 'yellow' | 'red';
}> = ({ label, value, icon: Icon, color }) => {
    const colorClasses = {
        blue: 'text-blue-500',
        green: 'text-primary-500',
        yellow: 'text-amber-500',
        red: 'text-red-500'
    };

    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${colorClasses[color]} flex-shrink-0`} />
            <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm" style={{ color: 'var(--theme-text-secondary)' }}>{label}</p>
                <p className={`text-base sm:text-lg font-bold ${colorClasses[color]}`}>{value}</p>
            </div>
        </div>
    );
};

// ============================================================
// FIREBASE AUTO-SETUP HELPERS
// ============================================================

/**
 * Get default Firestore Rules for new tenant
 */
function getDefaultFirestoreRules(): string {
    return `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ✅ Allow authenticated users to read/write their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // ✅ Public read-only access for certain collections (adjust as needed)
    match /public/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
    `.trim();
}

/**
 * Get default Firestore Indexes for new tenant
 */
function getDefaultFirestoreIndexes(): string {
    return `
{
  "indexes": [],
  "fieldOverrides": []
}
    `.trim();
}

// ============================================================
// MODALS
// ============================================================

const UpdateModal: React.FC<{
    onClose: () => void;
    onSave: (update: SystemSettings['updates'][0]) => void;
}> = ({ onClose, onSave }) => {
    const [version, setVersion] = useState('');
    const [changelog, setChangelog] = useState('');
    const [critical, setCritical] = useState(false);
    const [required, setRequired] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            version,
            releaseDate: new Date(),
            changelog,
            critical,
            requiredUpdate: required
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass rounded-2xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-white mb-6">{t('admin.addNewUpdate')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder={t('admin.versionPlaceholder') || 'رقم الإصدار (مثال: 3.1.0)'}
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <textarea
                        placeholder={t('admin.changelogPlaceholder') || 'سجل التغييرات'}
                        value={changelog}
                        onChange={(e) => setChangelog(e.target.value)}
                        required
                        rows={4}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400 resize-none"
                    />
                    <label className="flex items-center gap-3 text-white/60">
                        <input
                            type="checkbox"
                            checked={critical}
                            onChange={(e) => setCritical(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span>{t('admin.criticalUpdate')}</span>
                    </label>
                    <label className="flex items-center gap-3 text-white/60">
                        <input
                            type="checkbox"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span>{t('admin.forceUpdate')}</span>
                    </label>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl text-white hover:from-yellow-600 hover:to-yellow-700 transition-all font-medium"
                        >
                            {t('admin.addUpdate')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ✅ Tenant Multi-Select Dropdown Component
const TenantMultiSelect: React.FC<{
    tenants: Array<{ id: string; name: string }>;
    selectedTenants: string[];
    onToggle: (tenantId: string) => void;
    loading: boolean;
}> = ({ tenants, selectedTenants, onToggle, loading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedNames = tenants
        .filter(t => selectedTenants.includes(t.id))
        .map(t => t.name);

    return (
        <div className="space-y-3">
            <div className="relative" ref={containerRef}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 focus:outline-none focus:border-yellow-400 transition-all flex items-center justify-between"
                >
                    <span className="text-sm">
                        {loading ? t('admin.loading') :
                            selectedTenants.length === 0 ? t('common.select') :
                                selectedTenants.length === 1 ? selectedNames[0] :
                                    t('admin.selectedTenantsPlural', { count: selectedTenants.length })}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-2xl max-h-[250px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-4 text-white/60">{t('admin.loading')}</div>
                        ) : tenants.length === 0 ? (
                            <div className="text-center py-4 text-white/60">لا يوجد مستأجرون</div>
                        ) : (
                            <div className="space-y-1">
                                {tenants.map(tenant => (
                                    <label
                                        key={tenant.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTenants.includes(tenant.id)}
                                            onChange={() => onToggle(tenant.id)}
                                            className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                                        />
                                        <span className="text-sm text-white/80 flex-1">{tenant.name}</span>
                                        {selectedTenants.includes(tenant.id) && (
                                            <Check className="w-4 h-4 text-blue-400" />
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {selectedTenants.length > 0 && (
                <div className="text-xs text-white/60 bg-blue-500/10 p-2 rounded-lg">
                    {t('admin.selectedTenantsPlural', { count: selectedTenants.length })}: {selectedNames.join('، ')}
                </div>
            )}
        </div>
    );
};

const BroadcastModal: React.FC<{
    onClose: () => void;
    onSave: (message: SystemSettings['broadcastMessages'][0]) => void;
}> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'info' | 'warning' | 'success' | 'error'>('info');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [targetMode, setTargetMode] = useState<'all' | 'specific'>('all');
    const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
    const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
    const [loadingTenants, setLoadingTenants] = useState(false);

    // Scheduled message options
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduleType, setScheduleType] = useState<'license_expiry'>('license_expiry');
    const [daysBeforeExpiry, setDaysBeforeExpiry] = useState<number>(7);
    const [targetRoles, setTargetRoles] = useState<('manager' | 'employee' | 'staff')[]>(['manager', 'employee', 'staff']);

    // Load tenants when modal opens
    useEffect(() => {
        const loadTenants = async () => {
            setLoadingTenants(true);
            try {
                const managers = await getAllManagers();
                const tenantList = managers
                    .filter(m => m.tenantId)
                    .map(m => ({
                        id: m.tenantId!,
                        name: m.name || `مدير ${m.code || m.id}`
                    }));
                setTenants(tenantList);
            } catch (error) {
                console.error('Error loading tenants:', error);
            } finally {
                setLoadingTenants(false);
            }
        };
        loadTenants();
    }, []);

    const handleTenantToggle = (tenantId: string) => {
        setSelectedTenants(prev =>
            prev.includes(tenantId)
                ? prev.filter(id => id !== tenantId)
                : [...prev, tenantId]
        );
    };

    const handleRoleToggle = (role: 'manager' | 'employee' | 'staff') => {
        setTargetRoles(prev =>
            prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // ✅ Validate dates before submission
        if (!startDate || !endDate) {
            alert(t('admin.selectStartAndEndDate') || 'يرجى تحديد تاريخ البدء وتاريخ الانتهاء');
            return;
        }

        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        // ✅ Check if dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            alert(t('admin.invalidDate') || 'تاريخ غير صالح. يرجى التحقق من تنسيق التاريخ');
            return;
        }

        // ✅ Ensure end date is after start date
        if (parsedEndDate <= parsedStartDate) {
            alert(t('admin.endDateAfterStart') || 'يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء');
            return;
        }

        onSave({
            id: `broadcast-${Date.now()}`,
            title,
            message,
            type,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            targetTenants: targetMode === 'all' ? [] : selectedTenants, // Empty = broadcast to all
            isScheduled: isScheduled,
            scheduleType: isScheduled ? scheduleType : undefined,
            daysBeforeExpiry: isScheduled ? daysBeforeExpiry : undefined,
            targetRoles: isScheduled ? targetRoles : undefined
        });
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                <h3 className="text-xl font-bold text-white mb-6">{t('admin.addGeneralMessage')}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder={t('owner.title')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <textarea
                        placeholder={t('owner.message')}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        required
                        rows={4}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400 resize-none"
                    />
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 transition-all appearance-none cursor-pointer hover:bg-white/10 hover:border-white/20 [&>option]:bg-[#0f172a] [&>option]:text-white"
                    >
                        <option value="info">معلومات</option>
                        <option value="warning">تحذير</option>
                        <option value="success">نجاح</option>
                        <option value="error">خطأ</option>
                    </select>
                    <input
                        type="datetime-local"
                        placeholder={t('common.startDate') || 'تاريخ البدء'}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <input
                        type="datetime-local"
                        placeholder={t('common.endDate') || 'تاريخ الانتهاء'}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />

                    {/* Scheduled Message Option */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isScheduled}
                                onChange={(e) => setIsScheduled(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                            />
                            <span className="text-sm text-white/80">رسالة مجدولة (تظهر قبل انتهاء الترخيص)</span>
                        </label>

                        {isScheduled && (
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                                <div>
                                    <label className="text-sm text-white/80 mb-2 block">عدد الأيام قبل انتهاء الترخيص</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={daysBeforeExpiry}
                                        onChange={(e) => setDaysBeforeExpiry(parseInt(e.target.value) || 7)}
                                        className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-yellow-400"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm text-white/80 mb-2 block">الأدوار المستهدفة</label>
                                    <div className="flex flex-wrap gap-2">
                                        {(['manager', 'employee', 'staff'] as const).map(role => (
                                            <label key={role} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={targetRoles.includes(role)}
                                                    onChange={() => handleRoleToggle(role)}
                                                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500"
                                                />
                                                <span className="text-xs text-white/80">
                                                    {role === 'manager' ? t('owner.subscribers') : t('owner.employees')}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-xs text-white/60 bg-blue-500/10 p-2 rounded-lg">
                                    💡 هذه الرسالة ستظهر تلقائياً قبل انتهاء الترخيص بعدد الأيام المحدد لجميع المستأجرين المحددين
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Target Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-white/80">الوجهة</label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setTargetMode('all')}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${targetMode === 'all'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                جميع المستأجرين
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetMode('specific')}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${targetMode === 'specific'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                مستأجرين محددين
                            </button>
                        </div>

                        {targetMode === 'specific' && (
                            <TenantMultiSelect
                                tenants={tenants}
                                selectedTenants={selectedTenants}
                                onToggle={handleTenantToggle}
                                loading={loadingTenants}
                            />
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
                        >
                            {t('admin.addUpdate')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ✅ Add Manager Modal - Multi-Step Wizard
const AddManagerModal: React.FC<{
    systemSettings: SystemSettings | null;
    onClose: () => void;
    onSuccess: () => void;
}> = ({ systemSettings, onClose, onSuccess }) => {
    const { t } = useTranslation();
    // ✅ Wizard Step State
    const [currentStep, setCurrentStep] = useState(1);
    const TOTAL_STEPS = 4;

    // ✅ Step 1: Basic Info
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [phoneBackup, setPhoneBackup] = useState(''); // ✅ رقم الهاتف الاحتياطي
    const [code, setCode] = useState('');
    const [hotelName, setHotelName] = useState('');

    // ✅ Step 2: Branches
    const [branchCodes, setBranchCodes] = useState<Array<{ code: string; name: string }>>([]);
    const [currentBranchCode, setCurrentBranchCode] = useState('');
    const [currentBranchName, setCurrentBranchName] = useState('');

    // ✅ Step 3: Subscription & Payment
    const [subscriptionDuration, setSubscriptionDuration] = useState<1 | 2>(1);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'bank_transfer' | 'deferred'>('cash');

    // ✅ Firebase Config for Isolated Tenant Database (SaaS)
    const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>({
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: ''
    });
    const [firebaseTestPassed, setFirebaseTestPassed] = useState(false);
    const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);

    // ✅ General State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, authReady } = useAuth();
    const { success: showSuccess, error: showError } = useUX();
    const [conflictingCodes, setConflictingCodes] = useState<Set<string>>(new Set());
    const [checkingCodes, setCheckingCodes] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);

    // ✅ Wizard Navigation
    const canGoNext = () => {
        switch (currentStep) {
            case 1: // Basic Info - اسم المشترك إجباري
                return name.trim().length >= 2 && phone.length >= 9 && code.length === 4 && /^\d+$/.test(code) && !conflictingCodes.has(code);
            case 2: // Branches
                return branchCodes.length > 0;
            case 3: // Subscription & Firebase (إجباري)
                // ✅ Firebase Config is now REQUIRED
                return firebaseConfig.apiKey.trim().length > 0 && 
                       firebaseConfig.projectId.trim().length > 0 && 
                       firebaseConfig.authDomain.trim().length > 0 &&
                       firebaseConfig.storageBucket.trim().length > 0;
            case 4: // Review
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (currentStep < TOTAL_STEPS && canGoNext()) {
            setError('');
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setError('');
            setCurrentStep(prev => prev - 1);
        }
    };

    // Step Titles
    const stepTitles = {
        1: t('admin.basicData'),
        2: t('sidebar.branches'),
        3: t('admin.subscriptionAndPayment'),
        4: t('admin.reviewAndSave')
    };

    const handleCodeChange = async (newCode: string) => {
        setCode(newCode);
        setError('');
        if (newCode.length === 4) {
            setCheckingCodes(true);
            try {
                const available = await isPinAvailable(newCode, { authReady, user: user as any });
                if (!available) {
                    setConflictingCodes(prev => new Set(prev).add(newCode));
                    setError(`تحذير: الكود ${newCode} مستخدم بالفعل في النظام.`);
                } else {
                    setConflictingCodes(prev => {
                        const next = new Set(prev);
                        next.delete(newCode);
                        return next;
                    });
                }
            } catch (err) {
                console.warn('Silent PIN check failed:', err);
            } finally {
                setCheckingCodes(false);
            }
        }
    };

    // ✅ Generate unique manager code (4 digits)
    const handleGenerateCode = async () => {
        setGeneratingCode(true);
        setError('');
        try {
            const newCode = await suggestUniquePin();
            await handleCodeChange(newCode);
        } catch (err: any) {
            setError(err.message || 'فشل توليد الكود. حاول مرة أخرى.');
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleAddBranch = async () => {
        console.log('🔵 handleAddBranch called', { currentBranchCode, currentBranchName, authReady, user: user?.email });

        if (!currentBranchCode.trim() || !currentBranchName.trim()) {
            console.log('🔴 Empty branch code or name');
            return;
        }
        const bCode = currentBranchCode.trim();

        // ✅ التحقق من كود الفرع:
        // 1. أرقام فقط (بدون حروف)
        // 2. من 1 إلى 4 أرقام
        // 3. لا يبدأ بـ 0
        if (!/^[1-9]\d{0,3}$/.test(bCode)) {
            console.log('🔴 Invalid branch code format:', bCode);
            setError('كود الفرع يجب أن يكون من 1 إلى 4 أرقام، بدون حروف، ولا يبدأ بصفر');
            return;
        }
        if (branchCodes.some(b => b.code === bCode)) {
            console.log('🔴 Branch code already exists in list');
            setError('كود الفرع موجود بالفعل في قائمتك');
            return;
        }
        if (bCode === code) {
            console.log('🔴 Branch code same as manager code');
            setError('كود الفرع يجب أن يختلف عن كود المدير الرئيسي');
            return;
        }

        console.log('🟢 Validation passed, checking PIN availability...');
        setLoading(true);
        setCheckingCodes(true);
        try {
            const available = await isPinAvailable(bCode, { authReady, user: user as any });
            console.log('🟢 PIN availability result:', available);
            if (!available) {
                setError(`تحذير: كود الفرع ${bCode} مستخدم بالفعل في مؤسسة أخرى.`);
                setConflictingCodes(prev => new Set(prev).add(bCode));
                setLoading(false);
                setCheckingCodes(false);
                return;
            }
            console.log('✅ Adding branch to list...');
            setBranchCodes([...branchCodes, { code: bCode, name: currentBranchName.trim() }]);
            setCurrentBranchCode('');
            setCurrentBranchName('');
            setError('');
            setConflictingCodes(prev => {
                const next = new Set(prev);
                next.delete(bCode);
                return next;
            });
            console.log('✅ Branch added successfully!');
        } catch (err: any) {
            console.error('🔴 Branch PIN check error:', err);
            setError('حدث خطأ أثناء التحقق من كود الفرع. حاول مرة أخرى.');
        } finally {
            setLoading(false);
            setCheckingCodes(false);
        }
    };

    const handleRemoveBranch = (codeToRemove: string) => {
        setBranchCodes(branchCodes.filter(c => c.code !== codeToRemove));
        setConflictingCodes(prev => {
            const next = new Set(prev);
            next.delete(codeToRemove);
            return next;
        });
    };

    const handleSubmit = async () => {
        // ✅ التحقق من رقم الهاتف (إجباري)
        if (!phone || phone.length < 9) {
            setError('رقم هاتف المدير مطلوب (9 أرقام على الأقل)');
            return;
        }
        if (code.length !== 4 || !/^\d+$/.test(code)) {
            setError(t('admin.managerCodeMustBe4Digits'));
            return;
        }
        if (branchCodes.length === 0) {
            setError(t('admin.mustAddOneBranch'));
            return;
        }
        if (conflictingCodes.has(code)) {
            setError('كود المدير مستخدم بالفعل. يرجى اختيار كود آخر.');
            return;
        }
        if (!authReady || !user) {
            setError('النظام غير جاهز (Auth Not Ready)');
            return;
        }
        setLoading(true);
        try {
            const masterAvailable = await isPinAvailable(code, { authReady, user: user as any });
            if (!masterAvailable) {
                setError('كود المدير مستخدم بالفعل');
                setLoading(false);
                return;
            }
            for (const b of branchCodes) {
                const bAvailable = await isPinAvailable(b.code, { authReady, user: user as any });
                if (!bAvailable) {
                    setError(`كود الفرع ${b.code} (${b.name}) أصبح مستخدماً الآن من شخص آخر.`);
                    setLoading(false);
                    return;
                }
            }
            const branchNamesMap: Record<string, string> = {};
            branchCodes.forEach(b => {
                branchNamesMap[b.code] = b.name;
            });

            // ✅ Firebase Config is now REQUIRED
            if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain || !firebaseConfig.storageBucket) {
                setError('يجب إدخال جميع بيانات Firebase المطلوبة (apiKey, projectId, authDomain, storageBucket)');
                setLoading(false);
                return;
            }

            // ✅ Build clean firebaseConfig object without undefined values
            const cleanFirebaseConfig: Record<string, string> = {
                apiKey: firebaseConfig.apiKey.trim(),
                authDomain: firebaseConfig.authDomain.trim(),
                projectId: firebaseConfig.projectId.trim(),
                storageBucket: firebaseConfig.storageBucket.trim(),
            };
            // Only add optional fields if they have actual values
            if (firebaseConfig.messagingSenderId?.trim()) {
                cleanFirebaseConfig.messagingSenderId = firebaseConfig.messagingSenderId.trim();
            }
            if (firebaseConfig.appId?.trim()) {
                cleanFirebaseConfig.appId = firebaseConfig.appId.trim();
            }
            
            // ✅ Get Service Account JSON if provided (for auto-setup)
            const serviceAccountJson = (firebaseConfig as any).serviceAccountJson;

            // ✅ NEW: Use Cloud Function for manager creation (100% reliable, no Rules issues)
            let managerResult: { managerId?: string; tenantId?: string; warnings?: string[] } | null = null;
            
            try {
                const { functions, httpsCallable } = await import('../../services/firebase');
                if (functions) {
                    const createManagerFunction = httpsCallable(functions, 'createManager');
                    const result = await createManagerFunction({
                        name: name.trim() || 'مدير جديد',
                        phone: phone.trim(),
                        phoneBackup: phoneBackup.trim() || undefined,
                        code,
                        hotelName: hotelName.trim() || undefined,
                        maxBranches: branchCodes.length,
                        branchCodes: branchCodes.map(b => b.code),
                        branchNames: branchNamesMap,
                        subscriptionDuration: subscriptionDuration,
                        paymentMethod: paymentMethod,
                        firebaseConfig: cleanFirebaseConfig,
                    });
                    
                    const response = result.data as any;
                    if (response.success) {
                        managerResult = {
                            managerId: response.managerId,
                            tenantId: response.tenantId
                        };
                        // ✅ SUCCESS - Everything is automatic!
                        showSuccess(response.message || `✅ تم إنشاء المدير "${name}" بنجاح!\n\n📋 الكود: ${code}\n✅ جاهز للاستخدام تلقائياً!`);
                    } else {
                        throw new Error(response.error || 'فشل إنشاء المدير');
                    }
                } else {
                    throw new Error('Cloud Functions غير متاحة - استخدام طريقة بديلة');
                }
            } catch (functionError: any) {
                // ✅ Fallback: Use client-side createManager (if Functions not available)
                console.warn('Cloud Function failed, using fallback:', functionError);
                showError(`⚠️ Cloud Function غير متاحة - استخدام طريقة بديلة...`);
                
                const fallbackResult = await createManager({
                    name: name.trim() || 'مدير جديد',
                    phone: phone.trim(),
                    phoneBackup: phoneBackup.trim() || undefined,
                    code,
                    hotelName: hotelName.trim() || undefined,
                    maxBranches: branchCodes.length,
                    branchCodes: branchCodes.map(b => b.code),
                    branchNames: branchNamesMap,
                    subscriptionDuration: subscriptionDuration,
                    paymentMethod: paymentMethod,
                    firebaseConfig: cleanFirebaseConfig,
                });
                
                managerResult = fallbackResult;
                
                // Show warnings only for fallback method
                if (fallbackResult.warnings && fallbackResult.warnings.length > 0) {
                    fallbackResult.warnings.forEach((warning) => {
                        showError(warning);
                    });
                } else {
                    showSuccess(`✅ تم إنشاء المدير "${name}" بنجاح!\n📋 الكود: ${code}`);
                }
            }

            // ✅ Auto-setup Firebase (Authentication, Firestore Rules, Storage, Anonymous Auth) if Service Account provided
            if (serviceAccountJson && managerResult?.tenantId) {
                try {
                    // Import Firebase Functions
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const functions = getFunctions();
                    const deployTenantFirebase = httpsCallable(functions, 'deployTenantFirebase');
                    
                    // Call deployment function with timeout
                    const deployPromise = deployTenantFirebase({
                        tenantId: managerResult?.tenantId || '',
                        serviceAccountJson: serviceAccountJson,
                        firestoreRules: getDefaultFirestoreRules(),
                        firestoreIndexes: getDefaultFirestoreIndexes(),
                    });
                    
                    // Add timeout (60 seconds)
                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('انتهت مهلة الإعداد التلقائي (60 ثانية)')), 60000)
                    );
                    
                    const deployResult = await Promise.race([deployPromise, timeoutPromise]) as any;
                    const result = deployResult.data as any;
                    
                    if (result && result.success) {
                        showSuccess('✅ تم إعداد Firebase تلقائياً بنجاح! (Authentication, Firestore Rules, Storage)');
                    } else {
                        const errorMsg = result?.message || 'خطأ غير معروف';
                        console.warn('Firebase auto-setup partial failure:', errorMsg);
                        showError(`⚠️ تم إنشاء المدير بنجاح، لكن فشل الإعداد التلقائي: ${errorMsg}. يمكنك إعداد Firebase يدوياً من Firebase Console.`);
                    }
                } catch (setupError: any) {
                    console.error('Firebase auto-setup error:', setupError);
                    const errorMessage = setupError.message || setupError.code || 'خطأ غير معروف';
                    // Don't fail manager creation - it's already created successfully
                    showError(`⚠️ تم إنشاء المدير بنجاح، لكن فشل الإعداد التلقائي لـ Firebase: ${errorMessage}. يمكنك إعداد Firebase يدوياً من Firebase Console.`);
                }
            } else if (!serviceAccountJson) {
                // If no Service Account provided, show info message
                showSuccess('✅ تم إنشاء المدير بنجاح! ملاحظة: لم يتم إدخال Service Account، يمكنك إعداد Firebase يدوياً من Firebase Console.');
            }

            // ✅ Financial documents are created automatically in createManager (Single Source of Truth)
            showSuccess(t('admin.addManagerSuccess'));

            onSuccess();
        } catch (err: any) {
            setError(err.message || t('admin.addError'));
            showError(err.message || t('admin.addManagerError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
            {/* Main Card - محسّن: ارتفاع ديناميكي بدون مساحة بيضاء فارغة */}
            <div className="glass-card relative w-full max-w-lg flex flex-col rounded-2xl overflow-hidden !p-0" style={{ maxHeight: '90vh' }}>

                {/* Header - مضموم */}
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-theme flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>{t('admin.addNewManager')}</h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{stepTitles[currentStep as keyof typeof stepTitles]}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors" style={{ color: 'var(--theme-text-secondary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Step Progress - مضموم */}
                <div className="px-4 py-2 flex gap-1.5 border-b border-theme flex-shrink-0">
                    {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex-1">
                            <div className={`h-1.5 rounded-full mb-1 ${step < currentStep ? 'bg-teal-500' :
                                    step === currentStep ? 'bg-yellow-500' :
                                        'bg-gray-300 dark:bg-white/10'
                                }`} />
                            <span className="text-[9px] block text-center" style={{ color: step <= currentStep ? 'var(--theme-text-primary)' : 'var(--theme-text-disabled)' }}>
                                {step === 1 ? t('owner.stepBasic') : step === 2 ? t('owner.stepBranches') : step === 3 ? t('owner.stepSubscription') : t('owner.stepReview')}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Step Content - محسّن: محتوى مضموم بدون مساحة فارغة */}
                <div className="p-4 overflow-y-auto flex-1 min-h-0">
                    {/* ==================== STEP 1: Basic Info ==================== */}
                    {currentStep === 1 && (
                        <div className="space-y-3">
                            {/* الصف الأول: اسم المشترك + اسم الفندق */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <Users className="w-3.5 h-3.5 text-teal-500" />اسم المشترك <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="input py-2 text-sm" placeholder={t('owner.exampleName') || 'أيمن أبو ورده'} required />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <Building className="w-3.5 h-3.5 text-purple-500" />اسم الفندق/البراند
                                    </label>
                                    <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} className="input py-2 text-sm" placeholder="سلسلة فنادق الأهرام" />
                                </div>
                            </div>

                            {/* Phone Numbers - Grid Layout */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {/* Primary Phone */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-3.5 h-3.5 text-green-500" />رقم الهاتف <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} className="input py-2 text-sm text-left" placeholder="05xxxxxxxx" dir="ltr" required />
                                        {phone.length >= 9 && <div className="absolute left-2 top-1/2 -translate-y-1/2"><CheckCircle className="w-4 h-4 text-green-500" /></div>}
                                    </div>
                                </div>
                                {/* Backup Phone */}
                                <div>
                                    <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-3.5 h-3.5 text-blue-400" />هاتف احتياطي <span className="text-[10px] opacity-70">(اختياري)</span>
                                    </label>
                                    <div className="relative">
                                        <input type="tel" value={phoneBackup} onChange={e => setPhoneBackup(e.target.value.replace(/[^0-9+]/g, ''))} className="input py-2 text-sm text-left" placeholder="05xxxxxxxx" dir="ltr" />
                                        {phoneBackup.length >= 9 && <div className="absolute left-2 top-1/2 -translate-y-1/2"><CheckCircle className="w-4 h-4 text-blue-400" /></div>}
                                    </div>
                                </div>
                            </div>

                            {/* Manager Code */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Shield className="w-3.5 h-3.5 text-yellow-500" />كود المدير <span className="text-red-500">*</span> <span className="opacity-70">(4 أرقام)</span>
                                </label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={e => handleCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                            className={`input py-2 text-center text-xl font-mono tracking-[0.3em] ${conflictingCodes.has(code) ? '!border-red-500 !bg-red-500/10' : code.length === 4 ? '!border-green-500 !bg-green-500/10' : ''}`}
                                            placeholder="• • • •"
                                            maxLength={4}
                                        />
                                        {checkingCodes && <div className="absolute left-2 top-1/2 -translate-y-1/2"><AdoraLoaderInline size={16} /></div>}
                                        {!checkingCodes && code.length === 4 && !conflictingCodes.has(code) && <div className="absolute left-2 top-1/2 -translate-y-1/2"><CheckCircle className="w-4 h-4 text-green-500" /></div>}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleGenerateCode}
                                        disabled={generatingCode}
                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        title={t('admin.generateRandomCode') || 'توليد كود عشوائي فريد (4 أرقام)'}
                                    >
                                        {generatingCode ? (
                                            <AdoraLoaderInline size={16} />
                                        ) : (
                                            <>
                                                <RefreshCw className="w-4 h-4" />
                                                توليد
                                            </>
                                        )}
                                    </button>
                                </div>
                                {error && (error.includes(code) || error.includes('المدير')) && (
                                    <div className="mt-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                        <p className="text-xs flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 2: Branches ==================== */}
                    {currentStep === 2 && (
                        <div className="space-y-3">
                            <div className="p-2 rounded-lg flex items-center gap-2 bg-blue-500/10 border border-blue-500/30">
                                <Building className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>كل فرع: <strong>كود رقمي فريد</strong> 1–4 أرقام.</p>
                            </div>
                            <div className="glass rounded-xl p-3">
                                <label className="flex items-center gap-1.5 text-xs mb-2" style={{ color: 'var(--theme-text-secondary)' }}><Plus className="w-3.5 h-3.5 text-teal-500" />{t('admin.addUpdate')} فرع</label>
                                <div className="flex gap-2">
                                    <input type="text" value={currentBranchCode} onChange={e => { let v=e.target.value.replace(/\D/g,''); if(v.startsWith('0'))v=v.slice(1); setCurrentBranchCode(v.slice(0,4)); }} maxLength={4} className={`input py-2 w-16 text-center font-mono text-sm ${conflictingCodes.has(currentBranchCode)?'!border-red-500':''}`} placeholder="كود" />
                                    <input type="text" value={currentBranchName} onChange={e=>setCurrentBranchName(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleAddBranch()} className="input py-2 flex-1 text-sm" placeholder="اسم الفرع" />
                                    <button type="button" onClick={handleAddBranch} disabled={loading||!currentBranchCode.trim()||!currentBranchName.trim()} className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-40 bg-teal-500 hover:bg-teal-600 flex items-center gap-1.5"><Plus className="w-4 h-4" />إضافة</button>
                                </div>
                                {error && (error.includes('كود الفرع')||error.includes('مستخدم')||error.includes('الفرع')) && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                            </div>
                            <div>
                                <label className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Building2 className="w-3.5 h-3.5 text-purple-500" />الفروع المضافة {branchCodes.length>0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600">{branchCodes.length}</span>}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {branchCodes.length > 0 ? branchCodes.map((b, i) => (
                                        <div key={b.code} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                            <span className="w-5 h-5 rounded text-white text-[10px] flex items-center justify-center font-bold bg-teal-500">{i+1}</span>
                                            <span className="text-xs font-medium" style={{ color: 'var(--theme-text-primary)' }}>{b.name}</span><span className="text-[10px] font-mono opacity-70">{b.code}</span>
                                            <button type="button" onClick={()=>handleRemoveBranch(b.code)} className="w-5 h-5 rounded flex items-center justify-center text-red-500 hover:bg-red-500/10"><X className="w-3 h-3" /></button>
                                        </div>
                                    )) : (
                                        <div className="w-full text-center py-4 rounded-xl glass border-2 border-dashed">
                                            <Building className="w-6 h-6 mx-auto mb-1 opacity-50" style={{ color: 'var(--theme-text-disabled)' }} />
                                            <p className="text-xs" style={{ color: 'var(--theme-text-disabled)' }}>لا توجد فروع</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 3: Subscription & Payment ==================== */}
                    {currentStep === 3 && (
                        <div className="space-y-3">
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><CreditCard className="w-3.5 h-3.5 text-green-500" />{t('billing.vouchers.paymentMethod')}</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {[{ value: 'cash', label: t('billing.paymentMethods.cash'), icon: '💵' }, { value: 'credit', label: t('billing.paymentMethods.credit'), icon: '💳' }, { value: 'bank_transfer', label: t('billing.paymentMethods.bankTransfer'), icon: '🏦' }, { value: 'deferred', label: t('billing.paymentMethods.deferred'), icon: '⏳' }].map((m) => (
                                        <button key={m.value} type="button" onClick={() => setPaymentMethod(m.value as any)} className={`py-2 rounded-lg text-xs font-medium flex flex-col items-center gap-0.5 border ${paymentMethod === m.value ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}><span>{m.icon}</span><span>{m.label}</span></button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}><Calendar className="w-3.5 h-3.5 text-yellow-500" />{t('owner.subscriptionDuration')}</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setSubscriptionDuration(1)} className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border text-sm ${subscriptionDuration === 1 ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}>📅 سنة</button>
                                    <button type="button" onClick={() => setSubscriptionDuration(2)} className={`py-2.5 rounded-xl flex items-center justify-center gap-2 border text-sm relative ${subscriptionDuration === 2 ? 'border-yellow-500 bg-yellow-500/10' : 'border-theme glass'}`} style={{ color: 'var(--theme-text-primary)' }}><span className="absolute top-0.5 left-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500 text-white">توفير</span>📅📅 سنتين</button>
                                </div>
                            </div>
                            {systemSettings && (() => {
                                const pricePerBranch = systemSettings.defaultSubscriptionPrice || 0;
                                const numberOfBranches = branchCodes.length;
                                const taxRate = (systemSettings.defaultTaxRate || 15) / 100;
                                
                                // ✅ Calculate base amount (same logic as ownerService.ts)
                                // pricePerBranch is already including tax
                                const baseAmount = pricePerBranch * subscriptionDuration * numberOfBranches;
                                
                                // ✅ Apply 2-year discount if applicable
                                let discountAmount = 0;
                                let discountRate = 0;
                                if (subscriptionDuration === 2 && systemSettings.twoYearDiscountRate) {
                                    discountRate = systemSettings.twoYearDiscountRate;
                                    discountAmount = (baseAmount * discountRate) / 100;
                                }
                                
                                // ✅ Final total after discount (same as ownerService.ts: totalAmount = baseAmount - discountAmount)
                                const finalTotal = baseAmount - discountAmount;
                                
                                // ✅ Extract tax breakdown for display (pricePerBranch includes tax, so we reverse calculate)
                                // If pricePerBranch includes tax: priceBeforeTax = pricePerBranch / (1 + taxRate)
                                const priceBeforeTaxPerBranch = pricePerBranch / (1 + taxRate);
                                const baseAmountBeforeTax = priceBeforeTaxPerBranch * subscriptionDuration * numberOfBranches;
                                const discountAmountBeforeTax = discountAmount / (1 + taxRate);
                                const amountAfterDiscountBeforeTax = baseAmountBeforeTax - discountAmountBeforeTax;
                                const taxAmount = finalTotal - amountAfterDiscountBeforeTax;
                                
                                return (
                                    <div className="glass rounded-xl p-3 space-y-2">
                                        {/* Basic Info */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>الفرع / سنة:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{pricePerBranch.toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Subscription Duration Info */}
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{t('owner.numberOfBranches')}:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{numberOfBranches} {numberOfBranches === 1 ? t('admin.branch') : t('admin.branches')}</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{t('owner.subscriptionDuration')}:</span>
                                            <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{subscriptionDuration === 1 ? t('billing.subscription.oneYearFull') : t('billing.subscription.twoYearsFull')}</span>
                                        </div>
                                        
                                        {/* Original Price (2 years) */}
                                        {subscriptionDuration === 2 && (
                                            <div className="flex justify-between items-center text-xs pt-1 border-t border-white/10">
                                                <span style={{ color: 'var(--theme-text-secondary)' }}>السعر الأصلي ({subscriptionDuration} سنوات):</span>
                                                <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{baseAmount.toLocaleString()} ر.س</span>
                                            </div>
                                        )}
                                        
                                        {/* Discount Info (only if 2 years and discount exists) */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <>
                                                <div className="flex justify-between items-center text-xs bg-primary-500/10 rounded-lg p-2 border border-primary-500/30">
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="text-[10px]">✨</span>
                                                        <span style={{ color: 'var(--theme-text-secondary)' }}>خصم {discountRate}%:</span>
                                                    </span>
                                                    <span className="font-bold text-red-400">-{Math.round(discountAmount).toLocaleString()} ر.س</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-xs">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>السعر بعد الخصم (قبل الضريبة):</span>
                                                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{Math.round(amountAfterDiscountBeforeTax).toLocaleString()} ر.س</span>
                                                </div>
                                                
                                                <div className="flex justify-between items-center text-xs">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>قيمة الضريبة ({systemSettings.defaultTaxRate || 15}%):</span>
                                                    <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </div>
                                            </>
                                        )}
                                        
                                        {/* Final Total */}
                                        <div className="flex justify-between items-center text-sm pt-2 border-t-2 border-primary-500/30 mt-1">
                                            <span className="font-semibold" style={{ color: 'var(--theme-text-primary)' }}>الإجمالي النهائي:</span>
                                            <span className="font-bold text-primary-500">{Math.round(finalTotal).toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Info Message for 2-year discount */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <div className="mt-2 p-2 rounded-lg bg-primary-500/10 border border-primary-500/30">
                                                <p className="text-[10px] flex items-center gap-1.5 text-primary-500">
                                                    <span>ℹ️</span>
                                                    <span>سيتم تطبيق خصم {discountRate}% تلقائياً عند الحفظ</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {/* ✅ Firebase Config - REQUIRED with Step-by-Step Guide */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                                        <Server className="w-3.5 h-3.5 text-primary-500" />
                                        إعدادات Firebase <span className="text-red-500">*</span> <span className="text-[10px] font-normal opacity-70">(إجباري)</span>
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowFirebaseConfig(s => !s)} 
                                        className="text-[10px] px-2 py-1 rounded-lg border border-primary-500/30 bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors"
                                    >
                                        {showFirebaseConfig ? '▲ إخفاء' : '▼ عرض'}
                                    </button>
                                </div>
                                
                                {/* Step-by-Step Guide */}
                                {!showFirebaseConfig && (
                                    <div className="glass rounded-xl p-3 space-y-2 border-2 border-primary-500/30 bg-primary-500/5">
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">1️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>افتح Firebase Console</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    اذهب إلى <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary-500 underline">console.firebase.google.com</a> وأنشئ مشروع جديد
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">2️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>احصل على Firebase Config</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    Project Settings → General → Your apps → Web app → Copy config
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="text-primary-500 font-bold text-xs mt-0.5">3️⃣</span>
                                            <div className="flex-1">
                                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--theme-text-primary)' }}>احصل على Service Account Key</p>
                                                <p className="text-[10px] opacity-80" style={{ color: 'var(--theme-text-secondary)' }}>
                                                    Project Settings → Service Accounts → Generate new private key → Download JSON
                                                </p>
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-primary-500/20">
                                            <p className="text-[10px] text-primary-500 flex items-center gap-1.5">
                                                <Info className="w-3 h-3" />
                                                <span>سيقوم النظام بإعداد Authentication و Firestore Rules و Storage تلقائياً</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                                
                                {showFirebaseConfig && (
                                    <div className="space-y-3">
                                        <TenantFirebaseConfig 
                                            config={firebaseConfig} 
                                            onChange={setFirebaseConfig} 
                                            disabled={loading} 
                                            compact={true} 
                                            showTestButton={true}
                                            showServiceAccount={true}
                                            onTestResult={(s) => setFirebaseTestPassed(s)} 
                                        />
                                        
                                        {/* Validation Message */}
                                        {(!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.authDomain || !firebaseConfig.storageBucket) && (
                                            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                                <p className="text-[10px] text-red-400 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    <span>يجب إدخال جميع الحقول المطلوبة: apiKey, projectId, authDomain, storageBucket</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ==================== STEP 4: Review & Save ==================== */}
                    {currentStep === 4 && (
                        <div className="space-y-3">
                            <div className="p-2 rounded-lg flex items-center gap-2 bg-green-500/10 border border-green-500/30">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }} dangerouslySetInnerHTML={{ __html: t('admin.reviewDataBeforeFinalSave') }} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="glass rounded-xl p-2">
                                    <h4 className="text-[10px] font-bold mb-1 text-teal-500">{t('admin.basicData')}</h4>
                                    <div className="grid grid-cols-1 gap-0.5 text-xs"><span style={{ color: 'var(--theme-text-primary)' }}>{name || '-'}</span><span dir="ltr" style={{ color: 'var(--theme-text-primary)' }}>{phone}</span><span className="font-mono text-teal-500">{code}</span></div>
                                </div>
                                <div className="glass rounded-xl p-2">
                                    <h4 className="text-[10px] font-bold mb-1 text-purple-500">الفروع ({branchCodes.length})</h4>
                                    <div className="flex flex-wrap gap-1">{branchCodes.map((b,i)=><span key={b.code} className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 border border-teal-500/20">{b.name}</span>)}</div>
                                </div>
                            </div>
                            {systemSettings && (() => {
                                const pricePerBranch = systemSettings.defaultSubscriptionPrice || 0;
                                const numberOfBranches = branchCodes.length;
                                const taxRate = (systemSettings.defaultTaxRate || 15) / 100;
                                
                                // ✅ Calculate base amount (same logic as ownerService.ts)
                                // pricePerBranch is already including tax
                                const baseAmount = pricePerBranch * subscriptionDuration * numberOfBranches;
                                
                                // ✅ Apply 2-year discount if applicable
                                let discountAmount = 0;
                                let discountRate = 0;
                                if (subscriptionDuration === 2 && systemSettings.twoYearDiscountRate) {
                                    discountRate = systemSettings.twoYearDiscountRate;
                                    discountAmount = (baseAmount * discountRate) / 100;
                                }
                                
                                // ✅ Final total after discount (same as ownerService.ts: totalAmount = baseAmount - discountAmount)
                                const finalTotal = baseAmount - discountAmount;
                                
                                // ✅ Extract tax breakdown for display (pricePerBranch includes tax, so we reverse calculate)
                                const priceBeforeTaxPerBranch = pricePerBranch / (1 + taxRate);
                                const baseAmountBeforeTax = priceBeforeTaxPerBranch * subscriptionDuration * numberOfBranches;
                                const discountAmountBeforeTax = discountAmount / (1 + taxRate);
                                const amountAfterDiscountBeforeTax = baseAmountBeforeTax - discountAmountBeforeTax;
                                const taxAmount = finalTotal - amountAfterDiscountBeforeTax;
                                
                                return (
                                    <div className="glass rounded-xl p-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs">
                                            <span style={{ color: 'var(--theme-text-secondary)' }}>{subscriptionDuration===1 ? t('billing.subscription.oneYear') : t('billing.subscription.twoYears')} • {paymentMethod==='cash' ? t('billing.paymentMethods.cash') : paymentMethod==='credit' ? t('billing.paymentMethods.credit') : paymentMethod==='bank_transfer' ? t('billing.paymentMethods.bankTransfer') : t('billing.paymentMethods.deferred')}</span>
                                            <span className="font-bold text-primary-500">{Math.round(finalTotal).toLocaleString()} ر.س</span>
                                        </div>
                                        
                                        {/* Show discount details if applicable */}
                                        {subscriptionDuration === 2 && discountAmount > 0 && (
                                            <div className="pt-2 border-t border-white/10 space-y-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>السعر الأصلي:</span>
                                                    <span style={{ color: 'var(--theme-text-primary)' }}>{baseAmount.toLocaleString()} ر.س</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>خصم {discountRate}%:</span>
                                                    <span className="text-red-400">-{Math.round(discountAmount).toLocaleString()} ر.س</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span style={{ color: 'var(--theme-text-secondary)' }}>قيمة الضريبة ({systemSettings.defaultTaxRate || 15}%):</span>
                                                    <span style={{ color: 'var(--theme-text-primary)' }}>{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {firebaseConfig.apiKey && <div className="text-[10px] flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Firebase منفصل</div>}
                            {error && <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30"><p className="text-xs flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{error}</p></div>}
                        </div>
                    )}
                </div>

                {/* Footer - مضموم */}
                <div className="px-4 py-2.5 border-t border-theme flex-shrink-0">
                    <div className="flex gap-2">
                        {currentStep > 1 && (
                            <button type="button" onClick={handleBack} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 glass border border-theme" style={{ color: 'var(--theme-text-primary)' }}>
                                <ChevronRight className="w-4 h-4 rotate-180" />رجوع
                            </button>
                        )}
                        {currentStep < TOTAL_STEPS ? (
                            <button type="button" onClick={handleNext} disabled={!canGoNext()} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 bg-teal-500 hover:bg-teal-600 text-white">
                                التالي<ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 bg-teal-500 hover:bg-teal-600 text-white">
                                {loading ? <AdoraLoaderInline size={18} /> : <><Save className="w-4 h-4" />{t('admin.saveAndCreate')}</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Manager Details Modal Component - ✅ Enhanced for Light Mode + Print
const ManagerDetailsModal: React.FC<{
    tenant: TenantAnalytics;
    managerDetails: any;
    loading: boolean;
    onClose: () => void;
}> = ({ tenant, managerDetails, loading, onClose }) => {
    const { t } = useTranslation();
    const [activeBranchTab, setActiveBranchTab] = useState<string | null>(
        managerDetails.branches.length > 0 ? managerDetails.branches[0].id : null
    );

    const activeBranch = managerDetails.branches.find((b: any) => b.id === activeBranchTab);

    const featureLabels: Record<string, string> = {
        qrCodeGuestPortal: 'بوابة النزيل (QR)',
        pointsSystem: 'نظام النقاط',
        gamification: 'الشارات والرتب',
        shiftNotes: 'ملاحظات الشيفت',
        scheduledTasks: 'المهام المجدولة',
        aiAssistant: 'المساعد الذكي',
        calendarSync: 'مزامنة التقويم',
        inventoryManagement: 'إدارة المخزون',
        procurementSystem: 'نظام المشتريات',
        laundryManagement: 'إدارة المغسلة',
        whatsappIntegration: 'تكامل واتساب',
        emailNotifications: 'إشعارات البريد',
        smsNotifications: 'إشعارات SMS'
    };

    const createdAt = managerDetails.createdAt?.toDate
        ? managerDetails.createdAt.toDate()
        : managerDetails.createdAt instanceof Timestamp
            ? managerDetails.createdAt.toDate()
            : new Date(managerDetails.createdAt || Date.now());

    // ✅ Print subscription report
    const handlePrint = () => {
        const printContent = document.getElementById('subscription-report-content');
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تقرير اشتراك - ${tenant.tenantName}</title>
                <style>
                    * { font-family: 'Segoe UI', Tahoma, sans-serif; box-sizing: border-box; }
                    body { padding: 40px; background: white; color: #1e293b; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 3px solid #0d9488; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { color: #0d9488; margin: 0 0 10px 0; font-size: 28px; }
                    .header p { color: #64748b; margin: 5px 0; }
                    .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
                    .section h3 { color: #0d9488; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin: 0 0 15px 0; }
                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                    .stat { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
                    .stat-label { font-size: 12px; color: #64748b; margin-bottom: 5px; }
                    .stat-value { font-size: 18px; font-weight: bold; color: #1e293b; }
                    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; }
                    .badge-green { background: #dcfce7; color: #166534; }
                    .badge-yellow { background: #fef3c7; color: #92400e; }
                    .badge-red { background: #fee2e2; color: #991b1b; }
                    .features { display: flex; flex-wrap: wrap; gap: 8px; }
                    .feature-tag { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 15px; font-size: 11px; }
                    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🏨 تقرير اشتراك Adora</h1>
                    <p><strong>${tenant.tenantName}</strong></p>
                    <p>كود المدير: ${managerDetails.manager.code || 'غير متوفر'} • ${managerDetails.branches.length} فرع</p>
                    <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                <div class="section">
                    <h3>📋 معلومات الاشتراك</h3>
                    <div class="grid">
                        <div class="stat">
                            <div class="stat-label">تاريخ إنشاء الحساب</div>
                            <div class="stat-value">${createdAt.toLocaleDateString('ar-SA')}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">مدة الاشتراك</div>
                            <div class="stat-value">${Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))} يوم</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">${t('admin.plan')}</div>
                            <div class="stat-value">${tenant.plan}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label">${t('admin.licenseStatus')}</div>
                            <div class="stat-value">
                                <span class="badge ${tenant.daysUntilExpiry > 30 ? 'badge-green' : tenant.daysUntilExpiry > 7 ? 'badge-yellow' : 'badge-red'}">
                                    ${tenant.daysUntilExpiry > 0 ? t('admin.daysRemaining', { days: tenant.daysUntilExpiry }) : t('admin.expired')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                ${managerDetails.branches.map((branch: any) => `
                    <div class="section">
                        <h3>🏢 فرع: ${branch.name || branch.id}</h3>
                        <div class="grid">
                            <div class="stat">
                                <div class="stat-label">عدد الموظفين</div>
                                <div class="stat-value">${branch.employeesCount || 0}</div>
                            </div>
                            <div class="stat">
                                <div class="stat-label">إجمالي الطلبات</div>
                                <div class="stat-value">${branch.totalRequests || 0}</div>
                            </div>
                        </div>
                        ${branch.enabledFeatures?.length > 0 ? `
                            <div style="margin-top: 15px;">
                                <div class="stat-label">المميزات المفعلة:</div>
                                <div class="features" style="margin-top: 8px;">
                                    ${branch.enabledFeatures.map((f: string) => `<span class="feature-tag">${featureLabels[f] || f}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}

                <div class="footer">
                    <p>تم إنشاء هذا التقرير بواسطة نظام Adora لإدارة الفنادق</p>
                    <p>© ${new Date().getFullYear()} Adora Hotel Management System</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10 flex-shrink-0 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-transparent dark:to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{tenant.tenantName}</h3>
                            <p className="text-sm text-slate-600 dark:text-white/60">
                                كود المدير: {managerDetails.manager.code || 'غير متوفر'} •
                                {managerDetails.branches.length} فرع
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Print Button */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-200 dark:hover:bg-teal-500/30 transition-colors border border-teal-300 dark:border-teal-500/30"
                            title={t('admin.printSubscriptionReport') || 'طباعة تقرير الاشتراك'}
                        >
                            <Printer className="w-5 h-5" />
                            <span className="hidden sm:inline">طباعة</span>
                        </button>
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div id="subscription-report-content" className="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-transparent">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" showMessage={false} />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Manager Lifecycle */}
                            <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                                <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                    دورة حياة المدير
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
                                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">تاريخ إنشاء الحساب</p>
                                        <p className="text-slate-800 dark:text-white font-medium">
                                            {createdAt.toLocaleDateString('ar-SA', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">مدة الاشتراك</p>
                                        <p className="text-slate-800 dark:text-white font-medium">
                                            {Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))} يوم
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.plan')}</p>
                                        <p className="text-slate-800 dark:text-white font-medium capitalize">{tenant.plan}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3">
                                        <p className="text-sm text-slate-500 dark:text-white/60 mb-1">{t('admin.licenseStatus')}</p>
                                        <p className={`font-medium ${tenant.daysUntilExpiry > 30 ? 'text-green-600 dark:text-green-400' : tenant.daysUntilExpiry > 7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {tenant.daysUntilExpiry > 0 ? t('admin.daysRemaining', { days: tenant.daysUntilExpiry }) : t('admin.expired')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Branches Tabs */}
                            {managerDetails.branches.length > 1 ? (
                                <div className="bg-white dark:bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                                    <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                        الفروع ({managerDetails.branches.length})
                                    </h4>
                                    <div className="flex gap-2 mb-4 overflow-x-auto">
                                        {managerDetails.branches.map((branch: any) => (
                                            <button
                                                key={branch.id}
                                                onClick={() => setActiveBranchTab(branch.id)}
                                                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${activeBranchTab === branch.id
                                                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30'
                                                        : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/10'
                                                    }`}
                                            >
                                                {branch.name || branch.id}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Active Branch Details */}
                            {activeBranch && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                                        <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                                            {activeBranch.name || activeBranch.id}
                                        </h4>

                                        {/* Branch Stats */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-5 lg:mb-6">
                                            <div className="bg-blue-50 dark:bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-transparent">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">عدد الموظفين</p>
                                                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.employeesCount || 0}</p>
                                            </div>
                                            <div className="bg-teal-50 dark:bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-teal-200 dark:border-transparent">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">إجمالي الطلبات</p>
                                                <p className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.totalRequests || 0}</p>
                                            </div>
                                            <div className="bg-purple-50 dark:bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-purple-200 dark:border-transparent">
                                                <p className="text-xs sm:text-sm text-slate-500 dark:text-white/60 mb-1">أكثر الأقسام طلباً</p>
                                                <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">{activeBranch.topDepartment}</p>
                                            </div>
                                        </div>

                                        {/* Department Breakdown */}
                                        {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                            <div className="mb-6">
                                                <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                                <div className="space-y-2">
                                                    {Object.entries(activeBranch.departmentCounts)
                                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                                        .map(([dept, count]) => (
                                                            <div key={dept} className="flex items-center justify-between bg-slate-100 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-transparent">
                                                                <span className="text-slate-700 dark:text-white/80">{dept}</span>
                                                                <span className="text-blue-600 dark:text-blue-400 font-bold">{count as number}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Enabled Features */}
                                        {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">المميزات المفعلة:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {activeBranch.enabledFeatures.map((feature: string) => (
                                                        <span
                                                            key={feature}
                                                            className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs border border-green-300 dark:border-green-500/30"
                                                        >
                                                            {featureLabels[feature] || feature}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Single Branch View */}
                            {managerDetails.branches.length === 1 && activeBranch && (
                                <div className="bg-white dark:bg-white/5 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 border border-slate-200 dark:border-white/10 shadow-sm">
                                    <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white mb-3 sm:mb-4 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        {activeBranch.name || activeBranch.id}
                                    </h4>

                                    {/* Same content as above */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-blue-50 dark:bg-white/5 rounded-xl p-4 border border-blue-200 dark:border-transparent">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">عدد الموظفين</p>
                                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.employeesCount || 0}</p>
                                        </div>
                                        <div className="bg-teal-50 dark:bg-white/5 rounded-xl p-4 border border-teal-200 dark:border-transparent">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">إجمالي الطلبات</p>
                                            <p className="text-2xl font-bold text-slate-800 dark:text-white">{activeBranch.totalRequests || 0}</p>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-white/5 rounded-xl p-4 border border-purple-200 dark:border-transparent">
                                            <p className="text-sm text-slate-500 dark:text-white/60 mb-1">أكثر الأقسام طلباً</p>
                                            <p className="text-lg font-bold text-slate-800 dark:text-white">{activeBranch.topDepartment}</p>
                                        </div>
                                    </div>

                                    {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                            <div className="space-y-2">
                                                {Object.entries(activeBranch.departmentCounts)
                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                    .map(([dept, count]) => (
                                                        <div key={dept} className="flex items-center justify-between bg-slate-100 dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-transparent">
                                                            <span className="text-slate-700 dark:text-white/80">{dept}</span>
                                                            <span className="text-blue-600 dark:text-blue-400 font-bold">{count as number}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 dark:text-white/80 mb-3">المميزات المفعلة:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activeBranch.enabledFeatures.map((feature: string) => (
                                                    <span
                                                        key={feature}
                                                        className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs border border-green-300 dark:border-green-500/30"
                                                    >
                                                        {featureLabels[feature] || feature}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================
// SUBSCRIPTION REQUESTS TAB COMPONENT
// ============================================================

const SubscriptionRequestsTab: React.FC = () => {
    const { success, error } = useUX();
    const { t } = useTranslation();
    const [requests, setRequests] = useState<TrialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'contacted' | 'not-contacted'>('all');
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'branches-high' | 'branches-low'>('newest');
    const [showContactModal, setShowContactModal] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<TrialRequest | null>(null);
    const [contactResult, setContactResult] = useState<'demo' | 'thinking' | 'wrong' | 'other'>('demo');
    const [contactNotes, setContactNotes] = useState('');
    const [followUpNote, setFollowUpNote] = useState('');

    // Fetch requests
    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const result = await getAllTrialRequests();
                if (result.success && result.data) {
                    setRequests(result.data);
                } else {
                    // ✅ Better error message for permission errors
                    const errorMsg = result.error || t('common.error');
                    const isPermissionError = errorMsg.toLowerCase().includes('permission') || 
                                             errorMsg.toLowerCase().includes('missing or insufficient') ||
                                             errorMsg.toLowerCase().includes('unauthorized');
                    
                    if (isPermissionError) {
                        error(t('admin.permissionError'));
                    } else {
                        error(errorMsg);
                    }
                }
            } catch (err: any) {
                const errorMsg = err.message || 'حدث خطأ أثناء جلب الطلبات';
                const isPermissionError = errorMsg.toLowerCase().includes('permission') || 
                                         errorMsg.toLowerCase().includes('missing or insufficient') ||
                                         errorMsg.toLowerCase().includes('unauthorized');
                
                if (isPermissionError) {
                        error(t('admin.permissionErrorGeneral'));
                } else {
                    error(errorMsg);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // ✅ Only run once on mount - t and error are stable functions

    // Filter and sort requests
    const filteredRequests = useMemo(() => {
        // ✅ FIX: Null safety check
        if (!requests || !Array.isArray(requests)) {
            return [];
        }
        
        let result = [...requests];
        
        // Apply filter
        if (filter === 'contacted') {
            result = result.filter(req => req.contactedAt);
        } else if (filter === 'not-contacted') {
            result = result.filter(req => !req.contactedAt);
        }
        
        // Apply sort
        result.sort((a, b) => {
            if (sortBy === 'newest') {
                const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return bDate.getTime() - aDate.getTime(); // Newest first
            } else if (sortBy === 'oldest') {
                const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return aDate.getTime() - bDate.getTime(); // Oldest first
            } else if (sortBy === 'branches-high') {
                const aBranches = a.requiredBranches || 0;
                const bBranches = b.requiredBranches || 0;
                return bBranches - aBranches; // Highest first
            } else if (sortBy === 'branches-low') {
                const aBranches = a.requiredBranches || 0;
                const bBranches = b.requiredBranches || 0;
                return aBranches - bBranches; // Lowest first
            }
            return 0;
        });
        
        return result;
    }, [requests, filter, sortBy]);

    // Format date with Gregorian + Hijri
    // ✅ Use useCallback to ensure formatDate is stable and has access to t
    const formatDate = useCallback((dateValue: any): string => {
        if (!dateValue) return t('admin.undefined');
        try {
            let date: Date;
            if (dateValue instanceof Timestamp) {
                date = dateValue.toDate();
            } else if (typeof dateValue?.toDate === 'function') {
                date = dateValue.toDate();
            } else if (dateValue instanceof Date) {
                date = dateValue;
            } else {
                date = new Date(dateValue);
            }
            return formatDualDate(date, { showGregorian: true, showHijri: true, dateStyle: 'long' });
        } catch {
            return t('admin.undefined');
        }
    }, [t]);

    // Handle mark as contacted - Open modal first
    const handleMarkAsContacted = (requestId: string) => {
        setSelectedRequestId(requestId);
        setContactResult('demo');
        setContactNotes('');
        setShowContactModal(true);
    };

    // Submit contact result
    const handleSubmitContact = async () => {
        if (!selectedRequestId) return;

        // ✅ Validate required notes
        if (!contactNotes || !contactNotes.trim()) {
            error('الملاحظات مطلوبة');
            return;
        }

        try {
            const result = await markTrialRequestAsContacted(selectedRequestId, contactResult, contactNotes);
            if (result.success) {
                success('تم حفظ نتيجة الاتصال بنجاح');
                setShowContactModal(false);
                setSelectedRequestId(null);
                setContactResult('demo');
                setContactNotes('');
                // Refresh requests
                const refreshResult = await getAllTrialRequests();
                if (refreshResult.success && refreshResult.data) {
                    setRequests(refreshResult.data);
                }
            } else {
                error(result.error || 'فشل حفظ نتيجة الاتصال');
            }
        } catch (err: any) {
            error(err.message || 'حدث خطأ أثناء الحفظ');
        }
    };

    // View contact notes
    const handleViewNotes = (request: TrialRequest) => {
        setSelectedRequest(request);
        setShowNotesModal(true);
    };

    // Print request details
    const handlePrintRequest = (request: TrialRequest) => {
        // Create a printable HTML content
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // ✅ FIX: Format dates before template string to avoid closure issues
        const requestCreatedDate = formatDate(request.createdAt);
        const requestContactedDate = request.contactedAt ? formatDate(request.contactedAt) : '';
        // ✅ FIX: Format print date before template string
        const printDate = formatDualDate(new Date(), { showGregorian: true, showHijri: true, dateStyle: 'long' });

        const contactResultText = {
            'demo': 'طلب ديمو',
            'thinking': 'طلب مهلة تفكير',
            'wrong': 'طلب خاطئ',
            'other': 'طلب آخر'
        }[request.contactResult || 'other'] || 'غير محدد';

        // ✅ FIX: Format follow-up dates before template string to avoid closure issues
        const followUpsHtml = request.followUps && request.followUps.length > 0
            ? request.followUps.map((followUp, index) => {
                const followUpDate = followUp.createdAt?.toDate 
                    ? followUp.createdAt.toDate() 
                    : followUp.createdAt instanceof Date 
                        ? followUp.createdAt 
                        : new Date(followUp.createdAt || Date.now());
                // ✅ Format date before template string
                const formattedFollowUpDate = formatDualDate(followUpDate, { showGregorian: true, showHijri: true, dateStyle: 'long' });
                return `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${index + 1}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formattedFollowUpDate}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${followUp.note || 'لا توجد ملاحظات'}</td>
                    </tr>
                `;
            }).join('')
            : '<tr><td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: center; color: #999;">لا توجد ملاحظات متابعة</td></tr>';

        const htmlContent = `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <title>تفاصيل طلب الاشتراك - ${request.name}</title>
                <style>
                    @media print {
                        body { margin: 0; padding: 20px; }
                        .no-print { display: none; }
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        direction: rtl;
                        padding: 20px;
                        color: #333;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #20b2aa;
                        padding-bottom: 20px;
                    }
                    .header h1 {
                        color: #20b2aa;
                        margin: 0;
                        font-size: 28px;
                    }
                    .header p {
                        color: #666;
                        margin: 5px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        background: white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    th {
                        background: linear-gradient(to right, #20b2aa, #0d9488);
                        color: white;
                        padding: 12px;
                        text-align: right;
                        font-weight: bold;
                        border: 1px solid #0d9488;
                    }
                    td {
                        padding: 10px;
                        border: 1px solid #ddd;
                        text-align: right;
                    }
                    tr:nth-child(even) {
                        background: #f9f9f9;
                    }
                    .section-title {
                        background: #f0f0f0;
                        font-weight: bold;
                        color: #20b2aa;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 2px solid #ddd;
                        color: #666;
                        font-size: 12px;
                    }
                    .print-btn {
                        position: fixed;
                        top: 20px;
                        left: 20px;
                        padding: 12px 24px;
                        background: #20b2aa;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        box-shadow: 0 4px 12px rgba(32, 178, 170, 0.3);
                        z-index: 1000;
                    }
                    .print-btn:hover {
                        background: #0d9488;
                    }
                </style>
            </head>
            <body>
                <button class="print-btn no-print" onclick="window.print()">🖨️ طباعة</button>
                
                <div class="header">
                    <h1>تفاصيل طلب الاشتراك</h1>
                    <p>نظام Adora لإدارة الفنادق</p>
                    <p>تاريخ الطباعة: ${printDate}</p>
                </div>

                <table>
                    <tr>
                        <th colspan="2" class="section-title">معلومات المشترك</th>
                    </tr>
                    <tr>
                        <td style="width: 30%; font-weight: bold;">الاسم</td>
                        <td>${request.name || 'غير متوفر'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">رقم الهاتف</td>
                        <td>${request.phone || 'غير متوفر'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">عدد التراخيص المطلوبة</td>
                        <td>${request.requiredBranches || 1} ترخيص (${request.requiredBranches || 1} فرع)</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">مصدر الطلب</td>
                        <td>${request.source === 'about_us_page' ? 'صفحة About Us' : request.source || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">تاريخ الطلب</td>
                        <td>${requestCreatedDate}</td>
                    </tr>
                </table>

                <table>
                    <tr>
                        <th colspan="2" class="section-title">معلومات الاتصال</th>
                    </tr>
                    <tr>
                        <td style="width: 30%; font-weight: bold;">حالة الاتصال</td>
                        <td>${request.contactedAt ? 'تم التواصل معه' : 'لم يتم التواصل معه'}</td>
                    </tr>
                    ${request.contactedAt ? `
                    <tr>
                        <td style="font-weight: bold;">تاريخ الاتصال</td>
                        <td>${requestContactedDate}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">نوع الطلب</td>
                        <td>${contactResultText}</td>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">ملاحظات الاتصال</td>
                        <td>${request.contactNotes || 'لا توجد ملاحظات'}</td>
                    </tr>
                    ` : '<tr><td colspan="2" style="text-align: center; color: #999;">لم يتم التواصل مع المشترك بعد</td></tr>'}
                </table>

                ${request.followUps && request.followUps.length > 0 ? `
                <table>
                    <tr>
                        <th colspan="3" class="section-title">سجل المتابعة</th>
                    </tr>
                    <tr>
                        <th style="width: 10%;">#</th>
                        <th style="width: 30%;">التاريخ</th>
                        <th style="width: 60%;">الملاحظة</th>
                    </tr>
                    ${followUpsHtml}
                </table>
                ` : ''}

                <div class="footer">
                    <p>تم إنشاء هذا التقرير تلقائياً من نظام Adora لإدارة الفنادق</p>
                    <p>© ${new Date().getFullYear()} Adora Platform - جميع الحقوق محفوظة</p>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load, then trigger print
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    // Submit follow-up
    const handleSubmitFollowUp = async () => {
        if (!selectedRequestId || !followUpNote || !followUpNote.trim()) {
            error('ملاحظة المتابعة مطلوبة');
            return;
        }

        try {
            const result = await addFollowUpToTrialRequest(selectedRequestId, followUpNote);
            if (result.success) {
                success('تم إضافة ملاحظة المتابعة بنجاح');
                setShowFollowUpModal(false);
                setSelectedRequestId(null);
                setFollowUpNote('');
                // Refresh requests
                const refreshResult = await getAllTrialRequests();
                if (refreshResult.success && refreshResult.data) {
                    setRequests(refreshResult.data);
                }
            } else {
                error(result.error || 'فشل إضافة ملاحظة المتابعة');
            }
        } catch (err: any) {
            error(err.message || 'حدث خطأ أثناء الحفظ');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <AdoraLoaderInline />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{t('admin.subscriptionRequests')}</h2>
                    <p className="text-white/60">{t('admin.allTrialAndSubscriptionRequests')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setLoading(true);
                            getAllTrialRequests().then(result => {
                                if (result.success && result.data) {
                                    setRequests(result.data);
                                    success(t('admin.updateRequests'));
                                }
                                setLoading(false);
                            });
                        }}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        {t('admin.refresh')}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-white/60 text-sm mb-1">{t('common.total')}</div>
                    <div className="text-2xl font-bold text-white">{requests?.length || 0}</div>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                    <div className="text-red-400/80 text-sm mb-1">لم يتم التواصل</div>
                    <div className="text-2xl font-bold text-red-400">
                        {requests?.filter(r => !r.contactedAt).length || 0}
                    </div>
                </div>
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                    <div className="text-green-400/80 text-sm mb-1">تم التواصل</div>
                    <div className="text-2xl font-bold text-green-400">
                        {requests?.filter(r => r.contactedAt).length || 0}
                    </div>
                </div>
            </div>

            {/* Filters & Sort */}
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Status Filters */}
                <div className="flex gap-2 flex-wrap">
                    {([
                        { key: 'all', label: t('common.all') },
                        { key: 'not-contacted', label: t('admin.notContacted') },
                        { key: 'contacted', label: t('admin.contacted') }
                    ] as const).map((filterOption) => (
                        <button
                            key={filterOption.key}
                            onClick={() => setFilter(filterOption.key as any)}
                            className={`px-4 py-2 rounded-lg transition-all ${
                                filter === filterOption.key
                                    ? 'bg-teal-500 text-white'
                                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                        >
                            {filterOption.label}
                        </button>
                    ))}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                    <label className="text-white/60 text-sm whitespace-nowrap">ترتيب حسب:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all"
                    >
                        <option value="newest">أحدث طلب</option>
                        <option value="oldest">أقدم طلب</option>
                        <option value="branches-high">عدد الفروع (أكثر ← أقل)</option>
                        <option value="branches-low">عدد الفروع (أقل ← أكثر)</option>
                    </select>
                </div>
            </div>

            {/* Requests List */}
            <div className="space-y-4">
                {!filteredRequests || filteredRequests.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
                        <MessageSquare className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <p className="text-white/60">
                            {filter === 'contacted' && 'لا توجد طلبات تم التواصل معها'}
                            {filter === 'not-contacted' && 'لا توجد طلبات معلقة'}
                            {filter === 'all' && 'لا توجد طلبات اشتراك'}
                        </p>
                    </div>
                ) : (
                    filteredRequests.map((request) => (
                        <div
                            key={request.id}
                            className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-teal-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between flex-wrap gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center">
                                            <Users className="w-6 h-6 text-teal-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{request.name}</h3>
                                            <p className="text-white/60 text-sm">{request.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap text-sm">
                                        <div className="flex items-center gap-2 text-white/60">
                                            <Calendar className="w-4 h-4" />
                                            {formatDate(request.createdAt)}
                                        </div>
                                        <div className="flex items-center gap-2 text-white/60">
                                            <Globe className="w-4 h-4" />
                                            {request.source === 'about_us_page' ? 'صفحة About Us' : request.source}
                                        </div>
                                        {request.requiredBranches && (
                                            <div className="flex items-center gap-2 text-teal-400">
                                                <Building2 className="w-4 h-4" />
                                                <span className="font-semibold">{request.requiredBranches} ترخيص</span>
                                                <span className="text-white/40">({request.requiredBranches} فرع)</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 flex-col sm:flex-row">
                                    {request.contactedAt ? (
                                        <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                                            <div className="flex items-center gap-2">
                                                <span className="px-3 py-1 rounded-lg text-xs font-semibold border bg-green-500/20 text-green-400 border-green-500/30">
                                                    تم التواصل معه
                                                </span>
                                                <button
                                                    onClick={() => handleViewNotes(request)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/30 transition-all"
                                                    title={t('admin.viewNotes') || 'عرض الملاحظات'}
                                                >
                                                    <Eye className="w-4 h-4 text-white/60 hover:text-teal-400" />
                                                </button>
                                                <button
                                                    onClick={() => handlePrintRequest(request)}
                                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/30 transition-all"
                                                    title={t('admin.printDetails') || 'طباعة التفاصيل'}
                                                >
                                                    <Printer className="w-4 h-4 text-white/60 hover:text-teal-400" />
                                                </button>
                                            </div>
                                            <span className="text-xs text-white/40">{formatDate(request.contactedAt)}</span>
                                            {request.contactResult && (
                                                <span className="text-xs text-white/60">
                                                    {request.contactResult === 'demo' && 'طلب ديمو'}
                                                    {request.contactResult === 'thinking' && 'طلب مهلة تفكير'}
                                                    {request.contactResult === 'wrong' && 'طلب خاطئ'}
                                                    {request.contactResult === 'other' && 'طلب آخر'}
                                                </span>
                                            )}
                                            {/* Follow-up Section */}
                                            <div className="w-full mt-2 pt-3 border-t border-white/10">
                                                <button
                                                    onClick={() => {
                                                        setSelectedRequestId(request.id!);
                                                        setShowFollowUpModal(true);
                                                    }}
                                                    className="w-full px-4 py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 hover:border-teal-500/50 text-teal-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    متابعة
                                                </button>
                                                {request.followUps && request.followUps.length > 0 && (
                                                    <div className="mt-2 text-xs text-white/40">
                                                        ({request.followUps.length} متابعة)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end gap-2">
                                            <span className="px-3 py-1 rounded-lg text-xs font-semibold border bg-red-500/20 text-red-400 border-red-500/30">
                                                لم يتم التواصل معه
                                            </span>
                                            <button
                                                onClick={() => handleMarkAsContacted(request.id!)}
                                                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-all flex items-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                تم التواصل
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Contact Result Modal */}
            <UnifiedModal
                isOpen={showContactModal}
                onClose={() => {
                    setShowContactModal(false);
                    setSelectedRequestId(null);
                    setContactResult('demo');
                    setContactNotes('');
                }}
                title={t('admin.contactResult') || 'نتيجة الاتصال'}
                subtitle={t('admin.selectRequestTypeAndNotes') || 'اختر نوع الطلب وأضف ملاحظات'}
                icon={<MessageSquare className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                <div className="space-y-4">
                    {/* Contact Result Selection */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            نوع الطلب <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { value: 'demo', label: 'طلب ديمو', icon: '🎮' },
                                { value: 'thinking', label: 'طلب مهلة تفكير', icon: '🤔' },
                                { value: 'wrong', label: 'طلب خاطئ', icon: '❌' },
                                { value: 'other', label: 'طلب آخر', icon: '📝' }
                            ] as const).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setContactResult(option.value)}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        contactResult === option.value
                                            ? 'border-teal-500 bg-teal-500/20 text-teal-400'
                                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                                    }`}
                                >
                                    <div className="text-2xl mb-1">{option.icon}</div>
                                    <div className="text-sm font-medium">{option.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Contact Notes - REQUIRED */}
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            الملاحظات <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={contactNotes}
                            onChange={(e) => setContactNotes(e.target.value)}
                            placeholder="اكتب ملاحظاتك عن الاتصال... (مثال: المشترك يريد تجربة لمدة أسبوع، أو لديه أسئلة عن الأسعار)"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all resize-none"
                            rows={4}
                            dir="rtl"
                            required
                        />
                        {!contactNotes && (
                            <p className="text-red-400 text-xs mt-1">الملاحظات مطلوبة</p>
                        )}
                    </div>
                </div>

                <ModalActions
                    onCancel={() => {
                        setShowContactModal(false);
                        setSelectedRequestId(null);
                        setContactResult('demo');
                        setContactNotes('');
                    }}
                    onConfirm={handleSubmitContact}
                    confirmText={t('common.save')}
                    cancelText={t('common.cancel')}
                    confirmVariant="primary"
                />
            </UnifiedModal>

            {/* View Notes Modal */}
            <UnifiedModal
                isOpen={showNotesModal}
                onClose={() => {
                    setShowNotesModal(false);
                    setSelectedRequest(null);
                }}
                title={t('admin.contactDetails') || 'تفاصيل الاتصال'}
                subtitle={t('admin.contactDetailsSubtitle') || 'تاريخ الطلب، تاريخ الاتصال، والملاحظات'}
                icon={<Eye className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                {selectedRequest && (
                    <div className="space-y-4">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">تاريخ الطلب</label>
                                <div className="text-white font-medium flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-teal-400" />
                                    {formatDate(selectedRequest.createdAt)}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-white/60 mb-1 block">تاريخ الاتصال</label>
                                <div className="text-white font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-400" />
                                    {selectedRequest.contactedAt ? formatDate(selectedRequest.contactedAt) : 'غير متوفر'}
                                </div>
                            </div>
                            {selectedRequest.contactResult && (
                                <div>
                                    <label className="text-xs text-white/60 mb-1 block">نوع الطلب</label>
                                    <div className="text-white font-medium">
                                        {selectedRequest.contactResult === 'demo' && 'طلب ديمو'}
                                        {selectedRequest.contactResult === 'thinking' && 'طلب مهلة تفكير'}
                                        {selectedRequest.contactResult === 'wrong' && 'طلب خاطئ'}
                                        {selectedRequest.contactResult === 'other' && 'طلب آخر'}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-white/60 mb-2 block">ملاحظات الاتصال</label>
                                <div className="text-white bg-white/5 rounded-lg p-3 border border-white/10 min-h-[100px] text-right">
                                    {selectedRequest.contactNotes || 'لا توجد ملاحظات'}
                                </div>
                            </div>
                            {selectedRequest.followUps && selectedRequest.followUps.length > 0 && (
                                <div>
                                    <label className="text-xs text-white/60 mb-2 block">ملاحظات المتابعة ({selectedRequest.followUps.length})</label>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {selectedRequest.followUps.map((followUp, index) => (
                                            <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10 text-right">
                                                <div className="text-xs text-white/40 mb-1">
                                                    {followUp.createdAt?.toDate ? formatDate(followUp.createdAt) : 'تاريخ غير متوفر'}
                                                </div>
                                                <div className="text-white text-sm">{followUp.note}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <ModalActions
                    onCancel={() => {
                        setShowNotesModal(false);
                        setSelectedRequest(null);
                    }}
                    onConfirm={() => {
                        setShowNotesModal(false);
                        setSelectedRequest(null);
                    }}
                    confirmText={t('common.close')}
                    cancelText=""
                    confirmVariant="primary"
                    hideCancel
                />
            </UnifiedModal>

            {/* Follow-up Modal */}
            <UnifiedModal
                isOpen={showFollowUpModal}
                onClose={() => {
                    setShowFollowUpModal(false);
                    setSelectedRequestId(null);
                    setFollowUpNote('');
                }}
                title={t('admin.addFollowUp') || 'إضافة متابعة'}
                subtitle={t('admin.addFollowUpSubtitle') || 'اكتب ملاحظة متابعة للمشترك المحتمل'}
                icon={<MessageSquare className="w-6 h-6 text-teal-400" />}
                size="md"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-white/80 mb-2">
                            ملاحظة المتابعة <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            value={followUpNote}
                            onChange={(e) => setFollowUpNote(e.target.value)}
                            placeholder="اكتب ملاحظة المتابعة... (مثال: سيتم الاتصال به مرة أخرى الأسبوع القادم)"
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all resize-none"
                            rows={4}
                            dir="rtl"
                            required
                        />
                        {!followUpNote && (
                            <p className="text-red-400 text-xs mt-1">ملاحظة المتابعة مطلوبة</p>
                        )}
                    </div>
                </div>

                <ModalActions
                    onCancel={() => {
                        setShowFollowUpModal(false);
                        setSelectedRequestId(null);
                        setFollowUpNote('');
                    }}
                    onConfirm={handleSubmitFollowUp}
                    confirmText={t('common.save')}
                    cancelText={t('common.cancel')}
                    confirmVariant="primary"
                />
            </UnifiedModal>

        </div>
    );
};

export default EnhancedOwnerDashboard;