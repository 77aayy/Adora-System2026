/**
 * Type Compatibility Layer
 * Bridges old types with new unified types
 * Allows gradual migration without breaking existing code
 */

import { Timestamp } from 'firebase/firestore';

// New types
import {
    Request as NewRequest,
    RequestType as NewRequestType,
    RequestStatus as NewRequestStatus,
    InspectionReport as NewInspectionReport,
    MaintenanceDetails
} from './request';

import {
    Room as NewRoom,
    RoomStatus as NewRoomStatus,
    RoomType as NewRoomType,
    RoomCard as NewRoomCard
} from './room';

import {
    Employee,
    Department,
    EmployeeRole,
    EmployeeStatus
} from './employee';

// ============================================================
// OLD TYPE DEFINITIONS (for backward compatibility)
// ============================================================

export enum RequestStatus {
    PENDING_RECEPTION = 'PENDING_RECEPTION',
    CONFIRMED = 'CONFIRMED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    MAINTENANCE_PENDING = 'MAINTENANCE_PENDING',
    PENDING_HOUSEKEEPING = 'PENDING_HOUSEKEEPING',
    PENDING_MAINTENANCE = 'PENDING_MAINTENANCE',
    CANCELLED = 'CANCELLED',
    WAITING_PARTS = 'WAITING_PARTS',
    SCHEDULED = 'SCHEDULED', // ✅ Consistency with Enums
    NEEDS_INSPECTION = 'NEEDS_INSPECTION'
}

export interface RequestTimeline {
    created: Date | null;
    confirmed: Date | null;
    startedAt: Date | null;
    completed: Date | null;
}

export interface ConsumedItem {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
}

export interface InspectionReport {
    cleaningType: 'occupied' | 'checkout';
    hasIssues: boolean;
    issueDescription?: string;
    issuePhoto?: string;
    consumedItems: ConsumedItem[];
    consumptionTotal: number;
    pointsEarned: number;
    duration: number;
}

export interface MaintenanceReport {
    description: string;
    beforePhoto?: string;
    afterPhoto?: string;
    partsUsed?: string;
    maintenanceType: 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';
    pointsEarned: number;
    duration: number;
}

export interface ChallengeMilestone {
    day: number;
    rewardPoints: number;
    label: string;
}

export interface ChallengeConfig {
    milestones: ChallengeMilestone[];
    isEnabled: boolean;
    gracePeriodDays: number; // e.g., 1 or 2 days allowed gap before reset
}

export interface UserChallengeProgress {
    currentStreak: number;
    lastLoginDate: string | null; // ISO Date YYYY-MM-DD
    claimedMilestones: number[]; // Array of day numbers
    attendanceHistory: { date: string; attended: boolean; isException?: boolean }[]; // Last 30 days
    allowedWeeklyOffDays: number; // Manager set (1, 2, or 4)
    offDaysUsedThisWeek: number;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    requirement: {
        type: 'tasks' | 'points' | 'streak' | 'manual';
        value: number;
    };
    pointsReward: number;
    category: 'system' | 'manager' | 'performance' | 'rank'; // system/performance = badges, rank = levels
    active: boolean;
    isRepeatable?: boolean; // ✅ Added for cumulative badges (e.g. Star of the Day x5)
    // ✅ Extended for Gamification UI
    color?: string;
    bgColor?: string;
}

export interface EmployeeAchievement {
    id?: string;
    achievementId: string;
    employeeId: string;
    tenantId?: string;
    earnedAt: Date | any; // Firebase Timestamp or Date
    count?: number; // For repeatable achievements
}

export interface Request {
    id: string;
    type: 'cleaning' | 'maintenance' | 'amenities' | 'bellman' | 'vip_service' | 'other';
    status: RequestStatus;
    guestName: string;
    guestIdentity?: string; // ✅ Added for Smart Mismatch Detection
    roomNumber: string;
    details: Record<string, unknown>;
    timestamp: Date;
    timeline: RequestTimeline;
    assignedTo: string | null;
    inspectionReport?: InspectionReport;
    maintenanceReport?: MaintenanceReport;
    beforePhoto?: string;
    // ✅ Controlled Deletion Workflow
    deletionRequest?: {
        requestedBy: string;
        requestedAt: any; // Timestamp
        reason?: string;
    };
    // ✅ Smart Features (Phase 10)
    isPotentialDuplicate?: boolean; // Scenario 2: Duplicate Prevention
    guestStatusAtRequest?: 'active' | 'checked_out'; // Scenario 1: Ghost Order Detector
    // ✅ Bellman Specifics
    needsCart?: boolean;
    guestsInRoom?: boolean;
}

