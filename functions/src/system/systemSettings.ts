/**
 * ✅ Cloud Function: getSystemSettings
 * Handles system settings retrieval with Admin SDK
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Admin SDK if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface SystemSettingsResponse {
  success: boolean;
  settings?: any;
  error?: string;
}

/**
 * ✅ Get System Settings via Cloud Function
 * Uses Admin SDK - no Rules needed
 */
export const getSystemSettings = functions.https.onCall(async (data, context): Promise<SystemSettingsResponse> => {
  try {
    // ✅ Require authentication (any authenticated user can read)
    if (!context.auth) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    const settingsDoc = await db.collection('system').doc('settings').get();

    if (!settingsDoc.exists) {
      // Return default settings
      return {
        success: true,
        settings: {
          defaultSubscriptionPrice: 1000,
          developerBranding: null
        }
      };
    }

    const settingsData = settingsDoc.data()!;

    return {
      success: true,
      settings: settingsData
    };

  } catch (error: any) {
    console.error('getSystemSettings error:', error);
    return {
      success: false,
      error: error.message || 'Failed to load system settings'
    };
  }
});

/**
 * ✅ Set System Settings (Owner only)
 */
export const setSystemSettings = functions.https.onCall(async (data, context): Promise<SystemSettingsResponse> => {
  try {
    // ✅ Require authentication
    if (!context.auth) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // ✅ Check if user is owner (from custom claims or userBindings)
    const userBindingsDoc = await db.collection('userBindings').doc(context.auth.uid).get();
    
    let isOwner = false;
    if (userBindingsDoc.exists) {
      const bindingData = userBindingsDoc.data()!;
      isOwner = bindingData.role === 'owner';
    }

    // Also check custom claims
    if (!isOwner) {
      try {
        const userRecord = await admin.auth().getUser(context.auth.uid);
        isOwner = userRecord.customClaims?.role === 'owner' || 
                  userRecord.customClaims?.super_admin === true;
      } catch (e) {
        // Ignore
      }
    }

    if (!isOwner) {
      return {
        success: false,
        error: 'Unauthorized: Owner access required'
      };
    }

    // ✅ Update settings
    await db.collection('system').doc('settings').set(data.settings, { merge: true });

    return {
      success: true,
      settings: data.settings
    };

  } catch (error: any) {
    console.error('setSystemSettings error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update system settings'
    };
  }
});
