/**
 * User Repository Interface
 * Defines the contract for user management operations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @interface IUserRepository
 * @description
 * This interface abstracts user authentication and management
 * operations. Supports the Owner → Manager → Employee hierarchy.
 * 
 * ## User Hierarchy:
 * - Owner: System owner, accesses all tenants
 * - Manager: Hotel manager, owns a tenant
 * - Employee: Staff member under a manager
 */

import { User, Department, Branch } from '../../types';

/**
 * Branch selection data
 */
export interface BranchOption {
    id: string;
    code?: string;
    name: string;
    status?: string;
}

/**
 * Login result with branch options
 */
export interface LoginResultWithBranches extends User {
    availableBranches?: BranchOption[];
    preferredBranchId?: string;
}

/**
 * User Repository Interface
 * Provides abstraction for all user-related operations
 */
export interface IUserRepository {
    // ============================================================
    // AUTHENTICATION
    // ============================================================

    /**
     * Authenticates a user with PIN code
     * 
     * ## Business Rules:
     * - Check rate limiting before processing
     * - Verify owner PIN first (hashed comparison)
     * - Then check globalCodes for managers
     * - Then check users collection for employees
     * - Validate user/manager status and license
     * 
     * @param pin - The PIN code entered
     * @param branchId - Optional branch to auto-select
     * @returns User with available branches
     * @throws Error with Arabic message on failure
     */
    loginWithPin(
        pin: string,
        branchId?: string
    ): Promise<LoginResultWithBranches>;

    /**
     * Loads available branches for a user
     * 
     * ## Business Rules:
     * - Owner: Returns empty (accesses all)
     * - Manager: Loads from tenant's branches collection
     * - Employee: Returns from user.branches array
     * - Filters out inactive/deleted branches
     * 
     * @param user - The authenticated user
     * @returns Array of available branch options
     */
    loadAvailableBranches(user: User): Promise<BranchOption[]>;

    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    /**
     * Gets a user by their document ID
     * 
     * @param userId - The user's document ID
     * @returns User object or null
     */
    getUserById(userId: string): Promise<User | null>;

    /**
     * Gets employees created by a specific manager
     * 
     * @param managerId - The manager's user ID
     * @returns Array of employees
     */
    getEmployeesByManager(managerId: string): Promise<User[]>;

    /**
     * Creates a new employee
     * 
     * ## Business Rules:
     * - PIN must be unique across all collections
     * - Associates employee with tenant
     * - Sets initial points to 0
     * 
     * @param data - Employee creation data
     * @returns The created employee's ID
     * @throws Error if PIN is already in use
     */
    createEmployee(data: {
        name: string;
        code: string;
        department: Department;
        branches: string[];
        createdBy: string;
        tenantId?: string;
    }): Promise<string>;

    // ============================================================
    // USER BINDING (Firestore Rules)
    // ============================================================

    /**
     * Saves user binding for security rules
     * 
     * ## Business Rules:
     * - Links Firebase UID to tenant and role
     * - Prevents role escalation
     * - Prevents tenantId changes
     * 
     * @param uid - Firebase anonymous UID
     * @param tenantId - Tenant to bind to
     * @param role - Role to assign
     */
    saveUserBinding(
        uid: string,
        tenantId: string,
        role: string
    ): Promise<void>;

    // ============================================================
    // BRANCH HELPERS
    // ============================================================

    /**
     * Gets the stored branch ID from localStorage
     * @returns Branch ID or null
     */
    getStoredBranchId(): string | null;

    /**
     * Saves branch ID to localStorage
     * @param branchId - Branch ID to save
     */
    saveBranchId(branchId: string): void;

    /**
     * Gets recently logged-in users for quick switch
     * @returns Array of last 3 users
     */
    getLastUsers(): Array<{ id: string; name: string; department: string }>;

    /**
     * Adds a user to the recent users list
     * @param user - User to add
     */
    addToLastUsers(user: User): void;

    /**
     * Clears the recent users list
     */
    clearLastUsers(): void;

    // ============================================================
    // NAVIGATION
    // ============================================================

    /**
     * Gets the navigation path for a user's role/department
     * 
     * @param department - User's department
     * @param role - Optional role override
     * @returns Navigation path string
     */
    getDepartmentPath(department: string, role?: string): string;

    // ============================================================
    // BIOMETRIC
    // ============================================================

    /**
     * Checks if biometric authentication is available
     * @returns True if WebAuthn is supported
     */
    isBiometricAvailable(): Promise<boolean>;

    /**
     * Verifies biometric authentication
     * @returns Success status and optional user ID
     */
    verifyBiometric(): Promise<{ success: boolean; userId?: string }>;
}
