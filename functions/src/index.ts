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

// ✅ Add more functions here as needed
// export { sendWelcomeEmail } from './email/notifications';
// export { processPayment } from './billing/payments';
// export { generateReport } from './reports/generator';
