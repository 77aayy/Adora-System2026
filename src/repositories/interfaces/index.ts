/**
 * Repository Interfaces
 * Export all repository interface definitions
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * These interfaces define the contract between the application
 * and the data layer. They enable:
 * 
 * - **Backend Independence**: Switch from Firebase to any other
 *   backend by implementing these interfaces
 * 
 * - **Testing**: Mock implementations for unit tests
 * 
 * - **Clear API**: Consistent data access patterns across the app
 * 
 * ## Usage:
 * ```typescript
 * // Import interface
 * import { IAuthRepository } from './repositories/interfaces';
 * 
 * // Import Firebase implementation
 * import { FirebaseAuthRepository } from './repositories/firebase';
 * 
 * // Use in component/service
 * const authRepo: IAuthRepository = new FirebaseAuthRepository();
 * const result = await authRepo.loginWithGlobalCode('1234');
 * ```
 */

// Auth Repository
export type { IAuthRepository } from './IAuthRepository';

// Room Repository
export type { 
    IRoomRepository, 
    RoomStats, 
    RoomStatsByType 
} from './IRoomRepository';

// Request Repository
export type { 
    IRequestRepository, 
    RequestStats 
} from './IRequestRepository';

// User Repository
export type { 
    IUserRepository, 
    BranchOption, 
    LoginResultWithBranches 
} from './IUserRepository';

// Tenant Repository
export type { 
    ITenantRepository, 
    CreateManagerData, 
    CreateManagerResult, 
    CreateBranchData 
} from './ITenantRepository';
