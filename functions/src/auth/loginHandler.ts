/**
 * ✅ Cloud Function: loginWithPin
 * Handles PIN-based login with Admin SDK (bypasses client Rules)
 * Phase 7: Rate limit applied at start to prevent brute force
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { checkRateLimit } from '../security/rateLimiter';

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
    const rawPin = data?.pin;
    const pin = typeof rawPin === 'string' ? rawPin.trim() : String(rawPin || '').trim();
    const branchId = data?.branchId;

    if (!pin || pin.length < 4) {
      return {
        success: false,
        error: 'كود الدخول غير صحيح (4 أرقام على الأقل)'
      };
    }

    // ✅ Phase 7: Rate limit by IP (or PIN+IP if IP not available)
    const rawReq = context.rawRequest as { ip?: string; connection?: { remoteAddress?: string } } | undefined;
    const ip = rawReq?.ip ?? rawReq?.connection?.remoteAddress ?? 'unknown';
    const identifier = ip !== 'unknown' ? ip : `pin_${pin.substring(0, 4)}`;
    const rateResult = await checkRateLimit(identifier, 'login');
    if (!rateResult.allowed) {
      const minutes = rateResult.blockedUntil
        ? Math.ceil((rateResult.blockedUntil.getTime() - Date.now()) / 60000)
        : 15;
      return {
        success: false,
        error: `تم تجاوز عدد المحاولات. يرجى المحاولة لاحقاً (بعد ${minutes} دقيقة).`
      };
    }

    // ✅ Check globalCodes (managers) — document ID must match PIN exactly (e.g. "1111")
    const globalCodeDoc = await db.collection('globalCodes').doc(pin).get();
    
    if (globalCodeDoc.exists) {
      const codeData = globalCodeDoc.data()!;
      const tenantId = codeData.tenantId as string;
      const managerId = codeData.managerId as string;

      if (!tenantId || !managerId) {
        return {
          success: false,
          error: 'بيانات المدير غير مكتملة'
        };
      }

      let managerData: Record<string, any> | null = null;
      let availableBranches: Array<{ id: string; name: string; code?: string }> = [];

      // ✅ 1) Try tenants/{tenantId}/managers/{managerId} (legacy)
      const managerDoc = await db.collection('tenants').doc(tenantId)
        .collection('managers').doc(managerId).get();

      if (managerDoc.exists) {
        managerData = managerDoc.data()!;
        const branchesSnapshot = await db.collection('tenants').doc(tenantId)
          .collection('branches').get();
        availableBranches = branchesSnapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name || '',
          code: d.data().code
        }));
      }

      // ✅ 2) If not in tenants/.../managers, load from users/{managerId} (createManager stores here)
      if (!managerData) {
        const userDoc = await db.collection('users').doc(managerId).get();
        if (!userDoc.exists) {
          return {
            success: false,
            error: 'المدير غير موجود. تأكد من إضافة المدير من لوحة المالك (إضافة مدير) ثم استخدام نفس الكود.'
          };
        }
        const userData = userDoc.data()!;
        const userTenantId = userData.tenantId;
        const userRole = userData.role;
        if (userTenantId !== tenantId || (userRole !== 'manager' && userRole !== 'admin')) {
          return {
            success: false,
            error: 'بيانات الدخول غير مطابقة. تأكد من استخدام كود المدير الصحيح.'
          };
        }
        managerData = userData;
        // Build branches from branchCodes / branchNames (new managers may not have branches subcollection yet)
        const branchCodes = (userData.branchCodes || codeData.branchCodes || []) as string[];
        const branchNames = (userData.branchNames || codeData.branchNames || {}) as Record<string, string>;
        availableBranches = branchCodes.map((code: string) => ({
          id: `branch-${code}`,
          name: branchNames[code] || `فرع ${code}`,
          code
        }));
      }

      if (!managerData) {
        return { success: false, error: 'المدير غير موجود' };
      }

      if (managerData.status === 'suspended' || managerData.status === 'deleted') {
        return {
          success: false,
          error: 'تم إيقاف حسابك - يرجى التواصل مع إدارة النظام'
        };
      }

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
        error: 'كود الدخول غير صحيح. إذا كنت مديراً، تأكد من إضافة حسابك من لوحة المالك (إضافة مدير) واستخدام نفس الكود.'
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
