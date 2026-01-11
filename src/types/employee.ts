/**
 * Employee & User Types
 */

import { Timestamp } from 'firebase/firestore';

export enum Department {
    RECEPTION = 'reception',
    BELLMAN = 'bellman',
    HOUSEKEEPING = 'housekeeping',
    MAINTENANCE = 'maintenance',
    MANAGEMENT = 'management',
    ADMIN = 'admin'
}

export enum EmployeeRole {
    STAFF = 'staff',
    SUPERVISOR = 'supervisor',
    MANAGER = 'manager',
    ADMIN = 'admin'
}

export enum EmployeeStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    ON_LEAVE = 'on_leave',
    SUSPENDED = 'suspended'
}

export interface Employee {
    id: string;
    name: string;
    email: string;
    phone?: string;

    // Work details
    department: Department; // Primary department (for backward compatibility)
    departments?: Department[]; // ✅ NEW: Multiple departments access (if assigned to more than one)
    role: EmployeeRole;
    status: EmployeeStatus;

    // Location
    branch: string;
    hotelId: string;

    // Performance
    points: number; // For compatibility
    currentPoints: number; // Spendable balance
    lifetimePoints: number; // Total earned history
    totalTasks?: number;
    completedTasks?: number;
    averageRating?: number;

    // Shift
    currentShift?: 'morning' | 'evening' | 'night';
    isOnDuty?: boolean;

    // Permissions
    canCreateRequests?: boolean;
    canConfirmRequests?: boolean;
    canAssignRequests?: boolean;
    canViewReports?: boolean;

    // Metadata
    active: boolean;
    joinedAt: Timestamp;
    lastActiveAt?: Timestamp;
    profilePhoto?: string;

    // Settings
    notificationsEnabled?: boolean;
    soundEnabled?: boolean;
    hapticEnabled?: boolean;
    challengeProgress?: import('./index').UserChallengeProgress;
}

export interface EmployeeStats {
    employeeId: string;
    employeeName: string;

    // Today
    todayTasks: number;
    todayCompleted: number;
    todayPoints: number;

    // This week
    weekTasks: number;
    weekCompleted: number;
    weekPoints: number;

    // This month
    monthTasks: number;
    monthCompleted: number;
    monthPoints: number;

    // Performance
    averageResponseTime: number; // minutes
    averageCompletionTime: number; // minutes
    rating: number;

    // Ranking
    rank?: number;
    totalEmployees?: number;
}

export interface Team {
    department: Department;
    members: Employee[];
    supervisor?: Employee;
    totalMembers: number;
    activeMembers: number;
    totalPoints: number;
}
