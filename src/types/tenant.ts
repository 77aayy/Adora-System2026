/**
 * Multi-Tenant Types
 * Type definitions for SaaS multi-tenant system
 * Adora Hotel Management System V3 - Multi-Tenant
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================
// TENANT (Hotel)
// ============================================================

export interface Tenant {
    id: string;
    info: TenantInfo;
    createdAt: Timestamp; // Added based on instruction's Tenant interface snippet
    status: 'active' | 'suspended'; // Phase 16: Payment Wall Check // Added based on instruction's Tenant interface snippet
    expiresAt?: Timestamp; // Phase 16: Payment Wall Check // Added based on instruction's Tenant interface snippet
    branches: string[]; // branch IDs // Added based on instruction's Tenant interface snippet
}

export interface TenantInfo {
    name: string;                // Hotel name
    logoUrl?: string; // Phase 16: White Labeling // Added based on instruction
    primaryColor?: string; // Phase 16: Custom Theme // Added based on instruction
    ownerId: string;             // Manager user ID
    ownerName: string;
    plan: 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'suspended' | 'inactive';
    createdAt: Timestamp;
    createdBy: string;           // Super admin ID
}

// ============================================================
// BRANCH
// ============================================================

export interface Branch {
    id: string;
    tenantId: string;
    name: string;                // e.g., "فرع الكورنيش"
    location?: string;
    status: 'active' | 'inactive';
    createdAt: Timestamp;
}

// ============================================================
// TEAM
// ============================================================

export interface Team {
    id: string;
    tenantId: string;
    name: string;                // e.g., "فريق بيلمان 1"
    department: 'reception' | 'housekeeping' | 'bellman' | 'maintenance';
    branchId: string;
    memberIds: string[];         // Employee IDs
    teamPoints: number;          // Sum of all member points
    status: 'active' | 'inactive';
    createdAt: Timestamp;
}

// ============================================================
// EMPLOYEE (Enhanced User)
// ============================================================

export interface Employee {
    id: string;
    tenantId: string;
    code: string;                // Global unique PIN (e.g., "2222")
    name: string;
    department: 'reception' | 'housekeeping' | 'bellman' | 'maintenance' | 'admin';
    role: string;
    branchId: string;
    teamId?: string;             // Optional team membership
    personalPoints: number;      // Individual points
    status: 'active' | 'suspended' | 'inactive';
    createdAt: Timestamp;
    createdBy: string;           // Manager ID
    lastLogin?: Timestamp;
}

// ============================================================
// GLOBAL CODE LOOKUP
// ============================================================

export interface GlobalCode {
    code: string;                // The PIN (document ID)
    tenantId: string;            // Which hotel
    employeeId: string;          // Which employee
    role: 'employee' | 'manager' | 'super_admin';
    department?: string;
    createdAt: Timestamp;
}

// ============================================================
// SUPER ADMIN
// ============================================================

export interface SuperAdmin {
    uid: string;
    email: string;
    name: string;
    createdAt: Timestamp;
}

// ============================================================
// TENANT-SCOPED ROOM (existing Room + tenantId)
// ============================================================

export interface TenantRoom {
    id: string;
    tenantId: string;
    branchId: string;
    number: string;
    type: 'standard' | 'deluxe' | 'suite' | 'presidential';
    floor: number;
    status: 'ready' | 'occupied' | 'dirty' | 'cleaning' | 'maintenance' | 'blocked';
    currentCard?: string;        // Active room card ID
    createdAt: Timestamp;
}

// ============================================================
// TENANT-SCOPED REQUEST
// ============================================================

export interface TenantRequest {
    id: string;
    tenantId: string;
    branchId: string;
    teamId?: string;             // Optional team assignment

    // Existing request fields
    type: string;
    roomNumber: string;
    status: string;
    priority: string;
    currentDepartment: string;

    assignedTo?: {
        id: string;
        name: string;
        teamId?: string;
    };

    timestamp: Timestamp;
    completedAt?: Timestamp;
}

// ============================================================
// MIGRATION HELPERS
// ============================================================

export interface MigrationResult {
    success: boolean;
    tenantId?: string;
    employeesMigrated: number;
    roomsMigrated: number;
    requestsMigrated: number;
    errors: string[];
}
