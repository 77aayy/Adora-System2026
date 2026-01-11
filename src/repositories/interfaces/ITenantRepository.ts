/**
 * Tenant Repository Interface
 * Defines the contract for multi-tenant management operations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @interface ITenantRepository
 * @description
 * This interface abstracts tenant (hotel) management operations
 * in the SaaS multi-tenant architecture. Each tenant is an
 * isolated hotel with its own data.
 * 
 * ## Tenant Structure:
 * - Tenant: The hotel entity
 * - Branches: Physical locations within a hotel
 * - Employees: Staff members under the tenant
 */

import { Tenant, Branch, Employee } from '../../types/tenant';
import { Timestamp } from 'firebase/firestore';

/**
 * Manager creation data
 */
export interface CreateManagerData {
    name: string;
    phone: string;
    code: string;
    hotelName?: string;
    maxBranches?: number;
    branchCodes?: string[];
    branchNames?: Record<string, string>;
    firebaseConfig?: {
        apiKey: string;
        authDomain: string;
        projectId: string;
        storageBucket: string;
        messagingSenderId?: string;
        appId?: string;
    };
}

/**
 * Manager creation result
 */
export interface CreateManagerResult {
    managerId: string;
    tenantId: string;
}

/**
 * Branch creation data
 */
export interface CreateBranchData {
    tenantId: string;
    code: string;
    name: string;
    createdBy: string;
}

/**
 * Tenant Repository Interface
 * Provides abstraction for all tenant-related operations
 */
export interface ITenantRepository {
    // ============================================================
    // TENANT MANAGEMENT
    // ============================================================

    /**
     * Gets a tenant by ID
     * 
     * @param tenantId - Tenant document ID
     * @returns Tenant object or null
     */
    getTenant(tenantId: string): Promise<Tenant | null>;

    /**
     * Gets all tenants (Owner only)
     * 
     * @returns Array of all tenants
     */
    getAllTenants(): Promise<Tenant[]>;

    /**
     * Updates tenant information
     * 
     * @param tenantId - Tenant to update
     * @param data - Partial tenant data
     */
    updateTenant(
        tenantId: string,
        data: Partial<Tenant>
    ): Promise<void>;

    // ============================================================
    // MANAGER MANAGEMENT
    // ============================================================

    /**
     * Creates a new manager with isolated tenant
     * 
     * ## Business Rules:
     * - Creates new tenant for the manager
     * - Registers PIN in globalCodes
     * - Creates branches based on branchCodes
     * - Sets up initial configuration
     * 
     * @param data - Manager creation data
     * @returns Manager ID and Tenant ID
     * @throws Error if PIN already exists
     */
    createManager(data: CreateManagerData): Promise<CreateManagerResult>;

    /**
     * Gets all managers (Owner only)
     * 
     * @returns Array of all managers
     */
    getAllManagers(): Promise<any[]>;

    /**
     * Suspends a manager account
     * 
     * ## Side Effects:
     * - Sets manager status to 'suspended'
     * - Blocks all employees under the manager
     * 
     * @param managerId - Manager to suspend
     */
    suspendManager(managerId: string): Promise<void>;

    /**
     * Reactivates a suspended manager
     * 
     * @param managerId - Manager to reactivate
     */
    reactivateManager(managerId: string): Promise<void>;

    /**
     * Deletes a manager (soft delete)
     * 
     * ## Side Effects:
     * - Sets status to 'deleted'
     * - Cancels all active requests
     * - Blocks all employees
     * 
     * @param managerId - Manager to delete
     */
    deleteManager(managerId: string): Promise<void>;

    // ============================================================
    // BRANCH MANAGEMENT
    // ============================================================

    /**
     * Gets branches for a tenant
     * 
     * @param tenantId - Tenant to get branches for
     * @returns Array of branches
     */
    getBranches(tenantId: string): Promise<Branch[]>;

    /**
     * Creates a new branch under a tenant
     * 
     * @param data - Branch creation data
     * @returns The created branch ID
     */
    createBranch(data: CreateBranchData): Promise<string>;

    /**
     * Updates a branch
     * 
     * @param tenantId - Tenant the branch belongs to
     * @param branchId - Branch to update
     * @param data - Partial branch data
     */
    updateBranch(
        tenantId: string,
        branchId: string,
        data: Partial<Branch>
    ): Promise<void>;

    /**
     * Deletes a branch (soft delete)
     * 
     * ## Side Effects:
     * - Sets status to 'scheduled_for_deletion'
     * - Cancels all active requests for the branch
     * 
     * @param tenantId - Tenant the branch belongs to
     * @param branchId - Branch to delete
     */
    deleteBranch(
        tenantId: string,
        branchId: string
    ): Promise<void>;

    // ============================================================
    // EMPLOYEE MANAGEMENT (Tenant-scoped)
    // ============================================================

    /**
     * Gets employees for a tenant
     * 
     * @param tenantId - Tenant to get employees for
     * @param branchId - Optional branch filter
     * @returns Array of employees
     */
    getEmployees(
        tenantId: string,
        branchId?: string
    ): Promise<Employee[]>;

    /**
     * Creates an employee under a tenant
     * 
     * @param tenantId - Tenant the employee belongs to
     * @param data - Employee creation data
     * @returns The created employee ID
     */
    createTenantEmployee(
        tenantId: string,
        data: Omit<Employee, 'id' | 'createdAt'>
    ): Promise<string>;

    /**
     * Updates an employee
     * 
     * @param tenantId - Tenant the employee belongs to
     * @param employeeId - Employee to update
     * @param data - Partial employee data
     */
    updateEmployee(
        tenantId: string,
        employeeId: string,
        data: Partial<Employee>
    ): Promise<void>;

    // ============================================================
    // LICENSE MANAGEMENT
    // ============================================================

    /**
     * Extends manager's license
     * 
     * @param managerId - Manager to extend license for
     * @param months - Number of months to extend
     */
    extendLicense(
        managerId: string,
        months: number
    ): Promise<void>;

    /**
     * Gets managers with expiring licenses
     * 
     * @param daysThreshold - Days until expiry threshold
     * @returns Array of managers with expiring licenses
     */
    getExpiringLicenses(daysThreshold: number): Promise<any[]>;

    // ============================================================
    // PIN MANAGEMENT
    // ============================================================

    /**
     * Checks if a PIN is available
     * 
     * @param pin - PIN to check
     * @returns True if available
     */
    isPinAvailable(pin: string): Promise<boolean>;

    /**
     * Suggests a unique PIN
     * 
     * @returns A unique 4-digit PIN
     */
    suggestUniquePin(): Promise<string>;
}
