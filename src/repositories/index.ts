/**
 * Repositories Module
 * Central export point for all repository interfaces and implementations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @module repositories
 * @description
 * This module provides a clean abstraction layer between the
 * application and the data storage backend (Firebase).
 * 
 * ## Architecture:
 * ```
 * UI Components
 *      ↓
 * Repository Interfaces (contracts)
 *      ↓
 * Firebase Implementations (current)
 *      ↓
 * Firebase/Firestore
 * ```
 * 
 * ## Benefits:
 * - **Testability**: Easy to mock for unit tests
 * - **Flexibility**: Can switch backends without changing UI code
 * - **Clean Code**: Clear separation of concerns
 * - **Documentation**: Interfaces serve as API documentation
 * 
 * ## Usage Example:
 * ```typescript
 * // In a React component
 * import { authRepository, roomRepository } from '@/repositories';
 * 
 * // Login
 * const result = await authRepository.loginWithGlobalCode('1234');
 * 
 * // Subscribe to rooms (real-time)
 * useEffect(() => {
 *   const unsub = roomRepository.subscribeToRooms(
 *     tenantId, branchId, setRooms
 *   );
 *   return () => unsub();
 * }, [tenantId, branchId]);
 * ```
 * 
 * ## Migration Guide:
 * To migrate to a new backend (e.g., Supabase):
 * 
 * 1. Create implementations in `repositories/supabase/`
 * 2. Implement all interfaces from `repositories/interfaces/`
 * 3. Update this file to export new implementations
 * 4. Components using repositories work without changes!
 */

// ============================================================
// INTERFACES (Contracts)
// ============================================================

export type {
    IAuthRepository,
    IRoomRepository,
    IRequestRepository,
    IUserRepository,
    ITenantRepository,
    RoomStats,
    RoomStatsByType,
    RequestStats,
    BranchOption,
    LoginResultWithBranches,
    CreateManagerData,
    CreateManagerResult,
    CreateBranchData
} from './interfaces';

// ============================================================
// FIREBASE IMPLEMENTATIONS (Current Backend)
// ============================================================

export {
    // Classes (for dependency injection)
    FirebaseAuthRepository,
    FirebaseRoomRepository,
    FirebaseRequestRepository,
    FirebaseUserRepository,
    FirebaseTenantRepository,
    
    // Singleton instances (for convenience)
    authRepository,
    roomRepository,
    requestRepository,
    userRepository,
    tenantRepository
} from './firebase';

// ============================================================
// REACT PROVIDER & HOOKS (For Components)
// ============================================================

export {
    // Provider component (wrap your app with this)
    RepositoryProvider,
    
    // Individual hooks for each repository
    useAuthRepository,
    useRoomRepository,
    useRequestRepository,
    useUserRepository,
    useTenantRepository,
    
    // Hook to get all repositories at once
    useRepositories,
    
    // Object with all repositories (non-React usage)
    repositories
} from './RepositoryProvider';
