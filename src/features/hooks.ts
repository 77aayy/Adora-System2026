/**
 * React Hooks for Feature Modules
 * Custom hooks for easy integration with React components
 * Adora Hotel Management System V2
 */

import { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';

// Import features
import ReceptionFeatures from './reception/receptionAdvancedFeatures';
import HousekeepingFeatures from './housekeeping/housekeepingAdvancedFeatures';
import BellmanFeatures from './bellman/bellmanAdvancedFeatures';
import DashboardFeatures from './dashboard/dashboardAdvancedFeatures';
import MaintenanceFeatures from './maintenance/maintenanceAdvancedFeatures';
import GuestFeatures from './guest/guestAdvancedFeatures';
import ProcurementFeatures from './procurement/procurementAdvancedFeatures';

// ============================================================
// SESSION HOOK
// ============================================================

interface UserSession {
    employeeId: string;
    employeeName: string;
    department: string;
    branchId: string;
    branchName: string;
    hotelId: string;
}

const SESSION_KEY = 'adora_session';

const getStoredSession = (): UserSession | null => {
    const session = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (session) {
        try {
            return JSON.parse(session);
        } catch {
            return null;
        }
    }
    return null;
};

export const useSession = () => {
    const [session, setSession] = useState<UserSession | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const s = getStoredSession();
        setSession(s);
        setLoading(false);
    }, []);

    return { session, loading };
};

// ============================================================
// HOUSEKEEPING HOOKS
// ============================================================

export const useHousekeepingRequests = (branchId: string) => {
    const { tenantId } = useTenant();
    const [cleaning, setCleaning] = useState<any[]>([]);
    const [completed, setCompleted] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = HousekeepingFeatures.subscribeToCleaningRequests(
            tenantId,
            branchId,
            (cleaningReqs: any[], completedReqs: any[]) => {
                setCleaning(cleaningReqs);
                setCompleted(completedReqs);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { cleaning, completed, loading };
};

export const useMinibarItems = (hotelId: string, branchId: string) => {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!hotelId || !branchId) return;

        const loadItems = async () => {
            const minibarItems = await HousekeepingFeatures.loadMinibarItems(hotelId, branchId);
            setItems(minibarItems);
            setLoading(false);
        };

        loadItems();
    }, [hotelId, branchId]);

    return { items, loading };
};

// ============================================================
// BELLMAN HOOKS
// ============================================================

export const useRoomCards = (branchId: string) => {
    const { tenantId } = useTenant();
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = BellmanFeatures.subscribeToRoomCards(
            tenantId,
            branchId,
            (roomCards: any[]) => {
                setCards(roomCards);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { cards, loading };
};

export const useBellmanRequests = (branchId: string) => {
    const { tenantId } = useTenant();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = BellmanFeatures.subscribeToBellmanRequests(
            tenantId,
            branchId,
            (bellmanReqs: any[]) => {
                setRequests(bellmanReqs);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { requests, loading };
};

// ============================================================
// DASHBOARD HOOKS
// ============================================================

export const useEmployees = (hotelId: string, branchId: string) => {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!hotelId || !branchId) return;

        const unsubscribe = DashboardFeatures.subscribeToEmployees(
            hotelId,
            branchId,
            (emps: any[]) => {
                setEmployees(emps);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [hotelId, branchId]);

    return { employees, loading };
};

export const useDashboardStats = (branchId: string) => {
    const { tenantId } = useTenant();
    const [requests, setRequests] = useState<any[]>([]);
    const [stats, setStats] = useState({ newCount: 0, progressCount: 0, completedCount: 0, delayedCount: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = DashboardFeatures.subscribeToTodayRequests(
            tenantId,
            branchId,
            (reqs: any[]) => {
                setRequests(reqs);
                setStats(DashboardFeatures.calculateStats(reqs));
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { requests, stats, loading };
};

export const useLeaderboard = (employees: any[], maxItems: number = 10) => {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    useEffect(() => {
        const sorted = DashboardFeatures.getLeaderboard(employees, maxItems);
        setLeaderboard(sorted);
    }, [employees, maxItems]);

    return leaderboard;
};

// ============================================================
// MAINTENANCE HOOKS
// ============================================================

export const useMaintenanceRequests = (branchId: string) => {
    const { tenantId } = useTenant();
    const [active, setActive] = useState<any[]>([]);
    const [completed, setCompleted] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = MaintenanceFeatures.subscribeToMaintenanceRequests(
            tenantId,
            branchId,
            (activeReqs: any[], completedReqs: any[]) => {
                setActive(activeReqs);
                setCompleted(completedReqs);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { active, completed, loading };
};

// ============================================================
// PROCUREMENT HOOKS
// ============================================================

export const useProcurementRequests = (branchId: string) => {
    const { tenantId } = useTenant();
    const [pending, setPending] = useState<any[]>([]);
    const [purchased, setPurchased] = useState<any[]>([]);
    const [completed, setCompleted] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!branchId || !tenantId) return;

        const unsubscribe = ProcurementFeatures.subscribeToProcurementRequests(
            tenantId,
            branchId,
            (pendingReqs: any[], purchasedReqs: any[], completedReqs: any[]) => {
                setPending(pendingReqs);
                setPurchased(purchasedReqs);
                setCompleted(completedReqs);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [branchId, tenantId]);

    return { pending, purchased, completed, loading };
};

export const useProcurementNotifications = (branchId: string) => {
    const [notifications, setNotifications] = useState<any[]>([]);

    useEffect(() => {
        if (!branchId) return;

        const unsubscribe = ProcurementFeatures.subscribeToNotifications(
            branchId,
            (notifs: any[]) => {
                setNotifications(notifs);
            }
        );

        return () => unsubscribe();
    }, [branchId]);

    return notifications;
};

// ============================================================
// GUEST HOOKS
// ============================================================

export const useGuestSession = (room: string, branch: string) => {
    const [session, setSession] = useState<any>(null);
    const [isValid, setIsValid] = useState(false);

    useEffect(() => {
        const savedSession = GuestFeatures.getSession();
        if (savedSession && GuestFeatures.isSessionValid(savedSession, room, branch)) {
            setSession(savedSession);
            setIsValid(true);
        }
    }, [room, branch]);

    return { session, isValid };
};

export const useActiveRequests = (room: string, branch: string, tenantId?: string) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!room || !branch || !tenantId) return;

        const unsubscribe = GuestFeatures.subscribeToActiveRequests(
            tenantId,
            room,
            branch,
            (reqs: any[]) => {
                setRequests(reqs);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [room, branch, tenantId]);

    return { requests, loading };
};

// ============================================================
// ONLINE STATUS HOOK
// ============================================================

export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

// ============================================================
// EXPORTS
// ============================================================

export default {
    useSession,
    useHousekeepingRequests,
    useMinibarItems,
    useRoomCards,
    useBellmanRequests,
    useEmployees,
    useDashboardStats,
    useLeaderboard,
    useMaintenanceRequests,
    useProcurementRequests,
    useProcurementNotifications,
    useGuestSession,
    useActiveRequests,
    useOnlineStatus
};
