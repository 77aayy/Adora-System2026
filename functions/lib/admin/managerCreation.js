"use strict";
/**
 * ✅ Cloud Function: createManager
 * Handles manager creation with Admin SDK (bypasses client Rules)
 * Everything is AUTOMATIC - no manual steps needed!
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManager = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * ✅ AUTOMATIC Manager Creation via Cloud Function
 * Uses Admin SDK - 100% reliable, no Rules issues
 */
exports.createManager = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    try {
        // ✅ Require authentication (Owner only)
        if (!context.auth) {
            return {
                success: false,
                error: 'Authentication required'
            };
        }
        // ✅ Check if user is owner
        const userBindingsDoc = await db.collection('userBindings').doc(context.auth.uid).get();
        let isOwner = false;
        if (userBindingsDoc.exists) {
            const bindingData = userBindingsDoc.data();
            isOwner = bindingData.role === 'owner';
        }
        // Also check custom claims
        if (!isOwner) {
            try {
                const userRecord = await admin.auth().getUser(context.auth.uid);
                isOwner = ((_a = userRecord.customClaims) === null || _a === void 0 ? void 0 : _a.role) === 'owner' ||
                    ((_b = userRecord.customClaims) === null || _b === void 0 ? void 0 : _b.super_admin) === true;
            }
            catch (e) {
                // Ignore
            }
        }
        if (!isOwner) {
            return {
                success: false,
                error: 'Unauthorized: Owner access required'
            };
        }
        // ✅ Validate PIN availability (check globalCodes + users)
        const globalCodeDoc = await db.collection('globalCodes').doc(data.code).get();
        if (globalCodeDoc.exists) {
            // Generate available suggestion
            let suggestedCode = '';
            for (let i = 1000; i < 10000; i++) {
                const testCode = i.toString();
                const testDoc = await db.collection('globalCodes').doc(testCode).get();
                if (!testDoc.exists) {
                    // Also check users collection
                    const usersSnapshot = await db.collection('users').where('code', '==', testCode).limit(1).get();
                    if (usersSnapshot.empty) {
                        suggestedCode = testCode;
                        break;
                    }
                }
            }
            return {
                success: false,
                error: `هذا الكود مستخدم بالفعل.${suggestedCode ? ` كود مقترح: ${suggestedCode}` : ' يرجى تجربة كود آخر'}`
            };
        }
        // ✅ Validate branch codes availability
        if (data.branchCodes && data.branchCodes.length > 0) {
            for (const bCode of data.branchCodes) {
                if (bCode === data.code)
                    continue; // Skip master PIN
                const branchCodeDoc = await db.collection('globalCodes').doc(bCode).get();
                if (branchCodeDoc.exists) {
                    return {
                        success: false,
                        error: `كود الفرع "${bCode}" مستخدم بالفعل. يرجى اختيار كود آخر.`
                    };
                }
            }
        }
        // ✅ Validate branch codes exist
        if (!data.branchCodes || data.branchCodes.length === 0) {
            return {
                success: false,
                error: 'يجب تحديد فرع واحد على الأقل'
            };
        }
        // ✅ Create manager with batch write (atomic)
        const batch = db.batch();
        const managerId = `manager-${Date.now()}`;
        const tenantId = `tenant-${Date.now()}`;
        const hotelName = data.hotelName || `فندق ${data.name}`;
        // Calculate expiry
        const now = new Date();
        const expiryDate = new Date(now);
        if (data.isDemo && data.demoDuration) {
            expiryDate.setMonth(expiryDate.getMonth() + data.demoDuration);
        }
        else {
            expiryDate.setFullYear(expiryDate.getFullYear() + (data.subscriptionDuration || 1));
        }
        // 1. Create tenant
        const tenantRef = db.collection('tenants').doc(tenantId);
        batch.set(tenantRef, {
            info: {
                name: hotelName,
                ownerId: managerId,
                ownerName: data.name,
                plan: 'pro',
                status: 'active',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'owner',
                maxBranches: data.maxBranches || 1,
                branchCodes: data.branchCodes || [],
                licenseExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
                licenseStatus: 'active',
                autoRenew: !data.isDemo,
                lastRenewalDate: admin.firestore.Timestamp.now(),
                paymentStatus: data.isDemo ? 'paid' : 'pending',
                isDemo: data.isDemo || false,
                branchNames: data.branchNames || {},
                firebaseConfig: data.firebaseConfig ? Object.fromEntries(Object.entries(data.firebaseConfig).filter(([, v]) => v !== undefined && v !== '')) : null,
                hasIsolatedDatabase: Boolean(data.firebaseConfig),
            }
        });
        // 2. Create manager user
        const managerRef = db.collection('users').doc(managerId);
        batch.set(managerRef, {
            id: managerId,
            name: data.name,
            phone: data.phone || '',
            phoneBackup: data.phoneBackup || '',
            code: data.code,
            department: 'admin',
            role: 'manager',
            tenantId: tenantId,
            activeBranchId: null,
            branches: [],
            branch: null,
            branchId: null,
            points: 0,
            currentPoints: 0,
            lifetimePoints: 0,
            status: 'active',
            licenseExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
            licenseStatus: 'active',
            paymentStatus: data.isDemo ? 'paid' : 'pending',
            isDemo: data.isDemo || false,
            hotelName: hotelName,
            maxBranches: data.maxBranches || 1,
            branchNames: data.branchNames || {},
            branchCodes: data.branchCodes || [],
            createdBy: 'owner',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // 3. Create globalCodes (Master PIN)
        const masterCodeRef = db.collection('globalCodes').doc(data.code);
        batch.set(masterCodeRef, {
            tenantId: tenantId,
            managerId: managerId,
            type: 'manager',
            createdAt: admin.firestore.Timestamp.now(),
            createdBy: 'owner',
            name: data.name,
            phone: data.phone || '',
            phoneBackup: data.phoneBackup || '',
            status: 'active',
            role: 'manager',
            department: 'admin',
            licenseExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
            licenseStatus: 'active',
            hotelName: hotelName,
            maxBranches: data.maxBranches || 1,
            branchNames: data.branchNames || {},
            branches: [],
            branchCodes: data.branchCodes || []
        });
        // 4. Create branch codes in globalCodes
        if (data.branchCodes) {
            for (const bCode of data.branchCodes) {
                if (bCode === data.code)
                    continue; // Skip if same as master PIN
                const bCodeRef = db.collection('globalCodes').doc(bCode);
                batch.set(bCodeRef, {
                    tenantId: tenantId,
                    managerId: managerId,
                    branchId: `branch-${bCode}`,
                    type: 'manager',
                    createdAt: admin.firestore.Timestamp.now(),
                    createdBy: 'owner',
                    name: data.name,
                    status: 'active',
                    role: 'manager',
                    department: 'admin',
                    licenseExpiry: admin.firestore.Timestamp.fromDate(expiryDate),
                    licenseStatus: 'active',
                    hotelName: hotelName,
                    maxBranches: data.maxBranches || 1,
                    branchNames: data.branchNames || {},
                    branches: [],
                    branchCodes: data.branchCodes || []
                });
            }
        }
        // ✅ Commit batch (atomic operation)
        await batch.commit();
        // ✅ Auto-seed tenant data (achievements, ranks, etc.)
        try {
            const achievementsRef = db.collection('tenants').doc(tenantId)
                .collection('achievements');
            // Create default achievements (levels 1-20)
            const achievementsBatch = db.batch();
            for (let i = 0; i < 20; i++) {
                const points = (i + 1) * 100;
                let name = `المستوى ${i + 1}`;
                if (points === 500)
                    name = 'مشرف برونزي';
                if (points === 1000)
                    name = 'مشرف فضي';
                if (points === 1500)
                    name = 'مشرف ذهبي';
                if (points === 2000)
                    name = 'موظف ماسي';
                const achievementRef = achievementsRef.doc(`level-${i + 1}`);
                achievementsBatch.set(achievementRef, {
                    id: `level-${i + 1}`,
                    name,
                    description: `الوصول إلى ${points} نقطة تراكمية`,
                    pointsReward: 0,
                    icon: points >= 1500 ? 'Crown' : (points >= 1000 ? 'Medal' : 'Star'),
                    color: points >= 2000 ? 'text-cyan-400' : (points >= 1500 ? 'text-yellow-400' : 'text-blue-400'),
                    bgColor: points >= 2000 ? 'bg-cyan-500/20' : (points >= 1500 ? 'bg-yellow-500/20' : 'bg-blue-500/20'),
                    isRepeatable: false,
                    category: 'rank',
                    requirement: { type: 'points', value: points },
                    active: true,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            await achievementsBatch.commit();
            console.log('✅ Default achievements seeded for new tenant');
        }
        catch (seedErr) {
            console.warn('Could not seed tenant achievements (non-critical):', seedErr);
            // Don't fail manager creation - achievements can be created later
        }
        // ✅ Create financial documents (if not demo)
        if (!data.isDemo) {
            try {
                // Get system settings
                const settingsDoc = await db.collection('system').doc('settings').get();
                const settings = settingsDoc.exists ? settingsDoc.data() : {};
                const subscriptionPricePerBranch = (settings === null || settings === void 0 ? void 0 : settings.defaultSubscriptionPrice) || 1000;
                const numberOfBranches = data.maxBranches || 1;
                const subscriptionDuration = data.subscriptionDuration || 1;
                const baseAmount = subscriptionPricePerBranch * subscriptionDuration * numberOfBranches;
                let discountAmount = 0;
                let discountRate = 0;
                if (subscriptionDuration === 2 && (settings === null || settings === void 0 ? void 0 : settings.twoYearDiscountRate)) {
                    discountRate = settings.twoYearDiscountRate;
                    discountAmount = (baseAmount * discountRate) / 100;
                }
                const totalAmount = baseAmount - discountAmount;
                const firstBranchCode = ((_c = data.branchCodes) === null || _c === void 0 ? void 0 : _c[0]) || '1';
                const firstBranchName = ((_d = data.branchNames) === null || _d === void 0 ? void 0 : _d[firstBranchCode]) || `فرع ${firstBranchCode}`;
                // Create receipt voucher
                const receiptRef = db.collection('receiptVouchers').doc();
                await receiptRef.set({
                    tenantId: tenantId,
                    managerName: data.name,
                    managerCode: data.code,
                    branchCode: firstBranchCode,
                    branchName: firstBranchName,
                    totalAmount: totalAmount,
                    subscriptionPrice: subscriptionPricePerBranch,
                    numberOfBranches: numberOfBranches,
                    subscriptionDuration: subscriptionDuration,
                    currency: 'SAR',
                    paymentMethod: data.paymentMethod || 'deferred',
                    notes: discountAmount > 0
                        ? `اشتراك جديد - ${numberOfBranches} فرع - خصم ${discountRate}% للسنتين`
                        : `اشتراك جديد - ${numberOfBranches} فرع`,
                    discountAmount: discountAmount > 0 ? discountAmount : null,
                    discountRate: discountRate > 0 ? discountRate : null,
                    createdBy: 'owner',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`✅ Receipt voucher created for manager ${managerId}`);
            }
            catch (financialError) {
                console.warn('Failed to create financial documents (non-critical):', financialError);
                // Don't fail manager creation
            }
        }
        // ✅ Note: userBinding for manager will be created when they first login
        // We can't set binding for the new manager's anonymous UID yet
        // ✅ Log audit
        try {
            await db.collection('audit_logs').add({
                action: 'MANAGER_CREATE',
                entityType: 'manager',
                entityId: managerId,
                metadata: {
                    managerName: data.name,
                    hotelName: hotelName,
                    maxBranches: data.maxBranches || 1,
                    managerCode: data.code,
                },
                performedBy: context.auth.uid,
                performedByName: 'Owner',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        catch (auditError) {
            console.warn('Failed to create audit log (non-critical):', auditError);
        }
        return {
            success: true,
            managerId: managerId,
            tenantId: tenantId,
            message: `✅ تم إنشاء المدير "${data.name}" بنجاح!\n\n📋 الكود: ${data.code}\n🏢 Tenant ID: ${tenantId}\n\n✅ كل شيء جاهز للاستخدام تلقائياً!`
        };
    }
    catch (error) {
        console.error('createManager error:', error);
        return {
            success: false,
            error: error.message || 'حدث خطأ أثناء إنشاء المدير'
        };
    }
});
//# sourceMappingURL=managerCreation.js.map