export type RoomStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'out_of_order';
export type RoomType = 'standard' | 'deluxe' | 'suite' | 'presidential';

// ✅ Branch Interface
export interface Branch {
    id: string;
    name: string;
    code: string; // ✅ Mandatory for Login logic
    logoUrl?: string; // Optional branding
    tenantId: string;
    status: 'active' | 'inactive' | 'deleted' | 'scheduled_for_deletion';
}

export interface Room {
    number: string;
    floor: number;
    type: RoomType;
    status: RoomStatus;
    currentGuestId: string | null;
    branchId?: string; // ✅ Multi-tenancy support
    tenantId?: string; // ✅ Multi-tenancy support
    id: string; // ✅ Added for document ID handling
}

export type RoomCardStatus = 'active' | 'checked_out' | 'no_show';

export interface RoomCard {
    id: string;
    roomNumber: string;
    guestName: string;
    guestIdentity?: string;
    guestPhone?: string;
    adults: number;
    children: number;
    status: RoomCardStatus;
    checkInTime: Date;
    checkOutTime?: Date;
    expectedCheckOut?: Date;
    needsCart: boolean;
    createdBy: string;
    notes?: string;
}

export interface CheckInData {
    roomNumber: string;
    guestName: string;
    guestIdentity?: string;
    guestPhone?: string;
    adults: number;
    children: number;
    expectedCheckOut?: Date;
    needsCart?: boolean;
    notes?: string;
    createdBy: string;
}

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
}

export interface TenantLicense {
    id: string; // The "License Key" (e.g., LIC-8823-X)
    hotelName: string;
    status: 'active' | 'suspended';
    plan: 'starter' | 'pro' | 'enterprise';
    // 🧠 THE MAGIC: If present, app switches to this DB. If null, stays on Shared DB.
    dedicatedDbConfig?: FirebaseConfig;
    maxUsers: number;
    expiresAt: Date;
}

export type UserRole = 'owner' | 'manager' | 'employee' | 'staff' | 'admin';

// ✅ UNIFIED USER INTERFACE (SaaS Standard)
export interface User {
    id: string;
    name: string;
    phone?: string; // ✅ رقم هاتف المستخدم/المدير
    phoneBackup?: string; // ✅ رقم الهاتف الاحتياطي
    code: string;
    department: string;
    role: UserRole;
    email?: string;
    avatarUrl?: string; // Added for visual polish

    // Points System
    points: number;         // Legacy points field (mapped to currentPoints)
    currentPoints: number;  // spendable balance
    lifetimePoints: number; // total earned (never resets)

    status: 'active' | 'inactive' | 'on_break';

    // ✅ SaaS REQUIRED FIELDS
    tenantId: string;       // ✅ REQUIRED: Tenant ID for data isolation

    // ✅ Branch Management
    branches: string[];     // ✅ REQUIRED: Array of Accessible Branch Codes/IDs
    activeBranchId?: string | null;  // ✅ REQUIRED: Currently active branch context

    // Legacy mapping (Deprecated, use activeBranchId)
    branch?: string;
    branchId?: string;

    // Creation Info
    createdBy?: string;     // Who created this user (manager ID)

    // ✅ Gamification
    challengeProgress?: UserChallengeProgress;

    // ✅ Manager/Owner Specific Fields (Previously ExtendedUser)
    hotelName?: string;
    maxBranches?: number;
    branchNames?: Record<string, string>; // Map of code -> name

    // ✅ License Info
    licenseExpiry?: Timestamp | Date;
    licenseStatus?: 'active' | 'suspended' | 'expired';
    autoRenew?: boolean;
    paymentStatus?: 'paid' | 'pending' | 'overdue';

    // ✅ Available branches (loaded at login for selection)
    availableBranches?: Array<{ id: string; code?: string; name: string }>;
}

export interface PayoutRequest {
    id: string;
    userId: string;
    userName: string;
    userDepartment: string;
    pointsAmount: number;    // How many points being redeemed
    monetaryValue: number;   // SAR value at time of request
    exchangeRate: number;    // Rate used for calculation
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;          // Timestamp
    processedAt?: any;
    processedBy?: string;
}

export interface WalletTransaction {
    id: string;
    userId: string;
    type: 'earn' | 'redeem' | 'adjustment';
    points: number;
    description: string;     // e.g., "Cleaning Room 101" or "Payout Request"
    createdAt: any;
}

export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    category: string;
}

export type MaintenanceCategory = 'electrical' | 'plumbing' | 'ac' | 'furniture' | 'other';

