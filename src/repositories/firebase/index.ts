/**
 * Firebase Repository Implementations
 * Export all Firebase-based repository implementations
 * Adora Hotel Management System V3 - Repository Pattern
 * 
 * @description
 * These implementations use Firebase/Firestore as the data backend.
 * They wrap the existing service functions to provide the repository
 * interface while maintaining:
 * 
 * - Real-time subscriptions (onSnapshot)
 * - Multi-tenant data isolation
 * - Offline persistence
 * - Points/rewards integration
 * 
 * ## Usage:
 * ```typescript
 * // Import repository class
 * import { FirebaseAuthRepository } from './repositories/firebase';
 * 
 * // Or use singleton instances
 * import { authRepository, roomRepository } from './repositories/firebase';
 * 
 * // Use in component
 * const result = await authRepository.loginWithGlobalCode('1234');
 * ```
 * 
 * ## Future Migration:
 * To switch to a different backend:
 * 1. Create new implementation folder (e.g., `repositories/supabase/`)
 * 2. Implement all interfaces from `repositories/interfaces/`
 * 3. Update imports in components to use new implementations
 */

// Auth Repository
export { FirebaseAuthRepository, authRepository } from './FirebaseAuthRepository';

// Room Repository
export { FirebaseRoomRepository, roomRepository } from './FirebaseRoomRepository';

// Request Repository
export { FirebaseRequestRepository, requestRepository } from './FirebaseRequestRepository';

// User Repository
export { FirebaseUserRepository, userRepository } from './FirebaseUserRepository';

// Tenant Repository
export { FirebaseTenantRepository, tenantRepository } from './FirebaseTenantRepository';
