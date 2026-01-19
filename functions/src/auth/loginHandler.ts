/**
 * ✅ Cloud Function: loginWithPin
 * Handles PIN-based login with Admin SDK (bypasses client Rules)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface LoginRequest {
  pin: string;
  branchId?: string;
}

interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    name: string;
    code: string;
    role: string;
    department?: string;
    tenantId: string;
    branchId?: string;
    availableBranches?: Array<{id: string; name: string; code?: string}>;
  };
  error?: string;
}

/**
 * ✅ Secure PIN Login via Cloud Function
 * Uses Admin SDK - bypasses client Rules complexity
 */
export const loginWithPin = functions.https.onCall(async (data: LoginRequest, context): Promise<LoginResponse> => {
  try {
    const { pin, branchId } = data;

    if (!pin || pin.length < 4) {
      return {
        success: false,
        error: 'كود الدخول غير صحيح'
      };
    }

    // ✅ Check globalCodes (managers/branches)
    const globalCodeDoc = await db.collection('globalCodes').doc(pin).get();
    
    if (globalCodeDoc.exists) {
      const codeData = globalCodeDoc.data()!;
      const tenantId = codeData.tenantId;
      const managerId = codeData.managerId;

      if (!tenantId || !managerId) {
        return {
          success: false,
          error: 'بيانات المدير غير مكتملة'
        };
      }

      // ✅ Load manager data from tenants collection
      const managerDoc = await db.collection('tenants').doc(tenantId)
        .collection('managers').doc(managerId).get();

      if (!managerDoc.exists) {
        return {
          success: false,
          error: 'المدير غير موجود'
        };
      }

      const managerData = managerDoc.data()!;

      // ✅ Check manager status
      if (managerData.status === 'suspended' || managerData.status === 'deleted') {
        return {
          success: false,
          error: 'تم إيقاف حسابك - يرجى التواصل مع إدارة النظام'
        };
      }

      // ✅ Load available branches
      const branchesSnapshot = await db.collection('tenants').doc(tenantId)
        .collection('branches').get();
      
      const availableBranches = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        code: doc.data().code
      }));

      return {
        success: true,
        user: {
          id: managerId,
          name: managerData.name || 'Manager',
          code: pin,
          role: 'manager',
          tenantId: tenantId,
          branchId: branchId,
          availableBranches
        }
      };
    }

    // ✅ Fallback: Check users collection (employees)
    const usersSnapshot = await db.collection('users')
      .where('code', '==', pin)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return {
        success: false,
        error: 'كود الدخول غير صحيح'
      };
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    // ✅ Check user status
    if (userData.status !== 'active') {
      return {
        success: false,
        error: 'حسابك غير نشط - يرجى التواصل مع المدير'
      };
    }

    // ✅ Check tenant status
    if (userData.tenantId) {
      const tenantDoc = await db.collection('tenants').doc(userData.tenantId).get();
      if (tenantDoc.exists) {
        const tenantData = tenantDoc.data()!;
        if (tenantData.status === 'suspended') {
          return {
            success: false,
            error: 'تم إيقاف الحساب - يرجى التواصل مع إدارة النظام'
          };
        }
      }
    }

    return {
      success: true,
      user: {
        id: userDoc.id,
        name: userData.name || 'Employee',
        code: pin,
        role: userData.role || 'employee',
        department: userData.department,
        tenantId: userData.tenantId || '',
        branchId: branchId
      }
    };

  } catch (error: any) {
    console.error('Login error:', error);
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء تسجيل الدخول'
    };
  }
});
