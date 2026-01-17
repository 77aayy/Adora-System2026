/**
 * Statistics Types
 * Type definitions for admin statistics and analytics
 */

export interface DepartmentStats {
    name: string;
    nameAr: string;
    completed: number;
    pending: number;
    avgResponseTime: number;
    rating: number;
    color: string;
}

export interface EmployeePerformance {
    id: string;
    name: string;
    department: string;
    completedRequests: number;
    avgResponseTime: number;
    rating: number;
    points: number;
}

export interface TimeSeriesData {
    date: string;
    requests: number;
    completed: number;
    avgTime: number;
}

export interface RevenueItem {
    productName: string;
    quantity: number;
    revenue: number;
}

export interface KPICardData {
    id: string;
    title: string;
    value: number | string;
    change: number;
    trend: 'up' | 'down' | 'stable';
    icon: React.ReactNode;
    color: string;
    suffix?: string;
}

export interface PayoutStats {
    totalPaid: number;
    pendingRequests: number;
    approvedRequests: number;
}

export interface InventoryAlert {
    id: string;
    itemName: string;
    currentStock: number;
    minStock: number;
    status: 'low' | 'critical' | 'out';
}

export interface StatsPeriod {
    label: string;
    start: Date;
    end: Date;
}
