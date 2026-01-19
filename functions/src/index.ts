/**
 * Cloud Functions Entry Point
 * Adora Hotel Management System
 */

// ✅ Import security functions
export { 
    secureLogin, 
    secureApiCall, 
    resetUserRateLimit 
} from './security/rateLimiter';

// ✅ Tenant Firebase Deployment Functions (SaaS Multi-Tenancy)
export {
    deployTenantFirebase,
    testTenantConnection
} from './tenant/firebaseDeployer';

// ✅ Custom Claims Management (CRITICAL for Security Rules)
export {
    setUserCustomClaims,
    getUserCustomClaims,
    revokeUserClaims
} from './auth/customClaims';

// ✅ Demo Auto-Destruct (Daily Check for Expired Demo Accounts)
export {
    checkExpiredDemoAccounts,
    checkDemoAccountExpiry
} from './demo/demoAutoDestruct';

// ✅ Authentication Functions (using Admin SDK - bypasses client Rules)
export {
    loginWithPin
} from './auth/loginHandler';

// ✅ System Settings Functions (using Admin SDK)
export {
    getSystemSettings,
    setSystemSettings
} from './system/systemSettings';

// ✅ Admin Functions (Manager Creation - 100% Automatic)
export {
    createManager
} from './admin/managerCreation';

// ✅ MASTER KEY: Room Operations (Gateway Pattern)
export {
    checkRoomAvailability, // 🚀 FIRST FUNCTION - Centralized room availability check
    processCheckIn, // 🎯 RECOMMENDED - Unified check-in (3 steps in 1 transaction)
    checkInGuest, // Legacy - Use processCheckIn instead
    checkOutGuest
} from './data/roomOperations';

// ✅ Add more functions here as needed
// export { sendWelcomeEmail } from './email/notifications';
// export { processPayment } from './billing/payments';
// export { generateReport } from './reports/generator';
