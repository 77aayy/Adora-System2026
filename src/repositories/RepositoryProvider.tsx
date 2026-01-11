/**
 * Repository Provider - Dependency Injection for Repositories
 * 
 * This module provides React Context-based dependency injection for repositories.
 * It allows components to consume repositories without directly coupling to Firebase.
 * 
 * Future backend migration: Simply swap the implementations in this file.
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';

// Import interfaces
import {
  IAuthRepository,
  IRoomRepository,
  IRequestRepository,
  IUserRepository,
  ITenantRepository
} from './interfaces';

// Import Firebase implementations
import {
  FirebaseAuthRepository,
  FirebaseRoomRepository,
  FirebaseRequestRepository,
  FirebaseUserRepository,
  FirebaseTenantRepository
} from './firebase';

// Repository instances (singleton pattern)
const authRepository = new FirebaseAuthRepository();
const roomRepository = new FirebaseRoomRepository();
const requestRepository = new FirebaseRequestRepository();
const userRepository = new FirebaseUserRepository();
const tenantRepository = new FirebaseTenantRepository();

// Context type
interface RepositoryContextType {
  authRepository: IAuthRepository;
  roomRepository: IRoomRepository;
  requestRepository: IRequestRepository;
  userRepository: IUserRepository;
  tenantRepository: ITenantRepository;
}

// Create context with default values
const RepositoryContext = createContext<RepositoryContextType>({
  authRepository,
  roomRepository,
  requestRepository,
  userRepository,
  tenantRepository
});

// Provider props
interface RepositoryProviderProps {
  children: ReactNode;
  // Optional: Allow injecting custom implementations (useful for testing)
  customAuthRepository?: IAuthRepository;
  customRoomRepository?: IRoomRepository;
  customRequestRepository?: IRequestRepository;
  customUserRepository?: IUserRepository;
  customTenantRepository?: ITenantRepository;
}

/**
 * RepositoryProvider - Wraps the application and provides repository access
 * 
 * Usage:
 * ```tsx
 * <RepositoryProvider>
 *   <App />
 * </RepositoryProvider>
 * ```
 * 
 * For testing with mock repositories:
 * ```tsx
 * <RepositoryProvider customAuthRepository={mockAuthRepo}>
 *   <ComponentUnderTest />
 * </RepositoryProvider>
 * ```
 */
export const RepositoryProvider: React.FC<RepositoryProviderProps> = ({
  children,
  customAuthRepository,
  customRoomRepository,
  customRequestRepository,
  customUserRepository,
  customTenantRepository
}) => {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    authRepository: customAuthRepository || authRepository,
    roomRepository: customRoomRepository || roomRepository,
    requestRepository: customRequestRepository || requestRepository,
    userRepository: customUserRepository || userRepository,
    tenantRepository: customTenantRepository || tenantRepository
  }), [
    customAuthRepository,
    customRoomRepository,
    customRequestRepository,
    customUserRepository,
    customTenantRepository
  ]);

  return (
    <RepositoryContext.Provider value={value}>
      {children}
    </RepositoryContext.Provider>
  );
};

// Custom hooks for consuming repositories

/**
 * useAuthRepository - Access the authentication repository
 * 
 * @example
 * const authRepo = useAuthRepository();
 * const result = await authRepo.loginWithGlobalCode('1234');
 */
export const useAuthRepository = (): IAuthRepository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useAuthRepository must be used within a RepositoryProvider');
  }
  return context.authRepository;
};

/**
 * useRoomRepository - Access the room management repository
 * 
 * @example
 * const roomRepo = useRoomRepository();
 * const unsubscribe = roomRepo.subscribeToRooms(branchId, (rooms) => {
 *   setRooms(rooms);
 * });
 */
export const useRoomRepository = (): IRoomRepository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRoomRepository must be used within a RepositoryProvider');
  }
  return context.roomRepository;
};

/**
 * useRequestRepository - Access the request management repository
 * 
 * @example
 * const requestRepo = useRequestRepository();
 * const requests = await requestRepo.getRequestsByBranch(branchId);
 */
export const useRequestRepository = (): IRequestRepository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRequestRepository must be used within a RepositoryProvider');
  }
  return context.requestRepository;
};

/**
 * useUserRepository - Access the user management repository
 * 
 * @example
 * const userRepo = useUserRepository();
 * const branches = await userRepo.loadAvailableBranches(user);
 */
export const useUserRepository = (): IUserRepository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useUserRepository must be used within a RepositoryProvider');
  }
  return context.userRepository;
};

/**
 * useTenantRepository - Access the tenant management repository
 * 
 * @example
 * const tenantRepo = useTenantRepository();
 * const tenant = await tenantRepo.getTenantById(tenantId);
 */
export const useTenantRepository = (): ITenantRepository => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useTenantRepository must be used within a RepositoryProvider');
  }
  return context.tenantRepository;
};

/**
 * useRepositories - Access all repositories at once
 * 
 * @example
 * const { authRepository, roomRepository } = useRepositories();
 */
export const useRepositories = (): RepositoryContextType => {
  const context = useContext(RepositoryContext);
  if (!context) {
    throw new Error('useRepositories must be used within a RepositoryProvider');
  }
  return context;
};

// Export singleton instances for non-React usage (services, utilities)
export const repositories = {
  auth: authRepository,
  room: roomRepository,
  request: requestRepository,
  user: userRepository,
  tenant: tenantRepository
};

export default RepositoryProvider;
