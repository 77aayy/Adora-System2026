/**
 * Firebase User Repository Implementation
 * Implements IUserRepository using Firebase/Firestore
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * This implementation wraps the existing userService functions
 * to provide the IUserRepository interface. Maintains:
 * - PIN-based authentication
 * - Owner/Manager/Employee hierarchy
 * - Branch management
 * - Biometric support
 */

import { IUserRepository, BranchOption, LoginResultWithBranches } from '../interfaces/IUserRepository';
import { User, Department } from '../../types';
import {
    loginWithPin as firebaseLoginWithPin,
    loadAvailableBranches as firebaseLoadAvailableBranches,
    getUserById as firebaseGetUserById,
    getEmployeesByManager as firebaseGetEmployeesByManager,
    createEmployee as firebaseCreateEmployee,
    saveUserBinding as firebaseSaveUserBinding,
    getStoredBranchId as firebaseGetStoredBranchId,
    saveBranchId as firebaseSaveBranchId,
    getLastUsers as firebaseGetLastUsers,
    addToLastUsers as firebaseAddToLastUsers,
    clearLastUsers as firebaseClearLastUsers,
    getDepartmentPath as firebaseGetDepartmentPath,
    isBiometricAvailable as firebaseIsBiometricAvailable,
    verifyBiometric as firebaseVerifyBiometric
} from '../../services/userService';

/**
 * Firebase implementation of IUserRepository
 * 
 * @example
 * ```typescript
 * const userRepo = new FirebaseUserRepository();
 * const user = await userRepo.loginWithPin('1234');
 * ```
 */
export class FirebaseUserRepository implements IUserRepository {
    // ============================================================
    // AUTHENTICATION
    // ============================================================

    async loginWithPin(pin: string, branchId?: string): Promise<LoginResultWithBranches> {
        return firebaseLoginWithPin(pin, branchId);
    }

    async loadAvailableBranches(user: User): Promise<BranchOption[]> {
        return firebaseLoadAvailableBranches(user);
    }

    // ============================================================
    // USER MANAGEMENT
    // ============================================================

    async getUserById(userId: string): Promise<User | null> {
        return firebaseGetUserById(userId);
    }

    async getEmployeesByManager(managerId: string): Promise<User[]> {
        return firebaseGetEmployeesByManager(managerId);
    }

    async createEmployee(data: {
        name: string;
        code: string;
        department: Department;
        branches: string[];
        createdBy: string;
        tenantId?: string;
    }): Promise<string> {
        return firebaseCreateEmployee(data);
    }

    // ============================================================
    // USER BINDING
    // ============================================================

    async saveUserBinding(uid: string, tenantId: string, role: string): Promise<void> {
        return firebaseSaveUserBinding(uid, tenantId, role);
    }

    // ============================================================
    // BRANCH HELPERS
    // ============================================================

    getStoredBranchId(): string | null {
        return firebaseGetStoredBranchId();
    }

    saveBranchId(branchId: string): void {
        firebaseSaveBranchId(branchId);
    }

    getLastUsers(): Array<{ id: string; name: string; department: string }> {
        return firebaseGetLastUsers();
    }

    addToLastUsers(user: User): void {
        firebaseAddToLastUsers(user);
    }

    clearLastUsers(): void {
        firebaseClearLastUsers();
    }

    // ============================================================
    // NAVIGATION
    // ============================================================

    getDepartmentPath(department: string, role?: string): string {
        return firebaseGetDepartmentPath(department, role);
    }

    // ============================================================
    // BIOMETRIC
    // ============================================================

    async isBiometricAvailable(): Promise<boolean> {
        return firebaseIsBiometricAvailable();
    }

    async verifyBiometric(): Promise<{ success: boolean; userId?: string }> {
        return firebaseVerifyBiometric();
    }
}

/**
 * Singleton instance for convenience
 */
export const userRepository = new FirebaseUserRepository();
