"use strict";
/**
 * Cloud Functions Entry Point
 * Adora Hotel Management System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.procurementClose = exports.procurementApprove = exports.requestTransferToDepartment = exports.requestComplete = exports.requestConfirmCompletion = exports.checkOutGuest = exports.checkInGuest = exports.processCheckIn = exports.checkRoomAvailability = exports.createManager = exports.setSystemSettings = exports.getSystemSettings = exports.createUserBinding = exports.loginWithPin = exports.checkDemoAccountExpiry = exports.checkExpiredDemoAccounts = exports.revokeUserClaims = exports.getUserCustomClaims = exports.setUserCustomClaims = exports.testTenantConnection = exports.deployTenantFirebase = exports.resetUserRateLimit = exports.secureApiCall = exports.secureLogin = void 0;
// ✅ Import security functions
var rateLimiter_1 = require("./security/rateLimiter");
Object.defineProperty(exports, "secureLogin", { enumerable: true, get: function () { return rateLimiter_1.secureLogin; } });
Object.defineProperty(exports, "secureApiCall", { enumerable: true, get: function () { return rateLimiter_1.secureApiCall; } });
Object.defineProperty(exports, "resetUserRateLimit", { enumerable: true, get: function () { return rateLimiter_1.resetUserRateLimit; } });
// ✅ Tenant Firebase Deployment Functions (SaaS Multi-Tenancy)
var firebaseDeployer_1 = require("./tenant/firebaseDeployer");
Object.defineProperty(exports, "deployTenantFirebase", { enumerable: true, get: function () { return firebaseDeployer_1.deployTenantFirebase; } });
Object.defineProperty(exports, "testTenantConnection", { enumerable: true, get: function () { return firebaseDeployer_1.testTenantConnection; } });
// ✅ Custom Claims Management (CRITICAL for Security Rules)
var customClaims_1 = require("./auth/customClaims");
Object.defineProperty(exports, "setUserCustomClaims", { enumerable: true, get: function () { return customClaims_1.setUserCustomClaims; } });
Object.defineProperty(exports, "getUserCustomClaims", { enumerable: true, get: function () { return customClaims_1.getUserCustomClaims; } });
Object.defineProperty(exports, "revokeUserClaims", { enumerable: true, get: function () { return customClaims_1.revokeUserClaims; } });
// ✅ Demo Auto-Destruct (Daily Check for Expired Demo Accounts)
var demoAutoDestruct_1 = require("./demo/demoAutoDestruct");
Object.defineProperty(exports, "checkExpiredDemoAccounts", { enumerable: true, get: function () { return demoAutoDestruct_1.checkExpiredDemoAccounts; } });
Object.defineProperty(exports, "checkDemoAccountExpiry", { enumerable: true, get: function () { return demoAutoDestruct_1.checkDemoAccountExpiry; } });
// ✅ Authentication Functions (using Admin SDK - bypasses client Rules)
var loginHandler_1 = require("./auth/loginHandler");
Object.defineProperty(exports, "loginWithPin", { enumerable: true, get: function () { return loginHandler_1.loginWithPin; } });
// ✅ User Binding Functions (using Admin SDK - bypasses client Rules)
var userBinding_1 = require("./auth/userBinding");
Object.defineProperty(exports, "createUserBinding", { enumerable: true, get: function () { return userBinding_1.createUserBinding; } });
// ✅ System Settings Functions (using Admin SDK)
var systemSettings_1 = require("./system/systemSettings");
Object.defineProperty(exports, "getSystemSettings", { enumerable: true, get: function () { return systemSettings_1.getSystemSettings; } });
Object.defineProperty(exports, "setSystemSettings", { enumerable: true, get: function () { return systemSettings_1.setSystemSettings; } });
// ✅ Admin Functions (Manager Creation - 100% Automatic)
var managerCreation_1 = require("./admin/managerCreation");
Object.defineProperty(exports, "createManager", { enumerable: true, get: function () { return managerCreation_1.createManager; } });
// ✅ MASTER KEY: Room Operations (Gateway Pattern)
var roomOperations_1 = require("./data/roomOperations");
Object.defineProperty(exports, "checkRoomAvailability", { enumerable: true, get: function () { return roomOperations_1.checkRoomAvailability; } });
Object.defineProperty(exports, "processCheckIn", { enumerable: true, get: function () { return roomOperations_1.processCheckIn; } });
Object.defineProperty(exports, "checkInGuest", { enumerable: true, get: function () { return roomOperations_1.checkInGuest; } });
Object.defineProperty(exports, "checkOutGuest", { enumerable: true, get: function () { return roomOperations_1.checkOutGuest; } });
// ✅ Phase 2: Request actions (tenant-isolated, server-side)
var requestActions_1 = require("./requests/requestActions");
Object.defineProperty(exports, "requestConfirmCompletion", { enumerable: true, get: function () { return requestActions_1.requestConfirmCompletion; } });
Object.defineProperty(exports, "requestComplete", { enumerable: true, get: function () { return requestActions_1.requestComplete; } });
Object.defineProperty(exports, "requestTransferToDepartment", { enumerable: true, get: function () { return requestActions_1.requestTransferToDepartment; } });
// ✅ Phase 4: Procurement actions (tenant-isolated, server-side)
var procurementActions_1 = require("./procurement/procurementActions");
Object.defineProperty(exports, "procurementApprove", { enumerable: true, get: function () { return procurementActions_1.procurementApprove; } });
Object.defineProperty(exports, "procurementClose", { enumerable: true, get: function () { return procurementActions_1.procurementClose; } });
// ✅ Add more functions here as needed
// export { sendWelcomeEmail } from './email/notifications';
// export { processPayment } from './billing/payments';
// export { generateReport } from './reports/generator';
//# sourceMappingURL=index.js.map