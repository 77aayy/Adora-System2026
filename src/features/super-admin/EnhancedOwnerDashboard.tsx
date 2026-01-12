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
    LayoutDashboard, CreditCard, BarChart3, Menu, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUX } from '../../context/UXContext';
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
import { getAllManagers, createManager, isPinAvailable, toggleLicenseStatus, renewLicense, softDeleteManager, restoreManager, getDeletedManagers, getDemoStats } from '../../services/ownerService';
import type { SystemSettings } from '../../services/systemSettingsService';
import { PageTransition } from '../../components/common/PageTransition';
import { FlexibleHeader } from '../../components/common/FlexibleHeader';
import { LineChart, BarChart, DoughnutChart } from '../../components/analytics/ChartComponents';
import { exportToPDF, exportToExcel } from '../../utils/exportUtils';
import { FileText, AlertCircle, Download, Code2, Palette } from 'lucide-react';
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
    createReceiptVoucher,
    getAllReceiptVouchers,
    getAllInvoices,
    type ReceiptVoucher,
    type Invoice
} from '../../services/billingService';
import { collection, query, where, getCountFromServer, getDocs, getDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { calculateTenantRevenue } from '../../services/billingService';
import { confirm as customConfirm } from '../../services/customConfirmService';
import { AdoraLoader, AdoraLoaderInline } from '../../components/common/AdoraLoader';
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

// ============================================================
// TYPES
// ============================================================

type TabType = 'overview' | 'tenants' | 'settings' | 'updates' | 'broadcasts' | 'billing' | 'core-config' | 'demo';

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
    const { user } = useAuth();
    const { success, error } = useUX();
    
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
    
    // System Settings State
    const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
    const [analytics, setAnalytics] = useState<any>(null);
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
            const [monthlyRev, annualRev, renewalRev, nearest] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null)
            ]);
            
            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            
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
            const [monthlyRev, annualRev, renewalRev, nearest] = await Promise.all([
                calculateMonthlyRecurringRevenue().catch(() => 0),
                calculateAnnualRecurringRevenue().catch(() => 0),
                calculateMonthlyRenewalRevenue().catch(() => 0),
                getNearestExpiringSubscription().catch(() => null)
            ]);
            
            setMrr(monthlyRev);
            setArr(annualRev);
            setMonthlyRenewalRevenue(renewalRev);
            setNearestExpiring(nearest);
            setCachedData('revenue', { mrr: monthlyRev, arr: annualRev, monthlyRenewal: renewalRev, nearestExpiring: nearest });
            
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
            
            managers.forEach((m: any) => {
                const status = m.status || 'active';
                const isDeleted = m.isDeleted === true || m.deletedAt;
                
                if (isDeleted) return; // Skip soft-deleted in main list
                
                if (status === 'active') active++;
                else if (status === 'suspended') suspended++;
                else if (status === 'expired' || status === 'inactive') expired++;
            });
            
            const stats = {
                active,
                suspended,
                deleted: deletedManagers.length,
                expired,
                total: active + suspended + expired + deletedManagers.length
            };
            
            setManagerStats(stats);
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
                !cachedMultiBranch ? loadMultiBranchData().catch(() => {}) : Promise.resolve(),
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
            
            // ✅ No need to reload all data - just update the feature state
            // Components using useFeatureGate will automatically re-check and hide/show
            success(`تم ${enabled ? 'تفعيل' : 'تعطيل'} الميزة بنجاح${!enabled ? ' - سيتم إخفاؤها من جميع الفروع تلقائياً' : ''}`);
        } catch (err: any) {
            error('حدث خطأ في تحديث الميزة');
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
            success(`تم ${enabled ? 'تفعيل' : 'تعطيل'} وضع الصيانة`);
        } catch (err: any) {
            error('حدث خطأ في تحديث وضع الصيانة');
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
            
            success('تم حفظ الإعدادات بنجاح');
        } catch (err: any) {
            error('حدث خطأ في حفظ الإعدادات');
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
                        message="جاري تحميل البيانات الأساسية..."
                        showMessage={true}
                    />
                    {loadingHeavyData && (
                        <p className="text-sm mt-4 animate-pulse" style={{ color: 'var(--theme-text-tertiary)' }}>
                            جاري تحميل البيانات الإضافية في الخلفية...
                        </p>
                    )}
                </div>
            </div>
        );
    }

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
                className="min-h-screen transition-colors duration-300"
                style={{ background: 'var(--theme-gradient-page)' }}
            >
                <FlexibleHeader
                    title="لوحة التحكم الرئيسية"
                    titleIcon={<Crown className="w-6 h-6" />}
                    subtitle={`${allBranches.length} فرع نشط • إدارة النظام الكاملة`}
                    actions={[
                        {
                            id: 'refresh',
                            icon: saving ? <AdoraLoaderInline size={20} /> : <RefreshCw className="w-4 h-4" />,
                            label: 'تحديث',
                            onClick: () => loadData(true), // ✅ Force refresh from Firebase
                            variant: 'primary' as const,
                            showOnMobile: true,
                            showLabel: true
                        }
                    ]}
                />

                <div className="max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                    {/* ✅ Navigation Bar - Responsive */}
                    <div 
                        className="solid-modal rounded-xl sm:rounded-2xl p-2 overflow-hidden md:overflow-x-auto scrollbar-hide"
                        style={{ 
                            background: 'var(--theme-bg-secondary)',
                            border: '1px solid var(--theme-border-primary)'
                        }}
                    >
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                            {/* ✅ Modern Hamburger Menu Button */}
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="group flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex-shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, var(--theme-primary-500) 0%, var(--theme-primary-600) 100%)',
                                    boxShadow: '0 4px 15px rgba(20, 184, 166, 0.3)'
                                }}
                                title="القائمة الجانبية"
                            >
                                <div className="flex flex-col gap-1 items-center justify-center">
                                    <span className="block w-4 h-0.5 bg-white rounded-full transition-all duration-200 group-hover:w-5"></span>
                                    <span className="block w-5 h-0.5 bg-white rounded-full transition-all duration-200 group-hover:w-4"></span>
                                    <span className="block w-3 h-0.5 bg-white rounded-full transition-all duration-200 group-hover:w-5"></span>
                                </div>
                            </button>
                            
                            {/* 📱 MOBILE: Show current tab name only */}
                            <div className="flex md:hidden items-center gap-2 flex-1">
                                {(() => {
                                    const tabs = [
                                        { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
                                        { id: 'tenants', label: 'المشتركين', icon: Users },
                                        { id: 'billing', label: 'الفواتير', icon: CreditCard },
                                        { id: 'settings', label: 'الإعدادات', icon: Settings },
                                        // { id: 'analytics', label: 'التحليلات', icon: BarChart3 }, // ✅ دُمج في الرئيسية
                                        { id: 'broadcasts', label: 'الرسائل', icon: MessageSquare },
                                        { id: 'demo', label: 'روابط الديمو', icon: Share2 },
                                        { id: 'core-config', label: '🔐 التأسيس', icon: Shield },
                                    ];
                                    const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
                                    const Icon = currentTab.icon;
                                    return (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/20">
                                            <Icon className="w-4 h-4 text-teal-400" />
                                            <span className="text-sm font-medium text-teal-400">{currentTab.label}</span>
                                        </div>
                                    );
                                })()}
                                <span className="text-xs text-white/40 mr-auto">اختر من القائمة ←</span>
                            </div>
                            
                            {/* 🖥️ DESKTOP: Show all tabs */}
                            <div className="hidden md:flex items-center gap-3 min-w-max">
                                {/* Divider */}
                                <div className="w-px h-8 bg-white/10"></div>
                                
                                {/* Tabs */}
                                <div className="flex gap-1 sm:gap-2">
                                {[
                                    { id: 'overview' as TabType, label: 'الرئيسية', icon: LayoutDashboard },
                                    { id: 'tenants' as TabType, label: 'المشتركين', icon: Users },
                                    { id: 'billing' as TabType, label: 'الفواتير', icon: CreditCard },
                                    { id: 'settings' as TabType, label: 'الإعدادات', icon: Settings },
                                    // { id: 'analytics' as TabType, label: 'التحليلات', icon: BarChart3 }, // ✅ دُمج في الرئيسية
                                    { id: 'broadcasts' as TabType, label: 'الرسائل', icon: MessageSquare },
                                    { id: 'demo' as TabType, label: 'روابط الديمو', icon: Share2 },
                                    { id: 'core-config' as TabType, label: '🔐 التأسيس', icon: Shield, hidden: true },
                                ].map(tab => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    const isHidden = (tab as any).hidden;
                                    
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setSearchParams({ tab: tab.id })}
                                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm font-medium ${
                                                isActive
                                                    ? isHidden 
                                                        ? 'bg-red-500/20 text-red-400 shadow-sm ring-1 ring-red-500/30'
                                                        : 'bg-teal-500/20 text-teal-400 shadow-sm'
                                                    : isHidden
                                                        ? 'hover:bg-red-500/10 opacity-60 hover:opacity-100'
                                                        : 'hover:bg-white/5'
                                            }`}
                                            style={{
                                                color: isActive 
                                                    ? isHidden 
                                                        ? 'rgb(248, 113, 113)' 
                                                        : 'var(--theme-primary-400, #2dd4bf)' 
                                                    : 'var(--theme-text-secondary)',
                                            }}
                                            title={isHidden ? 'صفحة مخفية - للمالك فقط' : undefined}
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
                                ⏳ جاري جلب البيانات في الخلفية...
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
                                    ✅ تم تحديث البيانات بنجاح
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
                    <div className="space-y-6">
                        {activeTab === 'overview' && (
                            <OverviewTab
                                systemSettings={effectiveSettings}
                                analytics={analytics}
                                onMaintenanceToggle={handleMaintenanceMode}
                                allBranches={allBranches} // ✅ SaaS Integration
                                mrr={mrr}
                                arr={arr}
                                monthlyRenewalRevenue={monthlyRenewalRevenue}
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
                        
                        {activeTab === 'updates' && (
                            <UpdatesTab
                                updates={(effectiveSettings as any).systemUpdates || []}
                                onAddUpdate={() => setShowUpdateModal(true)}
                            />
                        )}
                        
                        {activeTab === 'broadcasts' && (
                            <BroadcastsTab
                                broadcasts={effectiveSettings.broadcastMessages || []}
                                onAddBroadcast={() => setShowBroadcastModal(true)}
                            />
                        )}
                        
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
                        {activeTab === 'core-config' && (
                            <CoreConfigTemplate 
                                onSave={() => success('تم حفظ قوالب التأسيس بنجاح')}
                            />
                        )}
                    </div>
                </div>

                {/* Modals */}
                {showUpdateModal && (
                    <UpdateModal
                        onClose={() => setShowUpdateModal(false)}
                        onSave={async (update) => {
                            await addSystemUpdate(update, user?.id || 'system');
                            await loadData(true); // Force refresh
                            setShowUpdateModal(false);
                            success('تم إضافة التحديث بنجاح');
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
                            success('تم إضافة الرسالة بنجاح');
                        }}
                    />
                )}

                {showAddManagerModal && (
                    <AddManagerModal
                        systemSettings={effectiveSettings}
                        onClose={() => setShowAddManagerModal(false)}
                        onSuccess={async () => {
                            setShowAddManagerModal(false);
                            await loadData(true); // Force refresh after adding manager
                            success('تم إضافة المدير وإنشاء سند القبض بنجاح');
                            // ✅ الانتقال التلقائي إلى تبويب الفواتير
                            setSearchParams({ tab: 'billing' });
                        }}
                    />
                )}
                
                {/* ✅ Owner Sidebar with Overlay */}
                {showSidebar && (
                    <>
                        {/* Backdrop */}
                        <div 
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                            onClick={() => setShowSidebar(false)}
                        />
                        {/* Sidebar */}
                        <div className="fixed top-0 right-0 h-full z-50 animate-in slide-in-from-right duration-300">
                            <AdminSidebar 
                                onClose={() => setShowSidebar(false)}
                                isOwner={true}
                            />
                        </div>
                    </>
                )}

                {/* 📝 Developer Signature is in GlobalFooter (App.tsx) */}
                
            </div>

            {/* ✅ Manager Details Modal - Rendered inside main component */}
            {showManagerDetailsModal && selectedManager && (
                <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4" style={{ backdropFilter: 'none' }}>
                    <div className="solid-modal rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/20">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users className="w-6 h-6 text-blue-400" />
                                تفاصيل المدير
                            </h3>
                            <button
                                onClick={() => {
                                    setShowManagerDetailsModal(false);
                                    setSelectedManager(null);
                                }}
                                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-sm text-white/60 mb-1">اسم الفندق</p>
                                    <p className="text-lg font-bold text-white">{selectedManager.tenantName}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-sm text-white/60 mb-1">اسم المدير</p>
                                    <p className="text-lg font-bold text-white">{selectedManager.managerName || 'غير محدد'}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-sm text-white/60 mb-1">رمز المدير</p>
                                    <p className="text-lg font-bold text-teal-400">{selectedManager.managerCode || 'غير محدد'}</p>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4">
                                    <p className="text-sm text-white/60 mb-1">الخطة</p>
                                    <p className="text-lg font-bold text-white capitalize">{selectedManager.plan}</p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-sm text-white/60 mb-2">الحالة</p>
                                <div className="flex items-center gap-2">
                                    {selectedManager.status === 'active' && (
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm border border-green-500/30 flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            نشط
                                        </span>
                                    )}
                                    {selectedManager.status === 'suspended' && (
                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm border border-yellow-500/30 flex items-center gap-1">
                                            <Pause className="w-4 h-4" />
                                            موقوف مؤقتاً
                                        </span>
                                    )}
                                    {selectedManager.status === 'expired' && (
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm border border-red-500/30 flex items-center gap-1">
                                            <X className="w-4 h-4" />
                                            منتهي
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Statistics */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-sm text-white/60 mb-3">الإحصائيات</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white/5 rounded-xl p-4 text-center">
                                        <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-white">{selectedManager.totalEmployees}</p>
                                        <p className="text-xs text-white/60">موظف</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center">
                                        <Building2 className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-white">{selectedManager.totalBranches}</p>
                                        <p className="text-xs text-white/60">فرع</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center">
                                        <DoorOpen className="w-6 h-6 text-teal-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-white">{selectedManager.totalRooms}</p>
                                        <p className="text-xs text-white/60">غرفة</p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 text-center">
                                        <Activity className="w-6 h-6 text-green-400 mx-auto mb-2" />
                                        <p className="text-2xl font-bold text-white">{selectedManager.totalRequests}</p>
                                        <p className="text-xs text-white/60">طلب</p>
                                    </div>
                                </div>
                            </div>

                            {/* License Info */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-sm text-white/60 mb-3">معلومات الترخيص</p>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                        <span className="text-white/80">تاريخ البدء</span>
                                        <span className="text-white font-medium">
                                            {toSafeDate(selectedManager.subscriptionStartDate).toLocaleDateString('ar-EG')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                        <span className="text-white/80">تاريخ الانتهاء</span>
                                        <span className="text-white font-medium">
                                            {toSafeDate(selectedManager.licenseExpiryDate).toLocaleDateString('ar-EG')}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                        <span className="text-white/80">الأيام المتبقية</span>
                                        <span className={`font-bold ${
                                            selectedManager.daysUntilExpiry <= 7 
                                                ? 'text-red-400' 
                                                : selectedManager.daysUntilExpiry <= 30
                                                ? 'text-yellow-400'
                                                : 'text-green-400'
                                        }`}>
                                            {selectedManager.daysUntilExpiry} يوم
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Last Activity */}
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-sm text-white/60 mb-1">آخر نشاط</p>
                                <p className="text-white">
                                    {selectedManager.lastActivity.toLocaleString('ar-EG')}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                            <button
                                onClick={() => {
                                    setShowManagerDetailsModal(false);
                                    setSelectedManager(null);
                                }}
                                className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                إغلاق
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
    nearestExpiring = null,
    multiBranchData = null,
    managerStats = { active: 0, suspended: 0, deleted: 0, expired: 0, total: 0 },
    activityLogs = [],
    onActivityRefresh,
    demoStats = { total: 0, nearestExpiry: null, farthestExpiry: null }
}) => {
    const { user } = useAuth(); // ✅ Get user for DataHealthReportCard
    const [isBranchesExpanded, setIsBranchesExpanded] = useState(false); // ✅ Collapsed by default, show 5 only
    const [isActivityExpanded, setIsActivityExpanded] = useState(true); // ✅ Activity feed expanded by default
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
                   try {
                       exportToPDF(analytics, 'dashboard-report.pdf');
                   } catch (err) {
                       console.error('PDF export failed:', err);
                   }
               }}
               className="px-2 py-1.5 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs"
               title="تصدير PDF"
                >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">PDF</span>
                </button>
                <button
               onClick={() => {
                   try {
                       exportToExcel(analytics, 'dashboard-report.xlsx');
                   } catch (err) {
                       console.error('Excel export failed:', err);
                   }
               }}
               className="px-2 py-1.5 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs"
               title="تصدير Excel"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Excel</span>
                </button>
            </div>
            
            {/* Critical Alerts - Mobile First */}
            {systemSettings.maintenanceMode && (
                <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                            <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                            <div className="min-w-0 flex-1">
                                <h3 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-0">وضع الصيانة مفعّل</h3>
                                <p className="text-sm sm:text-base text-white/60 leading-relaxed">{systemSettings.maintenanceMessage}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => onMaintenanceToggle(false)}
                            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-500/20 text-green-400 rounded-lg sm:rounded-xl hover:bg-green-500/30 transition-colors border border-green-500/20 text-sm whitespace-nowrap"
                        >
                            إلغاء الصيانة
                        </button>
                    </div>
                </div>
            )}

            {/* Quick Stats - ✅ COMPACT PREMIUM DESIGN */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <StatCard
                    icon={Building2}
                    iconColor="teal"
                    label="إجمالي الفروع"
                    count={allBranches.length}
                />
                <StatCard
                    icon={Users}
                    iconColor="blue"
                    label="إجمالي المستخدمين"
                    count={multiBranchData?.totalUsers || analytics?.totalUsers || 0}
                />
                <StatCard
                    icon={Activity}
                    iconColor="orange"
                    label="إجمالي الطلبات"
                    count={multiBranchData?.totalRequests || analytics?.totalRequestsToday || 0}
                />
                <StatCard
                    icon={DoorOpen}
                    iconColor="green"
                    label="إجمالي الغرف"
                    count={multiBranchData?.totalRooms || 0}
                />
            </div>
            
            {/* ✅ Demo Stats Card - Separate from main stats */}
            {demoStats.total > 0 && (
                <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-500/30 bg-purple-500/10">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-purple-500/20 flex items-center justify-center shadow-lg shadow-purple-500/10 flex-shrink-0">
                            <Sparkles className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                                حسابات الديمو
                            </h3>
                            <p className="text-xl sm:text-2xl font-bold text-purple-400 mb-2">
                                {demoStats.total} حساب
                            </p>
                            <div className="space-y-1 text-xs sm:text-sm text-white/60">
                                {demoStats.nearestExpiry && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                        <span>أقرب انتهاء: {demoStats.nearestExpiry.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                )}
                                {demoStats.farthestExpiry && demoStats.farthestExpiry.getTime() !== demoStats.nearestExpiry?.getTime() && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                        <span>أبعد انتهاء: {demoStats.farthestExpiry.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ✅ Manager Status Cards - Small badges for quick overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="glass rounded-xl p-3 sm:p-4 border border-green-500/30 bg-green-500/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold text-green-400">{managerStats.active}</p>
                            <p className="text-xs text-white/60">مدير نشط</p>
                        </div>
                    </div>
                </div>
                <div className="glass rounded-xl p-3 sm:p-4 border border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                            <Pause className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold text-yellow-400">{managerStats.suspended}</p>
                            <p className="text-xs text-white/60">موقوف مؤقتاً</p>
                        </div>
                    </div>
                </div>
                <div className="glass rounded-xl p-3 sm:p-4 border border-red-500/30 bg-red-500/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <X className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold text-red-400">{managerStats.expired}</p>
                            <p className="text-xs text-white/60">منتهي الترخيص</p>
                        </div>
                    </div>
                </div>
                <div className="glass rounded-xl p-3 sm:p-4 border border-gray-500/30 bg-gray-500/10">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                            <Trash2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                            <p className="text-lg sm:text-xl font-bold text-gray-400">{managerStats.deleted}</p>
                            <p className="text-xs text-white/60">محذوف</p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Revenue Cards - ✅ COMPACT PREMIUM DESIGN */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                <StatCard
                    icon={DollarSign}
                    iconColor="purple"
                    label="إجمالي الإيرادات"
                    value={`${(multiBranchData?.revenue || 0).toLocaleString()} ر.س`}
                />
                <StatCard
                    icon={TrendingUp}
                    iconColor="green"
                    label="MRR الشهرية"
                    value={`${mrr.toLocaleString()} ر.س`}
                />
                <StatCard
                    icon={DollarSign}
                    iconColor="blue"
                    label="ARR السنوية"
                    value={`${arr.toLocaleString()} ر.س`}
                />
                <StatCard
                    icon={Calendar}
                    iconColor="yellow"
                    label="تجديدات الشهر"
                    value={`${monthlyRenewalRevenue.toLocaleString()} ر.س`}
                />
            </div>
            
            {/* Expiring Subscription Alert - Mobile First */}
            {nearestExpiring && (
                <div className="stat-card-pro-compact glass rounded-lg sm:rounded-xl p-3 sm:p-4 border border-yellow-500/30 bg-yellow-500/10">
                    <div className="flex items-start gap-2 sm:gap-3">
                        <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] sm:text-xs text-white/60 mb-1">أقرب اشتراك سوف ينتهي</div>
                            <div className="text-xs sm:text-sm font-bold text-white mb-1 truncate">
                                {nearestExpiring.branchName || nearestExpiring.tenantName || 'فرع'}
                            </div>
                            <div className="text-[10px] sm:text-xs text-yellow-400">
                                باقي له {nearestExpiring.daysUntilExpiry} يوم
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* System Status - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ color: 'var(--theme-text-primary)' }}>حالة النظام</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <StatusItem
                        label="الإصدار"
                        value={systemSettings.systemVersion}
                        icon={Zap}
                        color="blue"
                    />
                    <StatusItem
                        label="معدل الأداء"
                        value={`${analytics?.uptime || 99.9}%`}
                        icon={CheckCircle}
                        color="green"
                    />
                    <StatusItem
                        label="معدل الخطأ"
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
                        className="flex items-center justify-between p-4 sm:p-6 cursor-pointer hover:bg-white/5 transition-colors"
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
                        <div className="p-6">
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
                                                            المدير: {branch.managerName}
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
                                        و {allBranches.length - 5} فرع آخر
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
                                        إخفاء
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Data Health Report - Weekly System Health */}
            <DataHealthReportCard
                tenantId={user?.id || ''}
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
                                📡 البث الحي للنشاط
                            </h3>
                            <p className="text-xs sm:text-sm hidden sm:block" style={{ color: 'var(--theme-text-secondary)' }}>
                                سجل كل الأحداث • اضغط 🔄 للتحديث
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
                            title="تحديث يدوي"
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
                    <div className="p-4 sm:p-6">
                        {activityLogs.length === 0 ? (
                            <div className="text-center py-8">
                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: 'var(--theme-text-primary)' }} />
                                <p style={{ color: 'var(--theme-text-secondary)' }}>لا يوجد نشاط حديث</p>
                                <p className="text-xs mt-2" style={{ color: 'var(--theme-text-tertiary)' }}>
                                    سيظهر هنا كل ما يحدث في النظام
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {activityLogs.map((log, index) => (
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
                                                    👤 {log.userName || 'النظام'}
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
                                🔋 وضع التوفير: تحديث يدوي فقط (صفر استهلاك تلقائي)
                            </p>
                            <div className="flex items-center gap-3">
                                {lastRefreshTime && (
                                    <p className="text-xs" style={{ color: 'var(--theme-text-tertiary)' }}>
                                        آخر تحديث: {formatTimeAgo(lastRefreshTime)}
                                    </p>
                                )}
                                <p className="text-xs font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                                    {activityLogs.length} سجل
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
            tenantName: manager.hotelName || manager.tenantBackup?.info?.name || manager.name || 'غير محدد',
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
            // No filtering, just sorting
            filtered = filtered.filter(t => {
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
                error('لم يتم العثور على بيانات المدير');
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
                        const dept = req.department || 'غير محدد';
                        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
                    });
                    const topDepartment = Object.entries(departmentCounts)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'لا يوجد';

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
            error('حدث خطأ في تحميل بيانات المدير');
        } finally {
            setLoadingDetails(false);
        }
    };

    return (
        <>
            {/* 📍 Contextual Help for Owner */}
            <CreateManagerHelp />
            
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-white">قائمة المستأجرين</h3>
                    <button
                        onClick={onAddManager}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span>إضافة مدير جديد</span>
                    </button>
                </div>

                {/* Filters - Mobile First */}
                <div className="mb-4 space-y-3">
                    {/* Filter Buttons */}
                    <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: 'all' as FilterType, label: 'الكل', icon: Activity },
                            { id: 'active' as FilterType, label: 'النشط', icon: CheckCircle },
                            { id: 'suspended' as FilterType, label: 'الموقوف مؤقتاً', icon: Pause },
                            { id: 'expired' as FilterType, label: 'المنتهي', icon: AlertTriangle },
                            { id: 'expiring' as FilterType, label: 'الأقرب للانتهاء', icon: Clock },
                            { id: 'deleted' as FilterType, label: 'المحذوف', icon: Trash2 }
                        ].map(filter => {
                            const Icon = filter.icon;
                            const isActive = activeFilter === filter.id;
                            const count = filter.id === 'all' 
                                ? tenants.length 
                                : filter.id === 'deleted'
                                ? deletedManagers.length
                                : filter.id === 'expiring'
                                ? tenants.length // Show count of all tenants (will be sorted by expiry)
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
                                    className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-all whitespace-nowrap text-xs sm:text-sm flex-shrink-0 ${
                                        isActive
                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-lg shadow-yellow-500/10'
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/5'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                                    <span>{filter.label}</span>
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive 
                                                ? 'bg-yellow-500/30 text-yellow-300' 
                                                : 'bg-white/10 text-white/70'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search by Name/Code - Mobile First */}
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="ابحث بالاسم أو كود المدير..."
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {filteredTenants.length === 0 ? (
                        <p className="text-center text-white/40 py-8">
                            {searchCode || activeFilter !== 'all' 
                                ? 'لا توجد نتائج للبحث أو الفلتر المحدد' 
                                : 'لا يوجد مستأجرون'}
                        </p>
                    ) : (
                        filteredTenants.map((tenant: TenantAnalytics & { isDeleted?: boolean }) => {
                            // ✅ Check if this is a deleted manager
                            const isDeletedManager = (tenant as any).isDeleted === true || 
                                                     tenant.status === 'deleted' || 
                                                     activeFilter === 'deleted';
                            
                            const statusLabel =
                                isDeletedManager
                                    ? 'محذوف'
                                    : tenant.status === 'active'
                                    ? 'نشط'
                                    : tenant.status === 'suspended'
                                    ? 'موقوف مؤقتاً'
                                    : 'منتهي / غير فعّال';

                            const statusClasses =
                                isDeletedManager
                                    ? 'bg-gray-500/20 text-gray-300 border-gray-500/50'
                                    : tenant.status === 'active'
                                    ? 'bg-green-500/15 text-green-300 border-green-500/40'
                                    : tenant.status === 'suspended'
                                    ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'
                                    : 'bg-red-500/15 text-red-300 border-red-500/40';
                            
                            // ✅ Special card styling for deleted managers
                            const cardClasses = isDeletedManager
                                ? 'bg-gradient-to-r from-red-950/30 via-gray-900/40 to-red-950/30 rounded-lg sm:rounded-xl p-3 sm:p-4 transition-all border-2 border-dashed border-red-500/40 relative overflow-hidden opacity-75 hover:opacity-100'
                                : 'bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-white/10 transition-all';

                            return (
                                <div
                                    key={tenant.tenantId}
                                    className={cardClasses}
                                >
                                    {/* ✅ Deleted indicator stripe */}
                                    {isDeletedManager && (
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/60 via-red-400/80 to-red-500/60" />
                                    )}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-1">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                                                <h4 className="text-base sm:text-lg font-bold text-white truncate w-full sm:w-auto">
                                                    {tenant.tenantName}
                                                </h4>
                                                {tenant.managerName && (
                                                    <span className="text-xs text-white/70 bg-white/10 border border-white/15 rounded-full px-2 py-0.5 truncate self-start sm:self-auto flex items-center gap-1.5">
                                                        <span>المدير: {tenant.managerName}</span>
                                                        {tenant.managerCode && (
                                                            <span className="text-white/50 font-mono">({tenant.managerCode})</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap text-xs sm:text-sm text-white/60">
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
                                            <p className="text-[10px] sm:text-xs text-white/40 mt-1 leading-relaxed">
                                                انتهاء الترخيص:{' '}
                                                <span className="block sm:inline">
                                                {new Date(tenant.licenseExpiryDate).toLocaleDateString('ar-SA', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}{' '}
                                                    هـ
                                                </span>
                                                <span className="hidden sm:inline"> • </span>
                                                <span className="block sm:inline">
                                                    ({tenant.daysUntilExpiry} يوم)
                                                </span>
                                            </p>
                                        </div>
                                    <div className="flex gap-2 self-start sm:self-auto">
                                        {isDeletedManager ? (
                                            // Restore button for deleted managers (in any filter)
                                            <button
                                                onClick={async () => {
                                                    const deletedManager = deletedManagers.find((m: any) => 
                                                        (m.tenantId || m.id) === tenant.tenantId
                                                    );
                                                    if (!deletedManager) {
                                                        error('لم يتم العثور على المدير المحذوف');
                                                        return;
                                                    }
                                                    const confirmed = await customConfirm({
                                                        type: 'info',
                                                        title: 'تأكيد الاستعادة',
                                                        message: 'هل أنت متأكد من استعادة هذا المدير؟',
                                                        confirmText: 'استعادة',
                                                        cancelText: 'إلغاء'
                                                    });
                                                    if (!confirmed) {
                                                        return;
                                                    }
                                                    setProcessing(tenant.tenantId);
                                                    try {
                                                        await restoreManager(deletedManager.id);
                                                        success('تم استعادة المدير بنجاح');
                                                        await onRefresh();
                                                        const updatedDeleted = await getDeletedManagers();
                                                        setDeletedManagers(updatedDeleted);
                                                    } catch (err: any) {
                                                        error(err.message || 'حدث خطأ في الاستعادة');
                                                    } finally {
                                                        setProcessing(null);
                                                    }
                                                }}
                                                disabled={processing === tenant.tenantId}
                                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                title="استعادة المدير"
                                            >
                                                {processing === tenant.tenantId ? (
                                                    <AdoraLoaderInline size={16} />
                                                ) : (
                                                    <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                )}
                                                <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">استعادة</span>
                                            </button>
                                        ) : (
                                            <>
                                        <button
                                            onClick={() => onViewDetails?.(tenant)}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group"
                                            title="عرض التفاصيل الكاملة"
                                        >
                                            <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                                            <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">عرض</span>
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
                                                                        error('لم يتم العثور على المدير المحذوف');
                                                                        return;
                                                                    }
                                                                    const confirmed = await customConfirm({
                                                                        type: 'info',
                                                                        title: 'تأكيد الاستعادة',
                                                                        message: 'هل أنت متأكد من استعادة هذا المدير؟',
                                                                        confirmText: 'استعادة',
                                                                        cancelText: 'إلغاء'
                                                                    });
                                                                    if (!confirmed) {
                                                                        return;
                                                                    }
                                                                    setProcessing(tenant.tenantId);
                                                                    try {
                                                                        await restoreManager(deletedManager.id);
                                                                        success('تم استعادة المدير بنجاح');
                                                                        await onRefresh();
                                                                        const updatedDeleted = await getDeletedManagers();
                                                                        setDeletedManagers(updatedDeleted);
                                                                    } catch (err: any) {
                                                                        error(err.message || 'حدث خطأ في الاستعادة');
                                                                    } finally {
                                                                        setProcessing(null);
                                                                    }
                                                                }}
                                                                disabled={processing === tenant.tenantId}
                                                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                                                title="استعادة المدير"
                                                            >
                                                                {processing === tenant.tenantId ? (
                                                                    <AdoraLoaderInline size={16} />
                                                                ) : (
                                                                    <Upload className="w-4 h-4 transition-transform group-hover:scale-110" />
                                                                )}
                                                                <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">استعادة</span>
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
                                                    error('لم يتم العثور على المدير');
                                                    return;
                                                }
                                                setProcessing(tenant.tenantId);
                                                try {
                                                    await toggleLicenseStatus(manager.id, tenant.tenantId, tenant.status === 'active');
                                                    success(tenant.status === 'active' ? 'تم إيقاف المدير مؤقتاً' : 'تم تفعيل المدير');
                                                    // Refresh data to update statistics and cards
                                                    await onRefresh();
                                                } catch (err: any) {
                                                    error(err.message || 'حدث خطأ');
                                                } finally {
                                                    setProcessing(null);
                                                }
                                            }}
                                            disabled={processing === tenant.tenantId}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            title={tenant.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل'}
                                        >
                                            {tenant.status === 'active' ? (
                                                <Pause className="w-4 h-4 transition-transform group-hover:scale-110" />
                                            ) : (
                                                <Play className="w-4 h-4 transition-transform group-hover:scale-110" />
                                            )}
                                            <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">
                                                {tenant.status === 'active' ? 'إيقاف' : 'تفعيل'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const managers = await getAllManagers();
                                                const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                if (!manager) {
                                                    error('لم يتم العثور على المدير');
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
                                                            title: 'تنبيه',
                                                            message: result.warning,
                                                            confirmText: 'حسناً',
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
                                                    
                                                    success('تم تجديد الاشتراك بنجاح');
                                                    // Refresh data to update statistics, billing cards, and revenue
                                                    await onRefresh();
                                                } catch (err: any) {
                                                    error(err.message || 'حدث خطأ في التجديد');
                                                } finally {
                                                    setProcessing(null);
                                                }
                                            }}
                                            disabled={processing === tenant.tenantId}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            title="تجديد الاشتراك (سنة)"
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
                                                                        title: 'تأكيد الحذف',
                                                                        message: `هل أنت متأكد من حذف المدير "${tenant.managerName || tenant.tenantName}" نهائياً؟\n\nسيتم نقل بياناته لقائمة المحذوفين ويمكن استعادته لاحقاً.`,
                                                                        confirmText: 'حذف',
                                                                        cancelText: 'إلغاء'
                                                                    });
                                                                    if (!confirmed) {
                                                    return;
                                                }
                                                const managers = await getAllManagers();
                                                const manager = managers.find(m => m.tenantId === tenant.tenantId);
                                                if (!manager) {
                                                    error('لم يتم العثور على المدير');
                                                    return;
                                                }
                                                setProcessing(tenant.tenantId);
                                                try {
                                                    await softDeleteManager(manager.id, tenant.tenantId);
                                                    success('تم حذف المدير ونقله لقائمة المحذوفين');
                                                    // Refresh data to update statistics
                                                    await onRefresh();
                                                    const deleted = await getDeletedManagers();
                                                    setDeletedManagers(deleted);
                                                } catch (err: any) {
                                                    error(err.message || 'حدث خطأ في الحذف');
                                                } finally {
                                                    setProcessing(null);
                                                }
                                            }}
                                            disabled={processing === tenant.tenantId}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            title="حذف نهائي"
                                        >
                                            <Trash2 className="w-4 h-4 transition-transform group-hover:scale-110" />
                                            <span className="text-[10px] font-medium opacity-80 group-hover:opacity-100">حذف</span>
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
    const [isFeaturesCollapsed, setIsFeaturesCollapsed] = useState(true);
    const [isCompanyInfoCollapsed, setIsCompanyInfoCollapsed] = useState(true);
    
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
            } catch {}
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
            } catch {}
        }
        return systemSettings.defaultTaxRate ?? 15;
    });
    
    // ✅ Display values are now directly from local state
    const displayPrice = localPrice;
    const displayTax = localTax;
    
    // ✅ Sync from systemSettings if it gets updated externally (but don't overwrite user edits)
    const prevSettingsRef = useRef({ price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate });
    useEffect(() => {
        const prevPrice = prevSettingsRef.current.price;
        const prevTax = prevSettingsRef.current.tax;
        
        // Only update if systemSettings actually changed (not on initial mount)
        if (systemSettings.defaultSubscriptionPrice !== prevPrice && systemSettings.defaultSubscriptionPrice !== undefined) {
            setLocalPrice(systemSettings.defaultSubscriptionPrice);
        }
        if (systemSettings.defaultTaxRate !== prevTax && systemSettings.defaultTaxRate !== undefined) {
            setLocalTax(systemSettings.defaultTaxRate);
        }
        
        prevSettingsRef.current = { price: systemSettings.defaultSubscriptionPrice, tax: systemSettings.defaultTaxRate };
    }, [systemSettings.defaultSubscriptionPrice, systemSettings.defaultTaxRate]);
    
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
        qrCodeGuestPortal: 'يسمح للنزلاء بالوصول إلى لوحة التحكم الخاصة بهم عبر مسح رمز QR. يمكنهم طلب الخدمات، تقديم التقييمات، والتفاعل مع الفندق.',
        pointsSystem: 'نظام تجميع النقاط للموظفين عند إتمام المهام. يمكن للموظفين استبدال النقاط بمكافآت حقيقية.',
        gamification: 'نظام الشارات والرتب والمستويات للموظفين. يشمل الإنجازات، التحديات، ولوحة المتصدرين لتحفيز الموظفين.',
        shiftNotes: 'يسمح للموظفين بتبادل الملاحظات بين الشيفتات. يساعد في التواصل الفعال ونقل المعلومات المهمة.',
        scheduledTasks: 'نظام المهام المجدولة مسبقاً. يسمح بتخطيط المهام وتوزيعها على الموظفين بشكل منظم.',
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
        <div className="space-y-4 sm:space-y-6">
            {/* General Settings Section - Mobile First */}
            <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">الإعدادات العامة</h3>
                <div className="space-y-4 sm:space-y-6">
                    {/* Default Subscription Price */}
                    <div className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-white/80 mb-2">
                                سعر الاشتراك الافتراضي (ر.س)
                            </label>
                            <p className="text-xs text-white/50 mb-3 leading-relaxed">
                                هذا السعر شامل الضريبة، ويتم تطبيقه تلقائياً على الاشتراكات الجديدة فقط. لا يؤثر على الاشتراكات القديمة.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                                <div className="w-full sm:flex-1">
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
                                        placeholder="مثال: 1000"
                                    />
                                </div>

                                <div className="w-full sm:flex-1">
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
                                        placeholder="15"
                                    />
                                </div>

                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => {
                                        onSave({
                                            defaultSubscriptionPrice: displayPrice,
                                            defaultTaxRate: displayTax
                                        });
                                    }}
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <AdoraLoaderInline size={16} />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    حفظ
                                </button>
                            </div>

                            {/* Calculated summary */}
                            {displayPrice > 0 && (
                                <div className="mt-3 text-xs text-white/60 space-y-1 bg-white/5 rounded-xl p-3 border border-white/10">
                                    {(() => {
                                        const total = displayPrice;
                                        const taxRate = displayTax / 100;
                                        // نفترض أن السعر شامل الضريبة
                                        const basePrice = taxRate > 0 ? total / (1 + taxRate) : total;
                                        const taxAmount = total - basePrice;
                                        return (
                                            <>
                                                <p>
                                                    السعر قبل الضريبة: <span className="text-white">{Math.round(basePrice).toLocaleString()} ر.س</span>
                                                </p>
                                                <p>
                                                    قيمة الضريبة ({systemSettings.defaultTaxRate ?? 15}%):{' '}
                                                    <span className="text-white">{Math.round(taxAmount).toLocaleString()} ر.س</span>
                                                </p>
                                                <p>
                                                    إجمالي الاشتراك بعد الضريبة:{' '}
                                                    <span className="text-primary-300 font-semibold">
                                                        {Math.round(total).toLocaleString()} ر.س
                                                    </span>
                                                </p>
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
                                هذه المعلومات ستظهر في جميع المطبوعات (سندات القبض، الفواتير، سندات الصرف)
                            </p>
                        </div>
                    </div>
                    <div className={`p-2 rounded-lg bg-white/5 transition-transform duration-300 flex-shrink-0 ${isCompanyInfoCollapsed ? '' : 'rotate-180'}`}>
                        <ChevronDown className="w-4 h-4 text-white/60" />
                    </div>
                </div>

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out border-t border-white/5 bg-black/20 ${isCompanyInfoCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[2000px] opacity-100'}`}>
                    <div className="p-4 sm:p-6">
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
                                    placeholder="مثال: شركة أدورا لإدارة الفنادق"
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
                                    placeholder="مثال: 302003322600003"
                                />
                            </div>
                            
                            {/* Commercial Registration */}
                            <div>
                                <label className="block text-xs font-medium text-white/70 mb-1.5">
                                    رقم السجل التجاري *
                                </label>
                                <input
                                    type="text"
                                    value={localCommercialRegistration}
                                    onChange={(e) => setLocalCommercialRegistration(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg sm:rounded-xl text-white focus:outline-none focus:border-blue-400 transition-colors text-sm sm:text-base"
                                    placeholder="مثال: 4030284941"
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
                                    placeholder="مثال: جدة - الرويس، شارع الجزيرة بجوار الأطباء المتحدون"
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
                                    placeholder="مثال: +966 12 6076060، +966 570707121"
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
                                    placeholder="مثال: info@adora.com"
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
                                    placeholder="مثال: https://www.adora.com"
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
                                حفظ معلومات الشركة
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
                    <div className="p-4 sm:p-6">
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
                                        <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            enabled 
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                                : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                                        }`}>
                                            {enabled ? 'مفعّلة' : 'معطّلة'}
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed mt-2">{description}</p>
                                </div>
                                <button
                                    onClick={() => onToggleFeature(key, !enabled)}
                                    disabled={saving}
                                    className={`relative w-12 h-7 sm:w-14 sm:h-8 rounded-full transition-colors flex-shrink-0 ${
                                        enabled ? 'bg-green-500' : 'bg-gray-600'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 sm:top-1 sm:left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                                            enabled ? 'translate-x-5 sm:translate-x-6' : ''
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

            {/* ✅ Dynamic Platform Branding Section - Logo & Theme */}
            <DynamicBrandingSection />

            {/* ✅ Developer Branding Section - For Forgot Code & Support Links */}
            <DeveloperBrandingSection />
        </div>
    );
};

// ✅ Dynamic Platform Branding Component (Logo + Theme Color)
const DynamicBrandingSection: React.FC = () => {
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
                        🎨 هذه الإعدادات تغير شكل المنصة بالكامل. اللوجو والألوان ستظهر في صفحة الدخول وجميع الواجهات.
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
                        placeholder="https://example.com/logo.png"
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                        {presetColors.map((preset) => (
                            <button
                                key={preset.name}
                                onClick={() => {
                                    setPrimaryColor(preset.primary);
                                    setSecondaryColor(preset.secondary);
                                }}
                                className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${
                                    primaryColor === preset.primary 
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
                            تم الحفظ ✓
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            حفظ الهوية البصرية
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
    const [isCollapsed, setIsCollapsed] = useState(true); // ✅ Collapsed by default
    const [devPhoneSA, setDevPhoneSA] = useState(localStorage.getItem('adora_dev_phone_sa') || '966570707121');
    const [devPhoneEG, setDevPhoneEG] = useState(localStorage.getItem('adora_dev_phone_eg') || '201500000162');
    const [devEmail, setDevEmail] = useState(localStorage.getItem('adora_dev_email') || '77aayy@gmail.com');
    const [devName, setDevName] = useState(localStorage.getItem('adora_dev_name') || 'Ayman Abo Warda');
    const [devSignature, setDevSignature] = useState(localStorage.getItem('adora_dev_signature') || 'Crafted by Ayman Abo Warda');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        setSaving(true);
        localStorage.setItem('adora_dev_phone_sa', devPhoneSA);
        localStorage.setItem('adora_dev_phone_eg', devPhoneEG);
        localStorage.setItem('adora_dev_email', devEmail);
        localStorage.setItem('adora_dev_name', devName);
        localStorage.setItem('adora_dev_signature', devSignature);
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
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/10 flex-shrink-0">
                        <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-xl font-bold text-white mb-0.5 sm:mb-1">إعدادات المطور</h3>
                        <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                            بيانات الدعم الفني وحقوق الملكية - تظهر في "نسيت الكود" وأسفل الصفحات
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
                            placeholder="966570707121"
                            dir="ltr"
                        />
                        <p className="text-xs text-white/40 mt-1">ادخل الرقم بالمفتاح الدولي بدون + (مثال: 966570707121)</p>
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
                            placeholder="201500000162"
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
                            placeholder="77aayy@gmail.com"
                            dir="ltr"
                        />
                        <p className="text-xs text-white/40 mt-1">يظهر في توقيع المطور أسفل الصفحات</p>
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
                            placeholder="Ayman Abu Warda"
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
                            placeholder="Crafted by Ayman Abu Warda"
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
                                تم الحفظ ✓
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                حفظ إعدادات المطور
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
                title: 'تنبيه',
                message: 'لا توجد تحديثات لبثها. أضف تحديث أولاً.',
                confirmText: 'حسناً',
                showCancel: false,
                type: 'warning'
            });
            return;
        }

        const latestUpdate = updates[0];
        const confirmBroadcast = await customConfirm({
            title: 'بث التحديث',
            message: `هل تريد إرسال إشعار لجميع المستخدمين بخصوص الإصدار ${latestUpdate.version}؟`,
            confirmText: 'بث الآن',
            cancelText: 'إلغاء',
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
                    message: `🚀 تحديث جديد: الإصدار ${latestUpdate.version} متاح الآن! ${latestUpdate.changelog}`
                });
            }

            setBroadcastSent(true);
            setTimeout(() => setBroadcastSent(false), 5000);
        } catch (error) {
            console.error('Error broadcasting update:', error);
            await customConfirm({
                title: 'خطأ',
                message: 'حدث خطأ أثناء بث التحديث',
                confirmText: 'حسناً',
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
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">التحديثات</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        إدارة تحديثات النظام وإصداراته. يمكنك إضافة سجلات التغييرات (Changelog) لكل إصدار جديد مع تحديد التحديثات الحرجة.
                    </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={onAddUpdate}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                    >
                        <Plus className="w-4 h-4 flex-shrink-0" />
                        <span className="hidden sm:inline">إضافة</span>
                    </button>
                    {/* ✅ Global Broadcast Button */}
                    <button
                        onClick={handleBroadcastUpdate}
                        disabled={broadcasting || updates.length === 0}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${
                            broadcastSent 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                        }`}
                    >
                        {broadcasting ? (
                            <AdoraLoaderInline size={16} />
                        ) : broadcastSent ? (
                            <>
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">تم البث</span>
                            </>
                        ) : (
                            <>
                                <Bell className="w-4 h-4 flex-shrink-0" />
                                <span className="hidden sm:inline">بث التحديث</span>
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
                        زر "بث التحديث" يرسل إشعار فوري لجميع المشتركين والموظفين في كل الفروع بخصوص آخر تحديث.
                    </span>
                </p>
            </div>
            <div className="space-y-3">
                {updates.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <Activity className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">لا توجد تحديثات مسجلة حالياً</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            يمكنك إضافة سجلات التحديثات لإعلام المستخدمين بالإصدارات الجديدة والميزات المضافة. 
                            التحديثات الحرجة ستظهر بشكل بارز للمستخدمين.
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
    return (
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">الرسائل العامة</h3>
                    <p className="text-xs sm:text-sm text-white/50 leading-relaxed hidden sm:block">
                        إرسال رسائل عامة لجميع المستخدمين أو مستأجرين محددين. يمكن استخدامها للإعلانات، التنبيهات، أو التحديثات المهمة.
                    </p>
                </div>
                <button
                    onClick={onAddBroadcast}
                    className="w-full sm:w-auto px-3 sm:px-4 py-2 dark:bg-white/10 bg-slate-200/80 dark:text-white text-slate-700 dark:hover:bg-white/20 hover:bg-slate-300/90 border border-slate-300/50 dark:border-white/10 shadow-sm dark:shadow-white/5 hover:shadow-md rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4 flex-shrink-0" />
                    <span className="sm:hidden">إضافة رسالة</span>
                </button>
            </div>
            <div className="space-y-3">
                {broadcasts.length === 0 ? (
                    <div className="text-center py-8 sm:py-12 px-4">
                        <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-white/10 mx-auto mb-4" />
                        <p className="text-white/60 font-medium mb-2 text-sm sm:text-base">لا توجد رسائل عامة حالياً</p>
                        <p className="text-xs sm:text-sm text-white/40 max-w-md mx-auto leading-relaxed">
                            يمكنك إضافة رسائل عامة لإعلام جميع المستخدمين أو مستأجرين محددين بأخبار مهمة، تحديثات النظام، أو تنبيهات خاصة. 
                            الرسائل ستظهر في لوحة التحكم للمستخدمين المستهدفين.
                        </p>
                    </div>
                ) : (
                    broadcasts.map(broadcast => (
                        <div
                            key={broadcast.id}
                            className={`bg-white/5 rounded-lg sm:rounded-xl p-3 sm:p-4 border-l-4 ${
                                broadcast.type === 'error' ? 'border-red-500' :
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
        green: 'text-emerald-500',
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
                <h3 className="text-xl font-bold text-white mb-6">إضافة تحديث جديد</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="رقم الإصدار (مثال: 3.1.0)"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <textarea
                        placeholder="سجل التغييرات"
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
                        <span>تحديث حرج</span>
                    </label>
                    <label className="flex items-center gap-3 text-white/60">
                        <input
                            type="checkbox"
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                        <span>إجبار التحديث</span>
                    </label>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all"
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl text-white hover:from-yellow-600 hover:to-yellow-700 transition-all font-medium"
                        >
                            إضافة
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
                        {loading ? 'جاري التحميل...' : 
                         selectedTenants.length === 0 ? 'اختر المستأجرين' :
                         selectedTenants.length === 1 ? selectedNames[0] :
                         `تم اختيار ${selectedTenants.length} مستأجر`}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-2xl max-h-[250px] overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-4 text-white/60">جاري التحميل...</div>
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
                    تم اختيار {selectedTenants.length} مستأجر: {selectedNames.join('، ')}
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
            alert('يرجى تحديد تاريخ البدء وتاريخ الانتهاء');
            return;
        }
        
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);
        
        // ✅ Check if dates are valid
        if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
            alert('تاريخ غير صالح. يرجى التحقق من تنسيق التاريخ');
            return;
        }
        
        // ✅ Ensure end date is after start date
        if (parsedEndDate <= parsedStartDate) {
            alert('يجب أن يكون تاريخ الانتهاء بعد تاريخ البدء');
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
                <h3 className="text-xl font-bold text-white mb-6">إضافة رسالة عامة</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        placeholder="العنوان"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <textarea
                        placeholder="الرسالة"
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
                        placeholder="تاريخ البدء"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
                    />
                    <input
                        type="datetime-local"
                        placeholder="تاريخ الانتهاء"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-yellow-400"
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
                                                    {role === 'manager' ? 'المشتركين' : role === 'employee' ? 'الموظفين' : 'الموظفين'}
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
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${
                                    targetMode === 'all'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                                }`}
                            >
                                جميع المستأجرين
                            </button>
                            <button
                                type="button"
                                onClick={() => setTargetMode('specific')}
                                className={`flex-1 px-4 py-2 rounded-xl transition-all ${
                                    targetMode === 'specific'
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
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all font-medium"
                        >
                            إضافة
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
    
    // ✅ General State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, authReady } = useAuth();
    const { success: showSuccess, error: showError } = useUX();
    const [conflictingCodes, setConflictingCodes] = useState<Set<string>>(new Set());
    const [checkingCodes, setCheckingCodes] = useState(false);
    
    // ✅ Wizard Navigation
    const canGoNext = () => {
        switch (currentStep) {
            case 1: // Basic Info - اسم المشترك إجباري
                return name.trim().length >= 2 && phone.length >= 9 && code.length === 4 && /^\d+$/.test(code) && !conflictingCodes.has(code);
            case 2: // Branches
                return branchCodes.length > 0;
            case 3: // Subscription
                return true; // Always valid
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
        1: 'البيانات الأساسية',
        2: 'الفروع',
        3: 'الاشتراك والدفع',
        4: 'المراجعة والحفظ'
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
            setError('كود المدير يجب أن يكون 4 أرقام');
            return;
        }
        if (branchCodes.length === 0) {
            setError('يجب إضافة كود فرع واحد على الأقل');
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
            
            // ✅ Create manager with optional isolated Firebase config
            const hasCustomFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
            
            // ✅ FIX: Build clean firebaseConfig object without undefined values
            // Firebase WriteBatch.set() doesn't accept undefined values!
            const cleanFirebaseConfig = hasCustomFirebase ? (() => {
                const config: Record<string, string> = {
                    apiKey: firebaseConfig.apiKey,
                    authDomain: firebaseConfig.authDomain,
                    projectId: firebaseConfig.projectId,
                    storageBucket: firebaseConfig.storageBucket,
                };
                // Only add optional fields if they have actual values
                if (firebaseConfig.messagingSenderId?.trim()) {
                    config.messagingSenderId = firebaseConfig.messagingSenderId.trim();
                }
                if (firebaseConfig.appId?.trim()) {
                    config.appId = firebaseConfig.appId.trim();
                }
                return config;
            })() : undefined;
            
            const managerResult = await createManager({
                name: name.trim() || 'مدير جديد',
                phone: phone.trim(), // ✅ رقم هاتف المدير (إجباري)
                phoneBackup: phoneBackup.trim() || undefined, // ✅ رقم الهاتف الاحتياطي (اختياري)
                code,
                hotelName: hotelName.trim() || undefined,
                maxBranches: branchCodes.length,
                branchCodes: branchCodes.map(b => b.code),
                branchNames: branchNamesMap,
                // ✅ SaaS: Store Firebase config if provided (Isolated Multi-Tenancy)
                firebaseConfig: cleanFirebaseConfig,
            });
            
            // ✅ Get tenantId from manager result
            const tenantId = managerResult.tenantId;
            
            // ✅ Create receipt vouchers for each branch
            const createdVoucherIds: string[] = [];
            if (tenantId && systemSettings) {
                const subscriptionPrice = systemSettings.defaultSubscriptionPrice || 0;
                const taxRate = systemSettings.defaultTaxRate || 15;
                
                // ✅ المبلغ للفرع الواحد × مدة الاشتراك (سنة واحدة = 1x، سنتين = 2x)
                const pricePerBranch = subscriptionPrice * subscriptionDuration;
                
                // إنشاء سند قبض لكل فرع
                for (const branch of branchCodes) {
                    const voucherId = await createReceiptVoucher({
                        tenantId,
                        managerName: name.trim() || 'مدير جديد',
                        managerCode: code,
                        branchCode: branch.code,
                        branchName: branch.name,
                        totalAmount: pricePerBranch, // ✅ المبلغ للفرع الواحد مضروب في مدة الاشتراك
                        subscriptionPrice: subscriptionPrice, // سعر الاشتراك للفرع الواحد (شامل الضريبة) - للسنة الواحدة
                        numberOfBranches: branchCodes.length,
                        subscriptionDuration,
                        paymentMethod, // ✅ طريقة الدفع من النافذة
                        currency: 'SAR',
                        createdBy: user?.id,
                        notes: `سند قبض تلقائي - اشتراك ${subscriptionDuration === 1 ? 'سنة واحدة' : 'سنتين'}`
                    });
                    createdVoucherIds.push(voucherId);
                }
            }
            
            showSuccess('تم إضافة المدير وإنشاء سندات القبض بنجاح');
            
            // ✅ Print vouchers automatically
            if (createdVoucherIds.length > 0) {
                try {
                    // Wait a bit for Firestore to update
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Get the created vouchers
                    const allVouchers = await getAllReceiptVouchers();
                    const vouchersToPrint = allVouchers.filter((v) => createdVoucherIds.includes(v.id));
                    
                    if (vouchersToPrint.length > 0) {
                        // Print function (same as in BillingDashboard)
                        const paymentMethodLabels = {
                            'cash': 'كاش',
                            'credit': 'كريديت',
                            'bank_transfer': 'تحويل بنكي',
                            'deferred': 'مؤجل الدفع'
                        };
                        
                        const printContent = vouchersToPrint.map((voucher) => {
                            const createdAtDate = voucher.createdAt instanceof Date 
                                ? voucher.createdAt 
                                : (voucher.createdAt as Timestamp)?.toDate?.() || new Date();
                            const formattedDate = createdAtDate.toLocaleDateString('ar-SA', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            // ✅ Calculate tax and subtotal
                            const taxRate = 15; // 15% VAT
                            const subtotal = voucher.totalAmount / (1 + taxRate / 100);
                            const taxAmount = voucher.totalAmount - subtotal;
                            
                            return `
                                <div style="page-break-after: always; padding: 0; margin: 0; max-width: 100%;">
                                    <!-- Header Section -->
                                    <div style="background: linear-gradient(135deg, #0D9488 0%, #059669 100%); padding: 20px; text-align: center; color: white;">
                                        <div style="font-size: 28pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">سند قبض</div>
                                        <div style="font-size: 12pt; opacity: 0.95; margin-bottom: 8px;">RECEIPT VOUCHER</div>
                                        <div style="font-size: 11pt; opacity: 0.9; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
                                            رقم السند: <strong>#${voucher.voucherNumber || voucher.id.slice(0, 8)}</strong>
                                        </div>
                                    </div>
                                    
                                    <!-- Content Section -->
                                    <div style="background: #ffffff; padding: 15px; border: 2px solid #e5e7eb; border-top: none;">
                                        <!-- Date & Info Row -->
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                                            <div>
                                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">تاريخ ووقت الإنشاء</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${formattedDate}</div>
                                            </div>
                                            <div style="text-align: left;">
                                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">طريقة الدفع</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${voucher.paymentMethod ? (paymentMethodLabels[voucher.paymentMethod] || 'غير محدد') : 'غير محدد'}</div>
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
                                        
                                        <!-- Calculation Details -->
                                        <div style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                                            <div style="font-size: 9pt; color: #6b7280; margin-bottom: 6px; font-weight: 600;">تفاصيل الحساب:</div>
                                            <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                                                <tr>
                                                    <td style="padding: 3px 0; color: #4b5563;">سعر الاشتراك للفرع الواحد (شامل الضريبة):</td>
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
                                                <tr style="border-top: 1px solid #e5e7eb; margin-top: 4px;">
                                                    <td style="padding: 5px 0 3px 0; color: #4b5563; font-weight: 500;">المجموع قبل الضريبة:</td>
                                                    <td style="padding: 5px 0 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${subtotal.toFixed(2)} ر.س</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 3px 0; color: #4b5563;">ضريبة القيمة المضافة (15%):</td>
                                                    <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${taxAmount.toFixed(2)} ر.س</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <!-- Total Amount Section -->
                                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 12px; border-radius: 8px; border: 2px solid #10b981; text-align: center; margin-bottom: 10px;">
                                            <div style="font-size: 9pt; color: #059669; margin-bottom: 4px; font-weight: 500;">المبلغ الإجمالي (شامل الضريبة)</div>
                                            <div style="font-size: 24pt; color: #047857; font-weight: bold; letter-spacing: 1px;">
                                                ${voucher.totalAmount.toLocaleString()} <span style="font-size: 14pt;">ر.س</span>
                                            </div>
                                        </div>
                                        
                                        <!-- Footer -->
                                        <div style="padding-top: 8px; border-top: 1px dashed #e5e7eb; text-align: center;">
                                            <div style="font-size: 8pt; color: #9ca3af; margin-bottom: 2px;">شكراً لاستخدامكم</div>
                                            <div style="font-size: 9pt; color: #0D9488; font-weight: 600;">نظام إدارة أدورا</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                            printWindow.document.write(`
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
                        }
                    }
                    // ✅ AUTO-PRINT INVOICES AFTER VOUCHERS
                    // Wait for invoices to be created
                    await new Promise(resolve => setTimeout(resolve, 800));
                    
                    // Get the invoices linked to these vouchers
                    const allInvoices = await getAllInvoices();
                    const invoicesToPrint = allInvoices.filter((inv: Invoice) => 
                        createdVoucherIds.includes(inv.receiptVoucherId || '')
                    );
                    
                    if (invoicesToPrint.length > 0) {
                        const paymentMethodLabels = {
                            'cash': 'كاش',
                            'credit': 'كريديت',
                            'bank_transfer': 'تحويل بنكي',
                            'deferred': 'مؤجل الدفع'
                        };
                        
                        const invoicePrintContent = invoicesToPrint.map((invoice: Invoice) => {
                            const issueDateObj = invoice.issueDate instanceof Date 
                                ? invoice.issueDate 
                                : (invoice.issueDate as any)?.toDate?.() || new Date();
                            const formattedDate = issueDateObj.toLocaleDateString('ar-SA', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            
                            const taxRate = 15;
                            const subtotal = invoice.amount / (1 + taxRate / 100);
                            const taxAmount = invoice.amount - subtotal;
                            
                            return `
                                <div style="page-break-after: always; padding: 0; margin: 0; max-width: 100%;">
                                    <!-- Header Section - Invoice Style -->
                                    <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 20px; text-align: center; color: white;">
                                        <div style="font-size: 28pt; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;">فاتورة ضريبية</div>
                                        <div style="font-size: 12pt; opacity: 0.95; margin-bottom: 8px;">TAX INVOICE</div>
                                        <div style="font-size: 11pt; opacity: 0.9; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3);">
                                            رقم الفاتورة: <strong>#${invoice.invoiceNumber || invoice.id.slice(0, 8)}</strong>
                                        </div>
                                    </div>
                                    
                                    <!-- Content Section -->
                                    <div style="background: #ffffff; padding: 15px; border: 2px solid #e5e7eb; border-top: none;">
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                                            <div>
                                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">تاريخ الفاتورة</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${formattedDate}</div>
                                            </div>
                                            <div style="text-align: left;">
                                                <div style="font-size: 9pt; color: #6b7280; margin-bottom: 3px;">حالة الدفع</div>
                                                <div style="font-size: 10pt; color: #22c55e; font-weight: 600;">✅ مدفوعة</div>
                                            </div>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #3b82f6;">
                                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">اسم العميل</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${(invoice as any).managerName || '-'}</div>
                                            </div>
                                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #3b82f6;">
                                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">كود العميل</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${(invoice as any).managerCode || '-'}</div>
                                            </div>
                                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #3b82f6;">
                                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">الفرع</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${(invoice as any).branchName || '-'} (${(invoice as any).branchCode || '-'})</div>
                                            </div>
                                            <div style="background: #f9fafb; padding: 8px; border-radius: 6px; border-right: 3px solid #3b82f6;">
                                                <div style="font-size: 8pt; color: #6b7280; margin-bottom: 3px;">طريقة الدفع</div>
                                                <div style="font-size: 10pt; color: #1f2937; font-weight: 600;">${paymentMethodLabels[invoice.paymentMethod as keyof typeof paymentMethodLabels] || 'غير محدد'}</div>
                                            </div>
                                        </div>
                                        
                                        <!-- Items Table -->
                                        <div style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #e5e7eb;">
                                            <div style="font-size: 9pt; color: #6b7280; margin-bottom: 6px; font-weight: 600;">تفاصيل الفاتورة:</div>
                                            <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
                                                ${invoice.items?.map((item: any) => `
                                                    <tr>
                                                        <td style="padding: 3px 0; color: #4b5563;">${item.description}</td>
                                                        <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${item.price?.toLocaleString()} ر.س</td>
                                                    </tr>
                                                `).join('') || ''}
                                                <tr style="border-top: 1px solid #e5e7eb; margin-top: 4px;">
                                                    <td style="padding: 5px 0 3px 0; color: #4b5563; font-weight: 500;">المجموع قبل الضريبة:</td>
                                                    <td style="padding: 5px 0 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${subtotal.toFixed(2)} ر.س</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 3px 0; color: #4b5563;">ضريبة القيمة المضافة (15%):</td>
                                                    <td style="padding: 3px 0; text-align: left; color: #1f2937; font-weight: 600;">${taxAmount.toFixed(2)} ر.س</td>
                                                </tr>
                                            </table>
                                        </div>
                                        
                                        <!-- Total Amount -->
                                        <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 12px; border-radius: 8px; border: 2px solid #3b82f6; text-align: center; margin-bottom: 10px;">
                                            <div style="font-size: 9pt; color: #2563eb; margin-bottom: 4px; font-weight: 500;">الإجمالي (شامل الضريبة)</div>
                                            <div style="font-size: 24pt; color: #1e40af; font-weight: bold; letter-spacing: 1px;">
                                                ${invoice.amount.toLocaleString()} <span style="font-size: 14pt;">ر.س</span>
                                            </div>
                                        </div>
                                        
                                        <!-- Footer -->
                                        <div style="padding-top: 8px; border-top: 1px dashed #e5e7eb; text-align: center;">
                                            <div style="font-size: 8pt; color: #9ca3af; margin-bottom: 2px;">شكراً لثقتكم</div>
                                            <div style="font-size: 9pt; color: #3b82f6; font-weight: 600;">نظام إدارة أدورا</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('');
                        
                        const invoicePrintWindow = window.open('', '_blank');
                        if (invoicePrintWindow) {
                            invoicePrintWindow.document.write(`
                                <!DOCTYPE html>
                                <html dir="rtl" lang="ar">
                                <head>
                                    <meta charset="UTF-8">
                                    <title>طباعة الفواتير</title>
                                    <style>
                                        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body {
                                            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
                                            padding: 20mm;
                                            direction: rtl;
                                            background: #f9fafb;
                                        }
                                        @page { size: A4; margin: 10mm; }
                                        @media print {
                                            body { padding: 0; background: white; }
                                        }
                                    </style>
                                </head>
                                <body>${invoicePrintContent}</body>
                                </html>
                            `);
                            invoicePrintWindow.document.close();
                            setTimeout(() => {
                                invoicePrintWindow.print();
                            }, 500);
                        }
                    }
                } catch (printError) {
                    console.error('Error printing vouchers/invoices:', printError);
                }
            }
            
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'حدث خطأ');
            showError(err.message || 'حدث خطأ في إضافة المدير');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            {/* Main Card - Uses existing glass-card pattern */}
            <div className="glass-card relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden !p-0">
                
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-theme">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                            <Plus className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: 'var(--theme-text-primary)' }}>إضافة مدير جديد</h3>
                            <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>{stepTitles[currentStep as keyof typeof stepTitles]}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-red-500/20 transition-colors" style={{ color: 'var(--theme-text-secondary)' }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Step Progress */}
                <div className="px-4 py-3 flex gap-2 border-b border-theme">
                    {[1, 2, 3, 4].map((step) => (
                        <div key={step} className="flex-1">
                            <div className={`h-1.5 rounded-full mb-1 ${
                                step < currentStep ? 'bg-teal-500' : 
                                step === currentStep ? 'bg-yellow-500' : 
                                'bg-gray-300 dark:bg-white/10'
                            }`} />
                            <span className="text-[9px] block text-center" style={{ color: step <= currentStep ? 'var(--theme-text-primary)' : 'var(--theme-text-disabled)' }}>
                                {step === 1 ? 'الأساسية' : step === 2 ? 'الفروع' : step === 3 ? 'الاشتراك' : 'المراجعة'}
                            </span>
                        </div>
                    ))}
                </div>
                
                {/* Step Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {/* ==================== STEP 1: Basic Info ==================== */}
                    {currentStep === 1 && (
                        <div className="space-y-4">
                            {/* Subscriber Name - Required */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Users className="w-4 h-4 text-teal-500" />
                                    اسم المشترك
                                    <span className="text-red-500">*</span>
                                </label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="محمد أحمد" required />
                            </div>
                            
                            {/* Phone Numbers - Grid Layout */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Primary Phone */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-4 h-4 text-green-500" />
                                        رقم الهاتف
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} className="input text-left" placeholder="05xxxxxxxx" dir="ltr" />
                                        {phone.length >= 9 && (
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Backup Phone */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                        <MessageSquare className="w-4 h-4 text-blue-400" />
                                        هاتف احتياطي
                                        <span className="text-[10px]" style={{ color: 'var(--theme-text-disabled)' }}>(اختياري)</span>
                                    </label>
                                    <div className="relative">
                                        <input type="tel" value={phoneBackup} onChange={e => setPhoneBackup(e.target.value.replace(/[^0-9+]/g, ''))} className="input text-left" placeholder="05xxxxxxxx" dir="ltr" />
                                        {phoneBackup.length >= 9 && (
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                                <CheckCircle className="w-5 h-5 text-blue-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs -mt-2 mb-2" style={{ color: 'var(--theme-text-disabled)' }}>💡 للتواصل عند نسيان الكود</p>
                            
                            {/* Manager Code */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Shield className="w-4 h-4 text-yellow-500" />
                                    كود المدير
                                    <span className="text-red-500">*</span>
                                    <span style={{ color: 'var(--theme-text-disabled)' }} className="text-[11px]">(4 أرقام)</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => handleCodeChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        className={`input text-center text-2xl font-mono tracking-[0.4em] ${
                                            conflictingCodes.has(code) ? '!border-red-500 !bg-red-500/10' : 
                                            code.length === 4 ? '!border-green-500 !bg-green-500/10' : ''
                                        }`}
                                        placeholder="• • • •"
                                        maxLength={4}
                                    />
                                    {checkingCodes && <div className="absolute left-3 top-1/2 -translate-y-1/2"><AdoraLoaderInline size={18} /></div>}
                                    {!checkingCodes && code.length === 4 && !conflictingCodes.has(code) && (
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2"><CheckCircle className="w-5 h-5 text-green-500" /></div>
                                    )}
                                </div>
                                {error && (error.includes(code) || error.includes('المدير')) && (
                                    <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30">
                                        <p className="text-xs flex items-center gap-1.5 text-red-500"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Hotel/Brand Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Building className="w-4 h-4 text-purple-500" />
                                    اسم الفندق / البراند
                                </label>
                                <input type="text" value={hotelName} onChange={e => setHotelName(e.target.value)} className="input" placeholder="سلسلة فنادق الأهرام" />
                            </div>
                        </div>
                    )}
                    
                    {/* ==================== STEP 2: Branches ==================== */}
                    {currentStep === 2 && (
                        <div className="space-y-4">
                            {/* Info Banner */}
                            <div className="p-3 rounded-xl flex items-center gap-3 bg-blue-500/10 border border-blue-500/30">
                                <Building className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                                    أضف فروع الفندق. كل فرع يحتاج <strong>كود رقمي فريد</strong> من 1-4 أرقام.
                                </p>
                            </div>
                            
                            {/* Add Branch Form */}
                            <div className="glass rounded-xl p-4">
                                <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Plus className="w-4 h-4 text-teal-500" />
                                    إضافة فرع جديد
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={currentBranchCode}
                                        onChange={e => {
                                            let val = e.target.value.replace(/\D/g, '');
                                            if (val.startsWith('0')) val = val.slice(1);
                                            if (val.length > 4) val = val.slice(0, 4);
                                            setCurrentBranchCode(val);
                                        }}
                                        maxLength={4}
                                        className={`input w-20 text-center font-mono text-lg tracking-wider ${conflictingCodes.has(currentBranchCode) ? '!border-red-500' : ''}`}
                                        placeholder="كود"
                                    />
                                    <input
                                        type="text"
                                        value={currentBranchName}
                                        onChange={e => setCurrentBranchName(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddBranch()}
                                        className="input flex-1"
                                        placeholder="اسم الفرع"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddBranch}
                                    disabled={loading || !currentBranchCode.trim() || !currentBranchName.trim()}
                                    className="w-full mt-3 py-3 rounded-xl text-white font-bold disabled:opacity-40 transition-all flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600"
                                >
                                    {loading && checkingCodes ? <AdoraLoaderInline size={18} /> : <><Plus className="w-5 h-5" />إضافة الفرع</>}
                                </button>
                                {error && (error.includes('كود الفرع') || error.includes('مستخدم') || error.includes('الفرع')) && (
                                    <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                                        <p className="text-sm flex items-center gap-2 text-red-500"><AlertTriangle className="w-4 h-4" />{error}</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Branch List */}
                            <div>
                                <label className="flex items-center justify-between text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-purple-500" />الفروع المضافة</span>
                                    {branchCodes.length > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-600">{branchCodes.length} فرع</span>}
                                </label>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {branchCodes.length > 0 ? branchCodes.map((branch, idx) => (
                                        <div key={branch.code} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-lg text-white text-sm flex items-center justify-center font-bold bg-teal-500">{idx + 1}</span>
                                                <div>
                                                    <span className="text-sm font-medium block" style={{ color: 'var(--theme-text-primary)' }}>{branch.name}</span>
                                                    <span className="text-xs font-mono" style={{ color: 'var(--theme-text-disabled)' }}>كود: {branch.code}</span>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveBranch(branch.code)} className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-500/10"><X className="w-4 h-4" /></button>
                                        </div>
                                    )) : (
                                        <div className="text-center py-8 rounded-xl glass border-2 border-dashed">
                                            <Building className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--theme-text-disabled)' }} />
                                            <p className="text-sm" style={{ color: 'var(--theme-text-disabled)' }}>لا توجد فروع مضافة بعد</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* ==================== STEP 3: Subscription & Payment ==================== */}
                    {currentStep === 3 && (
                        <div className="space-y-4">
                            {/* Payment Method */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <CreditCard className="w-4 h-4 text-green-500" />طريقة استلام المبلغ
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'cash', label: 'كاش', icon: '💵' },
                                        { value: 'credit', label: 'كريديت', icon: '💳' },
                                        { value: 'bank_transfer', label: 'تحويل بنكي', icon: '🏦' },
                                        { value: 'deferred', label: 'مؤجل', icon: '⏳' },
                                    ].map((m) => (
                                        <button
                                            key={m.value}
                                            type="button"
                                            onClick={() => setPaymentMethod(m.value as any)}
                                            className={`p-3 rounded-xl font-medium transition-all flex items-center gap-2 border ${
                                                paymentMethod === m.value ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'
                                            }`}
                                            style={{ color: 'var(--theme-text-primary)' }}
                                        >
                                            <span className="text-lg">{m.icon}</span>
                                            <span className="text-sm">{m.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Subscription Duration */}
                            <div>
                                <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--theme-text-secondary)' }}>
                                    <Calendar className="w-4 h-4 text-yellow-500" />مدة الاشتراك
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button type="button" onClick={() => setSubscriptionDuration(1)}
                                        className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 border ${subscriptionDuration === 1 ? 'border-teal-500 bg-teal-500/10' : 'border-theme glass'}`}>
                                        <span className="text-2xl">📅</span>
                                        <span className="font-bold text-sm" style={{ color: 'var(--theme-text-primary)' }}>سنة واحدة</span>
                                    </button>
                                    <button type="button" onClick={() => setSubscriptionDuration(2)}
                                        className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 relative border ${subscriptionDuration === 2 ? 'border-yellow-500 bg-yellow-500/10' : 'border-theme glass'}`}>
                                        <span className="absolute top-1 left-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white">توفير</span>
                                        <span className="text-2xl">📅📅</span>
                                        <span className="font-bold text-sm" style={{ color: 'var(--theme-text-primary)' }}>سنتين</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Price Summary */}
                            {systemSettings && (
                                <div className="glass rounded-xl p-4">
                                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--theme-text-primary)' }}>
                                        <DollarSign className="w-4 h-4 text-yellow-500" />ملخص الحساب
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between items-center"><span style={{ color: 'var(--theme-text-secondary)' }}>سعر الفرع/سنة:</span><span style={{ color: 'var(--theme-text-primary)' }}>{systemSettings.defaultSubscriptionPrice?.toLocaleString() || 0} ر.س</span></div>
                                        <div className="flex justify-between items-center"><span style={{ color: 'var(--theme-text-secondary)' }}>عدد الفروع:</span><span style={{ color: 'var(--theme-text-primary)' }}>{branchCodes.length} فرع</span></div>
                                        <div className="flex justify-between items-center"><span style={{ color: 'var(--theme-text-secondary)' }}>المدة:</span><span style={{ color: 'var(--theme-text-primary)' }}>{subscriptionDuration === 1 ? 'سنة' : 'سنتين'}</span></div>
                                        <div className="pt-2 mt-2 border-t border-theme">
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold" style={{ color: 'var(--theme-text-primary)' }}>الإجمالي:</span>
                                                <span className="text-xl font-bold text-teal-500">{((systemSettings.defaultSubscriptionPrice || 0) * branchCodes.length * subscriptionDuration).toLocaleString()} ر.س</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Firebase Config */}
                            <TenantFirebaseConfig config={firebaseConfig} onChange={setFirebaseConfig} disabled={loading} compact={true} showTestButton={true} onTestResult={(success) => setFirebaseTestPassed(success)} />
                        </div>
                    )}
                    
                    {/* ==================== STEP 4: Review & Save ==================== */}
                    {currentStep === 4 && (
                        <div className="space-y-3">
                            {/* Success Banner */}
                            <div className="p-3 rounded-xl flex items-center gap-3 bg-green-500/10 border border-green-500/30">
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>راجع البيانات قبل <strong>الحفظ النهائي</strong></p>
                            </div>
                            
                            {/* Summary Cards */}
                            <div className="space-y-2">
                                {/* Basic Info */}
                                <div className="glass rounded-xl p-3">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-teal-500"><Users className="w-3.5 h-3.5" />البيانات الأساسية</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>الاسم</span><span style={{ color: 'var(--theme-text-primary)' }}>{name || 'مدير جديد'}</span></div>
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>الهاتف</span><span style={{ color: 'var(--theme-text-primary)' }} dir="ltr">{phone}</span></div>
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>الكود</span><span className="font-mono font-bold text-teal-500">{code}</span></div>
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>البراند</span><span style={{ color: 'var(--theme-text-primary)' }}>{hotelName || '-'}</span></div>
                                    </div>
                                </div>
                                
                                {/* Branches */}
                                <div className="glass rounded-xl p-3">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-purple-500"><Building2 className="w-3.5 h-3.5" />الفروع ({branchCodes.length})</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {branchCodes.map((b, i) => (
                                            <span key={b.code} className="px-2 py-1 rounded-lg text-xs bg-teal-500/10 text-teal-600 border border-teal-500/20">{i + 1}. {b.name} ({b.code})</span>
                                        ))}
                                    </div>
                                </div>
                                
                                {/* Subscription */}
                                <div className="glass rounded-xl p-3 border-yellow-500/30">
                                    <h4 className="text-xs font-bold mb-2 flex items-center gap-2 text-yellow-500"><DollarSign className="w-3.5 h-3.5" />تفاصيل الاشتراك</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>المدة</span><span style={{ color: 'var(--theme-text-primary)' }}>{subscriptionDuration === 1 ? 'سنة' : 'سنتين'}</span></div>
                                        <div><span className="text-xs block" style={{ color: 'var(--theme-text-disabled)' }}>الدفع</span><span style={{ color: 'var(--theme-text-primary)' }}>{paymentMethod === 'cash' ? 'كاش' : paymentMethod === 'credit' ? 'كريديت' : paymentMethod === 'bank_transfer' ? 'بنكي' : 'مؤجل'}</span></div>
                                    </div>
                                    <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 flex justify-between items-center">
                                        <span className="font-bold text-sm" style={{ color: 'var(--theme-text-primary)' }}>الإجمالي:</span>
                                        <span className="text-lg font-bold text-teal-500">{((systemSettings?.defaultSubscriptionPrice || 0) * branchCodes.length * subscriptionDuration).toLocaleString()} ر.س</span>
                                    </div>
                                </div>
                                
                                {firebaseConfig.apiKey && (
                                    <div className="glass rounded-xl p-3">
                                        <div className="text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /><span style={{ color: 'var(--theme-text-secondary)' }}>Firebase منفصل</span></div>
                                    </div>
                                )}
                            </div>
                            
                            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-sm flex items-center gap-2 text-red-500"><AlertTriangle className="w-4 h-4" />{error}</p></div>}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-4 border-t border-theme">
                    <div className="flex gap-3">
                        {currentStep > 1 && (
                            <button type="button" onClick={handleBack} disabled={loading} className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 glass border border-theme" style={{ color: 'var(--theme-text-primary)' }}>
                                <ChevronRight className="w-5 h-5 rotate-180" />رجوع
                            </button>
                        )}
                        {currentStep < TOTAL_STEPS ? (
                            <button type="button" onClick={handleNext} disabled={!canGoNext()} className="flex-1 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all bg-teal-500 hover:bg-teal-600">
                                التالي<ChevronRight className="w-5 h-5" />
                            </button>
                        ) : (
                            <button onClick={handleSubmit} disabled={loading} className="flex-1 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all bg-teal-500 hover:bg-teal-600">
                                {loading ? <AdoraLoaderInline size={20} /> : <><Save className="w-5 h-5" />حفظ وإنشاء</>}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Manager Details Modal Component
const ManagerDetailsModal: React.FC<{
    tenant: TenantAnalytics;
    managerDetails: any;
    loading: boolean;
    onClose: () => void;
}> = ({ tenant, managerDetails, loading, onClose }) => {
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

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
            <div className="glass-card w-full max-w-5xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Users className="w-7 h-7 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">{tenant.tenantName}</h3>
                            <p className="text-sm text-white/60">
                                كود المدير: {managerDetails.manager.code || 'غير متوفر'} • 
                                {managerDetails.branches.length} فرع
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <AdoraLoader size="md" showMessage={false} />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Manager Lifecycle */}
                            <div className="glass rounded-2xl p-6 border border-white/10">
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-blue-400" />
                                    دورة حياة المدير
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-white/60 mb-1">تاريخ إنشاء الحساب</p>
                                        <p className="text-white font-medium">
                                            {createdAt.toLocaleDateString('ar-SA', { 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60 mb-1">مدة الاشتراك</p>
                                        <p className="text-white font-medium">
                                            {Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))} يوم
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60 mb-1">الخطة</p>
                                        <p className="text-white font-medium capitalize">{tenant.plan}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60 mb-1">حالة الترخيص</p>
                                        <p className={`font-medium ${tenant.daysUntilExpiry > 30 ? 'text-green-400' : tenant.daysUntilExpiry > 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {tenant.daysUntilExpiry > 0 ? `${tenant.daysUntilExpiry} يوم متبقي` : 'منتهي'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Branches Tabs */}
                            {managerDetails.branches.length > 1 ? (
                                <div className="glass rounded-2xl p-4 border border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-blue-400" />
                                        الفروع ({managerDetails.branches.length})
                                    </h4>
                                    <div className="flex gap-2 mb-4 overflow-x-auto">
                                        {managerDetails.branches.map((branch: any) => (
                                            <button
                                                key={branch.id}
                                                onClick={() => setActiveBranchTab(branch.id)}
                                                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                                                    activeBranchTab === branch.id
                                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                        : 'bg-white/5 text-white/60 hover:bg-white/10'
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
                                    <div className="glass rounded-2xl p-6 border border-white/10">
                                        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                            <Building2 className="w-5 h-5 text-blue-400" />
                                            {activeBranch.name || activeBranch.id}
                                        </h4>
                                        
                                        {/* Branch Stats */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-sm text-white/60 mb-1">عدد الموظفين</p>
                                                <p className="text-2xl font-bold text-white">{activeBranch.employeesCount || 0}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-sm text-white/60 mb-1">إجمالي الطلبات</p>
                                                <p className="text-2xl font-bold text-white">{activeBranch.totalRequests || 0}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <p className="text-sm text-white/60 mb-1">أكثر الأقسام طلباً</p>
                                                <p className="text-lg font-bold text-white">{activeBranch.topDepartment}</p>
                                            </div>
                                        </div>

                                        {/* Department Breakdown */}
                                        {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                            <div className="mb-6">
                                                <p className="text-sm font-medium text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                                <div className="space-y-2">
                                                    {Object.entries(activeBranch.departmentCounts)
                                                        .sort(([, a], [, b]) => (b as number) - (a as number))
                                                        .map(([dept, count]) => (
                                                            <div key={dept} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                                                <span className="text-white/80">{dept}</span>
                                                                <span className="text-blue-400 font-bold">{count as number}</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Enabled Features */}
                                        {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                            <div>
                                                <p className="text-sm font-medium text-white/80 mb-3">المميزات المفعلة:</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {activeBranch.enabledFeatures.map((feature: string) => (
                                                        <span
                                                            key={feature}
                                                            className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30"
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
                                <div className="glass rounded-2xl p-6 border border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Building2 className="w-5 h-5 text-blue-400" />
                                        {activeBranch.name || activeBranch.id}
                                    </h4>
                                    
                                    {/* Same content as above */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-sm text-white/60 mb-1">عدد الموظفين</p>
                                            <p className="text-2xl font-bold text-white">{activeBranch.employeesCount || 0}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-sm text-white/60 mb-1">إجمالي الطلبات</p>
                                            <p className="text-2xl font-bold text-white">{activeBranch.totalRequests || 0}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-4">
                                            <p className="text-sm text-white/60 mb-1">أكثر الأقسام طلباً</p>
                                            <p className="text-lg font-bold text-white">{activeBranch.topDepartment}</p>
                                        </div>
                                    </div>

                                    {activeBranch.departmentCounts && Object.keys(activeBranch.departmentCounts).length > 0 && (
                                        <div className="mb-6">
                                            <p className="text-sm font-medium text-white/80 mb-3">توزيع الطلبات حسب الأقسام:</p>
                                            <div className="space-y-2">
                                                {Object.entries(activeBranch.departmentCounts)
                                                    .sort(([, a], [, b]) => (b as number) - (a as number))
                                                    .map(([dept, count]) => (
                                                        <div key={dept} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                                                            <span className="text-white/80">{dept}</span>
                                                            <span className="text-blue-400 font-bold">{count as number}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeBranch.enabledFeatures && activeBranch.enabledFeatures.length > 0 && (
                                        <div>
                                            <p className="text-sm font-medium text-white/80 mb-3">المميزات المفعلة:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activeBranch.enabledFeatures.map((feature: string) => (
                                                    <span
                                                        key={feature}
                                                        className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30"
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

export default EnhancedOwnerDashboard;