// Firebase & API Services
export * from './firebase';
export * from './requestService';
export * from './userService';
export * from './roomCardService';
export * from './roomService';
export * from './employeeService';
export * from './productService';
export * from './storageService';
export * from './procurementService';

// Phase 1: Core Utilities
export * from './imageUploadService';
export * from './errorHandlerService';
export * from './historyFilterService';

// Phase 2: Procurement Cart (namespace import to avoid conflicts)
export * as ProcurementCart from './procurementCartService';

// Phase 3: Reports (namespace import to avoid conflicts)
export * as Reports from './reportsService';

// Phase 4: Exception Management
export * from './exceptionService';

// Phase 5: Audit Trail
export * from './auditTrailService';

// Phase 6: Points System
export * from './pointsService';

// Phase 7: Room History (namespace to avoid SessionContext conflict)
export * as RoomHistory from './roomHistoryService';

// Phase 8: Rewards System (Advanced + Gamification)
// Using namespace imports to avoid duplicate exports
export * as AdvancedRewards from './advancedRewardsService';
export * as RewardsSystem from './rewardsSystemService';

// Phase 9: Shift Notes (namespace to avoid SessionContext conflict)
export * as ShiftNotes from './shiftNotesService';

// Phase 10: Smart Search (namespace to avoid SessionContext conflict)
export * as SmartSearch from './smartSearchService';

// Phase 11: Toast Notifications
export * from './toastService';

// Phase 12: UX Effects
export * from './uxEffectsService';

// Phase 13: Connectivity Monitor
export * from './connectivityService';

// Phase 14: Offline Queue
export * from './offlineQueueService';

// Phase 15: Input Validation
export * from './validationService';

// Phase 16: Confirm Dialogs
export * from './confirmService';

// Phase 17: Swipe Gestures
export * from './swipeGesturesService';

// Note: guestProductsService has conflicting exports, import directly when needed