// ✅ Points Configuration Types (Added for pointsService consistency)
export interface DepartmentConfig {
    // Reception
    create?: number;
    confirm?: number;
    complete?: number;
    targetConfirmationTime?: number;
    lateConfirmationTime?: number;
    veryLateConfirmationTime?: number;
    lateConfirmationPenalty?: number;
    veryLateConfirmationPenalty?: number;

    // Housekeeping/Maintenance/Bellman
    start?: number;
    completeOccupied?: number;
    completeCheckout?: number;
    inspection?: number;
    fast?: number;
    fastTime?: number;
    delay?: number;
    delayTime?: number;

    // Procurement
    purchase?: number;
    receive?: number;
    early?: number;
    ontime?: number;
    targetTime?: number;
    targetTimeHousekeeping?: number;
    targetTimeMaintenance?: number;
    targetTimeReception?: number;

    // Bellman specific
    checkin?: number;
    checkout?: number;
}

export interface FullPointsConfig {
    reception: DepartmentConfig;
    housekeeping: DepartmentConfig;
    maintenance: DepartmentConfig;
    bellman: DepartmentConfig;
    procurement: DepartmentConfig;
    ratings: {
        enabled: boolean;
        excellent: number;
        veryGood: number;
        good: number;
        fair: number;
        poor: number;
    };
    financial: {
        exchangeRate: number;
        minRedemption: number;
    };
    shiftHandover: {
        acknowledgeNote: number;
    };
}


// ============================================================
// HELPER FUNCTIONS - Convert between old and new types
// ============================================================

/**
 * Convert new Request to old Request format
 */
export function toOldRequest(newReq: NewRequest): Request {
    return {
        id: newReq.id,
        type: newReq.type as any,
        status: newReq.status as any,
        guestName: newReq.guestName,
        roomNumber: newReq.roomNumber,
        details: newReq.details || {},
        timestamp: newReq.createdAt?.toDate ? newReq.createdAt.toDate() : new Date(),
        timeline: {
            created: newReq.createdAt?.toDate ? newReq.createdAt.toDate() : null,
            confirmed: newReq.confirmedAt?.toDate ? newReq.confirmedAt.toDate() : null,
            startedAt: newReq.startedAt?.toDate ? newReq.startedAt.toDate() : null,
            completed: newReq.completedAt?.toDate ? newReq.completedAt.toDate() : null,
        },
        assignedTo: newReq.assignedTo?.id || null,
        inspectionReport: newReq.inspectionReport as any,
        maintenanceReport: newReq.maintenanceDetails as any,
    };
}

/**
 * Convert new Room to old Room format
 */
export function toOldRoom(newRoom: NewRoom): Room {
    return {
        id: newRoom.id,
        number: newRoom.roomNumber,
        floor: newRoom.floor,
        type: newRoom.type as any,
        status: newRoom.status as any,
        currentGuestId: newRoom.currentGuestId || null,
        branchId: newRoom.branch, // Map branch -> branchId
        tenantId: newRoom.hotelId // Map hotelId -> tenantId
    };
}

/**
 * Convert Employee to old User format
 */
export function toOldUser(employee: Employee): User {
    // Map EmployeeRole to User role
    // Using loose conversion to satisfy the type
    const roleMap: Record<string, UserRole> = {
        'admin': 'admin',
        'manager': 'manager',
        'supervisor': 'admin',
        'staff': 'staff',
        'owner': 'owner'
    };

    const branchList = employee.branch ? [employee.branch] : [];

    return {
        id: employee.id,
        name: employee.name,
        code: employee.id, // Use id as code
        department: employee.department,
        role: roleMap[employee.role] || 'staff',
        points: employee.points,
        currentPoints: employee.currentPoints || 0,
        lifetimePoints: employee.lifetimePoints || 0,
        status: employee.status === EmployeeStatus.ACTIVE ? 'active' : 'inactive',
        // ✅ SaaS Fields
        tenantId: employee.hotelId || 'unknown',
        branches: branchList,
        activeBranchId: employee.branch || null,
        branch: employee.branch,
        branchId: employee.branch,
    };
}

// Re-export new types under different names for gradual adoption
export type {
    NewRequest,
    NewRoom,
    Employee,
    Department,
    EmployeeRole,
    EmployeeStatus,
    NewRoomCard
};

export {
    NewRequestType,
    NewRequestStatus,
    NewRoomStatus,
    NewRoomType
};

// Re-export employee types (including Department enum)
export {
    Department,
    EmployeeRole,
    EmployeeStatus
} from './employee';

// Re-export auth types
export type {
    LoginResult,
    PinLoginResult,
    AuthContextState,
    SessionData,
    RateLimitResult,
    BiometricResult,
    UserBinding
} from './auth';
